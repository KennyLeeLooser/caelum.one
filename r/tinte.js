// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – Tinte: Rauschen (Wertrauschen + fbm), Farben „Caelum“ (Orange, Violett, Blau) und „Spektrum“,
// Kontrast-Sicherung (dunkle Module höchstens Leuchtdichte 0,12 → ≥ 5 : 1 gegen das Papier; nur die Helligkeit sinkt,
// der Farbton bleibt) und das Linien-Logo (aus CAELUM\Branding verlinkt, Datei logo-linie.svg neben der Seite).
// Übernommen aus dem abgenommenen Entwurf CaelumLink\entwurf\qr-fluss.html (Kenny 19.11.2026: „besonders dieses Design“).
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
const P = new Uint8Array(512);
{ const p = [...Array(256).keys()]; let s = 1337; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const sm = t => t * t * (3 - 2 * t);
export function n2(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
  const a = P[P[X] + Y] / 255, b = P[P[X + 1] + Y] / 255, c = P[P[X] + Y + 1] / 255, d = P[P[X + 1] + Y + 1] / 255, u = sm(xf), v = sm(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, t) { return 0.55 * n2(x + t * 0.31, y - t * 0.17) + 0.3 * n2(x * 2.1 - t * 0.23, y * 2.1 + t * 0.29) + 0.15 * n2(x * 4.3 + t * 0.4, y * 4.3); }

export const INKS = [[217, 119, 87], [165, 133, 214], [110, 155, 216]];
export const PAPER = [238, 235, 229];
export const DEEP = [31, 30, 29];
export function hsl(h, s, l) { h = ((h % 360) + 360) % 360 / 360; const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
/** Farbe an (u, v) zur Zeit t; k = Helligkeit (0 = fast schwarz … 1 = volle Farbe). */
export function ink(pal, u, v, t, k) {
  if (pal === "spektrum") return hsl(fbm(u * 0.05, v * 0.05, t * 0.05) * 520 + t * 6, 0.85, 0.06 + 0.42 * k);
  const a = fbm(u * 0.06, v * 0.06, t * 0.05), b = fbm(u * 0.05 + 40, v * 0.05, t * 0.04);
  const w = [a, 1 - a, b * 0.8], s = w[0] + w[1] + w[2], m = 0.16 + 0.62 * k;
  return [0, 1, 2].map(i => (INKS[0][i] * w[0] + INKS[1][i] * w[1] + INKS[2][i] * w[2]) / s * m);
}
export const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
export const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
export const MAXLUM = 0.12;
export function safe(c) { let L = lum(c); if (L <= MAXLUM) return c; let k = 1;
  for (let i = 0; i < 12 && L > MAXLUM; i++) { k *= Math.pow(MAXLUM / L, 1 / 2.4) * 0.98; L = lum(c.map(v => v * k)); } return c.map(v => v * k); }
export const contrast = c => (lum(PAPER) + 0.05) / (lum(c) + 0.05);

// ---------------------------------------------------------------- Logo (Linien, Felder freigestellt), Geometrie aus der SVG
export const logo = { path: null, d: null, view: [44, 44, 936, 936] };
export async function ladeLogo(url = "logo-linie.svg") {
  try {
    const t = await (await fetch(url)).text();
    const d = /<path[^>]*\sd="([^"]+)"/.exec(t)?.[1], vb = /viewBox="([^"]+)"/.exec(t)?.[1];
    if (d) { logo.d = d; logo.path = new Path2D(d); }
    if (vb) logo.view = vb.trim().split(/[\s,]+/).map(Number);
  } catch { /* ohne Logo weiter: Code bleibt lesbar */ }
  return logo;
}
