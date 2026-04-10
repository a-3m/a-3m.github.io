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

	function exampleHtml(){
		return [
			'<div data-a3m-example="1" style="position:relative;z-index:1;">',
				'<div><strong>A3M minimal proof</strong></div>',
				'<div>',
					'<button type="button" data-act="toggle">Play</button> ',
					'<button type="button" data-act="prev">Prev</button> ',
					'<button type="button" data-act="next">Next</button> ',
					'<button type="button" data-act="mode">Mode</button> ',
					'<button type="button" data-act="mute">Mute</button>',
				'</div>',
				'<div style="margin-top:20px;min-height:120px;">',
					'<span style="display:inline-flex;flex-direction:column;align-items:center;gap:8px;">',
						'<span style="font-size:12px;opacity:0.8;">Vol</span>',
						'<input ' +
							'type="range" min="0" max="1000" step="1" value="1000" data-role="volume" ' +
							'orient="vertical" ' +
							'style="' +
								'width:24px;' +
								'height:96px;' +
								'margin:0;' +
								'writing-mode:vertical-lr;' +
								'direction:rtl;' +
								'-webkit-appearance:slider-vertical;' +
							'">',
					'</span>',
				'</div>',
				'<pre data-role="state"></pre>',
			'</div>',
			'<div ' +
				'data-role="gesture-pad" ' +
				'style="' +
					'position:fixed;' +
					'left:0;' +
					'right:0;' +
					'bottom:0;' +
					'width:100vw;' +
					'height:50vh;' +
					'z-index:20;' +
					'display:grid;' +
					'place-items:end center;' +
					'user-select:none;' +
					'touch-action:none;' +
					'background:transparent;' +
				'">',
				'<div style="' +
					'margin-bottom:18px;' +
					'padding:10px 14px;' +
					'border:1px solid #666;' +
					'border-radius:12px;' +
					'background:#0005;' +
					'text-align:center;' +
					'line-height:1.5;' +
					'opacity:0.85;' +
					'pointer-events:none;' +
				'">',
					'Swipe ↑ ↓ volume<br>',
					'Swipe ← → track',
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
		let toggleNode = null;
		let muteNode = null;
		let volumeNode = null;
		let volumeDrag = false;

		root.__a3mPlayer = player;
		root.innerHTML = exampleHtml();

		stateNode = root.querySelector('[data-role="state"]');
		toggleNode = root.querySelector('[data-act="toggle"]');
		muteNode = root.querySelector('[data-act="mute"]');
		volumeNode = root.querySelector('[data-role="volume"]');

		function setVolumeDrag(on){
			volumeDrag = !!on;
		}

		function render(){
			const state = player.getState();
			const meta = state.meta || {};
			const shownMode = cleanText(meta.outputModeResolved || meta.outputMode || modes[modeIndex] || 'auto');

			if (stateNode) stateNode.textContent = stateText(state);
			if (toggleNode) toggleNode.textContent = state.playing ? 'Pause' : 'Play';
			if (muteNode) muteNode.textContent = state.muted ? 'Unmute' : 'Mute';
			if (volumeNode && !volumeDrag) volumeNode.value = String(Math.round(clamp(state.volume, 0, 1) * 1000));

			root.setAttribute('data-output-mode-current', shownMode);
		}

		root.addEventListener('click', function(e){
			const btn = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
			let act = '';

			if (!btn) return;
			act = cleanText(btn.getAttribute('data-act'));

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
				return;
			}

			if (act === 'mute') {
				player.command('cmd:set-muted', {
					muted: !player.getState().muted
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
			setVolumeDrag(false);
			render();
		});

		root.addEventListener('pointerdown', function(e){
			const role = e.target && e.target.getAttribute ? e.target.getAttribute('data-role') : '';
			if (role === 'volume') setVolumeDrag(true);
		});

		root.addEventListener('pointerup', function(){
			if (!volumeDrag) return;
			setVolumeDrag(false);
			render();
		});

		root.addEventListener('focusin', function(e){
			const role = e.target && e.target.getAttribute ? e.target.getAttribute('data-role') : '';
			if (role === 'volume') setVolumeDrag(true);
		});

		root.addEventListener('focusout', function(e){
			const role = e.target && e.target.getAttribute ? e.target.getAttribute('data-role') : '';
			if (role !== 'volume') return;
			setVolumeDrag(false);
			render();
		});

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