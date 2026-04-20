/* file: test.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const id = window.__logs_cfg && window.__logs_cfg.id || 'a3m-sea-test';
	const uiWrapNode = document.querySelector('[data-role="ui-wrap"]');
	const coverNode = document.querySelector('[data-act="cover"]');
	const coverUiNode = document.querySelector('[data-role="cover-ui"]');
	const coverModeNode = document.querySelector('[data-role="cover-mode"]');
	const coverTitleNode = document.querySelector('[data-role="cover-title"]');
	const coverMsgNode = document.querySelector('[data-role="cover-msg"]');
	const coverSubNode = document.querySelector('[data-role="cover-sub"]');
	const coverFailNode = document.querySelector('[data-role="cover-fail"]');
	const coverLoopsNode = document.querySelector('[data-role="cover-loops"]');
	const coverUpNode = document.querySelector('[data-role="cover-up"]');
	const coverOnlineNode = document.querySelector('[data-role="cover-online"]');
	const coverEngineNode = document.querySelector('[data-role="cover-engine"]');
	const coverSourceNode = document.querySelector('[data-role="cover-source"]');
	const freezeNode = document.querySelector('[data-act="freeze-ui"]');
	const installNode = document.querySelector('[data-act="install-app"]');
	const modeSelectNode = document.querySelector('[data-act="mode-select"]');
	const themeNode = document.querySelector('meta[name="theme-color"]');
	const qrNode = document.querySelector('[data-role="qr"]');
	const shareLinkNode = document.querySelector('[data-role="share-link"]');
	const HasTouch = !!(
		('ontouchstart' in window) ||
		(navigator.maxTouchPoints > 0) ||
		(navigator.msMaxTouchPoints > 0)
	);

	const cfg = window.__a3m_test_cfg || { onlineMode: 6, logLevel: 3 };
	const ModeDefs = [
		{ value: 0, label: '0 - FIXED-SAFE' },
		{ value: 1, label: '1 - ACTIVE-ONE' },
		{ value: 2, label: '2 - SWAP-TWO' },
		{ value: 3, label: '3 - MIX-SWAP' },
		{ value: 6, label: '6 - SAFE+SWAP' }
	];

	function modeFromValue(v){
		let i = 0;
		const n = parseInt(v, 10);

		for (i = 0; i < ModeDefs.length; i++) {
			if (ModeDefs[i].value === n)
				return ModeDefs[i];
		}

		return null;
	}

	function queryMode(){
		let n = null;

		try {
			n = new URLSearchParams(window.location.search).get('mode');
		} catch (e) {
			n = null;
		}

		if (n == null || n === '')
			return null;

		return modeFromValue(n);
	}


	function currentLogLevel(){
		n = parseInt(cfg.logLevel, 10);
		if (!isFinite(n))
			return 0;
		if (n < 0)
			n = 0;
		if (n > 5)
			n = 5;
		return n;
	}

	function engineMode(){
		let info = queryMode();
		let n = 0;

		if (info)
			return info.value;

		n = parseInt(cfg.engineMode != null ? cfg.engineMode : cfg.onlineMode, 10);
		info = modeFromValue(n);
		return info ? info.value : 1;
	}

	function engineLabel(){
		const n = engineMode();

		if (n === 0) return 'FIXED';
		if (n === 2) return 'SWAP';
		if (n === 3) return 'MIXSWAP';
		if (n === 6) return 'SAFE+SWAP';
		return 'ACTIVE';
	}

	function engineUsesSwap(){
		const n = engineMode();

		return n === 2 || n === 3 || n === 6;
	}

	function engineUsesGraph(){
		return engineMode() === 3;
	}

	function engineUsesSafeLoop(){
		return engineMode() === 6;
	}

	function engineIgnoresFailSwap(){
		return engineMode() === 0;
	}

	function safeOnlineUrl(){
		return state.onlineUrls[0] || '';
	}

	function currentOnlineUrl(){
		if (!engineUsesSwap())
			return safeOnlineUrl();

		return state.onlineUrls[state.onlineIndex % state.onlineUrls.length] || '';
	}

	function currentBlobUrl(){
		if (state.mode === 'offline')
			return state.offlineUrl;

		return currentOnlineUrl();
	}

	function bgBlobUrl(){
		if (!engineUsesSafeLoop())
			return '';

		return safeOnlineUrl();
	}

	const state = {
		audio: null,
		bgAudio: null,
		onlineUrls: [],
		onlineIndex: 0,
		offlineUrl: '',
		pendingSeek: -1,
		pendingPlay: 0,
		pingTimer: 0,
		heartbeatTimer: 0,
		reviveTimer: 0,
		startedAt: Date.now(),
		loopSeconds: 7,
		mode: 'online',
		wantPlay: 1,
		needUserPlay: 0,
		otherInstance: 0,
		coverFrozen: 0,
		coverDirty: 0,
		colorIndex: 0,
		loopCount: 0,
		lastTime: 0,
		pingOk: 0,
		pingFail: 0,
		onlineAt: 0,
		onlineMs: 0,
		promptEvent: null,
		installed: 0,
		instanceId: String(Date.now()) + '-' + Math.random().toString(16).slice(2),
		instanceChannel: null,
		gesture: null,
		logLevel: currentLogLevel(),
		graph: {
			ctx: null,
			master: null,
			mediaSource: null,
			mediaGain: null,
			bedSource: null,
			bedGain: null,
			ready: 0
		},
		mediaArtwork: {
			online: [],
			offline: []
		},
		colors: [
			{ name: 'red', hex: '#8d2020' },
			{ name: 'amber', hex: '#8b5218' },
			{ name: 'gold', hex: '#807018' },
			{ name: 'olive', hex: '#51651f' },
			{ name: 'green', hex: '#215b30' },
			{ name: 'teal', hex: '#175c58' },
			{ name: 'azure', hex: '#1d527f' },
			{ name: 'indigo', hex: '#313e9d' },
			{ name: 'violet', hex: '#61359a' },
			{ name: 'rose', hex: '#8a2b63' }
		]
	};

	function log(){
		let level = 0;
		let off = 0;

		if (typeof arguments[0] === 'number' && isFinite(arguments[0])) {
			level = arguments[0];
			off = 1;
		}

		if (state.logLevel > level)
			return;

		console.log.apply(
			console,
			[ id ].concat(Array.prototype.slice.call(arguments, off))
		);
	}

	function warn(){
		console.warn(id, ...arguments);
	}

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function round1(n){
		n = parseFloat(n);
		if (!isFinite(n)) return 0;
		return Math.round(n * 10) / 10;
	}

	function formatClock(sec){
		let h = 0;
		let m = 0;
		let s = 0;

		sec = isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
		h = Math.floor(sec / 3600);
		m = Math.floor((sec % 3600) / 60);
		s = sec % 60;

		if (h > 0)
			return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');

		return m + ':' + String(s).padStart(2, '0');
	}

	function fitFontSize(ctx, text, weight, family, maxWidth, startSize, minSize){
		let size = startSize;

		while (size > minSize) {
			ctx.font = weight + ' ' + size + 'px ' + family;
			if (ctx.measureText(text).width <= maxWidth)
				return size;
			size -= 2;
		}

		return minSize;
	}

	function drawFitText(ctx, text, x, y, maxWidth, startSize, minSize, weight, family, fill){
		const size = fitFontSize(ctx, text, weight, family, maxWidth, startSize, minSize);

		ctx.font = weight + ' ' + size + 'px ' + family;
		ctx.fillStyle = fill;
		ctx.fillText(text, x, y);
		return size;
	}

	function currentColor(){
		return state.colors[state.colorIndex % state.colors.length];
	}

	function coverTitle(){
		const n = (state.colorIndex % state.colors.length) + 1;
		return 'Sea Loop ' + n;
	}

	function modeLabel(){
		return state.mode === 'offline' ? 'OFFLINE' : 'ONLINE';
	}

	function shareUrl(){
		return window.location.href;
	}

	function shareLabel(){
		return window.location.host + window.location.pathname + window.location.search;
	}

	function gestureBlockedTarget(target){
		return !!(target && target.closest && target.closest('[data-no-refresh="1"]'));
	}

	function safeUrl(url){
		url = String(url == null ? '' : url);
		if (url.indexOf('data:') === 0)
			return url.slice(0, 32) + '...';
		if (url.length > 160)
			return url.slice(0, 160) + '...';
		return url;
	}

	function mediaSupported(){
		return !!('mediaSession' in navigator && typeof window.MediaMetadata === 'function');
	}

	function onlineMsNow(){
		let ms = state.onlineMs;

		if (state.onlineAt)
			ms += Date.now() - state.onlineAt;

		return ms;
	}

	function hotSourceLabel(){
		if (state.mode === 'offline')
			return 'OFF';

		if (engineUsesSwap())
			return 'ON' + String((state.onlineIndex % state.onlineUrls.length) + 1);

		return 'ON1';
	}

	function sourceLabel(){
		if (engineUsesSafeLoop())
			return 'SOURCE SAFE ON1 / HOT ' + hotSourceLabel();

		return 'SOURCE HOT ' + hotSourceLabel();
	}

	function coverSnapshot(){
		let msg = '';
		let sub = '';

		if (state.otherInstance) {
			msg = 'ONE INSTANCE ONLY';
			sub = 'CLOSE OTHER TAB';
		} else if (state.needUserPlay) {
			msg = 'PRESS TO PLAY!';
			sub = 'AUTOPLAY BLOCKED';
		}

		return {
			color: currentColor(),
			title: coverTitle(),
			mode: modeLabel(),
			engine: engineLabel(),
			source: sourceLabel(),
			msg: msg,
			sub: sub,
			offline: state.mode === 'offline',
			lines: [
				'FAIL ' + state.pingFail,
				'LOOPS ' + state.loopCount,
				'UP ' + formatClock((Date.now() - state.startedAt) / 1000),
				'ONLINE ' + formatClock(onlineMsNow() / 1000),
				'ENGINE ' + engineLabel(),
				sourceLabel()
			]
		};
	}

	function mediaSnapshot(){
		return {
			color: currentColor(),
			title: coverTitle(),
			mode: modeLabel(),
			engine: engineLabel(),
			offline: state.mode === 'offline'
		};
	}

	function stepColor(step){
		const total = state.colors.length;

		if (!isFinite(step)) step = 0;
		state.colorIndex += step;
		while (state.colorIndex < 0) state.colorIndex += total;
		while (state.colorIndex >= total) state.colorIndex -= total;
	}

	function syncFreezeUi(){
		if (uiWrapNode)
			uiWrapNode.hidden = !!state.coverFrozen;
		if (!freezeNode) return;
		freezeNode.textContent = state.coverFrozen ? 'UI FROZEN' : 'LIVE UI';
		freezeNode.setAttribute('aria-pressed', state.coverFrozen ? 'true' : 'false');
	}

	function setCoverDirty(){
		state.coverDirty = 1;
	}

	function setThemeColor(color){
		if (!themeNode) return;
		themeNode.setAttribute('content', color);
	}

	function buildMediaArtwork(color, mode, title){
		const size = 512;
		const c = document.createElement('canvas');
		const x = c.getContext('2d');
		const pad = 16;
		const inner = size - (pad * 2);
		const maxWidth = inner - 20;
		const textFill = mode === 'OFFLINE'
			? 'rgba(255, 96, 96, 0.98)'
			: 'rgba(255, 255, 255, 0.94)';

		c.width = size;
		c.height = size;

		x.fillStyle = color.hex;
		x.fillRect(0, 0, size, size);

		x.fillStyle = 'rgba(0, 0, 0, 0.36)';
		x.fillRect(pad, pad, inner, inner);

		x.textAlign = 'center';
		x.textBaseline = 'top';

		drawFitText(
			x,
			mode,
			size / 2,
			24,
			maxWidth,
			110,
			54,
			'700',
			'Arial, sans-serif',
			textFill
		);

		drawFitText(
			x,
			title,
			size / 2,
			156,
			maxWidth,
			78,
			34,
			'700',
			'Arial, sans-serif',
			textFill
		);

		return c.toDataURL('image/png');
	}

	function buildMediaArtworkCache(){
		let i = 0;
		let title = '';

		state.mediaArtwork.online = [];
		state.mediaArtwork.offline = [];

		for (i = 0; i < state.colors.length; i++) {
			title = 'Sea Loop ' + (i + 1);
			state.mediaArtwork.online[i] = buildMediaArtwork(state.colors[i], 'ONLINE', title);
			state.mediaArtwork.offline[i] = buildMediaArtwork(state.colors[i], 'OFFLINE', title);
		}

		log(5, 'media artwork cache', {
			online: state.mediaArtwork.online.length,
			offline: state.mediaArtwork.offline.length
		});
	}

	function currentMediaArtworkUrl(){
		const list = state.mode === 'offline'
			? state.mediaArtwork.offline
			: state.mediaArtwork.online;

		return list[state.colorIndex % state.colors.length] || '';
	}

	function updateMediaPosition(){
		let duration = 0;
		let position = 0;
		let playbackRate = 1;

		if (!mediaSupported()) return;
		if (!navigator.mediaSession || typeof navigator.mediaSession.setPositionState !== 'function')
			return;
		if (!state.audio) return;

		duration = parseFloat(state.audio.duration);
		position = parseFloat(state.audio.currentTime);
		playbackRate = parseFloat(state.audio.playbackRate);

		if (!(duration > 0) || !isFinite(duration))
			return;

		if (!isFinite(position) || position < 0)
			position = 0;
		if (position > duration)
			position = duration;
		if (!(playbackRate > 0) || !isFinite(playbackRate))
			playbackRate = 1;

		try {
			navigator.mediaSession.setPositionState({
				duration: duration,
				playbackRate: playbackRate,
				position: position
			});
		} catch (e) {}
	}

	function updateMediaMeta(reason){
		const snap = mediaSnapshot();
		const data = {
			title: snap.title,
			artist: snap.mode + ' · ' + snap.engine + ' · loops ' + state.loopCount,
			album:
				'up ' + formatClock((Date.now() - state.startedAt) / 1000) +
				' · online ' + formatClock(onlineMsNow() / 1000) +
				' · fail ' + state.pingFail
		};
		const art = currentMediaArtworkUrl();

		if (!mediaSupported()) return;

		if (art) {
			data.artwork = [
				{ src: art, sizes: '512x512', type: 'image/png' }
			];
		}

		try {
			navigator.mediaSession.metadata = new MediaMetadata(data);
			navigator.mediaSession.playbackState = state.audio && !state.audio.paused ? 'playing' : 'paused';
			updateMediaPosition();
			log('media meta', {
				reason: cleanText(reason || ''),
				mode: snap.mode,
				engine: snap.engine,
				color: snap.color.name,
				art: !!art
			});
		} catch (e) {
			warn('media meta failed', String(e && e.message || e));
		}
	}

	function renderCover(reason, force){
		const snap = coverSnapshot();

		if (!coverNode || !coverUiNode) return;
		if (state.coverFrozen && !force) {
			setCoverDirty();
			return;
		}

		state.coverDirty = 0;
		coverNode.style.backgroundColor = snap.color.hex;
		coverNode.setAttribute('title', snap.title);
		coverNode.setAttribute('aria-label', snap.title);
		document.title = snap.title;
		setThemeColor(snap.color.hex);
		coverUiNode.classList.toggle('is-offline', !!snap.offline);

		if (coverModeNode)
			coverModeNode.textContent = snap.mode;
		if (coverTitleNode)
			coverTitleNode.textContent = snap.title;
		if (coverFailNode)
			coverFailNode.textContent = snap.lines[0];
		if (coverLoopsNode)
			coverLoopsNode.textContent = snap.lines[1];
		if (coverUpNode)
			coverUpNode.textContent = snap.lines[2];
		if (coverOnlineNode)
			coverOnlineNode.textContent = snap.lines[3];
		if (coverEngineNode)
			coverEngineNode.textContent = snap.lines[4];
		if (coverSourceNode)
			coverSourceNode.textContent = snap.lines[5];

		if (coverMsgNode) {
			coverMsgNode.hidden = !snap.msg;
			coverMsgNode.textContent = snap.msg;
		}

		if (coverSubNode) {
			coverSubNode.hidden = !snap.sub;
			coverSubNode.textContent = snap.sub;
		}

		updateMediaMeta(reason || 'cover');

		log('cover render', {
			reason: cleanText(reason || ''),
			index: state.colorIndex,
			color: snap.color.name,
			mode: snap.mode,
			engine: snap.engine,
			source: snap.source,
			online: formatClock(onlineMsNow() / 1000),
			frozen: state.coverFrozen
		});
	}

	function syncVisual(reason){
		if (state.coverFrozen) {
			updateMediaMeta(reason || 'media');
			return;
		}

		renderCover(reason || 'cover');
	}

	function setGraphGain(node, value){
		const ctx = state.graph.ctx;

		if (!node || !node.gain) return;
		if (ctx && node.gain.cancelScheduledValues && node.gain.setTargetAtTime) {
			node.gain.cancelScheduledValues(ctx.currentTime);
			node.gain.setTargetAtTime(value, ctx.currentTime, 0.05);
			return;
		}

		node.gain.value = value;
	}

	function buildGraphBedBuffer(ctx){
		const sampleRate = ctx.sampleRate || 48000;
		const seconds = state.loopSeconds;
		const fadeSec = 1;
		const totalFrames = Math.max(1, Math.floor(sampleRate * seconds));
		const buf = ctx.createBuffer(2, totalFrames, sampleRate);
		const left = buf.getChannelData(0);
		const right = buf.getChannelData(1);
		let noiseL = 0;
		let noiseR = 0;
		let airL = 0;
		let airR = 0;
		let hushL = 0;
		let hushR = 0;
		let swell = 0;
		let gust = 0;
		let env = 1;
		let t = 0;
		let a = 0;
		let b = 0;
		let i = 0;

		for (i = 0; i < totalFrames; i++) {
			t = i / sampleRate;
			noiseL = (noiseL * 0.9972) + ((Math.random() * 2 - 1) * 0.0032);
			noiseR = (noiseR * 0.9970) + ((Math.random() * 2 - 1) * 0.0030);
			airL = (airL * 0.991) + ((Math.random() * 2 - 1) * 0.0024);
			airR = (airR * 0.990) + ((Math.random() * 2 - 1) * 0.0025);
			hushL = (hushL * 0.9984) + ((Math.random() * 2 - 1) * 0.0011);
			hushR = (hushR * 0.9981) + ((Math.random() * 2 - 1) * 0.0012);
			gust = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t * 0.048 + 0.3 * Math.sin(Math.PI * 2 * t * 0.013));
			swell = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t * 0.091 + 0.7);

			a =
				(noiseL * (0.014 + (gust * 0.010))) +
				(airL * (0.010 + (swell * 0.008))) +
				(hushL * 0.020) +
				(Math.sin(Math.PI * 2 * t * 74) * 0.0016) +
				(Math.sin(Math.PI * 2 * t * (103 + 6 * Math.sin(Math.PI * 2 * t * 0.08))) * 0.0011);

			b =
				(noiseR * (0.014 + (gust * 0.010))) +
				(airR * (0.010 + (swell * 0.008))) +
				(hushR * 0.020) +
				(Math.sin(Math.PI * 2 * t * 79) * 0.0015) +
				(Math.sin(Math.PI * 2 * t * (109 + 7 * Math.sin(Math.PI * 2 * t * 0.07 + 0.8))) * 0.0010);

			if (t < fadeSec) {
				env = t / fadeSec;
			} else if (t > seconds - fadeSec) {
				env = (seconds - t) / fadeSec;
			} else {
				env = 1;
			}

			if (env < 0) env = 0;
			if (env > 1) env = 1;

			left[i] = a * env * 0.95;
			right[i] = b * env * 0.95;
		}

		return buf;
	}

	function syncEngineGraph(reason){
		let mediaLevel = 0;
		let bedLevel = 0;

		if (!engineUsesGraph() || !state.graph.ready) return;

		if (state.wantPlay && !state.otherInstance) {
			mediaLevel = 1;
			bedLevel = state.mode === 'offline' ? 0.13 : 0.18;
		}

		setGraphGain(state.graph.mediaGain, mediaLevel);
		setGraphGain(state.graph.bedGain, bedLevel);

		log('graph mix', {
			reason: cleanText(reason || ''),
			media: round1(mediaLevel),
			bed: round1(bedLevel),
			ctx: state.graph.ctx && state.graph.ctx.state || ''
		});
	}

	function resumeEngineGraph(reason){
		if (!engineUsesGraph() || !state.graph.ctx || typeof state.graph.ctx.resume !== 'function')
			return;
		if (state.graph.ctx.state === 'running') {
			syncEngineGraph(reason || 'graph-running');
			return;
		}

		state.graph.ctx.resume().then(function(){
			log('graph resume ok', {
				reason: cleanText(reason || ''),
				state: state.graph.ctx && state.graph.ctx.state || ''
			});
			syncEngineGraph(reason || 'graph-resume-ok');
		}).catch(function(err){
			warn('graph resume failed', {
				reason: cleanText(reason || ''),
				err: String(err && err.message || err)
			});
		});
	}

	function initEngineGraph(){
		let AudioCtx = null;
		let ctx = null;
		let master = null;
		let mediaGain = null;
		let bedGain = null;
		let mediaSource = null;
		let bedSource = null;

		if (!engineUsesGraph() || !state.audio) return;
		AudioCtx = window.AudioContext || window.webkitAudioContext;
		if (!AudioCtx) {
			warn('graph unsupported');
			return;
		}

		try {
			ctx = new AudioCtx();
			master = ctx.createGain();
			mediaGain = ctx.createGain();
			bedGain = ctx.createGain();
			mediaSource = ctx.createMediaElementSource(state.audio);
			bedSource = ctx.createBufferSource();

			bedSource.buffer = buildGraphBedBuffer(ctx);
			bedSource.loop = true;

			mediaSource.connect(mediaGain);
			bedSource.connect(bedGain);
			mediaGain.connect(master);
			bedGain.connect(master);
			master.connect(ctx.destination);

			state.graph.ctx = ctx;
			state.graph.master = master;
			state.graph.mediaSource = mediaSource;
			state.graph.mediaGain = mediaGain;
			state.graph.bedSource = bedSource;
			state.graph.bedGain = bedGain;
			state.graph.ready = 1;

			setGraphGain(mediaGain, 0);
			setGraphGain(bedGain, 0);
			bedSource.start(0);
			syncEngineGraph('graph-init');
			log(4, 'graph ready', {
				sampleRate: ctx.sampleRate,
				state: ctx.state,
				engine: engineLabel()
			});
		} catch (e) {
			warn('graph init failed', String(e && e.message || e));
		}
	}

	function setOnline(flag, reason){
		flag = flag ? 1 : 0;

		if (flag) {
			if (!state.onlineAt)
				state.onlineAt = Date.now();
		} else if (state.onlineAt) {
			state.onlineMs += Date.now() - state.onlineAt;
			state.onlineAt = 0;
		}

		log(cleanText(reason || '') === 'bootstrap' ? 5 : 4, 'online state', {
			reason: cleanText(reason || ''),
			online: !!flag,
			duration: formatClock(onlineMsNow() / 1000)
		});
		setCoverDirty();
	}

	function setNeedUserPlay(flag, reason){
		flag = flag ? 1 : 0;
		if (state.needUserPlay === flag) return;
		state.needUserPlay = flag;
		log(5, 'needUserPlay', { need: flag, reason: cleanText(reason || '') });
		syncEngineGraph('need-user-play');
		syncBgAudio('need-user-play');
		syncVisual('need-user-play');
	}

	function setOtherInstance(flag, reason){
		flag = flag ? 1 : 0;
		if (state.otherInstance === flag) return;
		state.otherInstance = flag;
		log(5, 'otherInstance', { other: flag, reason: cleanText(reason || '') });

		if (flag && state.audio) {
			try { state.audio.pause(); } catch (e) {}
		}

		syncEngineGraph('other-instance');
		syncBgAudio('other-instance');
		syncVisual('other-instance');
	}

	function isBlockedPlayError(err){
		const text = cleanText(
			(err && (err.name || '')) + ' ' +
			(err && (err.message || ''))
		).toLowerCase();

		return !!(
			text.indexOf('notallowederror') >= 0 ||
			text.indexOf('user gesture') >= 0 ||
			text.indexOf('gesture') >= 0 ||
			text.indexOf('not allowed') >= 0
		);
	}

	function updateInstallUi(){
		const hide = !!(state.installed || !state.promptEvent);

		if (installNode)
			installNode.hidden = hide;
	}

	function onInstallClick(e){
		if (!state.promptEvent) {
			warn('install prompt missing');
			updateInstallUi();
			return;
		}

		if (e && e.preventDefault) e.preventDefault();

		log(5, 'install prompt show');
		state.promptEvent.prompt();
		state.promptEvent.userChoice.then(function(choice){
			log(5, 'install choice', choice && choice.outcome || '');
			if (choice && choice.outcome === 'accepted')
				state.installed = 1;
			state.promptEvent = null;
			updateInstallUi();
		}).catch(function(err){
			warn('install choice failed', String(err && err.message || err));
			updateInstallUi();
		});
	}

	function bindInstall(){
		if (!installNode || installNode.__a3mBound) return;
		installNode.__a3mBound = 1;
		installNode.addEventListener('click', onInstallClick);
	}

	function renderShareQr(){
		let svg = '';

		if (shareLinkNode) {
			shareLinkNode.href = shareUrl();
			shareLinkNode.textContent = shareLabel();
		}

		if (!qrNode) return;
		if (!window.a3m_qrcode || !window.a3m_qrcode.get_svg) {
			warn('qrcode lib missing');
			return;
		}

		try {
			svg = window.a3m_qrcode.get_svg({
				text: shareUrl(),
				border: 2,
				scale: 6,
				ecc: 'M'
			});
			qrNode.innerHTML = svg;
			log(5, 'qrcode render', shareUrl());
		} catch (e) {
			warn('qrcode render failed', String(e && e.message || e));
		}
	}

	function applyModeChange(n){
		const next = modeFromValue(n);
		const url = new URL(window.location.href);

		if (!next) return;

		log(5, 'mode change request', {
			from: engineMode(),
			to: next.value,
			label: next.label
		});

		window.__a3m_test_cfg = window.__a3m_test_cfg || {};
		window.__a3m_test_cfg.engineMode = next.value;
		url.searchParams.set('mode', String(next.value));
		window.location.href = url.toString();
	}

	function bindModeSelect(){
		let i = 0;
		let opt = null;
		const current = engineMode();

		if (!modeSelectNode) return;
		modeSelectNode.innerHTML = '';

		for (i = 0; i < ModeDefs.length; i++) {
			opt = document.createElement('option');
			opt.value = String(ModeDefs[i].value);
			opt.textContent = ModeDefs[i].label;
			opt.selected = ModeDefs[i].value === current;
			modeSelectNode.appendChild(opt);
		}

		if (modeSelectNode.__a3mBound) return;
		modeSelectNode.__a3mBound = 1;

		modeSelectNode.addEventListener('change', function(){
			const n = parseInt(modeSelectNode.value, 10);

			if (n === engineMode()) {
				log('mode change skip', { mode: n });
				return;
			}

			applyModeChange(n);
		});
	}

	function tryPlay(reason){
		let p = null;

		if (!state.audio || state.otherInstance) return;

		resumeEngineGraph(reason || 'play');
		syncEngineGraph(reason || 'play');

		try {
			p = state.audio.play();
			if (p && p.then) {
				p.then(function(){
					setNeedUserPlay(0, 'play ok');
					syncEngineGraph('play-ok');
					updateMediaMeta('play-ok');
					log(4, 'play ok', { reason: cleanText(reason || '') });
				}).catch(function(err){
					if (isBlockedPlayError(err))
						setNeedUserPlay(1, 'play blocked');

					warn('play failed', {
						reason: cleanText(reason || ''),
						err: String(err && err.message || err)
					});
				});
			}
		} catch (e) {
			if (isBlockedPlayError(e))
				setNeedUserPlay(1, 'play throw');

			warn('play throw', {
				reason: cleanText(reason || ''),
				err: String(e && e.message || e)
			});
		}
	}

	function tryBgPlay(reason){
		let p = null;

		if (!state.bgAudio || state.otherInstance || !engineUsesSafeLoop())
			return;

		try {
			p = state.bgAudio.play();
			if (p && p.then) {
				p.then(function(){
					log(4, 'bg play ok', {
						reason: cleanText(reason || ''),
						volume: round1(state.bgAudio.volume)
					});
				}).catch(function(err){
					if (isBlockedPlayError(err))
						setNeedUserPlay(1, 'bg play blocked');

					warn('bg play failed', {
						reason: cleanText(reason || ''),
						err: String(err && err.message || err)
					});
				});
			}
		} catch (e) {
			if (isBlockedPlayError(e))
				setNeedUserPlay(1, 'bg play throw');

			warn('bg play throw', {
				reason: cleanText(reason || ''),
				err: String(e && e.message || e)
			});
		}
	}

	function syncBgAudio(reason){
		const nextUrl = bgBlobUrl();

		if (!state.bgAudio || !engineUsesSafeLoop()) return;

		if (state.bgAudio.getAttribute('src') !== nextUrl) {
			log(4, 'bg src', {
				reason: cleanText(reason || ''),
				url: safeUrl(nextUrl)
			});
			state.bgAudio.src = nextUrl;
			state.bgAudio.load();
		}

		state.bgAudio.volume = 0.22;

		if (!state.wantPlay || state.otherInstance) {
			if (!state.bgAudio.paused) {
				try { state.bgAudio.pause(); } catch (e) {}
			}
			return;
		}

		if (!state.needUserPlay && state.bgAudio.paused)
			tryBgPlay(reason || 'bg-sync');
	}

	function swapBlob(mode, reason){
		let phase = 0;
		const nextUrl = mode === 'offline' ? state.offlineUrl : currentBlobUrl();

		if (!state.audio) return;
		if (state.mode === mode && state.audio.getAttribute('src') === nextUrl) {
			setCoverDirty();
			return;
		}

		if (isFinite(state.audio.currentTime) && state.audio.currentTime >= 0)
			phase = state.audio.currentTime % state.loopSeconds;

		state.mode = mode;
		state.pendingSeek = phase;
		state.pendingPlay = state.wantPlay && !state.otherInstance ? 1 : 0;
		setCoverDirty();
		syncEngineGraph(reason || 'swap');

		log(5, 'swapBlob', {
			reason: cleanText(reason || ''),
			mode: mode,
			phase: round1(phase),
			url: safeUrl(nextUrl),
			engine: engineLabel()
		});

		state.audio.src = nextUrl;
		state.audio.load();
		updateMediaMeta(reason || 'swap');
	}

	function swapOnlineLoop(reason){
		const nextUrl = currentBlobUrl();

		if (!state.audio || state.mode !== 'online') return;
		if (state.audio.getAttribute('src') === nextUrl) {
			syncVisual(reason || 'online-loop');
			return;
		}

		state.pendingSeek = 0;
		state.pendingPlay = state.wantPlay && !state.otherInstance ? 1 : 0;
		syncEngineGraph(reason || 'online-loop');

		log(4, 'swapOnlineLoop', {
			reason: cleanText(reason || ''),
			index: state.onlineIndex,
			url: safeUrl(nextUrl)
		});

		state.audio.src = nextUrl;
		state.audio.load();
		syncVisual(reason || 'online-loop');
	}

	function createAudioNode(){
		const audio = document.createElement('audio');

		audio.preload = 'auto';
		audio.loop = true;
		audio.playsInline = true;
		audio.setAttribute('playsinline', 'playsinline');
		audio.setAttribute('webkit-playsinline', 'playsinline');
		audio.style.display = 'none';
		document.body.appendChild(audio);
		return audio;
	}

	function bindAudioDebug(audio, prefix){
		const evs = [
			'loadstart',
			'loadedmetadata',
			'loadeddata',
			'canplay',
			'canplaythrough',
			'play',
			'playing',
			'pause',
			'waiting',
			'stalled',
			'suspend',
			'seeking',
			'seeked',
			'ended',
			'error'
		];
		let i = 0;

		for (i = 0; i < evs.length; i++) {
			(function(name){
				audio.addEventListener(name, function(){
					log(prefix + ' ' + name, {
						currentTime: round1(audio.currentTime),
						duration: round1(audio.duration),
						paused: !!audio.paused,
						readyState: audio.readyState,
						networkState: audio.networkState
					});
				});
			})(evs[i]);
		}
	}

	function initAudio(){
		const audio = createAudioNode();

		state.audio = audio;
		bindAudioDebug(audio, 'audio');

		audio.addEventListener('play', function(){
			syncEngineGraph('audio-play');
			updateMediaMeta('audio-play');
			updateMediaPosition();
		});

		audio.addEventListener('pause', function(){
			syncEngineGraph('audio-pause');
			updateMediaMeta('audio-pause');
			updateMediaPosition();
		});

		audio.addEventListener('loadedmetadata', function(){
			if (state.pendingSeek >= 0) {
				try {
					audio.currentTime = Math.max(0, Math.min(audio.duration || state.loopSeconds, state.pendingSeek));
				} catch (e) {}
				state.pendingSeek = -1;
			}

			if (state.pendingPlay) {
				state.pendingPlay = 0;
				tryPlay('loadedmetadata');
			}

			updateMediaPosition();
		});

		audio.addEventListener('seeked', function(){
			updateMediaPosition();
		});

		audio.addEventListener('timeupdate', function(){
			if (audio.currentTime + 0.25 < state.lastTime) {
				state.loopCount++;
				stepColor(1);
				log('audio loop wrap', {
					prev: round1(state.lastTime),
					now: round1(audio.currentTime),
					loopCount: state.loopCount,
					engine: engineLabel()
				});

				if (
					state.mode === 'online' &&
					engineUsesSwap() &&
					state.onlineUrls.length > 1
				) {
					state.onlineIndex = state.loopCount % state.onlineUrls.length;
					swapOnlineLoop('loop');
				} else {
					syncVisual('loop');
				}
			}
			state.lastTime = audio.currentTime;
			updateMediaPosition();
		});
	}

	function initBgAudio(){
		const audio = createAudioNode();

		if (!engineUsesSafeLoop()) return;

		state.bgAudio = audio;
		bindAudioDebug(audio, 'bg');

		audio.addEventListener('loadedmetadata', function(){
			syncBgAudio('bg-loadedmetadata');
		});

		audio.addEventListener('pause', function(){
			log('bg pause state', {
				wantPlay: state.wantPlay,
				otherInstance: state.otherInstance,
				currentTime: round1(audio.currentTime)
			});
		});
	}

	function initInstanceGuard(){
		let bc = null;

		if (!('BroadcastChannel' in window)) {
			log('instance guard unsupported');
			return;
		}

		bc = new BroadcastChannel(id + ':instance');
		state.instanceChannel = bc;

		bc.onmessage = function(e){
			const msg = e && e.data || {};

			if (!msg || msg.id === state.instanceId) return;

			if (msg.type === 'hello') {
				bc.postMessage({
					type: 'active',
					id: state.instanceId,
					to: msg.id
				});
				return;
			}

			if (msg.type === 'active' && msg.to === state.instanceId)
				setOtherInstance(1, 'broadcast active');
		};

		bc.postMessage({
			type: 'hello',
			id: state.instanceId
		});

		log(5, 'instance hello', state.instanceId);
	}

	function markPingOk(reason){
		state.pingOk++;
		setOnline(1, reason || 'ping-ok');
		log(4, 'ping ok state', { reason: cleanText(reason || ''), ok: state.pingOk, fail: state.pingFail });

		if (!engineIgnoresFailSwap() && state.mode !== 'online')
			swapBlob('online', reason || 'ping-ok');
		else
			setCoverDirty();
	}

	function markPingFail(reason, errText){
		state.pingFail++;
		setOnline(0, reason || 'ping-fail');
		warn('ping fail state', {
			reason: cleanText(reason || ''),
			err: cleanText(errText || ''),
			ok: state.pingOk,
			fail: state.pingFail
		});

		if (engineIgnoresFailSwap()) {
			setCoverDirty();
			return;
		}

		if (state.mode !== 'offline')
			swapBlob('offline', reason || 'ping-fail');
		else
			setCoverDirty();
	}

	function runPing(reason){
		const url = 'test.webmanifest?ts=' + Date.now();

		log('ping start', { reason: cleanText(reason || ''), url: url });

		fetch(url, {
			cache: 'no-store',
			credentials: 'same-origin'
		}).then(function(res){
			return res.text().then(function(text){
				log('ping response', {
					reason: cleanText(reason || ''),
					status: res.status,
					ok: !!res.ok,
					bytes: text.length
				});

				if (!res.ok) {
					markPingFail(reason || 'ping-status', 'status ' + res.status);
					return;
				}

				markPingOk(reason || 'ping-ok');
			});
		}).catch(function(err){
			markPingFail(reason || 'ping-fail', String(err && err.message || err));
		});
	}

	function queuePing(){
		if (state.pingTimer) clearInterval(state.pingTimer);
		state.pingTimer = setInterval(function(){
			runPing('interval');
		}, 15000);
	}

	function queueHeartbeat(){
		if (state.heartbeatTimer) clearInterval(state.heartbeatTimer);
		state.heartbeatTimer = setInterval(function(){
			log('heartbeat', {
				wantPlay: state.wantPlay,
				needUserPlay: state.needUserPlay,
				otherInstance: state.otherInstance,
				mode: state.mode,
				engine: engineLabel(),
				loopCount: state.loopCount,
				uptime: formatClock((Date.now() - state.startedAt) / 1000),
				online: formatClock(onlineMsNow() / 1000),
				fail: state.pingFail,
				paused: !!(state.audio && state.audio.paused),
				currentTime: round1(state.audio && state.audio.currentTime),
				bgPaused: !!(state.bgAudio && state.bgAudio.paused),
				bgCurrentTime: round1(state.bgAudio && state.bgAudio.currentTime),
				coverFrozen: state.coverFrozen,
				coverDirty: state.coverDirty,
				onlineIndex: state.onlineIndex,
				graph: state.graph.ctx && state.graph.ctx.state || ''
			});

			if (
				state.audio &&
				state.wantPlay &&
				!state.needUserPlay &&
				!state.otherInstance &&
				state.audio.paused
			) {
				tryPlay('heartbeat');
			}

			if (
				state.bgAudio &&
				state.wantPlay &&
				!state.needUserPlay &&
				!state.otherInstance &&
				state.bgAudio.paused
			) {
				tryBgPlay('heartbeat-bg');
			}
		}, 5000);
	}

	function updateModeAndPlay(mode, reason){
		if (state.otherInstance) {
			setCoverDirty();
			return;
		}

		state.wantPlay = 1;
		syncEngineGraph(reason || 'mode');
		syncBgAudio(reason || 'mode');
		swapBlob(mode, reason || 'mode');
	}

	function refreshPage(reason){
		log('refreshPage', { reason: cleanText(reason || '') });
		window.location.reload();
	}

	function gestureAction(dx, dy, dt){
		if (dy >= 96 && dy > Math.abs(dx) * 1.2 && dt <= 1200)
			return 'refresh';
		return '';
	}

	function clearGesture(){
		state.gesture = null;
	}

	function startGesture(kind, id, x, y){
		state.gesture = {
			kind: kind,
			id: id,
			x: x,
			y: y,
			t: Date.now()
		};
	}

	function onGesturePointerDown(e){
		if (HasTouch) return;
		if (e.isPrimary === false || state.gesture) return;
		if (gestureBlockedTarget(e.target)) return;
		startGesture('pointer', e.pointerId, e.clientX, e.clientY);
	}

	function onGesturePointerUp(e){
		let dx = 0;
		let dy = 0;
		let dt = 0;
		let act = '';

		if (!state.gesture || state.gesture.kind !== 'pointer' || e.pointerId !== state.gesture.id) return;

		dx = e.clientX - state.gesture.x;
		dy = e.clientY - state.gesture.y;
		dt = Date.now() - state.gesture.t;
		act = gestureAction(dx, dy, dt);

		log('gesture', {
			kind: 'pointer',
			dx: Math.round(dx),
			dy: Math.round(dy),
			dt: dt,
			act: act
		});

		clearGesture();

		if (act === 'refresh') {
			if (e.cancelable) e.preventDefault();
			refreshPage('gesture-pointer');
		}
	}

	function onGestureTouchStart(e){
		const t = e.touches && e.touches.length ? e.touches[0] : null;

		if (!t || state.gesture) return;
		if (gestureBlockedTarget(e.target)) return;
		startGesture('touch', 'touch', t.clientX, t.clientY);
	}

	function onGestureTouchEnd(e){
		const t = e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : null;
		let dx = 0;
		let dy = 0;
		let dt = 0;
		let act = '';

		if (!t || !state.gesture || state.gesture.kind !== 'touch') return;

		dx = t.clientX - state.gesture.x;
		dy = t.clientY - state.gesture.y;
		dt = Date.now() - state.gesture.t;
		act = gestureAction(dx, dy, dt);

		log('gesture', {
			kind: 'touch',
			dx: Math.round(dx),
			dy: Math.round(dy),
			dt: dt,
			act: act
		});

		clearGesture();

		if (act === 'refresh') {
			if (e.cancelable) e.preventDefault();
			refreshPage('gesture-touch');
		}
	}

	function bindMediaSession(){
		if (!mediaSupported()) {
			log(5, 'mediaSession skip');
			return;
		}

		function setAction(name, fn){
			try {
				navigator.mediaSession.setActionHandler(name, fn);
				log(5, 'media action bind', name);
			} catch (e) {
				warn('media action bind failed', {
					name: name,
					err: String(e && e.message || e)
				});
			}
		}

		setAction('play', function(){
			log('media action', 'play');
			state.wantPlay = 1;
			syncEngineGraph('media-play');
			syncBgAudio('media-play');
			if (!state.otherInstance) tryPlay('media-play');
		});

		setAction('pause', function(){
			log('media action', 'pause');
			state.wantPlay = 0;
			syncEngineGraph('media-pause');
			syncBgAudio('media-pause');
			if (state.audio) {
				try { state.audio.pause(); } catch (e) {}
			}
			updateMediaMeta('media-pause');
		});

		setAction('nexttrack', function(){
			log('media action', 'nexttrack');
			stepColor(1);
			syncVisual('media-next');
		});

		setAction('previoustrack', function(){
			log('media action', 'previoustrack');
			stepColor(-1);
			syncVisual('media-prev');
		});

		setAction('seekto', function(detail){
			const t = detail && isFinite(detail.seekTime) ? detail.seekTime : 0;

			log('media action', { type: 'seekto', seekTime: round1(t) });

			if (!state.audio) return;

			try {
				state.audio.currentTime = Math.max(0, Math.min(state.loopSeconds, t));
				updateMediaPosition();
			} catch (e) {
				warn('seekto failed', String(e && e.message || e));
			}
		});
	}

	function registerServiceWorker(){
		if (!('serviceWorker' in navigator)) {
			log('serviceWorker unsupported');
			return;
		}

		navigator.serviceWorker.register('test.sw.js').then(function(reg){
			log(5, 'sw ok', {
				scope: reg.scope,
				active: !!reg.active,
				installing: !!reg.installing,
				waiting: !!reg.waiting
			});
		}).catch(function(err){
			warn('sw fail', String(err && err.message || err));
		});
	}

	function bindLifecycle(){
		window.addEventListener('beforeinstallprompt', function(e){
			e.preventDefault();
			state.promptEvent = e;
			state.installed = 0;
			log(4, 'beforeinstallprompt');
			updateInstallUi();
		});

		window.addEventListener('appinstalled', function(){
			state.installed = 1;
			state.promptEvent = null;
			log(4, 'appinstalled');
			updateInstallUi();
		});

		window.addEventListener('pageshow', function(e){
			log('pageshow', { persisted: !!(e && e.persisted) });
			runPing('pageshow');
			if (state.wantPlay && !state.needUserPlay && !state.otherInstance) {
				syncBgAudio('pageshow');
				tryPlay('pageshow');
			}
		});

		window.addEventListener('focus', function(){
			log('focus');
			runPing('focus');
			if (state.wantPlay && !state.needUserPlay && !state.otherInstance) {
				syncBgAudio('focus');
				tryPlay('focus');
			}
		});

		window.addEventListener('online', function(){
			log('online');
			runPing('online');
		});

		window.addEventListener('offline', function(){
			log('offline');
			markPingFail('offline-event', 'navigator offline');
		});

		document.addEventListener('visibilitychange', function(){
			log('visibilitychange', document.visibilityState);
			if (document.visibilityState === 'visible') {
				runPing('visibility');
				if (state.wantPlay && !state.needUserPlay && !state.otherInstance) {
					syncBgAudio('visibility');
					tryPlay('visibility');
				}
			}
		});

		document.addEventListener('resume', function(){
			log('resume');
			runPing('resume');
			if (state.wantPlay && !state.needUserPlay && !state.otherInstance) {
				syncBgAudio('resume');
				tryPlay('resume');
			}
		});

		window.addEventListener('unhandledrejection', function(e){
			warn('unhandledrejection', String(e && e.reason || ''));
		});

		window.addEventListener('pagehide', function(){
			if (!state.instanceChannel) return;
			try { state.instanceChannel.close(); } catch (e) {}
			state.instanceChannel = null;
		});

		if (navigator.connection && navigator.connection.addEventListener) {
			function logConnection(reason){
				log(cleanText(reason || '') === 'init' ? 5 : 4, 'connection', {
					reason: cleanText(reason || ''),
					type: cleanText(navigator.connection.effectiveType || ''),
					downlink: navigator.connection.downlink,
					rtt: navigator.connection.rtt,
					saveData: !!navigator.connection.saveData
				});
			}

			logConnection('init');

			navigator.connection.addEventListener('change', function(){
				logConnection('change');
			});
		}
	}

	function bindUi(){
		if (coverNode) {
			coverNode.addEventListener('click', function(e){
				log('cover click', {
					trusted: !!(e && e.isTrusted),
					needUserPlay: state.needUserPlay,
					otherInstance: state.otherInstance,
					coverFrozen: state.coverFrozen,
					engine: engineLabel()
				});

				if (state.otherInstance) {
					syncVisual('other-instance-click');
					return;
				}

				state.wantPlay = 1;
				setNeedUserPlay(0, 'cover click');
				syncBgAudio('cover-click');
				tryPlay('cover-click');
				runPing('cover-click');
			});

			coverNode.addEventListener('contextmenu', function(e){
				e.preventDefault();
			});
		}

		if (freezeNode && !freezeNode.__a3mBound) {
			freezeNode.__a3mBound = 1;
			freezeNode.addEventListener('click', function(){
				state.coverFrozen = state.coverFrozen ? 0 : 1;
				syncFreezeUi();
				log(5, 'cover freeze', { frozen: state.coverFrozen });
				if (!state.coverFrozen)
					renderCover('unfreeze', 1);
			});
		}

		if (HasTouch) {
			document.addEventListener('touchstart', onGestureTouchStart, { passive: true });
			document.addEventListener('touchend', onGestureTouchEnd, { passive: false });
			return;
		}

		document.addEventListener('pointerdown', onGesturePointerDown);
		document.addEventListener('pointerup', onGesturePointerUp);
	}

	function bootstrap(){
		log(5, 'bootstrap', { engine: engineLabel(), mode: engineMode(), logLevel: currentLogLevel() });
		state.onlineUrls = [
			buildLoopBlob('online', 0),
			buildLoopBlob('online', 1)
		];
		state.offlineUrl = buildLoopBlob('offline', 0);
		buildMediaArtworkCache();
		setOnline(1, 'bootstrap');
		bindInstall();
		bindModeSelect();
		updateInstallUi();
		renderShareQr();
		initAudio();
		initBgAudio();
		initEngineGraph();
		initInstanceGuard();
		bindMediaSession();
		bindLifecycle();
		bindUi();
		syncFreezeUi();
		renderCover('init');
		state.audio.src = currentBlobUrl();
		state.audio.load();
		state.pendingPlay = 1;
		syncBgAudio('bootstrap');
		registerServiceWorker();
		queuePing();
		queueHeartbeat();
		runPing('bootstrap');
	}

	function buildLoopBlob(mode, variant){
		const sampleRate = 48000;
		const seconds = state.loopSeconds;
		const fadeSec = 1;
		const totalFrames = sampleRate * seconds;
		const channels = 2;
		const bytesPerSample = 4;
		const blockAlign = channels * bytesPerSample;
		const dataSize = totalFrames * blockAlign;
		const buf = new ArrayBuffer(44 + dataSize);
		const view = new DataView(buf);
		let off = 44;
		let i = 0;
		let ch = 0;
		let noise = 0;
		let air = 0;
		let foam = 0;
		let gust = 0;
		let swell = 0;
		let birdA = 0;
		let birdB = 0;
		let wind = 0;
		let hush = 0;
		let drift = 0;
		let veil = 0;
		let t = 0;
		let env = 1;
		let s = 0;
		let blobUrl = '';

		function writeAscii(pos, text){
			let j = 0;
			for (j = 0; j < text.length; j++)
				view.setUint8(pos + j, text.charCodeAt(j));
		}

		writeAscii(0, 'RIFF');
		view.setUint32(4, 36 + dataSize, true);
		writeAscii(8, 'WAVE');
		writeAscii(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 3, true);
		view.setUint16(22, channels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * blockAlign, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bytesPerSample * 8, true);
		writeAscii(36, 'data');
		view.setUint32(40, dataSize, true);

		for (i = 0; i < totalFrames; i++) {
			t = i / sampleRate;

			noise = (noise * 0.996) + ((Math.random() * 2 - 1) * 0.004);
			air = (air * 0.985) + ((Math.random() * 2 - 1) * 0.0034);
			foam = ((Math.random() * 2 - 1) * 0.5) - (foam * 0.72);
			wind = (wind * 0.9984) + ((Math.random() * 2 - 1) * 0.0022);
			hush = (hush * 0.992) + ((Math.random() * 2 - 1) * 0.0016);
			drift = (drift * 0.9992) + ((Math.random() * 2 - 1) * 0.0012);
			veil = (veil * 0.987) + ((Math.random() * 2 - 1) * 0.0026);

			gust = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t * 0.061 + 0.55 * Math.sin(Math.PI * 2 * t * 0.017));
			swell = 0.5 + 0.5 * Math.sin(Math.PI * 2 * t * 0.137);

			if (mode === 'offline') {
				birdA = Math.max(0, Math.sin(Math.PI * 2 * t * 2.15));
				birdA = birdA * birdA * birdA * birdA * birdA;
				birdA *= Math.sin(Math.PI * 2 * t * (2600 + 380 * Math.sin(Math.PI * 2 * t * 0.27)));

				birdB = Math.max(0, Math.sin(Math.PI * 2 * t * 1.42 + 1.4));
				birdB = birdB * birdB * birdB * birdB * birdB * birdB;
				birdB *= Math.sin(Math.PI * 2 * t * (3400 + 520 * Math.sin(Math.PI * 2 * t * 0.19)));

				s =
					(birdA * 0.075) +
					(birdB * 0.055) +
					(noise * 0.002);
			} else if (variant === 1) {
				s =
					(wind * (0.060 + (gust * 0.032))) +
					(hush * (0.026 + (swell * 0.014))) +
					(veil * 0.012) +
					(drift * (0.020 + (0.010 * Math.sin(Math.PI * 2 * t * 0.11)))) +
					(Math.sin(Math.PI * 2 * t * (96 + 18 * Math.sin(Math.PI * 2 * t * 0.07))) * 0.0012) +
					(Math.sin(Math.PI * 2 * t * (143 + 26 * Math.sin(Math.PI * 2 * t * 0.05 + 1.2))) * 0.0008) +
					(noise * 0.004);
			} else {
				s =
					(Math.sin(Math.PI * 2 * t * 78) * 0.0022) +
					(Math.sin(Math.PI * 2 * t * 119) * 0.0014) +
					(noise * 0.010) +
					(air * (0.022 + (gust * 0.026))) +
					(foam * (0.005 + (swell * 0.012)));
			}

			if (t < fadeSec) {
				env = t / fadeSec;
			} else if (t > seconds - fadeSec) {
				env = (seconds - t) / fadeSec;
			} else {
				env = 1;
			}

			if (env < 0) env = 0;
			if (env > 1) env = 1;

			s *= env * 0.82;

			if (s > 1) s = 1;
			if (s < -1) s = -1;

			for (ch = 0; ch < channels; ch++) {
				view.setFloat32(off, s, true);
				off += 4;
			}
		}

		blobUrl = URL.createObjectURL(new Blob([ buf ], { type: 'audio/wav' }));
		log(5, 'blob ready', {
			mode: mode,
			variant: variant,
			seconds: seconds,
			url: safeUrl(blobUrl)
		});
		return blobUrl;
	}

	bootstrap();
})();