// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – die 3D-Überraschung als Baustein (Master: Rorschach). Genutzt von scan.html (Handy), willkommen.html
// (Startseite mit Beispiel) und Caelum Analyse (Scanner-App, lädt dieses Modul von …/r/ueberraschung.js – verlinkt, nicht kopiert).
// Ablauf (Sekunden): 0–0,9 Karte · 0,9–2,6 Aufsteigen + spiegelgleiche Faltung · 2,6–4,0 Ei · 4,0–5,4 Aufbrechen, Objekt + Botschaft
// · ab 7,4 Aktion des Objekts (Rakete: zündet, startet, kommt zurück). Danach schwebt das Objekt.
// Form „modell“ (Standard, sobald das GLB geladen ist – Idee Kenny 20.11.2026): statt Ei fliegen die Würfel 2,6–4,4 in die
// Form des Modells (Voxel seiner Oberfläche, Farbe aus Material, Vertexfarben und Textur), ab 4,5 schrumpfen sie von unten nach
// oben und lassen das farbige Modell stehen. Ohne GLB oder mit opt.form = "ei" (scan.html?form=ei) bleibt das Ei.
// Sammlung und Logo werden relativ zu diesem Modul geladen, damit es von jeder Seite aus funktioniert.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8). Voxel-Form: KI-Beitrag (Claude, GB-7), 21.11.2026.
import * as QR from "./qr.js";
import * as BEF from "./befehl.js";
import { ink, safe, PAPER, DEEP, fbm } from "./tinte.js";
import { Drei, modell, kasten } from "./drei.js";
import { lesenGlb } from "./glb.js";

const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const out3 = p => 1 - Math.pow(1 - p, 3);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
export const DAUER = 14;                       // danach beginnt eine Schleife von vorn
export const ZEIGEN_AB = 5.2;                  // ab hier Botschaft einblenden

// ------------------------------------------------ Voxel aus dem Modell
function pixel(bild) {
  if (!bild) return null;
  try { const w = Math.min(256, bild.width), h = Math.min(256, bild.height);
    const cv = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
    const g = cv.getContext("2d"); g.drawImage(bild, 0, 0, w, h); return { w, h, d: g.getImageData(0, 0, w, h).data }; } catch { return null; }
}
/** Teile aus glb.js → { vox:[{x,y,z,c,yn}], zelle } mit höchstens `ziel` Voxeln auf der Oberfläche (Modellmaße, Höhe ≈ 1). */
export function voxeln(teile, ziel, hoehe = 1) {
  const N = 36000, pts = [], flaechen = [];
  let A = 0;
  for (const t of teile) { const p = t.pos, ix = t.idx, a = new Float64Array(Math.floor(ix.length / 3));
    for (let f = 0; f < a.length; f++) { const i = ix[f * 3] * 3, j = ix[f * 3 + 1] * 3, k = ix[f * 3 + 2] * 3;
      const ux = p[j] - p[i], uy = p[j + 1] - p[i + 1], uz = p[j + 2] - p[i + 2], vx = p[k] - p[i], vy = p[k + 1] - p[i + 1], vz = p[k + 2] - p[i + 2];
      a[f] = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx); A += a[f]; }
    flaechen.push(a); }
  if (!(A > 0)) return null;
  let acc = 0, done = 0, z = 0;
  for (let ti = 0; ti < teile.length; ti++) {
    const t = teile[ti], a = flaechen[ti], p = t.pos, px = t.uv ? pixel(t.bild) : null, fb = t.farbe || [1, 1, 1, 1];
    for (let f = 0; f < a.length; f++) {
      acc += a[f] / A * N; const n = Math.floor(acc) - done; done += n;
      const I = [t.idx[f * 3], t.idx[f * 3 + 1], t.idx[f * 3 + 2]];
      for (let m = 0; m < n; m++, z++) {
        const sq = Math.sqrt(hash(z, 1.3)), r2 = hash(z, 7.9), w = [1 - sq, sq * (1 - r2), sq * r2];
        let x = 0, y = 0, zz = 0, r = fb[0], g = fb[1], b = fb[2];
        for (let q = 0; q < 3; q++) { x += p[I[q] * 3] * w[q]; y += p[I[q] * 3 + 1] * w[q]; zz += p[I[q] * 3 + 2] * w[q]; }
        if (t.col) { let cr = 0, cg = 0, cb = 0; for (let q = 0; q < 3; q++) { cr += t.col[I[q] * 3] * w[q]; cg += t.col[I[q] * 3 + 1] * w[q]; cb += t.col[I[q] * 3 + 2] * w[q]; } r *= cr; g *= cg; b *= cb; }
        if (px) { let u = 0, v = 0; for (let q = 0; q < 3; q++) { u += t.uv[I[q] * 2] * w[q]; v += t.uv[I[q] * 2 + 1] * w[q]; }
          const X = Math.min(px.w - 1, Math.floor((u - Math.floor(u)) * px.w)), Y = Math.min(px.h - 1, Math.floor((v - Math.floor(v)) * px.h)), o = (Y * px.w + X) * 4;
          r *= px.d[o] / 255; g *= px.d[o + 1] / 255; b *= px.d[o + 2] / 255; }
        pts.push(x, y, zz, r, g, b);
      }
    }
  }
  const zellen = c => { const mp = new Map();
    for (let i = 0; i < pts.length; i += 6) { const X = Math.floor(pts[i] / c), Y = Math.floor(pts[i + 1] / c), Z = Math.floor(pts[i + 2] / c), key = (X + 512) * 1048576 + (Y + 512) * 1024 + (Z + 512);
      let e = mp.get(key); if (!e) mp.set(key, e = [X, Y, Z, 0, 0, 0, 0]);
      e[3] += pts[i + 3]; e[4] += pts[i + 4]; e[5] += pts[i + 5]; e[6]++; }
    return mp; };
  // kleinste Zelle mit ≤ ziel Voxeln (nicht dichter, als die Stichprobe trägt – sonst entstehen Löcher)
  const max = Math.min(ziel, Math.floor(pts.length / 6 / 6));
  let lo = 0.004, hi = 0.5, best = null;
  for (let it = 0; it < 18; it++) { const c = Math.sqrt(lo * hi), mp = zellen(c);
    if (mp.size <= max) { best = { c, mp }; hi = c; } else lo = c; }
  if (!best) return null;
  const c = best.c, vox = [];
  for (const e of best.mp.values()) vox.push({ x: (e[0] + .5) * c, y: (e[1] + .5) * c, z: (e[2] + .5) * c,
    c: [e[3] / e[6], e[4] / e[6], e[5] / e[6]].map(v => Math.min(1, v)), yn: clamp((e[1] + .5) * c / (hoehe || 1)) });
  vox.sort((a, b) => b.y - a.y || a.x - b.x || a.z - b.z);
  return { vox, zelle: c };
}

let katalogCache = null;
export async function katalog() {
  if (!katalogCache) katalogCache = fetch(new URL("sammlung/katalog.json", import.meta.url)).then(r => r.json()).then(k => k.objekte || []).catch(() => []);
  return katalogCache;
}

/**
 * Spielt eine Überraschung auf einer Leinwand.
 * opt.adresse   gescannte Adresse (aus ihr wird der Code als Würfel nachgebaut)
 * opt.befehl    schon geöffneter Befehl {objekt, farbe, botschaft} (R2: Analyse entschlüsselt vorher); sonst aus der Adresse (R1)
 * opt.schleife  nach DAUER von vorn beginnen (Startseite)
 * opt.still     nur ein Standbild zu dieser Zeit (Selbsttest)
 * opt.zeigen(an) wird gerufen, wenn die Botschaft erscheinen bzw. verschwinden soll
 * opt.rand()   {oben, unten} in Pixeln, die Texte und Knöpfe verdecken – das Objekt wird in die freie Fläche dazwischen eingepasst
 *              (Wunsch Kenny 24.11.2026: Hoch- und Querformat zentrieren sich von selbst); ohne: ganze Leinwand
 * opt.fuellen  Anteil der freien Fläche, den das Objekt füllt (Standard 0,74)
 * Rückgabe: { befehl, objekt, stand, neu(), stop() } – wirft, wenn kein Rorschach-Befehl oder kein WebGL2.
 */
export async function spielen(canvas, opt) {
  const r = opt.befehl ? { ok: true, u: opt.befehl } : BEF.lesen(opt.adresse);
  if (!r.ok) throw Object.assign(new Error(r.fehler), { art: "befehl" });
  const u = r.u, pal = BEF.FARBEN[u.farbe] || "caelum";
  const obj = (await katalog()).find(o => o.id === u.objekt) || null;
  const stand = { befehl: u, objekt: obj?.name ?? null, webgl: false, glb: false, wuerfel: 0, version: 0, form: "ei", voxel: 0 };
  const q = QR.encode(opt.adresse) || QR.encode("#" + BEF.hash(u));
  stand.version = q.v;
  let drei;
  try { drei = new Drei(canvas); stand.webgl = true; } catch { throw Object.assign(new Error("Dieses Gerät kann kein WebGL2."), { art: "webgl", befehl: u, objekt: obj }); }

  // ------------------------------------------------ Würfel vorbereiten
  const K = 2.4, n = q.n, s = K / n, alle = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.m[y][x]) {
    const c = { x: (x + .5) / n * K - K / 2, y: K / 2 - (y + .5) / n * K, gx: x, gy: y };
    alle.push({ ...c, zw: 1 }); alle.push({ ...c, x: -c.x, zw: -1 });          // jedes Pixel + Spiegelzwilling (Rorschach)
  }
  const M = alle.length, ei = [];
  for (let i = 0; i < M; i++) { const yy = 1 - 2 * (i + .5) / M, rr = Math.sqrt(1 - yy * yy), a = i * 2.399963;
    ei.push({ x: Math.cos(a) * rr * 0.74 * (1 - 0.13 * yy), y: yy * 1.0 - 0.05, z: Math.sin(a) * rr * 0.74 * (1 - 0.13 * yy) }); }
  const ord = alle.map((c, i) => i).sort((a, b) => alle[b].y - alle[a].y || alle[a].x - alle[b].x);
  ord.forEach((ci, k) => { alle[ci].ei = ei[k]; alle[ci].seed = hash(Math.abs(alle[ci].x) * 31, alle[ci].y * 17); });
  const eiGroesse = Math.sqrt(4 * Math.PI * 0.8 / M) * 1.15;
  const FLAMME = 90, daten = new Float32Array((M + FLAMME) * 8);
  stand.wuerfel = M;
  const dunkel = c => safe(ink(pal, c.gx * 1.5, c.gy * 1.5, 12, 0.5)).map(v => v / 255);
  const hell = (c, t) => ink(pal, Math.abs(c.x) * 40, c.y * 40, t * 2, 0.95).map(v => Math.min(1, v / 255 * 1.25));
  for (const c of alle) c.d = dunkel(c);

  // ------------------------------------------------ Objekt aus der Sammlung
  let netzObjekt = -1, form = null, glbTeile = null;
  const S = 1.35;                                                   // Maßstab des Objekts in der Szene
  if (obj?.datei) { try { const g = await lesenGlb(await (await fetch(new URL("sammlung/" + obj.datei, import.meta.url))).arrayBuffer()); netzObjekt = drei.netz(g.teile); stand.glb = true; glbTeile = g.teile;
    if (opt.form !== "ei") { try { form = voxeln(g.teile, M, g.hoehe); } catch (e) { stand.voxelFehler = String(e); } } } catch (e) { stand.glbFehler = String(e); } }
  if (form) { stand.form = "modell"; stand.voxel = form.vox.length;
    ord.forEach((ci, k) => { alle[ci].vox = form.vox[Math.floor(k * form.vox.length / M)]; }); }
  const voxGroesse = form ? form.zelle * S * 1.04 : 0;
  // Hülle des Objekts in der Szene (für die Kamera): Höhe ab dem Fuß und größter Abstand von der Drehachse
  const OY = -0.86;                                                  // Fuß des Objekts (oy ohne Schweben/Start)
  let huelle = { unten: -1.1, oben: 1.0, r: 1.0 };                   // Ei (ohne GLB): Schale + Splitter
  if (netzObjekt >= 0 && glbTeile) { let r = 0, h = 0;
    for (const t of glbTeile) for (let v = 0; v < t.pos.length; v += 3) { r = Math.max(r, Math.hypot(t.pos[v], t.pos[v + 2])); h = Math.max(h, t.pos[v + 1]); }
    const m = { unten: OY, oben: OY + h * S, r: r * S + (form ? voxGroesse / 2 : 0) };
    huelle = form ? m : { unten: Math.min(m.unten, huelle.unten), oben: Math.max(m.oben, huelle.oben), r: Math.max(m.r, huelle.r) }; }
  stand.huelle = huelle;
  let randCache = null, randZeit = -1;
  const rand = now => { if (!opt.rand) return { oben: 0, unten: 0 };
    if (now - randZeit > 400 || !randCache) { try { randCache = opt.rand() || { oben: 0, unten: 0 }; } catch { randCache = { oben: 0, unten: 0 }; } randZeit = now; }
    return randCache; };
  const netzPapier = drei.netz(kasten(K + 8 * s, K + 8 * s, 0.04, [PAPER[0] / 255, PAPER[1] / 255, PAPER[2] / 255, 1]));
  const raketenStart = obj?.aktion === "starten";

  // ------------------------------------------------ Bedienung: ziehen = drehen
  let t0 = performance.now(), dreh = 0, ziehen = null, gezeigt = false, laeuft = true;
  canvas.addEventListener("pointerdown", e => { ziehen = { x: e.clientX, d: dreh }; try { canvas.setPointerCapture(e.pointerId); } catch { } });
  canvas.addEventListener("pointermove", e => { if (ziehen) dreh = ziehen.d + (e.clientX - ziehen.x) * 0.01; });
  canvas.addEventListener("pointerup", () => ziehen = null);
  const zeigen = an => { if (an !== gezeigt) { gezeigt = an; opt.zeigen?.(an); } };

  function bild(T) {
    let k = 0;
    const so = form ? (T > 4.45 ? 1 : 0) : out3(clamp((T - 4.2) / 1.1)), schwebe = form ? 1 : so;
    let oy = -0.98 + 0.12 * schwebe, flammen = 0;
    if (raketenStart && T > 7.4) {
      const a = T - 7.8;
      if (a > 0 && T < 10.6) oy += a * a * 0.9;
      else if (T >= 10.6 && T < 12.8) oy += 7.06 * Math.pow(1 - ease((T - 10.6) / 2.2), 2);
      flammen = T < 10.6 ? 1 : T < 12.8 ? 0.5 : 0;
    }
    if (T > 12.8 || !raketenStart) oy += Math.sin(T * 1.6) * 0.03 * schwebe;
    const th = T * 0.6 + dreh, ct = Math.cos(th), st = Math.sin(th);
    const spin = (Math.min(T, 4.0) - 2.6) > 0 ? (Math.min(T, 4.0) - 2.6) * 0.9 : 0;
    for (const c of alle) {
      const b = clamp((T - 0.9 - c.seed * 0.35) / 1.2), bb = clamp((T - 1.0) / 1.5);
      const th = Math.sin(Math.PI * bb) * 1.15 * (1 - 0.25 * c.seed), lift = 0.55 * ease(b);
      let x = c.x * Math.cos(th), y = c.y + Math.sin(bb * Math.PI * 2) * 0.08 * Math.abs(c.x), z = lift + Math.abs(c.x) * Math.sin(th) * 0.9;
      let size = s * 0.92 * (c.zw > 0 ? 1 : out3(clamp((T - 1.0 - c.seed * 0.3) / 0.7)));
      const col = c.d, glanz = clamp((T - 1.0) / 1.0), hc = hell(c, T);
      let farbe = [0, 1, 2].map(i => col[i] + (hc[i] - col[i]) * glanz);
      if (form) {
        // Würfel fliegen in die Form des Modells, dann schrumpfen sie von unten nach oben und das Modell bleibt
        const v = c.vox, e = ease(clamp((T - 2.6 - c.seed * 0.5) / 1.3));
        let rot = 0;
        if (e > 0) { const tx = (ct * v.x + st * v.z) * S, tz = (-st * v.x + ct * v.z) * S, ty = oy + v.y * S;
          x += (tx - x) * e; y += (ty - y) * e + Math.sin(Math.PI * e) * 0.3 * (0.5 + c.seed * 0.5); z += (tz - z) * e;
          size += (voxGroesse - size) * e; rot = th * e; farbe = farbe.map((f, i) => f + (v.c[i] - f) * e); }
        const r = ease(clamp((T - 4.5 - v.yn * 0.7) / 0.6));
        if (r > 0) { const l = Math.hypot(x, z) || 1; x += x / l * r * 0.12; z += z / l * r * 0.12; size *= 1 - r; }
        daten.set([x, y, z, Math.max(0, size), farbe[0], farbe[1], farbe[2], rot], k * 8); k++;
        continue;
      }
      const e = ease(clamp((T - 2.6 - c.seed * 0.3) / 1.1));
      if (e > 0) { const ca = Math.cos(spin), sa = Math.sin(spin), ex = c.ei.x * ca - c.ei.z * sa, ez = c.ei.x * sa + c.ei.z * ca;
        x += (ex - x) * e; y += (c.ei.y - y) * e; z += (ez - z) * e; size += (eiGroesse - size) * e; }
      const riss = -0.02 + 0.16 * Math.sin(Math.atan2(z, x) * 7);
      if (T > 4.0) {
        const d = ease(clamp((T - 4.0) / 1.0));
        if (c.ei.y > riss) { const side = x < 0 ? -1 : 1, px = side * 0.6, py = riss, ang = -side * d * 2.0;
          const rx = x - px, ry = y - py, X = px + rx * Math.cos(ang) - ry * Math.sin(ang), Y = py + rx * Math.sin(ang) + ry * Math.cos(ang);
          x = X + side * d * 0.55; y = Y + d * 0.25; z = z - d * 0.25; size *= 1 - clamp((T - 5.6) / 1.4); }
        else { const f = ease(clamp((T - 5.4) / 1.8)), w = 1 + f * (0.9 + 0.6 * fbm(Math.abs(x) * 3, z * 3, 2)); x *= w; z *= w; y += (-1.06 - y) * f; }
      }
      daten.set([x, y, z, size, farbe[0], farbe[1], farbe[2], spin * e], k * 8); k++;
    }
    for (let f = 0; f < FLAMME; f++) {
      const age = ((T * 2.6 + f / FLAMME) % 1), r1 = hash(f, 3) - .5, r2 = hash(f, 9) - .5, on = flammen && T > 7.4 ? 1 : 0;
      daten.set([r1 * age * 0.5, oy - age * 0.9, r2 * age * 0.5, on * (1 - age) * 0.085, 1, 0.62 - age * 0.35, 0.3 + age * 0.4, age * 5], k * 8); k++;
    }
    drei.wuerfelSetzen(daten, k);
    const papier = 1 - ease(clamp((T - 0.9) / 1.3)), auftritte = [];
    if (papier > 0.01) auftritte.push({ netz: netzPapier, M: modell(0, 0, -0.08, 0, papier, 0) });
    if (netzObjekt >= 0 && so > 0.001) auftritte.push({ netz: netzObjekt, M: modell(0, oy, 0, th, form ? S * (0.97 + 0.03 * ease(clamp((T - 4.45) / 1.2))) : S * so) });
    // Kamera: zuerst so weit, dass Karte und Flügel (Breite ≈ 3,4) ganz zu sehen sind; ab 2,2 s gleitet sie auf das Objekt
    // und passt es in die freie Fläche ein – im Hoch- wie im Querformat mittig und groß (Wunsch Kenny 24.11.2026)
    const W = canvas.clientWidth || innerWidth, H = canvas.clientHeight || innerHeight, asp = W / H, fov = asp < 1 ? 0.95 : 0.7, tf = Math.tan(fov / 2);
    const R0 = Math.max(4.6, 1.75 / (tf * Math.min(asp, 1.4)));
    const rd = rand(performance.now()); stand.rand = rd;
    const li = rd.links || 0, re = rd.rechts || 0;
    const frei = clamp((H - rd.oben - rd.unten) / H, 0.25, 1), yc = 1 - (rd.oben + (H - rd.unten)) / H;   // Mitte der freien Fläche (NDC)
    const freiB = clamp((W - li - re) / W, 0.25, 1), xc = (li + (W - re)) / W - 1;
    const fu = opt.fuellen || 0.74, hh = (huelle.oben - huelle.unten) / 2, ym = (huelle.oben + huelle.unten) / 2;
    const Rfit = Math.max(hh / (tf * frei * fu), huelle.r / (tf * asp * freiB * fu), huelle.r * 2 + 0.6) + huelle.r;
    const cam = ease(clamp((T - 2.2) / 2.0)), az = dreh * 0.35;
    const start = raketenStart && T > 7.6 && T < 11, R = R0 + (Rfit - R0) * cam + (raketenStart ? 0.8 * clamp((T - 7.6) / 1.5) * (T < 11 ? 1 : 0) : 0);
    const zy = (ym - yc * R * tf) * cam + (start ? Math.min(2.2, Math.max(0, oy + 0.4) * 0.45) : 0);
    const sx = -xc * R * tf * asp * cam, rx = Math.cos(az) * sx, rz = -Math.sin(az) * sx;            // seitlich schieben (Botschaft rechts)
    drei.zeichnen({ auge: [Math.sin(az) * R + rx, zy + 0.15 + cam * 0.16 * R, Math.cos(az) * R + rz],   // gleicher Blickwinkel von oben, egal wie weit
      ziel: [rx, zy, rz], hg: (opt.hg || DEEP).map(v => v / 255), auftritte });
    zeigen(T > ZEIGEN_AB);
  }

  if (opt.still != null) { bild(opt.still);                          // nach dem Einsetzen der Botschaft den freien Platz neu messen
    requestAnimationFrame(() => requestAnimationFrame(() => { randCache = null; bild(opt.still); })); }
  else {
    const lauf = now => { if (!laeuft) return; let T = (now - t0) / 1000;
      if (opt.schleife && T > DAUER) { t0 = now; T = 0; dreh = 0; }
      bild(T); requestAnimationFrame(lauf); };
    requestAnimationFrame(lauf);
  }
  return { befehl: u, objekt: obj, stand, neu() { t0 = performance.now(); dreh = 0; zeigen(false); }, stop() { laeuft = false; } };
}
