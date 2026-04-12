/* file: a3m.plugin.mediasession.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log, err } = a3m.logp('mediasession');

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function clamp(n, a, b){
		n = parseFloat(n);
		if (!isFinite(n)) n = a;
		return Math.min(b, Math.max(a, n));
	}

	function mediaTrack(state){
		const meta = state && state.meta ? state.meta : {};
		const track = state && state.currentTrack ? state.currentTrack : null;

		return {
			title: cleanText(track && track.title || meta.title || state && state.currentSource || ''),
			artist: cleanText(track && track.artist || meta.artist || ''),
			album: cleanText(track && track.album || meta.album || ''),
			cover: cleanText(track && track.cover || meta.cover || ''),
			cover512: cleanText(meta.cover512 || ''),
			cover256: cleanText(meta.cover256 || '')
		};
	}

	function mimeFromSrc(src){
		src = cleanText(src).replace(/[?#].*$/, '');

		if (/\.png$/i.test(src)) return 'image/png';
		if (/\.jpe?g$/i.test(src)) return 'image/jpeg';
		if (/\.webp$/i.test(src)) return 'image/webp';
		if (/\.svg$/i.test(src)) return 'image/svg+xml';

		return '';
	}

	function artworkList(track){
		const out = [];
		const seen = {};

		function add(src, sizes){
			const mime = mimeFromSrc(src);
			const item = {
				src: cleanText(src),
				sizes: sizes
			};

			if (!item.src || seen[item.src]) return;

			seen[item.src] = 1;

			if (mime) item.type = mime;

			out.push(item);
		}

		add(track.cover256, '256x256');
		add(track.cover512, '512x512');
		add(track.cover, '1024x1024');

		return out;
	}

	function PluginMediaSession(opts){
		this.options = opts || {};
	}

	PluginMediaSession.prototype.attach = function(ctx){
		const bus = ctx.bus;
		const off = [];
		let lastMetaKey = '';
		let lastPlaybackKey = '';
		let lastPositionKey = '';
		let lastPositionLogSec = -1;

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function setHandler(name, fn){
			try {
				navigator.mediaSession.setActionHandler(name, fn);
			} catch (e) {}
		}

		function metaKey(track){
			return [
				track.title,
				track.artist,
				track.album,
				track.cover,
				track.cover512,
				track.cover256
			].join('\n');
		}

		function syncMetadata(reason){
			const state = ctx.getState();
			const track = mediaTrack(state);
			const artwork = artworkList(track);
			const key = metaKey(track);

			if (!('mediaSession' in navigator)) return;
			if (key === lastMetaKey) return;

			lastMetaKey = key;

			if (!track.title) {
				navigator.mediaSession.metadata = null;
				log('metadata clear', reason || '');
				return;
			}

			try {
				navigator.mediaSession.metadata = new MediaMetadata({
					title: track.title,
					artist: track.artist,
					album: track.album,
					artwork: artwork
				});
				log('metadata set', {
					reason: reason || '',
					title: track.title,
					artist: track.artist,
					album: track.album,
					cover: artwork.length ? 'yes' : 'no'
				});
			} catch (e) {
				err('metadata failed', e);
			}
		}

		function syncPlayback(reason){
			const state = ctx.getState();
			const key = state.playing ? 'playing' : 'paused';

			if (!('mediaSession' in navigator)) return;
			if (key === lastPlaybackKey) return;

			lastPlaybackKey = key;

			try {
				navigator.mediaSession.playbackState = key;
				log('playbackState', {
					reason: reason || '',
					state: key
				});
			} catch (e) {}
		}

		function syncPosition(reason){
			const state = ctx.getState();
			const pos = clamp(state.position, 0, isFinite(state.duration) ? state.duration : 0);
			const sec = Math.floor(pos);
			const key = [
				isFinite(state.duration) ? state.duration.toFixed(3) : '0.000',
				pos.toFixed(3)
			].join('|');

			if (!('mediaSession' in navigator)) return;
			if (!isFinite(state.duration) || state.duration <= 0) return;
			if (key === lastPositionKey) return;

			lastPositionKey = key;

			try {
				navigator.mediaSession.setPositionState({
					duration: state.duration,
					playbackRate: 1,
					position: pos
				});

				if (reason || sec !== lastPositionLogSec) {
					lastPositionLogSec = sec;
					log("positionState: ...");
/*					log('positionState', {
						reason: reason || '',
						position: pos,
						duration: state.duration
					});
*/
				}
			} catch (e) {}
		}

		if (!('mediaSession' in navigator)) {
			log('not available');
			return function(){};
		}

		listen('evt:meta', function(){
			syncMetadata('evt:meta');
			syncPlayback('evt:meta');
			syncPosition('evt:meta');
		});

		listen('evt:play', function(){
			syncPlayback('evt:play');
			syncPosition('evt:play');
		});

		listen('evt:pause', function(){
			syncPlayback('evt:pause');
			syncPosition('evt:pause');
		});

		listen('evt:ready', function(){
			syncPosition('evt:ready');
		});

		listen('evt:time', function(){
			syncPosition('');
		});

		setHandler('play', function(){
			log('action play');
			ctx.command('cmd:play', {});
		});

		setHandler('pause', function(){
			log('action pause');
			ctx.command('cmd:pause', {});
		});

		setHandler('stop', function(){
			log('action stop');
			ctx.command('cmd:stop', {});
		});

		setHandler('nexttrack', function(){
			log('action nexttrack');
			ctx.command('cmd:next', {});
		});

		setHandler('previoustrack', function(){
			log('action previoustrack');
			ctx.command('cmd:prev', {});
		});

		setHandler('seekto', function(detail){
			const pos = detail && typeof detail.seekTime === 'number'
				? detail.seekTime
				: NaN;

			if (!isFinite(pos)) return;

			log('action seekto', pos);
			ctx.command('cmd:seek', {
				position: pos
			});
		});

		syncMetadata('attach');
		syncPlayback('attach');
		syncPosition('attach');

		return function(){
			let i = 0;
			const names = [ 'play', 'pause', 'stop', 'nexttrack', 'previoustrack', 'seekto' ];

			for (i = 0; i < off.length; i++) off[i]();
			for (i = 0; i < names.length; i++) setHandler(names[i], null);
		};
	};

	a3m.PluginMediaSession = PluginMediaSession;
})();
