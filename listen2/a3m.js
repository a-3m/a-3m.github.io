/* file: a3m.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const root = document.querySelector('[data-role="app"]');
	const titleNode = root.querySelector('[data-role="title"]');
	const artistNode = root.querySelector('[data-role="artist"]');
	const albumNode = root.querySelector('[data-role="album"]');
	const yearNode = root.querySelector('[data-role="year"]');
	const statusNode = root.querySelector('[data-role="status"]');
	const techMainNode = root.querySelector('[data-role="tech-main"]');
	const techNextNode = root.querySelector('[data-role="tech-next"]');
	const techAuxNode = root.querySelector('[data-role="tech-aux"]');
	const techNetNode = root.querySelector('[data-role="tech-net"]');
	const downloadNode = root.querySelector('[data-act="download"]');
	const progressNode = root.querySelector('[data-act="seek"]');
	const playlistSrc = cleanText(root.getAttribute('data-playlist-src') || 'listen0.m3u');

	const CFG = {
		NEXT_WARMUP_SEC: 10,
		CROSSFADE_SEC: 0,
		AUX_MIN_SEC: 7,
		PREVIEW_TAP_PX: 16,
		PREVIEW_SWIPE_PX: 56,
		PREVIEW_MAX_MS: 320,
		PROGRESS_TICK_MS: 180
	};

	const AUDIO_EXTS = [ 'opus', 'ogg', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'oga' ];
	const COVER_EXTS = [ 'webp', 'jpg', 'jpeg', 'png', 'gif', 'avif' ];

	const state = {
		list: [],
		index: -1,
		mainIndex: -1,
		nextIndex: -1,
		mainSlot: null,
		nextSlot: null,
		auxSlot: null,
		mode: 'main',
		play: 'stop',
		net: 'ok',
		repeat: 0,
		shuffle: 0,
		auxTest: 0,
		more: 0,
		preview: '',
		coverFake: 1,
		debug: /(?:\?|&)debug(?:=1)?(?:&|$)/.test(window.location.search) ? 1 : 0,
		auxStartedAt: 0,
		auxMinUntil: 0,
		progressTimer: 0,
		statusKind: '',
		gesture: null
	};

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function clamp(n, a, b){
		n = parseFloat(n);
		if (!isFinite(n)) n = a;
		return Math.min(b, Math.max(a, n));
	}

	function decodeValue(s){
		s = String(s == null ? '' : s);
		try {
			return decodeURIComponent(s);
		} catch (e) {
			return s;
		}
	}

	function titleWord(s){
		s = cleanText(s).toLowerCase();
		if (!s) return '';
		if (s === 'aaam') return 'AAAM';
		if (s === 'a3m') return 'a3m';
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function titleText(s){
		const parts = cleanText(s).split(/[-_\s]+/);
		const out = [];
		let i = 0;

		for (i = 0; i < parts.length; i++) {
			if (!parts[i]) continue;
			out.push(titleWord(parts[i]));
		}
		return out.join(' ');
	}

	function pathExt(path){
		const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(cleanText(path));
		return m ? m[1].toLowerCase() : '';
	}

	function isAudioPath(path){
		return AUDIO_EXTS.indexOf(pathExt(path)) >= 0;
	}

	function isCoverPath(path){
		return COVER_EXTS.indexOf(pathExt(path)) >= 0;
	}

	function resolveUrl(base, rel){
		try {
			return String(new URL(String(rel || ''), String(base || window.location.href)));
		} catch (e) {
			return cleanText(rel || '');
		}
	}

	function normalizeIndex(index){
		const n = state.list.length;

		index = parseInt(index, 10);
		if (!n) return -1;
		if (!isFinite(index)) index = 0;
		while (index < 0) index += n;
		while (index >= n) index -= n;
		return index;
	}

	function nextIndex(step){
		if (!state.list.length) return -1;
		if (state.shuffle) return Math.floor(Math.random() * state.list.length);
		return normalizeIndex((state.index < 0 ? 0 : state.index) + (step || 1));
	}

	function trackAt(index){
		index = normalizeIndex(index);
		return index >= 0 ? state.list[index] : null;
	}

	function imageVar(url){
		url = cleanText(url || '');
		if (!url) return 'none';
		return 'url("' + url.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
	}

	function setVar(name, value){
		root.style.setProperty(name, String(value));
	}

	function setData(name, value){
		root.setAttribute('data-a3m-' + name, String(value));
	}

	function slot(name){
		const el = document.createElement('audio');

		el.preload = 'metadata';
		el.playsInline = true;
		el.setAttribute('playsinline', 'playsinline');
		el.setAttribute('webkit-playsinline', 'webkit-playsinline');
		el.style.display = 'none';
		el.__a3mName = name;
		el.__a3mIndex = -1;
		document.body.appendChild(el);
		return el;
	}

	function stopSlot(el){
		if (!el) return;
		try { el.pause(); } catch (e) {}
	}

	function resetSlot(el){
		if (!el) return;
		stopSlot(el);
		el.removeAttribute('src');
		try { el.load(); } catch (e) {}
		el.__a3mIndex = -1;
	}

	function bufferedPercent(el){
		let end = 0;

		if (!el || !isFinite(el.duration) || el.duration <= 0) return 0;
		if (!el.buffered || !el.buffered.length) return 0;
		try {
			end = el.buffered.end(el.buffered.length - 1);
		} catch (e) {
			return 0;
		}
		return clamp((end / el.duration) * 100, 0, 100);
	}

	function currentProgress(el){
		if (!el || !isFinite(el.duration) || el.duration <= 0) return 0;
		return clamp((el.currentTime / el.duration) * 100, 0, 100);
	}

	function preloadCover(url){
		const img = new Image();

		url = cleanText(url || '');
		if (!url) return;
		img.src = url;
	}

	function parseDate6(s){
		const m = /^(\d{2})(\d{2})(\d{2})$/.exec(cleanText(s));
		const yy = m ? parseInt(m[1], 10) : 0;
		if (!m) return '';
		return String(yy >= 70 ? (1900 + yy) : (2000 + yy)) + '-' + m[2] + '-' + m[3];
	}

	function parseMeta(url){
		const file = decodeValue(String(url || '').replace(/[?#].*$/, '').replace(/^.*\//, ''));
		const stem = file.replace(/\.[^.]+$/, '');
		const pair = stem.split('--');
		let left = cleanText(pair.shift() || '');
		let right = cleanText(pair.join('--') || '');
		let date = '';
		let year = '';
		let title = '';
		let album = '';
		let artist = '';
		let m = null;
		let after = [];
		let i = 0;

		m = /^(\d{6})-(.+)$/.exec(left);
		if (m) {
			date = parseDate6(m[1]);
			left = cleanText(m[2]);
		}

		title = titleText(left || stem);

		if (right) {
			m = /^(.*?)-(\d{4})(?:-(.*))?$/.exec(right);
			if (m) {
				album = titleText(m[1] || '');
				year = cleanText(m[2] || '');
				after = cleanText(m[3] || '').split('-').filter(Boolean);
				for (i = 0; i < after.length; i++) {
					if (after[i].toLowerCase() === 'album') continue;
					if (after[i].toLowerCase() === 'aaam') artist += (artist ? ' · ' : '') + 'AAAM';
					else if (after[i].toLowerCase() === 'dogon') artist += (artist ? ' · ' : '') + 'Dogon';
				}
			} else {
				album = titleText(right);
			}
		} else {
			m = /^(.*?)-(\d{4})(?:-(.*))?$/.exec(left);
			if (m) {
				title = titleText(m[1] || stem);
				year = cleanText(m[2] || '');
				after = cleanText(m[3] || '').split('-').filter(Boolean);
				for (i = 0; i < after.length; i++) {
					if (after[i].toLowerCase() === 'album') continue;
					if (after[i].toLowerCase() === 'aaam') artist += (artist ? ' · ' : '') + 'AAAM';
					else if (after[i].toLowerCase() === 'dogon') artist += (artist ? ' · ' : '') + 'Dogon';
				}
			}
		}

		if (!year && date) year = date.slice(0, 4);

		return {
			title: cleanText(title || file),
			artist: cleanText(artist || ''),
			album: cleanText(album || ''),
			year: cleanText(year || '')
		};
	}

	function joinPlaylistLines(text){
		const lines = String(text == null ? '' : text).split(/\r?\n/);
		const out = [];
		let carry = '';
		let line = '';
		let i = 0;

		function looksWrappedUrl(s){
			return /^https?:\/\//i.test(s) && !/(\.(?:opus|ogg|mp3|m4a|aac|wav|flac|oga|webp|jpg|jpeg|png|gif|avif))(?:[?#].*)?$/i.test(s);
		}

		for (i = 0; i < lines.length; i++) {
			line = cleanText(lines[i]);
			if (!line) {
				if (carry) {
					out.push(carry);
					carry = '';
				}
				out.push('');
				continue;
			}

			if (carry) {
				if (!/^(#|;|https?:\/\/|a3ms:\/\/)/i.test(line)) {
					carry += line;
					if (!looksWrappedUrl(carry)) {
						out.push(carry);
						carry = '';
					}
					continue;
				}
				out.push(carry);
				carry = '';
			}

			if (looksWrappedUrl(line)) {
				carry = line;
				continue;
			}

			out.push(line);
		}

		if (carry) out.push(carry);
		return out;
	}

	function parsePlaylist(text, baseUrl){
		const lines = joinPlaylistLines(text);
		const list = [];
		let pendingCover = '';
		let line = '';
		let url = '';
		let i = 0;

		for (i = 0; i < lines.length; i++) {
			line = cleanText(lines[i]);
			if (!line || line.charAt(0) === '#' || line.charAt(0) === ';') continue;
			if (/^a3ms:\/\//i.test(line)) continue;

			url = resolveUrl(baseUrl, line);
			if (isCoverPath(url)) {
				pendingCover = url;
				continue;
			}
			if (!isAudioPath(url)) continue;

			list.push({
				src: url,
				cover: cleanText(pendingCover || ''),
				meta: parseMeta(url)
			});
			pendingCover = '';
		}

		return list;
	}

	function fetchPlaylist(){
		const url = resolveUrl(window.location.href, playlistSrc);

		return fetch(url, { credentials: 'same-origin' }).then(function(res){
			if (!res || !res.ok) throw new Error('playlist fetch failed');
			return res.text();
		}).then(function(text){
			return parsePlaylist(text, url);
		});
	}

	function calmArt(){
		const svg = '' +
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">' +
			'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
			'<stop offset="0" stop-color="#071014"/><stop offset="1" stop-color="#16342a"/>' +
			'</linearGradient></defs>' +
			'<rect width="1024" height="1024" fill="url(#g)"/>' +
			'<g fill="none" stroke="#d8fff326" stroke-width="18" stroke-linecap="round">' +
			'<path d="M72 430c120 18 200 18 320 0s200-18 320 0 200 18 240 0"/>' +
			'<path d="M72 548c120 18 200 18 320 0s200-18 320 0 200 18 240 0"/>' +
			'<path d="M72 666c120 18 200 18 320 0s200-18 320 0 200 18 240 0"/>' +
			'</g></svg>';
		return 'data:image/svg+xml,' + encodeURIComponent(svg);
	}

	function calmWaveBlob(){
		const sampleRate = 22050;
		const seconds = 7;
		const channels = 2;
		const totalFrames = sampleRate * seconds;
		const bytesPerSample = 2;
		const blockAlign = channels * bytesPerSample;
		const dataSize = totalFrames * blockAlign;
		const buf = new ArrayBuffer(44 + dataSize);
		const view = new DataView(buf);
		let off = 44;
		let i = 0;
		let ch = 0;
		let noise = 0;
		let t = 0;
		let env = 0;
		let s = 0;

		function writeAscii(pos, text){
			let j = 0;
			for (j = 0; j < text.length; j++) view.setUint8(pos + j, text.charCodeAt(j));
		}

		writeAscii(0, 'RIFF');
		view.setUint32(4, 36 + dataSize, true);
		writeAscii(8, 'WAVE');
		writeAscii(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, channels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * blockAlign, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bytesPerSample * 8, true);
		writeAscii(36, 'data');
		view.setUint32(40, dataSize, true);

		for (i = 0; i < totalFrames; i++) {
			t = i / sampleRate;
			noise = (noise * 0.996) + ((Math.random() * 2 - 1) * 0.004);
			env = 1;
			if (t < 0.8) env = t / 0.8;
			if (t > seconds - 1.2) env = Math.max(0, (seconds - t) / 1.2);
			s =
				Math.sin(Math.PI * 2 * t * 104) * 0.014 +
				Math.sin(Math.PI * 2 * t * 151) * 0.012 +
				noise * 0.05;
			s *= env * 0.72;
			for (ch = 0; ch < channels; ch++) {
				view.setInt16(off, Math.round(clamp(s, -1, 1) * 32767), true);
				off += 2;
			}
		}

		return URL.createObjectURL(new Blob([ buf ], { type: 'audio/wav' }));
	}

	function trackLabel(track){
		if (!track) return 'Listen';
		return cleanText(track.meta.title || 'Listen');
	}

	function setMeta(track, auxMode){
		const label = auxMode ? 'Preparing next track' : trackLabel(track);

		titleNode.textContent = label;
		artistNode.textContent = auxMode ? 'Please calm' : cleanText(track && track.meta.artist || '');
		albumNode.textContent = auxMode ? cleanText(track && track.meta.title || '') : cleanText(track && track.meta.album || '');
		yearNode.textContent = auxMode ? '' : cleanText(track && track.meta.year || '');
		document.title = label;
	}

	function setStatus(text, kind){
		state.statusKind = cleanText(kind || '');
		statusNode.textContent = cleanText(text || '');
	}

	function updateDownload(track){
		if (!downloadNode) return;
		downloadNode.setAttribute('href', cleanText(track && track.src || '#'));
		downloadNode.setAttribute('download', '');
	}

	function setCover(url, fake){
		setVar('--a3m-cover-url', imageVar(url));
		state.coverFake = fake ? 1 : 0;
		setData('cover', state.coverFake ? 'fake' : 'real');
	}

	function mediaArtwork(url){
		const src = cleanText(url || state.calmArt || '');
		return [
			{ src: src, sizes: '256x256' },
			{ src: src, sizes: '512x512' }
		];
	}

	function setMediaTrack(track){
		if (!('mediaSession' in navigator) || !track) return;
		try {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: cleanText(track.meta.title || ''),
				artist: cleanText(track.meta.artist || ''),
				album: cleanText(track.meta.album || ''),
				artwork: mediaArtwork(cleanText(track.cover || state.calmArt))
			});
		} catch (e) {}
	}

	function setMediaAux(track){
		if (!('mediaSession' in navigator)) return;
		try {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: 'Preparing next track',
				artist: 'Please calm',
				album: cleanText(track && track.meta && track.meta.title || 'A3M Listen'),
				artwork: mediaArtwork(state.calmArt)
			});
		} catch (e) {}
	}

	function syncPlaybackState(){
		if (!('mediaSession' in navigator)) return;
		try {
			navigator.mediaSession.playbackState = state.play === 'play' ? 'playing' : 'paused';
		} catch (e) {}
	}

	function getToggleState(){
		if (state.preview === 'toggle') return 'pressed';
		if (state.statusKind === 'error' || state.net === 'fail' || state.mode === 'aux') return 'fail';
		if (state.mainIndex >= 0 && !mainReady(state.mainSlot)) return 'preload';
		if (state.play === 'play') return 'active';
		return 'idle';
	}

	function updateRoot(){
		const main = state.mainSlot;
		const next = state.nextSlot;
		const aux = state.auxSlot;
		const progress = state.mode === 'main' ? currentProgress(main) : 0;
		const buffer = state.mode === 'main' ? bufferedPercent(main) : 0;

		setData('play', state.play);
		setData('mode', state.mode);
		setData('main', mainReady(main) ? (state.play === 'play' ? 'playing' : 'paused') : 'idle');
		setData('next', nextReady(next) ? 'ready' : (next && next.getAttribute('src') ? 'warming' : 'idle'));
		setData('aux', state.mode === 'aux' ? 'playing' : 'idle');
		setData('more', state.more);
		setData('preview', state.preview);
		setData('repeat', state.repeat);
		setData('shuffle', state.shuffle);
		setData('aux-test', state.auxTest);
		setData('debug', state.debug);
		setData('fullscreen', fullscreenElement() ? 1 : 0);
		setData('net', state.net);
		setData('status', state.statusKind);
		setData('toggle', getToggleState());

		setVar('--a3m-progress', String(progress));
		setVar('--a3m-buffer', String(buffer));
		setVar('--a3m-main-buffer', String(bufferedPercent(main)));
		setVar('--a3m-next-buffer', String(bufferedPercent(next)));
		setVar('--a3m-aux-buffer', String(bufferedPercent(aux)));

		techMainNode.textContent = 'main ' + (root.getAttribute('data-a3m-main') || '') + ' ' + Math.round(bufferedPercent(main)) + '%';
		techNextNode.textContent = 'next ' + (root.getAttribute('data-a3m-next') || '') + ' ' + Math.round(bufferedPercent(next)) + '%';
		techAuxNode.textContent = 'aux ' + (root.getAttribute('data-a3m-aux') || '') + ' ' + Math.round(bufferedPercent(aux)) + '%';
		techNetNode.textContent = 'net ' + state.net;
	}

	function mainReady(el){
		return !!(el && el.__a3mIndex >= 0 && el.readyState >= 2);
	}

	function nextReady(el){
		return !!(el && el.__a3mIndex === state.nextIndex && el.readyState >= 3);
	}

	function tickProgress(){
		clearInterval(state.progressTimer);
		state.progressTimer = setInterval(function(){
			updateRoot();
			checkWarmWindow();
		}, CFG.PROGRESS_TICK_MS);
	}

	function clearProgressTimer(){
		if (state.progressTimer) clearInterval(state.progressTimer);
		state.progressTimer = 0;
	}

	function chooseMainCover(track){
		if (track && cleanText(track.cover || '')) return cleanText(track.cover);
		return state.calmArt;
	}

	function prepareTrack(slotEl, index){
		const track = trackAt(index);

		if (!slotEl || index < 0 || !track) return;
		if (slotEl.__a3mIndex === index && cleanText(slotEl.getAttribute('src') || '') === cleanText(track.src)) return;

		slotEl.__a3mIndex = index;
		slotEl.preload = 'metadata';
		slotEl.src = track.src;
		slotEl.load();
		preloadCover(track.cover);
	}

	function swapMainNext(){
		const oldMain = state.mainSlot;
		const oldIndex = state.mainIndex;

		state.mainSlot = state.nextSlot;
		state.mainIndex = state.nextIndex;
		state.nextSlot = oldMain;
		state.nextIndex = -1;

		stopSlot(state.nextSlot);
		resetSlot(state.nextSlot);

		if (state.mainIndex >= 0) {
			state.index = state.mainIndex;
			enterMain(trackAt(state.mainIndex), true);
			scheduleNext();
		}

		if (oldIndex >= 0) oldMain.__a3mIndex = -1;
	}

	function beginCurrent(){
		const track = trackAt(state.index);

		if (!track) return;
		if (state.mode === 'aux' && Date.now() < state.auxMinUntil && !state.auxTest) return;
		if (state.mainSlot && state.mainSlot.__a3mIndex === state.index) {
			try { state.mainSlot.currentTime = 0; } catch (e) {}
			if (state.play !== 'play') playMain();
			return;
		}
		loadMain(state.index, state.play === 'play');
	}

	function stopAll(hard){
		stopSlot(state.mainSlot);
		stopSlot(state.nextSlot);
		stopSlot(state.auxSlot);
		if (hard) {
			resetSlot(state.nextSlot);
			state.nextIndex = -1;
			state.play = 'stop';
			state.mode = 'main';
			state.net = 'ok';
			setStatus('');
			if ('mediaSession' in navigator) {
				try { navigator.mediaSession.metadata = null; } catch (e) {}
			}
		} else {
			state.play = 'pause';
		}
		syncPlaybackState();
		updateRoot();
	}

	function playMain(){
		const track = trackAt(state.mainIndex >= 0 ? state.mainIndex : state.index);

		if (!track) return;
		state.mode = 'main';
		state.play = 'play';
		state.net = 'ok';
		setMeta(track, false);
		setCover(chooseMainCover(track), cleanText(track.cover || '') ? 0 : 1);
		setStatus(state.nextIndex >= 0 ? 'Preparing next track' : '');
		setMediaTrack(track);
		updateDownload(track);
		state.mainSlot.play().then(function(){
			syncPlaybackState();
			updateRoot();
		}).catch(function(){
			state.play = 'pause';
			syncPlaybackState();
			updateRoot();
		});
	}

	function pauseMain(){
		stopSlot(state.mainSlot);
		stopSlot(state.auxSlot);
		state.play = 'pause';
		syncPlaybackState();
		updateRoot();
	}

	function enterMain(track, autoplay){
		if (!track) return;
		state.mode = 'main';
		state.net = 'ok';
		setMeta(track, false);
		setCover(chooseMainCover(track), cleanText(track.cover || '') ? 0 : 1);
		setMediaTrack(track);
		updateDownload(track);
		if (autoplay) {
			state.play = 'play';
			state.mainSlot.play().then(function(){
				setStatus(state.nextIndex >= 0 ? 'Preparing next track' : '');
				syncPlaybackState();
				updateRoot();
			}).catch(function(){
				state.play = 'pause';
				syncPlaybackState();
				updateRoot();
			});
		} else {
			state.play = 'pause';
			syncPlaybackState();
			updateRoot();
		}
	}

	function enterAux(track){
		state.mode = 'aux';
		state.play = 'play';
		state.net = 'fail';
		state.auxStartedAt = Date.now();
		state.auxMinUntil = state.auxStartedAt + (CFG.AUX_MIN_SEC * 1000);
		setMeta(track, true);
		setCover(state.calmArt, 1);
		setMediaAux(track);
		setStatus('Trying next source', 'error');
		updateDownload(track);
		state.auxSlot.currentTime = 0;
		state.auxSlot.play().then(function(){
			syncPlaybackState();
			updateRoot();
		}).catch(function(){
			state.play = 'pause';
			syncPlaybackState();
			updateRoot();
		});
	}

	function leaveAuxIfPossible(){
		if (state.mode !== 'aux') return;
		if (!nextReady(state.nextSlot)) return;
		if (Date.now() < state.auxMinUntil && !state.auxTest) return;
		stopSlot(state.auxSlot);
		state.net = 'ok';
		swapMainNext();
	}

	function loadMain(index, autoplay){
		const track = trackAt(index);

		index = normalizeIndex(index);
		if (index < 0 || !track) return;

		state.index = index;
		state.mainIndex = index;
		prepareTrack(state.mainSlot, index);
		setMeta(track, false);
		setCover(chooseMainCover(track), cleanText(track.cover || '') ? 0 : 1);
		setStatus('Loading');
		updateDownload(track);

		if (mainReady(state.mainSlot)) {
			enterMain(track, autoplay);
			scheduleNext();
			return;
		}

		state.mainSlot.addEventListener('canplay', function onCanPlay(){
			state.mainSlot.removeEventListener('canplay', onCanPlay);
			if (state.mainIndex !== index) return;
			enterMain(track, autoplay);
			scheduleNext();
		});
		updateRoot();
	}

	function scheduleNext(){
		const index = nextIndex(1);

		if (index < 0 || index === state.mainIndex) {
			state.nextIndex = -1;
			resetSlot(state.nextSlot);
			setStatus('');
			updateRoot();
			return;
		}
		state.nextIndex = index;
		setStatus('Preparing next track');
		prepareTrack(state.nextSlot, index);
		updateRoot();
	}

	function checkWarmWindow(){
		let left = 0;

		if (state.mode === 'aux') {
			leaveAuxIfPossible();
			return;
		}
		if (!state.mainSlot || state.mainSlot.__a3mIndex !== state.mainIndex) return;
		if (!isFinite(state.mainSlot.duration) || state.mainSlot.duration <= 0) return;

		left = state.mainSlot.duration - state.mainSlot.currentTime;
		if (left <= CFG.NEXT_WARMUP_SEC && state.nextIndex < 0) scheduleNext();
	}

	function onMainEnded(){
		if (state.repeat) {
			beginCurrent();
			return;
		}
		if (nextReady(state.nextSlot)) {
			swapMainNext();
			return;
		}
		enterAux(trackAt(nextIndex(1)) || trackAt(state.index));
		scheduleNext();
	}

	function seekToRatio(ratio){
		if (state.mode !== 'main') return;
		if (!state.mainSlot || !isFinite(state.mainSlot.duration) || state.mainSlot.duration <= 0) return;
		try {
			state.mainSlot.currentTime = clamp(ratio, 0, 1) * state.mainSlot.duration;
		} catch (e) {}
		updateRoot();
	}

	function togglePlay(){
		if (state.mode === 'aux') {
			if (state.play === 'play') {
				pauseMain();
				return;
			}
			state.play = 'play';
			state.auxSlot.play().then(function(){
				syncPlaybackState();
				updateRoot();
			}).catch(function(){
				state.play = 'pause';
				syncPlaybackState();
				updateRoot();
			});
			return;
		}

		if (state.play === 'play') {
			pauseMain();
			return;
		}

		if (state.mainIndex < 0 && state.index >= 0) {
			loadMain(state.index, true);
			return;
		}
		playMain();
	}

	function onPrev(){
		loadMain(nextIndex(-1), state.play === 'play');
	}

	function onNext(){
		if (state.mode === 'aux' && nextReady(state.nextSlot)) {
			stopSlot(state.auxSlot);
			state.net = 'ok';
			swapMainNext();
			return;
		}
		loadMain(nextIndex(1), state.play === 'play');
	}

	function toggleMore(){
		state.more = state.more ? 0 : 1;
		updateRoot();
	}

	function toggleRepeat(){
		state.repeat = state.repeat ? 0 : 1;
		updateRoot();
	}

	function toggleShuffle(){
		state.shuffle = state.shuffle ? 0 : 1;
		updateRoot();
	}

	function toggleAuxTest(){
		const track = trackAt(state.index >= 0 ? state.index : 0);

		state.auxTest = state.auxTest ? 0 : 1;
		if (state.auxTest) {
			enterAux(track);
		} else if (state.mode === 'aux') {
			stopSlot(state.auxSlot);
			state.net = 'ok';
			if (nextReady(state.nextSlot)) swapMainNext();
			else if (state.mainIndex >= 0) enterMain(trackAt(state.mainIndex), state.play === 'play');
		}
		updateRoot();
	}

	function refreshPage(){
		window.location.reload();
	}

	function onProgressClick(e){
		const rect = progressNode.getBoundingClientRect();
		let ratio = 0;

		if (!rect || !rect.width) return;
		ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
		seekToRatio(ratio);
	}

	function fullscreenElement(){
		return document.fullscreenElement || document.webkitFullscreenElement || null;
	}

	function toggleFullscreen(){
		const node = document.documentElement || document.body;

		if (fullscreenElement()) {
			if (document.exitFullscreen) document.exitFullscreen();
			else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
			updateRoot();
			return;
		}
		if (node.requestFullscreen) node.requestFullscreen();
		else if (node.webkitRequestFullscreen) node.webkitRequestFullscreen();
		updateRoot();
	}

	function setPreview(name){
		state.preview = cleanText(name || '');
		updateRoot();
	}

	function clearPreview(){
		if (!state.preview) return;
		state.preview = '';
		updateRoot();
	}

	function gestureAction(dx, dy, dt){
		if (Math.abs(dx) <= CFG.PREVIEW_TAP_PX && Math.abs(dy) <= CFG.PREVIEW_TAP_PX && dt <= CFG.PREVIEW_MAX_MS) return 'toggle';
		if (Math.abs(dx) >= CFG.PREVIEW_SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.25) return dx < 0 ? 'next' : 'prev';
		return '';
	}

	function onPointerDown(e){
		const target = e.target && e.target.closest ? e.target.closest('button,a,[data-act="seek"]') : null;

		if (target) return;
		state.gesture = {
			x: e.clientX,
			y: e.clientY,
			t: Date.now()
		};
		setPreview('toggle');
	}

	function onPointerMove(e){
		let dx = 0;
		let dy = 0;
		let dt = 0;
		let act = '';

		if (!state.gesture) return;
		dx = e.clientX - state.gesture.x;
		dy = e.clientY - state.gesture.y;
		dt = Date.now() - state.gesture.t;
		act = gestureAction(dx, dy, dt);
		setPreview(act || 'toggle');
	}

	function onPointerUp(e){
		let dx = 0;
		let dy = 0;
		let dt = 0;
		let act = '';

		if (!state.gesture) return;
		dx = e.clientX - state.gesture.x;
		dy = e.clientY - state.gesture.y;
		dt = Date.now() - state.gesture.t;
		act = gestureAction(dx, dy, dt);
		state.gesture = null;
		clearPreview();

		if (act === 'toggle') togglePlay();
		else if (act === 'next') onNext();
		else if (act === 'prev') onPrev();
	}

	function onPointerCancel(){
		state.gesture = null;
		clearPreview();
	}

	function bindActions(){
		root.addEventListener('click', function(e){
			const el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
			const act = el ? cleanText(el.getAttribute('data-act') || '') : '';

			if (!act) return;
			if (act !== 'download') e.preventDefault();

			if (act === 'toggle') togglePlay();
			else if (act === 'prev') onPrev();
			else if (act === 'next') onNext();
			else if (act === 'more') toggleMore();
			else if (act === 'begin') beginCurrent();
			else if (act === 'stop') stopAll(true);
			else if (act === 'repeat') toggleRepeat();
			else if (act === 'shuffle') toggleShuffle();
			else if (act === 'aux-test') toggleAuxTest();
			else if (act === 'refresh') refreshPage();
			else if (act === 'fullscreen') toggleFullscreen();
		});

		progressNode.addEventListener('click', onProgressClick);
		root.addEventListener('pointerdown', onPointerDown);
		root.addEventListener('pointermove', onPointerMove);
		root.addEventListener('pointerup', onPointerUp);
		root.addEventListener('pointercancel', onPointerCancel);

		document.addEventListener('fullscreenchange', updateRoot);
		document.addEventListener('webkitfullscreenchange', updateRoot);

		document.addEventListener('keydown', function(e){
			if (e.target && /input|textarea/i.test(String(e.target.tagName || ''))) return;
			if (e.key === ' ') {
				e.preventDefault();
				togglePlay();
			} else if (e.key === 'ArrowLeft') {
				e.preventDefault();
				onPrev();
			} else if (e.key === 'ArrowRight') {
				e.preventDefault();
				onNext();
			} else if (String(e.key || '').toLowerCase() === 'f') {
				e.preventDefault();
				toggleFullscreen();
			}
		});
	}

	function bindAudio(el){
		el.addEventListener('canplay', function(){
			updateRoot();
			if (el === state.nextSlot && state.mode === 'aux') leaveAuxIfPossible();
		});
		el.addEventListener('progress', updateRoot);
		el.addEventListener('timeupdate', updateRoot);
		el.addEventListener('waiting', function(){
			if (el === state.mainSlot && state.mode === 'main') {
				state.net = 'slow';
				updateRoot();
			}
		});
		el.addEventListener('stalled', function(){
			if (el === state.mainSlot && state.mode === 'main') {
				state.net = 'slow';
				updateRoot();
			}
		});
		el.addEventListener('playing', function(){
			state.net = 'ok';
			updateRoot();
		});
		el.addEventListener('ended', function(){
			if (el === state.mainSlot && state.mode === 'main') onMainEnded();
			else if (el === state.auxSlot && state.mode === 'aux') leaveAuxIfPossible();
		});
		el.addEventListener('error', function(){
			if (el === state.mainSlot && state.mode === 'main') {
				state.net = 'fail';
				enterAux(trackAt(nextIndex(1)) || trackAt(state.index));
				scheduleNext();
			}
		});
	}

	function initMediaSession(){
		if (!('mediaSession' in navigator)) return;
		try { navigator.mediaSession.setActionHandler('play', function(){ togglePlay(); }); } catch (e) {}
		try { navigator.mediaSession.setActionHandler('pause', function(){ pauseMain(); }); } catch (e) {}
		try { navigator.mediaSession.setActionHandler('nexttrack', function(){ onNext(); }); } catch (e) {}
		try { navigator.mediaSession.setActionHandler('previoustrack', function(){ onPrev(); }); } catch (e) {}
		try {
			navigator.mediaSession.setActionHandler('seekto', function(detail){
				if (!detail || !isFinite(detail.seekTime)) return;
				if (!state.mainSlot || state.mode !== 'main') return;
				try { state.mainSlot.currentTime = clamp(detail.seekTime, 0, state.mainSlot.duration || detail.seekTime); } catch (e) {}
				updateRoot();
			});
		} catch (e) {}
	}

	function bootstrap(){
		state.calmArt = calmArt();
		state.calmBlob = calmWaveBlob();
		setVar('--a3m-calm-url', imageVar(state.calmArt));

		state.mainSlot = slot('main');
		state.nextSlot = slot('next');
		state.auxSlot = slot('aux');

		state.auxSlot.src = state.calmBlob;
		state.auxSlot.loop = false;
		state.auxSlot.preload = 'auto';
		state.auxSlot.load();

		bindAudio(state.mainSlot);
		bindAudio(state.nextSlot);
		bindAudio(state.auxSlot);
		bindActions();
		initMediaSession();
		tickProgress();

		fetchPlaylist().then(function(list){
			if (!list || !list.length) throw new Error('playlist empty');
			state.list = list;
			state.index = 0;
			loadMain(0, false);
			updateRoot();
		}).catch(function(err){
			state.net = 'fail';
			titleNode.textContent = 'Playlist error';
			artistNode.textContent = cleanText(err && err.message || err);
			albumNode.textContent = '';
			yearNode.textContent = '';
			setCover(state.calmArt, 1);
			setStatus('Please reload', 'error');
			updateRoot();
		});
	}

	bootstrap();
})();