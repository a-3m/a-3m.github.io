/* file: a3m.mobile.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const root = document.querySelector('[data-role="app"]');
	const bgNode = document.querySelector('[data-role="bg"]');
	const coverNode = document.querySelector('[data-role="cover"]');
	const titleNode = document.querySelector('[data-role="title"]');
	const artistNode = document.querySelector('[data-role="artist"]');
	const albumNode = document.querySelector('[data-role="album"]');
	const yearNode = document.querySelector('[data-role="year"]');
	const progressNode = document.querySelector('[data-role="progress"]');
	const progressFillNode = document.querySelector('[data-role="progress-fill"]');
	const statusNode = document.querySelector('[data-role="status"]');
	const extraNode = document.querySelector('[data-role="extra"]');
	const stopNode = document.querySelector('[data-act="stop"]');
	const prevNode = document.querySelector('[data-act="prev"]');
	const playNode = document.querySelector('[data-act="toggle"]');
	const nextNode = document.querySelector('[data-act="next"]');
	const moreNode = document.querySelector('[data-act="more"]');
	const beginNode = document.querySelector('[data-act="begin"]');
	const shuffleNode = document.querySelector('[data-act="shuffle"]');
	const repeatNode = document.querySelector('[data-act="repeat"]');
	const gapNode = document.querySelector('[data-act="gap"]');
	const downloadNode = document.querySelector('[data-act="download"]');
	const reloadNode = document.querySelector('[data-act="reload"]');
	const playlistSrc = cleanText(root && root.getAttribute('data-playlist-src') || 'listen0.m3u');
	const sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
	const GAP_DURATION_SECONDS = 6.2;
	const GAP_FADE_IN_SECONDS = 1.0;
	const GAP_FADE_OUT_SECONDS = 1.0;
	const TRACK_MAX_RETRIES = 6;
	const PRELOAD_LOOKAHEAD_SEC = 18;
	const SWIPE_PX = 56;
	const TAP_PX = 12;
	const TAP_MS = 280;
	const audioExts = [ 'opus', 'ogg', 'mp3', 'm4a', 'aac', 'wav', 'flac', 'oga' ];
	const coverExts = [ 'webp', 'jpg', 'jpeg', 'png', 'gif', 'avif' ];
	const GAP_MESSAGES = [
		{ title: 'Connection slow', text: 'Trying this track' },
		{ title: 'Still not ready', text: 'Please calm' },
		{ title: 'Still not ready', text: 'Retrying same track' }
	];
	const calmArt = makeCalmArt();
	const gapUrls = [ makeGapBlob(0), makeGapBlob(1), makeGapBlob(2) ];
	const realEls = [ createAudio(), createAudio() ];
	const gapEl = createAudio();
	const state = {
		list: [],
		index: -1,
		activeSlot: 0,
		warmSlot: 1,
		mode: 'idle',
		desiredPlaying: false,
		warmTargetIndex: -1,
		warmPurpose: '',
		warmReady: false,
		warmAttempt: 0,
		gapTone: 0,
		gapMessage: 0,
		shuffle: false,
		repeat: true,
		extraOpen: false,
		gapTest: false,
		gapTestReturnToPlay: false,
		history: []
	};
	let gestureDown = null;

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function log(){
		const args = [].slice.call(arguments);

		args.unshift('[a3m-mobile]');
		console.log.apply(console, args);
	}

	function warn(){
		const args = [].slice.call(arguments);

		args.unshift('[a3m-mobile]');
		console.warn.apply(console, args);
	}

	function clamp(n, a, b){
		n = parseFloat(n);
		if (!isFinite(n)) n = a;
		return Math.min(b, Math.max(a, n));
	}

	function createAudio(){
		const el = document.createElement('audio');

		el.preload = 'auto';
		el.playsInline = true;
		el.setAttribute('playsinline', 'playsinline');
		el.setAttribute('webkit-playsinline', 'webkit-playsinline');
		el.style.display = 'none';
		document.body.appendChild(el);

		return el;
	}

	function activeEl(){
		return realEls[state.activeSlot];
	}

	function warmEl(){
		return realEls[state.warmSlot];
	}

	function stopEl(el){
		if (!el) return;

		try {
			el.pause();
		} catch (e) {}
	}

	function resetEl(el){
		if (!el) return;

		stopEl(el);
		el.removeAttribute('src');

		try {
			el.load();
		} catch (e) {}

		el.__trackIndex = -1;
		el.__purpose = '';
		el.__attempt = 0;
	}

	function playEl(el){
		return el.play().then(function(){
			return true;
		}).catch(function(e){
			warn('play blocked', e && e.message || e);
			return false;
		});
	}

	function normalizeIndex(index){
		const n = state.list.length;

		index = parseInt(index, 10);
		if (!n) return -1;
		if (!isFinite(index)) index = 0;
		while (index < 0) index += n;
		while (index >= n) index -= n;
		return index;
	}

	function trackAt(index){
		index = normalizeIndex(index);
		return index >= 0 ? state.list[index] : null;
	}

	function nextIndex(step){
		let next = -1;

		step = step || 1;

		if (!state.list.length) return -1;

		if (state.shuffle) {
			if (step < 0) {
				if (state.history.length) return state.history.pop();
				return normalizeIndex(state.index - 1);
			}

			next = randomIndex(state.index);
			if (state.index >= 0) state.history.push(state.index);
			return next;
		}

		next = state.index + step;

		if (state.repeat) return normalizeIndex(next);
		if (next < 0 || next >= state.list.length) return -1;

		return next;
	}

	function randomIndex(exclude){
		let next = exclude;
		let tries = 0;

		if (state.list.length <= 1) return exclude < 0 ? 0 : exclude;

		while (next === exclude && tries < 32) {
			next = Math.floor(Math.random() * state.list.length);
			tries++;
		}

		if (next === exclude) next = normalizeIndex(exclude + 1);
		return next;
	}

	function pathExt(path){
		const m = /\.([a-z0-9]+)(?:[?#].*)?$/i.exec(cleanText(path));
		return m ? m[1].toLowerCase() : '';
	}

	function isAudioPath(path){
		return audioExts.indexOf(pathExt(path)) >= 0;
	}

	function isCoverPath(path){
		return coverExts.indexOf(pathExt(path)) >= 0;
	}

	function resolveUrl(base, rel){
		try {
			return String(new URL(String(rel || ''), String(base || window.location.href)));
		} catch (e) {
			return cleanText(rel || '');
		}
	}

	function withBust(url, attempt){
		const u = new URL(String(url), window.location.href);

		u.searchParams.set('a3m_sess', sessionId);
		u.searchParams.set('a3m_try', String(attempt || 0));

		return String(u);
	}

	function mediaArtwork(src){
		src = cleanText(src || '');
		if (!src) src = calmArt;

		return [
			{ src: src, sizes: '256x256' },
			{ src: src, sizes: '512x512' },
			{ src: src, sizes: '1024x1024' }
		];
	}

	function setMediaMetadata(title, artist, album, cover){
		if (!('mediaSession' in navigator)) return;

		try {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: cleanText(title || ''),
				artist: cleanText(artist || ''),
				album: cleanText(album || ''),
				artwork: mediaArtwork(cover || '')
			});
		} catch (e) {}
	}

	function syncPlaybackState(){
		if (!('mediaSession' in navigator)) return;

		try {
			navigator.mediaSession.playbackState = currentAudiblePlaying() ? 'playing' : 'paused';
		} catch (e) {}
	}

	function syncPositionState(){
		const el = state.mode === 'waiting' || state.mode === 'gap-test' ? gapEl : activeEl();

		if (!('mediaSession' in navigator)) return;
		if (!el || !isFinite(el.duration) || el.duration <= 0) return;

		try {
			navigator.mediaSession.setPositionState({
				duration: el.duration,
				playbackRate: 1,
				position: clamp(el.currentTime || 0, 0, el.duration)
			});
		} catch (e) {}
	}

	function currentAudiblePlaying(){
		if (state.mode === 'waiting' || state.mode === 'gap-test') return !gapEl.paused;
		if (state.mode === 'playing') return !activeEl().paused;
		return false;
	}

	function currentGapMessage(track){
		const msg = GAP_MESSAGES[state.gapMessage % GAP_MESSAGES.length];
		let text = cleanText(msg.title || 'Connection slow');

		if (cleanText(msg.text || '')) text += ' · ' + cleanText(msg.text);
		if (track && cleanText(track.meta && track.meta.title || '')) text += ' · ' + cleanText(track.meta.title || '');
		if (TRACK_MAX_RETRIES >= 0) text += ' · ' + Math.min(state.warmAttempt, TRACK_MAX_RETRIES) + '/' + TRACK_MAX_RETRIES;

		return text;
	}

	function trackRetryExhausted(){
		return TRACK_MAX_RETRIES >= 0 && state.warmAttempt >= TRACK_MAX_RETRIES;
	}

	function updateUiTrack(track){
		track = track || {};

		if (titleNode) titleNode.textContent = cleanText(track.meta && track.meta.title || 'Listen');
		if (artistNode) artistNode.textContent = cleanText(track.meta && track.meta.artist || '');
		if (albumNode) albumNode.textContent = cleanText(track.meta && track.meta.album || '');
		if (yearNode) yearNode.textContent = cleanText(track.meta && track.meta.year || '');

		document.title = cleanText(track.meta && track.meta.title || 'Listen');
		setCover(track.cover || calmArt);
	}

	function setCover(url){
		const cover = cleanText(url || '');

		root.style.setProperty('--a3m-cover-url', cover ? imageVar(cover) : 'none');
		root.style.setProperty('--a3m-calm-url', imageVar(calmArt));

		if (coverNode) coverNode.style.backgroundImage = cover ? imageVar(cover) + ', ' + imageVar(calmArt) : imageVar(calmArt);
		if (bgNode) bgNode.style.backgroundImage = cover ? imageVar(cover) + ', ' + imageVar(calmArt) : imageVar(calmArt);
	}

	function imageVar(url){
		return 'url("' + String(url || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '")';
	}

	function setStatus(text){
		if (!statusNode) return;
		statusNode.textContent = cleanText(text || '');
	}

	function setProgress(v){
		if (!progressFillNode) return;
		progressFillNode.style.width = String(clamp(v, 0, 1) * 100) + '%';
	}

	function updateButtons(){
		if (playNode) playNode.textContent = currentAudiblePlaying() ? '||' : '|>';
		if (shuffleNode) shuffleNode.classList.toggle('is-active', !!state.shuffle);
		if (repeatNode) repeatNode.classList.toggle('is-active', !!state.repeat);
		if (gapNode) gapNode.classList.toggle('is-active', !!state.gapTest);
		if (moreNode) moreNode.classList.toggle('is-active', !!state.extraOpen);
		if (extraNode) extraNode.hidden = !state.extraOpen;

		root.classList.toggle('is-waiting', state.mode === 'waiting');
		root.classList.toggle('is-stopped', state.mode === 'stopped');
	}

	function updateStatusLine(){
		const track = trackAt(state.index);

		if (state.mode === 'waiting') {
			setStatus(currentGapMessage(track));
			return;
		}
		if (state.mode === 'gap-test') {
			setStatus('Gap test');
			return;
		}
		if (state.mode === 'stopped') {
			setStatus('Stopped');
			return;
		}
		setStatus('');
	}

	function render(){
		updateButtons();
		updateStatusLine();
		syncPlaybackState();
	}

	function applyTrackSession(track){
		if (!track) return;

		setMediaMetadata(
			cleanText(track.meta.title || ''),
			cleanText(track.meta.artist || ''),
			cleanText(track.meta.album || ''),
			cleanText(track.cover || calmArt)
		);
		syncPlaybackState();
		syncPositionState();
	}

	function applyGapSession(track){
		const msg = GAP_MESSAGES[state.gapMessage % GAP_MESSAGES.length];

		setMediaMetadata(
			cleanText(msg.title || 'Connection slow'),
			cleanText(msg.text || 'Trying this track'),
			cleanText(track && track.meta && track.meta.title || ''),
			cleanText(track && track.cover || calmArt)
		);
		syncPlaybackState();
		syncPositionState();
	}

	function loadWarm(index, purpose, attempt){
		const track = trackAt(index);
		const el = warmEl();

		if (!track) return false;

		state.warmTargetIndex = index;
		state.warmPurpose = cleanText(purpose || 'target');
		state.warmReady = false;
		state.warmAttempt = Math.max(1, parseInt(attempt, 10) || 1);

		resetEl(el);
		el.__trackIndex = index;
		el.__purpose = state.warmPurpose;
		el.__attempt = state.warmAttempt;
		el.src = withBust(track.src, state.warmAttempt);
		el.load();

		log('warm load', state.warmPurpose, index + 1, track.meta.title || track.src, 'try', state.warmAttempt);
		return true;
	}

	function promoteWarm(autoplay){
		const track = trackAt(state.index);
		let oldActive = 0;

		if (!state.warmReady || state.warmTargetIndex !== state.index) return false;

		oldActive = state.activeSlot;
		state.activeSlot = state.warmSlot;
		state.warmSlot = oldActive;

		stopEl(gapEl);
		resetEl(warmEl());

		state.warmReady = false;
		state.warmTargetIndex = -1;
		state.warmPurpose = '';
		state.warmAttempt = 0;

		activeEl().__trackIndex = state.index;
		state.mode = autoplay ? 'playing' : 'paused';

		updateUiTrack(track);
		setProgress(0);

		if (autoplay) {
			playEl(activeEl()).then(function(ok){
				state.mode = ok ? 'playing' : 'paused';
				render();
			});
		} else {
			stopEl(activeEl());
			render();
		}

		maybePreloadNext();
		return true;
	}

	function maybePreloadNext(){
		const next = nextIndex(1);

		if (state.mode !== 'playing') return;
		if (next < 0 || next === state.index) return;
		if (state.warmPurpose === 'target' && state.warmTargetIndex === state.index) return;
		if (state.warmPurpose === 'preload' && state.warmTargetIndex === next) return;
		if (state.warmReady && state.warmPurpose === 'preload' && state.warmTargetIndex === next) return;

		loadWarm(next, 'preload', 1);
	}

	function startGap(){
		gapEl.src = gapUrls[state.gapTone % gapUrls.length];
		gapEl.load();
		playEl(gapEl).then(function(){
			applyGapSession(trackAt(state.index));
			render();
		});
	}

	function enterWaiting(index){
		const track = trackAt(index);

		if (!track) return;

		state.index = index;
		state.mode = 'waiting';
		state.desiredPlaying = true;
		state.gapMessage = 0;
		state.gapTone = 0;

		updateUiTrack(track);
		setProgress(0);

		if (state.warmTargetIndex !== index) {
			loadWarm(index, 'target', 1);
		} else if (state.warmPurpose !== 'target') {
			state.warmPurpose = 'target';
			if (state.warmAttempt < 1) state.warmAttempt = 1;
		}

		stopEl(activeEl());
		startGap();
		render();
	}

	function requestTrack(index, autoplay){
		const track = trackAt(index);

		if (!track) return;

		state.index = index;
		updateUiTrack(track);
		setProgress(0);

		if (activeEl().__trackIndex === index && state.mode !== 'waiting' && state.mode !== 'gap-test') {
			state.desiredPlaying = !!autoplay;
			state.mode = autoplay ? 'playing' : 'paused';

			if (autoplay) {
				playEl(activeEl()).then(function(ok){
					state.mode = ok ? 'playing' : 'paused';
					applyTrackSession(track);
					render();
				});
			} else {
				stopEl(activeEl());
				render();
			}
			return;
		}

		if (state.warmReady && state.warmTargetIndex === index) {
			state.desiredPlaying = !!autoplay;
			promoteWarm(!!autoplay);
			return;
		}

		if (!autoplay) {
			state.desiredPlaying = false;
			state.mode = 'paused';
			loadWarm(index, 'target', 1);
			render();
			return;
		}

		enterWaiting(index);
	}

	function stopAll(){
		state.desiredPlaying = false;
		state.mode = 'stopped';
		stopEl(activeEl());
		stopEl(warmEl());
		stopEl(gapEl);
		resetEl(warmEl());
		state.warmReady = false;
		state.warmTargetIndex = -1;
		state.warmPurpose = '';
		state.warmAttempt = 0;
		setProgress(0);
		render();
	}

	function beginFromStart(){
		state.history = [];
		requestTrack(0, true);
	}

	function togglePlay(){
		if (state.gapTest) {
			if (!gapEl.paused) {
				stopEl(gapEl);
			} else {
				playEl(gapEl).then(function(){
					applyGapSession(trackAt(state.index));
					render();
				});
			}
			render();
			return;
		}

		if (state.mode === 'waiting') {
			if (!gapEl.paused) {
				stopEl(gapEl);
				state.desiredPlaying = false;
			} else {
				state.desiredPlaying = true;
				startGap();
			}
			render();
			return;
		}

		if (state.mode === 'playing') {
			state.desiredPlaying = false;
			state.mode = 'paused';
			stopEl(activeEl());
			render();
			return;
		}

		state.desiredPlaying = true;
		requestTrack(state.index >= 0 ? state.index : 0, true);
	}

	function gotoNext(){
		const next = nextIndex(1);

		if (next < 0) {
			stopAll();
			return;
		}

		requestTrack(next, true);
	}

	function gotoPrev(){
		const prev = nextIndex(-1);

		if (prev < 0) return;
		requestTrack(prev, true);
	}

	function toggleExtra(){
		state.extraOpen = !state.extraOpen;
		render();
	}

	function toggleShuffle(){
		state.shuffle = !state.shuffle;
		if (!state.shuffle) state.history = [];
		render();
	}

	function toggleRepeat(){
		state.repeat = !state.repeat;
		render();
	}

	function toggleGapTest(){
		const track = trackAt(state.index);

		state.gapTest = !state.gapTest;

		if (state.gapTest) {
			state.gapTestReturnToPlay = state.mode === 'playing' || state.mode === 'waiting';
			stopEl(activeEl());
			stopEl(warmEl());
			state.mode = 'gap-test';
			gapEl.src = gapUrls[state.gapTone % gapUrls.length];
			gapEl.load();
			playEl(gapEl).then(function(){
				applyGapSession(track);
				render();
			});
			render();
			return;
		}

		stopEl(gapEl);
		state.mode = 'paused';

		if (state.gapTestReturnToPlay) {
			requestTrack(state.index >= 0 ? state.index : 0, true);
		} else {
			updateUiTrack(track);
			render();
		}
	}

	function downloadCurrent(){
		const track = trackAt(state.index);
		const a = document.createElement('a');

		if (!track || !cleanText(track.src)) return;

		a.href = track.src;
		a.download = decodeValue(String(track.src).replace(/[?#].*$/, '').replace(/^.*\//, ''));
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.parentNode.removeChild(a);
	}

	function hardReload(){
		const u = new URL(window.location.href);
		const stamp = Date.now().toString(36);

		u.searchParams.set('v', stamp);
		u.searchParams.set('reload', stamp);
		window.location.replace(String(u));
	}

	function bindReal(el){
		el.addEventListener('play', function(){
			const track = trackAt(state.index);

			if (el === activeEl()) {
				applyTrackSession(track);
				render();
			}
		});

		el.addEventListener('pause', function(){
			render();
		});

		el.addEventListener('timeupdate', function(){
			let left = 0;

			if (el !== activeEl()) return;
			if (state.mode !== 'playing') return;
			if (!isFinite(el.duration) || el.duration <= 0) return;

			setProgress(el.currentTime / el.duration);
			syncPositionState();

			left = el.duration - el.currentTime;
			if (left < PRELOAD_LOOKAHEAD_SEC) maybePreloadNext();
		});

		el.addEventListener('ended', function(){
			if (el !== activeEl()) return;
			gotoNext();
		});

		el.addEventListener('waiting', function(){
			if (el !== activeEl()) return;
			if (state.mode !== 'playing') return;
			enterWaiting(state.index);
		});

		el.addEventListener('stalled', function(){
			if (el !== activeEl()) return;
			if (state.mode !== 'playing') return;
			enterWaiting(state.index);
		});

		el.addEventListener('error', function(){
			if (el === warmEl()) {
				state.warmReady = false;
				return;
			}
			if (el !== activeEl()) return;
			enterWaiting(state.index);
		});

		el.addEventListener('canplay', function(){
			if (el !== warmEl()) return;
			if (el.__trackIndex !== state.warmTargetIndex) return;

			state.warmReady = true;

			if (state.mode === 'waiting' && state.warmTargetIndex === state.index) {
				promoteWarm(state.desiredPlaying);
				return;
			}

			if (state.mode === 'paused' && state.warmTargetIndex === state.index && !state.desiredPlaying) {
				promoteWarm(false);
			}
		});
	}

	function bindGap(){
		gapEl.addEventListener('play', function(){
			applyGapSession(trackAt(state.index));
			render();
		});

		gapEl.addEventListener('pause', function(){
			render();
		});

		gapEl.addEventListener('timeupdate', function(){
			if (state.mode !== 'waiting' && state.mode !== 'gap-test') return;
			syncPositionState();
		});

		gapEl.addEventListener('ended', function(){
			if (state.mode === 'gap-test') {
				gapToneNext();
				gapEl.src = gapUrls[state.gapTone % gapUrls.length];
				gapEl.load();
				playEl(gapEl);
				return;
			}

			if (state.mode !== 'waiting') return;

			if (state.warmReady && state.warmTargetIndex === state.index) {
				promoteWarm(state.desiredPlaying);
				return;
			}

			gapToneNext();
			gapMessageNext();

			if (!trackRetryExhausted()) loadWarm(state.index, 'target', state.warmAttempt + 1);

			if (state.desiredPlaying) startGap();
			else render();
		});

		gapEl.addEventListener('error', function(){
			gapToneNext();
			if (state.mode === 'waiting' || state.mode === 'gap-test') startGap();
		});
	}

	function gapToneNext(){
		state.gapTone = (state.gapTone + 1) % gapUrls.length;
	}

	function gapMessageNext(){
		state.gapMessage = (state.gapMessage + 1) % GAP_MESSAGES.length;
	}

	function bindUi(){
		if (stopNode) stopNode.addEventListener('click', function(){ stopAll(); });
		if (prevNode) prevNode.addEventListener('click', function(){ gotoPrev(); });
		if (playNode) playNode.addEventListener('click', function(){ togglePlay(); });
		if (nextNode) nextNode.addEventListener('click', function(){ gotoNext(); });
		if (moreNode) moreNode.addEventListener('click', function(){ toggleExtra(); });
		if (beginNode) beginNode.addEventListener('click', function(){ beginFromStart(); });
		if (shuffleNode) shuffleNode.addEventListener('click', function(){ toggleShuffle(); });
		if (repeatNode) repeatNode.addEventListener('click', function(){ toggleRepeat(); });
		if (gapNode) gapNode.addEventListener('click', function(){ toggleGapTest(); });
		if (downloadNode) downloadNode.addEventListener('click', function(){ downloadCurrent(); });
		if (reloadNode) reloadNode.addEventListener('click', function(){ hardReload(); });

		if (progressNode) {
			progressNode.addEventListener('click', function(e){
				let rect = null;
				let ratio = 0;
				let el = null;

				if (state.mode !== 'playing') return;

				el = activeEl();
				if (!isFinite(el.duration) || el.duration <= 0) return;

				rect = progressNode.getBoundingClientRect();
				if (!rect || !rect.width) return;

				ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);

				try {
					el.currentTime = el.duration * ratio;
				} catch (e2) {}

				syncPositionState();
			});
		}

		root.addEventListener('pointerdown', onGestureStart);
		root.addEventListener('pointerup', onGestureEnd);
		root.addEventListener('pointercancel', onGestureCancel);

		root.addEventListener('touchstart', onGestureStart, { passive: true });
		root.addEventListener('touchend', onGestureEnd, { passive: true });
		root.addEventListener('touchcancel', onGestureCancel, { passive: true });

		document.addEventListener('keydown', function(e){
			if (e.target && /input|textarea/i.test(String(e.target.tagName || ''))) return;

			if (e.key === ' ') {
				e.preventDefault();
				togglePlay();
				return;
			}

			if (e.key === 'ArrowLeft') {
				e.preventDefault();
				gotoPrev();
				return;
			}

			if (e.key === 'ArrowRight') {
				e.preventDefault();
				gotoNext();
			}
		});
	}

	function pointFromEvent(e){
		if (!e) return null;

		if (e.changedTouches && e.changedTouches.length) {
			return {
				x: e.changedTouches[0].clientX,
				y: e.changedTouches[0].clientY
			};
		}

		if (e.touches && e.touches.length) {
			return {
				x: e.touches[0].clientX,
				y: e.touches[0].clientY
			};
		}

		if (isFinite(e.clientX) && isFinite(e.clientY)) {
			return {
				x: e.clientX,
				y: e.clientY
			};
		}

		return null;
	}

	function gestureBlocked(target){
		return !!(target && target.closest && target.closest('button,[data-role="progress"]'));
	}

	function onGestureStart(e){
		const pt = pointFromEvent(e);

		if (!pt) return;
		if (gestureBlocked(e.target)) return;

		gestureDown = {
			x: pt.x,
			y: pt.y,
			t: Date.now()
		};
	}

	function onGestureEnd(e){
		const pt = pointFromEvent(e);
		let dx = 0;
		let dy = 0;
		let dt = 0;

		if (!gestureDown || !pt) return;

		dx = pt.x - gestureDown.x;
		dy = pt.y - gestureDown.y;
		dt = Date.now() - gestureDown.t;
		gestureDown = null;

		if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.25) {
			if (dx < 0) gotoNext();
			else gotoPrev();
			return;
		}

		if (Math.abs(dx) <= TAP_PX && Math.abs(dy) <= TAP_PX && dt <= TAP_MS) {
			togglePlay();
		}
	}

	function onGestureCancel(){
		gestureDown = null;
	}

	function parseDate6(s){
		const m = /^(\d{2})(\d{2})(\d{2})$/.exec(cleanText(s));
		const yy = m ? parseInt(m[1], 10) : 0;

		if (!m) return '';
		return String(yy >= 70 ? (1900 + yy) : (2000 + yy)) + '-' + m[2] + '-' + m[3];
	}

	function parseFilenameMeta(url){
		const file = decodeURIComponent(String(url || '').replace(/[?#].*$/, '').replace(/^.*\//, ''));
		const stem = file.replace(/\.[^.]+$/, '');
		const pair = stem.split('--');
		let left = cleanText(pair.shift() || '');
		let right = cleanText(pair.join('--') || '');
		let date = '';
		let year = '';
		let artist = '';
		let album = '';
		let title = '';
		let m = null;
		let tail = [];
		let i = 0;

		m = /^(\d{6})-(.+)$/.exec(left);
		if (m) {
			date = parseDate6(m[1]);
			left = cleanText(m[2]);
		}

		title = titleText(left);
		if (!title) title = titleText(stem);

		if (right) {
			tail = right.split('-').filter(Boolean);
			for (i = 0; i < tail.length; i++) {
				if (/^\d{4}$/.test(tail[i])) {
					year = tail[i];
					album = titleText(tail.slice(0, i).join(' '));
					artist = titleText(
						tail.slice(i + 1).filter(function(v){
							v = cleanText(v).toLowerCase();
							return v && v !== 'album' && v !== 'aaam';
						}).join(' ')
					);
					break;
				}
			}
			if (!album) album = titleText(right);
		}

		if (!artist) {
			if (/dogon/i.test(stem)) artist = 'Dogon';
			else if (/aaam/i.test(stem)) artist = 'AAAM';
		}
		if (!year && date) year = date.slice(0, 4);

		return {
			title: cleanText(title || file),
			artist: cleanText(artist || ''),
			album: cleanText(album || ''),
			year: cleanText(year || '')
		};
	}

	function titleText(s){
		const parts = cleanText(s).split(/[-_\s]+/);
		let out = [];
		let i = 0;

		for (i = 0; i < parts.length; i++) {
			if (!parts[i]) continue;
			out.push(titleWord(parts[i]));
		}

		return out.join(' ');
	}

	function titleWord(s){
		s = cleanText(s).toLowerCase();
		if (!s) return '';
		if (s === 'aaam') return 'AAAM';
		if (s === 'a3m') return 'A3M';
		return s.charAt(0).toUpperCase() + s.slice(1);
	}

	function joinPlaylistLines(text){
		const lines = String(text == null ? '' : text).split(/\r?\n/);
		const out = [];
		let carry = '';
		let line = '';
		let i = 0;

		function looksWrappedUrl(s){
			return /^https?:\/\//i.test(s) &&
				!/(\.(?:opus|ogg|mp3|m4a|aac|wav|flac|oga|webp|jpg|jpeg|png|gif|avif))(?:[?#].*)?$/i.test(s);
		}

		for (i = 0; i < lines.length; i++) {
			line = cleanText(lines[i]);

			if (!line) {
				if (carry) {
					out.push(carry);
					carry = '';
				}
				out.push('');
				continue;
			}

			if (carry) {
				if (!/^(#|;|https?:\/\/|a3ms:\/\/)/i.test(line)) {
					carry += line;
					if (!looksWrappedUrl(carry)) {
						out.push(carry);
						carry = '';
					}
					continue;
				}
				out.push(carry);
				carry = '';
			}

			if (looksWrappedUrl(line)) {
				carry = line;
				continue;
			}

			out.push(line);
		}

		if (carry) out.push(carry);
		return out;
	}

	function parsePlaylist(text, baseUrl){
		const lines = joinPlaylistLines(text);
		const out = [];
		let pendingCover = '';
		let line = '';
		let url = '';
		let i = 0;

		for (i = 0; i < lines.length; i++) {
			line = cleanText(lines[i]);
			if (!line || line.charAt(0) === '#' || line.charAt(0) === ';') continue;
			if (/^a3ms:\/\//i.test(line)) continue;

			url = resolveUrl(baseUrl, line);

			if (isCoverPath(url)) {
				pendingCover = url;
				continue;
			}
			if (!isAudioPath(url)) continue;

			out.push({
				src: url,
				cover: cleanText(pendingCover || ''),
				meta: parseFilenameMeta(url)
			});

			pendingCover = '';
		}

		return out;
	}

	function fetchPlaylist(){
		const url = resolveUrl(window.location.href, playlistSrc);

		log('playlist load', url);

		return fetch(url, {
			credentials: 'same-origin',
			cache: 'no-store'
		}).then(function(res){
			if (!res || !res.ok) throw new Error('playlist fetch failed #' + (res ? res.status : '?'));
			return res.text();
		}).then(function(text){
			return parsePlaylist(text, url);
		});
	}

	function makeCalmArt(){
		const svg = '' +
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">' +
			'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
			'<stop offset="0" stop-color="#050505"/><stop offset="1" stop-color="#141826"/>' +
			'</linearGradient></defs>' +
			'<rect width="1024" height="1024" fill="url(#g)"/>' +
			'<g fill="none" stroke="#cfd8ff22" stroke-width="22" stroke-linecap="round">' +
			'<path d="M64 440c118 22 196 22 314 0s196-22 314 0 196 22 268 0"/>' +
			'<path d="M64 560c118 22 196 22 314 0s196-22 314 0 196 22 268 0"/>' +
			'<path d="M64 680c118 22 196 22 314 0s196-22 314 0 196 22 268 0"/>' +
			'</g>' +
			'</svg>';

		return 'data:image/svg+xml,' + encodeURIComponent(svg);
	}

	function makeGapBlob(kind){
		const sampleRate = 24000;
		const seconds = Math.max(0.1, parseFloat(GAP_DURATION_SECONDS) || 6.2);
		const fadeInSeconds = Math.max(0, parseFloat(GAP_FADE_IN_SECONDS) || 0);
		const fadeOutSeconds = Math.max(0, parseFloat(GAP_FADE_OUT_SECONDS) || 0);
		const channels = 2;
		const totalFrames = Math.max(1, Math.floor(sampleRate * seconds));
		const bytesPerSample = 2;
		const blockAlign = channels * bytesPerSample;
		const dataSize = totalFrames * blockAlign;
		const buf = new ArrayBuffer(44 + dataSize);
		const view = new DataView(buf);
		const fadeInFrames = Math.max(0, Math.min(totalFrames, Math.floor(sampleRate * fadeInSeconds)));
		const fadeOutFrames = Math.max(0, Math.min(totalFrames, Math.floor(sampleRate * fadeOutSeconds)));
		let off = 44;
		let i = 0;
		let ch = 0;
		let white = 0;
		let n1 = 0;
		let n2 = 0;
		let t = 0;
		let fadeIn = 1;
		let fadeOut = 1;
		let fade = 1;
		let swell = 0;
		let s = 0;

		function writeAscii(pos, text){
			let j = 0;

			for (j = 0; j < text.length; j++) {
				view.setUint8(pos + j, text.charCodeAt(j));
			}
		}

		writeAscii(0, 'RIFF');
		view.setUint32(4, 36 + dataSize, true);
		writeAscii(8, 'WAVE');
		writeAscii(12, 'fmt ');
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, channels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * blockAlign, true);
		view.setUint16(32, blockAlign, true);
		view.setUint16(34, bytesPerSample * 8, true);
		writeAscii(36, 'data');
		view.setUint32(40, dataSize, true);

		for (i = 0; i < totalFrames; i++) {
			t = i / sampleRate;
			white = Math.random() * 2 - 1;
			n1 = n1 * 0.985 + white * 0.015;
			n2 = n2 * 0.998 + white * 0.003;
			swell = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((Math.PI * 2 * t * (0.11 + kind * 0.015))));
			fadeIn = fadeInFrames > 0 && i < fadeInFrames ? (i / fadeInFrames) : 1;
			fadeOut = fadeOutFrames > 0 && i > totalFrames - fadeOutFrames ? ((totalFrames - i) / fadeOutFrames) : 1;
			fade = clamp(Math.min(fadeIn, fadeOut), 0, 1);

			s =
				(n1 * 0.20 + n2 * 0.34) * (0.12 + swell * 0.24) +
				Math.sin((Math.PI * 2 * t * (46 + kind * 7))) * 0.010 +
				Math.sin((Math.PI * 2 * t * (91 + kind * 9))) * 0.006;

			s *= fade;
			s = clamp(s, -1, 1);

			for (ch = 0; ch < channels; ch++) {
				view.setInt16(off, Math.round(s * 32767), true);
				off += 2;
			}
		}

		return URL.createObjectURL(new Blob([ buf ], { type: 'audio/wav' }));
	}

	function initMediaSession(){
		if (!('mediaSession' in navigator)) return;

		try {
			navigator.mediaSession.setActionHandler('play', function(){
				togglePlay();
			});
		} catch (e) {}

		try {
			navigator.mediaSession.setActionHandler('pause', function(){
				if (state.mode === 'waiting') {
					state.desiredPlaying = false;
					stopEl(gapEl);
					render();
					return;
				}
				stopEl(activeEl());
				state.mode = 'paused';
				state.desiredPlaying = false;
				render();
			});
		} catch (e) {}

		try {
			navigator.mediaSession.setActionHandler('nexttrack', function(){
				gotoNext();
			});
		} catch (e) {}

		try {
			navigator.mediaSession.setActionHandler('previoustrack', function(){
				gotoPrev();
			});
		} catch (e) {}

		try {
			navigator.mediaSession.setActionHandler('stop', function(){
				stopAll();
			});
		} catch (e) {}

		try {
			navigator.mediaSession.setActionHandler('seekto', function(detail){
				const el = activeEl();

				if (state.mode !== 'playing') return;
				if (!detail || !isFinite(detail.seekTime)) return;
				if (!isFinite(el.duration) || el.duration <= 0) return;

				try {
					el.currentTime = clamp(detail.seekTime, 0, el.duration);
				} catch (e2) {}

				syncPositionState();
			});
		} catch (e) {}
	}

	function boot(){
		bindReal(realEls[0]);
		bindReal(realEls[1]);
		bindGap();
		bindUi();
		initMediaSession();
		updateUiTrack({ cover: calmArt, meta: { title: 'Listen' } });
		render();

		fetchPlaylist().then(function(list){
			state.list = list || [];

			if (!state.list.length) throw new Error('playlist empty');

			state.index = 0;
			updateUiTrack(trackAt(0));
			loadWarm(0, 'target', 1);
			render();
			log('playlist ready', state.list.length);
		}).catch(function(e){
			warn('playlist error', e && e.message || e);
			setStatus('Playlist error');
		});
	}

	boot();
})();