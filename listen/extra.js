/* file: extra.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const root = document.querySelector('[data-role="app"]');
	const old = document.querySelector('.a3m-main-dummy-more[data-act="extra"]');
	const zone = old && old.closest ? old.closest('.a3m-control-zone') : null;
	const mqNarrow = window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
	const mqShort = window.matchMedia ? window.matchMedia('(orientation: landscape) and (max-height: 520px)') : null;
	const state = {
		forceBottom: 0
	};
	let host = null;
	let footer = null;
	let btn = null;
	let footerBtn = null;
	let pop = null;
	let close = null;
	let zoneObs = null;

	if (!root || !old) return;

	function buttonSvg(){
		return '' +
			'<svg viewBox="0 0 24 24" aria-hidden="true">' +
				'<path d="M12 21c-.3 0-.6-.1-.8-.3C4.8 15.6 2 12.5 2 8.8 2 5.9 4.2 4 6.9 4c2 0 3.8 1 5.1 2.7C13.3 5 15.1 4 17.1 4 19.8 4 22 5.9 22 8.8c0 3.7-2.8 6.8-9.2 11.9-.2.2-.5.3-.8.3z"/>' +
			'</svg>';
	}

	host = document.createElement('div');
	host.className = 'a3m-main-slot-extra a3m-extra-host';
	host.setAttribute('data-role', 'extra-host');
	host.setAttribute('data-open', '0');
	host.innerHTML = '' +
		'<button type="button" class="a3m-extra-btn" aria-label="Open extra">' +
			buttonSvg() +
		'</button>';

	footer = document.createElement('div');
	footer.className = 'a3m-extra-footer';
	footer.hidden = true;
	footer.setAttribute('data-role', 'extra-footer');
	footer.setAttribute('data-open', '0');
	footer.innerHTML = '' +
		'<button type="button" class="a3m-extra-btn" aria-label="Open extra">' +
			buttonSvg() +
		'</button>';

	pop = document.createElement('div');
	pop.className = 'a3m-extra-pop-layer';
	pop.hidden = true;
	pop.setAttribute('data-layout', 'anchor');
	pop.setAttribute('data-side', 'above');
	pop.innerHTML = '' +
		'<div class="a3m-extra-head">' +
			'<div class="a3m-extra-title">Test popup</div>' +
			'<button type="button" class="a3m-extra-close" aria-label="Close">×</button>' +
		'</div>' +
		'<div class="a3m-extra-body">Minimal heart button test. You can place any text, links, or small custom UI here.</div>';

	old.parentNode.replaceChild(host, old);
	root.appendChild(footer);
	root.appendChild(pop);

	btn = host.querySelector('.a3m-extra-btn');
	footerBtn = footer.querySelector('.a3m-extra-btn');
	close = pop.querySelector('.a3m-extra-close');

	function stop(e){
		if (!e) return;
		if (e.stopPropagation) e.stopPropagation();
	}

	function nodeShown(node){
		if (!node || node.hidden) return false;
		if (!node.getClientRects) return false;
		return !!node.getClientRects().length;
	}

	function isOpen(){
		return !pop.hidden;
	}

	function currentLayout(){
		if (mqShort && mqShort.matches)
			return 'bottom-left';
		if (state.forceBottom)
			return 'bottom';
		if (mqNarrow && mqNarrow.matches)
			return 'bottom';
		return 'anchor';
	}

	function activeAnchor(){
		if (nodeShown(host)) return host;
		return footer;
	}

	function syncButtons(){
		const mainVisible = nodeShown(host);

		footer.hidden = !!mainVisible;
		root.setAttribute('data-a3m-extra-footer', mainVisible ? '0' : '1');

		if (mainVisible) {
			footer.setAttribute('data-open', '0');
			if (isOpen()) host.setAttribute('data-open', '1');
		} else {
			host.setAttribute('data-open', '0');
			if (isOpen()) footer.setAttribute('data-open', '1');
		}
	}

	function setOpen(open){
		const shown = open ? 1 : 0;

		pop.hidden = !shown;
		host.setAttribute('data-open', shown ? '1' : '0');
		footer.setAttribute('data-open', shown ? '1' : '0');
		root.setAttribute('data-a3m-extra-open', shown ? '1' : '0');

		if (!shown) {
			state.forceBottom = 0;
			return;
		}

		placePop();
		if (window.requestAnimationFrame)
			window.requestAnimationFrame(placePop);
	}

	function toggle(){
		setOpen(pop.hidden);
	}

	function placeBottom(){
		pop.setAttribute('data-layout', 'bottom');
		pop.setAttribute('data-side', 'above');
		pop.style.left = '';
		pop.style.top = '';
		pop.style.right = '';
		pop.style.bottom = '';
	}

	function placeBottomLeft(){
		pop.setAttribute('data-layout', 'bottom-left');
		pop.setAttribute('data-side', 'above');
		pop.style.left = '';
		pop.style.top = '';
		pop.style.right = '';
		pop.style.bottom = '';
	}

	function placeAnchor(){
		const rr = root.getBoundingClientRect();
		const ar = activeAnchor().getBoundingClientRect();
		const gap = 10;
		const pad = 10;
		let left = 0;
		let top = 0;
		let maxLeft = 0;
		let maxTop = 0;
		let side = 'above';

		pop.setAttribute('data-layout', 'anchor');

		left = ar.left - rr.left;
		top = (ar.top - rr.top) - pop.offsetHeight - gap;
		maxLeft = rr.width - pop.offsetWidth - pad;
		maxTop = rr.height - pop.offsetHeight - pad;

		if (maxLeft < pad) maxLeft = pad;
		left = Math.max(pad, Math.min(left, maxLeft));

		if (top < pad) {
			top = (ar.bottom - rr.top) + gap;
			side = 'below';
		}

		if (maxTop < pad) maxTop = pad;
		top = Math.max(pad, Math.min(top, maxTop));

		pop.style.left = Math.round(left) + 'px';
		pop.style.top = Math.round(top) + 'px';
		pop.style.right = '';
		pop.style.bottom = '';
		pop.setAttribute('data-side', side);
	}

	function placePop(){
		const layout = currentLayout();

		syncButtons();
		if (!isOpen()) return;

		if (layout === 'bottom-left') {
			placeBottomLeft();
			return;
		}

		if (layout === 'bottom') {
			placeBottom();
			return;
		}

		placeAnchor();
	}

	function forceBottom(){
		if (!isOpen()) return;
		state.forceBottom = 1;
		placePop();
	}

	host.addEventListener('pointerdown', stop);
	host.addEventListener('click', stop);
	footer.addEventListener('pointerdown', stop);
	footer.addEventListener('click', stop);
	pop.addEventListener('pointerdown', stop);
	pop.addEventListener('click', stop);

	btn.addEventListener('click', function(e){
		stop(e);
		toggle();
	});

	footerBtn.addEventListener('click', function(e){
		stop(e);
		toggle();
	});

	close.addEventListener('click', function(e){
		stop(e);
		setOpen(0);
	});

	document.addEventListener('click', function(e){
		if (host.contains(e.target) || footer.contains(e.target) || pop.contains(e.target)) return;
		setOpen(0);
	});

	document.addEventListener('keydown', function(e){
		if (e.key === 'Escape')
			setOpen(0);
	});

	window.addEventListener('resize', function(){
		placePop();
	});

	window.addEventListener('orientationchange', function(){
		forceBottom();
	});

	window.addEventListener('blur', function(){
		forceBottom();
	});

	window.addEventListener('focus', function(){
		placePop();
	});

	window.addEventListener('pageshow', function(){
		placePop();
	});

	document.addEventListener('visibilitychange', function(){
		if (document.visibilityState !== 'visible') {
			forceBottom();
			return;
		}
		placePop();
	});

	window.addEventListener('scroll', function(){
		placePop();
	}, true);

	if (mqNarrow && mqNarrow.addEventListener) {
		mqNarrow.addEventListener('change', function(){
			placePop();
		});
	}

	if (mqShort && mqShort.addEventListener) {
		mqShort.addEventListener('change', function(){
			forceBottom();
		});
	}

	if (zone && window.MutationObserver) {
		zoneObs = new MutationObserver(function(){
			syncButtons();
			placePop();
		});
		zoneObs.observe(zone, {
			attributes: true,
			attributeFilter: ['hidden', 'style', 'class']
		});
	}

	syncButtons();
})();