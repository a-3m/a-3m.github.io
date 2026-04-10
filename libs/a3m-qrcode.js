/*
# vim: set ts=4 sw=4 sts=4 noet :
*/

(function(w, d){
	if (w.a3m_qrcode) return;

	var a3m_qrcode = 0;
	var a3m_qrcode_ver = '0.2.0';
	var a3m_qrcode_style = 0;
	var a3m_qrcode_layer = 0;
	var a3m_qrcode_box = 0;
	var a3m_qrcode_title = 0;
	var a3m_qrcode_code = 0;
	var a3m_qrcode_note = 0;
	var a3m_qrcode_hint = 0;
	var a3m_qrcode_flash_timer = 0;
	var a3m_qrcode_close_timer = 0;
	var a3m_qrcode_listeners = {};
	var a3m_qrcode_exp = [];
	var a3m_qrcode_log = [];
	var a3m_qrcode_pattern_position_table = [
		[],
		[6, 18],
		[6, 22],
		[6, 26],
		[6, 30],
		[6, 34],
		[6, 22, 38],
		[6, 24, 42],
		[6, 26, 46],
		[6, 28, 50]
	];
	var a3m_qrcode_ecc_per_block = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
	var a3m_qrcode_num_blocks = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
	var a3m_qrcode_g15 = 1335;
	var a3m_qrcode_g15_mask = 21522;
	var a3m_qrcode_state = {
		open: 0,
		title: '',
		text: '',
		note: '',
		flash_ms: 180,
		auto_close_scan: 1,
		border: 4,
		scale: 8,
		ecc: 'M'
	};

	function log(){
		var args = ['[a3m-qrcode]'];
		var i;

		for (i = 0; i < arguments.length; i++) args.push(arguments[i]);
		console.log.apply(console, args);
	}

	function warn(){
		var args = ['[a3m-qrcode]'];
		var i;

		for (i = 0; i < arguments.length; i++) args.push(arguments[i]);
		console.warn.apply(console, args);
	}

	function available(){
		return !!(w && d && d.createElement && d.createElementNS);
	}

	function current(){
		return {
			open: a3m_qrcode_state.open ? 1 : 0,
			title: a3m_qrcode_state.title,
			text: a3m_qrcode_state.text,
			note: a3m_qrcode_state.note
		};
	}

	function on(name, fn){
		name = String(name || '');

		if (!name || typeof fn !== 'function') return a3m_qrcode;
		if (!a3m_qrcode_listeners[name]) a3m_qrcode_listeners[name] = [];
		a3m_qrcode_listeners[name].push(fn);
		return a3m_qrcode;
	}

	function off(name, fn){
		var list;
		var i;

		name = String(name || '');
		list = a3m_qrcode_listeners[name] || [];

		for (i = list.length - 1; i >= 0; i--) {
			if (list[i] === fn) list.splice(i, 1);
		}

		return a3m_qrcode;
	}

	function emit(name, extra){
		var list = (a3m_qrcode_listeners[name] || []).slice(0);
		var detail = current();
		var i;
		var k;

		detail.event = name;

		if (extra && typeof extra === 'object') {
			for (k in extra) detail[k] = extra[k];
		}

		for (i = 0; i < list.length; i++) {
			try {
				list[i](detail);
			} catch (e) {}
		}

		try {
			w.dispatchEvent(new CustomEvent('a3m:qrcode:' + name, { detail: detail }));
		} catch (e2) {}
	}

	function inject_css(){
		if (a3m_qrcode_style) return;

		a3m_qrcode_style = d.createElement('style');
		a3m_qrcode_style.textContent =
			'.a3m_qrcode_layer{' +
				'position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;' +
				'padding:16px;background:rgba(0,0,0,.82);box-sizing:border-box;touch-action:manipulation;' +
			'}' +
			'.a3m_qrcode_layer.is_open{display:flex;}' +
			'.a3m_qrcode_layer.is_flash{animation:a3m_qrcode_flash .18s linear 1;}' +
			'.a3m_qrcode_box{' +
				'width:min(92vw,560px);max-width:100%;max-height:min(92vh,760px);min-width:240px;' +
				'display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:12px;' +
				'padding:16px;border:1px solid #444;border-radius:16px;background:#101010;color:#eee;' +
				'box-sizing:border-box;text-align:center;box-shadow:0 14px 48px rgba(0,0,0,.45);' +
				'font:16px/1.4 Arial,sans-serif;overflow:auto;' +
			'}' +
			'.a3m_qrcode_title{font:700 20px/1.2 Arial,sans-serif;word-break:break-word;}' +
			'.a3m_qrcode_code{' +
				'width:min(100%,420px);max-width:100%;flex:0 0 auto;padding:10px;border-radius:10px;background:#fff;' +
				'box-sizing:border-box;overflow:hidden;' +
			'}' +
			'.a3m_qrcode_code svg{display:block;width:100%;height:auto;shape-rendering:crispEdges;}' +
			'.a3m_qrcode_note{max-width:100%;color:#aaa;font:13px/1.35 monospace;word-break:break-all;}' +
			'.a3m_qrcode_hint{color:#666;font-size:12px;}' +
			'@keyframes a3m_qrcode_flash{' +
				'0%{background:rgba(0,0,0,.82);}' +
				'50%{background:rgba(255,255,255,.28);}' +
				'100%{background:rgba(0,0,0,.82);}' +
			'}' +
			'@media (max-width:760px){' +
				'.a3m_qrcode_box{width:min(94vw,520px);max-height:min(94vh,720px);padding:14px;border-radius:14px;}' +
				'.a3m_qrcode_title{font-size:18px;}' +
				'.a3m_qrcode_code{width:min(100%,78vw);}' +
			'}';
		d.head.appendChild(a3m_qrcode_style);
	}

	function ensure_dom(){
		if (a3m_qrcode_layer) return;

		inject_css();

		a3m_qrcode_layer = d.createElement('div');
		a3m_qrcode_layer.className = 'a3m_qrcode_layer';

		a3m_qrcode_box = d.createElement('div');
		a3m_qrcode_box.className = 'a3m_qrcode_box';

		a3m_qrcode_title = d.createElement('div');
		a3m_qrcode_title.className = 'a3m_qrcode_title';

		a3m_qrcode_code = d.createElement('div');
		a3m_qrcode_code.className = 'a3m_qrcode_code';

		a3m_qrcode_note = d.createElement('div');
		a3m_qrcode_note.className = 'a3m_qrcode_note';

		a3m_qrcode_hint = d.createElement('div');
		a3m_qrcode_hint.className = 'a3m_qrcode_hint';
		a3m_qrcode_hint.textContent = 'tap to close';

		a3m_qrcode_box.appendChild(a3m_qrcode_title);
		a3m_qrcode_box.appendChild(a3m_qrcode_code);
		a3m_qrcode_box.appendChild(a3m_qrcode_note);
		a3m_qrcode_box.appendChild(a3m_qrcode_hint);
		a3m_qrcode_layer.appendChild(a3m_qrcode_box);
		d.body.appendChild(a3m_qrcode_layer);

		a3m_qrcode_layer.onclick = function(){
			close();
		};

		w.addEventListener('keydown', function(e){
			if (!a3m_qrcode_state.open || e.key !== 'Escape') return;
			e.preventDefault();
			close();
		}, true);

		log('dom ready');
	}

	function norm_signal(s){
		s = String(s || '').toLowerCase();
		s = s.replace(/\s+/g, '');
		s = s.replace(/^a3m:qrcode:/, '');
		s = s.replace(/^qrcode:/, '');
		s = s.replace(/^qrcode-/, '');
		s = s.replace(/^qr:/, '');
		s = s.replace(/^qr-/, '');
		return s;
	}

	function init_gf(){
		var x = 1;
		var i;

		if (a3m_qrcode_exp.length) return;

		for (i = 0; i < 256; i++) {
			a3m_qrcode_exp[i] = x;
			a3m_qrcode_log[x] = i;
			x <<= 1;
			if (x & 256) x ^= 0x11d;
		}

		for (i = 256; i < 512; i++) a3m_qrcode_exp[i] = a3m_qrcode_exp[i - 255];
		a3m_qrcode_log[0] = 0;
	}

	function gexp(n){
		n %= 255;
		if (n < 0) n += 255;
		return a3m_qrcode_exp[n];
	}

	function glog(n){
		if (n < 1) throw new Error('glog');
		return a3m_qrcode_log[n];
	}

	function Polynomial(num, shift){
		var offset = 0;

		if (!num || !num.length) throw new Error('poly');

		while (offset < num.length && num[offset] === 0) offset++;
		this.num = num.slice(offset).concat(new Array(shift + 1).join('0').split('').map(function(){ return 0; }));
	}

	Polynomial.prototype.get = function(index){
		return this.num[index];
	};

	Polynomial.prototype.len = function(){
		return this.num.length;
	};

	Polynomial.prototype.mul = function(other){
		var num = [];
		var i;
		var j;

		for (i = 0; i < this.len() + other.len() - 1; i++) num[i] = 0;

		for (i = 0; i < this.len(); i++) {
			for (j = 0; j < other.len(); j++) {
				num[i + j] ^= gexp(glog(this.get(i)) + glog(other.get(j)));
			}
		}

		return new Polynomial(num, 0);
	};

	Polynomial.prototype.mod = function(other){
		var difference = this.len() - other.len();
		var ratio;
		var num = [];
		var i;

		if (difference < 0) return this;

		ratio = glog(this.get(0)) - glog(other.get(0));

		for (i = 0; i < other.len(); i++) {
			num.push(this.get(i) ^ gexp(glog(other.get(i)) + ratio));
		}

		if (difference) num = num.concat(this.num.slice(this.len() - difference));
		return new Polynomial(num, 0).mod(other);
	};

	function get_num_raw_data_modules(ver){
		var result = (16 * ver + 128) * ver + 64;
		var numAlign;

		if (ver < 1 || ver > 40) throw new Error('bad qr version');

		if (ver >= 2) {
			numAlign = Math.floor(ver / 7) + 2;
			result -= (25 * numAlign - 10) * numAlign - 55;
			if (ver >= 7) result -= 36;
		}

		return result;
	}

	function get_num_data_codewords(ver){
		return Math.floor(get_num_raw_data_modules(ver) / 8) -
			a3m_qrcode_ecc_per_block[ver] * a3m_qrcode_num_blocks[ver];
	}

	function utf8_bytes(s){
		var i;
		var out = [];
		var enc;

		s = String(s || '');

		if (w.TextEncoder) return Array.prototype.slice.call(new TextEncoder().encode(s));

		enc = unescape(encodeURIComponent(s));
		for (i = 0; i < enc.length; i++) out.push(enc.charCodeAt(i));
		return out;
	}

	function choose_version(bytes){
		var ver;
		var cap;
		var bits;

		for (ver = 1; ver <= 10; ver++) {
			cap = get_num_data_codewords(ver) * 8;
			bits = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
			if (bits <= cap) return ver;
		}

		throw new Error('text too long for qr version 10 M');
	}

	function pack_bits(bytes, ver){
		var bits = [];
		var cap = get_num_data_codewords(ver) * 8;
		var data = [];
		var i;
		var pad = 0xec;

		function put(val, len){
			var j;
			for (j = len - 1; j >= 0; j--) bits.push((val >>> j) & 1);
		}

		put(0x4, 4);
		put(bytes.length, ver < 10 ? 8 : 16);

		for (i = 0; i < bytes.length; i++) put(bytes[i], 8);

		for (i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
		while (bits.length & 7) bits.push(0);

		while (bits.length < cap) {
			put(pad, 8);
			pad = pad === 0xec ? 0x11 : 0xec;
		}

		for (i = 0; i < bits.length; i += 8) {
			data.push(
				(bits[i] << 7) |
				(bits[i + 1] << 6) |
				(bits[i + 2] << 5) |
				(bits[i + 3] << 4) |
				(bits[i + 4] << 3) |
				(bits[i + 5] << 2) |
				(bits[i + 6] << 1) |
				bits[i + 7]
			);
		}

		return data;
	}

	function create_codewords(dataBytes, ver){
		var numBlocks = a3m_qrcode_num_blocks[ver];
		var ecCount = a3m_qrcode_ecc_per_block[ver];
		var rawCodewords = Math.floor(get_num_raw_data_modules(ver) / 8);
		var numShortBlocks = numBlocks - rawCodewords % numBlocks;
		var shortDcCount = Math.floor(rawCodewords / numBlocks) - ecCount;
		var dcdata = [];
		var ecdata = [];
		var maxDc = 0;
		var maxEc = 0;
		var offset = 0;
		var b;
		var i;
		var rsPoly;
		var rawPoly;
		var modPoly;
		var modOffset;
		var currentDc;
		var currentEc;
		var dcCount;
		var out = [];

		for (b = 0; b < numBlocks; b++) {
			dcCount = shortDcCount + (b < numShortBlocks ? 0 : 1);
			currentDc = dataBytes.slice(offset, offset + dcCount);
			offset += dcCount;
			maxDc = Math.max(maxDc, dcCount);
			maxEc = Math.max(maxEc, ecCount);

			rsPoly = new Polynomial([1], 0);
			for (i = 0; i < ecCount; i++) rsPoly = rsPoly.mul(new Polynomial([1, gexp(i)], 0));

			rawPoly = new Polynomial(currentDc, rsPoly.len() - 1);
			modPoly = rawPoly.mod(rsPoly);
			modOffset = modPoly.len() - ecCount;
			currentEc = [];

			for (i = 0; i < ecCount; i++) {
				currentEc.push(i + modOffset >= 0 ? modPoly.get(i + modOffset) : 0);
			}

			dcdata.push(currentDc);
			ecdata.push(currentEc);
		}

		for (i = 0; i < maxDc; i++) {
			for (b = 0; b < dcdata.length; b++) {
				if (i < dcdata[b].length) out.push(dcdata[b][i]);
			}
		}

		for (i = 0; i < maxEc; i++) {
			for (b = 0; b < ecdata.length; b++) {
				if (i < ecdata[b].length) out.push(ecdata[b][i]);
			}
		}

		return out;
	}

	function alloc_null(size){
		var arr = [];
		var y;
		var x;

		for (y = 0; y < size; y++) {
			arr[y] = [];
			for (x = 0; x < size; x++) arr[y][x] = null;
		}

		return arr;
	}

	function bch_digit(data){
		var digit = 0;

		while (data !== 0) {
			digit++;
			data >>>= 1;
		}

		return digit;
	}

	function BCH_type_info(data){
		var d = data << 10;

		while (bch_digit(d) - bch_digit(a3m_qrcode_g15) >= 0) {
			d ^= a3m_qrcode_g15 << (bch_digit(d) - bch_digit(a3m_qrcode_g15));
		}

		return ((data << 10) | d) ^ a3m_qrcode_g15_mask;
	}

	function mask_func(pattern){
		if (pattern === 0) return function(i, j){ return (i + j) % 2 === 0; };
		if (pattern === 1) return function(i, j){ return i % 2 === 0; };
		if (pattern === 2) return function(i, j){ return j % 3 === 0; };
		if (pattern === 3) return function(i, j){ return (i + j) % 3 === 0; };
		if (pattern === 4) return function(i, j){ return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; };
		if (pattern === 5) return function(i, j){ return (i * j) % 2 + (i * j) % 3 === 0; };
		if (pattern === 6) return function(i, j){ return ((i * j) % 2 + (i * j) % 3) % 2 === 0; };
		if (pattern === 7) return function(i, j){ return ((i * j) % 3 + (i + j) % 2) % 2 === 0; };
		throw new Error('bad mask');
	}

	function lost_point(modules){
		var modulesCount = modules.length;
		var lost = 0;
		var container = [];
		var row;
		var col;
		var len;
		var prev;
		var dark = 0;
		var rating;

		for (row = 0; row <= modulesCount; row++) container[row] = 0;

		for (row = 0; row < modulesCount; row++) {
			prev = modules[row][0];
			len = 0;

			for (col = 0; col < modulesCount; col++) {
				if (modules[row][col] === prev) {
					len++;
				} else {
					if (len >= 5) container[len]++;
					len = 1;
					prev = modules[row][col];
				}
			}

			if (len >= 5) container[len]++;
		}

		for (col = 0; col < modulesCount; col++) {
			prev = modules[0][col];
			len = 0;

			for (row = 0; row < modulesCount; row++) {
				if (modules[row][col] === prev) {
					len++;
				} else {
					if (len >= 5) container[len]++;
					len = 1;
					prev = modules[row][col];
				}
			}

			if (len >= 5) container[len]++;
		}

		for (len = 5; len <= modulesCount; len++) lost += container[len] * (len - 2);

		for (row = 0; row < modulesCount - 1; row++) {
			for (col = 0; col < modulesCount - 1; col++) {
				if (
					modules[row][col] === modules[row][col + 1] &&
					modules[row][col] === modules[row + 1][col] &&
					modules[row][col] === modules[row + 1][col + 1]
				) {
					lost += 3;
				}
			}
		}

		for (row = 0; row < modulesCount; row++) {
			for (col = 0; col < modulesCount - 10; col++) {
				if (
					!modules[row][col + 1] &&
					modules[row][col + 4] &&
					!modules[row][col + 5] &&
					modules[row][col + 6] &&
					!modules[row][col + 9] &&
					(
						(
							modules[row][col + 0] &&
							modules[row][col + 2] &&
							modules[row][col + 3] &&
							!modules[row][col + 7] &&
							!modules[row][col + 8] &&
							!modules[row][col + 10]
						) ||
						(
							!modules[row][col + 0] &&
							!modules[row][col + 2] &&
							!modules[row][col + 3] &&
							modules[row][col + 7] &&
							modules[row][col + 8] &&
							modules[row][col + 10]
						)
					)
				) {
					lost += 40;
				}
			}
		}

		for (col = 0; col < modulesCount; col++) {
			for (row = 0; row < modulesCount - 10; row++) {
				if (
					!modules[row + 1][col] &&
					modules[row + 4][col] &&
					!modules[row + 5][col] &&
					modules[row + 6][col] &&
					!modules[row + 9][col] &&
					(
						(
							modules[row + 0][col] &&
							modules[row + 2][col] &&
							modules[row + 3][col] &&
							!modules[row + 7][col] &&
							!modules[row + 8][col] &&
							!modules[row + 10][col]
						) ||
						(
							!modules[row + 0][col] &&
							!modules[row + 2][col] &&
							!modules[row + 3][col] &&
							modules[row + 7][col] &&
							modules[row + 8][col] &&
							modules[row + 10][col]
						)
					)
				) {
					lost += 40;
				}
			}
		}

		for (row = 0; row < modulesCount; row++) {
			for (col = 0; col < modulesCount; col++) {
				if (modules[row][col]) dark++;
			}
		}

		rating = Math.floor(Math.abs((dark / (modulesCount * modulesCount)) * 100 - 50) / 5);
		return lost + rating * 10;
	}

	function format_ecc_bits(ecc){
		ecc = String(ecc || 'M').toUpperCase();

		if (ecc === 'L') return 1;
		if (ecc === 'M') return 0;
		if (ecc === 'Q') return 3;
		if (ecc === 'H') return 2;
		return 0;
	}

	function build_matrix(codewords, ver, ecc){
		var size = ver * 4 + 17;
		var modules = alloc_null(size);
		var eccBits = format_ecc_bits(ecc);

		function setup_position_probe_pattern(row, col){
			var r;
			var c;

			for (r = -1; r < 8; r++) {
				if (row + r <= -1 || size <= row + r) continue;

				for (c = -1; c < 8; c++) {
					if (col + c <= -1 || size <= col + c) continue;

					modules[row + r][col + c] = (
						(0 <= r && r <= 6 && (c === 0 || c === 6)) ||
						(0 <= c && c <= 6 && (r === 0 || r === 6)) ||
						(2 <= r && r <= 4 && 2 <= c && c <= 4)
					);
				}
			}
		}

		function setup_position_adjust_pattern(){
			var pos = a3m_qrcode_pattern_position_table[ver - 1];
			var i;
			var j;
			var row;
			var col;
			var r;
			var c;

			for (i = 0; i < pos.length; i++) {
				row = pos[i];

				for (j = 0; j < pos.length; j++) {
					col = pos[j];
					if (modules[row][col] !== null) continue;

					for (r = -2; r < 3; r++) {
						for (c = -2; c < 3; c++) {
							modules[row + r][col + c] = (
								r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)
							);
						}
					}
				}
			}
		}

		function setup_timing_pattern(){
			var r;
			var c;

			for (r = 8; r < size - 8; r++) {
				if (modules[r][6] !== null) continue;
				modules[r][6] = r % 2 === 0;
			}

			for (c = 8; c < size - 8; c++) {
				if (modules[6][c] !== null) continue;
				modules[6][c] = c % 2 === 0;
			}
		}

		function setup_type_info(test, maskPattern){
			var bits = BCH_type_info((eccBits << 3) | maskPattern);
			var i;
			var mod;

			for (i = 0; i < 15; i++) {
				mod = !test && ((bits >> i) & 1) === 1;

				if (i < 6) {
					modules[i][8] = mod;
				} else if (i < 8) {
					modules[i + 1][8] = mod;
				} else {
					modules[size - 15 + i][8] = mod;
				}
			}

			for (i = 0; i < 15; i++) {
				mod = !test && ((bits >> i) & 1) === 1;

				if (i < 8) {
					modules[8][size - i - 1] = mod;
				} else if (i < 9) {
					modules[8][15 - i] = mod;
				} else {
					modules[8][15 - i - 1] = mod;
				}
			}

			modules[size - 8][8] = !test;
		}

		function map_data(dataBytes, maskPattern){
			var inc = -1;
			var row = size - 1;
			var bitIndex = 7;
			var byteIndex = 0;
			var maskFn = mask_func(maskPattern);
			var dataLen = dataBytes.length;
			var col;
			var colv;
			var c;
			var dark;

			for (col = size - 1; col > 0; col -= 2) {
				colv = col <= 6 ? col - 1 : col;

				while (1) {
					for (c = 0; c < 2; c++) {
						if (modules[row][colv - c] !== null) continue;

						dark = 0;

						if (byteIndex < dataLen) {
							dark = ((dataBytes[byteIndex] >> bitIndex) & 1) === 1;
						}

						if (maskFn(row, colv - c)) dark = !dark;
						modules[row][colv - c] = dark;

						bitIndex--;

						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}

					row += inc;

					if (row < 0 || size <= row) {
						row -= inc;
						inc = -inc;
						break;
					}
				}
			}
		}

		function make_impl(test, maskPattern){
			modules = alloc_null(size);
			setup_position_probe_pattern(0, 0);
			setup_position_probe_pattern(size - 7, 0);
			setup_position_probe_pattern(0, size - 7);
			setup_position_adjust_pattern();
			setup_timing_pattern();
			setup_type_info(test, maskPattern);
			map_data(codewords, maskPattern);
			return modules;
		}

		var bestMask = 0;
		var minLost = 0;
		var mask;
		var lp;

		for (mask = 0; mask < 8; mask++) {
			make_impl(1, mask);
			lp = lost_point(modules);

			if (mask === 0 || minLost > lp) {
				minLost = lp;
				bestMask = mask;
			}
		}

		make_impl(0, bestMask);

		return {
			version: ver,
			size: size,
			modules: modules,
			mask: bestMask
		};
	}

	function make_svg(qr, opts){
		var border = opts.border >= 0 ? (opts.border | 0) : a3m_qrcode_state.border;
		var scale = opts.scale >= 1 ? (opts.scale | 0) : a3m_qrcode_state.scale;
		var size = qr.size + border * 2;
		var y;
		var x;
		var path = '';
		var rectSize = size * scale;

		for (y = 0; y < qr.size; y++) {
			for (x = 0; x < qr.size; x++) {
				if (!qr.modules[y][x]) continue;
				path += 'M' + (x + border) + ' ' + (y + border) + 'h1v1h-1z';
			}
		}

		return (
			'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size +
			'" width="' + rectSize + '" height="' + rectSize + '" aria-label="qrcode">' +
				'<rect x="0" y="0" width="' + size + '" height="' + size + '" fill="#fff"/>' +
				'<path d="' + path + '" fill="#000"/>' +
			'</svg>'
		);
	}

	function encode_text(text){
		var bytes = utf8_bytes(text);
		var ver = choose_version(bytes);
		var data = pack_bits(bytes, ver);
		var codewords = create_codewords(data, ver);

		return build_matrix(codewords, ver, a3m_qrcode_state.ecc);
	}

	function get_svg(opts){
		var text;
		var prevEcc;

		opts = opts || {};
		text = String(opts.text || opts.link || w.location.href);
		prevEcc = a3m_qrcode_state.ecc;

		if (opts.ecc) a3m_qrcode_state.ecc = String(opts.ecc).toUpperCase();

		try {
			return make_svg(encode_text(text), opts);
		} finally {
			a3m_qrcode_state.ecc = prevEcc;
		}
	}

	function get_svg_url(opts){
		return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(get_svg(opts));
	}

	function set_data(opts){
		var svg;

		opts = opts || {};
		a3m_qrcode_state.title = String(opts.title || d.title || 'QR Code');
		a3m_qrcode_state.text = String(opts.text || opts.link || w.location.href);
		a3m_qrcode_state.note = String(opts.note || a3m_qrcode_state.text);

		if (opts.flash_ms >= 0) a3m_qrcode_state.flash_ms = opts.flash_ms | 0;
		if (typeof opts.auto_close_scan !== 'undefined') a3m_qrcode_state.auto_close_scan = opts.auto_close_scan ? 1 : 0;
		if (opts.border >= 0) a3m_qrcode_state.border = opts.border | 0;
		if (opts.scale >= 1) a3m_qrcode_state.scale = opts.scale | 0;
		if (opts.ecc) a3m_qrcode_state.ecc = String(opts.ecc).toUpperCase();

		ensure_dom();

		a3m_qrcode_title.textContent = a3m_qrcode_state.title;
		a3m_qrcode_note.textContent = a3m_qrcode_state.note;
		a3m_qrcode_hint.textContent = 'tap to close';

		svg = get_svg({
			text: a3m_qrcode_state.text,
			border: a3m_qrcode_state.border,
			scale: a3m_qrcode_state.scale,
			ecc: a3m_qrcode_state.ecc
		});
		a3m_qrcode_code.innerHTML = svg;
	}

	function flash(ms){
		if (!a3m_qrcode_layer) return a3m_qrcode;

		ms = ms >= 0 ? (ms | 0) : a3m_qrcode_state.flash_ms;

		clearTimeout(a3m_qrcode_flash_timer);
		a3m_qrcode_layer.classList.remove('is_flash');
		a3m_qrcode_layer.offsetHeight;
		a3m_qrcode_layer.classList.add('is_flash');

		a3m_qrcode_flash_timer = setTimeout(function(){
			a3m_qrcode_layer && a3m_qrcode_layer.classList.remove('is_flash');
		}, ms || 180);

		log('flash', 'ms=' + (ms || 180));
		emit('flash', {
			flash_ms: ms || 180
		});

		return a3m_qrcode;
	}

	function open(opts){
		try {
			set_data(opts);
		} catch (e) {
			warn('open failed', e && e.message ? e.message : e);
			emit('error', {
				code: 'open_failed',
				message: e && e.message ? e.message : String(e || '')
			});
			return a3m_qrcode;
		}

		a3m_qrcode_layer.classList.add('is_open');
		a3m_qrcode_state.open = 1;
		log('open', a3m_qrcode_state.text);
		emit('open');
		return a3m_qrcode;
	}

	function close(){
		if (!a3m_qrcode_layer || !a3m_qrcode_state.open) return a3m_qrcode;
		clearTimeout(a3m_qrcode_close_timer);
		a3m_qrcode_layer.classList.remove('is_open');
		a3m_qrcode_state.open = 0;
		log('close');
		emit('close');
		return a3m_qrcode;
	}

	function toggle(opts){
		if (a3m_qrcode_state.open) return close();
		return open(opts);
	}

	function parse_signal(msg){
		var data = msg;

		if (!msg) return 0;

		if (typeof msg === 'string') {
			try {
				data = JSON.parse(msg);
			} catch (e) {
				data = msg;
			}
		}

		return data;
	}

	function signal(msg){
		var data = parse_signal(msg);
		var cmd = '';
		var wait_ms = 220;

		if (!data) return a3m_qrcode;

		if (typeof data === 'string') {
			cmd = norm_signal(data);
			if (cmd !== 'open' && cmd !== 'close' && cmd !== 'flash' && cmd !== 'scan') return a3m_qrcode;

			log('signal', cmd);

			if (cmd === 'open') return open();
			if (cmd === 'close') return close();
			if (cmd === 'flash') return flash();
			if (cmd === 'scan') {
				log('scan');
				emit('scan');
				flash();
				if (a3m_qrcode_state.auto_close_scan) {
					clearTimeout(a3m_qrcode_close_timer);
					a3m_qrcode_close_timer = setTimeout(close, wait_ms);
				}
			}

			return a3m_qrcode;
		}

		if (typeof data !== 'object') return a3m_qrcode;

		cmd = norm_signal(data.type || data.cmd || data.action || data.name || '');
		if (cmd !== 'open' && cmd !== 'close' && cmd !== 'flash' && cmd !== 'scan') return a3m_qrcode;

		log('signal', cmd);

		if (cmd === 'open') return open(data);
		if (cmd === 'close') return close();
		if (cmd === 'flash') return flash(data.flash_ms);

		if (cmd === 'scan') {
			log('scan');
			emit('scan', data);
			flash(data.flash_ms);
			if ((typeof data.close === 'undefined' ? a3m_qrcode_state.auto_close_scan : (data.close ? 1 : 0))) {
				wait_ms = data.close_ms >= 0 ? (data.close_ms | 0) : 220;
				clearTimeout(a3m_qrcode_close_timer);
				a3m_qrcode_close_timer = setTimeout(close, wait_ms);
			}
		}

		return a3m_qrcode;
	}

	init_gf();

	a3m_qrcode = {
		available: available,
		current: current,
		on: on,
		off: off,
		open: open,
		close: close,
		toggle: toggle,
		flash: flash,
		signal: signal,
		get_svg: get_svg,
		get_svg_url: get_svg_url
	};

	w.a3m_qrcode = a3m_qrcode;

	log('ready', a3m_qrcode_ver, location.pathname);
})(window, document);