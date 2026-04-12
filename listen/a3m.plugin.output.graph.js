/* file: a3m.plugin.output.graph.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log } = a3m.logp('output.graph');

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

	function parseRateValue(v, fallback){
		let n = 0;

		v = cleanText(v).toLowerCase();
		if (!v) return fallback;

		if (/k$/.test(v)) {
			n = parseFloat(v.replace(/k$/, ''));
			return isFinite(n) && n > 0 ? Math.round(n * 1000) : fallback;
		}

		n = parseFloat(v);
		return isFinite(n) && n > 0 ? Math.round(n) : fallback;
	}

	function parseTimeValue(v, fallback){
		let n = 0;

		v = cleanText(v).toLowerCase();
		if (!v) return fallback;

		if (/ms$/.test(v)) {
			n = parseFloat(v.replace(/ms$/, ''));
			return isFinite(n) ? n : fallback;
		}

		if (/s$/.test(v)) {
			n = parseFloat(v.replace(/s$/, ''));
			return isFinite(n) ? (n * 1000) : fallback;
		}

		n = parseFloat(v);
		return isFinite(n) ? n : fallback;
	}

	function parseFreqValue(v){
		let n = 0;

		v = cleanText(v).toLowerCase();
		if (!v) return '440';
		if (v === 'rnd' || v === 'random') return 'rnd';
		if (/hz$/.test(v)) v = cleanText(v.replace(/hz$/i, ''));
		n = parseFloat(v);
		return isFinite(n) && n > 0 ? String(n) : '440';
	}

	function parseNoiseValue(v){
		v = cleanText(v).toLowerCase();
		if (!v) return 'white';
		if (v === 'rnd' || v === 'random') return 'rnd';
		if (/^(white|pink|brown)$/.test(v)) return v;
		return 'white';
	}

	function decodeA3msMetaValue(v){
		v = String(v == null ? '' : v);

		try {
			return decodeURIComponent(v);
		} catch (e) {
			return v;
		}
	}

	function fitFont(ctx, text, want, maxWidth, weight, family){
		let size = want;

		while (size > 10) {
			ctx.font = (weight || '400') + ' ' + size + 'px ' + (family || 'Arial');
			if (ctx.measureText(text).width <= maxWidth) return;
			size -= 2;
		}
	}

	function a3msFmtFreq(v){
		v = parseFloat(v);
		if (!isFinite(v) || v <= 0) return '440';
		if (Math.abs(v - Math.round(v)) < 0.001) return String(Math.round(v));
		return String(v);
	}

	function a3msTitleCase(s){
		s = cleanText(s).toLowerCase();
		if (!s) return '';
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function makeA3msChannel(){
		return {
			gen: null,
			env: null,
			gain: 1,
			sms: 0,
			dms: null,
			hasDuration: false
		};
	}

	function chooseRndFreq(){
		const list = [ 110, 165, 220, 330, 440, 550, 660, 880, 990 ];
		return list[Math.floor(Math.random() * list.length)] || 440;
	}

	function chooseRndNoise(){
		const list = [ 'white', 'pink', 'brown' ];
		return list[Math.floor(Math.random() * list.length)] || 'white';
	}

	function a3msChannelLabel(ch){
		if (!ch || !ch.gen) return '';

		if (ch.gen.type === 'sin') {
			return 'Sin ' + (ch.gen.freq === 'rnd' ? 'Rnd' : a3msFmtFreq(ch.gen.freq));
		}

		if (ch.gen.type === 'noise') {
			return 'Noise ' + a3msTitleCase(ch.gen.noise === 'rnd' ? 'rnd' : ch.gen.noise);
		}

		return '';
	}

	function parseA3msArt(s){
		const out = {};
		const parts = String(s == null ? '' : s).split(':');
		let i = 0;
		let p = null;
		let k = '';
		let v = '';

		for (i = 0; i < parts.length; i++) {
			p = String(parts[i] == null ? '' : parts[i]).split('=');
			k = cleanText(p.shift() || '').toLowerCase();
			v = cleanText(decodeA3msMetaValue(p.join('=') || ''));

			if (!k) continue;
			if (k === 'color' && v.toLowerCase() === 'write') v = 'white';

			out[k] = v;
		}

		return out;
	}

	function drawA3msArtCover(size, art, meta){
		const cnv = document.createElement('canvas');
		const g = cnv.getContext && cnv.getContext('2d');
		const bg = cleanText(art && (art.bg || art.background) || '#102');
		const color = cleanText(art && (art.color || art.fg) || 'white');
		const text = cleanText(art && art.text || meta && meta.title || 'A3MS');
		const sub = cleanText(art && art.sub || meta && meta.album || '');
		let grad = null;

		if (!g) return '';

		cnv.width = size;
		cnv.height = size;

		grad = g.createLinearGradient(0, 0, size, size);
		grad.addColorStop(0, bg);
		grad.addColorStop(1, '#000');
		g.fillStyle = grad;
		g.fillRect(0, 0, size, size);

		g.globalAlpha = 0.18;
		g.fillStyle = color;
		g.beginPath();
		g.arc(size * 0.20, size * 0.18, size * 0.15, 0, Math.PI * 2);
		g.fill();
		g.beginPath();
		g.arc(size * 0.82, size * 0.78, size * 0.19, 0, Math.PI * 2);
		g.fill();
		g.globalAlpha = 1;

		g.fillStyle = color;
		g.textAlign = 'center';
		g.textBaseline = 'middle';

		fitFont(g, text, Math.round(size * 0.14), size * 0.82, '600', 'Arial');
		g.fillText(text, size * 0.5, size * 0.48);

		if (sub) {
			g.fillStyle = 'rgba(255,255,255,0.68)';
			fitFont(g, sub, Math.round(size * 0.045), size * 0.72, '400', 'Arial');
			g.fillText(sub, size * 0.5, size * 0.62);
		}

		try {
			return cnv.toDataURL('image/png');
		} catch (e) {
			return '';
		}
	}

	function a3msArtCoverSet(art, meta){
		const cover = drawA3msArtCover(1024, art, meta);

		if (!cover) return null;

		return {
			cover: cover,
			cover512: drawA3msArtCover(512, art, meta) || cover,
			cover256: drawA3msArtCover(256, art, meta) || cover
		};
	}

	function deriveA3msMeta(config, source){
		const out = {};
		const labels = [];
		const now = new Date();
		let i = 0;
		let used = 0;
		let title = '';

		config = config || {};
		config.meta = config.meta || {};
		config.channels = Array.isArray(config.channels) ? config.channels : [];

		for (i = 0; i < config.cc; i++) {
			if (!config.channels[i] || !config.channels[i].gen) continue;
			used++;
			if (labels.length < 2) labels.push(a3msChannelLabel(config.channels[i]));
		}

		title = labels.join(' / ');
		if (!title) title = 'A3MS Synth';
		if (used > labels.length) title += ' / ...';
		if (used > 1) title += ' · ' + used + 'ch';

		out.title = cleanText(config.meta.title || title);
		out.artist = cleanText(config.meta.artist || 'A3M Synth');
		out.album = cleanText(config.meta.album || 'A3MS');
		out.year = cleanText(config.meta.year || String(now.getFullYear()));
		out.date = cleanText(
			config.meta.date ||
			(now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0'))
		);
		out.tracknum = cleanText(config.meta.tracknum || config.meta.track || '');
		out.tracks = cleanText(config.meta.tracks || '');
		out.cover = cleanText(config.meta.cover || '');
		out.sampleRate = String(config.sr || 48000);
		out.trackDuration = String((config.tdms || 3000) / 1000);
		out.channels = String(config.cc || 2);
		out.helper = 'A3MS -> WAV blob + HTMLAudioElement';
		out.sourceKind = 'a3ms';
		out.a3ms = '1';
		out.source = cleanText(source || '');

		return out;
	}

	function parseA3msSource(source){
		const raw = String(source || '').replace(/^a3ms:\/\//i, '');
		const tokens = raw.split('+');
		const out = {
			sr: 48000,
			cc: 2,
			tdms: 3000,
			meta: {},
			art: null,
			channels: [ makeA3msChannel(), makeA3msChannel(), makeA3msChannel(), makeA3msChannel() ]
		};
		let cur = 0;
		let tok = '';
		let m = null;
		let ch = null;
		let i = 0;
		let parts = null;
		let period = 0;
		let amp = 0;
		let key = '';
		let set = null;

		for (i = 0; i < tokens.length; i++) {
			tok = cleanText(tokens[i]);
			if (!tok) continue;

			if (/^c$/i.test(tok)) {
				cur = Math.min(3, cur + 1);
				continue;
			}

			m = /^m:([a-z0-9_]+)\s*=\s*(.*)$/i.exec(tok);
			if (m) {
				key = cleanText(m[1]).toLowerCase();
				if (key) out.meta[key] = cleanText(decodeA3msMetaValue(m[2]));
				continue;
			}

			m = /^a:(.+)$/i.exec(tok);
			if (m) {
				out.art = parseA3msArt(m[1]);
				continue;
			}

			m = /^cc\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				out.cc = Math.max(1, Math.min(4, parseInt(m[1], 10) || 2));
				continue;
			}

			m = /^sr\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				out.sr = Math.max(8000, Math.min(192000, parseRateValue(m[1], out.sr)));
				continue;
			}

			m = /^td\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				out.tdms = parseTimeValue(m[1], out.tdms);
				continue;
			}

			m = /^ch\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				cur = Math.max(0, Math.min(3, parseInt(m[1], 10) || 0));
				continue;
			}

			ch = out.channels[cur];

			m = /^s\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				ch.sms = parseTimeValue(m[1], ch.sms);
				continue;
			}

			m = /^d\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				ch.dms = parseTimeValue(m[1], out.tdms);
				ch.hasDuration = true;
				continue;
			}

			m = /^gain\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				ch.gain = clamp(m[1], 0, 4);
				continue;
			}

			m = /^(?:envsin|env)\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				parts = String(m[1] || '').split(',');
				period = Math.max(1, parseTimeValue(parts[0], 1000));
				amp = clamp(parts[1], 0, 1);
				ch.env = {
					type: 'envsin',
					periodMs: period,
					amp: amp
				};
				continue;
			}

			m = /^sin(?:\s*=\s*|\s+)(.+)$/i.exec(tok);
			if (m) {
				ch.gen = {
					type: 'sin',
					freq: parseFreqValue(m[1])
				};
				continue;
			}

			m = /^noise(?:\s*=\s*|\s+)(.+)$/i.exec(tok);
			if (m) {
				ch.gen = {
					type: 'noise',
					noise: parseNoiseValue(m[1])
				};
				continue;
			}

			if (/^(white|pink|brown)$/i.test(tok)) {
				ch.gen = {
					type: 'noise',
					noise: parseNoiseValue(tok)
				};
			}
		}

		out.tdms = Math.max(1, Math.min(30000, parseTimeValue(out.tdms, 3000) || 3000));

		for (i = 0; i < out.channels.length; i++) {
			ch = out.channels[i];
			ch.sms = Math.max(0, Math.min(out.tdms, parseTimeValue(ch.sms, 0) || 0));
			if (!ch.hasDuration) ch.dms = Math.max(0, out.tdms - ch.sms);
			ch.dms = Math.max(0, Math.min(out.tdms - ch.sms, parseTimeValue(ch.dms, out.tdms - ch.sms) || 0));
		}

		out.meta = deriveA3msMeta(out, source);

		if (out.art) {
			set = a3msArtCoverSet(out.art, out.meta);
			if (set && set.cover) {
				out.meta.cover = set.cover;
				out.meta.cover512 = set.cover512 || set.cover;
				out.meta.cover256 = set.cover256 || set.cover512 || set.cover;
				out.meta.coverGenerated = 'a3ms:inline-art';
			}
		}

		return out;
	}

	function mergeTrackIntoA3msMeta(meta, track, source){
		meta = meta || {};
		track = track || {};

		if (cleanText(track.src) && cleanText(track.src) !== cleanText(source)) return meta;

		if (cleanText(track.title)) meta.title = cleanText(track.title);
		if (cleanText(track.artist)) meta.artist = cleanText(track.artist);
		if (cleanText(track.album)) meta.album = cleanText(track.album);
		if (cleanText(track.cover)) meta.cover = cleanText(track.cover);

		return meta;
	}

	function resolveA3msSinFreq(gen){
		if (!gen) return 440;
		if (gen.freq === 'rnd') return chooseRndFreq();
		return Math.max(1, parseFloat(gen.freq) || 440);
	}

	function resolveA3msNoiseType(gen){
		if (!gen) return 'white';
		if (gen.noise === 'rnd') return chooseRndNoise();
		return parseNoiseValue(gen.noise);
	}

	function envsinValue(env, i, sr){
		const period = Math.max(1, Math.floor(sr * env.periodMs / 1000));
		const amp = clamp(env.amp, 0, 1);
		const wave = 0.5 + 0.5 * Math.sin((Math.PI * 2 * i) / period);

		return (1 - amp) + (amp * wave);
	}

	function noiseSample(type, state){
		const white = Math.random() * 2 - 1;
		let pink = 0;

		if (type === 'brown') {
			state.brown += white * 0.02;
			if (state.brown > 1) state.brown = 1;
			if (state.brown < -1) state.brown = -1;
			return state.brown;
		}

		if (type === 'pink') {
			state.p0 = 0.99886 * state.p0 + white * 0.0555179;
			state.p1 = 0.99332 * state.p1 + white * 0.0750759;
			state.p2 = 0.96900 * state.p2 + white * 0.1538520;
			state.p3 = 0.86650 * state.p3 + white * 0.3104856;
			state.p4 = 0.55000 * state.p4 + white * 0.5329522;
			state.p5 = -0.7616 * state.p5 - white * 0.0168980;
			pink = state.p0 + state.p1 + state.p2 + state.p3 + state.p4 + state.p5 + state.p6 + white * 0.5362;
			state.p6 = white * 0.115926;
			return pink * 0.11;
		}

		return white;
	}

	function renderA3ms(config){
		const frames = Math.max(1, Math.floor(config.sr * config.tdms / 1000));
		const channels = [];
		let ch = 0;
		let state = null;
		let gen = null;
		let start = 0;
		let len = 0;
		let i = 0;
		let sample = 0;
		let freq = 0;
		let step = 0;
		let noiseType = '';
		let noiseState = null;
		let out = null;
		let g = 1;

		for (ch = 0; ch < config.cc; ch++) channels.push(new Float32Array(frames));

		for (ch = 0; ch < config.cc; ch++) {
			state = config.channels[ch];
			if (!state || !state.gen) continue;

			out = channels[ch];
			start = Math.max(0, Math.floor(config.sr * state.sms / 1000));
			len = Math.max(0, Math.floor(config.sr * state.dms / 1000));
			if (start >= out.length || len <= 0) continue;
			if (start + len > out.length) len = out.length - start;

			gen = state.gen;

			if (gen.type === 'sin') {
				freq = resolveA3msSinFreq(gen);
				step = (Math.PI * 2 * freq) / config.sr;

				for (i = 0; i < len; i++) {
					sample = Math.sin(i * step);
					g = state.env ? envsinValue(state.env, i, config.sr) : 1;
					out[start + i] = sample * g * state.gain;
				}

				continue;
			}

			if (gen.type === 'noise') {
				noiseType = resolveA3msNoiseType(gen);
				noiseState = {
					brown: 0,
					p0: 0,
					p1: 0,
					p2: 0,
					p3: 0,
					p4: 0,
					p5: 0,
					p6: 0
				};

				for (i = 0; i < len; i++) {
					sample = noiseSample(noiseType, noiseState);
					g = state.env ? envsinValue(state.env, i, config.sr) : 1;
					out[start + i] = sample * g * state.gain;
				}
			}
		}

		return {
			sampleRate: config.sr,
			channelCount: config.cc,
			frames: frames,
			duration: config.tdms / 1000,
			channels: channels
		};
	}

	function encodeWaveBlob(rendered){
		const channels = rendered && rendered.channels ? rendered.channels : [];
		const count = channels.length || 1;
		const frames = channels[0] ? channels[0].length : 0;
		const bytesPerSample = 2;
		const blockAlign = count * bytesPerSample;
		const byteRate = rendered.sampleRate * blockAlign;
		const dataSize = frames * blockAlign;
		const buf = new ArrayBuffer(44 + dataSize);
		const view = new DataView(buf);
		let off = 44;
		let i = 0;
		let ch = 0;
		let sample = 0;

		writeAscii(view, 0, 'RIFF');
		view.setUint32(4, 36 + dataSize, true);
		writeAscii(view, 8, 'WAVE');
		writeAscii(view, 12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, count, true);
		view.setUint32(24, rendered.sampleRate, true);
		view.setUint32(28, byteRate, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bytesPerSample * 8, true);
		writeAscii(view, 36, 'data');
		view.setUint32(40, dataSize, true);

		for (i = 0; i < frames; i++) {
			for (ch = 0; ch < count; ch++) {
				sample = channels[ch] && isFinite(channels[ch][i]) ? channels[ch][i] : 0;
				sample = Math.max(-1, Math.min(1, sample));
				view.setInt16(off, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true);
				off += 2;
			}
		}

		return new Blob([ buf ], { type: 'audio/wav' });
	}

	function PluginOutputGraph(opts){
		this.options = opts || {};
	}

	PluginOutputGraph.prototype.attach = function(ctx){
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
		let generatedBlobUrl = '';
		let currentVolume = clamp(this.options.volume != null ? this.options.volume : 1, 0, 1);
		let currentMuted = !!this.options.muted;
		let currentLoop = !!this.options.loop;
		let lastAudibleVolume = currentVolume > 0 ? currentVolume : 1;
		let currentMediaChannels = 2;
		let currentA3msInfo = null;

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function emit(type, detail){
			bus.emit(type, detail || {});
		}

		function emitVolume(reason){
			emit('evt:volume', {
				reason: cleanText(reason || ''),
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

		function revokeGeneratedBlob(){
			if (!generatedBlobUrl) return;

			try { URL.revokeObjectURL(generatedBlobUrl); } catch (e) {}
			generatedBlobUrl = '';
		}

		function playlistOwnsTransport(){
			const meta = ctx.getState().meta || {};
			return cleanText(meta.sourceKind).toLowerCase() === 'playlist';
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

		function connectMediaOutput(outIndex, gainIndex){
			try {
				mediaSplitter.connect(mediaGains[gainIndex], outIndex, 0);
			} catch (e) {}
		}

		function applyMediaRouting(channels){
			channels = Math.max(1, Math.min(4, parseInt(channels, 10) || 2));
			currentMediaChannels = channels;
			if (!mediaSplitter) return;

			try { mediaSplitter.disconnect(); } catch (e) {}

			if (channels <= 1) {
				connectMediaOutput(0, 0);
				connectMediaOutput(0, 1);
				connectMediaOutput(0, 2);
				connectMediaOutput(0, 3);
				return;
			}

			if (channels === 2) {
				connectMediaOutput(0, 0);
				connectMediaOutput(1, 1);
				connectMediaOutput(0, 2);
				connectMediaOutput(1, 3);
				return;
			}

			connectMediaOutput(0, 0);
			connectMediaOutput(1, 1);
			connectMediaOutput(2, 2);
			if (channels >= 4) connectMediaOutput(3, 3);
		}

		function kindUsesMediaAudio(){
			return currentKind === 'media' || currentKind === 'a3ms';
		}

		function ensureMediaHelper(){
			if (mediaEl) return;

			mediaEl = document.createElement('audio');
			mediaEl.preload = 'none';
			mediaEl.crossOrigin = 'anonymous';
			mediaEl.loop = currentLoop;
			mediaEl.style.position = 'absolute';
			mediaEl.style.left = '-9999px';
			mediaEl.style.top = '-9999px';
			mediaEl.style.width = '1px';
			mediaEl.style.height = '1px';
			mediaEl.style.opacity = '0';
			mediaEl.style.pointerEvents = 'none';
			root.appendChild(mediaEl);

			mediaNode = audioCtx.createMediaElementSource(mediaEl);
			mediaSplitter = audioCtx.createChannelSplitter(4);

			mediaNode.connect(mediaSplitter);
			applyMediaRouting(currentMediaChannels);

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

		function currentStateTrack(){
			const state = ctx.getState();
			const track = state && state.currentTrack ? state.currentTrack : null;

			if (!track || cleanText(track.src) !== cleanText(currentSource)) return null;

			return track;
		}

		function currentStateMeta(){
			const state = ctx.getState();
			const track = currentStateTrack();

			if (!track) return {};

			return state && state.meta ? state.meta : {};
		}

		function currentMeta(){
			const meta = {};
			const savedTrack = currentStateTrack();
			const savedMeta = currentStateMeta();
			let track = null;

			if (currentKind === 'a3ms' && currentA3msInfo && currentA3msInfo.meta) {
				meta.title = cleanText(currentA3msInfo.meta.title || 'A3MS Synth');
				meta.artist = cleanText(currentA3msInfo.meta.artist || 'A3M Synth');
				meta.album = cleanText(currentA3msInfo.meta.album || 'A3MS');
				meta.cover = cleanText(currentA3msInfo.meta.cover || '');
				meta.cover512 = cleanText(currentA3msInfo.meta.cover512 || '');
				meta.cover256 = cleanText(currentA3msInfo.meta.cover256 || '');
				meta.year = cleanText(currentA3msInfo.meta.year || '');
				meta.date = cleanText(currentA3msInfo.meta.date || '');
				meta.tracknum = cleanText(currentA3msInfo.meta.tracknum || '');
				meta.tracks = cleanText(currentA3msInfo.meta.tracks || '');

				if (!meta.cover && savedTrack && cleanText(savedTrack.cover)) meta.cover = cleanText(savedTrack.cover);
				if (!meta.cover512 && cleanText(savedMeta.cover512)) meta.cover512 = cleanText(savedMeta.cover512);
				if (!meta.cover256 && cleanText(savedMeta.cover256)) meta.cover256 = cleanText(savedMeta.cover256);

				meta.outputMode = requestedMode;
				meta.outputModeResolved = resolvedMode;
				meta.channels = currentA3msInfo.cc;
				meta.helper = 'A3MS -> WAV blob + HTMLAudioElement';
				meta.freq = '';
				meta.loop = currentLoop ? 1 : 0;
				meta.sourceKind = 'a3ms';
				meta.sampleRate = String(currentA3msInfo.sr);
				meta.trackDuration = String(currentA3msInfo.tdms / 1000);
				meta.a3ms = 1;

				track = {
					src: currentSource,
					title: meta.title,
					artist: meta.artist,
					album: meta.album,
					cover: meta.cover
				};

				return {
					source: currentSource,
					track: track,
					meta: meta
				};
			}

			if (currentKind === 'test-shadow') {
				meta.title = cleanText(currentTrack && currentTrack.title || ('Sine ' + currentFreq + ' Hz'));
				meta.artist = cleanText(currentTrack && currentTrack.artist || 'A3M Test');
				meta.album = cleanText(currentTrack && currentTrack.album || 'test://sin');
				meta.cover = cleanText(currentTrack && currentTrack.cover || '');
				meta.outputMode = requestedMode;
				meta.outputModeResolved = resolvedMode;
				meta.channels = modeChannels(resolvedMode);
				meta.helper = 'Oscillator + HTMLAudioElement shadow';
				meta.freq = String(currentFreq);
				meta.loop = currentLoop ? 1 : 0;
				meta.sourceKind = 'test';

				track = {
					src: currentSource,
					title: meta.title,
					artist: meta.artist,
					album: meta.album,
					cover: meta.cover
				};

				return {
					source: currentSource,
					track: track,
					meta: meta
				};
			}

			meta.title = cleanText(currentTrack && currentTrack.title || currentSource || '');
			meta.artist = cleanText(currentTrack && currentTrack.artist || '');
			meta.album = cleanText(currentTrack && currentTrack.album || '');
			meta.cover = cleanText(currentTrack && currentTrack.cover || '');
			meta.outputMode = requestedMode;
			meta.outputModeResolved = resolvedMode;
			meta.channels = modeChannels(resolvedMode);
			meta.helper = 'HTMLAudioElement';
			meta.freq = '';
			meta.loop = currentLoop ? 1 : 0;
			meta.sourceKind = 'single';

			track = {
				src: currentSource,
				title: meta.title,
				artist: meta.artist,
				album: meta.album,
				cover: meta.cover
			};

			return {
				source: currentSource,
				track: track,
				meta: meta
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
			setGainValues(mediaGains, kindUsesMediaAudio() ? activeGains(resolvedMode) : [ 0, 0, 0, 0 ]);
			setGainValues(testGains, currentKind === 'test-shadow' ? activeGains(resolvedMode) : [ 0, 0, 0, 0 ]);
			applyMasterGain();
		}

		function applyLoop(loop){
			currentLoop = !!loop;
			if (mediaEl) mediaEl.loop = currentLoop;
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

		function loadBlobSource(blob, source, detail, kind, mediaChannels){
			const autoplay = !!(detail && detail.autoplay);

			if (!ensureAudioContext()) return;

			revokeGeneratedBlob();
			generatedBlobUrl = URL.createObjectURL(blob);

			currentSource = source;
			currentKind = kind || 'test-shadow';
			currentTrack = detail && detail.track ? detail.track : null;
			currentMediaChannels = Math.max(1, Math.min(4, parseInt(mediaChannels, 10) || 2));
			applyMediaRouting(currentMediaChannels);

			applyOutputMode(requestedMode);

			emit('evt:load', {
				source: currentSource,
				src: currentSource
			});
			emitMeta();
			emitVolume('load');

			mediaEl.loop = currentLoop;
			mediaEl.src = generatedBlobUrl;
			mediaEl.load();

			if (autoplay) playMedia();
			else emit('evt:pause', {});
		}

		function loadTest(source, detail){
			const parsed = parseSource(source);
			let blob = null;

			pauseMedia('reload');

			currentA3msInfo = null;
			currentQuery = parsed ? parsed.query : {};
			pickFreq(currentQuery.freq || '440');
			blob = silentWaveBlob(testSeconds, testSampleRate);

			loadBlobSource(blob, source, detail, 'test-shadow', 2);
		}

		function loadA3ms(source, detail){
			const parsed = parseA3msSource(source);
			const rendered = renderA3ms(parsed);
			const blob = encodeWaveBlob(rendered);
			const meta = mergeTrackIntoA3msMeta(parsed.meta || {}, detail && detail.track, source);

			pauseMedia('reload');

			currentA3msInfo = {
				cc: parsed.cc,
				sr: parsed.sr,
				tdms: parsed.tdms,
				meta: meta
			};
			currentQuery = {};
			currentTrack = {
				src: source,
				title: cleanText(meta.title || 'A3MS Synth'),
				artist: cleanText(meta.artist || 'A3M Synth'),
				album: cleanText(meta.album || 'A3MS'),
				cover: cleanText(meta.cover || '')
			};

			detail = detail || {};
			detail.track = {
				src: currentTrack.src,
				title: currentTrack.title,
				artist: currentTrack.artist,
				album: currentTrack.album,
				cover: currentTrack.cover
			};

			loadBlobSource(blob, source, detail, 'a3ms', parsed.cc);
		}

		function loadMedia(source, detail){
			const autoplay = !!(detail && detail.autoplay);

			if (!ensureAudioContext()) return;

			revokeGeneratedBlob();
			pauseMedia('reload');

			currentSource = source;
			currentKind = 'media';
			currentA3msInfo = null;
			currentQuery = {};
			currentTrack = detail && detail.track ? detail.track : {
				src: source,
				title: source,
				artist: '',
				album: '',
				cover: ''
			};
			currentMediaChannels = 2;
			applyMediaRouting(currentMediaChannels);

			applyOutputMode(requestedMode);

			emit('evt:load', {
				source: currentSource,
				src: currentSource
			});
			emitMeta();
			emitVolume('load');

			mediaEl.loop = currentLoop;
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

			log('load', source);

			if (/^test:\/\/sin(?:$|[?])/i.test(source)) {
				loadTest(source, detail);
				return;
			}

			if (/^a3ms:\/\//i.test(source)) {
				loadA3ms(source, detail);
				return;
			}

			loadMedia(source, detail);
		}

		function shiftFreq(step, detail){
			let autoplay = false;

			if (currentKind !== 'test-shadow') return;
			if (playlistOwnsTransport()) return;

			autoplay = detail && typeof detail === 'object' && detail.autoplay != null
				? !!detail.autoplay
				: !!ctx.getState().playing;

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
			emitVolume('init');
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

		listen('cmd:next', function(detail){
			shiftFreq(1, detail);
		});

		listen('cmd:prev', function(detail){
			shiftFreq(-1, detail);
		});

		listen('cmd:set-volume', function(detail){
			let v = detail && typeof detail === 'object'
				? (detail.volume != null ? detail.volume : detail.value)
				: detail;

			if (!isFinite(v)) return;

			currentVolume = clamp(v, 0, 1);

			if (currentVolume > 0) {
				currentMuted = false;
				lastAudibleVolume = currentVolume;
			} else {
				currentMuted = true;
			}

			applyMasterGain();
			emitVolume('set-volume');
		});

		listen('cmd:set-muted', function(detail){
			let muted = detail && typeof detail === 'object'
				? detail.muted
				: detail;

			currentMuted = !!muted;

			if (currentMuted) {
				if (currentVolume > 0) lastAudibleVolume = currentVolume;
				currentVolume = 0;
			} else {
				currentVolume = clamp(currentVolume > 0 ? currentVolume : lastAudibleVolume, 0, 1);
				if (currentVolume <= 0) currentVolume = 1;
				lastAudibleVolume = currentVolume;
			}

			applyMasterGain();
			emitVolume('set-muted');
		});

		listen('cmd:set-loop', function(detail){
			let loop = detail && typeof detail === 'object'
				? detail.loop
				: detail;

			applyLoop(loop);
			emitMeta();
		});

		listen('cmd:output-mode', function(detail){
			let mode = detail && typeof detail === 'object' ? detail.mode : detail;

			log('output mode', mode);
			applyOutputMode(mode);
			emitMeta();
			emitVolume('output-mode');
		});

		return function(){
			let i = 0;

			stopTestEngine();

			for (i = 0; i < off.length; i++) off[i]();

			revokeGeneratedBlob();

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

	a3m.PluginOutputGraph = PluginOutputGraph;
})();