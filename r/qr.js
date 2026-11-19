// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – QR-Erzeuger (ISO 18004, Byte-Modus, Stufe H, Version 1–40). JavaScript-Fassung von QrCode.cs (Master);
// der Gleichheitstest im Selbsttest und web/test/gleich.mjs vergleichen Modul für Modul.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
const ECC_H = [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30];
const BLK_H = [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81];
const size = v => v * 4 + 17;
const raw = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = (v / 7 | 0) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; };
const dataCw = v => (raw(v) >> 3) - ECC_H[v] * BLK_H[v];
const countBits = v => v <= 9 ? 8 : 16;
const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 255; };
function divisor(d) { const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1;
  for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) { r[j] = mul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; }
function rem(data, div) { const r = new Array(div.length).fill(0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); for (let i = 0; i < r.length; i++) r[i] ^= mul(div[i], f); } return r; }
function align(v) { if (v === 1) return []; const n = (v / 7 | 0) + 2, step = ((v * 8 + n * 3 + 5) / (n * 4 - 4) | 0) * 2, r = [6];
  for (let i = n - 1, pos = size(v) - 7; i >= 1; i--, pos -= step) r[i] = pos; return r; }
function fmt(mask) { const d = (2 << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537); return ((d << 10) | r) ^ 0x5412; }

export const MAX_VERSION = 40;
export function versionFor(bytes) { for (let v = 1; v <= MAX_VERSION; v++) if (4 + countBits(v) + bytes * 8 <= dataCw(v) * 8) return v; return 0; }

/** Text → {m (m[y][x] = dunkel), n, v, mask} oder null, wenn zu lang. */
export function encode(text) {
  const data = typeof text === "string" ? [...new TextEncoder().encode(text)] : [...text];
  const v = versionFor(data.length); if (!v) return null;
  const cap = dataCw(v) * 8, cb = countBits(v), bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(data.length, cb); data.forEach(b => put(b, 8)); put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
  for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
  const cw = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
  const nb = BLK_H[v], ecc = ECC_H[v], rw = raw(v) >> 3, ns = nb - rw % nb, sl = (rw / nb) | 0, dv = divisor(ecc), blocks = [];
  for (let i = 0, pos = 0; i < nb; i++) { const len = sl - ecc + (i < ns ? 0 : 1), d = cw.slice(pos, pos + len); pos += len;
    const blk = d.slice(); if (i < ns) blk.push(0); blocks.push(blk.concat(rem(d, dv))); }
  const all = []; for (let i = 0; i < sl + 1; i++) for (let j = 0; j < nb; j++) if (i !== sl - ecc || j >= ns) all.push(blocks[j][i]);
  const n = size(v), m = [...Array(n)].map(() => new Array(n).fill(false)), fn = [...Array(n)].map(() => new Array(n).fill(false));
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= n || y >= n) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4); }
  const al = align(v); for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }
  const drawFmt = (mm, mask) => { const b = fmt(mask), B = i => ((b >>> i) & 1) === 1, s = (x, y, d) => { mm[y][x] = d; fn[y][x] = true; };
    for (let i = 0; i <= 5; i++) s(8, i, B(i)); s(8, 7, B(6)); s(8, 8, B(7)); s(7, 8, B(8));
    for (let i = 9; i < 15; i++) s(14 - i, 8, B(i)); for (let i = 0; i < 8; i++) s(n - 1 - i, 8, B(i)); for (let i = 8; i < 15; i++) s(8, n - 15 + i, B(i)); s(8, n - 8, true); };
  drawFmt(m, 0);
  if (v >= 7) { let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25); const vb = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const d = ((vb >>> i) & 1) === 1, a = n - 11 + i % 3, b = (i / 3) | 0; set(a, b, d); set(b, a, d); } }
  let k = 0; for (let right = n - 1; right >= 1; right -= 2) { if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) { const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert;
      if (fn[y][x] || k >= all.length * 8) continue; m[y][x] = ((all[k >>> 3] >>> (7 - (k & 7))) & 1) === 1; k++; } }
  const masks = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (((x / 3) | 0) + ((y / 2) | 0)) % 2 === 0,
    (x, y) => x * y % 2 + x * y % 3 === 0, (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];
  let best = null, bs = Infinity, bm = 0;
  for (let mk = 0; mk < 8; mk++) { const t = m.map(r => r.slice());
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!fn[y][x] && masks[mk](x, y)) t[y][x] = !t[y][x];
    drawFmt(t, mk); const sc = penalty(t, n); if (sc < bs) { bs = sc; best = t; bm = mk; } }
  return { m: best, n, v, mask: bm };
}
function penalty(m, n) { let s = 0;
  for (let p = 0; p < 2; p++) for (let a = 0; a < n; a++) { let run = 1;
    for (let b = 1; b < n; b++) { const c = p ? m[b][a] : m[a][b], q = p ? m[b - 1][a] : m[a][b - 1]; if (c === q) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; }
    for (let b = 0; b + 11 <= n; b++) { const A = i => p ? m[b + i][a] : m[a][b + i];
      if (A(4) && !A(5) && A(6) && A(7) && A(8) && !A(9) && A(10) && !A(0) && !A(1) && !A(2) && !A(3)) s += 40;
      if (A(0) && !A(1) && A(2) && A(3) && A(4) && !A(5) && A(6) && !A(7) && !A(8) && !A(9) && !A(10)) s += 40; } }
  for (let y = 0; y + 1 < n; y++) for (let x = 0; x + 1 < n; x++) { const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) s += 3; }
  let d = 0; for (const r of m) for (const c of r) if (c) d++; const t = n * n; return s + Math.max(0, Math.ceil(Math.abs(d * 20 - t * 10) / t) - 1) * 10; }

export const rows = q => q.m.map(r => r.map(c => c ? "1" : "0").join(""));
