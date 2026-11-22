// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 22.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Aufbau in 2D (Logo-Werkstatt, Ansicht „Aufbau“): die fünf Bauteile liegen verstreut, man räumt sie per Ziehen auf.
// Logik = aufbau-kern.js (dieselbe wie in 3D), hier nur Zeichnen (SVG, Seitenansicht) und Zeiger. Der Stupa dreht sich nicht.
//
//   const a = aufbau2d(svg, { bau, stupa, farben, an, onStatus(text), onTippen(i), onFertig() });
//   a.verstreuen(); a.farben(farben, an); a.loesung(); a.stopp();
// bau   = [{ form, element, r: [x, y, b, h], d }]  (Pfade im 1000er-Feld, y nach unten – wie BAU in logo-werkstatt.js)
// stupa = [{ k, unten }]                           (Massstab je Teil und Höhe der Unterkante im fertigen Stupa, Fundament = 1)
import { Aufbau } from "./aufbau-kern.js?v=1";

const NS = "http://www.w3.org/2000/svg";
const BREITE = 5.4, HOEHE = 5, S = 1000 / BREITE, Y0 = 968;      // Welt → SVG: 1 Einheit = 185 px, Boden bei y = 968
const el = (n, a = {}) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
const ruhig = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

// Umriss und Kreise eines Bauteils in Welt-Einheiten, Ursprung = Mitte unten (dort, wo es im Stupa aufsitzt)
function teil(b, i, lage, svg) {
  const k = lage.k, unten = b.r[1] + b.r[3], L = (px, py) => [(px - 500) * k, (unten - py) * k];
  const t = { name: b.form + " · " + b.element, ziel: { x: 0, y: lage.unten, a: 0 } };
  if (b.form === "Viereck") { t.umriss = [L(0, 1000), L(1000, 1000), L(1000, 0), L(0, 0)]; t.symmetrie = 4; return t; }
  // übrige Formen: Pfad abtasten (gleicher Pfad wie gezeichnet)
  const p = el("path", { d: b.d, fill: "none" }); svg.appendChild(p);
  const n = 72, len = p.getTotalLength(), pts = [];
  for (let j = 0; j < n; j++) { const q = p.getPointAtLength(len * j / n); pts.push(L(q.x, q.y)); }
  p.remove();
  t.umriss = pts;
  if (b.form === "Kreis") { t.kreis = [0, 500 * k, 500 * k]; t.symmetrie = 0; }
  if (b.form === "Mond") {
    // dünne Schale: Kreise entlang der Mittellinie zwischen äusserem Bogen (r 500) und innerem (500 × 360), Radius = halbe Dicke
    t.kreise = [];
    for (let j = 0; j <= 28; j++) {
      const w = Math.PI * j / 28, s = 500 * Math.sin(w), r = Math.max(14, 0.14 * s);
      t.kreise.push([...L(500 + 500 * Math.cos(w), 500 + 0.86 * s), r * k]);
    }
  }
  return t;
}

export function aufbau2d(svg, o = {}) {
  const bau = o.bau, an = (o.an || bau.map(() => 1)).slice();
  let farben = (o.farben || bau.map(b => b.farbe)).slice();
  svg.setAttribute("viewBox", "0 0 1000 1000");
  svg.replaceChildren();
  svg.style.touchAction = "none";
  const status = t => { if (o.onStatus) o.onStatus(t); };

  const spiel = new Aufbau({
    breite: BREITE, hoehe: HOEHE, teile: bau.map((b, i) => Object.assign(teil(b, i, o.stupa[i], svg), { an: !!an[i] })),
    onEinrasten: () => melde(), onFertig: () => { melde(); if (o.onFertig) o.onFertig(); }
  });

  // Bühne: Boden, Platz-Markierung, Geist des nächsten Teils, die Teile
  svg.appendChild(el("rect", { x: 0, y: Y0, width: 1000, height: 1000 - Y0, fill: "#1F1E1D", opacity: ".55" }));
  svg.appendChild(el("line", { x1: 0, y1: Y0, x2: 1000, y2: Y0, stroke: "#4A4A46", "stroke-width": 3 }));
  svg.appendChild(el("line", { x1: 500 - 0.5 * S, y1: Y0 + 12, x2: 500 + 0.5 * S, y2: Y0 + 12, stroke: "#8E8C86", "stroke-width": 4, "stroke-linecap": "round", opacity: ".6" }));
  const geist = el("g", { "pointer-events": "none" }), geistPfad = el("path", { fill: "none", "stroke-width": 18, "stroke-dasharray": "40 30", "stroke-linejoin": "round", "vector-effect": "none" });
  geist.appendChild(geistPfad); svg.appendChild(geist);
  const gs = bau.map((b, i) => {
    const g = el("g", { "data-i": i, style: "cursor:grab" }), p = el("path", { d: b.d, "stroke-width": 22, "stroke-linejoin": "round" });
    const t = el("title"); t.textContent = b.form + " · " + b.element; p.appendChild(t); g.appendChild(p); svg.appendChild(g); return g;
  });
  const tf = (i, x, y, a) => `translate(${(500 + x * S).toFixed(1)} ${(Y0 - y * S).toFixed(1)}) rotate(${(-a * 180 / Math.PI).toFixed(2)}) scale(${(o.stupa[i].k * S).toFixed(5)}) translate(-500 -${bau[i].r[1] + bau[i].r[3]})`;

  function faerben() {
    gs.forEach((g, i) => {
      const f = farben[i], p = g.firstChild, leer = !f || f === "none";
      p.setAttribute("fill", leer ? "transparent" : f); p.setAttribute("fill-opacity", ".9");
      p.style.stroke = leer ? "#8E8C86" : `color-mix(in srgb, ${f} 62%, #fff)`;
      g.style.display = an[i] ? "" : "none";
    });
  }
  function melde() {
    if (spiel.fertig) return status("Der Stupa steht. Antippen färbt ein Teil, „Neu verstreuen“ beginnt von vorn.");
    const n = spiel.naechstes(); if (n < 0) return status("");
    status(`Als Nächstes: ${bau[n].form} · ${bau[n].element} – zieh es auf den gestrichelten Platz.`);
  }
  function zeichnen() {
    const P = spiel.posen();
    P.forEach(q => { gs[q.i].setAttribute("transform", tf(q.i, q.x, q.y, q.a)); gs[q.i].style.cursor = q.gegriffen ? "grabbing" : "grab"; });
    const n = spiel.naechstes();
    if (n >= 0 && !spiel.fertig) {
      const z = o.stupa[n], nah = P[n].nah;
      geistPfad.setAttribute("d", bau[n].d); geist.setAttribute("transform", tf(n, 0, z.unten, 0));
      geistPfad.setAttribute("stroke", farben[n] && farben[n] !== "none" ? farben[n] : "#C9C6BF");
      geist.style.opacity = nah ? ".95" : ".38"; geist.style.display = "";
    } else geist.style.display = "none";
  }

  // Bildschleife: läuft nur, solange sich etwas bewegt
  let lauf = 0, zuletzt = 0;
  function bild(t) {
    lauf = 0;
    if (!svg.isConnected) return;
    const dt = zuletzt ? (t - zuletzt) / 1000 : 1 / 60; zuletzt = t;
    spiel.schritt(dt); zeichnen();
    if (!spiel.ruht || spiel.k.some(b => b.rastet)) lauf = requestAnimationFrame(bild); else zuletzt = 0;
  }
  const wecken = () => { if (!lauf) { zuletzt = 0; lauf = requestAnimationFrame(bild); } };

  // Zeiger: greifen, ziehen (Teil hängt und pendelt), loslassen (Schwung bleibt); kurzes Antippen färbt (onTippen)
  const welt = e => {
    const m = svg.getScreenCTM(); if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [(p.x - 500) / S, (Y0 - p.y) / S];
  };
  let zug = null;
  svg.addEventListener("pointerdown", e => {
    if (zug) return;
    const [x, y] = welt(e), px = svg.getBoundingClientRect().width / 1000 * S;   // Bildschirm-px je Einheit
    const i = spiel.greifen(x, y, Math.max(0.08, 18 / px));
    if (i < 0) return;
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch { /* Zeiger schon weg */ }
    zug = { id: e.pointerId, i, x: e.clientX, y: e.clientY, t: performance.now(), weg: 0 };
    melde(); wecken();
  });
  svg.addEventListener("pointermove", e => {
    if (!zug || e.pointerId !== zug.id) return;
    zug.weg = Math.max(zug.weg, Math.hypot(e.clientX - zug.x, e.clientY - zug.y));
    spiel.ziehen(...welt(e)); wecken();
  });
  const los = e => {
    if (!zug || e.pointerId !== zug.id) return;
    const tipp = zug.weg < 6 && performance.now() - zug.t < 350, i = zug.i; zug = null;
    spiel.loslassen(); wecken(); melde();
    if (tipp && o.onTippen) o.onTippen(i);
  };
  svg.addEventListener("pointerup", los); svg.addEventListener("pointercancel", los);

  const api = {
    spiel,
    verstreuen() { spiel.setzeAn(an); spiel.verstreuen(); faerben(); zeichnen(); melde(); if (ruhig()) { for (let j = 0; j < 240; j++) spiel.schritt(1 / 60); zeichnen(); } else wecken(); },
    loesung() { spiel.fertigStellen(); zeichnen(); melde(); },
    farben(f, a) {
      farben = f.slice();
      if (a) { a.forEach((v, j) => { an[j] = v; }); spiel.setzeAn(an); }
      faerben(); zeichnen(); melde(); wecken();
    },
    stopp() { cancelAnimationFrame(lauf); lauf = 0; zuletzt = 0; },
    weiter() { wecken(); }
  };
  faerben();
  return api;
}
