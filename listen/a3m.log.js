/* file: a3m.log.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const root = window;
	const a3m = root.a3m || (root.a3m = {});
	const c = root.console || {};

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function bindConsole(name, fallback){
		const fn = c[name] || c[fallback] || function(){};

		if (typeof fn.bind === 'function') return fn.bind(c);

		return function(){
			return fn.apply(c, arguments);
		};
	}

	function prefixed(fn, prefix){
		return function(){
			const args = [].slice.call(arguments);

			if (prefix) args.unshift(prefix);

			return fn.apply(null, args);
		};
	}

	const logConsole = bindConsole('log', 'log');

	a3m.log = typeof a3m.log === 'function' ? a3m.log : logConsole;
	a3m.warn = typeof a3m.warn === 'function' ? a3m.warn : bindConsole('warn', 'log');
	a3m.err = typeof a3m.err === 'function' ? a3m.err : bindConsole('error', 'log');
	a3m.debugEnabled = !!(a3m.debugEnabled || root.A3M_DEBUG);

	a3m.debug = typeof a3m.debug === 'function' ? a3m.debug : function(){
		if (!a3m.debugEnabled) return;
		return logConsole.apply(null, arguments);
	};

	a3m.logp = function(prefix){
		prefix = cleanText(prefix);
		if (prefix) a3m.log(prefix, 'load');

		return {
			log: prefixed(a3m.log, prefix),
			debug: prefixed(a3m.debug, prefix),
			warn: prefixed(a3m.warn, prefix),
			err: prefixed(a3m.err, prefix)
		};
	};
})();