/* file: a3m.icons.js */
/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

;(function(){
	const a3m = window.a3m || (window.a3m = {});
	const { log } = a3m.logp('icons');

	function cleanText(s){
		return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
	}

	function svgUrl(body, viewBox){
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + cleanText(viewBox || '0 0 24 24') + '">' +
			String(body == null ? '' : body) +
			'</svg>';

		return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
	}

	function iconDef(body, viewBox){
		return {
			body: String(body == null ? '' : body),
			viewBox: cleanText(viewBox || '0 0 24 24')
		};
	}

	function iconVarMissing(node, name){
		const v = cleanText(window.getComputedStyle(node).getPropertyValue(name) || '').toLowerCase();

		return !v || v === 'none' || v === 'initial' || v === 'unset';
	}

	function setIconVar(node, name, def){
		if (!node || !node.style || !def) return false;
		if (!iconVarMissing(node, name)) return false;

		node.style.setProperty(name, svgUrl(def.body, def.viewBox));
		return true;
	}

	function volBody(level){
		const s = ' fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
		let out = '<path d="M8 7.5 4.6 12 8 16.5"' + s;

		if (level >= 1) out += '<path d="M11.2 10.2A2.2 2.2 0 0 1 11.2 13.8"' + s;
		if (level >= 2) out += '<path d="M13.3 8.7A4.4 4.4 0 0 1 13.3 15.3"' + s;
		if (level >= 3) out += '<path d="M15.4 7.2A6.6 6.6 0 0 1 15.4 16.8"' + s;
		if (level >= 4) out += '<path d="M17.5 5.7A8.8 8.8 0 0 1 17.5 18.3"' + s;

		return out;
	}

function channelStereoBody(){
	const s = ' fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>';

	return '' +
		'<path d="M6.0 4.2Q-1.2 12 6.0 19.8"' + s +
		'<path d="M8.2 6.2Q2.8 12 8.2 17.8"' + s +
		'<path d="M10.4 8.4Q6.6 12 10.4 15.6"' + s +
		'<path d="M18.0 4.2Q25.2 12 18.0 19.8"' + s +
		'<path d="M15.8 6.2Q21.2 12 15.8 17.8"' + s +
		'<path d="M13.6 8.4Q17.4 12 13.6 15.6"' + s;
}
	function channel4Body(){
		const s = ' fill="none" stroke="white" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>';

		return '' +
			'<path d="M8.2 3.6Q3.8 6.2 8.2 8.8"' + s +
			'<path d="M9.8 4.8Q6.8 6.2 9.8 7.6"' + s +
			'<path d="M15.8 3.6Q20.2 6.2 15.8 8.8"' + s +
			'<path d="M14.2 4.8Q17.2 6.2 14.2 7.6"' + s +
			'<path d="M8.2 15.2Q3.8 17.8 8.2 20.4"' + s +
			'<path d="M9.8 16.4Q6.8 17.8 9.8 19.2"' + s +
			'<path d="M15.8 15.2Q20.2 17.8 15.8 20.4"' + s +
			'<path d="M14.2 16.4Q17.2 17.8 14.2 19.2"' + s;
	}

	const FALLBACK_ICONS = {
		'--a3m-icon-play': iconDef(
			'<path fill="white" d="M8 5v14l11-7z"/>'
		),
		'--a3m-icon-stop': iconDef(
			'<path fill="white" d="M6 6h12v12H6z"/>'
		),
		'--a3m-icon-pause': iconDef(
			'<path fill="white" d="M7 5h4v14H7zm6 0h4v14h-4z"/>'
		),
		'--a3m-icon-prev': iconDef(
			'<path fill="white" d="M6 5h2v14H6zm3 7 9-7v14z"/>'
		),
		'--a3m-icon-next': iconDef(
			'<path fill="white" d="M16 5h2v14h-2zM7 19V5l9 7z"/>'
		),
		'--a3m-icon-shuffle': iconDef(
			'<path fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M4 7h3c2.2 0 3.5.6 4.8 2.3l5.4 7.4"/>' +
			'<path fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M4 17h3c2.2 0 3.5-.6 4.8-2.3L17.2 7"/>' +
			'<path fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M15 5h5v5"/>' +
			'<path fill="none" stroke="white" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="M15 19h5v-5"/>'
		),
		'--a3m-icon-repeat': iconDef(
			'<path fill="white" d="M7 7h10v3l4-4-4-4v3H7a5 5 0 0 0-5 5 5 5 0 0 0 1.5 3.5l1.4-1.4A3 3 0 0 1 4 10a3 3 0 0 1 3-3zm10 10H7v-3l-4 4 4 4v-3h10a5 5 0 0 0 5-5 5 5 0 0 0-1.5-3.5l-1.4 1.4A3 3 0 0 1 20 14a3 3 0 0 1-3 3z"/>'
		),
		'--a3m-icon-refresh': iconDef(
	'<path fill="none" stroke="white" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M18 8a6.5 6.5 0 1 0 1 5.5"/>' +
	'<path fill="none" stroke="white" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" d="M18 5v4h-4"/>'
),
		'--a3m-icon-settings': iconDef(
			'<path fill="white" d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.14 7.14 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.49.42l-.37 2.54c-.58.22-1.12.53-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.57 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.08.63-.08.94s.03.63.08.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.31.6.22l2.39-.96c.5.41 1.04.72 1.62.94l.37 2.54c.04.24.25.42.49.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.22 1.13-.53 1.63-.94l2.39.96c.22.09.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64zm-7.14 2.56a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>'
		),
		'--a3m-icon-channel': iconDef(
			channelStereoBody()
		),
		'--a3m-icon-channel-2': iconDef(
			channelStereoBody()
		),
		'--a3m-icon-channel-4': iconDef(
			channel4Body()
		),
		'--a3m-icon-channel-0': iconDef(
			'<rect fill="none" stroke="white" stroke-width="1.8" x="5" y="7" width="14" height="10" rx="1.5"/>' +
			'<path fill="none" stroke="white" stroke-width="2" stroke-linecap="round" d="M7 17 17 7"/>'
		),
		'--a3m-icon-playlist': iconDef(
			'<path fill="white" d="M4 6h10v2H4zm0 5h10v2H4zm0 5h10v2H4zm12-8 5 4-5 4z"/>'
		),
		'--a3m-icon-share': iconDef(
			'<path fill="white" d="M14 4h6v6h-2V7.41l-6.29 6.3-1.42-1.42L16.59 6H14z"/>' +
			'<path fill="white" d="M5 5h7v2H7v10h10v-5h2v7H5z"/>'
		),
		'--a3m-icon-download': iconDef(
			'<path fill="white" d="M11 4h2v8.17l2.59-2.58L17 11l-5 5-5-5 1.41-1.41L11 12.17z"/>' +
			'<path fill="white" d="M5 18h14v2H5z"/>'
		),
		'--a3m-icon-fullscreen-in': iconDef(
			'<path fill="white" d="M4 10V4h6v2H6v4zM14 4h6v6h-2V6h-4zM4 14h2v4h4v2H4zM18 14h2v6h-6v-2h4z"/>'
		),
		'--a3m-icon-fullscreen-out': iconDef(
			'<path fill="white" d="M8 4v2H6v2H4V4zM20 4v4h-2V6h-2V4zM4 20v-4h2v2h2v2zM18 16h2v4h-4v-2h2z"/>'
		),
		'--a3m-icon-viewmode': iconDef(
			'<path fill="white" d="M4 6h16v12H4z"/>' +
			'<path fill="black" d="M12 6h8v12h-8z"/>' +
			'<path fill="white" d="M12 8a4 4 0 1 0 0 8z"/>'
		),
		'--a3m-icon-close': iconDef(
			'<path fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" d="M7 7l10 10M17 7 7 17"/>'
		),
		'--a3m-icon-more': iconDef(
			'<circle fill="white" cx="6" cy="12" r="1.7"/>' +
			'<circle fill="white" cx="12" cy="12" r="1.7"/>' +
			'<circle fill="white" cx="18" cy="12" r="1.7"/>'
		),
		'--a3m-icon-vol-0': iconDef(
			volBody(0)
		),
		'--a3m-icon-vol-1': iconDef(
			volBody(1)
		),
		'--a3m-icon-vol-2': iconDef(
			volBody(2)
		),
		'--a3m-icon-vol-3': iconDef(
			volBody(3)
		),
		'--a3m-icon-vol-4': iconDef(
			volBody(4)
		),
		'--a3m-icon-mute': iconDef(
			'<path d="M8 7.5 4.6 12 8 16.5" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
			'<path d="M13 9.2 18 14.8m0-5.6L13 14.8" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"/>'
		)
	};

	function applyIcons(root){
		let applied = 0;
		let name = '';

		if (!root || !root.style) return 0;

		for (name in FALLBACK_ICONS) {
			if (!Object.prototype.hasOwnProperty.call(FALLBACK_ICONS, name)) continue;
			if (setIconVar(root, name, FALLBACK_ICONS[name])) applied++;
		}

		if (applied) log('apply', applied, root.id || root.className || 'player');

		return applied;
	}

	function applyAll(){
		const nodes = document.querySelectorAll('.a3m-player');
		let total = 0;
		let i = 0;

		for (i = 0; i < nodes.length; i++) total += applyIcons(nodes[i]);

		return total;
	}

	a3m.iconsApply = applyIcons;
	a3m.iconsBoot = applyAll;
	a3m.iconsFallback = FALLBACK_ICONS;

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', applyAll);
	} else {
		applyAll();
	}
})();
