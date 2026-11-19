// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Gravur · Web-Modul „Schild gestalten“ (CAELUM-STANDARD.md C1). Vorbild: Fenster „Schild bearbeiten“ der App.
// Ein Schild: Material aus dem Katalog der App, Textfelder, Abstände mit Schiebern, Loch, QR, Rahmen, Export SVG für
// xTool Studio. Läuft nur im Browser, nichts wird hochgeladen. Logik in schild.js (Master: SignGeometry.cs/SvgExport.cs).
import { aufbauen, svg, VORGABE, FARBEN } from "./schild.js";
import { koerper, texturMalen, glbSchreiben } from "./glb.js";

const SPEICHER = "caelum.gravur.web.v1";
const BEISPIEL = { code: "S35", zeilen: 3, schrifthoehe: 4, felder: ["LÜF 01", "Abluft Temperatur", "B02"] };
const LOCHTEXT = { Keine: "keine", Links: "links", Rechts: "rechts", Beide: "links und rechts", ObenMitte: "oben Mitte", ObenBeide: "oben links und rechts", VierEcken: "vier Ecken" };

const css = `
.gv-buehne { display:flex; align-items:center; justify-content:center; min-height:180px; padding:20px; }
@media (max-width: 560px) { .gv-buehne { min-height: 0; padding: 12px; } }
.gv-buehne svg { width:100%; height:auto; max-height:360px; filter: drop-shadow(0 4px 10px rgba(0,0,0,.35)); }
.gv-felder { border-radius:10px; padding:8px; display:grid; gap:6px; margin-top:8px; }
.gv-felder textarea { resize:none; text-align:center; font-weight:600; border-radius:8px; padding:6px 8px; overflow:hidden;
  border:1px solid rgba(0,0,0,.25) !important; background:rgba(0,0,0,.42) !important; color:#fff !important; }
.gv-legende { display:flex; flex-wrap:wrap; gap:4px 14px; color:var(--muted); font-size:12.5px; margin-top:8px; }
.gv-mat { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:13px; margin-top:4px; }
.gv-mat i { width:28px; height:16px; border-radius:4px; border:1px solid var(--line); display:inline-block; }
`;

function h(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kinder) if (c != null) e.append(c);
  return e;
}

async function schriftLaden(opentype, url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Schrift fehlt: " + url);
  return opentype.parse(await r.arrayBuffer());
}

export async function mount(root, ctx) {
  const hier = new URL("./", import.meta.url);
  const opentype = import("./vendor/opentype.module.js");
  const [qrMod, katalog, normal, fett] = await Promise.all([
    import("./vendor/qrcode.mjs"),
    fetch(new URL("daten/katalog.json", hier)).then(r => r.json()),
    opentype.then(o => schriftLaden(o, new URL("schriften/arimo-400.woff", hier))),
    opentype.then(o => schriftLaden(o, new URL("schriften/arimo-700.woff", hier))),
  ]);
  const qrcode = qrMod.default;
  qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
  const qr = text => { try { const q = qrcode(0, "M"); q.addData(text, "Byte"); q.make(); return { n: q.getModuleCount(), dunkel: (x, y) => q.isDark(y, x) }; } catch { return null; } };

  // Zustand (letzte Einstellungen nur in diesem Browser)
  let s = { ...VORGABE, ...BEISPIEL };
  try { const alt = JSON.parse(localStorage.getItem(SPEICHER) || "null"); if (alt && typeof alt === "object") s = { ...s, ...alt }; } catch { /* privat */ }
  const merken = () => { try { localStorage.setItem(SPEICHER, JSON.stringify(s)); } catch { /* privat */ } };

  const typ = () => katalog.typen.find(t => t.id === s.typ) || katalog.typen[0];
  const farbe = () => typ().farben.find(f => f.code === s.code) || typ().farben[0];
  let hilfslinien = true;

  root.append(h("style", {}, css));
  const buehne = h("div", { class: "cw-well gv-buehne", role: "img", "aria-label": "Vorschau des Schilds" });
  const felderBox = h("div", { class: "gv-felder" });
  const hinweise = h("ul", { class: "cw-note", "aria-live": "polite" });
  const kopf = h("p", { class: "cw-hint" });
  const matInfo = h("div", { class: "gv-mat" });
  const knopfSvg = h("button", { class: "cw-primary", type: "button", onclick: speichernSvg }, "SVG für den Laser speichern");
  const knopf3d = h("button", { type: "button", onclick: zeige3d }, "Im 3D-Viewer ansehen");
  const legende = h("div", { class: "gv-legende" },
    ...[["gravieren", "Gravieren"], ["schriftUmriss", "Schrift-Umriss"], ["detailSchneiden", "Löcher schneiden"], ["kantenSchneiden", "Kante schneiden"], ["gravieren2", "2. Tiefe"]]
      .map(([k, t]) => h("span", {}, h("i", { class: "cw-dot", style: "background:" + FARBEN[k] }), t)));

  // ── Einstellungen ──
  const steuer = [];          // Funktionen, die Bedienelemente nach Zustandswechsel nachführen
  const neu = () => { merken(); zeichnen(); };

  function schieber(key, text, min, max, step, einheit = "") {
    const out = h("output", {});
    const inp = h("input", { type: "range", min: String(min), max: String(max), step: String(step), "aria-label": text });
    const setze = () => { inp.value = String(s[key]); out.textContent = Number(s[key]).toFixed(step < 1 ? 1 : 0) + einheit; };
    inp.addEventListener("input", () => { s[key] = parseFloat(inp.value); setze(); neu(); });
    steuer.push(setze);
    return h("label", { class: "cw-f" }, h("span", {}, text), inp, out);
  }
  function wahl(key, text, optionen, nach) {
    const sel = h("select", { "aria-label": text });
    const fuellen = () => {
      sel.replaceChildren(...(typeof optionen === "function" ? optionen() : optionen).map(o =>
        o.gruppe ? h("optgroup", { label: o.gruppe }, ...o.liste.map(x => h("option", { value: x.wert }, x.text)))
                 : h("option", { value: o.wert }, o.text)));
      sel.value = String(s[key]);
    };
    sel.addEventListener("change", () => { s[key] = /^-?\d+(\.\d+)?$/.test(sel.value) && typeof s[key] === "number" ? parseFloat(sel.value) : sel.value; if (nach) nach(); neu(); });
    steuer.push(fuellen);
    return h("label", { class: "cw-f cw-2" }, h("span", {}, text), sel);
  }
  function haken(key, text) {
    const inp = h("input", { type: "checkbox" });
    inp.addEventListener("change", () => { s[key] = inp.checked; neu(); steuer.forEach(f => f()); });
    steuer.push(() => { inp.checked = !!s[key]; });
    return h("label", { class: "cw-c" }, inp, text);
  }
  function feld(key, text, platzhalter) {
    const inp = h("input", { type: "text", placeholder: platzhalter || "", "aria-label": text });
    inp.addEventListener("input", () => { s[key] = inp.value; neu(); });
    steuer.push(() => { if (document.activeElement !== inp) inp.value = s[key] ?? ""; });
    return h("label", { class: "cw-f cw-2" }, h("span", {}, text), inp);
  }
  const nurWenn = (key, el) => { steuer.push(() => { el.hidden = !s[key]; }); return el; };

  const farbOptionen = () => {
    const gruppen = new Map();
    for (const f of typ().farben) (gruppen.get(f.gruppe) || gruppen.set(f.gruppe, []).get(f.gruppe)).push({ wert: f.code, text: f.code + " · " + f.name });
    return [...gruppen].map(([gruppe, liste]) => ({ gruppe, liste }));
  };
  const typWechsel = () => {
    const t = typ();
    if (!t.farben.some(f => f.code === s.code)) s.code = t.farben[0].code;
    if (!t.dicken.includes(s.dicke)) s.dicke = t.dicken.includes(1.5) ? 1.5 : t.dicken[0];
    steuer.forEach(f => f());
  };

  const einstellungen = h("div", {},
    h("h4", {}, "Material"),
    wahl("typ", "Kunststoff", katalog.typen.map(t => ({ wert: t.id, text: t.name })), typWechsel),
    wahl("code", "Farbe", farbOptionen),
    wahl("dicke", "Dicke", () => typ().dicken.map(d => ({ wert: String(d), text: String(d).replace(".", ",") + " mm" }))),
    matInfo,
    h("h4", {}, "Format"),
    schieber("breite", "Breite", 20, 300, 1, " mm"),
    schieber("hoehe", "Höhe", 10, 150, 1, " mm"),
    schieber("radius", "Eckenradius", 0, 10, 0.5),
    wahl("loecher", "Löcher", Object.entries(LOCHTEXT).map(([wert, text]) => ({ wert, text }))),
    schieber("lochD", "Loch Ø", 2, 8, 0.5),
    h("h4", {}, "Schrift"),
    schieber("zeilen", "Textfelder", 1, 5, 1),
    schieber("schrifthoehe", "Schrifthöhe", 1.5, 15, 0.5),
    wahl("ausrichtung", "Ausrichtung", [{ wert: "Links", text: "links" }, { wert: "Mitte", text: "Mitte" }, { wert: "Rechts", text: "rechts" }]),
    haken("fett", "Fett"),
    haken("umriss", "Schrift nur als Umriss (eigene Ebene)"),
    h("h4", {}, "Abstände"),
    schieber("zeilenabstand", "Zeilenabstand", 0, 5, 0.5),
    schieber("randOben", "Rand oben", 0, 15, 0.5),
    schieber("randUnten", "Rand unten", 0, 15, 0.5),
    schieber("randLinks", "Rand links", 0, 15, 0.5),
    schieber("randRechts", "Rand rechts", 0, 15, 0.5),
    h("h4", {}, "QR-Code und Rahmen"),
    haken("qr", "QR-Code"),
    nurWenn("qr", h("div", {},
      feld("qrText", "Link oder Text", "https://…"),
      schieber("qrGroesse", "Grösse", 8, 40, 1, " mm"),
      wahl("qrSeite", "Seite", [{ wert: "Rechts", text: "rechts" }, { wert: "Links", text: "links" }]),
      h("p", { class: "cw-hint" }, "{1}, {2} … = Text des Felds, {nr:0000} = laufende Nummer."))),
    haken("rahmen", "Rahmenlinie"));

  const hilfsHaken = h("input", { type: "checkbox", checked: true, onchange: e => { hilfslinien = e.target.checked; zeichnen(); } });

  root.append(h("div", { class: "cw cw-grid" },
    h("div", {},
      kopf, buehne,
      h("label", { class: "cw-c" }, hilfsHaken, "Hilfslinien (Textfelder)"),
      h("p", { class: "cw-hint" }, "Text je Feld wie auf dem Schild. Enter = neue Zeile im Feld."),
      felderBox, hinweise,
      h("div", { class: "cw-row" }, knopfSvg, knopf3d),
      legende,
      h("p", { class: "cw-hint", style: "margin-top:12px" }, "Nur in der App: Excel-Listen, Serien, Logo, Freiform-Design, Plattenbelegung, Bestellung und Montageverzeichnis. Freeware der Datenpunkt engineering AG, erstellt von Caelum GmbH.")),
    einstellungen));

  // ── Textfelder ──
  function felderBauen() {
    const n = Math.max(1, s.zeilen | 0);
    s.felder = Array.from({ length: n }, (_, i) => s.felder[i] ?? "");
    const f = farbe();
    felderBox.style.background = f.oberflaeche;
    felderBox.replaceChildren(...s.felder.map((wert, i) => {
      const ta = h("textarea", { rows: String(Math.max(1, wert.split("\n").length)), "aria-label": "Textfeld " + (i + 1) });
      ta.value = wert;
      ta.addEventListener("input", () => { s.felder[i] = ta.value; ta.rows = Math.max(1, ta.value.split("\n").length); neu(); });
      return ta;
    }));
  }
  let zeilenVorher = -1, farbeVorher = "";

  // ── Zeichnen ──
  let letzte = null;
  function zeichnen() {
    const t = typ(), f = farbe();
    if (s.zeilen !== zeilenVorher || f.code + t.id !== farbeVorher) { felderBauen(); zeilenVorher = s.zeilen; farbeVorher = f.code + t.id; }
    const g = aufbauen(s, { schrift: b => (b ? fett : normal), qr, zweiTiefen: t.zweiTiefen });
    letzte = { g, t, f };
    const kern = f.kern, kern2 = f.kern2 || f.kern;
    const ns = "http://www.w3.org/2000/svg";
    const el = (tag, a) => { const e = document.createElementNS(ns, tag); for (const k in a) e.setAttribute(k, a[k]); return e; };
    const sv = el("svg", { viewBox: `-1 -1 ${g.breite + 2} ${g.hoehe + 2}`, xmlns: ns });
    sv.append(el("path", { d: g.umriss.d(), fill: f.oberflaeche }));
    if (!g.gravur.leer) sv.append(el("path", { d: g.gravur.d(), fill: kern }));
    if (!g.gravur2.leer) sv.append(el("path", { d: g.gravur2.d(), fill: kern2 }));
    if (!g.schriftUmriss.leer) sv.append(el("path", { d: g.schriftUmriss.d(), fill: "none", stroke: kern, "stroke-width": "0.18" }));
    for (const l of g.loecher) sv.append(el("circle", { cx: l.x, cy: l.y, r: Math.min(l.w, l.h) / 2, fill: "#1F1E1D" }));
    if (hilfslinien) for (const z of g.zellen)
      sv.append(el("rect", { x: z.x0, y: z.y0, width: z.x1 - z.x0, height: z.y1 - z.y0, fill: "none", stroke: "#7FA3D6", "stroke-width": "0.15", "stroke-dasharray": "0.8 0.6" }));
    buehne.replaceChildren(sv);

    kopf.textContent = `${f2(s.breite)} × ${f2(s.hoehe)} mm · ${t.name} ${f.code} · ${String(s.dicke).replace(".", ",")} mm · ${s.zeilen} Textfeld${s.zeilen > 1 ? "er" : ""}`;
    matInfo.replaceChildren(h("i", { style: `background:linear-gradient(90deg, ${f.oberflaeche} 55%, ${kern} 55%)` }), `${f.name} – Gravur zeigt ${t.zweiTiefen ? "zwei Kernfarben" : "die Kernfarbe"}`);
    hinweise.replaceChildren(...g.hinweise.map(x => h("li", {}, x)));
    steuer.forEach(fn => fn());
  }
  const f2 = v => String(Math.round(v * 10) / 10).replace(".", ",");

  function speichernSvg() {
    if (!letzte) return;
    const { g, t, f } = letzte;
    const text = svg(s, g, { typName: t.name, code: f.code, name: f.name, zweiTiefen: t.zweiTiefen });
    const name = "Schild_" + (s.felder.find(x => x.trim()) || "Caelum").replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40) + ".svg";
    ctx.speichern(new Blob([text], { type: "image/svg+xml" }), name);
  }

  // Schild als GLB (wie „Im 3D-Viewer“ der App) an das Viewer-Modul geben
  async function zeige3d() {
    if (!letzte) return;
    const { g, f } = letzte, alt = knopf3d.textContent;
    knopf3d.disabled = true; knopf3d.textContent = "3D-Modell entsteht …";
    try {
      const [oben, unten] = await Promise.all([texturMalen(g, f, true), texturMalen(g, f, false)]);
      const glb = glbSchreiben(koerper(g, s.dicke), f, oben, unten);
      const name = "Schild_" + (s.felder.find(x => x.trim()) || "Caelum").replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40) + ".glb";
      await ctx.geben("schild-glb", new Blob([glb], { type: "model/gltf-binary" }), { name });
    } catch (e) {
      hinweise.replaceChildren(h("li", {}, "3D-Ansicht nicht möglich: " + (e?.message || e)));
    } finally { knopf3d.disabled = false; knopf3d.textContent = alt; }
  }

  typWechsel();
  zeichnen();
}
