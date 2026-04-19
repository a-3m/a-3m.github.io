/* file: app.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	let promptEvent = null;

	function log(){
		console.log('a3m-app', ...arguments);
	}

	function warn(){
		console.warn('a3m-app', ...arguments);
	}

	console.warn('a3m-app', 'init');

	function standaloneMode(){
		return !!(
			window.matchMedia &&
			window.matchMedia('(display-mode: standalone)').matches
		);
	}

	function installButtons(){
		return document.querySelectorAll('[data-act="install-app"]');
	}

	function syncInstallButtons(){
		log("sync");
		const hide = !!(standaloneMode() || !promptEvent);
		const nodes = installButtons();
		let i = 0;
		for (i = 0; i < nodes.length; i++){
					log("sync: ", i);

		nodes[i].hidden = hide;
		}
	}

		function onInstallClick(e){
		log('click', { prompt: !!promptEvent });
		if (!promptEvent) {
			warn('install prompt missing');
			return;
		}
		if (e && e.preventDefault) e.preventDefault();

		promptEvent.prompt();
		promptEvent.userChoice.then(function(choice){
			log('install choice', choice && choice.outcome || '');
			promptEvent = null;
			syncInstallButtons();
		}).catch(function(err){
			warn('install choice failed', String(err && err.message || err));
			syncInstallButtons();
		});
	}

	function bindInstallButtons(){
		const nodes = installButtons();
		let i = 0;
		let node = null;

		for (i = 0; i < nodes.length; i++) {
			node = nodes[i];
			if (!node || node.__a3mInstallBound) continue;
			node.__a3mInstallBound = 1;
			node.addEventListener('click', onInstallClick);
		}
	}

	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.register('a3m.sw.js').then(function(reg){
			log('sw ok', { scope: reg.scope });
		}).catch(function(err){
			warn('sw fail', String(err && err.message || err));
		});
	} else {
		log('sw unsupported');
	}

	window.addEventListener('beforeinstallprompt', function(e){
		e.preventDefault();
		promptEvent = e;
		log('install prompt ready');
		bindInstallButtons();
		syncInstallButtons();
	});

	window.addEventListener('appinstalled', function(){
		log('installed');
		promptEvent = null;
		syncInstallButtons();
	});

	window.addEventListener('pageshow', function(){
		bindInstallButtons();
		syncInstallButtons();
	});

	window.addEventListener('focus', function(){
		bindInstallButtons();
		syncInstallButtons();
	});

	document.addEventListener('visibilitychange', function(){
		if (document.visibilityState !== 'visible') return;
		bindInstallButtons();
		syncInstallButtons();
	});

	bindInstallButtons();
	syncInstallButtons();
})();
