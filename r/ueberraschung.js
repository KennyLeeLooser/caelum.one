// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – die 3D-Überraschung als Baustein (Master: Rorschach). Genutzt von scan.html (Handy), willkommen.html
// (Startseite mit Beispiel) und Caelum Analyse (Scanner-App, lädt dieses Modul von …/r/ueberraschung.js – verlinkt, nicht kopiert).
// Ablauf (Sekunden): 0–0,9 Karte · 0,9–2,6 Aufsteigen + spiegelgleiche Faltung · 2,6–4,0 Ei · 4,0–5,4 Aufbrechen, Objekt + Botschaft
// · ab 7,4 Aktion des Objekts (Rakete: zündet, startet, kommt zurück). Danach schwebt das Objekt.
// Sammlung und Logo werden relativ zu diesem Modul geladen, damit es von jeder Seite aus funktioniert.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
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

let katalogCache = null;
export async function katalog() {
  if (!katalogCache) katalogCache = fetch(new URL("sammlung/katalog.json", import.meta.url)).then(r => r.json()).then(k => k.objekte || []).catch(() => []);
  return katalogCache;
}

/**
 * Spielt eine Überraschung auf einer Leinwand.
 * opt.adresse   gescannte Adresse (aus ihr wird der Code als Würfel nachgebaut)
 * opt.schleife  nach DAUER von vorn beginnen (Startseite)
 * opt.still     nur ein Standbild zu dieser Zeit (Selbsttest)
 * opt.zeigen(an) wird gerufen, wenn die Botschaft erscheinen bzw. verschwinden soll
 * Rückgabe: { befehl, objekt, stand, neu(), stop() } – wirft, wenn kein Rorschach-Befehl oder kein WebGL2.
 */
export async function spielen(canvas, opt) {
  const r = BEF.lesen(opt.adresse);
  if (!r.ok) throw Object.assign(new Error(r.fehler), { art: "befehl" });
  const u = r.u, pal = BEF.FARBEN[u.farbe] || "caelum";
  const obj = (await katalog()).find(o => o.id === u.objekt) || null;
  const stand = { befehl: u, objekt: obj?.name ?? null, webgl: false, glb: false, wuerfel: 0, version: 0 };
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
  let netzObjekt = -1;
  if (obj?.datei) { try { const g = await lesenGlb(await (await fetch(new URL("sammlung/" + obj.datei, import.meta.url))).arrayBuffer()); netzObjekt = drei.netz(g.teile); stand.glb = true; } catch (e) { stand.glbFehler = String(e); } }
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
    const spin = (Math.min(T, 4.0) - 2.6) > 0 ? (Math.min(T, 4.0) - 2.6) * 0.9 : 0;
    for (const c of alle) {
      const b = clamp((T - 0.9 - c.seed * 0.35) / 1.2), bb = clamp((T - 1.0) / 1.5);
      const th = Math.sin(Math.PI * bb) * 1.15 * (1 - 0.25 * c.seed), lift = 0.55 * ease(b);
      let x = c.x * Math.cos(th), y = c.y + Math.sin(bb * Math.PI * 2) * 0.08 * Math.abs(c.x), z = lift + Math.abs(c.x) * Math.sin(th) * 0.9;
      let size = s * 0.92 * (c.zw > 0 ? 1 : out3(clamp((T - 1.0 - c.seed * 0.3) / 0.7)));
      const col = c.d, glanz = clamp((T - 1.0) / 1.0);
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
      const hc = hell(c, T);
      daten.set([x, y, z, size, col[0] + (hc[0] - col[0]) * glanz, col[1] + (hc[1] - col[1]) * glanz, col[2] + (hc[2] - col[2]) * glanz, spin * e], k * 8); k++;
    }
    const so = out3(clamp((T - 4.2) / 1.1));
    let oy = -0.98 + 0.12 * so, flammen = 0;
    if (raketenStart && T > 7.4) {
      const a = T - 7.8;
      if (a > 0 && T < 10.6) oy += a * a * 0.9;
      else if (T >= 10.6 && T < 12.8) oy += 7.06 * Math.pow(1 - ease((T - 10.6) / 2.2), 2);
      flammen = T < 10.6 ? 1 : T < 12.8 ? 0.5 : 0;
    }
    if (T > 12.8 || !raketenStart) oy += Math.sin(T * 1.6) * 0.03 * so;
    for (let f = 0; f < FLAMME; f++) {
      const age = ((T * 2.6 + f / FLAMME) % 1), r1 = hash(f, 3) - .5, r2 = hash(f, 9) - .5, on = flammen && T > 7.4 ? 1 : 0;
      daten.set([r1 * age * 0.5, oy - age * 0.9, r2 * age * 0.5, on * (1 - age) * 0.085, 1, 0.62 - age * 0.35, 0.3 + age * 0.4, age * 5], k * 8); k++;
    }
    drei.wuerfelSetzen(daten, k);
    const papier = 1 - ease(clamp((T - 0.9) / 1.3)), auftritte = [];
    if (papier > 0.01) auftritte.push({ netz: netzPapier, M: modell(0, 0, -0.08, 0, papier, 0) });
    if (netzObjekt >= 0 && so > 0.001) auftritte.push({ netz: netzObjekt, M: modell(0, oy, 0, T * 0.6 + dreh, 1.35 * so) });
    // Kamera: Abstand so, dass Karte und Flügel (Breite ≈ 3,4) auch im Hochformat ganz zu sehen sind
    const asp = (canvas.clientWidth || innerWidth) / (canvas.clientHeight || innerHeight), fov = asp < 1 ? 0.95 : 0.7;
    const R0 = Math.max(4.6, 1.75 / (Math.tan(fov / 2) * Math.min(asp, 1.4)));
    const cam = ease(clamp((T - 2.2) / 2.0)), az = dreh * 0.35, R = R0 * (1 + cam * 0.08) + (raketenStart ? 0.8 * clamp((T - 7.6) / 1.5) * (T < 11 ? 1 : 0) : 0);
    const zy = -0.55 * ease(clamp((T - 4.0) / 1.4)) + (raketenStart && T > 7.6 && T < 11 ? Math.min(2.2, Math.max(0, oy + 0.4) * 0.45) : 0);
    drei.zeichnen({ auge: [Math.sin(az) * R, 0.15 + cam * 0.9 + zy, Math.cos(az) * R], ziel: [0, zy, 0], hg: (opt.hg || DEEP).map(v => v / 255), auftritte });
    zeigen(T > ZEIGEN_AB);
  }

  if (opt.still != null) bild(opt.still);
  else {
    const lauf = now => { if (!laeuft) return; let T = (now - t0) / 1000;
      if (opt.schleife && T > DAUER) { t0 = now; T = 0; dreh = 0; }
      bild(T); requestAnimationFrame(lauf); };
    requestAnimationFrame(lauf);
  }
  return { befehl: u, objekt: obj, stand, neu() { t0 = performance.now(); dreh = 0; zeigen(false); }, stop() { laeuft = false; } };
}
