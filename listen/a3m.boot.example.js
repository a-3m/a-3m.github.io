/* File: a3m.boot.example.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const A3M = window.A3M || (window.A3M = {});

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

	function fmtTime(n){
		n = isFinite(n) && n > 0 ? Math.floor(n) : 0;
		const m = Math.floor(n / 60);
		const s = n % 60;
		const h = Math.floor(m / 60);
		const mm = h ? String(m % 60).padStart(2, '0') : String(m);
		const ss = String(s).padStart(2, '0');
		return h ? (h + ':' + mm + ':' + ss) : (mm + ':' + ss);
	}

	function exampleHtml(){
		return [
			'<div class="a3m-ui" data-a3m-example="1">',
				'<div class="a3m-ui-head">',
					'<div class="a3m-ui-title" data-role="title">-</div>',
					'<div class="a3m-ui-subtitle" data-role="subtitle"></div>',
				'</div>',
				'<div class="a3m-ui-row a3m-ui-row-main">',
					'<button type="button" class="a3m-ui-btn a3m-ui-btn-toggle" data-act="toggle">',
						'<span class="a3m-ui-when-paused">▶</span>',
						'<span class="a3m-ui-when-playing">❚❚</span>',
					'</button>',
					'<button type="button" class="a3m-ui-btn" data-act="prev">‹</button>',
					'<button type="button" class="a3m-ui-btn" data-act="next">›</button>',
					'<button type="button" class="a3m-ui-btn" data-act="mode">Mode</button>',
					'<button type="button" class="a3m-ui-btn a3m-ui-btn-mute" data-act="mute">',
						'<span class="a3m-ui-when-unmuted">🔉</span>',
						'<span class="a3m-ui-when-muted">🔇</span>',
					'</button>',
				'</div>',
				'<div class="a3m-ui-progress-block">',
					'<div class="a3m-ui-progress-head">',
						'<span>Progress</span>',
						'<span><span data-role="time-now">0:00</span> / <span data-role="time-total">0:00</span></span>',
					'</div>',
					'<div class="a3m-ui-progress-bar">',
						'<div class="a3m-ui-progress-fill"></div>',
					'</div>',
				'</div>',
				'<div class="a3m-ui-volume-block">',
					'<div class="a3m-ui-volume-head">',
						'<span>Volume</span>',
						'<span data-role="volume-text">100%</span>',
					'</div>',
					'<div class="a3m-ui-volume-bar">',
						'<div class="a3m-ui-volume-fill"></div>',
					'</div>',
					'<input class="a3m-ui-volume-range" type="range" min="0" max="1000" step="1" value="1000" data-role="volume">',
				'</div>',
				'<pre class="a3m-ui-state" data-role="state"></pre>',
			'</div>',
			'<div class="a3m-ui-gesture" data-role="gesture-pad">',
				'<div class="a3m-ui-gesture-note">',
					'Tap play / pause<br>',
					'Swipe ↑ ↓ volume<br>',
					'Swipe ← → track<br>',
					'Two-finger ↓ logs',
				'</div>',
			'</div>'
		].join('');
	}

	function stateText(state){
		const meta = state.meta || {};
		const lines = [];

		lines.push('source: ' + (state.currentSource || '-'));
		lines.push('playing: ' + (state.playing ? 'yes' : 'no'));
		lines.push('ready: ' + (state.ready ? 'yes' : 'no'));
		lines.push('position: ' + (isFinite(state.position) ? state.position.toFixed(2) : '0.00'));
		lines.push('duration: ' + (isFinite(state.duration) ? state.duration.toFixed(2) : '0.00'));
		lines.push('volume: ' + (isFinite(state.volume) ? state.volume.toFixed(3) : '1.000'));
		lines.push('muted: ' + (state.muted ? 'yes' : 'no'));
		lines.push('title: ' + cleanText(meta.title || ''));
		lines.push('artist: ' + cleanText(meta.artist || ''));
		lines.push('album: ' + cleanText(meta.album || ''));
		lines.push('helper: ' + cleanText(meta.helper || ''));
		lines.push('mode: ' + cleanText(meta.outputModeResolved || meta.outputMode || 'auto'));
		lines.push('cover: ' + (cleanText(meta.cover || '') ? 'yes' : 'no'));

		if (state.error) lines.push('error: ' + state.error);

		return lines.join('\n');
	}

	function usePlugin(player, Ctor, args, name){
		if (typeof Ctor !== 'function') {
			player.plog.warn((name || 'plugin') + ' missing');
			return;
		}

		try {
			player.use(new Ctor(args || {}));
		} catch (e) {
			player.plog.err((name || 'plugin') + ' init failed', e);
		}
	}

	function exportRootState(root, state){
		const volumeLogical = clamp(state.volume, 0, 1);
		const volumeShown = state.muted ? 0 : volumeLogical;
		const progress = state.duration > 0
			? clamp(state.position / state.duration, 0, 1)
			: 0;

		root.setAttribute('data-playing', state.playing ? '1' : '0');
		root.setAttribute('data-muted', state.muted ? '1' : '0');
		root.setAttribute('data-ready', state.ready ? '1' : '0');
		root.setAttribute('data-error', state.error ? '1' : '0');

		root.style.setProperty('--a3m-volume', String(volumeShown));
		root.style.setProperty('--a3m-volume-2', String(volumeLogical));
		root.style.setProperty('--a3m-volume-pct', String(volumeShown * 100) + '%');
		root.style.setProperty('--a3m-volume-pct-2', String(volumeLogical * 100) + '%');
		root.style.setProperty('--a3m-progress', String(progress));
		root.style.setProperty('--a3m-progress-pct', String(progress * 100) + '%');
		root.style.setProperty('--a3m-position', String(isFinite(state.position) ? state.position : 0));
		root.style.setProperty('--a3m-duration', String(isFinite(state.duration) ? state.duration : 0));
	}

	function bootstrap(root, idx){
		const source = cleanText(root.getAttribute('data-src') || 'test://sin?freq=rnd');
		const mode = cleanText(root.getAttribute('data-output-mode') || 'auto');
		const autoplay = boolValue(root.getAttribute('data-autoplay') || '', false);
		const player = new A3M.Player(root, {
			logPrefix: root.id ? ('[a3m#' + root.id + ']') : ('[a3m:' + idx + ']')
		});
		const modes = [ 'auto', '2ch', '4ch', 'null' ];
		let modeIndex = Math.max(0, modes.indexOf(mode));
		let stateNode = null;
		let titleNode = null;
		let subtitleNode = null;
		let timeNowNode = null;
		let timeTotalNode = null;
		let volumeNode = null;
		let volumeTextNode = null;
		let muteNode = null;

		root.__a3mPlayer = player;
		root.innerHTML = exampleHtml();

		stateNode = root.querySelector('[data-role="state"]');
		titleNode = root.querySelector('[data-role="title"]');
		subtitleNode = root.querySelector('[data-role="subtitle"]');
		timeNowNode = root.querySelector('[data-role="time-now"]');
		timeTotalNode = root.querySelector('[data-role="time-total"]');
		volumeNode = root.querySelector('[data-role="volume"]');
		volumeTextNode = root.querySelector('[data-role="volume-text"]');
		muteNode = root.querySelector('[data-act="mute"]');

		function render(){
			const state = player.getState();
			const meta = state.meta || {};
			const shownMode = cleanText(meta.outputModeResolved || meta.outputMode || modes[modeIndex] || 'auto');
			const title = cleanText(meta.title || (state.currentTrack && state.currentTrack.title) || state.currentSource || '-');
			const subtitle = [
				cleanText(meta.artist || (state.currentTrack && state.currentTrack.artist) || ''),
				cleanText(meta.album || (state.currentTrack && state.currentTrack.album) || '')
			].filter(Boolean).join(' · ');
			const volumePct = Math.round(clamp(state.volume, 0, 1) * 100);

			exportRootState(root, state);

			if (titleNode) titleNode.textContent = title || '-';
			if (subtitleNode) subtitleNode.textContent = subtitle;
			if (timeNowNode) timeNowNode.textContent = fmtTime(state.position);
			if (timeTotalNode) timeTotalNode.textContent = fmtTime(state.duration);
			if (volumeNode) volumeNode.value = String(Math.round(clamp(state.volume, 0, 1) * 1000));
			if (volumeTextNode) volumeTextNode.textContent = state.muted ? ('Mute ' + volumePct + '%') : (volumePct + '%');
			if (muteNode) muteNode.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
			if (stateNode) stateNode.textContent = stateText(state);

			root.setAttribute('data-output-mode-current', shownMode);
		}

		function onMuteClick(e){
			e.preventDefault();
			e.stopPropagation();
			player.command('cmd:set-muted', {
				muted: !player.getState().muted
			});
		}

		function onVolumeInput(e){
			player.command('cmd:set-volume', {
				volume: clamp((parseFloat(e.target.value || '1000') || 0) / 1000, 0, 1)
			});
		}

		root.addEventListener('click', function(e){
			const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
			let act = '';

			if (!btn) return;
			act = cleanText(btn.getAttribute('data-act'));

			if (act === 'mute') return;

			if (act === 'toggle') {
				player.command(player.getState().playing ? 'cmd:pause' : 'cmd:play', {});
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

			if (act === 'mode') {
				modeIndex = (modeIndex + 1) % modes.length;
				player.command('cmd:output-mode', {
					mode: modes[modeIndex]
				});
			}
		});

		if (muteNode) muteNode.addEventListener('click', onMuteClick);
		if (volumeNode) {
			volumeNode.addEventListener('input', onVolumeInput);
			volumeNode.addEventListener('change', onVolumeInput);
		}

		document.addEventListener('keydown', function(e){
			if (e.target && /input|textarea/i.test(String(e.target.tagName || ''))) return;

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
				modeIndex = (modeIndex + 1) % modes.length;
				player.command('cmd:output-mode', {
					mode: modes[modeIndex]
				});
				return;
			}

			if (e.key === '-') {
				player.command('cmd:set-volume', {
					volume: clamp(player.getState().volume - 0.05, 0, 1)
				});
				return;
			}

			if (e.key === '=' || e.key === '+') {
				player.command('cmd:set-volume', {
					volume: clamp(player.getState().volume + 0.05, 0, 1)
				});
			}
		});

		usePlugin(player, A3M.PluginOutputGraph, {
			outputMode: mode
		}, 'PluginOutputGraph');
		usePlugin(player, A3M.PluginAutoNext, {}, 'PluginAutoNext');
		usePlugin(player, A3M.PluginGesture, {}, 'PluginGesture');
		usePlugin(player, A3M.PluginCoverGen, {}, 'PluginCoverGen');
		usePlugin(player, A3M.PluginMediaSession, {}, 'PluginMediaSession');
		usePlugin(player, A3M.PluginCoverBg, {}, 'PluginCoverBg');

		player.init();
		player.command('cmd:load', {
			source: source,
			src: source,
			autoplay: autoplay
		});

		player.bus.on('state:change', render);
		player.bus.on('evt:volume', render);
		player.bus.on('evt:time', render);
		render();

		return player;
	}

	function bootAll(){
		const nodes = document.querySelectorAll('.a3m-player');
		let i = 0;

		for (i = 0; i < nodes.length; i++) {
			if (nodes[i].__a3mPlayer) continue;
			bootstrap(nodes[i], i + 1);
		}
	}

	A3M.bootExample = bootAll;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', bootAll);
	} else {
		bootAll();
	}
})();