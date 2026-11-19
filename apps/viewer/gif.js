// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// GIF89a-Encoder, Web-Fassung von src/Caelum.Viewer.Core/GifEncoder.cs (Master): gemeinsame Palette (Median-Cut),
// Endlosschleife, optional Transparenz. Der Gleichheitstest verlangt dieselben Bytes wie die App.
// Bilder: { breite, hoehe, pixel: Uint32Array } mit Pixel = A<<24 | R<<16 | G<<8 | B, Farbe vormultipliziert (wie Frame in C#).

/** C# Math.Round: bei .5 zur geraden Zahl. */
function rundeGerade(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1; if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function bin(p) {
  const a = p >>> 24;
  if (a === 0) return 0;
  let r = p >>> 16 & 255, g = p >>> 8 & 255, b = p & 255;
  if (a < 255) { r = Math.min(255, Math.floor(r * 255 / a)); g = Math.min(255, Math.floor(g * 255 / a)); b = Math.min(255, Math.floor(b * 255 / a)); }
  return (r >> 3) << 10 | (g >> 3) << 5 | (b >> 3);
}
const kanal = (b, ch) => ch === 0 ? b >> 10 & 31 : ch === 1 ? b >> 5 & 31 : b & 31;

function medianCut(hist, maxColors) {
  const bins = []; for (let i = 0; i < hist.length; i++) if (hist[i] > 0) bins.push(i);
  const result = [];
  if (bins.length === 0) { result.push([0, 0, 0]); return result; }
  const boxes = [bins];
  while (boxes.length < maxColors) {
    let bestBox = -1, bestCh = 0, bestScore = 0;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length < 2) continue;
      let weight = 0; for (const b of box) weight += hist[b];
      for (let ch = 0; ch < 3; ch++) {
        let min = 31, max = 0;
        for (const b of box) { const v = kanal(b, ch); if (v < min) min = v; if (v > max) max = v; }
        const score = (max - min) * Math.sqrt(weight);
        if (score > bestScore) { bestScore = score; bestBox = i; bestCh = ch; }
      }
    }
    if (bestBox < 0) break;
    const sel = boxes[bestBox].slice().sort((x, y) => kanal(x, bestCh) - kanal(y, bestCh)); // stabil wie OrderBy
    let total = 0; for (const b of sel) total += hist[b];
    let acc = 0, cut = 1;
    for (let i = 0; i < sel.length - 1; i++) { acc += hist[sel[i]]; if (acc >= Math.floor(total / 2)) { cut = i + 1; break; } cut = i + 1; }
    boxes[bestBox] = sel.slice(0, cut);
    boxes.push(sel.slice(cut));
  }
  for (const box of boxes) {
    let r = 0, g = 0, b = 0, n = 0;
    for (const x of box) { const w = hist[x]; r += kanal(x, 0) * w; g += kanal(x, 1) * w; b += kanal(x, 2) * w; n += w; }
    result.push([rundeGerade(r / n * 255 / 31), rundeGerade(g / n * 255 / 31), rundeGerade(b / n * 255 / 31)]);
  }
  return result;
}

class Puffer {
  constructor() { this.a = new Uint8Array(1 << 16); this.n = 0; }
  byte(b) { if (this.n === this.a.length) { const z = new Uint8Array(this.a.length * 2); z.set(this.a); this.a = z; } this.a[this.n++] = b & 255; }
  bytes(arr) { for (const b of arr) this.byte(b); }
  u16(v) { this.byte(v & 255); this.byte(v >> 8 & 255); }
  fertig() { return this.a.slice(0, this.n); }
}

function lzw(s, data) {
  const minCode = 8, clear = 256, eoi = 257;
  s.byte(minCode);
  const block = new Uint8Array(255); let blockLen = 0, bitBuf = 0, bitCount = 0, size = 9, maxcode = 511, next = 258, clearFlag = false;
  const dict = new Map();
  const flush = () => { if (blockLen > 0) { s.byte(blockLen); for (let i = 0; i < blockLen; i++) s.byte(block[i]); blockLen = 0; } };
  const byte = b => { block[blockLen++] = b; if (blockLen === 255) flush(); };
  const output = code => {
    bitBuf |= code << bitCount; bitCount += size;
    while (bitCount >= 8) { byte(bitBuf & 0xFF); bitBuf >>>= 8; bitCount -= 8; }
    if (clearFlag) { size = 9; maxcode = 511; clearFlag = false; }
    else if (next > maxcode) { size++; maxcode = size === 12 ? 4096 : (1 << size) - 1; }
  };
  output(clear);
  let prefix = data[0];
  for (let i = 1; i < data.length; i++) {
    const k = data[i], key = prefix << 8 | k, code = dict.get(key);
    if (code !== undefined) { prefix = code; continue; }
    output(prefix);
    if (next < 4096) dict.set(key, next++);
    else { dict.clear(); next = 258; clearFlag = true; output(clear); }
    prefix = k;
  }
  output(prefix);
  output(eoi);
  if (bitCount > 0) byte(bitBuf & 0xFF);
  flush();
  s.byte(0);
}

/** GIF schreiben wie GifEncoder.Write(stream, frames, delayMs). Ergebnis: Uint8Array. */
export function gifSchreiben(bilder, delayMs) {
  if (!bilder.length) throw new Error("Keine Bilder für das GIF.");
  const w = bilder[0].breite, h = bilder[0].hoehe;
  let transparent = false;
  for (const f of bilder) { for (const p of f.pixel) if ((p >>> 24) < 128) { transparent = true; break; } if (transparent) break; }
  const maxColors = transparent ? 255 : 256;
  const hist = new Float64Array(32768);
  for (const f of bilder) for (const p of f.pixel) if ((p >>> 24) >= 128) hist[bin(p)]++;
  const palette = medianCut(hist, maxColors);
  while (palette.length < 256) palette.push([0, 0, 0]);
  const transIndex = transparent ? 255 : -1;
  const map = new Uint8Array(32768);
  for (let b = 0; b < 32768; b++) {
    if (hist[b] === 0) continue;
    const r = Math.floor((b >> 10 & 31) * 255 / 31), g = Math.floor((b >> 5 & 31) * 255 / 31), bl = Math.floor((b & 31) * 255 / 31);
    let best = 0, bestD = Infinity;
    for (let i = 0; i < maxColors; i++) {
      const c = palette[i], d = (c[0] - r) * (c[0] - r) * 3 + (c[1] - g) * (c[1] - g) * 4 + (c[2] - bl) * (c[2] - bl) * 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    map[b] = best;
  }
  const s = new Puffer();
  s.bytes([71, 73, 70, 56, 57, 97]); s.u16(w); s.u16(h); s.bytes([0xF7, 0, 0]);
  for (const c of palette) s.bytes(c);
  s.bytes([0x21, 0xFF, 0x0B]); s.bytes([...("NETSCAPE2.0")].map(c => c.charCodeAt(0))); s.bytes([3, 1, 0, 0, 0]);
  const idx = new Uint8Array(w * h), delay = Math.max(2, Math.floor(delayMs / 10));
  for (const f of bilder) {
    for (let i = 0; i < idx.length; i++) { const p = f.pixel[i]; idx[i] = (p >>> 24) < 128 && transparent ? transIndex : map[bin(p)]; }
    s.bytes([0x21, 0xF9, 4, transparent ? (2 << 2) | 1 : (1 << 2)]); s.u16(delay); s.byte(transparent ? transIndex : 0); s.byte(0);
    s.byte(0x2C); s.u16(0); s.u16(0); s.u16(w); s.u16(h); s.byte(0);
    lzw(s, idx);
  }
  s.byte(0x3B);
  return s.fertig();
}

/** RGBA-Bild (Canvas, nicht vormultipliziert) → Pixel wie Frame in C# (vormultipliziert). */
export function ausRgba(rgba, breite, hoehe) {
  const px = new Uint32Array(breite * hoehe);
  for (let i = 0; i < px.length; i++) {
    const a = rgba[i * 4 + 3], k = a / 255;
    px[i] = a === 0 ? 0 : ((a << 24) | (Math.round(rgba[i * 4] * k) << 16) | (Math.round(rgba[i * 4 + 1] * k) << 8) | Math.round(rgba[i * 4 + 2] * k)) >>> 0;
  }
  return { breite, hoehe, pixel: px };
}
