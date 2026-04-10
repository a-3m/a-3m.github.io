/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const A3M = window.A3M || (window.A3M = {});

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function Bus(){
		this.map = {};
	}

	Bus.prototype.on = function(type, fn){
		type = cleanText(type);
		if (!type || typeof fn !== 'function') return function(){};

		if (!this.map[type]) this.map[type] = [];
		this.map[type].push(fn);

		return this.off.bind(this, type, fn);
	};

	Bus.prototype.off = function(type, fn){
		const list = this.map[type];
		let i = 0;

		if (!list || !list.length) return;

		for (i = list.length - 1; i >= 0; i--) {
			if (list[i] === fn) list.splice(i, 1);
		}

		if (!list.length) delete this.map[type];
	};

	Bus.prototype.emit = function(type, detail){
		const list = (this.map[type] || []).slice();
		let i = 0;

		for (i = 0; i < list.length; i++) {
			try {
				list[i](detail, type);
			} catch (e) {
				console.error('[a3m] bus listener error', type, e);
			}
		}
	};

	A3M.Bus = Bus;
})();