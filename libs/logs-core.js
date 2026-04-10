(function(){
	if (window.__logs_core_js_loaded) return;
	window.__logs_core_js_loaded = 1;

	var levels = {
		log: ':',
		info: 'i',
		warn: 'w',
		error: 'e',
		debug: 'd'
	};

	var sinks = [];
	var buf = [];
	var maxbuf = 200;

	var raw = {
		log: console.log,
		info: console.info,
		warn: console.warn,
		error: console.error,
		debug: console.debug
	};

	function pad2(n){
		return n < 10 ? '0' + n : '' + n;
	}

	function hms(){
		var d = new Date();
		return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
	}

	function fmt(v){
		if (v instanceof Error) return v.stack || v.message || String(v);
		if (typeof v === 'string') return v;
		if (typeof v === 'undefined') return 'undefined';
		try { return JSON.stringify(v); }
		catch (e) {}
		try { return String(v); }
		catch (e2) {}
		return '[unprintable]';
	}

	function joinArgs(args){
		return Array.prototype.slice.call(args).map(fmt).join(' ');
	}

	function line(type, msg){
		return hms() + ' [' + type + '] ' + String(msg);
	}

	function keep(lineText, type, msg){
		buf.push({
			line: lineText,
			type: type,
			msg: msg
		});
		if (buf.length > maxbuf) buf.shift();
	}

	function emitToSinks(lineText, type, msg){
		var i;

		keep(lineText, type, msg);

		for (i = 0; i < sinks.length; i++) {
			try {
				sinks[i](lineText, type, msg);
			} catch (e) {}
		}
	}

	function emit(type, msg){
		var s = String(msg);
		var l = line(type, s);

		emitToSinks(l, type, s);
		return l;
	}

	function collect(type, args){
		return emit(type, joinArgs(args));
	}

	function addSink(fn, replay){
		var i;

		if (typeof fn !== 'function') return fn;

		for (i = 0; i < sinks.length; i++) {
			if (sinks[i] === fn) return fn;
		}

		sinks.push(fn);

		if (replay === 0) return fn;

		for (i = 0; i < buf.length; i++) {
			try {
				fn(buf[i].line, buf[i].type, buf[i].msg);
			} catch (e) {}
		}

		return fn;
	}

	function removeSink(fn){
		var i;

		for (i = 0; i < sinks.length; i++) {
			if (sinks[i] !== fn) continue;
			sinks.splice(i, 1);
			return fn;
		}

		return fn;
	}

	function makeLogger(name, type){
		return function(){
			raw[name].apply(console, arguments);
			collect(type, arguments);
		};
	}

	function installConsoleHooks(){
		var name;

		for (name in levels) {
			if (!Object.prototype.hasOwnProperty.call(levels, name)) continue;
			console[name] = makeLogger(name, levels[name]);
		}
	}

	window.__logs = {
		raw: raw,
		fmt: fmt,
		line: line,
		log: function(type, msg){
			return emit(type, msg);
		},
		addSink: function(fn, replay){
			return addSink(fn, replay);
		},
		removeSink: function(fn){
			return removeSink(fn);
		},
		getBuffer: function(){
			return buf.slice();
		}
	};

	installConsoleHooks();

	window.addEventListener('error', function(e){
		emit('e', [
			e.message || 'error',
			e.filename || '',
			e.lineno || 0,
			e.colno || 0
		].join(' '));
	});

	window.addEventListener('unhandledrejection', function(e){
		emit('e', fmt(e.reason));
	});

	emit('i', 'logs-core start ' + location.pathname);
	emit('i', 'ua ' + navigator.userAgent);
})();