// File: a3m.player.js
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const A3M = window.A3M || (window.A3M = {});
	const Bus = A3M.Bus;

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function copyTrack(track){
		if (!track) return null;

		return {
			src: cleanText(track.src || ''),
			title: cleanText(track.title || ''),
			artist: cleanText(track.artist || ''),
			album: cleanText(track.album || ''),
			cover: cleanText(track.cover || '')
		};
	}

	function copyMeta(meta){
		const out = {};
		let k = '';

		meta = meta || {};

		for (k in meta) {
			if (!Object.prototype.hasOwnProperty.call(meta, k)) continue;
			out[k] = meta[k];
		}

		return out;
	}

	function copyState(state){
		return {
			ready: !!state.ready,
			playing: !!state.playing,
			currentSource: cleanText(state.currentSource || ''),
			currentTrack: copyTrack(state.currentTrack),
			position: isFinite(state.position) ? state.position : 0,
			duration: isFinite(state.duration) ? state.duration : 0,
			volume: isFinite(state.volume) ? state.volume : 1,
			muted: !!state.muted,
			error: cleanText(state.error || ''),
			meta: copyMeta(state.meta)
		};
	}

	function createPlog(prefix){
		prefix = cleanText(prefix) || '[a3m]';

		return {
			prefix: prefix,
			log: function(){
				const args = [ prefix ].concat([].slice.call(arguments));
				console.log.apply(console, args);
			},
			warn: function(){
				const args = [ prefix ].concat([].slice.call(arguments));
				console.warn.apply(console, args);
			},
			err: function(){
				const args = [ prefix ].concat([].slice.call(arguments));
				console.error.apply(console, args);
			},
			child: function(name){
				name = cleanText(name);
				return createPlog(name ? (prefix + ':' + name) : prefix);
			}
		};
	}

	function plogPrefix(root, opts){
		const id = cleanText(root && root.id || '');
		const prefix = cleanText(opts && opts.logPrefix || '');

		if (prefix) return prefix;
		if (id) return '[a3m#' + id + ']';

		return '[a3m]';
	}

	function Player(root, opts){
		this.root = root || null;
		this.options = opts || {};
		this.bus = new Bus();
		this.state = {
			ready: false,
			playing: false,
			currentSource: '',
			currentTrack: null,
			position: 0,
			duration: 0,
			volume: 1,
			muted: false,
			error: '',
			meta: {}
		};
		this.plugins = [];
		this.detachers = [];
		this.coreDetachers = [];
		this.inited = false;
		this.plog = createPlog(plogPrefix(root, opts));

		this.bindCore();
	}

	Player.prototype.context = function(){
		const self = this;

		return {
			root: self.root,
			options: self.options,
			bus: self.bus,
			plog: self.plog,
			player: self,
			getState: function(){
				return self.getState();
			},
			setState: function(patch){
				return self.setState(patch);
			},
			command: function(type, detail){
				return self.command(type, detail);
			}
		};
	};

	Player.prototype.getState = function(){
		return copyState(this.state);
	};

	Player.prototype.setState = function(patch){
		const prev = this.getState();
		const next = this.getState();
		let changed = false;
		let k = '';

		patch = patch || {};

		for (k in patch) {
			if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
			if (next[k] === patch[k]) continue;
			next[k] = patch[k];
			changed = true;
		}

		if (!changed) return this.getState();

		this.state = copyState(next);

		this.bus.emit('state:change', {
			prev: prev,
			patch: patch,
			state: this.getState()
		});

		return this.getState();
	};

	Player.prototype.command = function(type, detail){
		type = cleanText(type);
		if (!type) return this;

		this.plog.log(type, detail || {});
		this.bus.emit(type, detail || {});

		return this;
	};

	Player.prototype.use = function(plugin, opts){
		let detach = null;

		if (!plugin || typeof plugin.attach !== 'function') return this;

		detach = plugin.attach(this.context(), opts);
		this.plugins.push(plugin);

		if (typeof detach === 'function') this.detachers.push(detach);

		return this;
	};

	Player.prototype.listenCore = function(type, fn){
		const off = this.bus.on(type, fn);
		this.coreDetachers.push(off);
		return off;
	};

	Player.prototype.bindCore = function(){
		const self = this;

		self.listenCore('evt:load', function(detail){
			self.setState({
				ready: false,
				currentSource: cleanText(
					detail && (detail.source || detail.src) || self.state.currentSource
				),
				position: 0,
				duration: 0,
				error: ''
			});
		});

		self.listenCore('evt:meta', function(detail){
			self.setState({
				currentSource: cleanText(
					detail && (detail.source || detail.src) || self.state.currentSource
				),
				currentTrack: copyTrack(detail && detail.track),
				meta: copyMeta(detail && detail.meta),
				error: ''
			});
		});

		self.listenCore('evt:ready', function(detail){
			self.setState({
				ready: true,
				duration: isFinite(detail && detail.duration) ? detail.duration : self.state.duration,
				error: ''
			});
		});

		self.listenCore('evt:play', function(){
			self.setState({
				playing: true,
				error: ''
			});
		});

		self.listenCore('evt:pause', function(){
			self.setState({
				playing: false
			});
		});

		self.listenCore('evt:stop', function(detail){
			self.setState({
				playing: false,
				position: isFinite(detail && detail.position) ? detail.position : 0
			});
		});

		self.listenCore('evt:ended', function(detail){
			self.setState({
				playing: false,
				position: isFinite(detail && detail.position) ? detail.position : self.state.position
			});
		});

		self.listenCore('evt:time', function(detail){
			self.setState({
				position: isFinite(detail && detail.position) ? detail.position : self.state.position,
				duration: isFinite(detail && detail.duration) ? detail.duration : self.state.duration
			});
		});

		self.listenCore('evt:volume', function(detail){
			self.setState({
				volume: isFinite(detail && detail.volume) ? detail.volume : self.state.volume,
				muted: !!(detail && detail.muted)
			});
		});

		self.listenCore('evt:error', function(detail){
			self.setState({
				error: cleanText(detail && (detail.message || detail.error) || 'Error')
			});
		});
	};

	Player.prototype.init = function(){
		if (this.inited) return this;

		this.inited = true;
		this.command('cmd:init', {
			root: this.root,
			options: this.options
		});
		this.bus.emit('evt:init', {
			root: this.root,
			options: this.options,
			state: this.getState()
		});

		return this;
	};

	Player.prototype.destroy = function(){
		let i = 0;

		for (i = this.detachers.length - 1; i >= 0; i--) {
			try {
				this.detachers[i]();
			} catch (e) {
				this.plog.err('destroy failed', e);
			}
		}

		for (i = this.coreDetachers.length - 1; i >= 0; i--) {
			try {
				this.coreDetachers[i]();
			} catch (e) {}
		}

		this.plugins = [];
		this.detachers = [];
		this.coreDetachers = [];
		this.inited = false;
	};

	A3M.createPlog = A3M.createPlog || createPlog;
	A3M.Player = Player;
})();