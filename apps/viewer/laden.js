// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum 3D-Viewer · Web-Fassung der Lader. MASTER ist die App: src/Caelum.Viewer.Core/Loaders.cs (Regeln je Format)
// und MeshExport.cs (Netz für den Renderer). Formate im Web: GLB, glTF, OBJ (+MTL/Texturen, wenn mitgezogen), STL, 3MF.
// Nur in der App: DXF, FBX, USDZ, BLEND (Blender), Animationen abspielen, Draco/Meshopt-komprimierte GLB.
// Koordinaten wie glTF: Y oben, 1 Einheit = 1 m. Reine Logik ohne DOM – läuft im Browser und in Node (Gleichheitstest).

export const FORMATE = [".glb", ".gltf", ".obj", ".stl", ".3mf"];
export const NUR_APP = { ".dxf": "DXF", ".fbx": "FBX", ".usdz": "USDZ", ".usd": "USD", ".blend": "BLEND", ".step": "STEP", ".stp": "STEP" };
const GRAU = [0.72, 0.74, 0.78, 1];

export class FormatFehler extends Error {}

const endung = n => (n.match(/\.[^.\\/]+$/) || [""])[0].toLowerCase();
const text = b => new TextDecoder("utf-8").decode(b);

/**
 * dateien = [{ name, bytes: Uint8Array }] – die erste Datei mit bekanntem Format ist das Modell, die übrigen dienen als
 * Begleitdateien (MTL, Texturen, .bin). Ergebnis: { format, name, parts: [...], notes: [...], animationen }.
 */
export async function laden(dateien) {
  const haupt = dateien.find(d => FORMATE.includes(endung(d.name))) || dateien[0];
  if (!haupt) throw new FormatFehler("Keine Datei.");
  const ext = endung(haupt.name);
  const neben = new Map(dateien.map(d => [d.name.split(/[\\/]/).pop().toLowerCase(), d.bytes]));
  if (NUR_APP[ext]) throw new FormatFehler(`${NUR_APP[ext]} öffnet nur die App (Caelum 3D-Viewer für Windows). Im Browser: GLB, glTF, OBJ, STL, 3MF.`);
  let m;
  switch (ext) {
    case ".glb": case ".gltf": m = gltf(haupt.bytes, neben); break;
    case ".obj": m = obj(haupt.bytes, neben); break;
    case ".stl": m = stl(haupt.bytes, haupt.name); break;
    case ".3mf": m = await dreiMf(haupt.bytes); break;
    default: throw new FormatFehler(`Format ${ext || "?"} wird nicht unterstützt.`);
  }
  m.name = haupt.name.replace(/\.[^.]+$/, "");
  m.parts = m.parts.filter(p => p.pos.length >= 9);
  for (const p of m.parts) normalenSicher(p);
  if (dreiecke(m) === 0) throw new FormatFehler("Die Datei enthält keine Dreiecke.");
  return m;
}

export const dreiecke = m => m.parts.reduce((s, p) => s + p.pos.length / 9, 0);

// ───────────────────────── Teile ─────────────────────────

class Teil {
  constructor(name, base = [0.8, 0.8, 0.8, 1]) {
    this.name = name; this.base = base; this.alpha = "opaque"; this.cutoff = 0.5; this.tex = null;
    this.P = []; this.N = []; this.U = []; this.C = [];
  }
}
function abschliessen(t) {
  const n = t.P.length / 3;
  return {
    name: t.name, base: t.base, alpha: t.alpha, cutoff: t.cutoff, tex: t.tex,
    pos: Float32Array.from(t.P), nrm: t.N.length === t.P.length ? Float32Array.from(t.N) : new Float32Array(0),
    uv: t.tex && t.U.length === n * 2 ? Float32Array.from(t.U) : null,
    col: t.C.length === n * 4 ? Float32Array.from(t.C) : null,
  };
}
/** Model.EnsureNormals: fehlende oder leere Normalen → Flächennormale je Dreieck. */
function normalenSicher(p) {
  const n = p.pos.length;
  let fehlt = p.nrm.length !== n;
  if (!fehlt) for (let i = 0; i < n; i += 3) if (p.nrm[i] === 0 && p.nrm[i + 1] === 0 && p.nrm[i + 2] === 0) { fehlt = true; break; }
  if (!fehlt) return;
  const out = p.nrm.length === n ? p.nrm : new Float32Array(n);
  for (let i = 0; i + 8 < n; i += 9) {
    const ok = p.nrm.length === n && [0, 3, 6].every(k => p.nrm[i + k] || p.nrm[i + k + 1] || p.nrm[i + k + 2]);
    if (ok) continue;
    const f = flaeche(p.pos, i);
    for (const k of [0, 3, 6]) { out[i + k] = f[0]; out[i + k + 1] = f[1]; out[i + k + 2] = f[2]; }
  }
  p.nrm = out;
}
function flaeche(P, i) {
  const ax = P[i + 3] - P[i], ay = P[i + 4] - P[i + 1], az = P[i + 5] - P[i + 2];
  const bx = P[i + 6] - P[i], by = P[i + 7] - P[i + 1], bz = P[i + 8] - P[i + 2];
  let x = ay * bz - az * by, y = az * bx - ax * bz, z = ax * by - ay * bx;
  const l = Math.hypot(x, y, z);
  return l * l > 1e-20 ? [x / l, y / l, z / l] : [0, 1, 0];
}

// ───────────────────────── Matrizen (Spalten-Reihenfolge wie glTF) ─────────────────────────

const EINS = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function mal(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1];
}
function punkt(m, x, y, z) { return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; }
/** Normalenmatrix = Inverse-Transponierte des 3×3-Teils. */
function normalMatrix(m) {
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1;
  return [A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det];
}
function richtung(n, x, y, z) {
  const v = [n[0] * x + n[1] * y + n[2] * z, n[3] * x + n[4] * y + n[5] * z, n[6] * x + n[7] * y + n[8] * z];
  const l = Math.hypot(...v); return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 1, 0];
}

// ───────────────────────── GLB / glTF ─────────────────────────

function gltf(bytes, neben) {
  let json, bin = null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 12 && dv.getUint32(0, true) === 0x46546c67) {
    let o = 12;
    while (o + 8 <= bytes.length) {
      const len = dv.getUint32(o, true), typ = dv.getUint32(o + 4, true);
      const daten = bytes.subarray(o + 8, o + 8 + len);
      if (typ === 0x4e4f534a) json = JSON.parse(text(daten)); else if (typ === 0x004e4942) bin = daten;
      o += 8 + len;
    }
  } else json = JSON.parse(text(bytes));
  if (!json) throw new FormatFehler("GLB ohne JSON-Teil.");
  const pflicht = json.extensionsRequired || [];
  for (const x of ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_meshopt_compression"])
    if (pflicht.includes(x)) throw new FormatFehler(`Komprimierte GLB (${x}) öffnet nur die App.`);

  const puffer = (json.buffers || []).map((b, i) => {
    if (b.uri === undefined) return bin;
    if (b.uri.startsWith("data:")) return dataUri(b.uri);
    const d = neben.get(decodeURIComponent(b.uri).split("/").pop().toLowerCase());
    if (!d) throw new FormatFehler(`glTF braucht die Datei „${b.uri}“ – mit hineinziehen oder als GLB speichern.`);
    return d;
  });
  const sicht = i => { const v = json.bufferViews[i]; const p = puffer[v.buffer || 0]; return { b: p.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength), stride: v.byteStride || 0 }; };
  const anzahl = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const groesse = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  function lies(ai) {
    const a = json.accessors[ai], k = anzahl[a.type], g = groesse[a.componentType], out = new Float32Array(a.count * k);
    const norm = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] || 1 : 1;
    const wert = (d, o) => {
      switch (a.componentType) {
        case 5120: return Math.max(d.getInt8(o) / norm, -1); case 5121: return d.getUint8(o) / norm;
        case 5122: return Math.max(d.getInt16(o, true) / norm, -1); case 5123: return d.getUint16(o, true) / norm;
        case 5125: return d.getUint32(o, true); default: return d.getFloat32(o, true);
      }
    };
    if (a.bufferView !== undefined) {
      const { b, stride } = sicht(a.bufferView), d = new DataView(b.buffer, b.byteOffset, b.byteLength), s = stride || k * g, o0 = a.byteOffset || 0;
      for (let i = 0; i < a.count; i++) for (let j = 0; j < k; j++) out[i * k + j] = wert(d, o0 + i * s + j * g);
    }
    if (a.sparse) {
      const sp = a.sparse, iv = sicht(sp.indices.bufferView), vv = sicht(sp.values.bufferView);
      const id = new DataView(iv.b.buffer, iv.b.byteOffset + (sp.indices.byteOffset || 0)), vd = new DataView(vv.b.buffer, vv.b.byteOffset + (sp.values.byteOffset || 0));
      const ig = groesse[sp.indices.componentType];
      for (let i = 0; i < sp.count; i++) {
        const idx = ig === 1 ? id.getUint8(i) : ig === 2 ? id.getUint16(i * 2, true) : id.getUint32(i * 4, true);
        for (let j = 0; j < k; j++) out[idx * k + j] = wert(vd, (i * k + j) * g);
      }
    }
    return out;
  }

  const m = { format: "GLB/glTF", parts: [], notes: [], animationen: (json.animations || []).length };
  const teile = new Map(), texturen = new Map(), uvTf = new Map();
  function textur(ti) {
    if (texturen.has(ti)) return texturen.get(ti);
    const t = json.textures?.[ti]; let res = null;
    const src = t?.source ?? t?.extensions?.EXT_texture_webp?.source ?? t?.extensions?.KHR_texture_basisu?.source;
    const img = src !== undefined ? json.images?.[src] : null;
    if (img) {
      if (img.bufferView !== undefined) res = { bytes: sicht(img.bufferView).b.slice(), mime: img.mimeType || "image/png" };
      else if (img.uri?.startsWith("data:")) res = { bytes: dataUri(img.uri), mime: img.uri.slice(5, img.uri.indexOf(";")) };
      else if (img.uri) { const d = neben.get(decodeURIComponent(img.uri).split("/").pop().toLowerCase()); if (d) res = { bytes: d, mime: /\.jpe?g$/i.test(img.uri) ? "image/jpeg" : "image/png" }; }
    }
    texturen.set(ti, res); return res;
  }
  function teilFuer(mi) {
    if (teile.has(mi)) return teile.get(mi);
    const mat = mi >= 0 ? json.materials?.[mi] : null;
    const t = new Teil(mat?.name || "Material");
    if (mat) {
      t.alpha = (mat.alphaMode || "OPAQUE").toLowerCase(); t.cutoff = mat.alphaCutoff ?? 0.5;
      const sg = mat.extensions?.KHR_materials_pbrSpecularGlossiness;
      const pbr = mat.pbrMetallicRoughness || {};
      t.base = (sg ? sg.diffuseFactor : pbr.baseColorFactor) || [1, 1, 1, 1];
      const ti = sg ? sg.diffuseTexture : pbr.baseColorTexture;
      if (ti) {
        t.tex = textur(ti.index);
        if (!t.tex) m.notes.push(`Textur von „${t.name}“ nicht lesbar.`);
        const tt = ti.extensions?.KHR_texture_transform;
        if (tt) {
          const r = tt.rotation || 0, [sx, sy] = tt.scale || [1, 1], [ox, oy] = tt.offset || [0, 0], co = Math.cos(r), si = Math.sin(r);
          uvTf.set(t, [co * sx, -si * sx, si * sy, co * sy, ox, oy]);
        }
      }
    }
    teile.set(mi, t); m.parts.push(t); return t;
  }

  const szene = json.scenes?.[json.scene ?? 0];
  const besuchen = (ni, eltern) => {
    const n = json.nodes[ni], welt = mal(eltern, trs(n));
    if (n.mesh !== undefined) {
      const nm = normalMatrix(welt);
      for (const prim of json.meshes[n.mesh].primitives) {
        const modus = prim.mode ?? 4;
        if (modus < 4 || prim.attributes.POSITION === undefined) continue;
        const P = lies(prim.attributes.POSITION), N = prim.attributes.NORMAL !== undefined ? lies(prim.attributes.NORMAL) : null;
        const U = prim.attributes.TEXCOORD_0 !== undefined ? lies(prim.attributes.TEXCOORD_0) : null;
        const cA = prim.attributes.COLOR_0 !== undefined ? json.accessors[prim.attributes.COLOR_0] : null;
        const C = cA ? lies(prim.attributes.COLOR_0) : null, ck = cA ? anzahl[cA.type] : 0;
        let idx = prim.indices !== undefined ? lies(prim.indices) : Float32Array.from({ length: P.length / 3 }, (_, i) => i);
        if (modus === 5) { const o = []; for (let i = 0; i + 2 < idx.length; i++) i % 2 ? o.push(idx[i + 1], idx[i], idx[i + 2]) : o.push(idx[i], idx[i + 1], idx[i + 2]); idx = o; }
        else if (modus === 6) { const o = []; for (let i = 1; i + 1 < idx.length; i++) o.push(idx[0], idx[i], idx[i + 1]); idx = o; }
        const t = teilFuer(prim.material ?? -1);
        for (let i = 0; i + 2 < idx.length; i += 3) for (let k = 0; k < 3; k++) {
          const v = idx[i + k];
          t.P.push(...punkt(welt, P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
          t.N.push(...(N ? richtung(nm, N[v * 3], N[v * 3 + 1], N[v * 3 + 2]) : [0, 0, 0]));
          t.U.push(U ? U[v * 2] : 0, U ? U[v * 2 + 1] : 0);
          t.C.push(...(C ? [C[v * ck], C[v * ck + 1], C[v * ck + 2], ck === 4 ? C[v * ck + 3] : 1] : [1, 1, 1, 1]));
        }
      }
    }
    for (const c of n.children || []) besuchen(c, welt);
  };
  for (const ni of szene?.nodes || []) besuchen(ni, EINS);

  m.parts = m.parts.map(t => {
    // wie Loaders.cs: Farben nur, wenn echte Farben; UV nur mit Textur; deckendes BLEND → opaque
    let allNull = true, allEins = true;
    for (let i = 0; i < t.C.length; i++) { if (t.C[i] !== 0) allNull = false; if (t.C[i] !== 1) allEins = false; }
    if (allNull || allEins) t.C = [];
    if (!t.tex) t.U = [];
    else if (uvTf.has(t)) { const [a, b, c, d, e, f] = uvTf.get(t); for (let i = 0; i < t.U.length; i += 2) { const x = t.U[i], y = t.U[i + 1]; t.U[i] = x * a + y * c + e; t.U[i + 1] = x * b + y * d + f; } }
    let deckend = true; for (let i = 3; i < t.C.length; i += 4) if (t.C[i] < 0.999) { deckend = false; break; }
    if (t.alpha === "blend" && t.base[3] >= 0.999 && !t.tex && deckend) t.alpha = "opaque";
    return abschliessen(t);
  });
  const blend = m.parts.filter(p => p.alpha === "blend").length;
  if (blend) m.notes.push(`${blend} halbtransparente(s) Material(ien).`);
  if (m.animationen) m.notes.push(`${m.animationen} Animation(en) – im Browser wird die Ruhepose gezeigt, abspielen in der App.`);
  return m;
}

function dataUri(u) {
  const k = u.indexOf(","), b64 = u.slice(0, k).includes(";base64");
  const s = u.slice(k + 1);
  if (!b64) return new TextEncoder().encode(decodeURIComponent(s));
  const bin = atob(s), o = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i);
  return o;
}

// ───────────────────────── OBJ (+MTL) ─────────────────────────

function obj(bytes, neben) {
  const m = { format: "OBJ", parts: [], notes: [], animationen: 0 };
  const pos = [], nrm = [], uv = [], mtls = new Map(), teile = new Map();
  const teil = name => {
    if (teile.has(name)) return teile.get(name);
    const t = new Teil(name), mt = mtls.get(name);
    if (mt) { t.base = mt.farbe; t.tex = mt.tex; if (mt.farbe[3] < 0.999) t.alpha = "blend"; }
    teile.set(name, t); m.parts.push(t); return t;
  };
  let cur = teil("Standard"), normaleFehlt = false;
  const ix = (s, n) => { const i = parseInt(s, 10); return i < 0 ? n + i : i - 1; };
  for (const raw of text(bytes).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === "#") continue;
    const t = line.split(/\s+/);
    switch (t[0]) {
      case "v": pos.push([+t[1], +t[2], +t[3]]); break;
      case "vn": nrm.push([+t[1], +t[2], +t[3]]); break;
      case "vt": uv.push([+t[1], t.length > 2 ? 1 - +t[2] : 0]); break;
      case "mtllib": {
        const name = line.slice(6).trim(), d = neben.get(name.split(/[\\/]/).pop().toLowerCase());
        if (d) mtl(d, mtls, neben); else m.notes.push(`MTL fehlt: ${name} (mit hineinziehen für Farben)`);
        break;
      }
      case "usemtl": cur = teil(line.slice(6).trim()); break;
      case "f": {
        const idx = t.slice(1).map(s => { const p = s.split("/"); return [ix(p[0], pos.length), p[1] ? ix(p[1], uv.length) : -1, p[2] ? ix(p[2], nrm.length) : -1]; });
        for (let i = 1; i + 1 < idx.length; i++) for (const x of [idx[0], idx[i], idx[i + 1]]) {
          if (x[2] < 0) normaleFehlt = true;
          cur.P.push(...pos[x[0]]); cur.N.push(...(x[2] >= 0 ? nrm[x[2]] : [0, 0, 0])); cur.U.push(...(x[1] >= 0 ? uv[x[1]] : [0, 0]));
        }
        break;
      }
    }
  }
  void normaleFehlt; // fehlende Normalen füllt normalenSicher() wie FillFlatNormals
  m.parts = m.parts.map(t => { if (!t.tex) t.U = []; return abschliessen(t); });
  return m;
}
function mtl(bytes, mtls, neben) {
  let name = null, farbe = [1, 1, 1, 1], tex = null;
  const flush = () => { if (name !== null) mtls.set(name, { farbe, tex }); };
  for (const raw of text(bytes).split(/\r?\n/)) {
    const line = raw.trim(), t = line.split(/\s+/);
    if (!t[0]) continue;
    if (t[0] === "newmtl") { flush(); name = line.slice(6).trim(); farbe = [0.8, 0.8, 0.8, 1]; tex = null; }
    else if (t[0] === "Kd" && t.length >= 4) farbe = [+t[1], +t[2], +t[3], farbe[3]];
    else if (t[0] === "d" && t.length >= 2) farbe = [farbe[0], farbe[1], farbe[2], +t[1]];
    else if (t[0] === "map_Kd") {
      const d = neben.get(t[t.length - 1].split(/[\\/]/).pop().toLowerCase());
      if (d) { tex = { bytes: d, mime: /\.jpe?g$/i.test(t[t.length - 1]) ? "image/jpeg" : "image/png" }; farbe = [1, 1, 1, farbe[3]]; }
    }
  }
  flush();
}

// ───────────────────────── STL ─────────────────────────

function stl(bytes, name) {
  const t = new Teil(name.replace(/\.[^.]+$/, ""), GRAU.slice());
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tri = (a, b, c) => {
    t.P.push(...a, ...b, ...c);
    const n = flaeche([...a, ...b, ...c], 0); t.N.push(...n, ...n, ...n);
  };
  if (bytes.length >= 84 && 84 + 50 * dv.getUint32(80, true) === bytes.length) {
    const n = dv.getUint32(80, true);
    const v = o => [dv.getFloat32(o, true), dv.getFloat32(o + 4, true), dv.getFloat32(o + 8, true)];
    for (let i = 0; i < n; i++) { const o = 84 + i * 50; tri(v(o + 12), v(o + 24), v(o + 36)); }
  } else {
    let verts = [];
    for (const raw of new TextDecoder("ascii").decode(bytes).split("\n")) {
      const s = raw.trim().split(/\s+/);
      if (s.length === 4 && s[0] === "vertex") verts.push([+s[1], +s[2], +s[3]]);
      else if (s[0] === "endloop") { for (let i = 1; i + 1 < verts.length; i++) tri(verts[0], verts[i], verts[i + 1]); verts = []; }
    }
  }
  return { format: "STL", parts: [abschliessen(t)], notes: ["STL hat keine Einheit und oft Z oben – bei Bedarf mit „Aufrichten“ drehen."], animationen: 0 };
}

// ───────────────────────── 3MF (ZIP + XML) ─────────────────────────

async function entpacken(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let e = bytes.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new FormatFehler("3MF ist keine gültige ZIP-Datei.");
  const n = dv.getUint16(e + 10, true); let o = dv.getUint32(e + 16, true);
  const dateien = new Map();
  for (let i = 0; i < n; i++) {
    const art = dv.getUint16(o + 10, true), gr = dv.getUint32(o + 20, true), nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), kl = dv.getUint16(o + 32, true), lo = dv.getUint32(o + 42, true);
    const name = text(bytes.subarray(o + 46, o + 46 + nl));
    dateien.set(name.replace(/^\//, ""), { art, gr, lo });
    o += 46 + nl + xl + kl;
  }
  return async name => {
    const f = dateien.get(name); if (!f) return null;
    const s = f.lo + 30 + dv.getUint16(f.lo + 26, true) + dv.getUint16(f.lo + 28, true);
    const roh = bytes.subarray(s, s + f.gr);
    if (f.art === 0) return roh;
    if (f.art !== 8) throw new FormatFehler("3MF mit unbekannter Kompression.");
    const strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(strom).arrayBuffer());
  };
}
const attr = (s, n) => { const m = s.match(new RegExp("\\s" + n + "\\s*=\\s*\"([^\"]*)\"")); return m ? m[1] : null; };
/** Elemente <name …> mit Attributtext; Kinder über den Bereich bis </name> (einfacher Leser für 3MF). */
function elemente(xml, name) {
  const out = [], re = new RegExp("<(?:\\w+:)?" + name + "(\\s[^>]*?)?(/?)>", "g");
  let m;
  while ((m = re.exec(xml))) {
    let inhalt = "";
    if (!m[2]) { const ende = xml.indexOf("</", re.lastIndex), zu = new RegExp("</(?:\\w+:)?" + name + ">", "g"); zu.lastIndex = re.lastIndex; const z = zu.exec(xml); inhalt = xml.slice(re.lastIndex, z ? z.index : ende); }
    out.push({ a: m[1] || "", inhalt });
  }
  return out;
}
function hexFarbe(s) {
  if (!s || s.length < 7 || s[0] !== "#") return GRAU.slice();
  const c = o => Math.pow(parseInt(s.substr(o, 2), 16) / 255, 2.2);
  return [c(1), c(3), c(5), s.length >= 9 ? parseInt(s.substr(7, 2), 16) / 255 : 1];
}
async function dreiMf(bytes) {
  const hol = await entpacken(bytes);
  let ziel = "3D/3dmodel.model";
  const rels = await hol("_rels/.rels");
  if (rels) for (const r of elemente(text(rels), "Relationship")) if ((attr(r.a, "Type") || "").endsWith("/3dmodel")) ziel = attr(r.a, "Target").replace(/^\//, "");
  const roh = await hol(ziel);
  if (!roh) throw new FormatFehler("3MF ohne 3D-Modell.");
  const xml = text(roh);
  const unitM = xml.match(/<model[^>]*\sunit\s*=\s*"([^"]+)"/);
  const unit = { micron: 1e-6, centimeter: 0.01, inch: 0.0254, foot: 0.3048, meter: 1 }[unitM?.[1]] ?? 0.001;
  const farben = new Map();
  for (const g of elemente(xml, "basematerials")) farben.set(attr(g.a, "id"), elemente(g.inhalt, "base").map(b => hexFarbe(attr(b.a, "displaycolor"))));
  for (const g of elemente(xml, "colorgroup")) farben.set(attr(g.a, "id"), elemente(g.inhalt, "color").map(b => hexFarbe(attr(b.a, "color"))));
  const objekte = new Map(elemente(xml, "object").map(o => [attr(o.a, "id"), o]));
  const nachsehen = (pid, index) => { const l = pid != null ? farben.get(pid) : null; if (l && l.length) return l[Math.min(Math.max(index != null ? +index : 0, 0), l.length - 1)]; return GRAU.slice(); };
  // Z oben → Y oben, Einheit → m (gleich wie zToY in Loaders.cs: (x, y, z) → (x, z, -y))
  const zToY = [unit, 0, 0, 0, 0, 0, -unit, 0, 0, unit, 0, 0, 0, 0, 0, 1];
  const tf = s => { if (!s) return EINS; const v = s.trim().split(/\s+/).map(Number); return v.length === 12 ? [v[0], v[1], v[2], 0, v[3], v[4], v[5], 0, v[6], v[7], v[8], 0, v[9], v[10], v[11], 1] : EINS; };
  const teile = new Map(), m = { format: "3MF", parts: [], notes: [], animationen: 0 };
  const emit = (id, mat, tiefe) => {
    const obj = objekte.get(id); if (!obj || tiefe > 16) return;
    const objFarbe = nachsehen(attr(obj.a, "pid"), attr(obj.a, "pindex"));
    const netz = elemente(obj.inhalt, "mesh")[0];
    if (netz) {
      const v = elemente(netz.inhalt, "vertex").map(e => punkt(mat, +attr(e.a, "x"), +attr(e.a, "y"), +attr(e.a, "z")));
      for (const t of elemente(netz.inhalt, "triangle")) {
        const pid = attr(t.a, "pid"), c = pid != null ? nachsehen(pid, attr(t.a, "p1")) : objFarbe, key = c.join(",");
        if (!teile.has(key)) { const tl = new Teil(`Farbe ${teile.size + 1}`, c); tl.alpha = c[3] < 0.999 ? "blend" : "opaque"; teile.set(key, tl); m.parts.push(tl); }
        teile.get(key).P.push(...v[+attr(t.a, "v1")], ...v[+attr(t.a, "v2")], ...v[+attr(t.a, "v3")]);
      }
    }
    for (const k of elemente(obj.inhalt, "component")) emit(attr(k.a, "objectid"), mal(mat, tf(attr(k.a, "transform"))), tiefe + 1);
  };
  const items = elemente(xml, "item");
  if (!items.length) for (const id of objekte.keys()) emit(id, zToY, 0);
  for (const it of items) emit(attr(it.a, "objectid"), mal(zToY, tf(attr(it.a, "transform"))), 0);
  m.parts = m.parts.map(abschliessen);
  return m;
}

// ───────────────────────── Netz für den Renderer (MeshExport.Build) ─────────────────────────

/** Drehung in 90°-Schritten um X (Aufrichten: Z oben → Y oben = −90°). */
export function drehungX(schritte) {
  const a = -schritte * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a));
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

function base64(bytes) {
  let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return typeof btoa === "function" ? btoa(s) : Buffer.from(bytes).toString("base64");
}

/** Netz im Format des Widgets (v 1): min, size, parts[pos Int16, nrm Int8, uv Float32, col RGBA8, base, alpha, cutoff, tex]. */
export function netz(model, drehung = EINS) {
  const nm = normalMatrix(drehung);
  const welt = model.parts.map(p => { const o = new Float32Array(p.pos.length); for (let i = 0; i < p.pos.length; i += 3) o.set(punkt(drehung, p.pos[i], p.pos[i + 1], p.pos[i + 2]), i); return o; });
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const w of welt) for (let i = 0; i < w.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], w[i + k]); max[k] = Math.max(max[k], w[i + k]); }
  const size = [0, 1, 2].map(k => Math.max(max[k] - min[k], 1e-6));
  const texCache = new Map();
  const parts = model.parts.map((p, pi) => {
    const n = p.pos.length / 3, w = welt[pi];
    const pos = new Uint8Array(n * 6), pv = new DataView(pos.buffer), nrm = new Uint8Array(n * 3), nv = new Int8Array(nrm.buffer);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) pv.setInt16(i * 6 + k * 2, Math.max(-32768, Math.min(32767, Math.round((w[i * 3 + k] - min[k]) / size[k] * 65535 - 32768))), true);
      const d = richtung(nm, p.nrm[i * 3], p.nrm[i * 3 + 1], p.nrm[i * 3 + 2]);
      for (let k = 0; k < 3; k++) nv[i * 3 + k] = Math.max(-127, Math.min(127, Math.round(d[k] * 127)));
    }
    const o = { pos, nrm, base: p.base.slice(), alpha: p.alpha, cutoff: p.cutoff };
    if (p.col) { const c = new Uint8Array(n * 4); for (let i = 0; i < c.length; i++) c[i] = Math.max(0, Math.min(255, Math.round(p.col[i] * 255))); o.col = c; }
    if (p.tex && p.uv) {
      o.uv = new Uint8Array(p.uv.buffer.slice(p.uv.byteOffset, p.uv.byteOffset + p.uv.byteLength));
      if (!texCache.has(p.tex)) texCache.set(p.tex, base64(p.tex.bytes));
      o.tex = texCache.get(p.tex);
    }
    return o;
  });
  return { v: 1, min, size, parts };
}
