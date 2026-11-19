// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
// Caelum QR · Web – QR-Erzeuger nach ISO/IEC 18004: Byte-Modus (UTF-8), L/M/Q/H, Version 1–40, beste Maske.
// JavaScript-Fassung von src/CaelumQr/QrEncoder.cs (Master). Der Gleichheitstest (web/test/gleich.mjs) prüft jede Zeile
// der Matrix gegen die App. Weicht etwas ab, hat die App recht.

export const STUFEN = ["L", "M", "Q", "H"];

const EPB = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const BLK = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];
const FORMAT = [1, 0, 3, 2];

function rawModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const dataCodewords = (v, e) => Math.floor(rawModules(v) / 8) - EPB[e][v] * BLK[e][v];

/** Bytes des Texts (UTF-8). */
export const bytesVon = text => new TextEncoder().encode(text ?? "");

/**
 * Kleinste passende Version (≥ minVersion); null, wenn der Text nicht in Version 40 passt.
 * Ergebnis: { size, version, ecc ("L"…"H"), mask, text, dark(x, y), fn(x, y), isEye(x, y) }
 */
export function encode(text, stufe = "H", minVersion = 1) {
  const e = Math.max(0, STUFEN.indexOf(String(stufe).toUpperCase()));
  const data = bytesVon(text);
  let v = Math.min(40, Math.max(1, minVersion | 0));
  for (; v <= 40; v++) { const cb = v <= 9 ? 8 : 16; if (4 + cb + data.length * 8 <= dataCodewords(v, e) * 8) break; }
  if (v > 40) return null;

  // Bitstrom: Modus 0100, Länge, Daten, Abschluss, Auffüllen
  const cap = dataCodewords(v, e) * 8, bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  put(4, 4); put(data.length, v <= 9 ? 8 : 16);
  for (const b of data) put(b, 8);
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - bits.length % 8) % 8);
  for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
  const cw = new Uint8Array(bits.length / 8);
  for (let i = 0; i < cw.length; i++) { let x = 0; for (let j = 0; j < 8; j++) x = (x << 1) | bits[i * 8 + j]; cw[i] = x; }

  // Blöcke mit Reed-Solomon, verschränkt
  const nb = BLK[e][v], ec = EPB[e][v], raw = Math.floor(rawModules(v) / 8), shortBlocks = nb - raw % nb, shortLen = Math.floor(raw / nb);
  const div = divisor(ec), blocks = [];
  for (let i = 0, pos = 0; i < nb; i++) {
    const len = shortLen - ec + (i < shortBlocks ? 0 : 1);
    const d = cw.slice(pos, pos + len); pos += len;
    const blk = [...d];
    if (i < shortBlocks) blk.push(0);
    blk.push(...remainder(d, div));
    blocks.push(blk);
  }
  const all = [];
  for (let i = 0; i < shortLen + 1; i++)
    for (let j = 0; j < nb; j++)
      if (i !== shortLen - ec || j >= shortBlocks) all.push(blocks[j][i]);

  // Raster mit festen Mustern
  const n = v * 4 + 17;
  const m = new Uint8Array(n * n), fn = new Uint8Array(n * n);
  const set = (x, y, d) => { m[y * n + x] = d ? 1 : 0; fn[y * n + x] = 1; };
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]])
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= n || y >= n) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, dist !== 2 && dist !== 4);
      }
  const al = alignment(v);
  for (let i = 0; i < al.length; i++)
    for (let j = 0; j < al.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  drawFormat(m, fn, n, e, 0);
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >> 11) * 0x1F25);
    const vb = (v << 12) | r;
    for (let i = 0; i < 18; i++) { const d = ((vb >> i) & 1) === 1, a = n - 11 + i % 3, b = Math.floor(i / 3); set(a, b, d); set(b, a, d); }
  }

  // Daten im Zickzack
  let k = 0;
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < n; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert;
        if (fn[y * n + x] || k >= all.length * 8) continue;
        m[y * n + x] = (all[k >> 3] >> (7 - (k & 7))) & 1; k++;
      }
  }

  // beste Maske
  let best = null, bestScore = Infinity, bestMask = 0;
  for (let mk = 0; mk < 8; mk++) {
    const t = m.slice();
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++)
        if (!fn[y * n + x] && maskHit(mk, x, y)) t[y * n + x] ^= 1;
    drawFormat(t, fn, n, e, mk);
    const sc = penalty(t, n);
    if (sc < bestScore) { bestScore = sc; best = t; bestMask = mk; }
  }
  return matrix(n, v, STUFEN[e], bestMask, best, fn, text ?? "");
}

function matrix(size, version, ecc, mask, dunkel, fest, text) {
  return {
    size, version, ecc, mask, text,
    dark: (x, y) => dunkel[y * size + x] === 1,
    fn: (x, y) => fest[y * size + x] === 1,
    isEye: (x, y) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7),
  };
}

function maskHit(mk, x, y) {
  switch (mk) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return x * y % 2 + x * y % 3 === 0;
    case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
    default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
  }
}

function drawFormat(m, fn, n, e, mask) {
  const d = (FORMAT[e] << 3) | mask; let r = d;
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >> 9) * 0x537);
  const b = ((d << 10) | r) ^ 0x5412;
  const B = i => (b >> i) & 1;
  const S = (x, y, v) => { m[y * n + x] = v; fn[y * n + x] = 1; };
  for (let i = 0; i <= 5; i++) S(8, i, B(i));
  S(8, 7, B(6)); S(8, 8, B(7)); S(7, 8, B(8));
  for (let i = 9; i < 15; i++) S(14 - i, 8, B(i));
  for (let i = 0; i < 8; i++) S(n - 1 - i, 8, B(i));
  for (let i = 8; i < 15; i++) S(8, n - 15 + i, B(i));
  S(8, n - 8, 1);
}

function alignment(v) {
  if (v === 1) return [];
  const num = Math.floor(v / 7) + 2, step = Math.floor((v * 4 + num * 2 + 1) / (num * 2 - 2)) * 2;
  const r = new Array(num); r[0] = 6;
  for (let i = num - 1, pos = v * 4 + 17 - 7; i >= 1; i--, pos -= step) r[i] = pos;
  return r;
}

function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >> 7) * 0x11D); z ^= ((y >> i) & 1) * x; }
  return z & 255;
}
function divisor(d) {
  const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1;
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) { r[j] = mul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; }
    root = mul(root, 2);
  }
  return r;
}
function remainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r[0];
    r.copyWithin(0, 1); r[r.length - 1] = 0;
    for (let i = 0; i < r.length; i++) r[i] ^= mul(div[i], f);
  }
  return r;
}

function penalty(m, n) {
  let s = 0;
  for (let p = 0; p < 2; p++)
    for (let a = 0; a < n; a++) {
      const At = b => (p === 1 ? m[b * n + a] : m[a * n + b]);
      let run = 1;
      for (let b = 1; b < n; b++) {
        if (At(b) === At(b - 1)) { run++; if (run === 5) s += 3; else if (run > 5) s++; }
        else run = 1;
      }
      for (let b = 0; b + 11 <= n; b++) {
        const A = i => At(b + i);
        if (A(4) && !A(5) && A(6) && A(7) && A(8) && !A(9) && A(10) && !A(0) && !A(1) && !A(2) && !A(3)) s += 40;
        if (A(0) && !A(1) && A(2) && A(3) && A(4) && !A(5) && A(6) && !A(7) && !A(8) && !A(9) && !A(10)) s += 40;
      }
    }
  for (let y = 0; y + 1 < n; y++)
    for (let x = 0; x + 1 < n; x++) {
      const c = m[y * n + x];
      if (c === m[y * n + x + 1] && c === m[(y + 1) * n + x] && c === m[(y + 1) * n + x + 1]) s += 3;
    }
  let dark = 0;
  for (let i = 0; i < m.length; i++) dark += m[i];
  const total = n * n;
  return s + Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
}
