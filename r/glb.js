// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – kleiner GLB-Leser für die Überraschung: Knoten-Hierarchie (TRS/Matrix), Dreiecke, Normalen,
// Vertexfarben, baseColorFactor und baseColorTexture. Alles wird in Weltkoordinaten gebacken und auf Höhe 1 normiert
// (Fuß auf y = 0, Mitte auf x = z = 0). Kein fremder Code.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
const KOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const TYP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NORM = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

export function m4() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
export function mul4(a, b) { const r = new Array(16);
  for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + rr] * b[c * 4 + k]; r[c * 4 + rr] = s; } return r; }
function trs(n) {
  if (n.matrix) return n.matrix.slice();
  const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
          2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
          2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
}

/** ArrayBuffer einer .glb → { teile:[{pos, nrm, col, uv, idx, farbe, bild}], box } */
export async function lesenGlb(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error("Keine GLB-Datei.");
  let off = 12, json = null, bin = null;
  while (off < buf.byteLength) { const len = dv.getUint32(off, true), typ = dv.getUint32(off + 4, true);
    if (typ === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, len)));
    else if (typ === 0x004E4942) bin = buf.slice(off + 8, off + 8 + len);
    off += 8 + len; }
  const gl = json, bilder = new Map();
  const zugriff = i => { const a = gl.accessors[i], bv = gl.bufferViews[a.bufferView], T = TYP[a.componentType], k = KOMP[a.type];
    const stride = bv.byteStride || k * T.BYTES_PER_ELEMENT, start = (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float32Array(a.count * k);
    const d = new DataView(bin), get = { 5120: "getInt8", 5121: "getUint8", 5122: "getInt16", 5123: "getUint16", 5125: "getUint32", 5126: "getFloat32" }[a.componentType];
    for (let e = 0; e < a.count; e++) for (let c = 0; c < k; c++) { let v = d[get](start + e * stride + c * T.BYTES_PER_ELEMENT, true); if (a.normalized && NORM[a.componentType]) v /= NORM[a.componentType]; out[e * k + c] = v; }
    return { d: out, k }; };
  async function bild(texIdx) {
    if (texIdx == null || !gl.textures) return null; const src = gl.textures[texIdx]?.source; if (src == null) return null;
    if (bilder.has(src)) return bilder.get(src);
    const im = gl.images[src]; if (im.bufferView == null) return null; const bv = gl.bufferViews[im.bufferView];
    const p = createImageBitmap(new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: im.mimeType || "image/png" }), { imageOrientation: "none" }).catch(() => null);
    bilder.set(src, p); return p;
  }
  const teile = [], lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  async function knoten(i, eltern) {
    const n = gl.nodes[i], w = mul4(eltern, trs(n));
    if (n.mesh != null) for (const pr of gl.meshes[n.mesh].primitives) {
      if ((pr.mode ?? 4) !== 4 || pr.attributes.POSITION == null) continue;
      const P = zugriff(pr.attributes.POSITION).d, cnt = P.length / 3, pos = new Float32Array(cnt * 3), nrm = new Float32Array(cnt * 3);
      const N = pr.attributes.NORMAL != null ? zugriff(pr.attributes.NORMAL).d : null;
      for (let v = 0; v < cnt; v++) { const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        for (let r = 0; r < 3; r++) { pos[v * 3 + r] = w[r] * x + w[4 + r] * y + w[8 + r] * z + w[12 + r]; lo[r] = Math.min(lo[r], pos[v * 3 + r]); hi[r] = Math.max(hi[r], pos[v * 3 + r]); }
        if (N) { const a = N[v * 3], b = N[v * 3 + 1], c = N[v * 3 + 2]; let nx = w[0] * a + w[4] * b + w[8] * c, ny = w[1] * a + w[5] * b + w[9] * c, nz = w[2] * a + w[6] * b + w[10] * c;
          const l = Math.hypot(nx, ny, nz) || 1; nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = nz / l; } }
      let idx = pr.indices != null ? Uint32Array.from(zugriff(pr.indices).d) : Uint32Array.from({ length: cnt }, (_, k) => k);
      if (!N) for (let t = 0; t + 2 < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]];
        const ux = pos[b * 3] - pos[a * 3], uy = pos[b * 3 + 1] - pos[a * 3 + 1], uz = pos[b * 3 + 2] - pos[a * 3 + 2], vx = pos[c * 3] - pos[a * 3], vy = pos[c * 3 + 1] - pos[a * 3 + 1], vz = pos[c * 3 + 2] - pos[a * 3 + 2];
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; for (const q of [a, b, c]) { nrm[q * 3] += nx; nrm[q * 3 + 1] += ny; nrm[q * 3 + 2] += nz; } }
      let col = null; if (pr.attributes.COLOR_0 != null) { const C = zugriff(pr.attributes.COLOR_0); col = new Float32Array(cnt * 3); for (let v = 0; v < cnt; v++) for (let r = 0; r < 3; r++) col[v * 3 + r] = C.d[v * C.k + r]; }
      const uv = pr.attributes.TEXCOORD_0 != null ? zugriff(pr.attributes.TEXCOORD_0).d : null;
      const mat = pr.material != null ? gl.materials[pr.material] : {}, pbr = mat.pbrMetallicRoughness || {};
      teile.push({ pos, nrm, col, uv, idx, farbe: pbr.baseColorFactor || [1, 1, 1, 1], bild: uv ? await bild(pbr.baseColorTexture?.index) : null });
    }
    for (const k of n.children || []) await knoten(k, w);
  }
  const szene = gl.scenes?.[gl.scene ?? 0]?.nodes ?? gl.nodes.map((_, i) => i);
  for (const i of szene) await knoten(i, m4());
  // normieren: Höhe 1, Fuß auf 0, Mitte auf der Achse
  const h = Math.max(hi[1] - lo[1], (hi[0] - lo[0]) * 0.8, (hi[2] - lo[2]) * 0.8) || 1, cx = (lo[0] + hi[0]) / 2, cz = (lo[2] + hi[2]) / 2;
  for (const t of teile) for (let v = 0; v < t.pos.length; v += 3) { t.pos[v] = (t.pos[v] - cx) / h; t.pos[v + 1] = (t.pos[v + 1] - lo[1]) / h; t.pos[v + 2] = (t.pos[v + 2] - cz) / h; }
  return { teile, hoehe: (hi[1] - lo[1]) / h };
}
