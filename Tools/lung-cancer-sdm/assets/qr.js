/* 小型 QR code 產生器（byte 模式、錯誤更正 M、版本 1–20）。
   不依賴外部套件；演算法依 QR Code Model 2 規格。測試見 ../../tests/qr.test.cjs。 */
(function (root) {
  'use strict';
  var ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26];
  var BLK = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16];
  var MAXV = 20;

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLK[v]; }
  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(s)); }

  function gfMul(x, y) {
    var z = 0;
    for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z & 0xFF;
  }
  function rsDivisor(d) {
    var r = [], i, j;
    for (i = 0; i < d - 1; i++) r.push(0);
    r.push(1);
    var root = 1;
    for (i = 0; i < d; i++) {
      for (j = 0; j < d; j++) { r[j] = gfMul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; }
      root = gfMul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) {
      var f = b ^ r.shift();
      r.push(0);
      div.forEach(function (c, i) { r[i] ^= gfMul(c, f); });
    });
    return r;
  }

  function encodeData(bytes, v) {
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    put(4, 4);
    put(bytes.length, v < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    var cap = dataCodewords(v) * 8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var out = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      out.push(b);
    }
    return out;
  }

  function addEcc(data, v) {
    var nb = BLK[v], el = ECC[v], raw = Math.floor(rawModules(v) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    var div = rsDivisor(el), blocks = [], k = 0, i;
    for (i = 0; i < nb; i++) {
      var dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var res = [];
    for (i = 0; i < blocks[0].length; i++) {
      blocks.forEach(function (b, j) { if (i !== shortLen - el || j >= nShort) res.push(b[i]); });
    }
    return res;
  }

  function alignPositions(v) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
    var step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    var r = [6];
    for (var pos = size - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
    return r;
  }

  var MASKS = [
    function (x, y) { return (x + y) % 2 === 0; },
    function (x, y) { return y % 2 === 0; },
    function (x, y) { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; },
    function (x, y) { return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; },
    function (x, y) { return x * y % 2 + x * y % 3 === 0; },
    function (x, y) { return (x * y % 2 + x * y % 3) % 2 === 0; },
    function (x, y) { return ((x + y) % 2 + x * y % 3) % 2 === 0; }
  ];

  function bit(v, i) { return ((v >>> i) & 1) !== 0; }

  function build(v, codewords, mask) {
    var size = v * 4 + 17, m = [], fn = [], y, x, i, j;
    for (y = 0; y < size; y++) { m.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(px, py, dark) { m[py][px] = dark; fn[py][px] = true; }

    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    function finder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4);
      }
    }
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    var ap = alignPositions(v), n = ap.length;
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    function formatBits(mk) {
      var data = (0 << 3) | mk, rem = data;
      for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      return ((data << 10) | rem) ^ 0x5412;
    }
    function drawFormat(mk) {
      var b = formatBits(mk);
      for (var k = 0; k <= 5; k++) setF(8, k, bit(b, k));
      setF(8, 7, bit(b, 6)); setF(8, 8, bit(b, 7)); setF(7, 8, bit(b, 8));
      for (k = 9; k < 15; k++) setF(14 - k, 8, bit(b, k));
      for (k = 0; k < 8; k++) setF(size - 1 - k, 8, bit(b, k));
      for (k = 8; k < 15; k++) setF(8, size - 15 + k, bit(b, k));
      setF(8, size - 8, true);
    }
    drawFormat(0);
    if (v >= 7) {
      var rem = v;
      for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (v << 12) | rem;
      for (i = 0; i < 18; i++) {
        var a = size - 11 + i % 3, b2 = Math.floor(i / 3);
        setF(a, b2, bit(vb, i)); setF(b2, a, bit(vb, i));
      }
    }
    var idx = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        x = right - j;
        var up = ((right + 1) & 2) === 0;
        y = up ? size - 1 - vert : vert;
        if (!fn[y][x] && idx < codewords.length * 8) { m[y][x] = bit(codewords[idx >>> 3], 7 - (idx & 7)); idx++; }
      }
    }
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) m[y][x] = !m[y][x];
    drawFormat(mask);
    return m;
  }

  function penalty(m) {
    var size = m.length, p = 0, x, y, k, run, line;
    function rows(get) {
      for (var a = 0; a < size; a++) {
        line = []; for (var b = 0; b < size; b++) line.push(get(a, b));
        run = 1;
        for (k = 1; k <= size; k++) {
          if (k < size && line[k] === line[k - 1]) run++;
          else { if (run >= 5) p += 3 + (run - 5); run = 1; }
        }
        for (k = 0; k + 10 < size + 1; k++) {
          var s = line.slice(k, k + 11).map(Number).join('');
          if (s === '10111010000' || s === '00001011101') p += 40;
        }
      }
    }
    rows(function (a, b) { return m[a][b]; });
    rows(function (a, b) { return m[b][a]; });
    for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) {
      var c = m[y][x];
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3;
    }
    var dark = 0;
    m.forEach(function (r) { r.forEach(function (c) { if (c) dark++; }); });
    var total = size * size;
    p += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  }

  /* 回傳 {size, version, mask, get(row, col)}。forceMask 只給測試使用。 */
  function makeQr(text, forceMask) {
    var bytes = utf8(text), v;
    for (v = 1; v <= MAXV; v++) if (bytes.length + (v < 10 ? 2 : 3) <= dataCodewords(v)) break;
    if (v > MAXV) throw new Error('網址過長，QR code 放不下，請縮短網址。');
    var cw = addEcc(encodeData(bytes, v), v), best = null, bestMask = 0, bestP = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      if (forceMask !== undefined && mk !== forceMask) continue;
      var mat = build(v, cw, mk), p = penalty(mat);
      if (p < bestP) { bestP = p; best = mat; bestMask = mk; }
    }
    return { size: best.length, version: v, mask: bestMask, get: function (r, c) { return best[r][c]; } };
  }

  /* 畫到 canvas；border 為留白格數（規格要求至少 4）。 */
  function paintQr(canvas, text, px) {
    var qr = makeQr(text), b = 4, scale = px || 8;
    canvas.width = canvas.height = (qr.size + b * 2) * scale;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < qr.size; r++) for (var c = 0; c < qr.size; c++)
      if (qr.get(r, c)) ctx.fillRect((c + b) * scale, (r + b) * scale, scale, scale);
    return qr;
  }

  var api = { makeQr: makeQr, paintQr: paintQr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SdmQr = api;
})(typeof window !== 'undefined' ? window : this);
