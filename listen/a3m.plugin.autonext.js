// File: a3m.plugin.autonext.js
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const A3M = window.A3M || (window.A3M = {});

	function PluginAutoNext(opts){
		this.options = opts || {};
	}

	PluginAutoNext.prototype.attach = function(ctx){
		const plog = ctx.plog.child('autonext');
		const bus = ctx.bus;
		const off = [];
		let endedTimer = 0;

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function clearEndedTimer(){
			if (endedTimer) clearTimeout(endedTimer);
			endedTimer = 0;
		}

		listen('evt:ended', function(detail){
			clearEndedTimer();
			plog.log('ended -> next');
			endedTimer = setTimeout(function(){
				endedTimer = 0;
				ctx.command('cmd:next', {
					via: 'autonext',
					ended: detail || {}
				});
				ctx.command('cmd:play', {
					via: 'autonext'
				});
			}, 0);
		});

		listen('cmd:stop', function(){
			clearEndedTimer();
		});

		return function(){
			let i = 0;

			clearEndedTimer();

			for (i = 0; i < off.length; i++) off[i]();
		};
	};

	A3M.PluginAutoNext = PluginAutoNext;
})();