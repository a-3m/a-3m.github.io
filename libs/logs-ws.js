(function(){
	if (window.__logs_ws_js_loaded) return;
	window.__logs_ws_js_loaded = 1;

	var u = new URL('/wsl', location.href);
	u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
	u.searchParams.set('page', location.pathname);

	var ws = 0;
	var q = [];
	var timer = 0;
	var maxq = 200;
	var started = 0;
	var stopped = 0;
	var sink = 0;

	function flush(){
		while (ws && ws.readyState === 1 && q.length) {
			ws.send(q.shift());
		}
	}

	function send(line){
		if (ws && ws.readyState === 1) {
			ws.send(line);
			return;
		}
		q.push(line);
		if (q.length > maxq) q.shift();
	}

	function reconnect(){
		if (stopped) return;
		timer && clearTimeout(timer);
		timer = setTimeout(connect, 1000);
	}

	function connect(){
		try {
			ws = new WebSocket(u.href);

			ws.onopen = function(){
				flush();
			};

			ws.onclose = function(){
				ws = 0;
				reconnect();
			};

			ws.onerror = function(){};

			ws.onmessage = function(){};
		} catch (e) {
			reconnect();
		}
	}

	function start(){
		if (started || !window.__logs) return;
		started = 1;
		sink = function(line){
			send(line);
		};
		window.__logs.addSink(sink);
		connect();
	}

	function stop(){
		stopped = 1;
		timer && clearTimeout(timer);
		timer = 0;

		if (window.__logs && sink) {
			window.__logs.removeSink(sink);
		}

		if (ws) {
			try { ws.close(); }
			catch (e) {}
		}

		ws = 0;
	}

	function boot(){
		if (window.__logs) {
			start();
			return;
		}
		setTimeout(boot, 100);
	}

	window.__logs_ws = {
		start: function(){
			if (!stopped) return;
			stopped = 0;
			started = 0;
			boot();
		},
		stop: function(){
			stop();
		},
		send: function(line){
			send(String(line));
		},
		flush: function(){
			flush();
		},
		url: function(){
			return u.href;
		}
	};

	boot();
})();