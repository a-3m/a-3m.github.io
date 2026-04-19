/* file: test.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const id = window.__logs_cfg && window.__logs_cfg.id || 'a3m-sea-test';
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
	const freezeNode = document.querySelector('[data-act="freeze-ui"]');
	const installNode = document.querySelector('[data-act="install-app"]');
	const themeNode = document.querySelector('meta[name="theme-color"]');
	const qrNode = document.querySelector('[data-role="qr"]');
	const shareLinkNode = document.querySelector('[data-role="share-link"]');
	const HasTouch = !!(
		('ontouchstart' in window) ||
		(navigator.maxTouchPoints > 0) ||
		(navigator.msMaxTouchPoints > 0)
	);

	const state = {
		audio: null,
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
		console.log(id, ...arguments);
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

	function currentBlobUrl(){
		if (state.mode === 'offline')
			return state.offlineUrl;

		return state.onlineUrls[state.onlineIndex % state.onlineUrls.length] || '';
	}

	function shareUrl(){
		return window.location.href;
	}

	function shareLabel(){
		return window.location.host + window.location.pathname;
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
			msg: msg,
			sub: sub,
			offline: state.mode === 'offline',
			lines: [
				'FAIL ' + state.pingFail,
				'LOOPS ' + state.loopCount,
				'UP ' + formatClock((Date.now() - state.startedAt) / 1000),
				'ONLINE ' + formatClock(onlineMsNow() / 1000)
			]
		};
	}

	function mediaSnapshot(){
		return {
			color: currentColor(),
			title: coverTitle(),
			mode: modeLabel(),
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

		log('media artwork cache', {
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

	function updateMediaMeta(reason){
		const snap = mediaSnapshot();
		const data = {
			title: snap.title,
			artist: snap.mode + ' · loops ' + state.loopCount,
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
			log('media meta', {
				reason: cleanText(reason || ''),
				mode: snap.mode,
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

	function setOnline(flag, reason){
		flag = flag ? 1 : 0;

		if (flag) {
			if (!state.onlineAt)
				state.onlineAt = Date.now();
		} else if (state.onlineAt) {
			state.onlineMs += Date.now() - state.onlineAt;
			state.onlineAt = 0;
		}

		log('online state', {
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
		log('needUserPlay', { need: flag, reason: cleanText(reason || '') });
		syncVisual('need-user-play');
	}

	function setOtherInstance(flag, reason){
		flag = flag ? 1 : 0;
		if (state.otherInstance === flag) return;
		state.otherInstance = flag;
		log('otherInstance', { other: flag, reason: cleanText(reason || '') });

		if (flag && state.audio) {
			try { state.audio.pause(); } catch (e) {}
		}

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

		log('install prompt show');
		state.promptEvent.prompt();
		state.promptEvent.userChoice.then(function(choice){
			log('install choice', choice && choice.outcome || '');
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
			shareLinkNode.textContent = 'Open on another phone: ' + shareLabel();
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
			log('qrcode render', shareUrl());
		} catch (e) {
			warn('qrcode render failed', String(e && e.message || e));
		}
	}

	function tryPlay(reason){
		let p = null;

		if (!state.audio || state.otherInstance) return;

		try {
			p = state.audio.play();
			if (p && p.then) {
				p.then(function(){
					setNeedUserPlay(0, 'play ok');
					updateMediaMeta('play-ok');
					log('play ok', { reason: cleanText(reason || '') });
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

		log('swapBlob', {
			reason: cleanText(reason || ''),
			mode: mode,
			phase: round1(phase),
			url: safeUrl(nextUrl)
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

		log('swapOnlineLoop', {
			reason: cleanText(reason || ''),
			index: state.onlineIndex,
			url: safeUrl(nextUrl)
		});

		state.audio.src = nextUrl;
		state.audio.load();
		syncVisual(reason || 'online-loop');
	}

	function initAudio(){
		const audio = document.createElement('audio');
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

		audio.preload = 'auto';
		audio.loop = true;
		audio.playsInline = true;
		audio.setAttribute('playsinline', 'playsinline');
		audio.setAttribute('webkit-playsinline', 'playsinline');
		audio.style.display = 'none';
		document.body.appendChild(audio);
		state.audio = audio;

		for (i = 0; i < evs.length; i++) {
			(function(name){
				audio.addEventListener(name, function(){
					log('audio ' + name, {
						currentTime: round1(audio.currentTime),
						duration: round1(audio.duration),
						paused: !!audio.paused,
						readyState: audio.readyState,
						networkState: audio.networkState
					});
				});
			})(evs[i]);
		}

		audio.addEventListener('play', function(){
			updateMediaMeta('audio-play');
		});

		audio.addEventListener('pause', function(){
			updateMediaMeta('audio-pause');
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
		});

		audio.addEventListener('timeupdate', function(){
			if (audio.currentTime + 0.25 < state.lastTime) {
				state.loopCount++;
				stepColor(1);
				log('audio loop wrap', {
					prev: round1(state.lastTime),
					now: round1(audio.currentTime),
					loopCount: state.loopCount
				});

				if (state.mode === 'online' && state.onlineUrls.length > 1) {
					state.onlineIndex = state.loopCount % state.onlineUrls.length;
					swapOnlineLoop('loop');
				} else {
					syncVisual('loop');
				}
			}
			state.lastTime = audio.currentTime;
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

		log('instance hello', state.instanceId);
	}

	function markPingOk(reason){
		state.pingOk++;
		setOnline(1, reason || 'ping-ok');
		log('ping ok state', { reason: cleanText(reason || ''), ok: state.pingOk, fail: state.pingFail });

		if (state.mode !== 'online')
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
				loopCount: state.loopCount,
				uptime: formatClock((Date.now() - state.startedAt) / 1000),
				online: formatClock(onlineMsNow() / 1000),
				fail: state.pingFail,
				paused: !!(state.audio && state.audio.paused),
				currentTime: round1(state.audio && state.audio.currentTime),
				coverFrozen: state.coverFrozen,
				coverDirty: state.coverDirty,
				onlineIndex: state.onlineIndex
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
		}, 5000);
	}

	function updateModeAndPlay(mode, reason){
		if (state.otherInstance) {
			setCoverDirty();
			return;
		}

		state.wantPlay = 1;
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
			log('mediaSession skip');
			return;
		}

		function setAction(name, fn){
			try {
				navigator.mediaSession.setActionHandler(name, fn);
				log('media action bind', name);
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
			if (!state.otherInstance) tryPlay('media-play');
		});

		setAction('pause', function(){
			log('media action', 'pause');
			state.wantPlay = 0;
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
			log('sw ok', {
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
			log('beforeinstallprompt');
			updateInstallUi();
		});

		window.addEventListener('appinstalled', function(){
			state.installed = 1;
			state.promptEvent = null;
			log('appinstalled');
			updateInstallUi();
		});

		window.addEventListener('pageshow', function(e){
			log('pageshow', { persisted: !!(e && e.persisted) });
			runPing('pageshow');
			if (state.wantPlay && !state.needUserPlay && !state.otherInstance)
				tryPlay('pageshow');
		});

		window.addEventListener('focus', function(){
			log('focus');
			runPing('focus');
			if (state.wantPlay && !state.needUserPlay && !state.otherInstance)
				tryPlay('focus');
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
				if (state.wantPlay && !state.needUserPlay && !state.otherInstance)
					tryPlay('visibility');
			}
		});

		document.addEventListener('resume', function(){
			log('resume');
			runPing('resume');
			if (state.wantPlay && !state.needUserPlay && !state.otherInstance)
				tryPlay('resume');
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
				log('connection', {
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
					coverFrozen: state.coverFrozen
				});

				if (state.otherInstance) {
					syncVisual('other-instance-click');
					return;
				}

				state.wantPlay = 1;
				setNeedUserPlay(0, 'cover click');
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
				log('cover freeze', { frozen: state.coverFrozen });
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
		log('bootstrap');
		state.onlineUrls = [
			buildLoopBlob('online', 0),
			buildLoopBlob('online', 1)
		];
		state.offlineUrl = buildLoopBlob('offline', 0);
		buildMediaArtworkCache();
		setOnline(1, 'bootstrap');
		bindInstall();
		updateInstallUi();
		renderShareQr();
		initAudio();
		initInstanceGuard();
		bindMediaSession();
		bindLifecycle();
		bindUi();
		syncFreezeUi();
		renderCover('init');
		state.audio.src = currentBlobUrl();
		state.audio.load();
		state.pendingPlay = 1;
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
				(air * (0.022 + (gust * 0.016))) +
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
	log('blob ready', {
		mode: mode,
		variant: variant,
		seconds: seconds,
		url: safeUrl(blobUrl)
	});
	return blobUrl;
}

	bootstrap();
})();
