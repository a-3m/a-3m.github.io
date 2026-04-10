/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const A3M = window.A3M || (window.A3M = {});

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function coverFromState(state){
		const meta = state && state.meta ? state.meta : {};
		const track = state && state.currentTrack ? state.currentTrack : null;

		return cleanText(track && track.cover || meta.cover || '');
	}

	function cssUrl(s){
		return String(s == null ? '' : s)
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"');
	}

	function uniqueNodes(list){
		const out = [];
		let i = 0;

		for (i = 0; i < list.length; i++) {
			if (!list[i] || !list[i].style) continue;
			if (out.indexOf(list[i]) >= 0) continue;
			out.push(list[i]);
		}

		return out;
	}

	function PluginCoverBg(opts){
		this.options = opts || {};
	}

	PluginCoverBg.prototype.attach = function(ctx){
		const plog = ctx.plog.child('coverbg');
		const bus = ctx.bus;
		const off = [];
		const nodes = uniqueNodes(
			this.options.nodes ||
			[
				document.documentElement,
				document.body
			]
		);
		let lastCover = '';

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function setStyles(cover){
			let i = 0;
			let node = null;

			for (i = 0; i < nodes.length; i++) {
				node = nodes[i];

				if (!cover) {
					node.style.backgroundImage = '';
					node.style.backgroundPosition = '';
					node.style.backgroundSize = '';
					node.style.backgroundRepeat = '';
					node.style.backgroundAttachment = '';
					continue;
				}

				node.style.backgroundImage = 'url("' + cssUrl(cover) + '")';
				node.style.backgroundPosition = 'center center';
				node.style.backgroundSize = 'cover';
				node.style.backgroundRepeat = 'no-repeat';
				node.style.backgroundAttachment = 'fixed';
			}
		}

		function apply(){
			const state = ctx.getState();
			const cover = coverFromState(state);

			if (!nodes.length) return;
			if (cover === lastCover) return;

			lastCover = cover;
			setStyles(cover);
			plog.log(cover ? 'apply' : 'clear');
		}

		listen('evt:meta', apply);
		apply();

		return function(){
			let i = 0;

			for (i = 0; i < off.length; i++) off[i]();
		};
	};

	A3M.PluginCoverBg = PluginCoverBg;
})();