// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Bewegung (Standard caelum-bewegung/1, STANDARD.md) – JavaScript-Fassung von src/Caelum.Bewegung/Bewegung.cs.
// Eine Bewegungsart rechnet nur, welche Zelle wann wohin kommt und welche Farbart sie bekommt; färben und zeichnen macht der
// Kunde über das Ziel { zelle(gx, gy, farbe), falz() }. Zahlen wie .NET (rundeGerade, System.Random nachgebaut).
// Die C#-Fassung ist Master. Kunden kopieren diese Datei unverändert (Caelum QR: web/bewegung.js über den Web-Export).
// KI-Beitrag (Claude, GB-7), 28.11.2026 – Umzug aus Caelum QR web/maler.js, Entscheid Kenny 28.11.2026, freigegeben von Kenny Looser am 28.11.2026 (GB-8).

/** Math.Round von .NET: Mitte zur geraden Zahl. */
export function rundeGerade(v) {
  const f = Math.floor(v), r = v - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

// ───────────────────────────── Rauschen (Rauschen.Fbm)
const P = (() => {
  const p = Array.from({ length: 256 }, (_, i) => i); let s = 1337;
  for (let i = 255; i > 0; i--) { s = s * 16807 % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  const r = new Uint8Array(512); for (let i = 0; i < 512; i++) r[i] = p[i & 255]; return r;
})();
const glatt = t => t * t * (3 - 2 * t);
function n2(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), X = xi & 255, Y = yi & 255, xf = x - xi, yf = y - yi;
  const a = P[P[X] + Y] / 255, b = P[P[X + 1] + Y] / 255, c = P[P[X] + Y + 1] / 255, d = P[P[X + 1] + Y + 1] / 255, u = glatt(xf), v = glatt(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, y, t) =>
  0.55 * n2(x + t * 0.31, y - t * 0.17) + 0.3 * n2(x * 2.1 - t * 0.23, y * 2.1 + t * 0.29) + 0.15 * n2(x * 4.3 + t * 0.4, y * 4.3);

// ───────────────────────────── System.Random (.NET, mit Seed) für Bewegungen.Paare
function netRandom(seed) {
  const MBIG = 2147483647, a = new Int32Array(56);
  let mj = 161803398 - (seed === -2147483648 ? MBIG : Math.abs(seed)), mk = 1;
  a[55] = mj;
  for (let i = 1; i < 55; i++) { const ii = (21 * i) % 55; a[ii] = mk; mk = mj - mk; if (mk < 0) mk += MBIG; mj = a[ii]; }
  for (let k = 1; k < 5; k++) for (let i = 1; i < 56; i++) { a[i] -= a[1 + (i + 30) % 55]; if (a[i] < 0) a[i] += MBIG; }
  let inext = 0, inextp = 21;
  return () => {
    if (++inext >= 56) inext = 1;
    if (++inextp >= 56) inextp = 1;
    let r = a[inext] - a[inextp];
    if (r === MBIG) r--;
    if (r < 0) r += MBIG;
    a[inext] = r;
    return r * (1 / MBIG);
  };
}

// Raster (IRaster): { size, dark(x, y), isEye(x, y) }

/** Bewegungen.Paare: jede dunkle Zelle von a bekommt ein Ziel in b, nach Winkel geordnet. */
export function paare(a, b, seed = 7) {
  const zellen = q => { const r = []; for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y) && !q.isEye(x, y)) r.push([x, y]); return r; };
  const A = zellen(a), B = zellen(b), c = a.size / 2;
  const key = p => Math.atan2(p[1] - c, p[0] - c) * 10 + Math.sqrt((p[0] - c) * (p[0] - c) + (p[1] - c) * (p[1] - c)) * 0.15;
  const nachKey = L => L.map(p => [key(p), p]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  const As = nachKey(A), Bs = nachKey(B);
  const rnd = netRandom(seed), N = Math.max(As.length, Bs.length), r = [];
  for (let i = 0; i < N; i++) {
    const p = As[Math.floor(i * As.length / N)], q = Bs[Math.floor(i * Bs.length / N)];
    r.push({ px: p[0], py: p[1], qx: q[0], qy: q[1], seed: rnd() * 1000 });
  }
  return r;
}

// ───────────────────────────── Farbarten (Farbe)
export const ruhend = (x, y, groesse) => ({ art: "ruhend", x, y, groesse });
export const fluss = (a, b, sw) => ({ art: "fluss", a, b, sw });
export const gedimmt = (x, y, groesse, k) => ({ art: "gedimmt", x, y, groesse, k });

// ───────────────────────────── Hilfen (Bewegungen.*)
const glaetten = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const klemme = v => Math.min(1, Math.max(0, v));
/** Bewegungen.Hash (Sinus-Trick wie buehne.js). */
const hashSin = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
function hash01(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const feldStandard = p => Math.pow(Math.abs(1 - 2 * p), 2);
const wFluss = (l, u, v, sw) => fluss(Math.abs(u - .5) * l.n * 3, v * l.n * 3, sw);
const wModul = (q, u, v) => ruhend(Math.floor(u * q.size), Math.floor(v * q.size), q.size);
function wDunkel(q, u, v) {
  const x = Math.floor(u * q.size), y = Math.floor(v * q.size);
  return x >= 0 && y >= 0 && x < q.size && y < q.size && q.dark(x, y) && !q.isEye(x, y);
}
function wZellen(q) {
  const r = [];
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.dark(x, y) && !q.isEye(x, y)) r.push([(x + .5) / q.size, (y + .5) / q.size]);
  return r;
}
function wSetze(l, u, v, f, besetzt) {
  const gx = Math.floor(u * l.n), gy = Math.floor(v * l.n);
  if (gx < 0 || gy < 0 || gx >= l.n || gy >= l.n) return;
  if (besetzt) { const k = gx * 512 + gy; if (besetzt.has(k)) return; besetzt.add(k); }
  l.ziel.zelle(gx, gy, f);
}

// Lage: { ziel, a, b, paare, p, t, n, rand, sw }

function falter(l) {
  const { p, t, n } = l;
  const c = (n - 1) / 2, e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const sw = Math.sin(Math.PI * p), fold = sw * sw, amp = n * 0.32 * sw;
  const used = new Set();
  for (const P2 of l.paare ?? paare(l.a, l.b)) {
    const x = P2.px + (P2.qx - P2.px) * e, y = P2.py + (P2.qy - P2.py) * e;
    const dx = x - c, side = dx < 0 ? -1 : 1, ax = Math.abs(dx);
    const ang = amp * 0.09 * (1 + fbm(ax * 0.12, y * 0.12, t * 0.5 + P2.seed * 0.001));
    const cy = c + (fbm(P2.seed * 0.01, 1, t * 0.2) - 0.5) * n * 0.3;
    const rx = Math.abs(ax * Math.cos(ang) - (y - cy) * Math.sin(ang)), ry = ax * Math.sin(ang) + (y - cy) * Math.cos(ang);
    const fx = c + side * rx, fy = cy + ry;
    const X = rundeGerade(x + (fx - x) * fold), Y = rundeGerade(y + (fy - y) * fold), X2 = rundeGerade(2 * c - X);
    const col = fluss(Math.abs(X - c) * 3, Y * 3, sw);
    const put = (gx, gy) => {
      if (gx < -l.rand || gy < -l.rand || gx >= n + l.rand || gy >= n + l.rand) return;
      const key = gy * 1000 + gx;
      if (used.has(key)) return; used.add(key);
      l.ziel.zelle(gx, gy, col);
    };
    put(X, Y);
    if (fold > 0.35) put(X2, Y);
  }
}

function klecks(l) {
  const q = l.p < .5 ? l.a : l.b, sw = l.sw, level = Math.pow(sw, 0.8) * 0.86, SEED = 17;
  for (let gy = 0; gy < l.n; gy++)
    for (let gx = 0; gx < l.n; gx++) {
      const u = (gx + .5) / l.n, v = (gy + .5) / l.n, mx = Math.abs(u - .5);
      const f = fbm(mx * 7 + SEED, v * 6, l.t * 0.25) * 0.75 + (1 - Math.sqrt(mx * 1.5 * mx * 1.5 + (v - .5) * 1.15 * (v - .5) * 1.15) * 2.1) * 0.55;
      if (f > 1.02 - level) l.ziel.zelle(gx, gy, wFluss(l, u, v, sw * (f > 1.1 - level ? 1 : 0.6)));
      else if (wDunkel(q, u, v)) l.ziel.zelle(gx, gy, wModul(q, u, v));
    }
}

function faltung(l) {
  const q = l.p < .5 ? l.a : l.b, p = l.p, sw = l.sw, n = l.n;
  const th = p < .5 ? 2 * p * Math.PI : (1 - p) * 2 * Math.PI, c = Math.cos(th);
  for (let gy = 0; gy < n; gy++)
    for (let gx = 0; gx < n; gx++) {
      const u = (gx + .5) / n, v = (gy + .5) / n;
      if (u < .5 && wDunkel(q, u, v)) l.ziel.zelle(gx, gy, wModul(q, u, v));
    }
  l.ziel.falz();
  const besetzt = new Set();
  for (let gy = 0; gy < n; gy++)
    for (let gx = Math.floor(n / 2); gx < n; gx++) {
      const u = (gx + .5) / n, v = (gy + .5) / n;
      if (!wDunkel(q, u, v)) continue;
      const u2 = .5 + (u - .5) * c, k = 0.15 + 0.85 * Math.abs(c);
      const col = c < 0 ? wFluss(l, u2, v, sw) : gedimmt(Math.floor(u * q.size), Math.floor(v * q.size), q.size, k);
      wSetze(l, u2, v, col, besetzt);
    }
  if (sw > 0.93) {
    const lv = (sw - 0.93) / 0.07;
    for (let gy = 0; gy < n; gy++)
      for (let gx = 0; gx < n; gx++) {
        const u = (gx + .5) / n, v = (gy + .5) / n, mx = Math.abs(u - .5);
        if (fbm(mx * 9, v * 7, l.t * 0.3) * 0.6 + (0.5 - mx * 4.5) > 1 - lv * 0.45) l.ziel.zelle(gx, gy, wFluss(l, u, v, 1));
      }
  }
}

function rieseln(l) {
  const dauer = 0.5, besetzt = new Set(), sw = l.sw;
  const lauf = (q, phase, fallen) => {
    for (const [u, v] of wZellen(q)) {
      const gm = Math.abs(Math.floor(u * q.size) - (q.size - 1) / 2);
      const d = gm / q.size * 0.7 + hashSin(gm, Math.floor(v * q.size)) * 0.2 + (fallen ? (1 - v) * 0.15 : v * 0.15);
      const k = klemme((phase - d) / dauer);
      const y = fallen ? v + (1.25 - v) * k * k : 1.25 + (v - 1.25) * (1 - (1 - k) * (1 - k));
      if (y >= 1) continue;
      const bewegt = fallen ? k > 0 : k < 1;
      const col = bewegt ? wFluss(l, u, y, Math.max(0.35, sw)) : wModul(q, u, v);
      wSetze(l, u, y, col, besetzt);
      if (bewegt) wSetze(l, 1 - u, y, col, besetzt);
    }
  };
  if (l.p < .5) lauf(l.a, l.p * 2, true); else lauf(l.b, (l.p - .5) * 2, false);
}

function wellen(l) {
  const sw = l.sw, R = glaetten(l.p) * 0.82, band = 0.05 + 0.05 * sw;
  for (let gy = 0; gy < l.n; gy++)
    for (let gx = 0; gx < l.n; gx++) {
      const u = (gx + .5) / l.n, v = (gy + .5) / l.n, mx = Math.abs(u - .5);
      const r = Math.sqrt(mx * mx + (v - .5) * (v - .5)) + (fbm(mx * 5, v * 5, l.t * 0.4) - .5) * 0.14;
      if (Math.abs(r - R) < band) {
        if (hashSin(gx > l.n / 2 ? l.n - 1 - gx : gx, gy) < 0.55 + 0.4 * sw) l.ziel.zelle(gx, gy, wFluss(l, u, v, sw));
        continue;
      }
      const q = r < R ? l.b : l.a;
      if (wDunkel(q, u, v)) l.ziel.zelle(gx, gy, wModul(q, u, v));
    }
}

function blende(l) {
  for (let y = 0; y < l.n; y++)
    for (let x = 0; x < l.n; x++) {
      if (l.a.isEye(x, y)) continue;
      const on = hash01(x, y) < l.p ? l.b.dark(x, y) : l.a.dark(x, y);
      if (on) l.ziel.zelle(x, y, ruhend(x, y, l.n));
    }
}

/** Bewegungen.Alle – gleiche Ids, Namen und Texte wie die C#-Fassung. */
export const BEWEGUNGEN = [
  { id: "rorschach", name: "I Falter (Rorschach)", text: "Die Module verwirbeln spiegelgleich zu einem Falter und setzen sich neu.", nurGleich: true, feldAlpha: feldStandard, zeichnen: falter },
  { id: "klecks", name: "II Klecks", text: "Ein Tintenklecks quillt aus der Mitte, deckt den Code zu und gibt den neuen frei.", nurGleich: false, feldAlpha: feldStandard, zeichnen: klecks },
  { id: "faltung", name: "III Faltung", text: "Die Karte faltet sich wie bei Rorschach: Die rechte Hälfte drückt sich auf die linke ab.", nurGleich: false, feldAlpha: feldStandard, zeichnen: faltung },
  { id: "rieseln", name: "IV Rieseln", text: "Die Module rieseln nach unten weg, der neue Code steigt spiegelgleich auf.", nurGleich: false, feldAlpha: feldStandard, zeichnen: rieseln },
  { id: "wellen", name: "V Wellen", text: "Eine Welle läuft von der Mitte nach außen und schreibt den neuen Code.", nurGleich: false, feldAlpha: feldStandard, zeichnen: wellen },
  { id: "blende", name: "Blende", text: "Jedes Modul springt zu seiner eigenen Zeit vom alten zum neuen Code.", nurGleich: true, feldAlpha: () => 1, zeichnen: blende },
  { id: "keiner", name: "Keiner", text: "Der neue Code erscheint ohne Übergang.", nurGleich: false, feldAlpha: feldStandard, zeichnen: () => {} },
];
/** Bewegungen.Finde: Unbekanntes wird zu „rorschach“. */
export const bewegungArt = id => BEWEGUNGEN.find(w => w.id === id) ?? BEWEGUNGEN[0];
