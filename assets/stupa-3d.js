// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 22.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Stupa in 3D (B 5 der Logo-Werkstatt): die fünf Bauteile als Körper, übereinander gestapelt.
//   Viereck · Erde   → Würfel          Kreis · Wasser → Kugel
//   Dreieck · Feuer  → dreiseitige Pyramide (von oben ein Dreieck, von der Seite auch)
//   Mond · Luft      → Mondsichel: gebogenes Horn, in der Mitte dick, zu den Spitzen dünn – von vorne der Mond des Logos,
//                      eine Wiege für den Tropfen (v2, Kenny 22.11.2026: „3D ist der Mond noch nicht gut“)
//   Tropfen · Raum   → Tropfen (Profil gedreht), liegt in der Sichel
// Fundament = 1, y oben. Eigenes Logo: keine Caelum-Aussenlinien.
// glb(farben, an) schreibt eine echte .glb (glTF 2.0, ein Knoten je Teil, Farbe = Material); buehne3d() zeigt den Stupa mit
// dem Renderer des Caelum 3D-Viewers (apps/viewer/kern.js): ziehen dreht, Rad/zwei Finger zoomen, Doppelklick passt ein.
// v4 (Kenny 22.11.2026): kein Aufbau-Film, kein Selbstdrehen. spiel() = Aufräum-Spiel in 3D: feste Kamera, die Körper liegen
// verstreut am Boden, man zieht sie auf den Stupa (Logik aufbau-kern.js wie in 2D, Körper bewegen sich in der Ebene z = 0).
import { viewerErzeugen } from "../apps/viewer/kern.js";
import { netz } from "../apps/viewer/laden.js";
import { Aufbau } from "./aufbau-kern.js?v=1";

export const TEILE = [["Viereck", "Erde"], ["Kreis", "Wasser"], ["Dreieck", "Feuer"], ["Mond", "Luft"], ["Tropfen", "Raum"]];

// ── Masse ──
const WUERFEL = 1, KUGEL = 0.86, PYR = 0.96;                    // Kantenlänge, Durchmesser, Seite = Höhe der Pyramide
const SICHEL_R = 0.36, SICHEL_DICKE = 0.1;                       // Radius der Mittellinie, halbe Dicke in der Mitte
const TROPFEN_B = 0.44;                                          // Breite des Tropfens (Kreis unten r = .22)
const LAGE = (() => {
  const u0 = 0, u1 = u0 + WUERFEL + 0.01, u2 = u1 + KUGEL + 0.01;
  const u3 = u2 + PYR - 0.02;                                    // Sichel ruht auf der Pyramidenspitze
  const mitte = u3 + SICHEL_R + SICHEL_DICKE;                    // Mittelpunkt des Sichelbogens
  const u4 = mitte - (SICHEL_R - SICHEL_DICKE);                  // Tropfen liegt innen auf der Sichel
  return { u: [u0, u1, u2, u3, u4], mitte };
})();
export const HOEHE = LAGE.u[4] + TROPFEN_B * 680 / 480;

// ── Körper (Dreiecke ohne Index: pos, nrm als Float-Listen) ──
function koerper() { return { pos: [], nrm: [] }; }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function drei(k, a, b, c) {
  const u = sub(b, a), v = sub(c, a), n = nrm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
  for (const p of [a, b, c]) { k.pos.push(...p); k.nrm.push(...n); }
}
// Gitter aus Punkten P[i][j] mit Normalen N[i][j] → Dreiecke (glatt)
function gitter(k, P, N) {
  for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < P[i].length; j++)
    for (const [a, b] of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) { k.pos.push(...P[i + a][j + b]); k.nrm.push(...N[i + a][j + b]); }
}

function wuerfel(s, y0) {
  const k = koerper(), h = s / 2, P = (x, y, z) => [x * h, y0 + (y + 1) * h, z * h];
  const seiten = [[[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]];
  for (const q of seiten) { const [a, b, c, d] = q.map(v => P(...v)); drei(k, a, b, c); drei(k, a, c, d); }
  return k;
}
function pyramide(breite, hoehe, y0) {
  // gleichseitiges Dreieck als Grundfläche, Breite = Seitenlänge; Spitze über dem Schwerpunkt
  const k = koerper(), r = breite / Math.sqrt(3), ecke = i => { const a = Math.PI / 2 + i * 2 * Math.PI / 3; return [Math.cos(a) * r, y0, -Math.sin(a) * r]; };
  const E = [0, 1, 2].map(ecke), S = [0, y0 + hoehe, 0];
  for (let i = 0; i < 3; i++) drei(k, E[i], E[(i + 1) % 3], S);
  drei(k, E[0], E[2], E[1]);
  return k;
}
// Drehkörper aus einem glatten Profil [[r, y], …]
function drehen(profil, n = 40) {
  const nr = profil.map((p, i) => { const a = profil[Math.max(0, i - 1)], b = profil[Math.min(profil.length - 1, i + 1)]; return nrm([b[1] - a[1], -(b[0] - a[0]), 0]); });
  const W = Array.from({ length: n + 1 }, (_, j) => j / n * 2 * Math.PI);
  const k = koerper();
  gitter(k, profil.map(p => W.map(w => [p[0] * Math.cos(w), p[1], p[0] * Math.sin(w)])), nr.map(q => W.map(w => [q[0] * Math.cos(w), q[1], q[0] * Math.sin(w)])));
  return k;
}
const bogen = (cx, cy, rx, ry, w0, w1, n) => Array.from({ length: n + 1 }, (_, i) => { const w = w0 + (w1 - w0) * i / n; return [cx + Math.cos(w) * rx, cy + Math.sin(w) * ry]; });
// Mondsichel: Mittellinie = Bogen unter dem Mittelpunkt (Spitzen leicht nach oben gebogen), Querschnitt rund, Dicke ~ sin
function sichel(mitte) {
  const N = 48, M = 20, w0 = Math.PI - 0.22, w1 = 2 * Math.PI + 0.22, P = [], Q = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, w = w0 + (w1 - w0) * t, r = SICHEL_DICKE * Math.pow(Math.sin(Math.PI * t), 0.65);
    const c = [SICHEL_R * Math.cos(w), mitte + SICHEL_R * Math.sin(w), 0], rad = [Math.cos(w), Math.sin(w), 0];
    const reiheP = [], reiheN = [];
    for (let j = 0; j <= M; j++) {
      const f = j / M * 2 * Math.PI, n = [rad[0] * Math.cos(f), rad[1] * Math.cos(f), Math.sin(f)];
      reiheP.push([c[0] + r * n[0], c[1] + r * n[1], c[2] + r * n[2] * 1.15]); reiheN.push(n);
    }
    P.push(reiheP); Q.push(reiheN);
  }
  const k = koerper(); gitter(k, P, Q); return k;
}
function tropfen(u4) {
  // Pfad aus der Werkstatt (480 breit, Spitze oben, Kreis r 240 unten), rechte Hälfte gedreht
  const k4 = TROPFEN_B / 480, T = (px, py) => [Math.abs(px - 500) * k4, u4 + (860 - py) * k4];
  const kurve = Array.from({ length: 17 }, (_, i) => { const t = i / 16, m = 1 - t; return T(m * m * m * 500 + 3 * m * m * t * 580 + 3 * m * t * t * 740 + t * t * t * 740, m * m * m * 180 + 3 * m * m * t * 260 + 3 * m * t * t * 420 + t * t * t * 620); });
  const unten = bogen(500, 620, 240, 240, 0, Math.PI / 2, 14).map(([x, y]) => T(x, y));
  return drehen(kurve.concat(unten.slice(1)));
}
let cache = null;
function bauteile() {
  if (cache) return cache;
  const u = LAGE.u;
  const kugel = drehen(bogen(0, u[1] + KUGEL / 2, KUGEL / 2, KUGEL / 2, Math.PI / 2, -Math.PI / 2, 22).map(([x, y]) => [Math.abs(x), y]));
  cache = [wuerfel(WUERFEL, u[0]), kugel, pyramide(PYR, PYR, u[2]), sichel(LAGE.mitte), tropfen(u[4])]
    .map(k => ({ pos: new Float32Array(k.pos), nrm: new Float32Array(k.nrm) }));
  return cache;
}

// ── Aufbau-Spiel: Umriss von vorne je Körper (Ursprung Mitte unten), Ziel = Lage im Stupa ──
const kreisPunkte = (cx, cy, r, n = 36) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * 2 * Math.PI) * r, cy + Math.sin(i / n * 2 * Math.PI) * r]);
export function spielTeile() {
  const u = LAGE.u, h = PYR, b = PYR / 2;
  // Sichel: Mittellinie als Kreiskette (Radius = Dicke), Umriss aus Aussen- und Innenkante
  const w0 = Math.PI - 0.22, w1 = 2 * Math.PI + 0.22, aussen = [], innen = [], kreise = [], m = LAGE.mitte - u[3];
  for (let i = 0; i <= 32; i++) {
    const s = i / 32, w = w0 + (w1 - w0) * s, d = SICHEL_DICKE * Math.pow(Math.sin(Math.PI * s), 0.65), c = Math.cos(w), si = Math.sin(w);
    aussen.push([c * (SICHEL_R + d), m + si * (SICHEL_R + d)]); innen.push([c * (SICHEL_R - d), m + si * (SICHEL_R - d)]);
    if (i % 2 === 0) kreise.push([c * SICHEL_R, m + si * SICHEL_R, Math.max(0.025, d)]);
  }
  // Tropfen: Profil wie tropfen(), gespiegelt
  const k4 = TROPFEN_B / 480, T = (px, py) => [(px - 500) * k4, (860 - py) * k4];
  const rechts = Array.from({ length: 17 }, (_, i) => { const q = i / 16, p = 1 - q; return T(p * p * p * 500 + 3 * p * p * q * 580 + 3 * p * q * q * 740 + q * q * q * 740, p * p * p * 180 + 3 * p * p * q * 260 + 3 * p * q * q * 420 + q * q * q * 620); })
    .concat(bogen(500, 620, 240, 240, 0, Math.PI / 2, 12).slice(1).map(([x, y]) => T(x, y)));
  const tropfenUmriss = rechts.concat(rechts.slice(1, -1).reverse().map(([x, y]) => [-x, y]));
  return [
    { name: "Viereck · Erde", umriss: [[-0.5, 0], [0.5, 0], [0.5, WUERFEL], [-0.5, WUERFEL]], ziel: { x: 0, y: u[0] }, symmetrie: 4 },
    { name: "Kreis · Wasser", kreis: [0, KUGEL / 2, KUGEL / 2], umriss: kreisPunkte(0, KUGEL / 2, KUGEL / 2), ziel: { x: 0, y: u[1] }, symmetrie: 0 },
    { name: "Dreieck · Feuer", umriss: [[-b, 0], [b, 0], [0, h]], ziel: { x: 0, y: u[2] } },
    { name: "Mond · Luft", umriss: aussen.concat(innen.reverse()), kreise, ziel: { x: 0, y: u[3] } },
    { name: "Tropfen · Raum", umriss: tropfenUmriss, ziel: { x: 0, y: u[4] } }
  ];
}

// ── Farben ──
const linear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function farbe(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return null;
  const n = parseInt(m[1], 16); return [linear(n >> 16), linear((n >> 8) & 255), linear(n & 255), 1];
}
// Körper i gedreht (a um die z-Achse, um seinen Ursprung Mitte unten) und verschoben (x, y)
function gelegt(i, x, y, a) {
  const k = bauteile()[i], u = LAGE.u[i], c = Math.cos(a), s = Math.sin(a), pos = new Float32Array(k.pos.length), nrm = new Float32Array(k.nrm.length);
  for (let j = 0; j < pos.length; j += 3) {
    const px = k.pos[j], py = k.pos[j + 1] - u, nx = k.nrm[j], ny = k.nrm[j + 1];
    pos[j] = c * px - s * py + x; pos[j + 1] = s * px + c * py + y; pos[j + 2] = k.pos[j + 2];
    nrm[j] = c * nx - s * ny; nrm[j + 1] = s * nx + c * ny; nrm[j + 2] = k.nrm[j + 2];
  }
  return { pos, nrm };
}
// Modell im Format von laden.js (für netz())
function modell(farben, an) {
  const parts = [];
  bauteile().forEach((k, i) => {
    const f = farbe(farben[i]); if (!f || (an && !an[i])) return;
    parts.push({ pos: k.pos, nrm: k.nrm, base: f, alpha: "OPAQUE", cutoff: 0.5 });
  });
  return { parts };
}
const BODEN = (() => { const w = wuerfel(1, -1); return { pos: new Float32Array(w.pos.map((v, j) => v * [6.8, 0.06, 1.8][j % 3])), nrm: new Float32Array(w.nrm) }; })();

// ── GLB schreiben ──
/** farben = 5 Hex-Farben ('none' = Teil weglassen), an = [1,1,1,1,1] → Uint8Array (.glb) */
export function glb(farben, an) {
  const json = { asset: { version: "2.0", generator: "Caelum Logo-Werkstatt (Stupa 3D)", copyright: "© 2026 Caelum GmbH" },
    scene: 0, scenes: [{ name: "Caelum Stupa", nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  const stuecke = []; let laenge = 0;
  bauteile().forEach((k, i) => {
    const f = farbe(farben[i]); if (!f || (an && !an[i])) return;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let j = 0; j < k.pos.length; j += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], k.pos[j + a]); max[a] = Math.max(max[a], k.pos[j + a]); }
    const ansicht = arr => { json.bufferViews.push({ buffer: 0, byteOffset: laenge, byteLength: arr.byteLength, target: 34962 }); stuecke.push(arr); laenge += arr.byteLength; return json.bufferViews.length - 1; };
    json.accessors.push({ bufferView: ansicht(k.pos), componentType: 5126, count: k.pos.length / 3, type: "VEC3", min, max });
    json.accessors.push({ bufferView: ansicht(k.nrm), componentType: 5126, count: k.nrm.length / 3, type: "VEC3" });
    const name = TEILE[i][0] + " · " + TEILE[i][1];
    json.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: f, metallicFactor: 0, roughnessFactor: 0.65 }, doubleSided: true });
    json.meshes.push({ name, primitives: [{ attributes: { POSITION: json.accessors.length - 2, NORMAL: json.accessors.length - 1 }, material: json.materials.length - 1 }] });
    json.nodes.push({ name, mesh: json.meshes.length - 1 }); json.scenes[0].nodes.push(json.nodes.length - 1);
  });
  json.buffers.push({ byteLength: laenge });
  const js = new TextEncoder().encode(JSON.stringify(json));
  const jl = (js.length + 3) & ~3, bl = (laenge + 3) & ~3, out = new Uint8Array(12 + 8 + jl + 8 + bl), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); out.fill(0x20, 20, 20 + jl); out.set(js, 20);
  const b0 = 20 + jl; dv.setUint32(b0, bl, true); dv.setUint32(b0 + 4, 0x004E4942, true);
  let o = b0 + 8; for (const s of stuecke) { out.set(new Uint8Array(s.buffer, s.byteOffset, s.byteLength), o); o += s.byteLength; }
  return out;
}

/** Bühne: canvas in `wo`; zeigen(farben, an) steht sofort, aufbauen(farben, an) stapelt die Teile. null ohne WebGL2. */
export function buehne3d(wo, opt = {}) {
  const cv = document.createElement("canvas"); cv.setAttribute("aria-label", "Stupa in 3D – ziehen dreht");
  cv.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab;border-radius:12px";
  wo.appendChild(cv);
  const winkel = document.createElement("span"); winkel.hidden = true; wo.appendChild(winkel);   // kern.js schreibt den Winkel hinein
  const state = { yaw: 30, pitch: 18, bg: opt.bg || "dunkel", ortho: false, animation: "", animation_time: 0 };
  const v = viewerErzeugen(id => (id === "gl" ? cv : id === "angle" ? winkel : null), state);
  if (!v.ready) { cv.remove(); return null; }
  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let kamera = null, dreht = false, lauf = 0, letzt = 0, sp = null;   // v4: kein Selbstdrehen
  // Kamera einmal auf den fertigen Stupa einpassen; danach bleibt der Drehpunkt fest (auch wenn Teile noch fallen)
  function laden(m) {
    if (!m.parts.length) { v.clear(); v.draw(); return false; }
    v.reorient = false; v.load(netz(m));
    if (!kamera) { v.home(); v.zoom = 1.18; kamera = { mitte: v.mesh.center.slice(), radius: v.mesh.radius, dist: v.dist }; }
    v.mesh.center = kamera.mitte.slice(); v.mesh.radius = kamera.radius * 3; v.dist = kamera.dist;
    return true;
  }
  function schritt(t) { lauf = 0; if (!dreht || !cv.isConnected || !cv.clientWidth) return; if (letzt) state.yaw += (t - letzt) * 0.012; letzt = t; v.draw(); lauf = requestAnimationFrame(schritt); }
  function an() { if (dreht && !lauf) { letzt = 0; lauf = requestAnimationFrame(schritt); } }
  const ptr = new Map(); let zug = null, zange = 0;
  cv.addEventListener("pointerdown", e => {
    if (sp) return spielZeiger(e, "ab");
    dreht = false; try { cv.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ } ptr.set(e.pointerId, [e.clientX, e.clientY]); cv.style.cursor = "grabbing";
    if (ptr.size === 1) zug = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch };
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; zange = Math.hypot(a[0] - b[0], a[1] - b[1]); zug = null; }
  });
  cv.addEventListener("pointermove", e => {
    if (sp) return spielZeiger(e, "zug");
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 2 && zange) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); v.zoom = Math.max(0.2, Math.min(8, v.zoom * zange / Math.max(1, d))); zange = d; v.draw(); return; }
    if (zug) { state.yaw = zug.yaw - (e.clientX - zug.x) * 0.4; state.pitch = Math.max(-89, Math.min(89, zug.pitch + (e.clientY - zug.y) * 0.4)); v.draw(); }
  });
  const los = e => { if (sp) return spielZeiger(e, "los"); ptr.delete(e.pointerId); if (ptr.size < 2) zange = 0; if (!ptr.size) { zug = null; cv.style.cursor = "grab"; } };
  cv.addEventListener("pointerup", los); cv.addEventListener("pointercancel", los);
  cv.addEventListener("wheel", e => { e.preventDefault(); if (sp) return; v.zoom = Math.max(0.2, Math.min(8, v.zoom * Math.exp(e.deltaY * 0.0015))); v.draw(); }, { passive: false });
  cv.addEventListener("dblclick", () => { if (sp) return; v.zoom = 1.18; v.draw(); });

  // ── Aufbau-Spiel: feste Kamera, Zeiger → Strahl → Ebene z = 0 ──
  const FOV = 35 * Math.PI / 180, SPIEL = { yaw: 14, pitch: 9, mitte: [0, 2.05, 0] };
  const richtung = (yaw, pitch) => { const y = yaw * Math.PI / 180, p = pitch * Math.PI / 180; return [Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)]; };
  function kameraSpiel() {
    const asp = cv.clientWidth / Math.max(1, cv.clientHeight) || 1, t = Math.tan(FOV / 2);
    return Math.max(2.4 / t, 2.95 / (t * asp));                     // Boden ±2.7 breit und 4.8 hoch sichtbar
  }
  function strahl(e) {
    const r = cv.getBoundingClientRect(), nx = (e.clientX - r.left) / r.width * 2 - 1, ny = 1 - (e.clientY - r.top) / r.height * 2;
    const back = richtung(state.yaw, state.pitch), t = Math.tan(FOV / 2), asp = r.width / Math.max(1, r.height);
    let right = [back[2], 0, -back[0]]; const l = Math.hypot(...right) || 1; right = right.map(q => q / l);
    const up = [back[1] * right[2] - back[2] * right[1], back[2] * right[0] - back[0] * right[2], back[0] * right[1] - back[1] * right[0]];
    const d = v.dist * v.zoom, eye = SPIEL.mitte.map((m, i) => m + back[i] * d);
    const dir = [0, 1, 2].map(i => -back[i] + right[i] * nx * t * asp + up[i] * ny * t);
    const s = -eye[2] / (dir[2] || 1e-9);
    return [eye[0] + dir[0] * s, eye[1] + dir[1] * s, r.width];
  }
  function spielBild() {
    const P = sp.spiel.posen(), parts = [{ pos: BODEN.pos, nrm: BODEN.nrm, base: farbe("#3A3A37"), alpha: "OPAQUE", cutoff: 0.5 }];
    for (const q of P) {
      const f = farbe(sp.farben[q.i]) || farbe("#8E8C86"); if (!q.an) continue;
      const g = gelegt(q.i, q.x, q.y, q.a);
      parts.push({ pos: g.pos, nrm: g.nrm, base: q.gegriffen ? f.map((c, j) => j < 3 ? Math.min(1, c * 1.25 + 0.03) : 1) : f, alpha: "OPAQUE", cutoff: 0.5 });
    }
    const n = sp.spiel.naechstes();
    if (n >= 0 && !sp.spiel.fertig) {                                // Geist: wo das nächste Teil hingehört
      const z = sp.spiel.k[n], g = gelegt(n, 0, LAGE.u[n], 0), f = farbe(sp.farben[n]) || farbe("#C9C6BF");
      parts.push({ pos: g.pos, nrm: g.nrm, base: [f[0], f[1], f[2], P[n].nah ? 0.55 : 0.22], alpha: "blend", cutoff: 0.5 });
      void z;
    }
    v.reorient = false; v.load(netz({ parts }));
    v.mesh.center = SPIEL.mitte.slice(); v.mesh.radius = 7; v.dist = kameraSpiel(); v.zoom = 1;
    v.draw();
  }
  function spielSchleife(t) {
    sp.lauf = 0; if (!sp || !cv.isConnected || !cv.clientWidth) return;
    const dt = sp.zuletzt ? (t - sp.zuletzt) / 1000 : 1 / 60; sp.zuletzt = t;
    sp.spiel.schritt(dt); spielBild();
    if (!sp.spiel.ruht || sp.spiel.k.some(b => b.rastet)) sp.lauf = requestAnimationFrame(spielSchleife); else sp.zuletzt = 0;
  }
  new ResizeObserver(() => { if (sp) spielBild(); }).observe(cv);   // nach dem Einpassen des Viewers: feste Spiel-Kamera
  const spielWecken = () => { if (sp && !sp.lauf) { sp.zuletzt = 0; sp.lauf = requestAnimationFrame(spielSchleife); } };
  function spielMelde() {
    const s = sp.spiel, on = sp.opt.onStatus || (() => {});
    if (s.fertig) return on("Der Stupa steht. Antippen färbt ein Teil, „Neu verstreuen“ beginnt von vorn.");
    const n = s.naechstes(); on(n < 0 ? "" : `Als Nächstes: ${TEILE[n][0]} · ${TEILE[n][1]} – zieh es auf den durchscheinenden Platz.`);
  }
  function spielZeiger(e, art) {
    const s = sp.spiel;
    if (art === "ab") {
      if (sp.zug) return;
      const [x, y, w] = strahl(e), px = w / (2 * Math.tan(FOV / 2) * (cv.clientWidth / Math.max(1, cv.clientHeight)) * v.dist) ;
      const i = s.greifen(x, y, Math.max(0.08, 18 / Math.max(1, px)));
      if (i < 0) return;
      try { cv.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
      sp.zug = { id: e.pointerId, i, x: e.clientX, y: e.clientY, t: performance.now(), weg: 0 }; cv.style.cursor = "grabbing";
      spielMelde(); spielWecken(); return;
    }
    if (!sp.zug || e.pointerId !== sp.zug.id) return;
    if (art === "zug") { sp.zug.weg = Math.max(sp.zug.weg, Math.hypot(e.clientX - sp.zug.x, e.clientY - sp.zug.y)); const [x, y] = strahl(e); s.ziehen(x, y); spielWecken(); return; }
    const tipp = sp.zug.weg < 6 && performance.now() - sp.zug.t < 350, i = sp.zug.i; sp.zug = null; cv.style.cursor = "grab";
    s.loslassen(); spielWecken(); spielMelde();
    if (tipp && sp.opt.onTippen) sp.opt.onTippen(i);
  }
  return {
    zeigen(farben, teileAn) { this.spielEnde(); if (laden(modell(farben, teileAn))) v.draw(); },
    drehen() { dreht = !ruhig(); an(); },
    /** Aufräum-Spiel: opt = { neu, onStatus(text), onTippen(i) }; neu = frisch verstreuen */
    spiel(farben, teileAn, opt = {}) {
      dreht = false;
      if (!sp) {
        sp = { spiel: new Aufbau({ breite: 5.4, hoehe: 5, teile: spielTeile(), onEinrasten: () => spielMelde(), onFertig: () => spielMelde() }), farben: farben.slice(), opt, lauf: 0, zuletzt: 0, zug: null };
        opt.neu = true;
      }
      sp.opt = opt; sp.farben = farben.slice(); state.yaw = SPIEL.yaw; state.pitch = SPIEL.pitch; cv.style.cursor = "grab";
      cv.setAttribute("aria-label", "Aufbau in 3D – Teile auf den Stupa ziehen");
      sp.spiel.setzeAn(teileAn.map(Boolean));
      if (opt.neu) { sp.spiel.verstreuen(); if (ruhig()) for (let j = 0; j < 240; j++) sp.spiel.schritt(1 / 60); }
      spielBild(); spielMelde(); spielWecken();
    },
    spielFarben(farben, teileAn) { if (!sp) return; sp.farben = farben.slice(); sp.spiel.setzeAn(teileAn.map(Boolean)); spielBild(); spielMelde(); spielWecken(); },
    loesung() { if (!sp) return; sp.spiel.fertigStellen(); spielBild(); spielMelde(); },
    spielEnde() {
      if (!sp) return;
      cancelAnimationFrame(sp.lauf); sp = null; kamera = null; state.yaw = 30; state.pitch = 18;
      cv.style.cursor = "grab"; cv.setAttribute("aria-label", "Stupa in 3D – ziehen dreht");
    },
    glb
  };
}
