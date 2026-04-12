/* file: a3m.plugin.coverbg.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log } = a3m.logp('coverbg');

	function coverValue(s){
		return String(s == null ? '' : s).trim();
	}

	function coverSetFromState(state){
		const meta = state && state.meta ? state.meta : {};
		const track = state && state.currentTrack ? state.currentTrack : null;
		const cover = coverValue(track && track.cover || meta.cover || '');
		const cover512 = coverValue(meta.cover512 || cover || '');
		const cover256 = coverValue(meta.cover256 || cover512 || cover || '');

		return {
			cover: cover,
			cover512: cover512,
			cover256: cover256
		};
	}

	function cssUrl(s){
		return String(s == null ? '' : s)
			.replace(/\\/g, '\\\\')
			.replace(/"/g, '\\"');
	}

	function imageValue(src){
		return src ? ('url("' + cssUrl(src) + '")') : 'none';
	}

	function uniqueNodes(list){
		const out = [];
		let i = 0;

		list = Array.isArray(list) ? list : [];

		for (i = 0; i < list.length; i++) {
			if (!list[i] || !list[i].style) continue;
			if (out.indexOf(list[i]) >= 0) continue;
			out.push(list[i]);
		}

		return out;
	}

	function captureNode(node){
		return {
			vars: {
				'--a3m-cover-image': node.style.getPropertyValue('--a3m-cover-image'),
				'--a3m-cover-image-512': node.style.getPropertyValue('--a3m-cover-image-512'),
				'--a3m-cover-image-256': node.style.getPropertyValue('--a3m-cover-image-256')
			},
			hasCover: node.hasAttribute('data-has-cover') ? node.getAttribute('data-has-cover') : null
		};
	}

	function restoreNode(node, prev){
		let name = '';

		prev = prev || {};
		prev.vars = prev.vars || {};

		for (name in prev.vars) {
			if (!Object.prototype.hasOwnProperty.call(prev.vars, name)) continue;

			if (prev.vars[name]) node.style.setProperty(name, prev.vars[name]);
			else node.style.removeProperty(name);
		}

		if (prev.hasCover != null) node.setAttribute('data-has-cover', prev.hasCover);
		else node.removeAttribute('data-has-cover');
	}

	function applyNode(node, set){
		const hasCover = !!(set && set.cover);

		node.style.setProperty('--a3m-cover-image', imageValue(set && set.cover || ''));
		node.style.setProperty('--a3m-cover-image-512', imageValue(set && set.cover512 || ''));
		node.style.setProperty('--a3m-cover-image-256', imageValue(set && set.cover256 || ''));

		if (hasCover) node.setAttribute('data-has-cover', '1');
		else node.removeAttribute('data-has-cover');
	}

	function sameSet(a, b){
		a = a || {};
		b = b || {};

		return (
			(a.cover || '') === (b.cover || '') &&
			(a.cover512 || '') === (b.cover512 || '') &&
			(a.cover256 || '') === (b.cover256 || '')
		);
	}

	function PluginCoverBg(opts){
		this.options = opts || {};
	}

	PluginCoverBg.prototype.attach = function(ctx){
		const bus = ctx.bus;
		const off = [];
		const nodes = uniqueNodes(this.options.nodes || [ document.documentElement, ctx.root ]);
		const prevState = [];
		let lastSet = null;
		let i = 0;

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function apply(){
			const set = coverSetFromState(ctx.getState());

			if (!nodes.length) return;
			if (sameSet(set, lastSet)) return;

			lastSet = {
				cover: set.cover,
				cover512: set.cover512,
				cover256: set.cover256
			};

			for (i = 0; i < nodes.length; i++) {
				applyNode(nodes[i], set);
			}

			log(set.cover ? 'publish' : 'clear');
		}

		for (i = 0; i < nodes.length; i++) {
			prevState[i] = captureNode(nodes[i]);
		}

		listen('evt:meta', apply);
		apply();

		return function(){
			let i = 0;

			for (i = 0; i < off.length; i++) off[i]();
			for (i = 0; i < nodes.length; i++) restoreNode(nodes[i], prevState[i]);
		};
	};

	a3m.PluginCoverBg = PluginCoverBg;
})();