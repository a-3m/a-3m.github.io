/* file: a3m.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

/*
#STYLE RULES

- Preserve existing style unless readability clearly improves.
- Keep code visually calm, compact, and easy to scan.
- Prefer direct, idiomatic JS (also HTML + CSS + SVG)
- Reuse existing primitives first.
- If logic repeats, extract the minimal missing helper.
- Do not duplicate logic without a clear reason.
- Avoid unnecessary wrappers, indirection, boilerplate, and abstraction.
- Keep names, structure, and formatting consistent.
- Use tabs where the file already uses tabs.
- No trailing whitespace or unnecessary empty lines
- Keep lines under 130 chars when reasonably possible.
- Wrap for human readability, not mechanically or for horizontal compactness.
- Do not use decorative alignment or visually unstable long-line layouts.
- Preserve useful comments and their placement unless clarity improves.
- Make the smallest clean change that fully solves the task.
- Preserve behavior unless a real change is explicitly required.
- Keep the result comfortable for long-term human reading and maintenance.

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

	const id = window.__logs_cfg && window.__logs_cfg.id || 'a3m';
	const Debug = /(?:\?|&)debug(?:=1)?(?:&|$)/.test(window.location.search) ? 1 : 0;

	const log = function(){
		console.log(id, ...arguments);
	};
	const warn = function(){
		console.warn(id, ...arguments);
	};
	const debug = function(){
		if (!state.debug) return;
		console.log(id, ...arguments);
	};

	log('init');

	const CFG = {
		NEXT_WARMUP_SEC: 10,
		CROSSFADE_SEC: 0,
		AUX_MIN_SEC: 7,
		PREVIEW_TAP_PX: 16,
		PREVIEW_SWIPE_PX: 56,
		PREVIEW_MAX_MS: 320,
		PREVIEW_SWIPE_DOWN_PX: 88,
		LONG_PRESS_MS: 480,
		LONG_PRESS_MOVE_PX: 14,
		PROGRESS_TICK_MS: 180,
		STATUS_MS: 1800,
		STALL_RESUME_MS: 1400,
		STALL_AUX_MS: 5200,
		RESUME_RETRY_MS: 1200,
		MAIN_READY_STATE: 2,
		NEXT_READY_STATE: 3,
		MORE_HIDE_MS: 4000,
	};

	const AUDIO_EXTS = [ 'opus', 'ogg', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'oga' ];
	const COVER_EXTS = [ 'webp', 'jpg', 'jpeg', 'png', 'gif', 'avif' ];

	const SESSION_KEY = id + '.session';

	const sess = {
		quality: 'norm',
		index: -3,
		pos: -2,
		vol: -1,
		repeat: 0,
		shuffle: 0,
		play: 0,
		more: 0
	};

	const state = {
		list: [],
		mainIndex: -1,
		nextIndex: -1,
		mainSlot: null,
		nextSlot: null,
		auxSlot: null,
		mode: 'main',
		play: 'stop',
		net: 'ok',
		auxTest: 0,
		preview: '',
		coverFake: 1,
		debug: Debug ? 1 : 0,
		auxStartedAt: 0,
		auxMinUntil: 0,
		progressTimer: 0,
		statusTimer: 0,
		longPressTimer: 0,
		gesture: null,
		lastTapAt: 0,
		calmArtPng: '',
		mainStallAt: 0,
		mainResumeAt: 0,
		mainLastTime: 0,
		mainLastMoveAt: 0,
		qualityNode: null,
		session: null,
		more: 0,
		moreTimer: 0,
		...sess
	};

	function loadSession(){
		let raw = '';
		let data = null;
		let k = '';

		try {
			raw = window.localStorage.getItem(SESSION_KEY) || '';
			if (!raw) return;
			data = JSON.parse(raw);
			log('loadSession: ', SESSION_KEY, raw)

			if (!data || typeof data !== 'object') return;

			for (k in sess) {
				if (k in data)
					state[k] = data[k];
			}
		} catch (e) {}
	}

	function resetSession(){
		let k = '';
		for (k in sess)
			state[k] = sess[k];
	}

	function saveSession(){
		const out = {};
		let k = '';

		state.index = state.mainIndex >= 0 ? state.mainIndex : state.index;

		for (k in sess)
			out[k] = state[k]

		const s = JSON.stringify(out);
		try {
			log('saveSession: ', SESSION_KEY,s)
			window.localStorage.setItem(SESSION_KEY, s) ;
		} catch (e) {}
	}


	function clearMoreTimer(){
		if (state.moreTimer) clearTimeout(state.moreTimer);
		state.moreTimer = 0;
	}

	function queueMoreHide(){
		clearMoreTimer();
		if (!state.more) return;

		state.moreTimer = setTimeout(function(){
			state.moreTimer = 0;
			state.more = 0;
			updateRoot();
		}, CFG.MORE_HIDE_MS);
	}

	function touchMore(){
		if (!state.more) return;
		queueMoreHide();
	}

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function cssText(s){
		return JSON.stringify(String(s == null ? '' : s));
	}

	function round1(n){
		n = parseFloat(n);
		if (!isFinite(n)) return 0;
		return Math.round(n * 10) / 10;
	}

	function formatClock(n){
		let h = 0;
		let m = 0;
		let s = 0;

		n = isFinite(n) && n > 0 ? Math.floor(n) : 0;
		h = Math.floor(n / 3600);
		m = Math.floor((n % 3600) / 60);
		s = n % 60;

		if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
		return m + ':' + String(s).padStart(2, '0');
	}

	function trackInfo(track){
		return {
			title: cleanText(track && track.meta && track.meta.title || ''),
			artist: cleanText(track && track.meta && track.meta.artist || ''),
			album: cleanText(track && track.meta && track.meta.album || ''),
			year: cleanText(track && track.meta && track.meta.year || ''),
			src: (track && track.src || ''),
			cover: (track && track.cover || '')
		};
	}

	function safeLogUrl(s){
		var i = 0;
		var cut = 160;

		s = String(s == null ? '' : s);

		if (s.indexOf('data:') === 0) {
			i = s.indexOf(',');
			return i >= 0 ? s.slice(0, i + 1) + '...' : 'data:...';
		}

		if (s.length > cut)
			return s.slice(0, cut) + '...';

		return s;
	}

	function slotInfo(el){
		return {
			name: cleanText(el && el.__a3mName || ''),
			index: el && isFinite(el.__a3mIndex) ? el.__a3mIndex : -1,
			readyState: el ? el.readyState : -1,
			paused: !!(el && el.paused),
			ended: !!(el && el.ended),
			currentTime: round1(el && el.currentTime),
			duration: round1(el && el.duration),
			src: (el && (el.currentSrc || el.getAttribute('src')) || '')
		};
	}

	function logState(tag, extra){
		debug(tag, {
			mode: state.mode,
			play: state.play,
			net: state.net,
			index: state.index,
			mainIndex: state.mainIndex,
			nextIndex: state.nextIndex,
			repeat: state.repeat,
			shuffle: state.shuffle,
			auxTest: state.auxTest,
			quality: state.quality,
			more: state.more,
			preview: state.preview,
			main: slotInfo(state.mainSlot),
			next: slotInfo(state.nextSlot),
			aux: slotInfo(state.auxSlot),
			extra: extra || {}
		});
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
			warn('decodeValue failed', s, String(e && e.message || e));
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
			warn('resolveUrl failed', { base: base, rel: rel, err: String(e && e.message || e) });
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

	function currentIndexBase(){
		if (state.mainIndex >= 0) return state.mainIndex;
		if (state.index >= 0) return state.index;
		return 0;
	}

	function nextIndex(step, fromIndex, skipIndex){
		const n = state.list.length;
		let idx = 0;
		let tries = 0;

		step = step < 0 ? -1 : 1;
		fromIndex = fromIndex == null ? -1 : normalizeIndex(fromIndex);
		skipIndex = skipIndex == null ? -1 : normalizeIndex(skipIndex);
		if (!n) return -1;
		if (n === 1) return 0;
		if (fromIndex < 0) fromIndex = currentIndexBase();

		if (state.shuffle) {
			for (tries = 0; tries < 24; tries++) {
				idx = Math.floor(Math.random() * n);
				if (idx !== fromIndex && idx !== skipIndex) {
					log('nextIndex shuffle', { fromIndex: fromIndex, skipIndex: skipIndex, next: idx, tries: tries + 1 });
					return idx;
				}
			}
			idx = fromIndex;
			do {
				idx = normalizeIndex(idx + 1);
			} while (idx === fromIndex || idx === skipIndex);
			log('nextIndex shuffle fallback', { fromIndex: fromIndex, skipIndex: skipIndex, next: idx });
			return idx;
		}

		idx = fromIndex;
		do {
			idx = normalizeIndex(idx + step);
		} while (idx === skipIndex && idx !== fromIndex);
		return idx;
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
		log('slot create', name);
		return el;
	}

	function stopSlot(el){
		if (!el) return;
		log('slot stop', slotInfo(el));
		try { el.pause(); } catch (e) {
			warn('slot stop failed', slotInfo(el), String(e && e.message || e));
		}
	}

	function resetSlot(el){
		if (!el) return;
		log('slot reset', slotInfo(el));
		stopSlot(el);
		el.removeAttribute('src');
		try { el.load(); } catch (e) {
			warn('slot reset load failed', slotInfo(el), String(e && e.message || e));
		}
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

	const coverPreloads = {};

	function preloadCover(url){
		let item = null;
		let img = null;

		url = cleanText(url || '');
		if (!url) return;

		item = coverPreloads[url];
		if (item) {
			debug('cover preload cached', { url: url, state: item.state });
			return;
		}

		log('cover preload', url);
		img = new Image();
		item = coverPreloads[url] = {
			img: img,
			state: 'loading'
		};

		img.onload = function(){
			item.state = 'ok';
			log('cover preload ok', url);
		};

		img.onerror = function(){
			item.state = 'fail';
			warn('cover preload fail', {
				url: url,
				currentSrc: cleanText(img.currentSrc || img.src || ''),
				complete: img.complete,
				naturalWidth: img.naturalWidth,
				naturalHeight: img.naturalHeight
			});
		};

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
						log('playlist wrap join', carry);
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
		let track = null;
		let i = 0;

		log('playlist parse start', { base: baseUrl, lines: lines.length });

		for (i = 0; i < lines.length; i++) {
			line = cleanText(lines[i]);
			if (!line || line.charAt(0) === '#' || line.charAt(0) === ';') continue;
			if (/^a3ms:\/\//i.test(line)) {
				continue;
			}

			url = resolveUrl(baseUrl, line);
			if (isCoverPath(url)) {
				pendingCover = url;
				continue;
			}
			if (!isAudioPath(url)) {
				log('playlist skip non-audio', line);
				continue;
			}

			track = {
				src: url,
				cover: cleanText(pendingCover || ''),
				meta: parseMeta(url)
			};
			list.push(track);
			pendingCover = '';
		}

		log('playlist parse done', { count: list.length });
		return list;
	}

	function fetchPlaylist(){
		const url = resolveUrl(window.location.href, playlistSrc);

		log('playlist fetch start', url);

		return fetch(url, { credentials: 'same-origin' }).then(function(res){
			log('playlist fetch response', { ok: !!(res && res.ok), status: res && res.status, url: url });
			if (!res || !res.ok) throw new Error('playlist fetch failed');
			return res.text();
		}).then(function(text){
			log('playlist fetch text', { chars: text.length, url: url });
			return parsePlaylist(text, url);
		});
	}

	function calmArt(){
		function rnd(a, b){
			return a + (Math.random() * (b - a));
		}

		function hsl(h, s, l, a){
			return 'hsla(' + Math.round(h) + ',' + Math.round(s) + '%,' + Math.round(l) + '%,' + a + ')';
		}

		function rectPath(x, y, w, h){
			return 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h-' + w + 'z';
		}

		function patternPath(rows, ox, oy, u){
			let out = '';
			let y = 0;
			let x = 0;
			let row = '';

			for (y = 0; y < rows.length; y++) {
				row = rows[y];
				for (x = 0; x < row.length; x++) {
					if (row.charAt(x) === 'X')
						out += rectPath(ox + (x * u), oy + (y * u), u, u);
				}
			}

			return out;
		}

		function patternWidth(rows){
			let w = 0;
			let i = 0;

			for (i = 0; i < rows.length; i++)
				w = Math.max(w, rows[i].length);

			return w;
		}

		const hue = rnd(228, 286);
		const hue2 = hue + rnd(-18, 18);
		const hue3 = hue + rnd(18, 42);
		const hue4 = hue - rnd(10, 24);

		const bg0 = hsl(hue, 42, 5, 1);
		const bg1 = hsl(hue2, 52, 10, 1);
		const bg2 = hsl(hue3, 38, 14, 1);
		const bg3 = hsl(hue4, 30, 8, 1);
		const overlay = hsl(hue, 14, 4, 0.64);

		const g = 24;
		const thick = g * 2;
		const len = g * 10;
		const inset = g * 3;
		const p = thick;
		const gap = 1;

		const a = [
			'....',
			'.XX.',
			'...X',
			'XXXX',
			'X..X',
			'X..X',
			'X..X'
		];

		const n3 = [
			'XX.',
			'..X',
			'..X',
			'XX.',
			'..X',
			'..X',
			'XX.'
		];

		const m = [
			'.....',
			'.....',
			'XX.X.',
			'X.X.X',
			'X.X.X',
			'X.X.X',
			'X.X.X'
		];

		const parts = [ a, n3, m ];
		let totalCols = 0;
		let i = 0;
		let ox = 0;
		let oy = 0;
		let x = 0;
		let cut = '';

		for (i = 0; i < parts.length; i++) {
			totalCols += patternWidth(parts[i]);
			if (i + 1 < parts.length) totalCols += gap;
		}

		ox = Math.round((1024 - (totalCols * p)) / (2 * g)) * g;
		oy = Math.round((1024 - (7 * p)) / (2 * g)) * g;

		x = ox;
		for (i = 0; i < parts.length; i++) {
			cut += patternPath(parts[i], x, oy, p);
			x += (patternWidth(parts[i]) + gap) * p;
		}

		cut += rectPath(inset, inset, len, thick);
		cut += rectPath(inset, inset, thick, len);

		cut += rectPath(1024 - inset - len, inset, len, thick);
		cut += rectPath(1024 - inset - thick, inset, thick, len);

		cut += rectPath(inset, 1024 - inset - thick, len, thick);
		cut += rectPath(inset, 1024 - inset - len, thick, len);

		cut += rectPath(1024 - inset - len, 1024 - inset - thick, len, thick);
		cut += rectPath(1024 - inset - thick, 1024 - inset - len, thick, len);

		const svg = '' +
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" shape-rendering="crispEdges">' +
			'<defs>' +
				'<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
					'<stop offset="0" stop-color="' + bg0 + '"/>' +
					'<stop offset="0.34" stop-color="' + bg1 + '"/>' +
					'<stop offset="0.68" stop-color="' + bg2 + '"/>' +
					'<stop offset="1" stop-color="' + bg3 + '"/>' +
				'</linearGradient>' +
				'<mask id="cut">' +
					'<rect width="1024" height="1024" fill="white"/>' +
					'<path fill="black" d="' + cut + '"/>' +
				'</mask>' +
			'</defs>' +
			'<rect width="1024" height="1024" fill="url(#g)"/>' +
			'<rect width="1024" height="1024" fill="' + overlay + '" mask="url(#cut)"/>' +
			'</svg>';

		return 'data:image/svg+xml,' + encodeURIComponent(svg);
	}

	function svgToPngUrl(svgUrl, size){
		log('svgToPngUrl start', { size: size || 512 });
		return new Promise(function(resolve){
			const img = new Image();
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			let out = '';

			size = size || 512;
			canvas.width = size;
			canvas.height = size;

			img.onload = function(){
				try {
					ctx.clearRect(0, 0, size, size);
					ctx.drawImage(img, 0, 0, size, size);
					out = canvas.toDataURL('image/png');
					log('svgToPngUrl done', { size: size, bytes: out.length });
				} catch (e) {
					out = '';
					warn('svgToPngUrl draw failed', String(e && e.message || e));
				}
				resolve(out);
			};

			img.onerror = function(){
				warn('svgToPngUrl image error');
				resolve('');
			};

			img.src = svgUrl;
		});
	}

	function calmWaveBlob(){
		const sampleRate = 48000;
		const seconds = 7;
		const channels = 2;
		const bytesPerSample = 4;
		const totalFrames = sampleRate * seconds;
		const blockAlign = channels * bytesPerSample;
		const dataSize = totalFrames * blockAlign;
		const buf = new ArrayBuffer(44 + dataSize);
		const view = new DataView(buf);
		const modes = [ 'old', 'desert', 'wind', 'hiss' ];
		const mode = modes[Math.floor(Math.random() * modes.length)];
		let off = 44;
		let i = 0;
		let ch = 0;
		let noise = 0;
		let air = 0;
		let sand = 0;
		let gust = 0;
		let t = 0;
		let env = 0;
		let s = 0;
		let blobUrl = '';

		function writeAscii(pos, text){
			let j = 0;
			for (j = 0; j < text.length; j++) view.setUint8(pos + j, text.charCodeAt(j));
		}

		writeAscii(0, 'RIFF');
		view.setUint32(4, 36 + dataSize, true);
		writeAscii(8, 'WAVE');
		writeAscii(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 3, true);
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
			air = (air * 0.985) + ((Math.random() * 2 - 1) * 0.0035);
			sand = ((Math.random() * 2 - 1) * 0.5) - sand * 0.72;
			gust = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t * 0.065 + 0.8 * Math.sin(Math.PI * 2 * t * 0.021));

			env = 1;
			if (t < 0.8) env = t / 0.8;
			if (t > seconds - 1.2) env = Math.max(0, (seconds - t) / 1.2);

			if (mode === 'desert') {
				s =
					Math.sin(Math.PI * 2 * t * 84) * 0.002 +
					Math.sin(Math.PI * 2 * t * 121) * 0.0015 +
					noise * 0.010 +
					air * (0.026 + gust * 0.016) +
					sand * (0.008 + gust * 0.018);
			} else if (mode === 'wind') {
				s =
					Math.sin(Math.PI * 2 * t * 72) * 0.002 +
					noise * 0.010 +
					air * 0.045 +
					(Math.sin(Math.PI * 2 * t * 0.11) * 0.5 + 0.5) * sand * 0.006;
			} else if (mode === 'hiss') {
				s =
					Math.sin(Math.PI * 2 * t * 96) * 0.0015 +
					noise * 0.014 +
					air * 0.012 +
					sand * 0.018;
			} else {
				s =
					Math.sin(Math.PI * 2 * t * 104) * 0.014 +
					Math.sin(Math.PI * 2 * t * 151) * 0.012 +
					noise * 0.05;
			}

			s *= env * 0.9;
			s = clamp(s, -1, 1);

			for (ch = 0; ch < channels; ch++) {
				view.setFloat32(off, s, true);
				off += 4;
			}
		}

		blobUrl = URL.createObjectURL(new Blob([ buf ], { type: 'audio/wav' }));
		log('calmWaveBlob ready', { sampleRate: sampleRate, seconds: seconds, bytes: 44 + dataSize, format: 'f32', mode: mode });
		return blobUrl;
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
		log('meta set', { aux: !!auxMode, label: label, track: trackInfo(track) });
	}

	function clearStatusTimer(){
		if (state.statusTimer) clearTimeout(state.statusTimer);
		state.statusTimer = 0;
	}

	function setStatus(text, kind, ms){
		text = cleanText(text || '');
		kind = cleanText(kind || '');

		clearStatusTimer();
		statusNode.textContent = text;
		root.setAttribute('data-a3m-status', text ? kind : '');
		log('status', { text: text, kind: kind, ms: ms > 0 ? ms : CFG.STATUS_MS });

		if (!text || kind === 'error') return;

		state.statusTimer = setTimeout(function(){
			state.statusTimer = 0;
			statusNode.textContent = '';
			root.setAttribute('data-a3m-status', '');
			log('status clear');
		}, ms > 0 ? ms : CFG.STATUS_MS);
	}

	function updateDownload(track){
		if (!downloadNode) return;
		downloadNode.setAttribute('href', cleanText(track && track.src || '#'));
		downloadNode.setAttribute('download', '');
		log('download set', trackInfo(track));
	}

	function setCover(url, fake){
		setVar('--a3m-cover-url', imageVar(url));
		state.coverFake = fake ? 1 : 0;
		setData('cover', state.coverFake ? 'fake' : 'real');
		log('cover set', { url: safeLogUrl(url), fake: state.coverFake });
	}

	function mediaArtwork(url){
		const src = cleanText(url || '');

		if (!src || src === state.calmArt) {
			if (!state.calmArtPng) return [];
			return [
				{ src: state.calmArtPng, sizes: '256x256', type: 'image/png' },
				{ src: state.calmArtPng, sizes: '512x512', type: 'image/png' }
			];
		}

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
			log('media track', trackInfo(track));
		} catch (e) {
			warn('media track failed', trackInfo(track), String(e && e.message || e));
		}
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
			log('media aux', trackInfo(track));
		} catch (e) {
			warn('media aux failed', trackInfo(track), String(e && e.message || e));
		}
	}

	function refreshMediaArtwork(){
		log('media artwork refresh', { mode: state.mode, mainIndex: state.mainIndex, nextIndex: state.nextIndex });
		if (state.mode === 'aux') {
			setMediaAux(trackAt(state.nextIndex >= 0 ? state.nextIndex : state.index));
			return;
		}
		if (state.mainIndex >= 0) setMediaTrack(trackAt(state.mainIndex));
	}

	function syncPlaybackState(){
		if (!('mediaSession' in navigator)) return;
		try {
			navigator.mediaSession.playbackState = state.play === 'play' ? 'playing' : 'paused';
			debug('media playbackState', state.play);
		} catch (e) {
			warn('media playbackState failed', String(e && e.message || e));
		}
	}

	function clearMainStall(){
		if (state.mainStallAt || state.mainResumeAt) log('stall clear', { stallAt: state.mainStallAt, resumeAt: state.mainResumeAt });
		state.mainStallAt = 0;
		state.mainResumeAt = 0;
	}

	function markMainMoved(){
		state.mainLastTime = state.mainSlot && isFinite(state.mainSlot.currentTime) ? state.mainSlot.currentTime : 0;
		state.mainLastMoveAt = Date.now();
		clearMainStall();
		if (state.mode === 'main' && state.play === 'play') state.net = 'ok';
		debug('main moved', { time: round1(state.mainLastTime), movedAt: state.mainLastMoveAt });
	}

	function reviveSlot(el){
		if (!el || state.play !== 'play') return;
		log('slot revive', slotInfo(el));
		try {
			state.mainResumeAt = Date.now();
			el.play().then(function(){
				log('slot revive ok', slotInfo(el));
				syncPlaybackState();
				updateRoot();
			}).catch(function(err){
				warn('slot revive failed', slotInfo(el), String(err && err.message || err));
				syncPlaybackState();
				updateRoot();
			});
		} catch (e) {
			warn('slot revive throw', slotInfo(el), String(e && e.message || e));
		}
	}

	function revivePlayback(){
		logState('revivePlayback');
		if (state.play !== 'play') return;
		if (state.mode === 'aux') {
			if (state.nextIndex < 0 || state.nextSlot.__a3mIndex !== state.nextIndex) scheduleNext();
			if (nextReady(state.nextSlot)) {
				leaveAuxIfPossible();
				if (state.mode !== 'aux') return;
			}
			reviveSlot(state.auxSlot);
			return;
		}
		if (nextReady(state.nextSlot) && (!mainReady(state.mainSlot) || (state.mainSlot && state.mainSlot.error) || state.net === 'fail')) {
			log('revivePlayback swap from next');
			state.net = 'ok';
			swapMainNext();
			return;
		}
		if (state.mainIndex >= 0 && state.mainSlot && (!state.mainSlot.getAttribute('src') || state.mainSlot.__a3mIndex !== state.mainIndex)) {
			log('revivePlayback prepare main', { mainIndex: state.mainIndex });
			prepareTrack(state.mainSlot, state.mainIndex);
		}
		reviveSlot(state.mainSlot);
		if (state.nextIndex < 0 || state.nextSlot.__a3mIndex !== state.nextIndex) scheduleNext();
	}

	function slotReady(el, index, minReady){
		minReady = minReady || 2;
		return !!(el && index >= 0 && el.__a3mIndex === index && !el.error && el.readyState >= minReady);
	}

	function mainReady(el){
		return slotReady(el, state.mainIndex, CFG.MAIN_READY_STATE);
	}

	function nextReady(el){
		return slotReady(el, state.nextIndex, CFG.NEXT_READY_STATE);
	}

	function qualityText(){
		if (state.quality === 'low') return 'lo';
		if (state.quality === 'hi') return 'hi';
		return 'nm';
	}

	function getToggleState(){
		if (state.preview === 'toggle') return 'pressed';
		if (state.mode === 'aux' || root.getAttribute('data-a3m-status') === 'error' || state.net === 'fail') return 'fail';
		if (state.mainIndex >= 0 && !mainReady(state.mainSlot)) return 'preload';
		if (state.play === 'play') return 'active';
		return '';
	}

	function updateRoot(){
		const main = state.mainSlot;
		const next = state.nextSlot;
		const aux = state.auxSlot;
		const progress = state.mode === 'main' ? currentProgress(main) : 0;
		const buffer = state.mode === 'main' ? bufferedPercent(main) : 0;
		const total = state.list.length;
		const idx = total > 0 && (state.mainIndex >= 0 || state.index >= 0) ? (currentIndexBase() + 1) : 0;
		const pos = state.mode === 'main' && main && isFinite(main.currentTime) ? main.currentTime : 0;
		const duration = state.mode === 'main' && main && isFinite(main.duration) ? main.duration : 0;

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
		setData('toggle', getToggleState());

		setVar('--a3m-progress', String(progress));
		setVar('--a3m-buffer', String(buffer));
		setVar('--a3m-main-buffer', String(bufferedPercent(main)));
		setVar('--a3m-next-buffer', String(bufferedPercent(next)));
		setVar('--a3m-aux-buffer', String(bufferedPercent(aux)));
		setVar('--a3m-quality', '"' + qualityText() + '"');
		setVar('--a3m-track-idx', cssText(idx));
		setVar('--a3m-track-total', cssText(total));
		setVar('--a3m-track-pos', cssText(formatClock(pos)));
		setVar('--a3m-track-duration', cssText(formatClock(duration)));

		if (state.qualityNode) {
			state.qualityNode.setAttribute('aria-label', 'quality ' + state.quality);
			state.qualityNode.setAttribute('title', 'quality ' + state.quality);
		}

		techMainNode.textContent = 'main ' + (root.getAttribute('data-a3m-main') || '') + ' ' + Math.round(bufferedPercent(main)) + '%';
		techNextNode.textContent = 'next ' + (root.getAttribute('data-a3m-next') || '') + ' ' + Math.round(bufferedPercent(next)) + '%';
		techAuxNode.textContent = 'aux ' + (root.getAttribute('data-a3m-aux') || '') + ' ' + Math.round(bufferedPercent(aux)) + '%';
		techNetNode.textContent = 'net ' + state.net;
	}

	function checkPlaybackRecovery(){
		const now = Date.now();
		const main = state.mainSlot;
		let pos = 0;
		let stuckMs = 0;
		let target = null;

		if (state.mode === 'aux') {
			leaveAuxIfPossible();
			if (state.play === 'play' && state.auxSlot && state.auxSlot.paused) reviveSlot(state.auxSlot);
			return;
		}
		if (!main || state.play !== 'play' || state.mainIndex < 0) return;
		if (main.ended) return;

		pos = isFinite(main.currentTime) ? main.currentTime : 0;
		if (Math.abs(pos - state.mainLastTime) > 0.04) {
			markMainMoved();
			updateRoot();
			return;
		}

		if (!state.mainLastMoveAt) state.mainLastMoveAt = now;
		stuckMs = now - state.mainLastMoveAt;
		if (!state.mainStallAt && (main.paused || main.readyState < CFG.NEXT_READY_STATE || stuckMs >= CFG.STALL_RESUME_MS)) {
			state.mainStallAt = state.mainLastMoveAt || now;
			log('recovery stall start', { stuckMs: stuckMs, main: slotInfo(main) });
		}
		if (!state.mainStallAt) return;

		state.net = 'slow';
		if (stuckMs >= CFG.STALL_RESUME_MS && now - state.mainResumeAt >= CFG.RESUME_RETRY_MS) {
			log('recovery revive main', { stuckMs: stuckMs, sinceResume: now - state.mainResumeAt });
			reviveSlot(main);
		}
		if (stuckMs < CFG.STALL_AUX_MS) {
			updateRoot();
			return;
		}

		if (nextReady(state.nextSlot)) {
			log('recovery promote next', { stuckMs: stuckMs, next: slotInfo(state.nextSlot) });
			state.net = 'ok';
			swapMainNext();
			return;
		}

		target = trackAt(state.nextIndex >= 0 ? state.nextIndex : nextIndex(1, currentIndexBase(), state.mainIndex)) || trackAt(state.index);
		log('recovery enter aux', { stuckMs: stuckMs, target: trackInfo(target) });
		enterAux(target);
		scheduleNext();
	}

	function tickProgress(){
		clearInterval(state.progressTimer);
		log('progress timer start', CFG.PROGRESS_TICK_MS);
		state.progressTimer = setInterval(function(){
			updateRoot();
			checkWarmWindow();
			checkPlaybackRecovery();
		}, CFG.PROGRESS_TICK_MS);
	}

	function chooseMainCover(track){
		if (track && cleanText(track.cover || '')) return cleanText(track.cover);
		return state.calmArt;
	}

	function qualityAudioUrl(url, quality){
		const m = /^(.*)(\.[a-z0-9]+)([?#].*)?$/i.exec(cleanText(url || ''));
		const base = m ? m[1] : cleanText(url || '');
		const ext = m ? m[2] : '';
		const tail = m ? (m[3] || '') : '';

		if (!base || !ext) return cleanText(url || '');
		if (quality === 'low') return base + '.low' + ext + tail;
		if (quality === 'hi') return base + '.hi' + ext + tail;
		return base + ext + tail;
	}

	function trackAudioSrc(track, quality){
		return qualityAudioUrl(track && track.src || '', quality == null ? state.quality : quality);
	}

	function baseName(url){
		url = cleanText(url || '').replace(/[?#].*$/, '');
		url = url.replace(/\/+$/, '');
		return url.replace(/^.*\//, '');
	}

	function prepareTrack(slotEl, index){
		const track = trackAt(index);
		const src = trackAudioSrc(track);

		if (!slotEl || index < 0 || !track) return;
		if (
			slotEl.__a3mIndex === index &&
			cleanText(slotEl.__a3mResolvedSrc || slotEl.getAttribute('src') || '') === cleanText(src)
		) {
			log('prepareTrack skip', { slot: slotInfo(slotEl), index: index, src: src, quality: state.quality });
			return;
		}

		slotEl.__a3mIndex = index;
		slotEl.__a3mQuality = state.quality;
		slotEl.__a3mResolvedSrc = src;
		slotEl.preload = 'auto';
		slotEl.src = src;

		log('prepareTrack', {
			slot: cleanText(slotEl.__a3mName || ''),
			index: index,
			title: cleanText(track && track.meta && track.meta.title || ''),
			quality: state.quality,
			srcBaseName: baseName(src)
		});

		slotEl.load();
		preloadCover(track.cover);
	}
	function swapMainNext(){
		const oldMain = state.mainSlot;
		const oldIndex = state.mainIndex;

		logState('swapMainNext before');
		state.mainSlot = state.nextSlot;
		state.mainIndex = state.nextIndex;
		state.nextSlot = oldMain;
		state.nextIndex = -1;

		markMainMoved();
		stopSlot(state.nextSlot);
		resetSlot(state.nextSlot);

		if (state.mainIndex >= 0) {
			state.index = state.mainIndex;
			enterMain(trackAt(state.mainIndex), true);
			scheduleNext();
		}

		if (oldIndex >= 0) oldMain.__a3mIndex = -1;
		logState('swapMainNext after');
	}

	function beginCurrent(){
		const track = trackAt(state.index);

		log('beginCurrent', trackInfo(track));
		if (!track) return;
		if (state.mode === 'aux' && Date.now() < state.auxMinUntil && !state.auxTest) {
			log('beginCurrent blocked by aux min', { auxMinUntil: state.auxMinUntil });
			return;
		}
		if (state.mainSlot && state.mainSlot.__a3mIndex === state.index) {
			try { state.mainSlot.currentTime = 0; } catch (e) {
				warn('beginCurrent currentTime reset failed', String(e && e.message || e));
			}
			markMainMoved();
			if (state.play !== 'play') playMain();
			return;
		}
		loadMain(state.index, state.play === 'play');
	}

	function stopAll(hard){
		log('stopAll', { hard: !!hard });
		stopSlot(state.mainSlot);
		stopSlot(state.nextSlot);
		stopSlot(state.auxSlot);
		clearMainStall();
		if (hard) {
			resetSlot(state.nextSlot);
			state.nextIndex = -1;
			state.play = 'stop';
			state.mode = 'main';
			state.net = 'ok';
			setStatus('');
			if ('mediaSession' in navigator) {
				try {
					navigator.mediaSession.metadata = null;
					log('media metadata clear');
				} catch (e) {
					warn('media metadata clear failed', String(e && e.message || e));
				}
			}
		} else {
			state.play = 'pause';
		}
		syncPlaybackState();
		updateRoot();
		logState('stopAll done', { hard: !!hard });
	}

	function playMain(){
		const track = trackAt(state.mainIndex >= 0 ? state.mainIndex : state.index);

		log('playMain', trackInfo(track));
		if (!track) return;
		state.mode = 'main';
		state.play = 'play';
		state.net = 'ok';
		clearMainStall();
		setMeta(track, false);
		setCover(chooseMainCover(track), cleanText(track.cover || '') ? 0 : 1);
		setStatus(state.nextIndex >= 0 ? 'Preparing next track' : '');
		setMediaTrack(track);
		updateDownload(track);
		markMainMoved();
		state.mainSlot.play().then(function(){
			log('playMain ok', slotInfo(state.mainSlot));
			syncPlaybackState();
			updateRoot();
		}).catch(function(err){
			warn('playMain failed', trackInfo(track), String(err && err.message || err));
			state.play = 'pause';
			syncPlaybackState();
			updateRoot();
		});
	}

	function pauseMain(){
		logState('pauseMain');
		stopSlot(state.mainSlot);
		stopSlot(state.auxSlot);
		clearMainStall();
		state.play = 'pause';
		syncPlaybackState();
		updateRoot();
	}

	function enterMain(track, autoplay){
		log('enterMain', { autoplay: !!autoplay, track: trackInfo(track) });
		if (!track) return;
		state.mode = 'main';
		state.net = 'ok';
		clearMainStall();
		setMeta(track, false);
		setCover(chooseMainCover(track), cleanText(track.cover || '') ? 0 : 1);
		setMediaTrack(track);
		updateDownload(track);
		if (autoplay) {
			state.play = 'play';
			markMainMoved();
			state.mainSlot.play().then(function(){
				log('enterMain autoplay ok', slotInfo(state.mainSlot));
				setStatus(state.nextIndex >= 0 ? 'Preparing next track' : '');
				syncPlaybackState();
				updateRoot();
			}).catch(function(err){
				warn('enterMain autoplay failed', trackInfo(track), String(err && err.message || err));
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
		log('enterAux', trackInfo(track));
		state.mode = 'aux';
		state.play = 'play';
		state.net = 'fail';
		state.auxStartedAt = Date.now();
		state.auxMinUntil = state.auxStartedAt + (CFG.AUX_MIN_SEC * 1000);
		clearMainStall();
		setMeta(track, true);
		setCover(state.calmArt, 1);
		setMediaAux(track);
		setStatus('Trying next source', 'error');
		updateDownload(track);
		state.auxSlot.currentTime = 0;
		state.auxSlot.play().then(function(){
			log('enterAux ok', slotInfo(state.auxSlot));
			syncPlaybackState();
			updateRoot();
		}).catch(function(err){
			warn('enterAux failed', trackInfo(track), String(err && err.message || err));
			state.play = 'pause';
			syncPlaybackState();
			updateRoot();
		});
	}

	function leaveAuxIfPossible(){
		if (state.mode !== 'aux') return;
		if (!nextReady(state.nextSlot)) return;
		if (Date.now() < state.auxMinUntil && !state.auxTest) return;
		log('leaveAuxIfPossible', { aux: slotInfo(state.auxSlot), next: slotInfo(state.nextSlot) });
		stopSlot(state.auxSlot);
		state.net = 'ok';
		swapMainNext();
	}

	function loadMain(index, autoplay){
		const track = trackAt(index);

		index = normalizeIndex(index);
		log('loadMain', { index: index, autoplay: !!autoplay, track: trackInfo(track) });
		if (index < 0 || !track) return;

		state.index = index;
		state.mainIndex = index;
		prepareTrack(state.mainSlot, index);
		clearMainStall();
		state.mainLastTime = 0;
		state.mainLastMoveAt = 0;
		setMeta(track, false);
		setCover(chooseMainCover(track), cleanText(track.cover || '') ? 0 : 1);
		setStatus('Loading');
		updateDownload(track);

		if (mainReady(state.mainSlot)) {
			log('loadMain immediate ready', slotInfo(state.mainSlot));
			enterMain(track, autoplay);
			scheduleNext();
			return;
		}

		state.mainSlot.addEventListener('canplay', function onCanPlay(){
			state.mainSlot.removeEventListener('canplay', onCanPlay);
			log('loadMain canplay listener', { index: index, currentMainIndex: state.mainIndex, slot: slotInfo(state.mainSlot) });
			if (state.mainIndex !== index) return;
			enterMain(track, autoplay);
			scheduleNext();
		});
		updateRoot();
	}

	function scheduleNext(fromIndex, skipIndex){
		const index = nextIndex(1, fromIndex, skipIndex);

		log('scheduleNext', { fromIndex: fromIndex, skipIndex: skipIndex, next: index });
		if (index < 0 || index === state.mainIndex) {
			state.nextIndex = -1;
			resetSlot(state.nextSlot);
			if (state.mode !== 'aux') setStatus('');
			updateRoot();
			return;
		}
		state.nextIndex = index;
		if (state.mode === 'aux') setStatus('Recovering playback', 'error');
		else setStatus('Preparing next track');
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
		if (left <= CFG.NEXT_WARMUP_SEC && state.nextIndex < 0) {
			log('warmWindow', { left: round1(left), main: slotInfo(state.mainSlot) });
			scheduleNext();
		}
	}

	function onMainEnded(){
		logState('main ended');
		if (state.repeat) {
			beginCurrent();
			return;
		}
		if (nextReady(state.nextSlot)) {
			swapMainNext();
			return;
		}
		enterAux(trackAt(state.nextIndex >= 0 ? state.nextIndex : nextIndex(1, currentIndexBase(), state.mainIndex)) || trackAt(state.index));
		scheduleNext();
	}

	function seekToRatio(ratio){
		if (state.mode !== 'main') return;
		if (!state.mainSlot || !isFinite(state.mainSlot.duration) || state.mainSlot.duration <= 0) return;
		log('seekToRatio', { ratio: ratio, duration: round1(state.mainSlot.duration) });
		try {
			state.mainSlot.currentTime = clamp(ratio, 0, 1) * state.mainSlot.duration;
			markMainMoved();
		} catch (e) {
			warn('seekToRatio failed', String(e && e.message || e));
		}
		updateRoot();
	}

	function togglePlay(){
		logState('togglePlay');
		if (state.mode === 'aux') {
			if (state.play === 'play') {
				pauseMain();
				return;
			}
			state.play = 'play';
			reviveSlot(state.auxSlot);
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
		log('action prev');
		loadMain(nextIndex(-1, currentIndexBase()), state.play === 'play');
	}

	function onNext(){
		log('action next');
		if (state.mode === 'aux' && nextReady(state.nextSlot)) {
			stopSlot(state.auxSlot);
			state.net = 'ok';
			swapMainNext();
			return;
		}
		loadMain(nextIndex(1, currentIndexBase(), state.mainIndex), state.play === 'play');
	}

	function toggleMore(){
		state.more = state.more ? 0 : 1;
		log('toggleMore', state.more);
		if (state.more) queueMoreHide();
		else clearMoreTimer();
		updateRoot();
	}

	function toggleRepeat(){
		state.repeat = state.repeat ? 0 : 1;
		log('toggleRepeat', state.repeat);
		updateRoot();
	}

	function toggleShuffle(){
		state.shuffle = state.shuffle ? 0 : 1;
		log('toggleShuffle', state.shuffle);
		updateRoot();
	}

	function toggleAuxTest(){
		const track = trackAt(state.index >= 0 ? state.index : 0);

		state.auxTest = state.auxTest ? 0 : 1;
		log('toggleAuxTest', { auxTest: state.auxTest, track: trackInfo(track) });
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

	function toggleQuality(){
		if (state.quality === 'norm') state.quality = 'low';
		else if (state.quality === 'low') state.quality = 'hi';
		else state.quality = 'norm';
		log('toggleQuality', state.quality);
		updateRoot();
	}

	function refreshPage(){
		log('refreshPage');
		window.location.reload();
	}

	function onProgressClick(e){
		const rect = progressNode.getBoundingClientRect();
		let ratio = 0;

		if (!rect || !rect.width) return;
		ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
		log('progress click', { x: e.clientX, left: rect.left, width: rect.width, ratio: ratio });
		seekToRatio(ratio);
	}

	function fullscreenElement(){
		return document.fullscreenElement || document.webkitFullscreenElement || null;
	}

	function toggleFullscreen(){
		const node = document.documentElement || document.body;

		log('toggleFullscreen', { active: !!fullscreenElement() });
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
		debug('preview', state.preview);
		updateRoot();
	}

	function clearPreview(){
		if (!state.preview) return;
		debug('preview clear', state.preview);
		state.preview = '';
		updateRoot();
	}

	function clearLongPressTimer(){
		if (state.longPressTimer) clearTimeout(state.longPressTimer);
		state.longPressTimer = 0;
	}

	function queueLongPress(){
		clearLongPressTimer();
		debug('longPress queue', CFG.LONG_PRESS_MS);
		state.longPressTimer = setTimeout(function(){
			const g = state.gesture;
			const dx = g ? Math.abs(g.lastX - g.x) : 0;
			const dy = g ? Math.abs(g.lastY - g.y) : 0;

			state.longPressTimer = 0;
			if (!g || g.held || g.done) return;
			if (dx > CFG.LONG_PRESS_MOVE_PX || dy > CFG.LONG_PRESS_MOVE_PX) {
				debug('longPress cancel move', { dx: dx, dy: dy });
				return;
			}
			g.held = 1;
			debug('longPress fire', { dx: dx, dy: dy });
			setPreview('fullscreen');
			toggleFullscreen();
			g.done = 1;
		}, CFG.LONG_PRESS_MS);
	}

	function gestureAction(dx, dy, dt, x, y){
		if (dy >= CFG.PREVIEW_SWIPE_DOWN_PX && dy > Math.abs(dx) * 1.2) return 'refresh';
		if (Math.abs(dx) >= CFG.PREVIEW_SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.15) return dx < 0 ? 'next' : 'prev';
		if (Math.abs(dx) <= CFG.PREVIEW_TAP_PX && Math.abs(dy) <= CFG.PREVIEW_TAP_PX && dt <= CFG.PREVIEW_MAX_MS) {
			return 'toggle';
		}
		return '';
	}

	function releaseGestureCapture(){
		if (!state.gesture) return;
		if (root.releasePointerCapture && state.gesture.id != null) {
			try { root.releasePointerCapture(state.gesture.id); } catch (e) {
				warn('releaseGestureCapture failed', String(e && e.message || e));
			}
		}
	}

	function onPointerDown(e){
		const target = e.target && e.target.closest ? e.target.closest('button,a,[data-act="seek"]') : null;

		if (target || e.isPrimary === false || state.gesture) return;
		state.gesture = {
			id: e.pointerId,
			x: e.clientX,
			y: e.clientY,
			lastX: e.clientX,
			lastY: e.clientY,
			t: Date.now(),
			held: 0,
			done: 0
		};
		debug('pointer down', { id: e.pointerId, x: e.clientX, y: e.clientY });
		if (root.setPointerCapture) {
			try { root.setPointerCapture(e.pointerId); } catch (e2) {
				warn('pointer capture failed', String(e2 && e2.message || e2));
			}
		}
		if (e.cancelable) e.preventDefault();
		setPreview('toggle');
		queueLongPress();
	}

	function onPointerMove(e){
		let dx = 0;
		let dy = 0;
		let dt = 0;
		let act = '';

		if (!state.gesture || e.pointerId !== state.gesture.id) return;
		state.gesture.lastX = e.clientX;
		state.gesture.lastY = e.clientY;
		dx = e.clientX - state.gesture.x;
		dy = e.clientY - state.gesture.y;
		dt = Date.now() - state.gesture.t;
		act = gestureAction(dx, dy, dt, e.clientX, e.clientY);
		if (Math.abs(dx) > CFG.LONG_PRESS_MOVE_PX || Math.abs(dy) > CFG.LONG_PRESS_MOVE_PX || act === 'next' || act === 'prev') {
			clearLongPressTimer();
			if (!act && state.gesture.held) act = 'fullscreen';
		}
		if (e.cancelable) e.preventDefault();
		setPreview(act);
	}

	function onPointerUp(e){
		let dx = 0;
		let dy = 0;
		let dt = 0;
		let act = '';

		if (!state.gesture || e.pointerId !== state.gesture.id) return;
		dx = e.clientX - state.gesture.x;
		dy = e.clientY - state.gesture.y;
		dt = Date.now() - state.gesture.t;
		act = state.gesture.held ? 'fullscreen' : gestureAction(dx, dy, dt, e.clientX, e.clientY);
		debug('pointer up', { id: e.pointerId, dx: dx, dy: dy, dt: dt, act: act, done: state.gesture.done });
		clearLongPressTimer();
		if (e.cancelable) e.preventDefault();
		releaseGestureCapture();

		if (state.gesture.done) {
			state.gesture = null;
			clearPreview();
			return;
		}

		state.gesture = null;
		clearPreview();

		if (act === 'toggle') {
			togglePlay();
		} else if (act === 'fullscreen') {
			toggleFullscreen();
		} else if (act === 'refresh') {
			refreshPage();
		} else {
			if (act === 'next') onNext();
			else if (act === 'prev') onPrev();
		}
	}
	function onPointerCancel(e){
		if (!state.gesture) return;
		if (e && state.gesture.id != null && e.pointerId !== state.gesture.id) return;
		debug('pointer cancel', { id: state.gesture.id });
		clearLongPressTimer();
		releaseGestureCapture();
		state.gesture = null;
		clearPreview();
	}

	function ensureQualityButton(){
		const extraNode = root.querySelector('.a3m-extra');
		let btn = null;

		if (!extraNode) return;
		btn = extraNode.querySelector('[data-act="quality"]');
		if (!btn) {
			btn = document.createElement('button');
			btn.type = 'button';
			btn.className = 'a3m-mini-btn a3m-text-btn';
			btn.setAttribute('data-act', 'quality');
			extraNode.appendChild(btn);
			log('quality button create');
		}
		state.qualityNode = btn;
	}

	function bindActions(){
		log('bindActions');
		root.addEventListener('click', function(e){
			const el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
			const act = el ? cleanText(el.getAttribute('data-act') || '') : '';

			if (!act) return;
			log('action click', act);
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
			else if (act === 'quality') toggleQuality();
			else if (act === 'refresh') refreshPage();
			else if (act === 'fullscreen') toggleFullscreen();
		});

		progressNode.addEventListener('click', onProgressClick);
		root.addEventListener('pointerdown', onPointerDown);
		root.addEventListener('pointermove', onPointerMove);
		root.addEventListener('pointerup', onPointerUp);
		root.addEventListener('pointercancel', onPointerCancel);
		root.addEventListener('lostpointercapture', onPointerCancel);

		document.addEventListener('fullscreenchange', function(){
			log('fullscreenchange', { active: !!fullscreenElement() });
			updateRoot();
		});
		document.addEventListener('webkitfullscreenchange', function(){
			log('webkitfullscreenchange', { active: !!fullscreenElement() });
			updateRoot();
		});
		document.addEventListener('visibilitychange', function(){
			log('visibilitychange', { hidden: !!document.hidden });
			if (!document.hidden) revivePlayback();
		});
		window.addEventListener('pageshow', function(){
			log('pageshow');
			revivePlayback();
		});
		window.addEventListener('online', function(){
			log('online');
			state.net = 'ok';
			revivePlayback();
		});


		function parseSeekValue(spec, duration, currentTime){
			let s = cleanText(spec || '');
			let sign = 0;
			let n = 0;
			let parts = null;

			duration = isFinite(duration) ? duration : 0;
			currentTime = isFinite(currentTime) ? currentTime : 0;
			if (!s || !isFinite(duration) || duration <= 0) return null;

			if (s.charAt(0) === '+') {
				sign = 1;
				s = cleanText(s.slice(1));
			} else if (s.charAt(0) === '-') {
				sign = -1;
				s = cleanText(s.slice(1));
			}

			if (/^\d+(?:\.\d+)?%$/.test(s)) {
				n = parseFloat(s);
				if (!isFinite(n)) return null;
				n = (n / 100) * duration;
				return clamp(sign ? (currentTime + (n * sign)) : n, 0, duration);
			}

			if (/^\d+:\d{1,2}(?::\d{1,2})?$/.test(s)) {
				parts = s.split(':');
				if (parts.length === 2) {
					n = (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10);
					return clamp(n, 0, duration);
				}
				if (parts.length === 3) {
					n =
						(parseInt(parts[0], 10) * 3600) +
						(parseInt(parts[1], 10) * 60) +
						parseInt(parts[2], 10);
					return clamp(n, 0, duration);
				}
				return null;
			}

			if (/^\d+(?:\.\d+)?$/.test(s)) {
				n = parseFloat(s);
				if (!isFinite(n)) return null;
				return clamp(sign ? (currentTime + (n * sign)) : n, 0, duration);
			}

			return null;
		}

		function seekTo(spec){
			let t = 0;

			if (state.mode !== 'main') return;
			if (!state.mainSlot || !isFinite(state.mainSlot.duration) || state.mainSlot.duration <= 0) return;

			t = parseSeekValue(spec, state.mainSlot.duration, state.mainSlot.currentTime);
			if (!isFinite(t)) return;

			try {
				state.mainSlot.currentTime = t;
				markMainMoved();
			} catch (e) {
				warn('seekTo failed', spec, String(e && e.message || e));
			}
			updateRoot();
		}

		document.addEventListener('keydown', function(e){
			if (e.target && /input|textarea/i.test(String(e.target.tagName || ''))) return;
			debug('keydown', e.key);
			if (e.key === ' ' || e.key === 'e') {
				e.preventDefault();
				togglePlay();
			} else if (e.key === 'ArrowLeft' || e.key === 'a') {
				e.preventDefault();
				onPrev();
			} else if (e.key === 'ArrowRight' || e.key === 'd') {
				e.preventDefault();
				onNext();
			} else if (e.key === 'f') {
				e.preventDefault();
				toggleFullscreen();
			} else if (e.key === 'q') {
				e.preventDefault();
				stopAll(true);
			} else if (e.key === 'r') {
				e.preventDefault();
				refreshPage();
			} else if (e.key === 'b') {
				e.preventDefault();
				toggleQuality();
			} else if (e.key === 'R') {
				e.preventDefault();
				toggleRepeat();
			} else if (e.key === 'A') {
				e.preventDefault();
				seekTo("-10%");
			} else if (e.key === 'D') {
				e.preventDefault();
				seekTo("+10%");
			} else if (e.key === 'S') {
				e.preventDefault();
				toggleShuffle();
			}
		});
	}

	function bindAudio(el){
		log('bindAudio', cleanText(el && el.__a3mName || ''));
		el.addEventListener('canplay', function(){
			log('audio canplay', slotInfo(el));
			if (el === state.mainSlot) {
				markMainMoved();
				if (state.mode === 'main' && state.play === 'play') reviveSlot(el);
			}
			updateRoot();
			if (el === state.nextSlot && state.mode === 'aux') leaveAuxIfPossible();
		});
		el.addEventListener('progress', function(){
			updateRoot();
		});
		el.addEventListener('timeupdate', function(){
			if (el === state.mainSlot) markMainMoved();
			updateRoot();
		});
		el.addEventListener('waiting', function(){
			log('audio waiting', slotInfo(el));
			if (el === state.mainSlot && state.mode === 'main' && state.play === 'play') {
				state.net = 'slow';
				if (!state.mainStallAt) state.mainStallAt = Date.now();
				updateRoot();
			}
		});
		el.addEventListener('stalled', function(){
			log('audio stalled', slotInfo(el));
			if (el === state.mainSlot && state.mode === 'main' && state.play === 'play') {
				state.net = 'slow';
				if (!state.mainStallAt) state.mainStallAt = Date.now();
				updateRoot();
			}
		});
		el.addEventListener('playing', function(){
			log('audio playing', slotInfo(el));
			if (el === state.mainSlot) markMainMoved();
			state.net = 'ok';
			updateRoot();
		});
		el.addEventListener('ended', function(){
			log('audio ended', slotInfo(el));
			if (el === state.mainSlot && state.mode === 'main') onMainEnded();
			else if (el === state.auxSlot && state.mode === 'aux') leaveAuxIfPossible();
		});
		el.addEventListener('error', function(){
			const failedIndex = el === state.nextSlot ? state.nextIndex : -1;
			const target = trackAt(state.nextIndex >= 0 ? state.nextIndex : nextIndex(1, currentIndexBase(), state.mainIndex)) || trackAt(state.index);

			//warn('audio error', { slot: slotInfo(el), failedIndex: failedIndex, target: trackInfo(target) });

			const err = el && el.error;

			warn('audio error', {
				slot: slotInfo(el),
				failedIndex: failedIndex,
				target: trackInfo(target),
				currentSrc: cleanText(el && (el.currentSrc || el.src) || ''),
				networkState: el ? el.networkState : -1,
				readyState: el ? el.readyState : -1,
				error: err ? {
					code: err.code || 0,
					message: cleanText(err.message || '')
				} : null
			});

			if (el === state.mainSlot && state.mode === 'main') {
				if (nextReady(state.nextSlot)) {
					state.net = 'ok';
					swapMainNext();
					return;
				}
				state.net = 'fail';
				enterAux(target);
				scheduleNext();
				return;
			}
			if (el === state.nextSlot && state.nextIndex >= 0) {
				state.net = 'slow';
				resetSlot(state.nextSlot);
				state.nextIndex = -1;
				scheduleNext(currentIndexBase(), failedIndex);
				updateRoot();
			}
		});
	}

function initMediaSession(){
	var Ms = 'mediaSession';
	var ms = null;
	var actions = null;
	var i = 0;

	function errText(e){
		return String(e && e.message || e);
	}

	function setAction(name, fn){
		try {
			ms.setActionHandler(name, fn);
		} catch (e) {
			warn(Ms + ' setAction ' + name + ' failed', errText(e));
		}
	}

	function bindAction(name, fn){
		setAction(name, function(detail){
			log(Ms + ' action', name);
			fn(detail);
		});
	}

	function onSeekTo(detail){
		log(Ms + ' action', {
			type: 'seekto',
			seekTime: detail && detail.seekTime
		});

		if (!detail || !isFinite(detail.seekTime)) return;
		if (!state.mainSlot || state.mode !== 'main') return;

		try {
			state.mainSlot.currentTime = clamp(detail.seekTime, 0, state.mainSlot.duration || detail.seekTime);
			markMainMoved();
		} catch (e) {
			warn(Ms + ' seekto failed', errText(e));
		}

		updateRoot();
	}

	if (!(Ms in navigator)) {
		log(Ms + ' unsupported');
		return;
	}

	ms = navigator[Ms];
	log(Ms + ' init');

	actions = [
		['play', togglePlay],
		['pause', pauseMain],
		['nexttrack', onNext],
		['previoustrack', onPrev],
		['seekto', onSeekTo]
	];

	for (i = 0; i < actions.length; i++) {
		bindAction(actions[i][0], actions[i][1]);
	}
}

function setFavicon(url){
	let el = document.querySelector('link[rel="icon"]');
	if (!el) {
		el = document.createElement('link');
		el.rel = 'icon';
		document.head.appendChild(el);
	}
	el.href = url;
}

function faviconArt(){
	const svg = '' +
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">' +
		'<rect width="1024" height="1024" fill="#220022"/>' +
		'<text x="512" y="560" text-anchor="middle" dominant-baseline="middle"' +
			' font-family="Arial, sans-serif" font-size="450" font-weight="700" letter-spacing="6"' +
			' fill="#ffffff" opacity="1">A3M</text>' +
		'</svg>';

	return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

function bootstrap(){
		let quality = '';

		resetSession();
		loadSession();
		if (state.more)
			queueMoreHide();

		log('bootstrap start', { playlistSrc: playlistSrc, href: window.location.href });
		state.calmArt = calmArt()
		setFavicon(faviconArt());

		state.calmBlob = calmWaveBlob();
		setVar('--a3m-calm-url', imageVar(state.calmArt));

		svgToPngUrl(state.calmArt, 512).then(function(pngUrl){
			state.calmArtPng = cleanText(pngUrl || '');
			log('bootstrap calm png', { ok: !!state.calmArtPng, bytes: state.calmArtPng.length });
			refreshMediaArtwork();
		});

		state.mainSlot = slot('main');
		state.nextSlot = slot('next');
		state.auxSlot = slot('aux');

		state.auxSlot.src = state.calmBlob;
		state.auxSlot.loop = true;
		state.auxSlot.preload = 'auto';
		state.auxSlot.load();
		log('bootstrap aux slot seeded', slotInfo(state.auxSlot));

		ensureQualityButton();
		bindAudio(state.mainSlot);
		bindAudio(state.nextSlot);
		bindAudio(state.auxSlot);
		bindActions();
		initMediaSession();
		tickProgress();

		fetchPlaylist().then(function(list){
			log('bootstrap playlist ready', { count: list.length });
			if (!list || !list.length) throw new Error('playlist empty');
			state.list = list;

			state.repeat = state.repeat ? 1 : 0;
			state.shuffle = state.shuffle ? 1 : 0;

			quality = cleanText(state.quality || 'norm');
			if (quality !== 'low' && quality !== 'hi') quality = 'norm';
			state.quality = quality;

			state.index = normalizeIndex(state.index);
			if (state.index < 0) state.index = 0;

			loadMain(state.index, state.play === 'play' || state.play === 1)
			updateRoot();
			logState('bootstrap ready');
		}).catch(function(err){
			warn('bootstrap failed', String(err && err.message || err));
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

	window.addEventListener('pagehide', function(){
		clearMoreTimer();
		saveSession();
	});



	bootstrap();
})();
