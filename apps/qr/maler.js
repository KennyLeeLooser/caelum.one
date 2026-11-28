// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
// KI-Beitrag (Claude, GB-7), 28.11.2026: Bewegung aus Caelum Bewegung (web/bewegung.js), hier nur QrZiel – freigegeben von Kenny Looser am 28.11.2026 (GB-8).
// KI-Beitrag (Claude, GB-7), 20.11.2026: Wechsel-Arten wie Wechsel.cs (Tafeln I–V, Blende, keiner) – freigegeben von Kenny Looser am 20.11.2026 (GB-8).
// Caelum QR · Web – zeichnet einen QR-Code nach Design: ruhend und beim Wechsel nach Wechsel-Art (Rorschach-Tafeln, Blende). Augen und
// Logo-Feld bleiben beim Wechsel stehen. JavaScript-Fassung von src/CaelumQr/Design.cs (Rgb, Ink, Noise) und Painter.cs
// (Static, Eyes, Plate, Pairs, Transition, SvgSurface) – die App ist Master. Der Gleichheitstest vergleicht das SVG
// Zeichen für Zeichen mit Painter.Svg/Painter.Transition. Dazu eine Canvas-Fläche für Vorschau, Animation und PNG.

// ───────────────────────────── Zahlen wie .NET
// rundeGerade, fbm und paare kommen aus der Bibliothek Caelum Bewegung (web/bewegung.js = CaelumBewegung/js/bewegung.js).
import { rundeGerade, fbm, paare, BEWEGUNGEN, bewegungArt } from "./bewegung.js";
export { rundeGerade, fbm, paare };
/** LogoArt.F: Math.Round(v, 2) und ToString(InvariantCulture). */
export function F(v) {
  const r = rundeGerade(v * 100) / 100;
  return Object.is(r, -0) ? "-0" : String(r);
}

// ───────────────────────────── Farben (Rgb, Ink)
export const MAX_LUM = 0.12;
export function hex(h) {
  h = String(h ?? "#000000").trim().replace(/^#+/, "");
  if (h.length === 3) h = [...h].map(c => c + c).join("");
  const v = parseInt(h.slice(0, 6), 16) || 0;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
const b8 = v => Math.min(255, Math.max(0, rundeGerade(v)));
export const zuHex = c => "#" + c.map(v => b8(v).toString(16).toUpperCase().padStart(2, "0")).join("");
const skal = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const mische = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const leuchtdichte = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export function kontrast(a, b) { const x = leuchtdichte(a) + 0.05, y = leuchtdichte(b) + 0.05; return Math.max(x, y) / Math.min(x, y); }

/** Ink.Safe: abdunkeln, bis die Leuchtdichte reicht; der Farbton bleibt. */
export function sicher(c, max = MAX_LUM) {
  let L = leuchtdichte(c);
  if (L <= max) return c;
  let k = 1;
  for (let i = 0; i < 14 && L > max; i++) { k *= Math.pow(max / L, 1 / 2.4) * 0.98; L = leuchtdichte(skal(c, k)); }
  return skal(c, k);
}

/** Ink.At: Farbe eines Moduls an (u, v) zur Zeit t; k = Helligkeit 0 … 1 (Fluss/Spektrum). */
export function tinte(d, u, v, t, k, n) {
  const cols = d.farbe?.farben?.length ? d.farbe.farben.map(hex) : [[20, 19, 18]];
  if (d.gravur) return cols[0];
  switch (d.farbe?.art) {
    case "spektrum": {
      const h = fbm(u * 0.05, v * 0.05, t * 0.05) * 520 + t * 6;
      return hsl(h, 0.85, 0.06 + 0.42 * k);
    }
    case "fluss": {
      const a = fbm(u * 0.06, v * 0.06, t * 0.05), b = fbm(u * 0.05 + 40, v * 0.05, t * 0.04);
      const w = [Math.pow(a, 4), Math.pow(1 - a, 4), Math.pow(b * 0.9, 4)];
      let r = 0, g = 0, bl = 0, s = 0;
      for (let i = 0; i < 3; i++) { const c = cols[i % cols.length]; r += c[0] * w[i]; g += c[1] * w[i]; bl += c[2] * w[i]; s += w[i]; }
      const m = 0.16 + 0.62 * k;
      return [r / s * m, g / s * m, bl / s * m];
    }
    case "verlauf": {
      const p = Math.min(1, Math.max(0, (u + v) / (2 * Math.max(1, n))));
      if (cols.length === 1) return cols[0];
      const seg = p * (cols.length - 1), i = Math.min(cols.length - 2, Math.trunc(seg));
      return mische(cols[i], cols[i + 1], seg - i);
    }
    default: return cols[0];
  }
}

export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

// ───────────────────────────── Painter
export const QUIET = 4;
const K_RUHE = 0.5;
export const modulPx = (q, size) => size / (q.size + 2 * QUIET);
export const papier = d => (d.gravur ? [255, 255, 255] : hex(d.papier));
export const stufeVon = d => {
  const s = String(d.stufe || "").toUpperCase();
  return ["L", "M", "Q", "H"].includes(s) ? s : (d.logo?.mitte !== false || d.logo?.muster) ? "H" : "M";
};
const modulFarbe = (d, x, y, t, n) => sicher(tinte(d, x * 1.5, y * 1.5, t, K_RUHE, n));
const ersteFarbe = d => hex(d.farbe?.farben?.[0] ?? "#000");

/** Painter.Static: ruhender Code. */
export function ruhend(g, q, d, size, t, logo) {
  const n = q.size, s = modulPx(q, size);
  g.clear(papier(d), size);
  const form = d.gravur ? "quadrat" : d.modul;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++)
      if (q.dark(x, y) && !q.isEye(x, y))
        g.cell((x + QUIET) * s, (y + QUIET) * s, s, form, modulFarbe(d, x, y, t, n), nachbarn(q, x, y));
  if (d.logo?.muster && logo.vektor && !d.gravur) musterLogo(g, q, d, s, logo);
  augen(g, q, d, s, t);
  if (d.logo?.mitte !== false) feld(g, q, d, s, t, logo, 1);
}

function nachbarn(q, x, y) {
  const D = (a, b) => a >= 0 && b >= 0 && a < q.size && b < q.size && q.dark(a, b) && !q.isEye(a, b);
  return (D(x, y - 1) ? 1 : 0) | (D(x + 1, y) ? 2 : 0) | (D(x, y + 1) ? 4 : 0) | (D(x - 1, y) ? 8 : 0);
}

function dunkleZellen(q, s) {
  const r = [];
  for (let y = 0; y < q.size; y++)
    for (let x = 0; x < q.size; x++)
      if (q.dark(x, y)) r.push([Math.fround((x + QUIET) * s), Math.fround((y + QUIET) * s), Math.fround(s), Math.fround(s)]);
  return r;
}

function musterLogo(g, q, d, s, logo) {
  const cells = dunkleZellen(q, s);
  const area = [Math.fround(QUIET * s), Math.fround(QUIET * s), Math.fround(q.size * s), Math.fround(q.size * s)];
  const c = sicher(hex(d.logo.farbe), 0.03);
  g.logo(logo, QUIET * s, QUIET * s, q.size * s, c, 1, "dunkel", cells, area);
  g.logo(logo, QUIET * s, QUIET * s, q.size * s, c, 0.16, "hell", cells, area);
}

/** Painter.Eyes: Augen nach Design; stehen auch beim Wechsel fest. */
export function augen(g, q, d, s, t) {
  const pap = papier(d), n = q.size;
  const ring = d.gravur ? ersteFarbe(d) : sicher(hex(d.augen?.ring), 0.06);
  const form = d.gravur ? "quadrat" : d.augen?.form;
  for (const [ex, ey] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
    const X = (ex + QUIET) * s, Y = (ey + QUIET) * s;
    const kern = d.gravur ? ring : d.augen?.kern === "farbe" ? modulFarbe(d, ex * 2 + 3, ey * 2 + 3, t, n) : sicher(hex(d.augen?.kern));
    g.roundRect(X - s, Y - s, 9 * s, 9 * s, 0, pap);
    switch (form) {
      case "punkt":
        g.roundRect(X, Y, 7 * s, 7 * s, 3.5 * s, ring);
        g.roundRect(X + s, Y + s, 5 * s, 5 * s, 2.5 * s, pap);
        g.ellipse(X + 2 * s, Y + 2 * s, 3 * s, 3 * s, kern);
        break;
      case "quadrat":
        g.roundRect(X, Y, 7 * s, 7 * s, 0, ring);
        g.roundRect(X + s, Y + s, 5 * s, 5 * s, 0, pap);
        g.roundRect(X + 2 * s, Y + 2 * s, 3 * s, 3 * s, 0, kern);
        break;
      default:
        g.roundRect(X, Y, 7 * s, 7 * s, 2.1 * s, ring);
        g.roundRect(X + s, Y + s, 5 * s, 5 * s, 1.3 * s, pap);
        g.roundRect(X + 2 * s, Y + 2 * s, 3 * s, 3 * s, 0.9 * s, kern);
        break;
    }
  }
}

/** Painter.Plate: Logo-Feld in der Mitte. */
export function feld(g, q, d, s, t, logo, alpha) {
  if (alpha < 0.35) return;
  const n = q.size, half = Math.min(4.6, n * 0.13), cx = (QUIET + n / 2) * s, r = half * s;
  g.roundRect(cx - r, cx - r, 2 * r, 2 * r, s * 1.4, papier(d));
  const L = r * 1.62;
  const c = d.gravur ? ersteFarbe(d) : sicher(hex(d.logo?.farbe), 0.08);
  g.logo(logo, cx - L / 2, cx - L / 2, L, c, 1, "keiner", null, null);
}

// ───────────────────────────── Wechsel (Painter.Transition, Bewegung aus Caelum Bewegung, Ziel wie QrZiel in Wechsel.cs)
/** Wechsel.Alle = Bewegungen.Alle – gleiche Ids, Namen und Texte wie die App. */
export const WECHSEL = BEWEGUNGEN;
/** Wechsel.Finde: Unbekanntes wird zu „rorschach“. */
export const wechselArt = bewegungArt;

/** QrZiel: färbt eine Zelle nach Design und zeichnet sie auf die Fläche (Raster + Ruhezone). */
function qrZiel(g, d, t, n, s, form) {
  const faerbe = f => {
    if (f.art === "fluss") { const raw = tinte(d, f.a, f.b, t * 2, 0.1 + 0.85 * f.sw, n); return f.sw < 0.3 || d.gravur ? sicher(raw) : raw; }
    const m = modulFarbe(d, f.x, f.y, t, f.groesse);
    if (f.art === "gedimmt") { const k = f.k, w = 238 * (1 - k) * 0.2; return [m[0] * k + w, m[1] * k + w, m[2] * k + w]; }
    return m;
  };
  return {
    zelle: (gx, gy, f) => g.cell((gx + QUIET) * s, (gy + QUIET) * s, s, form, faerbe(f), 0),
    falz: () => { const falz = mische(papier(d), [20, 19, 18], 0.10), X = (QUIET + n / 2) * s; g.roundRect(X - s * 0.08, QUIET * s, s * 0.16, n * s, 0, falz); },
  };
}

/** Painter.Transition: Übergang a → b bei p (0 … 1) nach der Wechsel-Art des Designs; Rahmen = Papier, Augen, Logo-Feld. */
export function wechsel(g, a, b, pairs, d, size, p, t, logo) {
  const w = wechselArt(d.wechsel);
  if (w.id === "keiner" || (w.nurGleich && a.size !== b.size)) { ruhend(g, p < 0.5 ? a : b, d, size, t, logo); return; }
  if (!w.nurGleich && (p <= 0 || p >= 1)) { ruhend(g, p <= 0 ? a : b, d, size, t, logo); return; }
  const vis = p < 0.5 ? a : b, s = modulPx(vis, size);
  g.clear(papier(d), size);
  const form = d.gravur ? "quadrat" : d.modul;
  w.zeichnen({ ziel: qrZiel(g, d, t, vis.size, s, form), a, b, paare: pairs, p, t, n: vis.size, rand: QUIET, sw: Math.sin(Math.PI * p) });
  augen(g, vis, d, s, t);
  if (d.logo?.mitte !== false) feld(g, vis, d, s, t, logo, w.feldAlpha(p));
}

/** Corners.Radii: rund nur an Ecken ohne Nachbarn (oben links, oben rechts, unten rechts, unten links). */
export function ecken(nb, r) {
  const N = (nb & 1) !== 0, E = (nb & 2) !== 0, S = (nb & 4) !== 0, W = (nb & 8) !== 0;
  return [!N && !W ? r : 0, !N && !E ? r : 0, !S && !E ? r : 0, !S && !W ? r : 0];
}

// ───────────────────────────── Logo
/** Logo aus logo.json (Konturen, evenodd) oder einem Bild (nur im Logo-Feld). */
export function logoVektor(daten) {
  const f = Math.fround;
  const ringe = daten.ringe.map(r => { const pts = []; for (let i = 0; i + 1 < r.length; i += 2) pts.push([f(r[i]), f(r[i + 1])]); return pts; }).filter(r => r.length >= 3);
  const view = daten.view.map(f);
  return { vektor: true, ringe, view, d: ringe.map(r => "M" + r.map(p => F(p[0]) + "," + F(p[1])).join(" ") + "Z").join("") };
}
export const logoBild = (bild, pngDataUrl) => ({ vektor: false, bild, png: pngDataUrl, w: bild.naturalWidth || bild.width, h: bild.naturalHeight || bild.height });

// ───────────────────────────── Flächen
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const fill = (c, a = 1) => `fill="${zuHex(c)}"` + (a < 0.999 ? ` fill-opacity="${F(a)}"` : "");

/** SvgSurface: reine Vektoren, Maße in mm (gleich wie die App). */
export class SvgFlaeche {
  constructor(size, mm) { this.size = size; this.mm = mm; this.body = ""; this.defs = ""; this.clipId = 0; }
  clear(pap, s) { this.body += `<rect width="${F(s)}" height="${F(s)}" ${fill(pap)}/>\n`; }
  cell(x, y, s, form, c, nb = 0) {
    switch (form) {
      case "punkt": this.body += `<circle cx="${F(x + s / 2)}" cy="${F(y + s / 2)}" r="${F(s * 0.42)}" ${fill(c)}/>`; break;
      case "rund": {
        const r = ecken(nb, s * 0.5), X = x, Y = y, W = s + 0.05, H = s + 0.05;
        this.body += `<path d="M${F(X + r[0])},${F(Y)}H${F(X + W - r[1])}` + (r[1] > 0 ? `A${F(r[1])},${F(r[1])} 0 0 1 ${F(X + W)},${F(Y + r[1])}` : "") +
          `V${F(Y + H - r[2])}` + (r[2] > 0 ? `A${F(r[2])},${F(r[2])} 0 0 1 ${F(X + W - r[2])},${F(Y + H)}` : "") +
          `H${F(X + r[3])}` + (r[3] > 0 ? `A${F(r[3])},${F(r[3])} 0 0 1 ${F(X)},${F(Y + H - r[3])}` : "") +
          `V${F(Y + r[0])}` + (r[0] > 0 ? `A${F(r[0])},${F(r[0])} 0 0 1 ${F(X + r[0])},${F(Y)}` : "") + `Z" ${fill(c)}/>`;
        break;
      }
      default: this.body += `<rect x="${F(x)}" y="${F(y)}" width="${F(s + 0.05)}" height="${F(s + 0.05)}" ${fill(c)}/>`;
    }
  }
  roundRect(x, y, w, h, r, c) {
    this.body += `\n<rect x="${F(x)}" y="${F(y)}" width="${F(w)}" height="${F(h)}"` + (r > 0.01 ? ` rx="${F(r)}"` : "") + ` ${fill(c)}/>`;
  }
  ellipse(x, y, w, h, c) { this.body += `\n<ellipse cx="${F(x + w / 2)}" cy="${F(y + h / 2)}" rx="${F(w / 2)}" ry="${F(h / 2)}" ${fill(c)}/>`; }
  logo(logo, x, y, sz, c, alpha, clip, cells, area) {
    let attr = "";
    if (clip !== "keiner") {
      const id = "z" + ++this.clipId;
      const rects = cells.map(r => `<rect x="${F(r[0])}" y="${F(r[1])}" width="${F(r[2])}" height="${F(r[3])}"/>`).join("");
      if (clip === "dunkel") { this.defs += `<clipPath id="${id}">${rects}</clipPath>\n`; attr = ` clip-path="url(#${id})"`; }
      else {
        this.defs += `<mask id="${id}"><rect x="${F(area[0])}" y="${F(area[1])}" width="${F(area[2])}" height="${F(area[3])}" fill="#fff"/><g fill="#000">${rects}</g></mask>\n`;
        attr = ` mask="url(#${id})"`;
      }
    }
    if (logo.vektor) {
      const k = sz / Math.max(logo.view[2], logo.view[3]);
      this.body += `\n<g${attr}><path fill-rule="evenodd" ${fill(c, alpha)} transform="translate(${F(x)} ${F(y)}) scale(${String(k)}) translate(${F(-logo.view[0])} ${F(-logo.view[1])})" d="${logo.d}"/></g>`;
    } else {
      const k = sz / Math.max(logo.w, logo.h), w = logo.w * k, h = logo.h * k;
      this.body += `\n<image x="${F(x + (sz - w) / 2)}" y="${F(y + (sz - h) / 2)}" width="${F(w)}" height="${F(h)}" opacity="${F(alpha)}" href="${logo.png}"/>`;
    }
  }
  text(d, q) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Copyright © 2026 Caelum GmbH. Erzeugt mit Caelum QR, Design „${esc(d.name)}“, Version ${q.version}, Stufe ${q.ecc}. -->\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F(this.size)} ${F(this.size)}" width="${F(this.mm)}mm" height="${F(this.mm)}mm" shape-rendering="geometricPrecision">\n` +
      (this.defs ? `<defs>\n${this.defs}</defs>\n` : "") + this.body + "\n</svg>\n";
  }
}

/** Painter.Svg: ruhender Code als SVG (10 Einheiten je Modul). */
export function svg(q, d, mm = 40, t = 12, logo) {
  const size = (q.size + 2 * QUIET) * 10;
  const sv = new SvgFlaeche(size, mm);
  ruhend(sv, q, d, size, t, logo);
  return sv.text(d, q);
}

/** Wie GdiSurface: Quadrate auf ganze Pixel, Rundes geglättet. */
export class CanvasFlaeche {
  constructor(ctx) { this.g = ctx; }
  farbe(c, a = 1) { return a >= 0.999 ? zuHex(c) : `rgba(${b8(c[0])},${b8(c[1])},${b8(c[2])},${a})`; }
  clear(pap, size) { const g = this.g; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.fillStyle = zuHex(pap); g.fillRect(0, 0, g.canvas.width, g.canvas.height); }
  cell(x, y, s, form, c, nb = 0) {
    const g = this.g; g.fillStyle = zuHex(c);
    switch (form) {
      case "punkt": { const k = s * 0.84; g.beginPath(); g.ellipse(x + s / 2, y + s / 2, k / 2, k / 2, 0, 0, 2 * Math.PI); g.fill(); break; }
      case "rund": { g.beginPath(); this.eckPfad(x - 0.25, y - 0.25, s + 0.5, s + 0.5, ecken(nb, s * 0.5)); g.fill(); break; }
      default: { const x0 = Math.floor(x), y0 = Math.floor(y); g.fillRect(x0, y0, Math.ceil(x + s) - x0, Math.ceil(y + s) - y0); }
    }
  }
  eckPfad(x, y, w, h, r) {
    const g = this.g;
    g.moveTo(x + r[0], y); g.lineTo(x + w - r[1], y);
    if (r[1] > 0) g.arcTo(x + w, y, x + w, y + r[1], r[1]);
    g.lineTo(x + w, y + h - r[2]);
    if (r[2] > 0) g.arcTo(x + w, y + h, x + w - r[2], y + h, r[2]);
    g.lineTo(x + r[3], y + h);
    if (r[3] > 0) g.arcTo(x, y + h, x, y + h - r[3], r[3]);
    g.lineTo(x, y + r[0]);
    if (r[0] > 0) g.arcTo(x, y, x + r[0], y, r[0]);
    g.closePath();
  }
  roundRect(x, y, w, h, r, c) {
    const g = this.g; g.fillStyle = zuHex(c);
    if (r <= 0.01) { g.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h)); return; }
    r = Math.min(r, Math.min(w, h) / 2);
    g.beginPath(); this.eckPfad(x, y, w, h, [r, r, r, r]); g.fill();
  }
  ellipse(x, y, w, h, c) { const g = this.g; g.fillStyle = zuHex(c); g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 2 * Math.PI); g.fill(); }
  logo(logo, x, y, size, c, alpha, clip, cells, area) {
    const g = this.g; g.save();
    if (clip !== "keiner") {
      g.beginPath();
      if (clip === "hell") g.rect(area[0], area[1], area[2], area[3]);
      for (const r of cells) g.rect(r[0], r[1], r[2], r[3]);
      g.clip(clip === "hell" ? "evenodd" : "nonzero");
    }
    g.globalAlpha = Math.min(1, Math.max(0, alpha));
    if (logo.vektor) {
      const k = size / Math.max(logo.view[2], logo.view[3]);
      g.translate(x, y); g.scale(k, k); g.translate(-logo.view[0], -logo.view[1]);
      g.beginPath();
      for (const r of logo.ringe) { g.moveTo(r[0][0], r[0][1]); for (let i = 1; i < r.length; i++) g.lineTo(r[i][0], r[i][1]); g.closePath(); }
      g.fillStyle = zuHex(c); g.fill("evenodd");
    } else {
      const k = size / Math.max(logo.w, logo.h), w = logo.w * k, h = logo.h * k;
      g.drawImage(logo.bild, Math.trunc(x + (size - w) / 2), Math.trunc(y + (size - h) / 2), Math.trunc(w), Math.trunc(h));
    }
    g.restore();
  }
}

/** Reader.WorstContrast: schwächster Kontrast eines dunklen Moduls gegen das Papier (ruhend). */
export function schwaechsterKontrast(q, d, t = 12) {
  const pap = papier(d); let worst = 99;
  for (let y = 0; y < q.size; y++)
    for (let x = 0; x < q.size; x++)
      if (q.dark(x, y) && !q.isEye(x, y)) worst = Math.min(worst, kontrast(pap, sicher(tinte(d, x * 1.5, y * 1.5, t, 0.5, q.size))));
  return worst;
}
