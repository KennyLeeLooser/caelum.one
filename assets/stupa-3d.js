// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 22.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Stupa in 3D (B 5, v5 der Logo-Werkstatt): die fünf Bauteile als Körper, übereinander wie in der Stupa-Ansicht.
//   Viereck · Erde   → Würfel          Kreis · Wasser → Kugel
//   Dreieck · Feuer  → dreiseitige Pyramide (von oben ein Dreieck, von der Seite auch)
//   Mond · Luft      → Schale (Sichelprofil gedreht)   Tropfen · Raum → Tropfen (Profil gedreht)
// Masse wie STUPA in logo-werkstatt.js (Fundament = 1, y oben). Eigenes Logo: keine Caelum-Aussenlinien.
// glb(farben, an) schreibt eine echte .glb (glTF 2.0, ein Knoten je Teil, Farbe = Material); buehne3d() zeigt sie mit
// dem Renderer des Caelum 3D-Viewers (apps/viewer/kern.js): ziehen dreht, Rad/zwei Finger zoomen, Doppelklick passt ein.
import { viewerErzeugen } from "../apps/viewer/kern.js";
import { laden, netz } from "../apps/viewer/laden.js";

export const TEILE = [["Viereck", "Erde"], ["Kreis", "Wasser"], ["Dreieck", "Feuer"], ["Mond", "Luft"], ["Tropfen", "Raum"]];

// Lage wie STUPA in logo-werkstatt.js: Breiten 1 · .86 · .96 · .86 · .44, Mond ruht auf der Spitze, Tropfen in der Schale
const BREITE = [1, 0.86, 0.96, 0.86, 0.44];
const UNTEN = (() => {
  const h = [1, 0.86, 0.96, 0.43, 0.44 * 680 / 480], u = [];
  let y = 0;
  for (let i = 0; i < 5; i++) {
    u[i] = i === 3 ? y - 0.02 : i === 4 ? u[3] + 0.14 * BREITE[3] : y;
    y = u[i] + h[i] + 0.01;
  }
  return u;
})();

// ── Körper (Dreiecke ohne Index: pos, nrm als Float-Listen) ──
function koerper() { return { pos: [], nrm: [] }; }
function drei(k, a, b, c, n) {
  if (!n) { const u = sub(b, a), v = sub(c, a); n = nrm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]); }
  for (const p of [a, b, c]) { k.pos.push(...p); k.nrm.push(...n); }
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const nrm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

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
// Drehkörper: profil = Liste von Strecken, jede [[r, y], …] glatt; zwischen den Strecken bleibt eine Kante
function drehen(profil, n = 48) {
  const k = koerper();
  for (const st of profil) {
    const nr = st.map((p, i) => { const a = st[Math.max(0, i - 1)], b = st[Math.min(st.length - 1, i + 1)]; return nrm([b[1] - a[1], -(b[0] - a[0]), 0]); });
    for (let i = 0; i + 1 < st.length; i++) for (let j = 0; j < n; j++) {
      const w0 = j / n * 2 * Math.PI, w1 = (j + 1) / n * 2 * Math.PI;
      const P = (p, w) => [p[0] * Math.cos(w), p[1], p[0] * Math.sin(w)], N = (q, w) => [q[0] * Math.cos(w), q[1], q[0] * Math.sin(w)];
      const a = st[i], b = st[i + 1];
      const v = [[P(a, w0), N(nr[i], w0)], [P(b, w0), N(nr[i + 1], w0)], [P(b, w1), N(nr[i + 1], w1)], [P(a, w1), N(nr[i], w1)]];
      for (const t of [[0, 1, 2], [0, 2, 3]]) for (const x of t) { k.pos.push(...v[x][0]); k.nrm.push(...v[x][1]); }
    }
  }
  return k;
}
const bogen = (cx, cy, rx, ry, w0, w1, n) => Array.from({ length: n + 1 }, (_, i) => { const w = w0 + (w1 - w0) * i / n; return [cx + Math.cos(w) * rx, cy + Math.sin(w) * ry]; });

function bauteile() {
  const [b0, b1, b2, b3, b4] = BREITE, [u0, u1, u2, u3, u4] = UNTEN;
  const kugel = drehen([bogen(0, u1 + b1 / 2, b1 / 2, b1 / 2, Math.PI / 2, -Math.PI / 2, 24).map(([x, y]) => [Math.abs(x), y])]);
  // Mond: aussen Halbkreis (r = .43), innen flachere Schale (Tiefe .36 der Breite) – wie der Sichelpfad im Logo
  const rand = u3 + b3 / 2, r3 = b3 / 2;
  const schale = drehen([bogen(0, rand, r3, r3, 0, -Math.PI / 2, 20), bogen(0, rand, r3, 0.36 * b3, -Math.PI / 2, 0, 20)]);
  // Tropfen: Pfad aus BAU (480 breit, Spitze oben, Kreis r 240 unten), rechte Hälfte gedreht
  const k4 = b4 / 480, T = (px, py) => [Math.abs(px - 500) * k4, u4 + (860 - py) * k4];
  const kurve = Array.from({ length: 17 }, (_, i) => { const t = i / 16, m = 1 - t; const px = m * m * m * 500 + 3 * m * m * t * 580 + 3 * m * t * t * 740 + t * t * t * 740, py = m * m * m * 180 + 3 * m * m * t * 260 + 3 * m * t * t * 420 + t * t * t * 620; return T(px, py); });
  const unten = bogen(500, 620, 240, 240, 0, Math.PI / 2, 14).map(([x, y]) => T(x, y));
  const tropfen = drehen([kurve.concat(unten.slice(1))]);
  return [wuerfel(b0, u0), kugel, pyramide(b2, b2, u2), schale, tropfen];
}

// ── GLB schreiben ──
const linear = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
function farbe(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return null;
  const n = parseInt(m[1], 16); return [linear(n >> 16), linear((n >> 8) & 255), linear(n & 255), 1];
}
/** farben = 5 Hex-Farben ('none' = Teil weglassen), an = [1,1,1,1,1] → Uint8Array (.glb) */
export function glb(farben, an) {
  const koerperListe = bauteile(), json = { asset: { version: "2.0", generator: "Caelum Logo-Werkstatt (Stupa 3D)", copyright: "© 2026 Caelum GmbH" },
    scene: 0, scenes: [{ name: "Caelum Stupa", nodes: [] }], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  const stuecke = []; let laenge = 0;
  koerperListe.forEach((k, i) => {
    const f = farbe(farben[i]); if (!f || (an && !an[i])) return;
    const pos = new Float32Array(k.pos), nr = new Float32Array(k.nrm), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let j = 0; j < pos.length; j += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], pos[j + a]); max[a] = Math.max(max[a], pos[j + a]); }
    const ansicht = arr => { json.bufferViews.push({ buffer: 0, byteOffset: laenge, byteLength: arr.byteLength, target: 34962 }); stuecke.push(arr); laenge += arr.byteLength; return json.bufferViews.length - 1; };
    json.accessors.push({ bufferView: ansicht(pos), componentType: 5126, count: pos.length / 3, type: "VEC3", min, max });
    json.accessors.push({ bufferView: ansicht(nr), componentType: 5126, count: nr.length / 3, type: "VEC3" });
    const name = TEILE[i][0] + " · " + TEILE[i][1];
    json.materials.push({ name, pbrMetallicRoughness: { baseColorFactor: f, metallicFactor: 0, roughnessFactor: 0.65 }, doubleSided: true });
    json.meshes.push({ name, primitives: [{ attributes: { POSITION: json.accessors.length - 2, NORMAL: json.accessors.length - 1 }, material: json.materials.length - 1 }] });
    json.nodes.push({ name, mesh: json.meshes.length - 1 }); json.scenes[0].nodes.push(json.nodes.length - 1);
  });
  json.buffers.push({ byteLength: laenge });
  let js = new TextEncoder().encode(JSON.stringify(json));
  const jl = (js.length + 3) & ~3, bl = (laenge + 3) & ~3, out = new Uint8Array(12 + 8 + jl + 8 + bl), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
  dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); out.fill(0x20, 20, 20 + jl); out.set(js, 20);
  const b0 = 20 + jl; dv.setUint32(b0, bl, true); dv.setUint32(b0 + 4, 0x004E4942, true);
  let o = b0 + 8; for (const s of stuecke) { out.set(new Uint8Array(s.buffer, s.byteOffset, s.byteLength), o); o += s.byteLength; }
  return out;
}

/** Bühne: canvas in `wo`, zeigen(farben, an) lädt neu, Rückgabe null ohne WebGL2. Dreht sich langsam, bis man anfasst. */
export function buehne3d(wo, opt = {}) {
  const cv = document.createElement("canvas"); cv.setAttribute("aria-label", "Stupa in 3D – ziehen dreht");
  cv.style.cssText = "width:100%;height:100%;display:block;touch-action:none;cursor:grab;border-radius:12px";
  wo.appendChild(cv);
  const state = { yaw: 30, pitch: 18, bg: opt.bg || "dunkel", ortho: false, animation: "", animation_time: 0 };
  const winkel = document.createElement("span"); winkel.hidden = true; wo.appendChild(winkel);   // kern.js schreibt den Winkel hinein
  const v = viewerErzeugen(id => (id === "gl" ? cv : id === "angle" ? winkel : null), state);
  if (!v.ready) { cv.remove(); return null; }
  let geladen = false, dreht = !matchMedia("(prefers-reduced-motion: reduce)").matches, lauf = 0, letzt = 0;
  function schritt(t) { lauf = 0; if (!dreht || !cv.isConnected || !cv.clientWidth) return; if (letzt) state.yaw += (t - letzt) * 0.012; letzt = t; v.draw(); lauf = requestAnimationFrame(schritt); }
  function an() { if (dreht && !lauf) { letzt = 0; lauf = requestAnimationFrame(schritt); } }
  const ptr = new Map(); let zug = null, zange = 0;
  cv.addEventListener("pointerdown", e => {
    dreht = false; try { cv.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ } ptr.set(e.pointerId, [e.clientX, e.clientY]); cv.style.cursor = "grabbing";
    if (ptr.size === 1) zug = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch };
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; zange = Math.hypot(a[0] - b[0], a[1] - b[1]); zug = null; }
  });
  cv.addEventListener("pointermove", e => {
    if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptr.size === 2 && zange) { const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); v.zoom = Math.max(0.2, Math.min(8, v.zoom * zange / Math.max(1, d))); zange = d; v.draw(); return; }
    if (zug) { state.yaw = zug.yaw - (e.clientX - zug.x) * 0.4; state.pitch = Math.max(-89, Math.min(89, zug.pitch + (e.clientY - zug.y) * 0.4)); v.draw(); }
  });
  const los = e => { ptr.delete(e.pointerId); if (ptr.size < 2) zange = 0; if (!ptr.size) { zug = null; cv.style.cursor = "grab"; } };
  cv.addEventListener("pointerup", los); cv.addEventListener("pointercancel", los);
  cv.addEventListener("wheel", e => { e.preventDefault(); v.zoom = Math.max(0.2, Math.min(8, v.zoom * Math.exp(e.deltaY * 0.0015))); v.draw(); }, { passive: false });
  cv.addEventListener("dblclick", () => { v.fit(); v.draw(); });
  if ("ResizeObserver" in window) new ResizeObserver(() => { if (geladen && cv.clientWidth) { v.draw(); an(); } }).observe(cv);
  return {
    async zeigen(farben, teileAn) {
      const m = await laden([{ name: "Caelum-Stupa.glb", bytes: glb(farben, teileAn) }]).catch(() => null);
      if (!m) { v.clear(); geladen = false; v.draw(); return; }
      v.reorient = !geladen; v.load(netz(m)); if (!geladen) { v.home(); v.zoom = 1.18; } geladen = true;   // etwas Luft um den Turm v.draw(); an();
    },
    drehen() { dreht = !matchMedia("(prefers-reduced-motion: reduce)").matches; an(); },
    glb
  };
}
