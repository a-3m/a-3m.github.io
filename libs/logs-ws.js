(function(){
	if (window.__logs_ws_js_loaded) return;
	window.__logs_ws_js_loaded = 1;

	var cfg = window.__logs_cfg || {};
	var u = new URL(cfg.wsPath || '/wsl', location.href);
	u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	u.searchParams.set('page', cfg.page || location.pathname);
	if (cfg.id) u.searchParams.set('id', cfg.id);

	var ws = 0;
	var q = [];
	var timer = 0;
	var bootTimer = 0;
	var maxq = 200;
	var started = 0;
	var stopped = 0;
	var sink = 0;
	var listeners = {};

	function ready(){
		return !!(ws && ws.readyState === 1);
	}

	function emit(name, detail){
		var list = (listeners[name] || []).slice(0);
		var i;

		detail = detail || {};
		detail.name = name;

		for (i = 0; i < list.length; i++) {
			try {
				list[i](detail);
			} catch (e) {}
		}

		try {
			window.dispatchEvent(new CustomEvent('logs-ws:' + name, { detail: detail }));
		} catch (e2) {}
	}

	function on(name, fn){
		name = String(name || '');
		if (!name || typeof fn !== 'function') return fn;
		if (!listeners[name]) listeners[name] = [];
		if (listeners[name].indexOf(fn) >= 0) return fn;
		listeners[name].push(fn);
		return fn;
	}

	function off(name, fn){
		var list;
		var i;

		name = String(name || '');
		list = listeners[name] || [];

		for (i = 0; i < list.length; i++) {
			if (list[i] !== fn) continue;
			list.splice(i, 1);
			return fn;
		}

		return fn;
	}

	function encode(line){
		if (typeof line === 'string') return line;
		if (typeof line === 'undefined') return 'undefined';
		try { return JSON.stringify(line); }
		catch (e) {}
		try { return String(line); }
		catch (e2) {}
		return '[unprintable]';
	}

	function flush(){
		var sent = 0;
		var line;

		while (ready() && q.length) {
			line = q.shift();
			ws.send(line);
			sent++;
			emit('send', {
				data: line,
				queued: q.length,
				flush: 1
			});
		}

		if (sent) {
			emit('drain', {
				count: sent,
				queued: q.length
			});
		}
	}

	function send(line){
		line = encode(line);

		if (ready()) {
			ws.send(line);
			emit('send', {
				data: line,
				queued: q.length
			});
			return;
		}

		q.push(line);
		if (q.length > maxq) q.shift();

		emit('queue', {
			data: line,
			queued: q.length
		});
	}

	function reconnect(){
		if (stopped) return;
		timer && clearTimeout(timer);
		timer = setTimeout(connect, 1000);
		emit('reconnect', {
			delay_ms: 1000,
			queued: q.length,
			url: u.href
		});
	}

	function connect(){
		var sock;

		timer && clearTimeout(timer);
		timer = 0;

		if (stopped) return;
		if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;

		try {
			sock = new WebSocket(u.href);
			ws = sock;

			emit('connect', {
				url: u.href,
				queued: q.length
			});

			sock.onopen = function(e){
				if (ws !== sock) return;

				emit('open', {
					event: e,
					url: u.href,
					queued: q.length
				});

				flush();
			};

			sock.onclose = function(e){
				if (ws === sock) ws = 0;

				emit('close', {
					event: e,
					code: e && typeof e.code === 'number' ? e.code : 0,
					reason: e && e.reason ? e.reason : '',
					wasClean: !!(e && e.wasClean),
					queued: q.length
				});

				reconnect();
			};

			sock.onerror = function(e){
				emit('error', {
					event: e,
					queued: q.length
				});
			};

			sock.onmessage = function(e){
				emit('message', {
					event: e,
					data: e && typeof e.data !== 'undefined' ? e.data : '',
					queued: q.length
				});
			};
		} catch (e) {
			ws = 0;

			emit('error', {
				error: e,
				queued: q.length
			});

			reconnect();
		}
	}

	function start(){
		if (stopped) stopped = 0;

		if (started) {
			if (!ready() && !timer) connect();
			return;
		}

		if (!window.__logs) {
			boot();
			return;
		}

		started = 1;
		sink = function(line){
			send(line);
		};
		window.__logs.addSink(sink);
		connect();

		emit('start', {
			url: u.href
		});
	}

	function stop(){
		stopped = 1;
		started = 0;

		timer && clearTimeout(timer);
		timer = 0;

		bootTimer && clearTimeout(bootTimer);
		bootTimer = 0;

		if (window.__logs && sink) {
			window.__logs.removeSink(sink);
		}

		sink = 0;

		if (ws) {
			try { ws.close(); }
			catch (e) {}
		}

		ws = 0;

		emit('stop', {
			queued: q.length
		});
	}

	function boot(){
		if (started || stopped) return;

		if (window.__logs) {
			start();
			return;
		}

		bootTimer && clearTimeout(bootTimer);
		bootTimer = setTimeout(boot, 100);
	}

	window.__logs_ws = {
		start: function(){
			start();
		},
		stop: function(){
			stop();
		},
		send: function(line){
			send(line);
		},
		sendJson: function(v){
			send(v);
		},
		flush: function(){
			flush();
		},
		url: function(){
			return u.href;
		},
		on: function(name, fn){
			return on(name, fn);
		},
		off: function(name, fn){
			return off(name, fn);
		},
		isOpen: function(){
			return ready();
		},
		readyState: function(){
			return ws ? ws.readyState : 3;
		},
		queueSize: function(){
			return q.length;
		}
	};

	boot();
})();