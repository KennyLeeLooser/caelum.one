// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 25.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
// Motion-Fenster, Modellwahl (Wunsch Kenny 25.11.2026: „das Modell im Bild kann gewechselt werden zu einem dickeren Handy
// und einer GLB + GLB einfügen“): 3D-Bühne mit dem Renderer des Caelum 3D-Viewers (apps/viewer/kern.js, WebGL2, ohne Fremd-
// bibliotheken). handy3d() baut ein Handy aus Körpern (Gehäuse, Bildschirm, Kamera, Tasten); eigene GLB/glTF/OBJ/STL/3MF
// lädt laden.js direkt im Browser – die Datei verlässt den Rechner nie. lage(kip, nei) dreht das Modell wie das Handy-Bild.
import { viewerErzeugen } from "../apps/viewer/kern.js";
import { netz, laden } from "../apps/viewer/laden.js";

const farbe = h => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1];

// Quader mit Mitte c und halben Massen h (36 Ecken, flache Normalen)
function quader(c, h) {
  const pos = [], nrm = [];
  const ecke = (sx, sy, sz) => [c[0] + sx * h[0], c[1] + sy * h[1], c[2] + sz * h[2]];
  const seiten = [   // Normale, vier Ecken gegen den Uhrzeigersinn von aussen
    [[1, 0, 0], [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]], [[-1, 0, 0], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1]]],
    [[0, 1, 0], [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1]]], [[0, -1, 0], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1]]],
    [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]];
  for (const [n, q] of seiten) for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...ecke(...q[i])); nrm.push(...n); }
  return { pos, nrm };
}
// Gehäuse mit abgerundeten Ecken (Rundung in der Bildebene x/y, in Stufen angenähert)
function gehaeuse(b, hoch, tief, r, stufen = 6) {
  const pos = [], nrm = [], rand = [];
  const ecken = [[b / 2 - r, hoch / 2 - r, 0], [-b / 2 + r, hoch / 2 - r, 90], [-b / 2 + r, -hoch / 2 + r, 180], [b / 2 - r, -hoch / 2 + r, 270]];
  for (const [cx, cy, a0] of ecken) for (let s = 0; s <= stufen; s++) { const a = (a0 + s * 90 / stufen) * Math.PI / 180; rand.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const z = tief / 2, n = rand.length;
  for (let i = 0; i < n; i++) {
    const p = rand[i], q = rand[(i + 1) % n];
    pos.push(0, 0, z, p[0], p[1], z, q[0], q[1], z); nrm.push(0, 0, 1, 0, 0, 1, 0, 0, 1);                       // vorne
    pos.push(0, 0, -z, q[0], q[1], -z, p[0], p[1], -z); nrm.push(0, 0, -1, 0, 0, -1, 0, 0, -1);                   // hinten
    const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = dy / l, ny = -dx / l;              // Seite
    pos.push(p[0], p[1], -z, q[0], q[1], -z, q[0], q[1], z, p[0], p[1], -z, q[0], q[1], z, p[0], p[1], z);
    for (let k = 0; k < 6; k++) nrm.push(nx, ny, 0);
  }
  return { pos, nrm };
}

/** Das Caelum-Handy als Modell (dick = mehr Tiefe, wie das „Handy dick“). Vorne = +z. */
export function handy3d(dick = true) {
  const B = 0.74, H = 1.56, T = dick ? 0.14 : 0.08, teil = (k, f) => ({ pos: k.pos, nrm: k.nrm, base: farbe(f), alpha: "OPAQUE", cutoff: 0.5 });
  return {
    name: "Caelum Handy", parts: [
      teil(gehaeuse(B, H, T, 0.1), "#4A4A50"),
      teil(quader([0, 0.02, T / 2 + 0.002], [B / 2 - 0.04, H / 2 - 0.07, 0.002]), "#141118"),       // Bildschirm
      teil(quader([0, 0.5, T / 2 + 0.005], [B / 2 - 0.09, 0.09, 0.002]), "#231E2A"),               // App: Titel/Bänke
      teil(quader([-0.15, 0.08, T / 2 + 0.005], [0.13, 0.22, 0.002]), "#B33C88"),                  // gehaltenes Pad
      teil(quader([0.15, 0.08, T / 2 + 0.005], [0.13, 0.22, 0.002]), "#231E2A"),
      teil(quader([0, -0.45, T / 2 + 0.005], [B / 2 - 0.09, 0.06, 0.002]), "#5A5A60"),             // Knopfleiste
      teil(quader([-0.2, 0.6, -T / 2 - 0.02], [0.12, 0.13, 0.02]), "#2B2B30"),                     // Kamera hinten
      teil(quader([B / 2 + 0.008, 0.3, 0], [0.01, 0.12, T / 4]), "#5A5A60"),                       // Lautstärke = Bank
    ],
  };
}

/** 3D-Bühne in `wo`. Rückgabe: { zeigen(modell), datei(File) → Promise, lage(kip, nei), weg() } oder null ohne WebGL2. */
export function modellBuehne(wo) {
  const cv = document.createElement("canvas");
  cv.style.cssText = "width:100%;height:100%;display:block;touch-action:pan-y";
  wo.appendChild(cv);
  const winkel = document.createElement("span"); winkel.hidden = true; wo.appendChild(winkel);
  const state = { yaw: 0, pitch: 0, bg: "dunkel", ortho: false, animation: "", animation_time: 0 };
  const v = viewerErzeugen(id => (id === "gl" ? cv : id === "angle" ? winkel : null), state);
  if (!v.ready) { cv.remove(); winkel.remove(); return null; }
  let offen = false;
  function zeigen(m) {
    v.reorient = false; v.load(netz(m)); v.home(); v.zoom = 1.05; state.yaw = 0; state.pitch = 0; offen = true; v.draw();
  }
  async function datei(f) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const m = await laden([{ name: f.name, bytes }]);
    zeigen(m); return m;
  }
  let warte = 0;
  function lage(kip, nei) {   // wie das Handy-Bild: neigen = um die Hochachse, kippen = vor/zurück
    if (!offen) return;
    state.yaw = nei * 0.8; state.pitch = Math.max(-80, Math.min(80, kip * 0.8));
    if (!warte) warte = requestAnimationFrame(() => { warte = 0; if (cv.isConnected && cv.clientWidth) v.draw(); });
  }
  return { zeigen, datei, lage, weg() { cv.remove(); winkel.remove(); } };
}
