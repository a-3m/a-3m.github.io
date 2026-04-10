(function(){
	if (window.__logs_local_js_loaded) return;
	window.__logs_local_js_loaded = 1;

	var maxBytes = 4 * 1024 * 1024;
	var purgeIntervalMs = 60 * 1000;

	var key = '';
	var text = '';
	var dirty = 0;
	var loaded = 0;
	var started = 0;
	var sink = 0;

	function pad2(n){
		return n < 10 ? '0' + n : '' + n;
	}

	function ymd(){
		var d = new Date();
		return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
	}

	function safeName(s){
		s = String(s || '').replace(/^\/+/, '');
		s = s.replace(/[^\w.-]+/g, '-');
		s = s.replace(/-+/g, '-');
		s = s.replace(/^-+|-+$/g, '');
		return s || 'page';
	}

	function storeKey(){
		return 'logs:' + safeName(location.pathname);
	}

	function trimKeepTail(s, lim){
		var cut;

		if (s.length <= lim) return s;
		cut = s.length - lim;
		cut = s.indexOf('\n', cut);
		if (cut < 0) return s.slice(-lim);
		return s.slice(cut + 1);
	}

	function load(){
		if (loaded) return;

		key = storeKey();

		try { text = localStorage.getItem(key) || ''; }
		catch (e) {}

		loaded = 1;
	}

	function purge(){
		if (!loaded || !dirty) return;

		try {
			localStorage.setItem(key, text);
			dirty = 0;
			return;
		} catch (e) {}

		text = trimKeepTail(text, Math.floor(maxBytes * 0.75));

		try {
			localStorage.setItem(key, text);
			dirty = 0;
		} catch (e2) {}
	}

	function append(line){
		load();
		text += String(line) + '\n';
		text = trimKeepTail(text, maxBytes);
		dirty = 1;
	}

	function getText(){
		load();
		return text;
	}

	function fileName(name){
		return name || ('logs-' + safeName(location.pathname) + '-' + ymd() + '.log');
	}

	function download(name){
		var blob = new Blob([getText()], { type: 'text/plain;charset=utf-8' });
		var href = URL.createObjectURL(blob);
		var a = document.createElement('a');
		var root = document.body || document.documentElement;

		a.href = href;
		a.download = fileName(name);
		a.style.display = 'none';
		root.appendChild(a);
		a.click();

		setTimeout(function(){
			URL.revokeObjectURL(href);
			if (a.parentNode) a.parentNode.removeChild(a);
		}, 1000);

		return a.download;
	}

	function reset(){
		load();
		text = '';
		dirty = 0;
		try { localStorage.removeItem(key); }
		catch (e) {}
	}

	function start(){
		if (started || !window.__logs) return;
		started = 1;
		sink = function(line){
			append(line);
		};
		window.__logs.addSink(sink);
	}

	function stop(){
		if (!started) return;
		started = 0;
		if (window.__logs && sink) window.__logs.removeSink(sink);
		sink = 0;
		purge();
	}

	function boot(){
		if (window.__logs) {
			start();
			return;
		}
		setTimeout(boot, 100);
	}

	window.__logs_local = {
		start: function(){
			boot();
		},
		stop: function(){
			stop();
		},
		getText: function(){
			return getText();
		},
		download: function(name){
			return download(name);
		},
		reset: function(){
			reset();
		},
		purge: function(){
			purge();
		}
	};

	window.__logs_local_download = function(name){
		return download(name);
	};

	window.__logs_local_reset = function(){
		reset();
	};

	window.__logs_local_purge = function(){
		purge();
	};

	window.addEventListener('logs-local-download', function(e){
		var d = e && e.detail ? e.detail : {};
		download(d.name);
	});

	window.addEventListener('logs-local-reset', function(){
		reset();
	});

	window.addEventListener('logs-local-purge', function(){
		purge();
	});

	window.addEventListener('message', function(e){
		var d = e && e.data ? e.data : 0;

		if (!d || typeof d !== 'object') return;
		if (d.logsLocal === 'download') download(d.name);
		if (d.logsLocal === 'reset') reset();
		if (d.logsLocal === 'purge') purge();
	});

	window.addEventListener('pagehide', purge);
	window.addEventListener('beforeunload', purge);
	document.addEventListener('visibilitychange', function(){
		if (document.visibilityState !== 'hidden') return;
		purge();
	});

	setInterval(purge, purgeIntervalMs);

	load();
	boot();
})();