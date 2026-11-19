// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// ERZEUGT aus src/Caelum.Viewer.App/Widget/vorschau.html (Master) mit web/werkzeuge/kern.mjs – nicht von Hand ändern.
// Renderer des Widgets als ES-Modul: viewerErzeugen($, state) liefert dasselbe Objekt wie im Widget (load, draw, fit, home, clear).

export const VIEWS = ["Iso", "Vorne", "Rechts", "Hinten", "Links", "Oben"];
export const VIEW_ANGLES = { Iso: [35, 28], Vorne: [0, 0], Rechts: [90, 0], Hinten: [180, 0], Links: [-90, 0], Oben: [0, 89.9] };
export const BG = { hell: [0.93, 0.925, 0.91], weiss: [1, 1, 1], dunkel: [0.149, 0.149, 0.141], schwarz: [0, 0, 0] };

/** $ = id → Element (braucht "gl" = canvas und "angle" = Textfeld), state = { yaw, pitch, bg, ortho, animation, animation_time }. */
export function viewerErzeugen($, state) {
  // ---------- WebGL2-Ansicht
  const viewer = (() => {
    const cv = $("gl");
    // preserveDrawingBuffer: Bild bleibt stehen (Bildschirmfotos/Teilen der Hosts zeigen sonst manchmal ein altes Bild)
    const gl = cv.getContext("webgl2", { antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
    const V = { ready: !!gl, mesh: null, anim: null, dist: 1, zoom: 1 };
    if (!gl) return Object.assign(V, { load: () => false, draw() {}, fit() {}, home() {}, clear() {} });

    const vs = `#version 300 es
      in vec3 aPos; in vec3 aNrm; in vec2 aUv; in vec4 aCol;
      uniform mat4 uMVP; uniform vec3 uMin, uSize;
      out vec3 vW; out vec3 vN; out vec2 vUv; out vec4 vCol;
      void main() {
        vec3 w = uMin + (aPos + 32768.0) / 65535.0 * uSize;
        vW = w; vN = aNrm; vUv = aUv; vCol = aCol;
        gl_Position = uMVP * vec4(w, 1.0);
      }`;
    const fs = `#version 300 es
      precision highp float;
      in vec3 vW; in vec3 vN; in vec2 vUv; in vec4 vCol;
      uniform vec3 uEye, uBack, uKey, uFill; uniform vec4 uBase; uniform bool uHasTex, uHasCol, uOrtho; uniform sampler2D uTex;
      uniform int uMode; uniform float uCutoff;
      out vec4 o;
      void main() {
        vec3 n = length(vN) > 0.001 ? normalize(vN) : vec3(0.0, 1.0, 0.0);
        vec3 toEye = uOrtho ? uBack : normalize(uEye - vW);
        if (dot(n, toEye) < 0.0) n = -n;
        float l = 0.26 + 0.62 * max(0.0, dot(n, uKey)) + 0.22 * max(0.0, dot(n, uFill)) + 0.12 * (n.y * 0.5 + 0.5);
        vec4 c = uBase;
        if (uHasCol) c *= vCol;
        if (uHasTex) { vec4 t = texture(uTex, vUv); c.rgb *= pow(t.rgb, vec3(2.2)); c.a *= t.a; }
        if (uMode == 1 && c.a < uCutoff) discard;
        o = vec4(pow(clamp(c.rgb * l, 0.0, 1.0), vec3(1.0 / 2.2)), uMode == 2 ? c.a : 1.0);
      }`;
    function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(prog, 0, "aPos"); gl.bindAttribLocation(prog, 1, "aNrm"); gl.bindAttribLocation(prog, 2, "aUv"); gl.bindAttribLocation(prog, 3, "aCol");
    gl.linkProgram(prog);
    const U = {}; for (const n of ["uMVP", "uMin", "uSize", "uEye", "uBack", "uKey", "uFill", "uBase", "uHasTex", "uHasCol", "uOrtho", "uTex", "uMode", "uCutoff"]) U[n] = gl.getUniformLocation(prog, n);

    const b64 = s => s instanceof Uint8Array ? s : Uint8Array.from(atob(s), c => c.charCodeAt(0));
    function arrBuf(data) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
    function attr(loc, b, size, type, norm) { gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, type, norm, 0, 0); }
    V.clear = () => {
      for (const p of V.mesh?.parts || []) { gl.deleteVertexArray(p.vao); p.bufs.forEach(b => gl.deleteBuffer(b)); }
      for (const t of V.mesh?.textures?.values() || []) gl.deleteTexture(t);
      V.mesh = null; V.anim = null;
    };
    V.load = mesh => {
      try {
        const keep = V.mesh != null && !V.reorient; // Pose gewechselt: Kamera bleibt; Modell gedreht: neu einpassen
        V.reorient = false;
        V.clear();
        const textures = new Map();
        const min = mesh.min, size = mesh.size, pts = [];
        const total = mesh.parts.reduce((s, p) => s + p.pos.length * 3 / 4 / 6, 0);
        const every = Math.max(1, Math.floor(total / 6000)); // Stichprobe für das Einpassen (Silhouette statt Box)
        const frames = mesh.anim?.frames || null;
        const parts = mesh.parts.map((p, pi) => {
          const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
          const pos = b64(p.pos), bufs = [];
          const i16 = new Int16Array(pos.buffer, 0, pos.length / 2);
          const addPts = arr => { for (let i = 0; i < arr.length; i += 3 * every) pts.push([0, 1, 2].map(k => min[k] + (arr[i + k] + 32768) / 65535 * size[k])); };
          addPts(i16);
          const pb = arrBuf(i16), nb = arrBuf(new Int8Array(b64(p.nrm).buffer));
          bufs.push(pb, nb); attr(0, pb, 3, gl.SHORT, false); attr(1, nb, 3, gl.BYTE, true);
          if (p.uv) { const ub = arrBuf(new Float32Array(b64(p.uv).buffer)); bufs.push(ub); attr(2, ub, 2, gl.FLOAT, false); } else { gl.disableVertexAttribArray(2); gl.vertexAttrib2f(2, 0, 0); }
          if (p.col) { const cb = arrBuf(b64(p.col)); bufs.push(cb); attr(3, cb, 4, gl.UNSIGNED_BYTE, true); } else { gl.disableVertexAttribArray(3); gl.vertexAttrib4f(3, 1, 1, 1, 1); }
          // Animation: je Bild eigene Positionen/Normalen (Farben, UV, Textur bleiben)
          const fb = frames ? frames.map((f, fi) => {
            const fp = new Int16Array(b64(f[pi].pos).buffer); if (fi % 4 === 0) addPts(fp);
            const a = arrBuf(fp), b = arrBuf(new Int8Array(b64(f[pi].nrm).buffer)); bufs.push(a, b); return [a, b];
          }) : null;
          let tex = null;
          if (p.tex) {
            tex = textures.get(p.tex);
            if (!tex) {
              tex = gl.createTexture(); textures.set(p.tex, tex);
              gl.bindTexture(gl.TEXTURE_2D, tex);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
              const im = new Image();
              im.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, tex);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                V.draw();
              };
              im.src = "data:image/png;base64," + p.tex;
            }
          }
          gl.bindVertexArray(null);
          return { vao, bufs, fb, count: pos.length / 6, base: p.base, tex, hasCol: !!p.col, mode: p.alpha === "mask" ? 1 : p.alpha === "blend" ? 2 : 0, cutoff: p.cutoff ?? 0.5 };
        });
        V.mesh = { parts, textures, min, size, pts, center: min.map((m, i) => m + size[i] / 2), radius: Math.hypot(...size) / 2 };
        V.anim = frames ? { name: mesh.anim.name, duration: mesh.anim.duration, count: frames.length } : null;
        if (!keep) V.home();
        return true;
      } catch (e) { console.error(e); V.mesh = null; return false; }
    };
    const FOV = 35 * Math.PI / 180;
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
    const add = (...v) => v.reduce((s, x) => [s[0] + x[0], s[1] + x[1], s[2] + x[2]], [0, 0, 0]);
    const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
    function dirOf(yaw, pitch) {
      const y = yaw * Math.PI / 180, p = Math.max(-89.9, Math.min(89.9, pitch)) * Math.PI / 180;
      return [Math.cos(p) * Math.sin(y), Math.sin(p), Math.cos(p) * Math.cos(y)];
    }
    function basis(back) {
      let right = cross([0, 1, 0], back); right = Math.hypot(...right) < 1e-6 ? [1, 0, 0] : norm(right);
      return { right, up: cross(back, right) };
    }
    // Drehpunkt = Modellmitte, Abstand über die Hüllkugel der Punkte: passt aus jeder Richtung (Standard beim Laden und Drehen)
    V.home = () => {
      const m = V.mesh; if (!m || !m.pts.length) return;
      m.center = m.min.map((v, i) => v + m.size[i] / 2);
      let r = 1e-6; for (const p of m.pts) r = Math.max(r, Math.hypot(...sub(p, m.center)));
      const aspect = cv.clientWidth / Math.max(1, cv.clientHeight) || 1.6;
      const half = Math.min(FOV / 2, Math.atan(Math.tan(FOV / 2) * aspect));
      V.dist = r / Math.sin(half) * 0.98; V.zoom = 1; V.fitted = false;
    };
    // wie Camera.Fit(Punkte): knapp auf die aktuelle Ansicht einpassen („Einpassen“, Doppelklick)
    V.fit = () => {
      const m = V.mesh; if (!m || !m.pts.length) return;
      const back = dirOf(state.yaw, state.pitch), { right, up } = basis(back);
      const aspect = cv.clientWidth / Math.max(1, cv.clientHeight) || 1.6;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of m.pts) {
        const x = dot(p, right), y = dot(p, up), z = dot(p, back);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
      }
      m.center = add(mul(right, (x0 + x1) / 2), mul(up, (y0 + y1) / 2), mul(back, (z0 + z1) / 2));
      const tanV = Math.tan(FOV / 2), tanH = tanV * aspect; let d = 1e-3;
      for (const p of m.pts) {
        const c = sub(p, m.center);
        const x = Math.abs(dot(c, right)) * 1.08, y = Math.abs(dot(c, up)) * 1.08, z = dot(c, back);
        d = Math.max(d, z + x / tanH, z + y / tanV);
      }
      V.dist = d; V.zoom = 1; V.fitted = true;
    };
    function persp(aspect, near, far) {
      const f = 1 / Math.tan(FOV / 2), nf = 1 / (near - far);
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    }
    function orthoM(h, aspect, near, far) {
      const w = h * aspect, nf = 1 / (near - far);
      return [2 / w, 0, 0, 0, 0, 2 / h, 0, 0, 0, 0, 2 * nf, 0, 0, 0, (far + near) * nf, 1];
    }
    function lookAt(eye, target) {
      const z = norm(sub(eye, target)), { right: x, up: y } = basis(z);
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
    }
    function mat(a, b) { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
    // Zeichnen im nächsten Bild; drosselt der Host requestAnimationFrame im iframe, zeichnet ein Zeitgeber
    let raf = 0, timer = 0;
    V.draw = () => {
      if (raf) return;
      raf = requestAnimationFrame(frame);
      timer = setTimeout(frame, 60);
    };
    function frame() {
      cancelAnimationFrame(raf); clearTimeout(timer); raf = 0; timer = 0;
      const m = V.mesh; if (!m) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
      const bg = BG[state.bg] || BG.hell;
      gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const back = dirOf(state.yaw, state.pitch), d = V.dist * V.zoom;
      const eye = add(m.center, mul(back, d));
      const near = Math.max(d - m.radius * 1.05, d * 0.002, m.radius * 1e-4), far = d + m.radius * 1.05;
      const proj = state.ortho ? orthoM(2 * d * Math.tan(FOV / 2), w / h, near, far) : persp(w / h, near, far);
      const mvp = mat(proj, lookAt(eye, m.center));
      const { right, up } = basis(back);
      const key = norm(add(mul(right, -0.45), mul(up, 0.75), mul(back, 0.55)));
      const fill = norm(add(mul(right, 0.65), mul(up, 0.1), mul(back, 0.6)));
      // Animationsbild zur aktuellen Zeit
      let fi = -1;
      if (V.anim && state.animation === V.anim.name && V.anim.duration > 0)
        fi = Math.floor(((state.animation_time % V.anim.duration) / V.anim.duration) * V.anim.count) % V.anim.count;
      gl.useProgram(prog); gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
      gl.uniformMatrix4fv(U.uMVP, false, mvp); gl.uniform3fv(U.uMin, m.min); gl.uniform3fv(U.uSize, m.size);
      gl.uniform3fv(U.uEye, eye); gl.uniform3fv(U.uBack, back); gl.uniform3fv(U.uKey, key); gl.uniform3fv(U.uFill, fill);
      gl.uniform1i(U.uOrtho, state.ortho); gl.uniform1i(U.uTex, 0);
      for (const pass of [0, 1]) {
        if (pass === 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); }
        for (const p of m.parts) {
          if ((p.mode === 2) !== (pass === 1)) continue;
          gl.bindVertexArray(p.vao);
          if (p.fb) { const [pb, nb] = p.fb[Math.max(0, fi)]; attr(0, pb, 3, gl.SHORT, false); attr(1, nb, 3, gl.BYTE, true); }
          gl.uniform4fv(U.uBase, p.base); gl.uniform1i(U.uHasCol, p.hasCol); gl.uniform1i(U.uHasTex, !!p.tex);
          gl.uniform1i(U.uMode, p.mode); gl.uniform1f(U.uCutoff, p.cutoff);
          if (p.tex) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, p.tex); }
          gl.drawArrays(gl.TRIANGLES, 0, p.count);
        }
      }
      gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(null);
      const yaw = ((Math.round(state.yaw) + 540) % 360) - 180;
      $("angle").textContent = `Gieren ${yaw}° · Nicken ${Math.round(state.pitch)}°` + (V.zoom !== 1 ? ` · ${Math.round(100 / V.zoom)} %` : "") + (state.ortho ? " · ortho" : "");
    }
    // Größe ändert sich (Seitenfenster/Vollbild geht auf): neu einpassen, gewählten Zoom behalten
    let lastW = 0, lastH = 0;
    new ResizeObserver(() => {
      const w = cv.clientWidth, h = cv.clientHeight;
      if (V.mesh && w > 0 && h > 0 && (Math.abs(w - lastW) > 2 || Math.abs(h - lastH) > 2)) {
        lastW = w; lastH = h;
        const z = V.zoom; if (V.fitted) V.fit(); else V.home(); V.zoom = z;
      }
      V.draw();
    }).observe(cv);
    return V;
  })();
  
  return viewer;
}
