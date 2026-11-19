// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – kleiner WebGL2-Renderer für die Scan-Seite: viele Würfel als Instanzen (Position, Größe, Farbe, Drehung)
// und Netze aus der GLB-Sammlung (Vertexfarben, Grundfarbe, Textur). Eigener Code, keine fremde Bibliothek.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
import { mul4 } from "./glb.js";

const VS_WUERFEL = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec4 iPS; in vec4 iCR;
uniform mat4 uVP;
out vec3 vN; out vec3 vC; out vec3 vW;
void main(){ float a=iCR.w; mat3 R=mat3(cos(a),0.,-sin(a), 0.,1.,0., sin(a),0.,cos(a));
  vec3 p=R*(aPos*iPS.w)+iPS.xyz; vN=R*aNrm; vC=iCR.rgb; vW=p; gl_Position=uVP*vec4(p,1.); }`;
const VS_NETZ = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec3 aCol; in vec2 aUV;
uniform mat4 uVP; uniform mat4 uM;
out vec3 vN; out vec3 vC; out vec3 vW; out vec2 vUV;
void main(){ vec4 w=uM*vec4(aPos,1.); vN=mat3(uM)*aNrm; vC=aCol; vW=w.xyz; vUV=aUV; gl_Position=uVP*w; }`;
const LICHT = `
uniform vec3 uL; uniform vec3 uEye;
vec3 licht(vec3 c, vec3 nn, vec3 w){ vec3 n=normalize(nn); float d=max(dot(n,uL),0.); float d2=max(dot(n,normalize(vec3(-.5,.25,.7))),0.)*.32;
  float up=n.y*.5+.5; vec3 v=normalize(uEye-w); float rim=pow(1.-max(dot(n,v),0.),3.)*.16;
  return c*(.30+.62*d+d2+.10*up)+rim; }`;
const FS_WUERFEL = `#version 300 es
precision highp float; in vec3 vN; in vec3 vC; in vec3 vW; out vec4 o;${LICHT}
void main(){ o=vec4(licht(vC,vN,vW),1.); }`;
const FS_NETZ = `#version 300 es
precision highp float; in vec3 vN; in vec3 vC; in vec3 vW; in vec2 vUV; out vec4 o;
uniform vec4 uFarbe; uniform sampler2D uTex; uniform bool uHatTex;${LICHT}
void main(){ vec4 c=uFarbe*vec4(vC,1.); if(uHatTex) c*=texture(uTex,vUV); if(c.a<.4) discard; o=vec4(licht(c.rgb,vN,vW),1.); }`;

// Würfel ±0,5 mit Normalen je Seite
function wuerfel() {
  const p = [], n = [], i = [];
  const seiten = [[0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0]];
  for (const [nx, ny, nz] of seiten) {
    const b = p.length / 3, u = Math.abs(ny) > 0 ? [1, 0, 0] : [0, 1, 0], w = [ny * u[2] - nz * u[1], nz * u[0] - nx * u[2], nx * u[1] - ny * u[0]];
    for (const [s, t] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { p.push(.5 * (nx + s * u[0] + t * w[0]), .5 * (ny + s * u[1] + t * w[1]), .5 * (nz + s * u[2] + t * w[2])); n.push(nx, ny, nz); }
    i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  // Wicklung je Seite prüfen (gegen den Uhrzeigersinn von außen)
  for (let k = 0; k < i.length; k += 3) { const [a, b, c] = [i[k], i[k + 1], i[k + 2]];
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2], vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n[a * 3] + cy * n[a * 3 + 1] + cz * n[a * 3 + 2] < 0) { i[k + 1] = c; i[k + 2] = b; } }
  return { p: new Float32Array(p), n: new Float32Array(n), i: new Uint16Array(i) };
}

export function perspektive(fov, asp, near, far) { const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
  return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]; }
export function blick(e, z, up = [0, 1, 0]) {
  let fx = e[0] - z[0], fy = e[1] - z[1], fz = e[2] - z[2], l = Math.hypot(fx, fy, fz); fx /= l; fy /= l; fz /= l;
  let sx = up[1] * fz - up[2] * fy, sy = up[2] * fx - up[0] * fz, sz = up[0] * fy - up[1] * fx; l = Math.hypot(sx, sy, sz); sx /= l; sy /= l; sz /= l;
  const ux = fy * sz - fz * sy, uy = fz * sx - fx * sz, uz = fx * sy - fy * sx;
  return [sx, ux, fx, 0, sy, uy, fy, 0, sz, uz, fz, 0, -(sx * e[0] + sy * e[1] + sz * e[2]), -(ux * e[0] + uy * e[1] + uz * e[2]), -(fx * e[0] + fy * e[1] + fz * e[2]), 1];
}
export function modell(x, y, z, rotY, s, kipp = 0) {
  const c = Math.cos(rotY), sn = Math.sin(rotY), ck = Math.cos(kipp), sk = Math.sin(kipp);
  const R = [c, 0, -sn, 0, 0, 1, 0, 0, sn, 0, c, 0, 0, 0, 0, 1], K = [1, 0, 0, 0, 0, ck, sk, 0, 0, -sk, ck, 0, 0, 0, 0, 1];
  const M = mul4(R, K); for (let i = 0; i < 12; i++) M[i] *= (i % 4 === 3 ? 1 : s); M[12] = x; M[13] = y; M[14] = z; return M;
}

export class Drei {
  constructor(canvas) {
    const gl = canvas.getContext("webgl2", { antialias: true, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL2 fehlt");
    this.gl = gl; this.cv = canvas; this.netze = [];
    this.pw = this.prog(VS_WUERFEL, FS_WUERFEL); this.pn = this.prog(VS_NETZ, FS_NETZ);
    const w = wuerfel(); this.wn = w.i.length;
    this.vaoW = gl.createVertexArray(); gl.bindVertexArray(this.vaoW);
    this.attr(this.pw, "aPos", w.p, 3); this.attr(this.pw, "aNrm", w.n, 3);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, w.i, gl.STATIC_DRAW);
    this.inst = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.inst);
    for (const [name, off] of [["iPS", 0], ["iCR", 16]]) { const loc = gl.getAttribLocation(this.pw, name); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 32, off); gl.vertexAttribDivisor(loc, 1); }
    gl.bindVertexArray(null);
    this.anzahl = 0;
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
  }
  prog(vs, fs) { const gl = this.gl, p = gl.createProgram();
    for (const [typ, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(typ); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); gl.attachShader(p, s); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; }
  attr(p, name, data, k) { const gl = this.gl, loc = gl.getAttribLocation(p, name); if (loc < 0) return; const b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, k, gl.FLOAT, false, 0, 0); }
  /** data: Float32Array mit je 8 Werten (x, y, z, Größe, r, g, b, Drehung). */
  wuerfelSetzen(data, n) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.inst); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); this.anzahl = n; }
  /** Teile aus glb.js (oder eigene Kästen) hochladen; gibt eine Nummer zurück. */
  netz(teile) {
    const gl = this.gl, liste = [];
    for (const t of teile) {
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      const cnt = t.pos.length / 3;
      this.attr(this.pn, "aPos", t.pos, 3); this.attr(this.pn, "aNrm", t.nrm, 3);
      this.attr(this.pn, "aCol", t.col || new Float32Array(cnt * 3).fill(1), 3);
      this.attr(this.pn, "aUV", t.uv || new Float32Array(cnt * 2), 2);
      const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, t.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      let tex = null;
      if (t.bild) { tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, t.bild);
        gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      liste.push({ vao, n: t.idx.length, farbe: t.farbe, tex });
    }
    this.netze.push(liste); return this.netze.length - 1;
  }
  groesse() { const d = Math.min(2, devicePixelRatio || 1), w = Math.round(this.cv.clientWidth * d), h = Math.round(this.cv.clientHeight * d);
    if (this.cv.width !== w || this.cv.height !== h) { this.cv.width = w; this.cv.height = h; } return w / h; }
  /** Bild zeichnen. auftritte: [{netz, M}] */
  zeichnen({ auge, ziel, hg, auftritte = [] }) {
    const gl = this.gl, asp = this.groesse();
    gl.viewport(0, 0, this.cv.width, this.cv.height);
    gl.clearColor(hg[0], hg[1], hg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const VP = mul4(perspektive(asp < 1 ? 0.95 : 0.7, asp, 0.1, 60), blick(auge, ziel)), L = [0.45, 0.8, 0.55], l = Math.hypot(...L);
    for (const p of [this.pw, this.pn]) { gl.useProgram(p); gl.uniformMatrix4fv(gl.getUniformLocation(p, "uVP"), false, VP);
      gl.uniform3f(gl.getUniformLocation(p, "uL"), L[0] / l, L[1] / l, L[2] / l); gl.uniform3fv(gl.getUniformLocation(p, "uEye"), auge); }
    if (this.anzahl) { gl.useProgram(this.pw); gl.bindVertexArray(this.vaoW); gl.drawElementsInstanced(gl.TRIANGLES, this.wn, gl.UNSIGNED_SHORT, 0, this.anzahl); }
    gl.useProgram(this.pn); gl.disable(gl.CULL_FACE);
    for (const a of auftritte) { gl.uniformMatrix4fv(gl.getUniformLocation(this.pn, "uM"), false, a.M);
      for (const t of this.netze[a.netz]) { gl.uniform4fv(gl.getUniformLocation(this.pn, "uFarbe"), t.farbe);
        gl.uniform1i(gl.getUniformLocation(this.pn, "uHatTex"), t.tex ? 1 : 0);
        if (t.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t.tex); gl.uniform1i(gl.getUniformLocation(this.pn, "uTex"), 0); }
        gl.bindVertexArray(t.vao); gl.drawElements(gl.TRIANGLES, t.n, gl.UNSIGNED_INT, 0); } }
    gl.enable(gl.CULL_FACE); gl.bindVertexArray(null);
  }
}

/** Flacher Kasten als Netz (für das Papier der Karte). */
export function kasten(bx, by, bz, farbe) {
  const w = wuerfel(), pos = new Float32Array(w.p.length);
  for (let i = 0; i < w.p.length; i += 3) { pos[i] = w.p[i] * bx; pos[i + 1] = w.p[i + 1] * by; pos[i + 2] = w.p[i + 2] * bz; }
  return [{ pos, nrm: w.n, col: null, uv: null, idx: Uint32Array.from(w.i), farbe, bild: null }];
}
