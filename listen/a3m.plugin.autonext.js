/* file: a3m.plugin.autonext.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log } = a3m.logp('autonext');

	function PluginAutoNext(opts){
		this.options = opts || {};
	}

	PluginAutoNext.prototype.attach = function(ctx){
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
			log('ended -> next');
			endedTimer = setTimeout(function(){
				endedTimer = 0;
				ctx.command('cmd:next', {
					via: 'autonext',
					ended: detail || {},
					autoplay: true
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

	a3m.PluginAutoNext = PluginAutoNext;
})();