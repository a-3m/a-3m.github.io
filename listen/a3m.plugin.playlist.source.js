/* file: a3m.plugin.playlist.source.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log, err } = a3m.logp('playlist.source');

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function copyTrack(track){
		track = track || {};

		return {
			src: cleanText(track.src || track.url || track.href || ''),
			title: cleanText(track.title || ''),
			artist: cleanText(track.artist || ''),
			album: cleanText(track.album || ''),
			cover: cleanText(track.cover || '')
		};
	}

	function copyMeta(meta){
		const out = {};
		let k = '';

		meta = meta || {};

		for (k in meta) {
			if (!Object.prototype.hasOwnProperty.call(meta, k)) continue;
			out[k] = meta[k];
		}

		return out;
	}

	function clampIndex(index, count){
		index = parseInt(index, 10);

		if (!count) return -1;
		if (!isFinite(index)) index = 0;
		if (index < 0) index = 0;
		if (index >= count) index = count - 1;

		return index;
	}

	function normalizeRepeat(mode){
		mode = cleanText(mode).toLowerCase();
		return /^(none|one|all)$/.test(mode) ? mode : 'none';
	}

	function nextRepeat(mode){
		mode = normalizeRepeat(mode);
		if (mode === 'none') return 'one';
		if (mode === 'one') return 'all';
		return 'none';
	}

	function safeUrl(base, rel){
		let url = null;
		let parts = [];
		let i = 0;

		try {
			url = new URL(String(rel || ''), String(base || window.location.href));
			parts = url.pathname.split('/');

			for (i = 0; i < parts.length; i++) {
				if (!parts[i]) continue;

				try {
					parts[i] = encodeURIComponent(decodeURIComponent(parts[i]));
				} catch (e) {
					parts[i] = encodeURIComponent(parts[i]);
				}
			}

			url.pathname = parts.join('/');

			return String(url);
		} catch (e) {
			return cleanText(rel || '');
		}
	}

	function pathExt(path){
		const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(cleanText(path));
		return m ? m[1].toLowerCase() : '';
	}

	function stemPath(path){
		return cleanText(path).replace(/[?#].*$/, '').replace(/\.[^.\/]+$/, '');
	}

	function isAudioPath(path, exts){
		return exts.indexOf(pathExt(path)) >= 0;
	}

	function isCoverPath(path, exts){
		return exts.indexOf(pathExt(path)) >= 0;
	}

	function isDirectSource(path){
		path = cleanText(path);
		return /^(?:a3ms|test):\/\//i.test(path);
	}

	function basenameTitle(path){
		path = String(path == null ? '' : path)
			.replace(/[?#].*$/, '')
			.replace(/^.*\//, '')
			.replace(/\.[^.]+$/, '');

		return cleanText(path);
	}

	function decodeValue(s){
		s = String(s == null ? '' : s);

		try {
			return decodeURIComponent(s);
		} catch (e) {
			return s;
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

	function defaultA3msTitle(desc){
		const labels = [];
		let i = 0;
		let used = 0;
		let title = '';

		desc = desc || {};
		desc.channels = Array.isArray(desc.channels) ? desc.channels : [];

		for (i = 0; i < desc.cc; i++) {
			if (!desc.channels[i] || !desc.channels[i].gen) continue;
			used++;
			if (labels.length < 2) labels.push(a3msChannelLabel(desc.channels[i]));
		}

		title = labels.join(' / ');
		if (!title) title = 'A3MS Synth';
		if (used > labels.length) title += ' / ...';
		if (used > 1) title += ' · ' + used + 'ch';

		return cleanText(title || 'A3MS Synth');
	}

	function parseA3msDescribe(src){
		const raw = String(src || '').replace(/^a3ms:\/\//i, '');
		const tokens = raw.split('+');
		const out = {
			cc: 2,
			meta: {},
			channels: [
				{ gen: null },
				{ gen: null },
				{ gen: null },
				{ gen: null }
			]
		};
		let cur = 0;
		let tok = '';
		let m = null;
		let key = '';
		let i = 0;

		for (i = 0; i < tokens.length; i++) {
			tok = cleanText(tokens[i]);
			if (!tok) continue;

			if (/^c$/i.test(tok)) {
				cur = Math.min(3, cur + 1);
				continue;
			}

			m = /^cc\s*=\s*(.+)$/i.exec(tok);
			if (m) {
				out.cc = Math.max(1, Math.min(4, parseInt(m[1], 10) || 2));
				continue;
			}

			m = /^m:([a-z0-9_]+)\s*=\s*(.*)$/i.exec(tok);
			if (m) {
				key = cleanText(m[1]).toLowerCase();
				if (key) out.meta[key] = cleanText(decodeValue(m[2]));
				continue;
			}

			m = /^sin(?:\s*=\s*|\s+)(.+)$/i.exec(tok);
			if (m) {
				out.channels[cur].gen = {
					type: 'sin',
					freq: cleanText(m[1]).toLowerCase() === 'rnd' ? 'rnd' : cleanText(m[1])
				};
				continue;
			}

			m = /^noise(?:\s*=\s*|\s+)(.+)$/i.exec(tok);
			if (m) {
				out.channels[cur].gen = {
					type: 'noise',
					noise: cleanText(m[1]).toLowerCase() || 'white'
				};
				continue;
			}

			if (/^(white|pink|brown)$/i.test(tok)) {
				out.channels[cur].gen = {
					type: 'noise',
					noise: cleanText(tok).toLowerCase()
				};
			}
		}

		return {
			title: cleanText(out.meta.title || defaultA3msTitle(out)),
			artist: cleanText(out.meta.artist || ''),
			album: cleanText(out.meta.album || ''),
			cover: cleanText(out.meta.cover || '')
		};
	}

	function directTrackTitle(src){
		src = cleanText(src);

		if (/^a3ms:\/\//i.test(src)) return parseA3msDescribe(src).title;
		if (/^test:\/\/sin/i.test(src)) return 'Sine Test';

		return src;
	}

	function defaultDirectTrack(src){
		const a3ms = /^a3ms:\/\//i.test(cleanText(src)) ? parseA3msDescribe(src) : null;

		return {
			src: cleanText(src),
			title: cleanText(a3ms ? a3ms.title : directTrackTitle(src)),
			artist: cleanText(a3ms ? a3ms.artist : ''),
			album: cleanText(a3ms ? a3ms.album : ''),
			cover: cleanText(a3ms ? a3ms.cover : '')
		};
	}

	function normalizeTrackList(tracks){
		const out = [];
		let i = 0;
		let track = null;

		tracks = Array.isArray(tracks) ? tracks : [];

		for (i = 0; i < tracks.length; i++) {
			track = copyTrack(tracks[i]);
			if (!track.src) continue;
			out.push(track);
		}

		return out;
	}

	function parsePlaylistText(text, baseUrl, audioExts, coverExts){
		const lines = String(text == null ? '' : text).split(/\r?\n/);
		const covers = {};
		const out = [];
		let line = '';
		let src = '';
		let stem = '';
		let i = 0;

		for (i = 0; i < lines.length; i++) {
			line = cleanText(lines[i]);
			if (!line || line.charAt(0) === '#') continue;

			if (isDirectSource(line)) {
				out.push(defaultDirectTrack(line));
				continue;
			}

			stem = stemPath(line);

			if (isCoverPath(line, coverExts)) {
				src = safeUrl(baseUrl, line);
				if (src) covers[stem] = src;
				continue;
			}

			if (!isAudioPath(line, audioExts)) continue;

			src = safeUrl(baseUrl, line);
			if (!src) continue;

			out.push({
				src: src,
				title: basenameTitle(line),
				artist: '',
				album: '',
				cover: '',
				__stem: stem
			});
		}

		for (i = 0; i < out.length; i++) {
			if (covers[out[i].__stem]) out[i].cover = covers[out[i].__stem];
			delete out[i].__stem;
		}

		return out;
	}

	function stripPlaylistMeta(meta){
		meta = copyMeta(meta);

		delete meta.sourceKind;
		delete meta.playlistIndex;
		delete meta.playlistCount;
		delete meta.playlistHasNext;
		delete meta.playlistHasPrev;
		delete meta.playlistRepeat;
		delete meta.playlistShuffle;
		delete meta.playlistSrc;

		return meta;
	}

	function PluginPlaylistSource(opts){
		this.options = opts || {};
	}

	PluginPlaylistSource.prototype.attach = function(ctx){
		const bus = ctx.bus;
		const off = [];
		const audioExts = Array.isArray(this.options.exts) && this.options.exts.length
			? this.options.exts.map(function(v){ return cleanText(v).toLowerCase(); }).filter(Boolean)
			: [ 'flac', 'mp3', 'ogg', 'opus', 'm4a', 'aac', 'wav', 'aif', 'aiff' ];
		const coverExts = Array.isArray(this.options.coverExts) && this.options.coverExts.length
			? this.options.coverExts.map(function(v){ return cleanText(v).toLowerCase(); }).filter(Boolean)
			: [ 'jpg', 'jpeg', 'png', 'svg', 'webp' ];

		let tracks = [];
		let index = -1;
		let shuffle = false;
		let repeat = 'none';
		let playlistSrc = '';
		let history = [];

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function currentTrack(){
			return index >= 0 && index < tracks.length ? tracks[index] : null;
		}

		function resetHistory(){
			history = [];
		}

		function pushHistory(prevIndex, nextIndex){
			prevIndex = parseInt(prevIndex, 10);
			nextIndex = parseInt(nextIndex, 10);

			if (!tracks.length) return;
			if (!isFinite(prevIndex) || prevIndex < 0 || prevIndex >= tracks.length) return;
			if (isFinite(nextIndex) && prevIndex === nextIndex) return;

			history.push(prevIndex);
		}

		function popHistory(){
			let prev = -1;

			while (history.length) {
				prev = parseInt(history.pop(), 10);
				if (!isFinite(prev) || prev < 0 || prev >= tracks.length) continue;
				if (prev === index && tracks.length > 1) continue;
				return prev;
			}

			return -1;
		}

		function hasNext(){
			if (!tracks.length || index < 0) return false;
			if (shuffle) return tracks.length > 1 || repeat !== 'none';
			if (repeat === 'all') return true;
			if (repeat === 'one') return true;
			return index < tracks.length - 1;
		}

		function hasPrev(){
			if (!tracks.length || index < 0) return false;
			if (shuffle) return history.length > 0;
			if (repeat === 'all') return true;
			if (repeat === 'one') return true;
			return index > 0;
		}

		function patchMeta(meta){
			meta = stripPlaylistMeta(meta);

			if (!tracks.length) return meta;

			meta.sourceKind = 'playlist';
			meta.playlistIndex = index;
			meta.playlistCount = tracks.length;
			meta.playlistHasNext = hasNext() ? 1 : 0;
			meta.playlistHasPrev = hasPrev() ? 1 : 0;
			meta.playlistRepeat = repeat;
			meta.playlistShuffle = shuffle ? 1 : 0;
			meta.playlistSrc = playlistSrc;

			return meta;
		}

		function syncStateMeta(){
			ctx.setState({
				meta: patchMeta(ctx.getState().meta)
			});
		}

		function emitPlaylist(reason){
			bus.emit('evt:playlist', {
				reason: cleanText(reason || ''),
				index: index,
				count: tracks.length,
				shuffle: shuffle,
				repeat: repeat,
				src: playlistSrc,
				track: currentTrack() ? copyTrack(currentTrack()) : null
			});
		}

		function emitError(message){
			bus.emit('evt:error', {
				message: cleanText(message || 'Playlist error')
			});
		}

		function resolveAutoplay(detail){
			if (detail && detail.autoplay != null) return !!detail.autoplay;
			return !!ctx.getState().playing;
		}

		function isAutoAdvance(detail){
			return !!(detail && (detail.via === 'autonext' || detail.ended));
		}

		function randomIndex(exclude){
			let next = exclude;
			let n = 0;

			if (tracks.length <= 1) return exclude < 0 ? 0 : exclude;

			while (next === exclude && n < 32) {
				next = Math.floor(Math.random() * tracks.length);
				n++;
			}

			if (next === exclude) next = (exclude + 1) % tracks.length;

			return next;
		}

		function resolveNextIndex(step, detail){
			let next = index;

			if (!tracks.length) return -1;

			if (shuffle) {
				if (step < 0) return popHistory();

				if (tracks.length <= 1) return index < 0 ? 0 : index;
				if (isAutoAdvance(detail) && repeat === 'one') return index;

				return randomIndex(index);
			}

			if (step < 0) {
				next = index - 1;
				if (next < 0) {
					if (repeat === 'all') return tracks.length - 1;
					if (repeat === 'one') return index;
					return -1;
				}
				return next;
			}

			next = index + 1;

			if (next >= tracks.length) {
				if (repeat === 'all') return 0;
				if (repeat === 'one') return index;
				return -1;
			}

			return next;
		}

		function loadCurrent(detail){
			const track = currentTrack();

			if (!track) return false;

			syncStateMeta();
			emitPlaylist('load');

			ctx.command('cmd:load', {
				source: track.src,
				src: track.src,
				track: copyTrack(track),
				autoplay: !!(detail && detail.autoplay)
			});

			return true;
		}

		function setPlaylist(nextTracks, nextIndex, detail){
			tracks = normalizeTrackList(nextTracks);
			index = clampIndex(nextIndex, tracks.length);
			resetHistory();

			if (!tracks.length) {
				syncStateMeta();
				emitError('Playlist empty');
				return;
			}

			if (detail && detail.shuffle != null) shuffle = !!detail.shuffle;
			if (detail && (detail.repeat != null || detail.mode != null)) {
				repeat = normalizeRepeat(detail.repeat != null ? detail.repeat : detail.mode);
			}
			if (detail && detail.startRandom && shuffle) {
				index = randomIndex(-1);
			}

			log('set', {
				count: tracks.length,
				index: index,
				shuffle: shuffle,
				repeat: repeat,
				src: playlistSrc
			});

			loadCurrent({
				autoplay: resolveAutoplay(detail || {})
			});
		}

		function move(step, detail){
			const prev = index;
			const next = resolveNextIndex(step, detail);

			if (!tracks.length) return false;
			if (next < 0) {
				syncStateMeta();
				return true;
			}

			if (shuffle && step > 0 && next !== prev) pushHistory(prev, next);

			index = next;

			return loadCurrent({
				autoplay: resolveAutoplay(detail || {})
			});
		}

		function setShuffle(detail){
			const prevShuffle = shuffle;

			if (detail && detail.shuffle != null) shuffle = !!detail.shuffle;
			else shuffle = !shuffle;

			if (shuffle !== prevShuffle) resetHistory();

			syncStateMeta();
			emitPlaylist('shuffle');
		}

		function setRepeat(detail){
			if (detail && detail.cycle) repeat = nextRepeat(repeat);
			else if (detail && (detail.repeat != null || detail.mode != null)) {
				repeat = normalizeRepeat(detail.repeat != null ? detail.repeat : detail.mode);
			} else {
				repeat = nextRepeat(repeat);
			}

			syncStateMeta();
			emitPlaylist('repeat');
		}

		function updateCurrentTrackFromState(){
			const state = ctx.getState();
			const track = state.currentTrack ? copyTrack(state.currentTrack) : null;
			const meta = state.meta || {};
			const cur = currentTrack();
			let changed = false;

			if (!cur || !track || !track.src) return;
			if (cleanText(cur.src) !== cleanText(track.src)) return;

			if (track.title && cur.title !== track.title) {
				cur.title = track.title;
				changed = true;
			} else if (cleanText(meta.title) && cur.title !== cleanText(meta.title)) {
				cur.title = cleanText(meta.title);
				changed = true;
			}

			if (track.artist && cur.artist !== track.artist) {
				cur.artist = track.artist;
				changed = true;
			} else if (cleanText(meta.artist) && cur.artist !== cleanText(meta.artist)) {
				cur.artist = cleanText(meta.artist);
				changed = true;
			}

			if (track.album && cur.album !== track.album) {
				cur.album = track.album;
				changed = true;
			} else if (cleanText(meta.album) && cur.album !== cleanText(meta.album)) {
				cur.album = cleanText(meta.album);
				changed = true;
			}

			if (track.cover && cur.cover !== track.cover) {
				cur.cover = track.cover;
				changed = true;
			} else if (cleanText(meta.cover) && cur.cover !== cleanText(meta.cover)) {
				cur.cover = cleanText(meta.cover);
				changed = true;
			}

			if (changed) emitPlaylist('track-update');
		}

		function loadPlaylistFromUrl(detail){
			const src = cleanText(detail && (detail.src || detail.source) || '');
			const url = safeUrl(window.location.href, src);
			const nextIndex = detail && detail.index != null ? detail.index : 0;

			if (!src) {
				emitError('Playlist source missing');
				return;
			}

			playlistSrc = url;

			if (detail && detail.shuffle != null) shuffle = !!detail.shuffle;
			if (detail && (detail.repeat != null || detail.mode != null)) {
				repeat = normalizeRepeat(detail.repeat != null ? detail.repeat : detail.mode);
			}

			log('load', url);

			fetch(url, {
				credentials: 'same-origin'
			}).then(function(res){
				if (!res || !res.ok) {
					throw new Error('Playlist fetch failed #' + (res ? res.status : '?'));
				}
				return res.text();
			}).then(function(text){
				setPlaylist(
					parsePlaylistText(text, url, audioExts, coverExts),
					nextIndex,
					{
						autoplay: resolveAutoplay(detail || {}),
						shuffle: shuffle,
						repeat: repeat,
						startRandom: !!(detail && detail.startRandom)
					}
				);
			}).catch(function(e){
				err('load failed', e);
				emitError(e && e.message || 'Playlist load failed');
			});
		}

		listen('cmd:playlist-load', function(detail){
			loadPlaylistFromUrl(detail);
		});

		listen('cmd:playlist-set', function(detail){
			playlistSrc = cleanText(detail && detail.src || playlistSrc || '');
			setPlaylist(
				detail && detail.tracks,
				detail && detail.index,
				{
					autoplay: resolveAutoplay(detail || {}),
					shuffle: detail && detail.shuffle,
					repeat: detail && (detail.repeat != null ? detail.repeat : detail && detail.mode),
					startRandom: !!(detail && detail.startRandom)
				}
			);
		});

		listen('cmd:playlist-shuffle', function(detail){
			if (!tracks.length) return;
			setShuffle(detail || {});
		});

		listen('cmd:playlist-repeat', function(detail){
			if (!tracks.length) return;
			setRepeat(detail || {});
		});

		listen('cmd:next', function(detail){
			if (!tracks.length) return;
			move(1, detail || {});
		});

		listen('cmd:prev', function(detail){
			if (!tracks.length) return;
			move(-1, detail || {});
		});

		listen('evt:meta', function(){
			if (!tracks.length) return;
			updateCurrentTrackFromState();
			syncStateMeta();
		});

		return function(){
			let i = 0;

			for (i = 0; i < off.length; i++) off[i]();
		};
	};

	a3m.PluginPlaylistSource = PluginPlaylistSource;
})();