/* file: a3m.plugin.meta.file.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log, debug, warn } = a3m.logp('meta.file');

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function copyTrack(track){
		track = track || {};

		return {
			src: cleanText(track.src || ''),
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

	function metaKey(key){
		key = cleanText(key).toLowerCase();
		key = key.replace(/^tag:/, '');
		return key;
	}

	function normalizeMetaAliases(meta){
		meta = meta || {};

		if (Object.prototype.hasOwnProperty.call(meta, 'track') && !Object.prototype.hasOwnProperty.call(meta, 'tracknum')) {
			meta.tracknum = meta.track;
		}

		return meta;
	}

	function metaSrcFromAudioSrc(src){
		src = String(src || '');

		if (/(\.[^./?#]+)([?#].*)?$/.test(src)) {
			return src.replace(/(\.[^./?#]+)([?#].*)?$/, '.meta$2');
		}

		return src.replace(/([?#].*)?$/, '.meta$1');
	}

	function isRealSource(src){
		src = cleanText(src);
		if (!src) return false;
		if (/^test:\/\//i.test(src)) return false;
		if (/^a3ms:\/\//i.test(src)) return false;
		return true;
	}

	function parseMetaText(text){
		const meta = {};
		const lines = String(text == null ? '' : text).split(/\r?\n/);
		let line = '';
		let key = '';
		let val = '';
		let pos = 0;
		let i = 0;

		for (i = 0; i < lines.length; i++) {
			line = String(lines[i] == null ? '' : lines[i]).trim();
			if (!line) continue;
			if (line.charAt(0) === '#' || line.charAt(0) === ';') continue;

			pos = line.indexOf('=');
			if (pos < 0) continue;

			key = metaKey(line.slice(0, pos));
			if (!key) continue;

			val = line.slice(pos + 1).trim();
			meta[key] = val;
		}

		return normalizeMetaAliases(meta);
	}

	function mergeTrackFromMeta(track, meta){
		track = copyTrack(track);
		meta = meta || {};

		if (Object.prototype.hasOwnProperty.call(meta, 'title')) track.title = cleanText(meta.title);
		if (Object.prototype.hasOwnProperty.call(meta, 'artist')) track.artist = cleanText(meta.artist);
		if (Object.prototype.hasOwnProperty.call(meta, 'album')) track.album = cleanText(meta.album);
		if (Object.prototype.hasOwnProperty.call(meta, 'cover')) track.cover = cleanText(meta.cover);

		return track;
	}

	function githubReleaseAssetInfo(url){
		const m = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/releases\/download\/([^\/]+)\/([^?#]+)(?:[?#].*)?$/i.exec(cleanText(url));

		if (!m) return null;

		return {
			owner: decodeURIComponent(m[1]),
			repo: decodeURIComponent(m[2]),
			tag: decodeURIComponent(m[3]),
			name: decodeURIComponent(m[4])
		};
	}

	function githubApiUrl(s){
		return String(s == null ? '' : s)
			.split('/')
			.map(function(v){ return encodeURIComponent(v); })
			.join('/');
	}

	function fetchText(url){
		return fetch(url, {
			credentials: 'same-origin'
		}).then(function(res){
			if (!res || !res.ok) {
				if (res && res.status === 404) return '';
				throw new Error('meta fetch failed #' + (res ? res.status : '?'));
			}
			return res.text();
		});
	}

	function fetchGithubReleaseBodyText(metaSrc){
		const info = githubReleaseAssetInfo(metaSrc);
		const api = info
			? 'https://api.github.com/repos/' + githubApiUrl(info.owner) + '/' + githubApiUrl(info.repo) +
				'/releases/tags/' + encodeURIComponent(info.tag)
			: '';

		if (!info) return Promise.reject(new Error('not a GitHub release asset'));

		debug('github release body', api);

		return fetch(api, {
			credentials: 'omit',
			headers: {
				Accept: 'application/vnd.github+json'
			}
		}).then(function(res){
			if (!res || !res.ok) {
				throw new Error('github release api failed #' + (res ? res.status : '?'));
			}
			return res.json();
		}).then(function(json){
			return String(json && json.body || '');
		});
	}

	function fetchMetaText(metaSrc){
		return fetchText(metaSrc).catch(function(e){
			if (!githubReleaseAssetInfo(metaSrc)) throw e;

			debug('direct failed, try github release body', metaSrc, e && e.message || e);
			return fetchGithubReleaseBodyText(metaSrc);
		});
	}

	function PluginMetaFile(opts){
		this.options = opts || {};
	}

	PluginMetaFile.prototype.attach = function(ctx){
		const bus = ctx.bus;
		const off = [];
		let reqId = 0;

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function applyMeta(src, metaSrc, parsed, myReq){
			const state = ctx.getState();
			const meta = copyMeta(state.meta);
			const track = mergeTrackFromMeta(state.currentTrack, parsed);
			let key = '';

			if (myReq !== reqId) {
				debug('stale req', metaSrc);
				return;
			}

			if (cleanText(state.currentSource) !== cleanText(src)) {
				debug('stale src', src);
				return;
			}

			for (key in parsed) {
				if (!Object.prototype.hasOwnProperty.call(parsed, key)) continue;
				meta[key] = parsed[key];
				log('meta parsed: ' + key + '=' + parsed[key]);
			}

			ctx.setState({
				currentTrack: track,
				meta: meta
			});

			bus.emit('evt:meta', {
				source: src,
				src: src,
				track: track,
				meta: meta
			});

			log('apply', metaSrc, Object.keys(parsed).length + ' keys');
		}

		function loadMetaForSource(src){
			const myReq = ++reqId;
			const metaSrc = metaSrcFromAudioSrc(src);

			if (!isRealSource(src)) return;

			debug('load', metaSrc);

			fetchMetaText(metaSrc).then(function(text){
				const parsed = parseMetaText(text);

				if (!text) return;

				debug('parsed', metaSrc, Object.keys(parsed).length + ' keys');
				applyMeta(src, metaSrc, parsed, myReq);
			}).catch(function(e){
				if (myReq !== reqId) return;
				warn('meta load failed', metaSrc, e && e.message || e);
			});
		}

		listen('evt:load', function(detail){
			const src = cleanText(detail && (detail.source || detail.src) || '');

			loadMetaForSource(src);
		});

		return function(){
			let i = 0;

			reqId++;

			for (i = 0; i < off.length; i++) off[i]();
		};
	};

	a3m.PluginMetaFile = PluginMetaFile;
})();