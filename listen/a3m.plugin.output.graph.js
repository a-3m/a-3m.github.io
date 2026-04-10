// File: a3m.plugin.output.graph.js
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const A3M = window.A3M || (window.A3M = {});

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function clamp(n, a, b){
		n = parseFloat(n);
		if (!isFinite(n)) n = a;
		return Math.min(b, Math.max(a, n));
	}

	function parseQuery(qs){
		const out = {};
		const parts = String(qs || '').split('&');
		let i = 0;
		let p = null;
		let k = '';
		let v = '';

		for (i = 0; i < parts.length; i++) {
			p = parts[i];
			if (!p) continue;

			p = p.split('=');
			k = decodeURIComponent(p.shift() || '');
			v = decodeURIComponent(p.join('=') || '');

			if (!k) continue;
			out[k] = v;
		}

		return out;
	}

	function parseSource(src){
		const m = /^([a-z0-9+.-]+):\/\/([^?]*)(?:\?(.*))?$/i.exec(cleanText(src));
		return m ? {
			scheme: m[1].toLowerCase(),
			path: cleanText(m[2]),
			query: parseQuery(m[3] || '')
		} : null;
	}

	function outputMode(v){
		v = cleanText(v).toLowerCase();
		return /^(null|auto|2ch|4ch)$/.test(v) ? v : 'auto';
	}

	function writeAscii(view, off, text){
		let i = 0;

		for (i = 0; i < text.length; i++) view.setUint8(off + i, text.charCodeAt(i));
	}

	function silentWaveBlob(seconds, sampleRate){
		const channels = 2;
		const totalFrames = Math.max(1, Math.floor(seconds * sampleRate));
		const bytesPerSample = 2;
		const blockAlign = channels * bytesPerSample;
		const byteRate = sampleRate * blockAlign;
		const dataSize = totalFrames * blockAlign;
		const buf = new ArrayBuffer(44 + dataSize);
		const view = new DataView(buf);
		let off = 44;
		let i = 0;

		writeAscii(view, 0, 'RIFF');
		view.setUint32(4, 36 + dataSize, true);
		writeAscii(view, 8, 'WAVE');
		writeAscii(view, 12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, channels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, byteRate, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bytesPerSample * 8, true);
		writeAscii(view, 36, 'data');
		view.setUint32(40, dataSize, true);

		for (i = 0; i < totalFrames * channels; i++) {
			view.setInt16(off, 0, true);
			off += 2;
		}

		return new Blob([ buf ], { type: 'audio/wav' });
	}

	function PluginOutputGraph(opts){
		this.options = opts || {};
	}

	PluginOutputGraph.prototype.attach = function(ctx){
		const plog = ctx.plog.child('output.graph');
		const bus = ctx.bus;
		const off = [];
		const root = ctx.root || document.body || document.documentElement;
		const testFreqs = Array.isArray(this.options.testFreqs) && this.options.testFreqs.length
			? this.options.testFreqs.slice()
			: [ 110, 220, 330, 440, 550, 660, 880, 990 ];
		const testSeconds = Math.max(1, parseFloat(this.options.testSeconds || 8) || 8);
		const testSampleRate = Math.max(8000, parseInt(this.options.testSampleRate || 44100, 10) || 44100);

		let audioCtx = null;
		let finalGain = null;
		let merger = null;
		let mediaEl = null;
		let mediaNode = null;
		let mediaSplitter = null;
		let mediaGains = [];
		let testGains = [];
		let testOsc = null;
		let currentSource = '';
		let currentKind = '';
		let currentTrack = null;
		let currentQuery = {};
		let requestedMode = outputMode(this.options.outputMode || 'auto');
		let resolvedMode = 'null';
		let currentFreq = 440;
		let currentFreqIndex = 3;
		let mediaReloading = false;
		let testBlobUrl = '';
		let currentVolume = clamp(this.options.volume != null ? this.options.volume : 1, 0, 1);
		let currentMuted = !!this.options.muted;

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function emit(type, detail){
			bus.emit(type, detail || {});
		}

		function emitVolume(){
			emit('evt:volume', {
				volume: currentVolume,
				muted: currentMuted
			});
		}

		function applyMasterGain(){
			if (!finalGain) return;
			finalGain.gain.value = currentMuted ? 0 : currentVolume;
		}

		function modeChannels(mode){
			if (mode === '4ch') return 4;
			if (mode === '2ch') return 2;
			return 0;
		}

		function activeGains(mode){
			if (mode === '4ch') return [ 1, 1, 1, 1 ];
			if (mode === '2ch') return [ 1, 1, 0, 0 ];
			return [ 0, 0, 0, 0 ];
		}

		function setGainValues(list, vals){
			let i = 0;

			for (i = 0; i < list.length; i++) {
				list[i].gain.value = vals[i] || 0;
			}
		}

		function revokeTestBlob(){
			if (!testBlobUrl) return;

			try { URL.revokeObjectURL(testBlobUrl); } catch (e) {}
			testBlobUrl = '';
		}

		function ensureAudioContext(){
			let i = 0;

			if (audioCtx) return true;
			if (typeof AudioContext !== 'function' && typeof webkitAudioContext !== 'function') {
				emit('evt:error', {
					message: 'AudioContext not supported'
				});
				return false;
			}

			audioCtx = new (window.AudioContext || window.webkitAudioContext)();
			finalGain = audioCtx.createGain();
			merger = audioCtx.createChannelMerger(4);

			for (i = 0; i < 4; i++) {
				mediaGains[i] = audioCtx.createGain();
				testGains[i] = audioCtx.createGain();
				mediaGains[i].connect(merger, 0, i);
				testGains[i].connect(merger, 0, i);
			}

			merger.connect(finalGain);
			applyMasterGain();

			ensureMediaHelper();
			applyOutputMode(requestedMode);

			return true;
		}

		function ensureMediaHelper(){
			if (mediaEl) return;

			mediaEl = document.createElement('audio');
			mediaEl.preload = 'none';
			mediaEl.crossOrigin = 'anonymous';
			mediaEl.style.position = 'absolute';
			mediaEl.style.left = '-9999px';
			mediaEl.style.top = '-9999px';
			mediaEl.style.width = '1px';
			mediaEl.style.height = '1px';
			mediaEl.style.opacity = '0';
			mediaEl.style.pointerEvents = 'none';
			root.appendChild(mediaEl);

			mediaNode = audioCtx.createMediaElementSource(mediaEl);
			mediaSplitter = audioCtx.createChannelSplitter(2);

			mediaNode.connect(mediaSplitter);
			mediaSplitter.connect(mediaGains[0], 0, 0);
			mediaSplitter.connect(mediaGains[2], 0, 0);
			mediaSplitter.connect(mediaGains[1], 1, 0);
			mediaSplitter.connect(mediaGains[3], 1, 0);

			mediaEl.addEventListener('loadedmetadata', function(){
				mediaReloading = false;
				emit('evt:ready', {
					duration: isFinite(mediaEl.duration) ? mediaEl.duration : 0
				});
			});

			mediaEl.addEventListener('timeupdate', function(){
				emit('evt:time', {
					position: isFinite(mediaEl.currentTime) ? mediaEl.currentTime : 0,
					duration: isFinite(mediaEl.duration) ? mediaEl.duration : 0
				});
			});

			mediaEl.addEventListener('play', function(){
				mediaReloading = false;

				if (currentKind === 'test-shadow') startTestEngine();

				emit('evt:play', {});
			});

			mediaEl.addEventListener('pause', function(){
				stopTestEngine();

				if (mediaReloading) return;

				emit('evt:pause', {});
			});

			mediaEl.addEventListener('ended', function(){
				stopTestEngine();
				emit('evt:ended', {
					position: isFinite(mediaEl.currentTime) ? mediaEl.currentTime : 0,
					duration: isFinite(mediaEl.duration) ? mediaEl.duration : 0
				});
			});

			mediaEl.addEventListener('error', function(){
				let msg = 'Audio media error';

				if (mediaEl.error && mediaEl.error.message) msg = mediaEl.error.message;
				else if (mediaEl.error && isFinite(mediaEl.error.code)) msg = 'Audio media error #' + mediaEl.error.code;

				stopTestEngine();
				mediaReloading = false;
				emit('evt:error', {
					message: cleanText(msg)
				});
			});
		}

		function resumeContext(){
			if (!audioCtx) return Promise.resolve(false);
			if (audioCtx.state !== 'suspended') return Promise.resolve(true);
			return audioCtx.resume().then(function(){
				return true;
			}).catch(function(e){
				emit('evt:error', {
					message: cleanText(e && e.message || 'AudioContext resume failed')
				});
				return false;
			});
		}

		function startTestEngine(){
			let i = 0;

			if (!ensureAudioContext()) return;
			if (testOsc) return;

			testOsc = audioCtx.createOscillator();
			testOsc.type = 'sine';
			testOsc.frequency.value = currentFreq;

			for (i = 0; i < testGains.length; i++) testOsc.connect(testGains[i]);

			try {
				testOsc.start();
			} catch (e) {}
		}

		function stopTestEngine(){
			if (!testOsc) return;

			try { testOsc.stop(); } catch (e) {}
			try { testOsc.disconnect(); } catch (e) {}

			testOsc = null;
		}

		function currentMeta(){
			let track = currentTrack || {};
			let title = track.title;
			let artist = track.artist;
			let album = track.album;
			let cover = track.cover;
			let helper = 'HTMLAudioElement';

			if (currentKind === 'test-shadow') {
				title = title || ('Sine ' + currentFreq + ' Hz');
				artist = artist || 'A3M Test';
				album = album || 'test://sin';
				cover = cover || '';
				helper = 'Oscillator + HTMLAudioElement shadow';
			} else if (currentKind === 'media') {
				title = title || currentSource;
				artist = artist || '';
				album = album || '';
				cover = cover || '';
				helper = 'HTMLAudioElement';
			}

			return {
				source: currentSource,
				track: {
					src: currentSource,
					title: cleanText(title),
					artist: cleanText(artist),
					album: cleanText(album),
					cover: cleanText(cover)
				},
				meta: {
					title: cleanText(title),
					artist: cleanText(artist),
					album: cleanText(album),
					cover: cleanText(cover),
					outputMode: requestedMode,
					outputModeResolved: resolvedMode,
					channels: modeChannels(resolvedMode),
					helper: helper,
					freq: currentKind === 'test-shadow' ? String(currentFreq) : ''
				}
			};
		}

		function emitMeta(){
			emit('evt:meta', currentMeta());
		}

		function resolveOutputMode(mode){
			const max = audioCtx && audioCtx.destination && isFinite(audioCtx.destination.maxChannelCount)
				? audioCtx.destination.maxChannelCount
				: 0;

			mode = outputMode(mode);

			if (mode === 'null') return 'null';
			if (mode === '4ch' && max >= 4) return '4ch';
			if (mode === '4ch') return '2ch';
			if (mode === '2ch') return '2ch';
			if (max >= 4) return '4ch';

			return '2ch';
		}

		function connectDestination(on){
			try { finalGain.disconnect(); } catch (e) {}

			if (!on) return;

			try {
				audioCtx.destination.channelCountMode = 'explicit';
				audioCtx.destination.channelInterpretation = 'discrete';
			} catch (e) {}

			try {
				if (resolvedMode === '4ch' && audioCtx.destination.maxChannelCount >= 4) {
					audioCtx.destination.channelCount = 4;
				} else if (audioCtx.destination.maxChannelCount >= 2) {
					audioCtx.destination.channelCount = 2;
				}
			} catch (e) {}

			finalGain.connect(audioCtx.destination);
		}

		function applyOutputMode(mode){
			if (!ensureAudioContext()) return;

			requestedMode = outputMode(mode || requestedMode);
			resolvedMode = resolveOutputMode(requestedMode);

			connectDestination(resolvedMode !== 'null');
			setGainValues(mediaGains, currentKind === 'media' ? activeGains(resolvedMode) : [ 0, 0, 0, 0 ]);
			setGainValues(testGains, currentKind === 'test-shadow' ? activeGains(resolvedMode) : [ 0, 0, 0, 0 ]);
			applyMasterGain();
		}

		function nearestFreqIndex(freq){
			let idx = 0;
			let best = Infinity;
			let d = 0;
			let i = 0;

			for (i = 0; i < testFreqs.length; i++) {
				d = Math.abs(testFreqs[i] - freq);
				if (d < best) {
					best = d;
					idx = i;
				}
			}

			return idx;
		}

		function pickFreq(value){
			value = cleanText(value).toLowerCase();

			if (value === 'rnd') {
				currentFreqIndex = Math.floor(Math.random() * testFreqs.length);
				currentFreq = testFreqs[currentFreqIndex];
				return;
			}

			if (/^\d+(\.\d+)?$/.test(value)) {
				currentFreq = parseFloat(value);
				currentFreqIndex = nearestFreqIndex(currentFreq);
				return;
			}

			currentFreqIndex = nearestFreqIndex(440);
			currentFreq = testFreqs[currentFreqIndex];
		}

		function playMedia(){
			resumeContext().then(function(ok){
				if (!ok || !mediaEl) return;
				mediaEl.play().catch(function(e){
					stopTestEngine();
					mediaReloading = false;
					emit('evt:error', {
						message: cleanText(e && e.message || 'Media play failed')
					});
				});
			});
		}

		function pauseMedia(reason){
			if (!mediaEl) return;

			stopTestEngine();
			mediaReloading = reason === 'reload';

			if (!mediaEl.paused) mediaEl.pause();

			if (reason === 'stop') {
				try { mediaEl.currentTime = 0; } catch (e) {}
				emit('evt:stop', {
					position: 0
				});
				emit('evt:time', {
					position: 0,
					duration: isFinite(mediaEl.duration) ? mediaEl.duration : 0
				});
			}
		}

		function loadBlobSource(blob, source, detail){
			const autoplay = !!(detail && detail.autoplay);

			if (!ensureAudioContext()) return;

			revokeTestBlob();
			testBlobUrl = URL.createObjectURL(blob);

			currentSource = source;
			currentKind = 'test-shadow';
			currentTrack = detail && detail.track ? detail.track : null;

			applyOutputMode(requestedMode);

			emit('evt:load', {
				source: currentSource,
				src: currentSource
			});
			emitMeta();

			mediaEl.loop = false;
			mediaEl.src = testBlobUrl;
			mediaEl.load();

			if (autoplay) playMedia();
			else emit('evt:pause', {});
		}

		function loadTest(source, detail){
			const parsed = parseSource(source);
			let blob = null;

			pauseMedia('reload');

			currentQuery = parsed ? parsed.query : {};
			pickFreq(currentQuery.freq || '440');
			blob = silentWaveBlob(testSeconds, testSampleRate);

			loadBlobSource(blob, source, detail);
		}

		function loadMedia(source, detail){
			const autoplay = !!(detail && detail.autoplay);

			if (!ensureAudioContext()) return;

			revokeTestBlob();
			pauseMedia('reload');

			currentSource = source;
			currentKind = 'media';
			currentQuery = {};
			currentTrack = detail && detail.track ? detail.track : {
				src: source,
				title: source,
				artist: '',
				album: '',
				cover: ''
			};

			applyOutputMode(requestedMode);

			emit('evt:load', {
				source: currentSource,
				src: currentSource
			});
			emitMeta();

			mediaEl.loop = false;
			mediaEl.src = source;
			mediaEl.load();

			if (autoplay) playMedia();
			else emit('evt:pause', {});
		}

		function loadSource(detail){
			let source = '';

			detail = detail || {};
			source = cleanText(detail.source || detail.src || '');

			if (!source) {
				emit('evt:error', {
					message: 'No source'
				});
				return;
			}

			plog.log('load', source);

			if (/^test:\/\/sin(?:$|[?])/i.test(source)) loadTest(source, detail);
			else loadMedia(source, detail);
		}

		function shiftFreq(step){
			let autoplay = false;

			if (currentKind !== 'test-shadow') return;

			autoplay = !!ctx.getState().playing;

			currentFreqIndex += step;
			if (currentFreqIndex < 0) currentFreqIndex = testFreqs.length - 1;
			if (currentFreqIndex >= testFreqs.length) currentFreqIndex = 0;

			currentFreq = testFreqs[currentFreqIndex];

			loadTest('test://sin?freq=' + encodeURIComponent(String(currentFreq)), {
				autoplay: autoplay,
				track: currentTrack
			});
		}

		listen('cmd:init', function(){
			if (!ensureAudioContext()) return;
			emitMeta();
			emitVolume();
		});

		listen('cmd:load', function(detail){
			loadSource(detail);
		});

		listen('cmd:play', function(){
			if (!currentSource) return;
			playMedia();
		});

		listen('cmd:pause', function(){
			pauseMedia('pause');
		});

		listen('cmd:stop', function(){
			pauseMedia('stop');
		});

		listen('cmd:seek', function(detail){
			let pos = detail && typeof detail === 'object'
				? detail.position
				: detail;

			if (!isFinite(pos) || !mediaEl) return;

			try { mediaEl.currentTime = Math.max(0, parseFloat(pos) || 0); } catch (e) {}

			if (currentKind === 'test-shadow' && !mediaEl.paused) {
				stopTestEngine();
				startTestEngine();
			}
		});

		listen('cmd:next', function(){
			shiftFreq(1);
		});

		listen('cmd:prev', function(){
			shiftFreq(-1);
		});

		listen('cmd:set-volume', function(detail){
			let v = detail && typeof detail === 'object'
				? (detail.volume != null ? detail.volume : detail.value)
				: detail;

			if (!isFinite(v)) return;

			currentVolume = clamp(v, 0, 1);
			if (currentVolume > 0 && currentMuted) currentMuted = false;
			applyMasterGain();
			emitVolume();
		});

		listen('cmd:set-muted', function(detail){
			let muted = detail && typeof detail === 'object'
				? detail.muted
				: detail;

			currentMuted = !!muted;
			applyMasterGain();
			emitVolume();
		});

		listen('cmd:output-mode', function(detail){
			let mode = detail && typeof detail === 'object' ? detail.mode : detail;

			plog.log('output mode', mode);
			applyOutputMode(mode);
			emitMeta();
		});

		return function(){
			let i = 0;

			stopTestEngine();

			for (i = 0; i < off.length; i++) off[i]();

			revokeTestBlob();

			if (mediaEl) {
				try { mediaEl.pause(); } catch (e) {}
				mediaEl.removeAttribute('src');
				try { mediaEl.srcObject = null; } catch (e) {}
				mediaEl.load();

				if (mediaEl.parentNode) mediaEl.parentNode.removeChild(mediaEl);
			}

			try { finalGain && finalGain.disconnect(); } catch (e) {}
			try { merger && merger.disconnect(); } catch (e) {}
			try { mediaNode && mediaNode.disconnect(); } catch (e) {}
			try { mediaSplitter && mediaSplitter.disconnect(); } catch (e) {}

			for (i = 0; i < mediaGains.length; i++) {
				try { mediaGains[i].disconnect(); } catch (e) {}
			}

			for (i = 0; i < testGains.length; i++) {
				try { testGains[i].disconnect(); } catch (e) {}
			}

			if (audioCtx && typeof audioCtx.close === 'function') {
				audioCtx.close().catch(function(){});
			}
		};
	};

	A3M.PluginOutputGraph = PluginOutputGraph;
})();