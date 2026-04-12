/* file: a3m.boot.example.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log, debug, warn, err } = a3m.logp('boot.example');

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function boolValue(s, fallback){
		s = cleanText(s).toLowerCase();
		if (!s) return !!fallback;
		if (/^(0|false|off|no)$/.test(s)) return false;
		if (/^(1|true|on|yes)$/.test(s)) return true;
		return !!fallback;
	}

	function clamp(n, a, b){
		n = parseFloat(n);
		if (!isFinite(n)) n = a;
		return Math.min(b, Math.max(a, n));
	}

	function parseIndex(v, fallback){
		v = parseInt(v, 10);
		if (!isFinite(v)) return fallback;
		return Math.max(0, v);
	}

	function fmtTime(n){
		n = isFinite(n) && n > 0 ? Math.floor(n) : 0;
		const m = Math.floor(n / 60);
		const s = n % 60;
		const h = Math.floor(m / 60);
		const mm = h ? String(m % 60).padStart(2, '0') : String(m);
		const ss = String(s).padStart(2, '0');
		return h ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
	}

	function cssString(s){
		return JSON.stringify(String(s == null ? '' : s));
	}

	function setText(node, text){
		text = String(text == null ? '' : text);
		if (node && node.textContent !== text) node.textContent = text;
	}

	function setValue(node, value){
		value = String(value == null ? '' : value);
		if (node && node.value !== value) node.value = value;
	}

	function setAttr(node, name, value){
		value = String(value == null ? '' : value);
		if (node && node.getAttribute(name) !== value) node.setAttribute(name, value);
	}

	function setStyleVar(node, name, value){
		value = String(value == null ? '' : value);
		if (node && node.style.getPropertyValue(name) !== value) {
			node.style.setProperty(name, value);
		}
	}

	function fullscreenElement(){
		return (
			document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.mozFullScreenElement ||
			document.msFullscreenElement ||
			null
		);
	}

	function requestFullscreen(node){
		if (!node) return Promise.reject(new Error('Fullscreen node missing'));
		if (typeof node.requestFullscreen === 'function') return node.requestFullscreen();
		if (typeof node.webkitRequestFullscreen === 'function') return node.webkitRequestFullscreen();
		if (typeof node.mozRequestFullScreen === 'function') return node.mozRequestFullScreen();
		if (typeof node.msRequestFullscreen === 'function') return node.msRequestFullscreen();
		return Promise.reject(new Error('Fullscreen not supported'));
	}

	function exitFullscreen(){
		if (typeof document.exitFullscreen === 'function') return document.exitFullscreen();
		if (typeof document.webkitExitFullscreen === 'function') return document.webkitExitFullscreen();
		if (typeof document.mozCancelFullScreen === 'function') return document.mozCancelFullScreen();
		if (typeof document.msExitFullscreen === 'function') return document.msExitFullscreen();
		return Promise.reject(new Error('Fullscreen exit not supported'));
	}

	function stateText(state){
		const meta = state.meta || {};
		const lines = [];
		const playlistCount = parseInt(meta.playlistCount, 10);
		const playlistIndex = parseInt(meta.playlistIndex, 10);

		lines.push('source: ' + (state.currentSource || '-'));
		lines.push('sourceKind: ' + cleanText(meta.sourceKind || ''));
		lines.push('playing: ' + (state.playing ? 'yes' : 'no'));
		lines.push('ready: ' + (state.ready ? 'yes' : 'no'));
		lines.push('position: ' + (isFinite(state.position) ? state.position.toFixed(2) : '0.00'));
		lines.push('duration: ' + (isFinite(state.duration) ? state.duration.toFixed(2) : '0.00'));
		lines.push('volume: ' + (isFinite(state.volume) ? state.volume.toFixed(3) : '1.000'));
		lines.push('muted: ' + (state.muted ? 'yes' : 'no'));
		lines.push('title: ' + cleanText(meta.title || ''));
		lines.push('artist: ' + cleanText(meta.artist || ''));
		lines.push('album: ' + cleanText(meta.album || ''));
		lines.push('year: ' + cleanText(meta.year || ''));
		lines.push('tracknum: ' + cleanText(meta.tracknum || meta.trackNum || meta.track_number || ''));
		lines.push('tracks: ' + cleanText(meta.tracks || meta.tracktotal || meta.trackTotal || meta.track_total || ''));
		lines.push('helper: ' + cleanText(meta.helper || ''));
		lines.push('mode: ' + cleanText(meta.outputModeResolved || meta.outputMode || 'auto'));
		lines.push('cover: ' + (cleanText(meta.cover || '') ? 'yes' : 'no'));

		if (playlistCount > 0) {
			lines.push('playlist: ' + (playlistIndex + 1) + '/' + playlistCount);
			lines.push('playlistNext: ' + (meta.playlistHasNext ? 'yes' : 'no'));
			lines.push('playlistPrev: ' + (meta.playlistHasPrev ? 'yes' : 'no'));
			lines.push('playlistRepeat: ' + cleanText(meta.playlistRepeat || 'none'));
			lines.push('playlistShuffle: ' + (meta.playlistShuffle ? 'yes' : 'no'));
			lines.push('playlistSrc: ' + cleanText(meta.playlistSrc || ''));
		}

		if (state.error) lines.push('error: ' + state.error);

		return lines.join('\n');
	}

	function usePlugin(player, Ctor, args, name){
		if (typeof Ctor !== 'function') {
			warn((name || 'plugin') + ' missing');
			return;
		}

		try {
			player.use(new Ctor(args || {}));
		} catch (e) {
			err((name || 'plugin') + ' init failed', e);
		}
	}

	function findGestureNode(root){
		const nodes = document.querySelectorAll('[data-role="gesture-pad"]');
		let node = root.__a3mGestureNode || null;
		let want = '';
		let i = 0;

		if (node && node.parentNode) return node;

		want = cleanText(root && root.id || '');

		for (i = 0; i < nodes.length; i++) {
			if (!want || cleanText(nodes[i].getAttribute('data-a3m-gesture-for') || '') === want) {
				root.__a3mGestureNode = nodes[i];
				return nodes[i];
			}
		}

		node = nodes.length ? nodes[0] : null;
		root.__a3mGestureNode = node || null;

		return node;
	}

	function bootstrap(root){
		const source = cleanText(root.getAttribute('data-src') || 'test://sin?freq=rnd');
		const playlistSrc = cleanText(root.getAttribute('data-playlist-src') || '');
		const playlistIndexAttr = cleanText(root.getAttribute('data-playlist-index') || '');
		const playlistIndex = parseIndex(playlistIndexAttr || '0', 0);
		const playlistIndexAuto = !playlistIndexAttr;
		const playlistShuffle = boolValue(root.getAttribute('data-playlist-shuffle') || '', false);
		const mode = cleanText(root.getAttribute('data-output-mode') || 'auto');
		const autoplay = boolValue(root.getAttribute('data-autoplay') || '', false);
		const hasPlaylistPlugin = typeof a3m.PluginPlaylistSource === 'function';
		const player = new a3m.Player(root, {});
		const modes = [ 'auto', '2ch', '4ch', 'null' ];
		const gestureNode = findGestureNode(root);
		const pageFullscreenNode = document.documentElement || document.body || root;
		const stateNode = root.querySelector('[data-role="state"]');
		const progressNode = root.querySelector('[data-role="progress"]');
		const volumeNodes = [].slice.call(root.querySelectorAll('[data-role="volume"]'));
		const volumeVNode = root.querySelector('.a3m-ui-volume-v');
		const volumeVTrackNode = root.querySelector('.a3m-ui-volume-v-track');
		let modeIndex = Math.max(0, modes.indexOf(mode));
		let volumeVDragging = false;
		let volumeVPointerId = null;

		function setGestureHidden(hidden){
			if (!gestureNode) return;

			if (hidden) gestureNode.setAttribute('data-hidden', '1');
			else gestureNode.removeAttribute('data-hidden');

			setAttr(root, 'data-gesture-hidden', hidden ? '1' : '0');
		}

		function toggleGesture(){
			if (!gestureNode) return;
			setGestureHidden(gestureNode.getAttribute('data-hidden') !== '1');
		}

		function togglePlaylistPanel(){
			const hidden = root.getAttribute('data-state-hidden') === '1';

			setAttr(root, 'data-state-hidden', hidden ? '0' : '1');
			if (hidden) syncStatePanel(player.getState(), true);
		}

		function playlistModeActive(meta){
			return !!(hasPlaylistPlugin && (playlistSrc || cleanText(meta && meta.sourceKind || '') === 'playlist'));
		}

		function shuffleSource(){
			const state = player.getState();
			const meta = state.meta || {};

			if (!playlistModeActive(meta)) return;

			player.command('cmd:playlist-shuffle', {
				shuffle: !boolValue(meta.playlistShuffle, false)
			});
		}

		function showQrSplash(kind){
			const state = player.getState();
			const meta = state.meta || {};
			const title = cleanText(meta.title || document.title || 'Share');
			const artist = cleanText(meta.artist || '');
			const src = cleanText(state.currentSource || '');
			let text = window.location.href;
			let note = document.title || text;
			let qrTitle = 'Page QR';

			if (kind === 'track') {
				qrTitle = 'Track QR';
				text = src && !/^test:\/\//i.test(src) ? src : window.location.href;
				note = cleanText(title + (artist ? (' · ' + artist) : '')) || text;
			}

			if (!window.a3m_qrcode || typeof window.a3m_qrcode.open !== 'function') {
				warn('qrcode missing');
				return;
			}

			window.a3m_qrcode.open({
				title: qrTitle,
				text: text,
				note: note
			});
		}

		function seekToPointer(e){
			const state = player.getState();
			const duration = isFinite(state.duration) ? state.duration : 0;
			let rect = null;
			let ratio = 0;

			if (!progressNode || !duration || duration <= 0) return;

			rect = progressNode.getBoundingClientRect();
			if (!rect || !rect.width) return;

			ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);

			player.command('cmd:seek', {
				position: duration * ratio
			});
		}

		function pageFullscreenActive(){
			return fullscreenElement() === pageFullscreenNode;
		}

		function syncFullscreenState(){
			setAttr(root, 'data-fullscreen', pageFullscreenActive() ? '1' : '0');
		}

		function toggleFullscreen(){
			if (pageFullscreenActive()) {
				Promise.resolve(exitFullscreen()).catch(function(e){
					err('fullscreen exit failed', e);
				});
				return;
			}

			Promise.resolve(requestFullscreen(pageFullscreenNode)).catch(function(e){
				err('fullscreen request failed', e);
			});
		}

		function verticalVolumeRect(){
			const node = volumeVTrackNode || volumeVNode || null;

			return node ? node.getBoundingClientRect() : null;
		}

		function setVerticalVolumeFromClientY(clientY, via){
			const rect = verticalVolumeRect();
			let volume = 0;

			if (!rect || !rect.height) return;

			volume = clamp((rect.bottom - clientY) / rect.height, 0, 1);

			player.command('cmd:set-volume', {
				via: via || 'vertical',
				volume: volume
			});
		}

		function startVerticalVolumeDrag(e){
			volumeVDragging = true;
			volumeVPointerId = e && e.pointerId != null ? e.pointerId : null;
		}

		function stopVerticalVolumeDrag(){
			volumeVDragging = false;
			volumeVPointerId = null;
		}

		function verticalVolumePointerMatch(e){
			if (!volumeVDragging) return false;
			if (!e || e.pointerId == null || volumeVPointerId == null) return true;
			return e.pointerId === volumeVPointerId;
		}

		function onVerticalVolumePointerDown(e){
			if (!volumeVNode) return;
			if (e.button != null && e.button !== 0) return;

			startVerticalVolumeDrag(e);

			if (volumeVNode.setPointerCapture && e.pointerId != null) {
				try {
					volumeVNode.setPointerCapture(e.pointerId);
				} catch (er) {}
			}

			setVerticalVolumeFromClientY(e.clientY, 'vertical-down');
			e.preventDefault();
		}

		function onVerticalVolumePointerMove(e){
			if (!verticalVolumePointerMatch(e)) return;

			setVerticalVolumeFromClientY(e.clientY, 'vertical-drag');
			e.preventDefault();
		}

		function onVerticalVolumePointerEnd(e){
			if (!verticalVolumePointerMatch(e)) return;

			setVerticalVolumeFromClientY(e.clientY, 'vertical-up');
			stopVerticalVolumeDrag();
			e.preventDefault();
		}

		function onVerticalVolumePointerCancel(e){
			if (!verticalVolumePointerMatch(e)) return;

			stopVerticalVolumeDrag();
			e.preventDefault();
		}

		function syncBaseFlags(state){
			debug('syncBaseFlags');
			setAttr(root, 'data-playing', state.playing ? '1' : '0');
			setAttr(root, 'data-muted', state.muted ? '1' : '0');
			setAttr(root, 'data-ready', state.ready ? '1' : '0');
			setAttr(root, 'data-error', state.error ? '1' : '0');
		}

		function syncTimeVars(state){
			const pos = isFinite(state.position) ? state.position : 0;
			const dur = isFinite(state.duration) ? state.duration : 0;
			const progress = dur > 0 ? clamp(pos / dur, 0, 1) : 0;

			setStyleVar(root, '--a3m-time-pos', String(pos));
			setStyleVar(root, '--a3m-time-dur', String(dur));
			setStyleVar(root, '--a3m-time-pos-text', cssString(fmtTime(pos)));
			setStyleVar(root, '--a3m-time-dur-text', cssString(fmtTime(dur)));
			setStyleVar(root, '--a3m-progress', String(progress));
			setStyleVar(root, '--a3m-progress-pct', String(progress * 100) + '%');
		}

		function syncVolumeState(state){
			debug('syncVol');
			const volume = clamp(state.volume, 0, 1);
			const pct = Math.round(volume * 100);
			let level = '0';
			let i = 0;

			if (!state.muted && pct > 0) {
				if (pct <= 20) level = '1';
				else if (pct <= 45) level = '2';
				else if (pct <= 75) level = '3';
				else level = '4';
			}

			setAttr(root, 'data-volume-level', level);
			setStyleVar(root, '--a3m-volume', String(volume));
			setStyleVar(root, '--a3m-volume-2', String(volume));
			setStyleVar(root, '--a3m-volume-pct', String(volume * 100) + '%');
			setStyleVar(root, '--a3m-volume-pct-2', String(volume * 100) + '%');
			setStyleVar(root, '--a3m-volume-pct-text', cssString(pct + '%'));
			setStyleVar(root, '--a3m-volume-text', cssString(state.muted ? ('Mute ' + pct + '%') : (pct + '%')));

			for (i = 0; i < volumeNodes.length; i++) {
				setValue(volumeNodes[i], Math.round(volume * 1000));
			}
		}

		function syncPlaylistState(state){
			const meta = state.meta || {};
			const count = parseInt(meta.playlistCount, 10);
			const index = parseInt(meta.playlistIndex, 10);

			setAttr(root, 'data-playlist-active', count > 0 ? '1' : '0');
			setStyleVar(root, '--a3m-playlist-current', cssString(count > 0 ? (index + 1) : ''));
			setStyleVar(root, '--a3m-playlist-total', cssString(count > 0 ? count : ''));
			setAttr(root, 'data-playlist-shuffle', boolValue(meta.playlistShuffle, false) ? '1' : '0');
			setAttr(root, 'data-playlist-repeat', cleanText(meta.playlistRepeat || 'none') || 'none');
			setAttr(
				root,
				'data-loop',
				cleanText(meta.playlistRepeat || 'none') !== 'none' ? '1' : (boolValue(meta.loop, false) ? '1' : '0')
			);
			setAttr(root, 'data-output-mode-current', cleanText(meta.outputModeResolved || meta.outputMode || modes[modeIndex] || 'auto'));
		}

		function syncMetaState(state){
			debug('syncMeta');
			const meta = state.meta || {};
			const track = state.currentTrack || {};
			const title = cleanText(meta.title || track.title || state.currentSource || '-');
			const artist = cleanText(meta.artist || track.artist || '');
			const album = cleanText(meta.album || track.album || '');
			const year = cleanText(meta.year || '');
			const tracknum = cleanText(meta.tracknum || meta.trackNum || meta.track_number || '');
			const tracks = cleanText(meta.tracks || meta.tracktotal || meta.trackTotal || meta.track_total || '');
			const helper = cleanText(meta.helper || '');
			const sourceText = cleanText(state.currentSource || '');

			setStyleVar(root, '--a3m-meta-title', cssString(title));
			setStyleVar(root, '--a3m-meta-artist', cssString(artist));
			setStyleVar(root, '--a3m-meta-album', cssString(album));
			setStyleVar(root, '--a3m-meta-year', cssString(year));
			setStyleVar(root, '--a3m-meta-tracknum', cssString(tracknum));
			setStyleVar(root, '--a3m-meta-tracks', cssString(tracks));
			setStyleVar(root, '--a3m-meta-helper', cssString(helper));
			setStyleVar(root, '--a3m-meta-source', cssString(sourceText));

			setAttr(root, 'data-has-meta-title', title ? '1' : '0');
			setAttr(root, 'data-has-meta-artist', artist ? '1' : '0');
			setAttr(root, 'data-has-meta-album', album ? '1' : '0');
			setAttr(root, 'data-has-meta-year', year ? '1' : '0');
			setAttr(root, 'data-has-meta-tracknum', tracknum ? '1' : '0');
			setAttr(root, 'data-has-meta-tracks', tracks ? '1' : '0');
			setAttr(root, 'data-has-meta-track', tracknum ? '1' : '0');
			setAttr(root, 'data-has-meta-helper', helper ? '1' : '0');
			setAttr(root, 'data-has-meta-source', sourceText ? '1' : '0');
		}

		function syncStatePanel(state, force){
			if (!stateNode) return;
			if (!force && root.getAttribute('data-state-hidden') === '1') return;
			setText(stateNode, stateText(state));
		}

		function syncAll(state, forceStatePanel){
			debug('synAll');
			syncBaseFlags(state);
			syncTimeVars(state);
			syncVolumeState(state);
			syncPlaylistState(state);
			syncMetaState(state);
			syncFullscreenState();
			syncStatePanel(state, !!forceStatePanel);
		}

		root.__a3mPlayer = player;

		if (!gestureNode) warn('missing ui role', 'gesture-pad');
		if (!progressNode) warn('missing ui role', 'progress');
		if (!volumeNodes.length) warn('missing ui role', 'volume');

		root.addEventListener('click', function(e){
			const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
			const state = player.getState();
			const meta = state.meta || {};
			let act = '';

			if (!btn) return;
			act = cleanText(btn.getAttribute('data-act'));

			if (act === 'toggle') {
				player.command(state.playing ? 'cmd:pause' : 'cmd:play', {});
				return;
			}

			if (act === 'stop') {
				player.command('cmd:stop', {});
				return;
			}

			if (act === 'prev') {
				player.command('cmd:prev', {});
				return;
			}

			if (act === 'next') {
				player.command('cmd:next', {});
				return;
			}

			if (act === 'shuffle') {
				shuffleSource();
				return;
			}

			if (act === 'repeat') {
				if (playlistModeActive(meta)) {
					player.command('cmd:playlist-repeat', {
						cycle: 1
					});
				} else {
					player.command('cmd:set-loop', {
						loop: !boolValue(meta.loop, false)
					});
				}
				return;
			}

			if (act === 'share') {
				showQrSplash('page');
				return;
			}

			if (act === 'share-track') {
				showQrSplash('track');
				return;
			}

			if (act === 'mode') {
				modeIndex = (modeIndex + 1) % modes.length;
				player.command('cmd:output-mode', {
					mode: modes[modeIndex]
				});
				return;
			}

			if (act === 'playlist') {
				togglePlaylistPanel();
				return;
			}

			if (act === 'fullscreen') {
				toggleFullscreen();
				return;
			}

			if (act === 'refresh') {
				window.location.reload();
				return;
			}

			if (act === 'mute') {
				player.command('cmd:set-muted', {
					muted: !state.muted
				});
			}
		});

		root.addEventListener('input', function(e){
			const role = e.target && e.target.getAttribute ? e.target.getAttribute('data-role') : '';

			if (role !== 'volume') return;

			player.command('cmd:set-volume', {
				volume: clamp((parseFloat(e.target.value || '1000') || 0) / 1000, 0, 1)
			});
		});

		root.addEventListener('change', function(e){
			const role = e.target && e.target.getAttribute ? e.target.getAttribute('data-role') : '';

			if (role !== 'volume') return;

			player.command('cmd:set-volume', {
				volume: clamp((parseFloat(e.target.value || '1000') || 0) / 1000, 0, 1)
			});
		});

		if (progressNode) {
			progressNode.addEventListener('click', function(e){
				seekToPointer(e);
			});
		}

		if (volumeVNode) {
			volumeVNode.addEventListener('pointerdown', onVerticalVolumePointerDown);
			volumeVNode.addEventListener('pointermove', onVerticalVolumePointerMove);
			volumeVNode.addEventListener('pointerup', onVerticalVolumePointerEnd);
			volumeVNode.addEventListener('pointercancel', onVerticalVolumePointerCancel);
			volumeVNode.addEventListener('lostpointercapture', stopVerticalVolumeDrag);
		}

		document.addEventListener('pointermove', onVerticalVolumePointerMove);
		document.addEventListener('pointerup', onVerticalVolumePointerEnd);
		document.addEventListener('pointercancel', onVerticalVolumePointerCancel);

		root.addEventListener('wheel', onVolumeWheel, { passive: false });
		if (gestureNode) gestureNode.addEventListener('wheel', onVolumeWheel, { passive: false });

		document.addEventListener('fullscreenchange', syncFullscreenState);
		document.addEventListener('webkitfullscreenchange', syncFullscreenState);
		document.addEventListener('mozfullscreenchange', syncFullscreenState);
		document.addEventListener('MSFullscreenChange', syncFullscreenState);

		document.addEventListener('keydown', function(e){
			if (e.target && /input|textarea/i.test(String(e.target.tagName || ''))) return;

			if (e.altKey && String(e.key || '').toLowerCase() === 'g') {
				e.preventDefault();
				toggleGesture();
				return;
			}

			if (e.key === ' ') {
				e.preventDefault();
				player.command(player.getState().playing ? 'cmd:pause' : 'cmd:play', {});
				return;
			}

			if (e.key === '.' || e.key === '>') {
				player.command('cmd:next', {});
				return;
			}

			if (e.key === ',' || e.key === '<') {
				player.command('cmd:prev', {});
				return;
			}

			if (String(e.key || '').toLowerCase() === 'm') {
				player.command('cmd:set-muted', {
					muted: !player.getState().muted
				});
				return;
			}

			if (
				e.key === '-' ||
				e.key === '_' ||
				e.code === 'Minus' ||
				e.code === 'NumpadSubtract'
			) {
				adjustVolume(-0.05, 'key');
				return;
			}

			if (
				e.key === '=' ||
				e.key === '+' ||
				e.code === 'Equal' ||
				e.code === 'NumpadAdd'
			) {
				adjustVolume(0.05, 'key');
			}
		});

		player.bus.on('state:change', function(detail){
			const patch = detail && detail.patch ? detail.patch : {};
			const state = detail && detail.state ? detail.state : player.getState();

			if ('ready' in patch || 'playing' in patch || 'error' in patch || 'muted' in patch) {
				syncBaseFlags(state);
			}

			if ('position' in patch || 'duration' in patch) {
				syncTimeVars(state);
			}

			if ('volume' in patch || 'muted' in patch) {
				syncVolumeState(state);
			}

			if ('meta' in patch || 'currentTrack' in patch || 'currentSource' in patch) {
				syncMetaState(state);
				syncPlaylistState(state);
			}

			if ('meta' in patch) {
				syncPlaylistState(state);
			}

			syncFullscreenState();
			syncStatePanel(state, false);
		});

		if (hasPlaylistPlugin) usePlugin(player, a3m.PluginPlaylistSource, {}, 'PluginPlaylistSource');
		usePlugin(player, a3m.PluginOutputGraph, {
			outputMode: mode
		}, 'PluginOutputGraph');
		usePlugin(player, a3m.PluginAutoNext, {}, 'PluginAutoNext');
		usePlugin(player, a3m.PluginGesture, {
			node: gestureNode
		}, 'PluginGesture');
		usePlugin(player, a3m.PluginCoverGen, {}, 'PluginCoverGen');
		usePlugin(player, a3m.PluginMediaSession, {}, 'PluginMediaSession');
		usePlugin(player, a3m.PluginCoverBg, {}, 'PluginCoverBg');

		usePlugin(player, a3m.PluginMetaFile, {}, 'PluginMetaFile');

		player.init();
		syncAll(player.getState(), true);

		if (playlistSrc && hasPlaylistPlugin) {
			player.command('cmd:playlist-load', {
				src: playlistSrc,
				index: playlistIndex,
				autoplay: autoplay,
				shuffle: playlistShuffle,
				startRandom: playlistShuffle && playlistIndexAuto
			});
		} else {
			player.command('cmd:load', {
				source: source,
				src: source,
				autoplay: autoplay
			});
		}

		return player;
	}

	function adjustVolume(delta, via){
		const root = document.querySelector('.a3m-player');
		const player = root && root.__a3mPlayer ? root.__a3mPlayer : null;
		const state = player ? player.getState() : null;
		const base = state && isFinite(state.volume) ? state.volume : 1;

		if (!player) return;

		player.command('cmd:set-volume', {
			via: via || 'ui',
			volume: clamp(base + delta, 0, 1)
		});
	}

	function onVolumeWheel(e){
		if (!e) return;
		if (!isFinite(e.deltaY) || !e.deltaY) return;

		e.preventDefault();
		adjustVolume(e.deltaY > 0 ? -0.05 : 0.05, 'wheel');
	}

	function bootAll(){
		const nodes = document.querySelectorAll('.a3m-player');
		let i = 0;

		for (i = 0; i < nodes.length; i++) {
			if (nodes[i].__a3mPlayer) continue;
			bootstrap(nodes[i]);
		}
	}

	a3m.bootExample = bootAll;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', bootAll);
	} else {
		bootAll();
	}
})();
