// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum QR · Web-Modul „QR-Code gestalten“ (CAELUM-STANDARD.md Teil B). Bildet das Fenster der App nach (QrWindow.cs,
// Entscheid Kenny 19.11.2026: „emulieren“ = grafisch erstellen wie in der App): links die Designs, Mitte die lebende
// Vorschau mit Wechsel und Lesetest, rechts Inhalt, Anpassen und Speichern. Die App ist Master: Designs aus
// daten/designs.json, Zeichnen wie Painter.cs (maler.js), Lesetest wie Reader.Check (lesen.js, jsQR).
// Läuft nur im Browser, nichts wird hochgeladen.
import { encode } from "./qr.js";
import { ruhend, wechsel, paare, svg, CanvasFlaeche, logoVektor, logoBild, stufeVon, schwaechsterKontrast, hex, zuHex } from "./maler.js";

const SPEICHER = "caelum.qr.web.v2";
const FLOW = 3.6, PERIODE = 7.0;                                   // wie QrWindow: alle 7 s ein Wechsel von 3,6 s
const START = "https://www.caelum.one/#qr-482913";
const GRUPPEN = ["Caelum", "Klassisch", "Kunde", "Gravur"];
const NAMEN = { quadrat: "Quadrat", rund: "Rund", punkt: "Punkt", fluss: "Fluss", spektrum: "Spektrum", verlauf: "Verlauf", einfarbig: "Einfarbig", rorschach: "Rorschach", blende: "Blende", keiner: "Keiner" };

const css = `
.qa { --qa-bg:#262624; --qa-tief:#1F1E1D; --qa-flaeche:#30302E; --qa-linie:#3D3D3A; --qa-violett:#A585D6;
  background:var(--qa-bg); border:1px solid var(--qa-linie); border-radius:12px; overflow:hidden; }
.qa-kopf { background:var(--qa-tief); padding:12px 20px; border-bottom:1px solid var(--qa-linie); }
.qa-kopf b { font-size:17px; font-weight:600; display:flex; align-items:center; gap:8px; }
.qa-kopf b i { width:10px; height:10px; border-radius:3px; background:var(--qa-violett); display:inline-block; }
.qa-kopf span { color:var(--muted); font-size:13px; }
.qa-leib { display:grid; grid-template-columns:250px minmax(0,1fr) 316px; grid-template-areas:"links mitte rechts"; min-height:560px; }
.qa-links { grid-area:links; padding:12px 8px 12px 12px; border-right:1px solid var(--qa-linie); overflow:auto; max-height:760px; }
.qa-mitte { grid-area:mitte; padding:16px; display:flex; flex-direction:column; align-items:center; gap:10px; min-width:0; }
.qa-rechts { grid-area:rechts; padding:12px 16px 16px; border-left:1px solid var(--qa-linie); }
.qa h5 { font-size:14px; font-weight:600; color:var(--text-soft); margin:14px 0 6px; }
.qa h5:first-child { margin-top:2px; }
.qa-liste { display:grid; gap:2px; }
.qa-eintrag { position:relative; display:grid; grid-template-columns:64px minmax(0,1fr); gap:10px; align-items:center; text-align:left;
  padding:6px 8px 6px 10px !important; border:0 !important; border-radius:8px !important; background:transparent !important; width:100%; }
.qa-eintrag:hover { background:var(--qa-flaeche) !important; filter:none !important; }
.qa-eintrag[aria-pressed="true"] { background:var(--qa-flaeche) !important; }
.qa-eintrag[aria-pressed="true"]::before { content:""; position:absolute; left:0; top:8px; bottom:8px; width:3px; border-radius:2px; background:var(--qa-violett); }
.qa-eintrag canvas { width:64px; height:64px; border-radius:6px; display:block; }
.qa-eintrag b { display:block; font-weight:600; font-size:13.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.qa-eintrag small { color:var(--muted); font-size:12px; }
.qa-vorschau { width:100%; max-width:500px; aspect-ratio:1; border-radius:16px; display:block; background:var(--qa-tief); }
.qa-status { text-align:center; font-size:13px; color:var(--muted); min-height:2.6em; margin:0; font-variant-numeric:tabular-nums; }
.qa-status.gut { color:#6BAF73; } .qa-status.mittel { color:#D97757; } .qa-status.schlecht { color:#E5484D; }
.qa-handy { width:100%; max-width:500px; }
.qa-handy p { color:var(--muted); font-size:12.5px; margin:0 0 6px; }
.qa-proben { display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:8px; }
.qa-probe { text-align:center; font-size:12px; color:var(--text-soft); }
.qa-probe canvas { width:100%; aspect-ratio:1; border-radius:8px; display:block; margin-bottom:4px; }
.qa-probe .ja { color:#6BAF73; } .qa-probe .nein { color:#E5484D; } .qa-probe .weiss { color:var(--muted); }
.qa .qa-zeile { display:grid; grid-template-columns:92px minmax(0,1fr); align-items:center; gap:6px; margin:3px 0; color:var(--muted); }
.qa .qa-zeile > div { display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
.qa .qa-ohne { padding-left:98px; }
.qa input.qa-inhalt { font-family:"Cascadia Mono", Consolas, ui-monospace, monospace; font-size:13px; }
.qa .qa-hinweis { color:var(--faint); font-size:12px; margin:4px 0 0; }
.qa-farbe { position:relative; width:34px; height:28px; border-radius:6px; border:1px solid var(--qa-linie); overflow:hidden; display:inline-block; cursor:pointer; }
.qa-farbe input { position:absolute; inset:-8px; width:60px; height:50px; opacity:0; cursor:pointer; }
.qa-knopf { position:relative; overflow:hidden; display:inline-flex; align-items:center; font-size:13.5px; font-weight:600; padding:5px 12px;
  border:1px solid var(--qa-linie); border-radius:8px; background:var(--qa-flaeche); color:var(--text); cursor:pointer; }
.qa-knopf input { position:absolute; inset:0; opacity:0; cursor:pointer; }
.qa .qa-voll { width:100%; margin:3px 0; }
.qa .qa-voll.cw-primary { padding:10px 14px; font-size:15px; }
.qa .qa-name { display:flex; gap:6px; margin:3px 0; }
.qa .qa-name[hidden] { display:none; }
.qa .qa-zeile > div.qa-knoepfe { flex-wrap:nowrap; }
.qa .qa-knoepfe .qa-knopf { padding:5px 10px; font-size:13px; white-space:nowrap; }
.qa select:disabled, .qa input:disabled + span { opacity:.45; }
.qa-fuss { color:var(--muted); font-size:12.5px; margin:10px 2px 0; }
@media (max-width: 1080px) { .qa-leib { grid-template-columns:200px minmax(0,1fr) 304px; } .qa .qa-zeile { grid-template-columns:76px minmax(0,1fr); } .qa .qa-ohne { padding-left:82px; } }
@media (max-width: 900px) {
  .qa-leib { grid-template-columns:minmax(0,1fr); grid-template-areas:"mitte" "links" "rechts"; min-height:0; }
  .qa-links { border:0; border-top:1px solid var(--qa-linie); max-height:none; padding:12px; }
  .qa-liste { grid-auto-flow:column; grid-auto-columns:minmax(196px, 1fr); overflow-x:auto; padding-bottom:6px; }
  .qa-rechts { border:0; border-top:1px solid var(--qa-linie); }
  .qa-kopf span { display:block; }
}
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
const kopie = o => JSON.parse(JSON.stringify(o));
const komma = v => v.toFixed(1).replace(".", ",");
const normHex = v => zuHex(hex(v));

export async function mount(root, ctx) {
  const hier = new URL("./", import.meta.url);
  const [dat, logoDaten, leser] = await Promise.all([
    fetch(new URL("daten/designs.json", hier)).then(r => r.json()),
    fetch(new URL("daten/logo.json", hier)).then(r => r.json()),
    import("./lesen.js").catch(() => null),
  ]);
  const caelumLogo = logoVektor(logoDaten);

  // Zustand: letzte Einstellungen und eigene Designs nur in diesem Browser
  let gemerkt = {};
  try { gemerkt = JSON.parse(localStorage.getItem(SPEICHER) || "{}") || {}; } catch { /* privat */ }
  const eigene = Array.isArray(gemerkt.eigene) ? gemerkt.eigene.filter(d => d && d.id && d.farbe && d.augen) : [];
  const alle = () => [...dat.designs, ...eigene];
  const finde = id => alle().find(d => d.id === id);
  let design = kopie(finde(gemerkt.designId) || dat.designs[0]);
  if (gemerkt.design && gemerkt.design.id === design.id) design = { ...design, ...gemerkt.design };
  let text = typeof gemerkt.text === "string" ? gemerkt.text : START;
  let vorfuehren = gemerkt.vorfuehren ?? !matchMedia("(prefers-reduced-motion: reduce)").matches;
  let logo = caelumLogo, logoName = "Caelum-Logo";
  const merken = () => {
    const { datei, ...lg } = design.logo || {};
    try { localStorage.setItem(SPEICHER, JSON.stringify({ text, vorfuehren, designId: design.id, design: { ...design, logo: lg }, eigene })); } catch { /* privat */ }
  };

  root.append(h("style", {}, css));

  // ── links: Designs ──
  const liste = h("div", { class: "qa-liste", role: "listbox", "aria-label": "Designs" });
  const bildchen = new Map();
  function miniatur(d) {
    const key = JSON.stringify(d);
    if (bildchen.has(key)) return bildchen.get(key);
    const c = h("canvas", { width: "128", height: "128", "aria-hidden": "true" });
    const q = encode("https://www.caelum.one", stufeVon(d));
    ruhend(new CanvasFlaeche(c.getContext("2d")), q, d, 128, 12, caelumLogo);
    bildchen.set(key, c);
    return c;
  }
  function listeFuellen() {
    const ds = alle(), gr = [...new Set([...GRUPPEN, ...ds.map(d => d.gruppe)])];
    liste.replaceChildren(...gr.flatMap(g => ds.filter(d => d.gruppe === g)).map(d => {
      const c = miniatur(d).cloneNode(); c.getContext("2d").drawImage(miniatur(d), 0, 0);
      const knopf = h("button", { type: "button", class: "qa-eintrag", role: "option", title: d.beschreibung || "", onclick: () => waehlen(d) },
        c, h("span", {}, h("b", {}, d.name), h("small", {}, d.gruppe + (eigene.includes(d) ? " · eigen" : ""))));
      knopf.dataset.id = d.id;
      return knopf;
    }));
    markieren();
  }
  const markieren = () => { for (const k of liste.children) { const an = k.dataset.id === design.id; k.setAttribute("aria-pressed", String(an)); k.setAttribute("aria-selected", String(an)); } };
  function waehlen(d) { design = kopie(d); logo = caelumLogo; logoName = "Caelum-Logo"; steuerLaden(); geaendert(); }

  // ── Mitte: Vorschau, Status, Handy-Probe ──
  const vorschau = h("canvas", { class: "qa-vorschau", role: "img", "aria-label": "Vorschau des QR-Codes" });
  const status = h("p", { class: "qa-status", "aria-live": "polite" });
  const proben = h("div", { class: "qa-proben" });
  const handy = h("div", { class: "qa-handy" }, h("p", {}, "So sieht ihn eine Handy-Kamera – jede Probe wird gelesen:"), proben);
  if (!leser) handy.replaceChildren(h("p", {}, "Der Lesetest konnte nicht geladen werden – die App prüft jeden Code selbst."));

  // ── rechts: Inhalt, Anpassen, Speichern ──
  const zeile = (label, ...k) => h("div", { class: "qa-zeile" }, h("span", {}, label), h("div", { class: label === "Logo" ? "qa-knoepfe" : null }, ...k));
  const auswahl = werte => h("select", {}, ...werte.map(w => h("option", { value: w }, NAMEN[w] || w)));
  const eingabe = h("input", { type: "text", class: "qa-inhalt", "aria-label": "Inhalt", spellcheck: false, oninput: e => { text = e.target.value; neuAufbauen(); } });
  eingabe.value = text;
  const demo = h("input", { type: "checkbox", checked: vorfuehren, onchange: e => { vorfuehren = e.target.checked; merken(); weiter(); } });
  const cbInk = auswahl(["fluss", "spektrum", "verlauf", "einfarbig"]);
  const cbModul = auswahl(["quadrat", "rund", "punkt"]);
  const cbAugen = auswahl(["rund", "quadrat", "punkt"]);
  const cbWechsel = auswahl(["rorschach", "blende", "keiner"]);
  const chkMuster = h("input", { type: "checkbox" }), chkMitte = h("input", { type: "checkbox" });
  const felder = h("span", { style: "display:flex;gap:6px;flex-wrap:wrap" });
  const papierFeld = h("input", { type: "color", "aria-label": "Papierfarbe" });
  const logoText = h("p", { class: "qa-hinweis qa-ohne" });
  const logoWahl = h("input", { type: "file", accept: "image/png,image/jpeg", "aria-label": "Eigenes Logo", onchange: e => logoLaden(e.target.files[0]) });
  const nameFeld = h("input", { type: "text", "aria-label": "Name des eigenen Designs" });
  const nameZeile = h("div", { class: "qa-name", hidden: true }, nameFeld, h("button", { type: "button", class: "cw-primary", onclick: designSpeichern }, "Speichern"));
  const knopfVideo = h("button", { type: "button", class: "qa-voll", onclick: videoSpeichern, title: "1 s ruhend, Wechsel, 1 s ruhend – 720 × 720" }, "Wechsel als Video");

  for (const sel of [cbInk, cbModul, cbAugen, cbWechsel]) sel.addEventListener("change", steuerLesen);
  for (const c of [chkMuster, chkMitte]) c.addEventListener("change", steuerLesen);
  papierFeld.addEventListener("input", () => { design.papier = papierFeld.value.toUpperCase(); geaendert(); });

  const rechts = h("div", { class: "qa-rechts" },
    h("h5", {}, "Inhalt"),
    eingabe,
    h("p", { class: "qa-hinweis" }, "Adresse, Text oder Kopplungscode – längerer Text = dichterer Code."),
    h("label", { class: "cw-c" }, demo, "Wechsel vorführen"),
    h("h5", {}, "Anpassen"),
    zeile("Farben", cbInk),
    zeile("", felder, h("label", { class: "qa-knopf", title: "Papierfarbe" }, "Papier", papierFeld)),
    zeile("Module", cbModul),
    zeile("Augen", cbAugen),
    zeile("Wechsel", cbWechsel),
    h("label", { class: "cw-c qa-ohne" }, chkMuster, h("span", {}, "Logo im Muster")),
    h("label", { class: "cw-c qa-ohne" }, chkMitte, h("span", {}, "Logo in der Mitte")),
    zeile("Logo", h("label", { class: "qa-knopf", title: "PNG oder JPG. Erscheint in der Mitte." }, "Eigenes Logo …", logoWahl),
      h("button", { type: "button", class: "qa-knopf", title: "Zurück zum Caelum-Linien-Logo", onclick: () => { logo = caelumLogo; logoName = "Caelum-Logo"; delete design.logo.datei; geaendert(); } }, "Caelum")),
    logoText,
    h("h5", {}, "Speichern"),
    h("button", { type: "button", class: "cw-primary qa-voll", onclick: pngSpeichern }, "Als PNG speichern"),
    h("button", { type: "button", class: "qa-voll", onclick: svgSpeichern, title: "Vektor in mm, für Caelum Gravur, xTool und Druckerei" }, "SVG (Gravur, Druck)"),
    h("button", { type: "button", class: "qa-voll", onclick: nameFragen, title: "Als JSON – die App nimmt es in C:\\CAELUM\\QR\\designs auf" }, "Als eigenes Design"),
    nameZeile,
    knopfVideo);

  root.append(
    h("div", { class: "cw qa" },
      h("div", { class: "qa-kopf" }, h("b", {}, h("i", {}), "Caelum QR"),
        h("span", {}, "QR-Codes nach Design – Caelum, Kundenfarben, eigenes Logo, Gravur. Jeder Code wird beim Gestalten zurückgelesen.")),
      h("div", { class: "qa-leib" },
        h("div", { class: "qa-links" }, h("h5", {}, "Designs"), liste),
        h("div", { class: "qa-mitte" }, vorschau, status, handy),
        rechts)),
    h("p", { class: "qa-fuss" }, "Web-Fassung des Fensters von Caelum QR. Nur in der App: Lesetest mit ZXing, Designs als Bibliothek in C:\\CAELUM\\QR, Kundenlogo als Vektor, Anbindung an Pandora, Gravur und Vision."));

  // ── Anpassen ↔ Design (wie LoadControls / ReadControls / BuildSwatches) ──
  function steuerLaden() {
    cbModul.value = design.modul; cbAugen.value = design.augen.form; cbInk.value = design.farbe.art; cbWechsel.value = design.wechsel;
    chkMuster.checked = !!design.logo.muster; chkMitte.checked = design.logo.mitte !== false;
    for (const c of [cbModul, cbAugen, cbInk, chkMuster]) c.disabled = !!design.gravur;
    papierFeld.value = normHex(design.papier);
    farbfelder();
  }
  function steuerLesen() {
    design.modul = cbModul.value; design.augen.form = cbAugen.value; design.farbe.art = cbInk.value; design.wechsel = cbWechsel.value;
    design.logo.muster = chkMuster.checked; design.logo.mitte = chkMitte.checked;
    farbfelder(); geaendert();
  }
  function farbfelder() {
    const f = design.farbe.farben, art = design.farbe.art;
    const noetig = art === "spektrum" ? 0 : art === "einfarbig" ? 1 : art === "verlauf" ? Math.max(2, f.length) : 3;
    while (f.length < noetig) f.push(["#D97757", "#A585D6", "#6E9BD8"][f.length % 3]);
    if (noetig === 0) { felder.replaceChildren(h("span", { class: "qa-hinweis", style: "margin:0" }, "alle Farbtöne")); return; }
    felder.replaceChildren(...f.slice(0, noetig).map((wert, i) => {
      const inp = h("input", { type: "color", value: normHex(wert), "aria-label": "Farbe " + (i + 1) });
      const feld = h("label", { class: "qa-farbe", style: "background:" + normHex(wert), title: `Farbe ${i + 1}: ${normHex(wert)} – zu helle Farben werden für den Code automatisch abgedunkelt` }, inp);
      inp.addEventListener("input", () => { f[i] = inp.value.toUpperCase(); feld.style.background = inp.value; geaendert(); });
      return feld;
    }));
  }

  function logoLaden(datei) {
    if (!datei) return;
    const rd = new FileReader();
    rd.onload = () => {
      const im = new Image();
      im.onload = () => { logo = logoBild(im, rd.result); logoName = datei.name + " (Bild, nur in der Mitte)"; design.logo.datei = datei.name; design.logo.mitte = true; steuerLaden(); geaendert(); };
      im.onerror = () => { statusSetzen("schlecht", "✗ Logo nicht lesbar – bitte PNG oder JPG"); };
      im.src = rd.result;
    };
    rd.readAsDataURL(datei);
    logoWahl.value = "";
  }

  // ── Zustand (wie Rebuild / RunCheck) ──
  let cur = null, next = null, pairs = null, flowStart = -1, lastSwitch = 0, zaehler = 482913, pruefung = 0, pruefLauf = 0;
  const uhr = () => performance.now() / 1000;
  const statusSetzen = (art, t) => { status.className = "qa-status" + (art ? " " + art : ""); status.textContent = t; };

  const geaendert = () => neuAufbauen();
  function neuAufbauen() {
    merken(); markieren();
    logoText.textContent = logoName;
    cur = encode(text, stufeVon(design));
    next = null; pairs = null; flowStart = -1; lastSwitch = uhr() - PERIODE + 2;    // erster Wechsel nach 2 s
    if (!cur) { statusSetzen("schlecht", "✗ Text zu lang für einen QR-Code"); proben.replaceChildren(); zeichnen(); return; }
    statusSetzen("", "Lesetest läuft …");
    zeichnen(); weiter();
    clearTimeout(pruefung); pruefung = setTimeout(lesetest, 350);
  }

  function lesetest() {
    if (!cur) return;
    const lauf = ++pruefLauf, q = cur, d = kopie(design), lg = logo, t = text;
    const kontrast = schwaechsterKontrast(q, d);
    const info = `   ·   Kontrast ≥ ${komma(kontrast)} : 1   ·   Version ${q.version}, Stufe ${q.ecc}, ${q.size} × ${q.size} Module`;
    if (!leser) { statusSetzen("", "Lesetest nur in der App" + info); return; }
    const reads = leser.pruefen((g, px) => ruhend(new CanvasFlaeche(g), q, d, px, 12, lg), t);
    if (lauf !== pruefLauf) return;
    const gut = reads === 3;
    statusSetzen(gut ? "gut" : reads > 0 ? "mittel" : "schlecht",
      (gut ? "✓ lesbar" : reads > 0 ? `! nur in ${reads} von 3 Größen lesbar` : "✗ nicht lesbar – Farben dunkler oder Logo kleiner") + info);
    // Handy-Proben aus dem ruhenden Bild (720 px)
    const quelle = document.createElement("canvas"); quelle.width = quelle.height = 720;
    ruhend(new CanvasFlaeche(quelle.getContext("2d")), q, d, 720, 12, lg);
    proben.replaceChildren(...leser.handyProben(quelle, t).map(p => h("div", { class: "qa-probe" }, p.bild,
      p.gelesen === null ? h("span", { class: "weiss" }, "– " + p.name + " (Browser kann das nicht)")
        : h("span", { class: p.gelesen ? "ja" : "nein" }, (p.gelesen ? "✓ " : "✗ ") + p.name))));
  }

  // Folgecode wie QrWindow.Tick: die letzten sechs Ziffern zählen weiter
  function folgeCode() {
    zaehler = (zaehler * 7 + 13) % 1000000;
    const nt = /\d{6}$/.test(text) ? text.slice(0, -6) + String(zaehler).padStart(6, "0") : text;
    return encode(nt, stufeVon(design), cur.version);
  }

  // ── Zeichnen und Animation (nur solange sichtbar und „Wechsel vorführen“ an, kein Dauerlauf im Hintergrund) ──
  let sichtbar = false, laeuft = 0;
  function zeichnen(t) {
    const side = Math.max(200, Math.min(1000, Math.round((vorschau.clientWidth || 400) * Math.min(2, devicePixelRatio || 1))));
    if (vorschau.width !== side) { vorschau.width = side; vorschau.height = side; }
    const g = new CanvasFlaeche(vorschau.getContext("2d"));
    if (!cur) { g.clear([31, 30, 29], side); return; }
    const zeit = t ?? 12;
    if (flowStart >= 0 && next) wechsel(g, cur, next, pairs, design, side, Math.min(1, (uhr() - flowStart) / FLOW), zeit, logo);
    else ruhend(g, cur, design, side, zeit, logo);
  }
  const aktiv = () => vorfuehren && sichtbar && !document.hidden && !!cur;
  function schritt() {
    laeuft = 0;
    if (!aktiv()) { flowStart = -1; next = null; zeichnen(); return; }
    const now = uhr();
    if (design.wechsel !== "keiner" && flowStart < 0 && now - lastSwitch > PERIODE) {
      next = folgeCode();
      if (next && next.size === cur.size) { pairs = paare(cur, next, zaehler); flowStart = now; } else { next = null; lastSwitch = now; }
    }
    if (flowStart >= 0 && now - flowStart >= FLOW) { cur = next; next = null; pairs = null; flowStart = -1; lastSwitch = now; }
    zeichnen(now);
    laeuft = requestAnimationFrame(schritt);
  }
  function weiter() { if (aktiv()) { if (!laeuft) laeuft = requestAnimationFrame(schritt); } else zeichnen(); }
  new IntersectionObserver(e => { sichtbar = e.some(x => x.isIntersecting); weiter(); }).observe(vorschau);
  document.addEventListener("visibilitychange", weiter);
  new ResizeObserver(() => { if (!laeuft) zeichnen(); }).observe(vorschau);

  // ── Speichern (wie Export / SaveDesign) ──
  const stempel = () => { const d = new Date(), z = n => String(n).padStart(2, "0"); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}`; };
  const ruhig = () => encode(text, stufeVon(design));
  function pngSpeichern() {
    const q = ruhig(); if (!q) return;
    const c = document.createElement("canvas"); c.width = c.height = 1440;
    ruhend(new CanvasFlaeche(c.getContext("2d")), q, design, 1440, 12, logo);
    const name = `qr-${design.id}-${stempel()}.png`;
    c.toBlob(b => { ctx.speichern(b, name); statusSetzen("gut", "✓ gespeichert: " + name); }, "image/png");
  }
  function svgSpeichern() {
    const q = ruhig(); if (!q) return;
    const name = `qr-${design.id}-${stempel()}.svg`;
    ctx.speichern(new Blob([svg(q, design, 40, 12, logo)], { type: "image/svg+xml" }), name);
    statusSetzen("gut", "✓ gespeichert: " + name);
  }
  function nameFragen() {
    nameZeile.hidden = !nameZeile.hidden;
    if (!nameZeile.hidden) { nameFeld.value = eigene.some(d => d.id === design.id) ? design.name : design.name + " (eigen)"; nameFeld.focus(); nameFeld.select(); }
  }
  nameFeld.addEventListener("keydown", e => { if (e.key === "Enter") designSpeichern(); if (e.key === "Escape") nameZeile.hidden = true; });
  function designSpeichern() {
    const name = nameFeld.value.trim(); if (!name) return;
    const d = kopie(design);
    d.name = name; d.gruppe = "Eigene";
    d.id = [...name.toLowerCase()].map(c => /[\p{L}\p{N}]/u.test(c) ? c : "-").join("").replace(/^-+|-+$/g, "") || "eigen";
    d.beschreibung = d.beschreibung || "Eigenes Design aus dem Web.";
    delete d.logo.datei;
    const i = eigene.findIndex(x => x.id === d.id); if (i >= 0) eigene.splice(i, 1);
    eigene.push(d); design = kopie(d);
    nameZeile.hidden = true;
    listeFuellen(); merken();
    ctx.speichern(new Blob([JSON.stringify({ _kopf: "Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.", ...d }, null, 2) + "\n"], { type: "application/json" }), d.id + ".json");
    statusSetzen("gut", `✓ Design gespeichert: ${d.id}.json – in der App nach C:\\CAELUM\\QR\\designs legen`);
  }

  // Video des Wechsels (MediaRecorder): 1 s ruhend, Wechsel 3,6 s, 1 s ruhend
  async function videoSpeichern() {
    const a = ruhig(); if (!a) return;
    if (design.wechsel === "keiner") { statusSetzen("mittel", "! Wechsel ist „Keiner“ – bitte Rorschach oder Blende wählen"); return; }
    const c = document.createElement("canvas"); c.width = c.height = 720;
    const typ = typeof MediaRecorder !== "undefined" && c.captureStream ? ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find(t => MediaRecorder.isTypeSupported(t)) : null;
    if (!typ) { statusSetzen("mittel", "! Dieser Browser kann keine Videos aufnehmen"); return; }
    const st = stufeVon(design), ziel = /\d{6}$/.test(text) ? text.slice(0, -6) + "777777" : text;   // wie Program.Frame
    const b = encode(ziel, st, a.version);
    if (!b || b.size !== a.size) { statusSetzen("mittel", "! Der Folgecode passt nicht in dieselbe Grösse"); return; }
    const pr = paare(a, b, 482913), g = new CanvasFlaeche(c.getContext("2d"));
    const rec = new MediaRecorder(c.captureStream(30), { mimeType: typ, videoBitsPerSecond: 6_000_000 });
    const teile = []; rec.ondataavailable = e => { if (e.data.size) teile.push(e.data); };
    const fertig = new Promise(r => { rec.onstop = r; });
    knopfVideo.disabled = true; knopfVideo.textContent = "Video entsteht …";
    ruhend(g, a, design, 720, 12, logo);
    rec.start();
    const t0 = performance.now(), dauer = 2 + FLOW;
    await new Promise(r => {
      const bild = () => {
        const z = (performance.now() - t0) / 1000;
        if (z < 1) ruhend(g, a, design, 720, 12 + z, logo);
        else if (z < 1 + FLOW) wechsel(g, a, b, pr, design, 720, (z - 1) / FLOW, 12 + z, logo);
        else ruhend(g, b, design, 720, 12 + z, logo);
        if (z < dauer) requestAnimationFrame(bild); else r();
      };
      bild();
    });
    rec.stop(); await fertig;
    knopfVideo.disabled = false; knopfVideo.textContent = "Wechsel als Video";
    const name = `qr-${design.id}-${stempel()}.${typ.includes("mp4") ? "mp4" : "webm"}`;
    ctx.speichern(new Blob(teile, { type: typ.split(";")[0] }), name);
    statusSetzen("gut", "✓ gespeichert: " + name);
  }

  listeFuellen();
  steuerLaden();
  neuAufbauen();
}
