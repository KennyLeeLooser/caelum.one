// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// GLB eines Schilds für den Caelum 3D-Viewer, Web-Fassung von src/Caelum.Gravur.Core/GlbExport.cs (Single) und
// Preview.FaceTexture (Master): Körper in echter Dicke, Oberseite mit Gravur als Textur, Unterseite in Oberflächenfarbe,
// Seiten und Lochwände in Kernfarbe, Löcher durchsichtig (Alpha-Maske). Masse in m, Vorderseite zeigt nach +Z.
// Die Textur malt der Browser (Canvas); in Node übergibt der Gleichheitstest ein Ersatzbild.

/** Umriss als Punktfolge (SignGeometry.OutlinePolygon, Ecken mit 8 Segmenten). */
export function umrissPolygon(g, seg = 8) {
  const w = g.breite, h = g.hoehe, r = Math.min(g.radius, Math.min(w, h) / 2);
  if (r <= 0.01) return [[0, 0], [w, 0], [w, h], [0, h]];
  const pts = [];
  const bogen = (cx, cy, a0) => { for (let i = 0; i <= seg; i++) { const a = (a0 + 90 * i / seg) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  bogen(r, r, 180); bogen(w - r, r, 270); bogen(w - r, h - r, 0); bogen(r, h - r, 90);
  return pts;
}

/** Loch als Punktfolge (Cutout.Polygon): Kreis mit 32 Punkten, Langloch aus zwei Halbkreisen. */
export function lochPolygon(l, seg = 32) {
  const r = Math.min(l.w, l.h) / 2, pts = [];
  if (Math.abs(l.w - l.h) < 1e-6) { for (let i = 0; i < seg; i++) { const a = 2 * Math.PI * i / seg; pts.push([l.x + r * Math.cos(a), l.y + r * Math.sin(a)]); } return pts; }
  const senk = l.h > l.w, halb = (senk ? l.h : l.w) / 2 - r, hs = seg / 2;
  const enden = senk ? [[l.x, l.y - halb, Math.PI], [l.x, l.y + halb, 0]] : [[l.x + halb, l.y, -Math.PI / 2], [l.x - halb, l.y, Math.PI / 2]];
  for (const [cx, cy, a0] of enden) for (let i = 0; i <= hs; i++) { const a = a0 + Math.PI * i / hs; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const skalar = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function hexRgba(hex) { const c = parseInt(hex.slice(1, 7), 16); return [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255, 1]; }

class Prim {
  constructor() { this.P = []; this.N = []; this.U = []; }
  /** Dreieck mit Normale; Umlaufsinn so, dass er zur Normalen passt (wie Tri in GlbExport.cs). */
  tri(a, b, c, n, ua = [0, 0], ub = [0, 0], uc = [0, 0]) {
    if (skalar(kreuz(sub(b, a), sub(c, a)), n) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; }
    for (const [p, u] of [[a, ua], [b, ub], [c, uc]]) { this.P.push(...p); this.N.push(...n); this.U.push(...u); }
  }
}

/**
 * Geometrie des Schilds als drei Teile (Oberseite, Unterseite, Kern) – Masse aus aufbauen() in schild.js.
 * Ergebnis: { oben, unten, kern } je { P, N, U } (flache Listen), dicke in m.
 */
export function koerper(g, dickeMm) {
  const t = dickeMm / 1000;
  const P = (x, y, z) => [x / 1000, -y / 1000, z];
  const UV = (x, y) => [x / g.breite, y / g.hoehe];
  const oben = new Prim(), unten = new Prim(), kern = new Prim();
  const poly = umrissPolygon(g);
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const up = [0, 0, 1], down = [0, 0, -1];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    oben.tri(P(cx, cy, t), P(a[0], a[1], t), P(b[0], b[1], t), up, UV(cx, cy), UV(a[0], a[1]), UV(b[0], b[1]));
    unten.tri(P(cx, cy, 0), P(a[0], a[1], 0), P(b[0], b[1], 0), down, UV(cx, cy), UV(a[0], a[1]), UV(b[0], b[1]));
    const pa0 = P(a[0], a[1], 0), pb0 = P(b[0], b[1], 0), mid = pa0.map((v, k) => (v + pb0[k]) / 2), ctr = P(cx, cy, 0);
    let n = norm(kreuz(norm(sub(pb0, pa0)), up));
    if (skalar(n, sub(mid, ctr)) < 0) n = n.map(v => -v);
    const v01 = P(a[0], a[1], t), v11 = P(b[0], b[1], t);
    kern.tri(pa0, pb0, v11, n); kern.tri(pa0, v11, v01, n);
  }
  for (const l of g.loecher) {
    const ring = lochPolygon(l), hc = P(l.x, l.y, 0);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length], p0 = P(a[0], a[1], 0), p1 = P(b[0], b[1], 0);
      if (skalar(sub(p1, p0), sub(p1, p0)) < 1e-14) continue;
      let n = norm(kreuz(norm(sub(p1, p0)), up));
      if (skalar(n, sub(hc, p0.map((v, k) => (v + p1[k]) / 2))) < 0) n = n.map(v => -v);
      const q0 = [p0[0], p0[1], t], q1 = [p1[0], p1[1], t];
      kern.tri(p0, p1, q1, n); kern.tri(p0, q1, q0, n);
    }
  }
  return { oben, unten, kern };
}

/** Bildgrösse der Texturen wie GlbExport.cs: oben höchstens 12 px/mm (lange Seite ≤ 1400 px), unten höchstens 6 px/mm. */
export function texturMass(g, oben) {
  const px = Math.min(12, 1400 / Math.max(g.breite, g.hoehe)), k = oben ? px : Math.min(px, 6);
  return { breite: Math.max(4, Math.round(g.breite * k)), hoehe: Math.max(4, Math.round(g.hoehe * k)) };
}

/** Textur im Browser malen (Preview.FaceTexture): Körper in Oberflächenfarbe, oben Gravur in Kernfarbe, Löcher durchsichtig. */
export async function texturMalen(g, farbe, oben) {
  const { breite, hoehe } = texturMass(g, oben);
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(breite, hoehe) : Object.assign(document.createElement("canvas"), { width: breite, height: hoehe });
  const x = c.getContext("2d");
  x.scale(breite / g.breite, hoehe / g.hoehe);
  const koerperPfad = new Path2D(g.umriss.d());
  for (const l of g.loecher) { const r = Math.min(l.w, l.h) / 2; koerperPfad.moveTo(l.x + r, l.y); koerperPfad.arc(l.x, l.y, r, 0, 2 * Math.PI); }
  x.fillStyle = farbe.oberflaeche; x.fill(koerperPfad, "evenodd");
  if (oben) {
    x.save(); x.clip(koerperPfad, "evenodd");
    x.fillStyle = farbe.kern; if (!g.gravur.leer) x.fill(new Path2D(g.gravur.d()), "nonzero");
    if (!g.gravur2.leer) { x.fillStyle = farbe.kern2 || farbe.kern; x.fill(new Path2D(g.gravur2.d()), "nonzero"); }
    if (!g.schriftUmriss.leer) { x.strokeStyle = farbe.kern; x.lineWidth = 0.15; x.stroke(new Path2D(g.schriftUmriss.d())); }
    x.restore();
  }
  const blob = c.convertToBlob ? await c.convertToBlob({ type: "image/png" }) : await new Promise(r => c.toBlob(r, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

/** GLB schreiben: drei Materialien wie in der App (Oberseite/Unterseite mit Textur + Alpha-Maske 0,5, Kern einfarbig). */
export function glbSchreiben(teile, farbe, pngOben, pngUnten, name = "Schild") {
  const bin = [], views = [], accessors = [], meshPrims = [];
  let laenge = 0;
  const add = (bytes, target) => {
    while (laenge % 4) { bin.push(new Uint8Array(1)); laenge++; }
    views.push({ buffer: 0, byteOffset: laenge, byteLength: bytes.byteLength, ...(target ? { target } : {}) });
    bin.push(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)); laenge += bytes.byteLength; return views.length - 1;
  };
  const metall = !!farbe.metall;
  const materials = [
    { name: name + " Oberseite", pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: metall ? 0.6 : 0, roughnessFactor: metall ? 0.35 : 0.55 }, alphaMode: "MASK", alphaCutoff: 0.5 },
    { name: "Unterseite " + farbe.code, pbrMetallicRoughness: { baseColorTexture: { index: 1 }, metallicFactor: metall ? 0.6 : 0, roughnessFactor: metall ? 0.35 : 0.55 }, alphaMode: "MASK", alphaCutoff: 0.5 },
    { name: "Kern " + farbe.code, pbrMetallicRoughness: { baseColorFactor: hexRgba(farbe.kern), metallicFactor: 0, roughnessFactor: 0.6 } },
  ];
  [teile.oben, teile.unten, teile.kern].forEach((p, mi) => {
    if (!p.P.length) return;
    const n = p.P.length / 3, pos = Float32Array.from(p.P), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]); }
    const attr = { POSITION: accessors.length };
    accessors.push({ bufferView: add(pos, 34962), componentType: 5126, count: n, type: "VEC3", min, max });
    attr.NORMAL = accessors.length; accessors.push({ bufferView: add(Float32Array.from(p.N), 34962), componentType: 5126, count: n, type: "VEC3" });
    if (mi < 2) { attr.TEXCOORD_0 = accessors.length; accessors.push({ bufferView: add(Float32Array.from(p.U), 34962), componentType: 5126, count: n, type: "VEC2" }); }
    const idx = n > 65535 ? Uint32Array.from({ length: n }, (_, i) => i) : Uint16Array.from({ length: n }, (_, i) => i);
    const ia = accessors.length; accessors.push({ bufferView: add(idx, 34963), componentType: n > 65535 ? 5125 : 5123, count: n, type: "SCALAR" });
    meshPrims.push({ attributes: attr, indices: ia, material: mi });
  });
  const images = [{ bufferView: add(pngOben), mimeType: "image/png" }, { bufferView: add(pngUnten), mimeType: "image/png" }];
  while (laenge % 4) { bin.push(new Uint8Array(1)); laenge++; }
  const json = {
    asset: { version: "2.0", generator: "Caelum Gravur Web (nach GlbExport.cs)", copyright: "Freeware der Datenpunkt engineering AG, erstellt von Caelum GmbH" },
    scene: 0, scenes: [{ name: "Schild", nodes: [0] }], nodes: [{ name, mesh: 0 }], meshes: [{ name, primitives: meshPrims }],
    materials, textures: [{ source: 0, sampler: 0 }, { source: 1, sampler: 0 }], samplers: [{ magFilter: 9729, minFilter: 9987 }], images,
    buffers: [{ byteLength: laenge }], bufferViews: views, accessors,
  };
  let js = new TextEncoder().encode(JSON.stringify(json));
  const pad = (4 - js.length % 4) % 4; if (pad) { const z = new Uint8Array(js.length + pad).fill(0x20); z.set(js); js = z; }
  const gesamt = 12 + 8 + js.length + 8 + laenge, out = new Uint8Array(gesamt), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, gesamt, true);
  dv.setUint32(12, js.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(js, 20);
  let o = 20 + js.length; dv.setUint32(o, laenge, true); dv.setUint32(o + 4, 0x004e4942, true); o += 8;
  for (const b of bin) { out.set(b, o); o += b.length; }
  return out;
}
