/* file: a3m.plugin.gesture.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log } = a3m.logp('gesture');

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function clamp(n, a, b){
		n = parseFloat(n);
		if (!isFinite(n)) n = a;
		return Math.min(b, Math.max(a, n));
	}

	function touchPoint(touches, count){
		let x = 0;
		let y = 0;
		let n = 0;
		let i = 0;

		n = Math.min(
			touches && touches.length || 0,
			count || (touches ? touches.length : 0)
		);

		if (!n) return null;

		for (i = 0; i < n; i++) {
			x += touches[i].clientX;
			y += touches[i].clientY;
		}

		return {
			x: x / n,
			y: y / n
		};
	}

	function PluginGesture(opts){
		this.options = opts || {};
	}

	PluginGesture.prototype.attach = function(ctx){
		const bus = ctx.bus;
		const off = [];
		const node = this.options.node || (
			ctx.root && ctx.root.querySelector
				? ctx.root.querySelector('[data-role="gesture-pad"]')
				: null
		);
		const axisRatio = Math.max(1, parseFloat(this.options.axisRatio || 1.12) || 1.12);
		const thresholdPx = Math.max(20, parseInt(this.options.thresholdPx || 28, 10) || 28);
		const tapMaxPx = Math.max(8, parseInt(this.options.tapMaxPx || 14, 10) || 14);
		const initState = ctx.getState();
		const docEl = document.documentElement;
		const body = document.body;
		const prevDocOverscrollY = docEl && docEl.style ? docEl.style.overscrollBehaviorY : '';
		const prevBodyOverscrollY = body && body.style ? body.style.overscrollBehaviorY : '';
		const prevNodeOverscroll = node && node.style ? node.style.overscrollBehavior : '';
		let active = false;
		let pointerId = null;
		let touchMode = '';
		let startX = 0;
		let startY = 0;
		let lastX = 0;
		let lastY = 0;
		let volume = clamp(initState && isFinite(initState.volume) ? initState.volume : 1, 0, 1);
		let muted = !!(initState && initState.muted);
		let playing = !!(initState && initState.playing);
		let dragMode = '';
		let startVolume = volume;
		let lastSentVolume = volume;

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function syncState(state){
			if (!state) return;
			if (isFinite(state.volume)) volume = clamp(state.volume, 0, 1);
			muted = !!state.muted;
			playing = !!state.playing;
		}

		function volumeSwipeSpan(){
			if (!node || !node.clientHeight) return 220;
			return Math.max(120, Math.round(node.clientHeight * 0.72));
		}

		function endSwipe(){
			active = false;
			pointerId = null;
			touchMode = '';
			startX = 0;
			startY = 0;
			lastX = 0;
			lastY = 0;
			dragMode = '';
			startVolume = volume;
			lastSentVolume = volume;
		}

		function setPress(on){
			if (!node || !node.setAttribute || !node.removeAttribute) return;
			if (on) node.setAttribute('data-gesture-active', '1');
			else node.removeAttribute('data-gesture-active');
		}

		function start(x, y, id, mode){
			active = true;
			pointerId = id;
			touchMode = mode || '';
			startX = x;
			startY = y;
			lastX = x;
			lastY = y;
			dragMode = '';
			startVolume = volume;
			lastSentVolume = volume;
			setPress(true);
		}

		function move(x, y){
			lastX = x;
			lastY = y;
		}

		function detectMode(dx, dy){
			if (dragMode) return dragMode;
			if (Math.abs(dx) < thresholdPx && Math.abs(dy) < thresholdPx) return '';
			if (Math.abs(dy) > Math.abs(dx) * axisRatio) dragMode = 'y';
			else if (Math.abs(dx) > Math.abs(dy) * axisRatio) dragMode = 'x';
			return dragMode;
		}

		function runLogsGesture(dx, dy){
			log('two-finger down -> logs');
			if (window.__logs_local && typeof window.__logs_local.rotate === 'function') {
				window.__logs_local.rotate();
			} else {
				window.dispatchEvent(new CustomEvent('logs-local-download', {
					detail: {
						reset: true
					}
				}));
			}
			bus.emit('evt:gesture-logs', {
				dx: dx,
				dy: dy
			});
		}

		function togglePlayback(dx, dy){
			const state = ctx.getState();

			if (state && state.playing) {
				log('tap -> pause');
				ctx.command('cmd:pause', {
					via: 'gesture',
					dx: dx,
					dy: dy
				});
				return;
			}

			log('tap -> play');
			ctx.command('cmd:play', {
				via: 'gesture',
				dx: dx,
				dy: dy
			});
		}

		function setVolume(next, via, dx, dy){
			const prevVolume = volume;
			const prevMuted = muted;

			next = clamp(next, 0, 1);

			if (Math.abs(next - lastSentVolume) < 0.001) return;

			volume = next;
			lastSentVolume = next;

			if (muted && next > 0) muted = false;

			if (Math.abs(next - prevVolume) < 0.001 && muted === prevMuted) return;

			log(via, 'volume', next);
			ctx.command('cmd:set-volume', {
				via: 'gesture',
				volume: next,
				dx: dx,
				dy: dy
			});

			if (prevMuted !== muted) {
				ctx.command('cmd:set-muted', {
					via: 'gesture',
					muted: muted
				});
			}
		}

		function applyVertical(dx, dy){
			const span = volumeSwipeSpan();
			const next = clamp(startVolume - (dy / span), 0, 1);

			setVolume(next, 'slide', dx, dy);
		}

		function applyHorizontal(dx, dy){
			if (Math.abs(dx) < thresholdPx) return;

			if (dx > 0) {
				log('swipe right -> prev');
				ctx.command('cmd:prev', {
					via: 'gesture',
					dx: dx,
					dy: dy
				});
				return;
			}

			log('swipe left -> next');
			ctx.command('cmd:next', {
				via: 'gesture',
				dx: dx,
				dy: dy
			});
		}

		function onPointerDown(e){
			if (!node || !node.contains(e.target)) return;
			if (e.pointerType === 'touch') return;
			if (e.button != null && e.button !== 0) return;

			start(e.clientX, e.clientY, e.pointerId, 'pointer');
			if (node.setPointerCapture && e.pointerId != null) {
				try { node.setPointerCapture(e.pointerId); } catch (er) {}
			}
			e.preventDefault();
		}

		function onPointerMove(e){
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			if (!active || touchMode !== 'pointer') return;
			if (pointerId != null && e.pointerId != null && e.pointerId !== pointerId) return;

			move(e.clientX, e.clientY);
			detectMode(dx, dy);

			if (dragMode === 'y') applyVertical(dx, dy);

			e.preventDefault();
		}

		function onPointerEnd(e){
			const dx = lastX - startX;
			const dy = lastY - startY;

			if (!active || touchMode !== 'pointer') return;
			if (pointerId != null && e.pointerId != null && e.pointerId !== pointerId) return;

			setPress(false);

			if (dragMode === 'x') applyHorizontal(dx, dy);
			else if (dragMode === 'y') applyVertical(dx, dy);
			else if (Math.abs(dx) <= tapMaxPx && Math.abs(dy) <= tapMaxPx) togglePlayback(dx, dy);
			else detectMode(dx, dy);

			endSwipe();
			e.preventDefault();
		}

		function onPointerCancel(){
			if (touchMode !== 'pointer') return;
			setPress(false);
			endSwipe();
		}

		function onTouchStart(e){
			let pt = null;

			if (!node || !node.contains(e.target)) return;

			if (!active) {
				if (e.touches.length === 1) {
					pt = touchPoint(e.touches, 1);
					if (!pt) return;
					start(pt.x, pt.y, null, 'single');
					e.preventDefault();
					return;
				}

				if (e.touches.length >= 2) {
					pt = touchPoint(e.touches, 2);
					if (!pt) return;
					start(pt.x, pt.y, null, 'double');
					e.preventDefault();
					return;
				}

				return;
			}

			if (touchMode === 'single' && e.touches.length >= 2) {
				pt = touchPoint(e.touches, 2);
				if (!pt) return;
				start(pt.x, pt.y, null, 'double');
				e.preventDefault();
			}
		}

		function onTouchMove(e){
			let pt = null;
			let dx = 0;
			let dy = 0;

			if (!active) return;

			if (touchMode === 'single') {
				pt = touchPoint(e.touches, 1);
				if (!pt) return;
				move(pt.x, pt.y);

				dx = pt.x - startX;
				dy = pt.y - startY;

				detectMode(dx, dy);

				if (dragMode === 'y') applyVertical(dx, dy);

				e.preventDefault();
				return;
			}

			if (touchMode === 'double') {
				pt = touchPoint(e.touches, 2);
				if (!pt) return;
				move(pt.x, pt.y);
				e.preventDefault();
			}
		}

		function onTouchEnd(e){
			const dx = lastX - startX;
			const dy = lastY - startY;

			if (!active) return;

			if (touchMode === 'double') {
				if (e.touches && e.touches.length) {
					e.preventDefault();
					return;
				}

				setPress(false);

				if (
					dy > thresholdPx &&
					Math.abs(dy) > Math.abs(dx) * axisRatio
				) {
					runLogsGesture(dx, dy);
				}

				endSwipe();
				e.preventDefault();
				return;
			}

			setPress(false);

			if (dragMode === 'x') applyHorizontal(dx, dy);
			else if (dragMode === 'y') applyVertical(dx, dy);
			else if (Math.abs(dx) <= tapMaxPx && Math.abs(dy) <= tapMaxPx) togglePlayback(dx, dy);
			else detectMode(dx, dy);

			endSwipe();
			e.preventDefault();
		}

		function onTouchCancel(){
			setPress(false);
			endSwipe();
		}

		listen('evt:volume', function(detail){
			if (!detail) return;
			if (isFinite(detail.volume)) volume = clamp(detail.volume, 0, 1);
			muted = !!detail.muted;
			if (!active) {
				startVolume = volume;
				lastSentVolume = volume;
			}
		});

		listen('state:change', function(detail){
			syncState(detail && detail.state);
		});

		if (!node) {
			log('no gesture area');
			return function(){};
		}

		node.style.touchAction = 'none';
		node.style.overscrollBehavior = 'none';
		if (docEl && docEl.style) docEl.style.overscrollBehaviorY = 'none';
		if (body && body.style) body.style.overscrollBehaviorY = 'none';

		node.addEventListener('pointerdown', onPointerDown);
		node.addEventListener('pointermove', onPointerMove);
		node.addEventListener('pointerup', onPointerEnd);
		node.addEventListener('pointercancel', onPointerCancel);

		node.addEventListener('touchstart', onTouchStart, { passive: false });
		node.addEventListener('touchmove', onTouchMove, { passive: false });
		node.addEventListener('touchend', onTouchEnd, { passive: false });
		node.addEventListener('touchcancel', onTouchCancel, { passive: false });

		return function(){
			let i = 0;

			node.removeEventListener('pointerdown', onPointerDown);
			node.removeEventListener('pointermove', onPointerMove);
			node.removeEventListener('pointerup', onPointerEnd);
			node.removeEventListener('pointercancel', onPointerCancel);

			node.removeEventListener('touchstart', onTouchStart);
			node.removeEventListener('touchmove', onTouchMove);
			node.removeEventListener('touchend', onTouchEnd);
			node.removeEventListener('touchcancel', onTouchCancel);

			if (node && node.style) node.style.overscrollBehavior = prevNodeOverscroll;
			if (docEl && docEl.style) docEl.style.overscrollBehaviorY = prevDocOverscrollY;
			if (body && body.style) body.style.overscrollBehaviorY = prevBodyOverscrollY;

			for (i = 0; i < off.length; i++) off[i]();
		};
	};

	a3m.PluginGesture = PluginGesture;
})();