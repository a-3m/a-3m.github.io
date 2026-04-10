// File: a3m.plugin.covergen.js
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const A3M = window.A3M || (window.A3M = {});

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function sourceInfo(state, detail){
		const meta = detail && detail.meta || state && state.meta || {};
		const track = detail && detail.track || state && state.currentTrack || null;
		const source = cleanText(detail && detail.source || state && state.currentSource || '');
		const m = /^test:\/\/sin(?:\?(.*))?$/i.exec(source);
		let freq = cleanText(meta.freq || '');
		let qs = '';
		let parts = [];
		let i = 0;
		let kv = null;

		if (!m) return null;
		if (track && cleanText(track.cover)) return null;
		if (cleanText(meta.cover)) return null;

		qs = cleanText(m[1] || '');
		if (qs) {
			parts = qs.split('&');
			for (i = 0; i < parts.length; i++) {
				kv = parts[i].split('=');
				if (cleanText(kv[0]).toLowerCase() === 'freq') {
					freq = decodeURIComponent(kv.slice(1).join('=') || '');
					break;
				}
			}
		}

		freq = cleanText(freq || meta.title || '');
		if (!/^\d+(\.\d+)?$/.test(freq)) {
			freq = /\b(\d+(?:\.\d+)?)\s*hz\b/i.exec(cleanText(meta.title || ''));
			freq = freq ? freq[1] : '440';
		}

		return {
			source: source,
			freq: freq,
			mode: cleanText(meta.outputModeResolved || meta.outputMode || 'auto'),
			title: cleanText(meta.title || ('Sine ' + freq + ' Hz')),
			artist: cleanText(meta.artist || 'A3M Test'),
			album: cleanText(meta.album || 'test://sin')
		};
	}

	function copyTrack(track){
		track = track || {};

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

	function hue(freq, add){
		return (Math.round(parseFloat(freq) || 440) + (add || 0)) % 360;
	}

	function fitFont(ctx, text, want, maxWidth, weight, family){
		let size = want;

		while (size > 10) {
			ctx.font = (weight || '400') + ' ' + size + 'px ' + (family || 'Arial');
			if (ctx.measureText(text).width <= maxWidth) return;
			size -= 2;
		}
	}

	function drawCover(size, info){
		const cnv = document.createElement('canvas');
		const g = cnv.getContext && cnv.getContext('2d');
		const freqNum = parseFloat(info.freq) || 440;
		const h1 = hue(freqNum, 0);
		const h2 = hue(freqNum, 65);
		const h3 = hue(freqNum, 150);
		let grad = null;
		let r = 0;

		if (!g) return '';

		cnv.width = size;
		cnv.height = size;

		grad = g.createLinearGradient(0, 0, size, size);
		grad.addColorStop(0, 'hsl(' + h1 + ',85%,14%)');
		grad.addColorStop(1, 'hsl(' + h3 + ',90%,6%)');
		g.fillStyle = grad;
		g.fillRect(0, 0, size, size);

		r = size * 0.16;
		g.globalAlpha = 0.18;
		g.fillStyle = 'hsl(' + h2 + ',95%,55%)';
		g.beginPath();
		g.arc(size * 0.24, size * 0.22, r, 0, Math.PI * 2);
		g.fill();

		g.globalAlpha = 0.14;
		g.fillStyle = 'hsl(' + h1 + ',95%,50%)';
		g.beginPath();
		g.arc(size * 0.75, size * 0.80, r * 0.9, 0, Math.PI * 2);
		g.fill();
		g.globalAlpha = 1;

		g.lineWidth = Math.max(2, size * 0.010);
		g.strokeStyle = 'hsl(' + h1 + ',98%,62%)';
		g.beginPath();
		g.arc(size * 0.5, size * 0.5, size * 0.28, 0, Math.PI * 2);
		g.stroke();

		g.lineWidth = Math.max(2, size * 0.006);
		g.strokeStyle = 'hsl(' + h2 + ',98%,56%)';
		g.beginPath();
		g.arc(size * 0.5, size * 0.5, size * 0.19, 0, Math.PI * 2);
		g.stroke();

		g.lineWidth = Math.max(1, size * 0.004);
		g.strokeStyle = 'hsl(' + h3 + ',98%,60%)';
		g.beginPath();
		g.arc(size * 0.5, size * 0.5, size * 0.12, 0, Math.PI * 2);
		g.stroke();

		g.fillStyle = '#fff';
		g.textAlign = 'center';
		g.textBaseline = 'middle';

		fitFont(g, 'SIN', Math.round(size * 0.12), size * 0.7, '600', 'Arial');
		g.fillText('SIN', size * 0.5, size * 0.42);

		fitFont(g, info.freq + ' Hz', Math.round(size * 0.085), size * 0.78, '400', 'Arial');
		g.fillText(info.freq + ' Hz', size * 0.5, size * 0.53);

		g.fillStyle = 'rgba(255,255,255,0.82)';
		fitFont(g, info.mode, Math.round(size * 0.035), size * 0.5, '400', 'Arial');
		g.fillText(info.mode, size * 0.5, size * 0.61);

		g.fillStyle = 'rgba(255,255,255,0.56)';
		fitFont(g, 'A3M TEST SIGNAL', Math.round(size * 0.028), size * 0.7, '400', 'Arial');
		g.fillText('A3M TEST SIGNAL', size * 0.5, size * 0.85);

		try {
			return cnv.toDataURL('image/png');
		} catch (e) {
			return '';
		}
	}

	function coverSet(info){
		return {
			cover: drawCover(1024, info),
			cover512: drawCover(512, info),
			cover256: drawCover(256, info)
		};
	}

	function PluginCoverGen(opts){
		this.options = opts || {};
	}

	PluginCoverGen.prototype.attach = function(ctx){
		const plog = ctx.plog.child('covergen');
		const bus = ctx.bus;
		const off = [];

		function listen(type, fn){
			off.push(bus.on(type, fn));
		}

		function apply(detail){
			const state = ctx.getState();
			const info = sourceInfo(state, detail);
			const set = info ? coverSet(info) : null;
			let track = null;
			let meta = null;

			if (!info || !set || !set.cover) return;

			track = copyTrack(state.currentTrack);
			meta = copyMeta(state.meta);

			track.src = track.src || info.source;
			track.title = track.title || info.title;
			track.artist = track.artist || info.artist;
			track.album = track.album || info.album;
			track.cover = set.cover;

			meta.title = meta.title || info.title;
			meta.artist = meta.artist || info.artist;
			meta.album = meta.album || info.album;
			meta.cover = set.cover;
			meta.cover512 = set.cover512 || set.cover;
			meta.cover256 = set.cover256 || set.cover512 || set.cover;
			meta.freq = info.freq;
			meta.coverGenerated = 'covergen:test://sin';

			ctx.setState({
				currentTrack: track,
				meta: meta
			});

			ctx.bus.emit('evt:meta', {
				source: info.source,
				track: track,
				meta: meta
			});

			plog.log('generated', info.source, info.freq + 'Hz');
		}

		listen('evt:meta', apply);

		return function(){
			let i = 0;

			for (i = 0; i < off.length; i++) off[i]();
		};
	};

	A3M.PluginCoverGen = PluginCoverGen;
})();