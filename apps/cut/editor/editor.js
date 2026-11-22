// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Cut · Web-Editor (Wunsch Kenny 20.11.2026: Editor auch auf caelum.one). Vorbild: EditorWindow der App.
// Vollbild-Fenster: Medien | Vorschau mit Abspielen | Eigenschaften, darunter die Zeitleiste mit Video-, Ton- und Textspuren
// (+ / −), Ziehen und Kürzen mit Maus und Finger, Übergänge (sanft/hart/Formen), Zuschnitt, Effekte, Lautstärke, Titel.
// 0.3.0 (21.11.2026): Deckkraft-Schieber, RGB-Farbrad für Text und Hintergrund, Farbblöcke, Griffe in der Vorschau.
// Projekt als .caelumcut (gleiches Format wie die App). Export Bild für Bild im Browser (export.js). Nichts wird hochgeladen.
const V = new URL(import.meta.url).search;
const P = await import("./projekt.js" + V);
const { zeichnen, gebraucht, quellZeit, griffFlaeche, ecken } = await import("./bild.js" + V);
const { exportieren } = await import("./export.js" + V);
const { lesen, kannKodieren, KodierFehler } = await import("../kodieren.js" + V);
const { zeit } = await import("../plan.js" + V);

const css = `
.ced { position:fixed; inset:0; z-index:1000; background:var(--bg,#262624); color:var(--text,#E8E6E1); display:grid;
  grid-template-rows:auto minmax(0,1fr) minmax(170px,38vh) auto; grid-template-columns:minmax(0,1fr); font:14px/1.4 "Segoe UI",system-ui,sans-serif; }
.ced * { box-sizing:border-box; }
.ced button, .ced select, .ced input, .ced textarea { font:inherit; color:var(--text,#E8E6E1); background:var(--surface,#30302E); border:1px solid var(--line,#3D3D3A); border-radius:7px; }
.ced button { padding:5px 10px; cursor:pointer; white-space:nowrap; }
.ced button:hover { filter:brightness(1.15); }
.ced button.haupt { background:var(--accent,#D97757); color:#1F1E1D; border:0; font-weight:600; padding:6px 16px; }
.ced select, .ced input, .ced textarea { padding:4px 6px; min-width:0; }
.ced-kopf { display:flex; gap:6px; align-items:center; padding:8px 10px; background:var(--bg-deep,#1F1E1D); flex-wrap:wrap; }
.ced-kopf b { font-size:15px; margin-right:8px; }
.ced .ced-kopf select { width:auto; }          /* das Grundmodul der Webseite setzt .cw select auf volle Breite */
.ced-kopf .luecke { flex:1; }
.ced-mitte { display:grid; grid-template-columns:230px minmax(0,1fr) 300px; min-height:0; }
.ced-medien, .ced-eig { background:#2B2A28; padding:10px; overflow:auto; min-height:0; }
.ced-medien ul { list-style:none; margin:8px 0; padding:0; }
.ced-medien li { padding:5px 7px; border-radius:6px; cursor:grab; display:flex; justify-content:space-between; gap:6px; background:var(--surface,#30302E); margin-bottom:4px; }
.ced-medien li span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ced-medien li small { color:var(--muted,#9C9A94); }
.ced-medien .hinweis, .ced-eig .hinweis { color:var(--muted,#9C9A94); font-size:12.5px; margin:4px 0 8px; }
.ced-buehne { display:grid; grid-template-rows:minmax(0,1fr) auto; min-height:0; background:var(--bg-deep,#1F1E1D); }
.ced-buehne .flaeche { display:flex; align-items:center; justify-content:center; min-height:0; padding:8px; }
.ced-buehne canvas { max-width:100%; max-height:100%; background:#000; outline:1px solid var(--line,#3D3D3A); }
.ced-lauf { display:flex; gap:6px; align-items:center; padding:6px 8px; background:var(--bg,#262624); flex-wrap:wrap; }
.ced-lauf .zeit { font-weight:600; font-variant-numeric:tabular-nums; margin:0 8px; }
.ced-lauf .info { color:var(--muted,#9C9A94); font-size:12.5px; }
.ced-eig h5 { margin:12px 0 4px; font-size:13.5px; }
.ced-eig h5.titel { color:var(--accent,#D97757); font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ced-eig label { display:grid; grid-template-columns:110px minmax(0,1fr); gap:6px; align-items:center; margin:3px 0; color:#C9C6BF; font-size:13px; }
.ced-eig .knoepfe { display:flex; flex-wrap:wrap; gap:5px; margin:6px 0; }
.ced-eig .knoepfe button { padding:3px 8px; font-size:12.5px; }
.ced-zl { overflow:auto; background:var(--bg,#262624); position:relative; border-top:1px solid var(--line,#3D3D3A); touch-action:pan-x pan-y; }
.ced-zl .innen { position:relative; }
.ced-zl .lineal { position:sticky; top:0; z-index:3; height:24px; background:var(--bg-deep,#1F1E1D); display:flex; }
.ced-zl .ecke { position:sticky; left:0; z-index:4; width:112px; flex:none; background:var(--bg-deep,#1F1E1D); font-weight:600; padding:3px 8px; font-variant-numeric:tabular-nums; }
.ced-zl .skala { position:relative; flex:1; cursor:col-resize; }
.ced-zl .skala i { position:absolute; top:12px; height:12px; border-left:1px solid var(--line,#3D3D3A); font-style:normal; font-size:11px; color:var(--muted,#9C9A94); padding-left:3px; line-height:1; top:4px; height:20px; }
.ced-zl .zeile { display:flex; border-bottom:2px solid var(--bg,#262624); }
.ced-zl .spurkopf { position:sticky; left:0; z-index:2; width:112px; flex:none; background:var(--surface,#30302E); padding:4px 6px; display:flex; flex-direction:column; justify-content:space-between; border-left:3px solid var(--info,#7FA3D6); cursor:pointer; }
.ced-zl .spurkopf.ton { border-left-color:var(--ok,#6BAF73); } .ced-zl .spurkopf.text { border-left-color:var(--accent,#D97757); }
.ced-zl .spurkopf.gewaehlt { background:var(--line,#3D3D3A); }
.ced-zl .spurkopf .knopfe { display:flex; gap:3px; } .ced-zl .spurkopf button { padding:0 6px; font-size:12px; line-height:18px; }
.ced-zl .spurkopf button.aus { color:var(--faint,#6E6C66); background:var(--bg,#262624); }
.ced-zl .bahn { position:relative; flex:1; background:#2B2A28; }
.ced-zl .el { position:absolute; top:3px; bottom:3px; border-radius:6px; overflow:hidden; cursor:grab; border:1px solid rgba(255,255,255,.18);
  background-size:auto 100%; background-repeat:repeat-x; touch-action:none; user-select:none; }
.ced-zl .el.video { background-color:rgba(127,163,214,.35); } .ced-zl .el.bild { background-color:rgba(165,133,214,.35); }
.ced-zl .el.ton { background-color:rgba(107,175,115,.35); } .ced-zl .el.text { background-color:rgba(217,119,87,.35); }
.ced-zl .el.farbe { background-image:none; }
.ced-zl .el.gewaehlt { border:2px solid var(--text,#E8E6E1); } .ced-zl .el.fehlt { background-color:rgba(229,72,77,.35); }
.ced-zl .el span { display:block; font-size:11.5px; padding:1px 5px; background:rgba(31,30,29,.7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ced-zl .el .rand { position:absolute; top:0; bottom:0; width:9px; cursor:ew-resize; } .ced-zl .el .rand.l { left:0; } .ced-zl .el .rand.r { right:0; }
.ced-zl .el .ueb { position:absolute; top:0; bottom:0; left:0; background:linear-gradient(90deg, rgba(31,30,29,.75), transparent); pointer-events:none; }
.ced-zl .el .ueb.sanft { background:linear-gradient(90deg, rgba(165,133,214,.75), transparent); }
.ced-zl .el .vol { position:absolute; left:0; right:0; border-top:2px solid var(--accent,#D97757); pointer-events:none; }
.ced-zl .kopf-linie { position:absolute; top:0; bottom:0; width:2px; background:#E5484D; z-index:5; pointer-events:none; }
.ced-fuss { display:flex; gap:10px; align-items:center; padding:5px 10px; background:var(--bg-deep,#1F1E1D); min-height:32px; flex-wrap:wrap; }
.ced-fuss .balken { width:200px; height:6px; background:var(--line,#3D3D3A); border-radius:3px; overflow:hidden; }
.ced-fuss .balken i { display:block; height:100%; width:0; background:var(--accent,#D97757); }
.ced-fuss .status { color:var(--muted,#9C9A94); flex:1; min-width:200px; }
.ced-fuss .status.fehler { color:#E5484D; } .ced-fuss .status.ok { color:var(--ok,#6BAF73); }
.ced-buehne canvas.griff { cursor:move; touch-action:none; }
.ced-eig .regler { display:grid; grid-template-columns:minmax(0,1fr) 46px; gap:6px; align-items:center; }
.ced-eig .regler input[type=range] { width:100%; accent-color:var(--accent,#D97757); padding:0; border:0; background:none; }
.ced-eig .regler output { text-align:right; font-variant-numeric:tabular-nums; }
.ced-eig .farbknopf { display:flex; align-items:center; gap:8px; text-align:left; min-width:0; overflow:hidden; }
.ced-eig .farbknopf span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ced-eig .farbknopf i { width:30px; height:18px; border:1px solid var(--line,#3D3D3A); border-radius:3px; flex:none; }
.ced-eig .farbrad { background:var(--surface,#30302E); border:1px solid var(--line,#3D3D3A); border-radius:8px; padding:8px; margin:2px 0 8px; display:grid; gap:8px; }
.ced-eig .farbrad .oben { display:flex; gap:8px; align-items:stretch; }
.ced-eig .farbrad canvas { touch-action:none; cursor:crosshair; border-radius:50%; }
.ced-eig .farbrad canvas.leiste { border-radius:4px; }
.ced-eig .farbrad .reihe { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.ced-eig .farbrad .reihe input { width:88px; }
.ced-eig .farbrad .reihe small { color:var(--muted,#9C9A94); }
.ced-eig .farbrad .schnell { display:flex; gap:5px; flex-wrap:wrap; }
.ced-eig .farbrad .schnell button { width:22px; height:22px; padding:0; border-radius:4px; }
.ced-drop { outline:2px dashed var(--accent,#D97757); outline-offset:-6px; }
@media (max-width: 900px) {
  /* untereinander, die Seite rollt: Zeilen dürfen nicht unter ihren Inhalt schrumpfen (sonst überlappt die Vorschau) */
  .ced { grid-template-rows:auto auto auto auto; align-content:start; overflow:auto; }
  .ced > *, .ced-mitte, .ced-buehne, .ced-medien, .ced-eig { min-height:auto; }
  .ced-mitte { grid-template-columns:minmax(0,1fr); }
  .ced-buehne { order:-1; grid-template-rows:auto auto; } .ced-buehne .flaeche { height:42vh; }
  .ced-medien, .ced-eig { max-height:none; overflow:visible; }
  .ced-kopf select { max-width:44vw; } .ced-kopf .luecke { display:none; }
  .ced-zl { height:46vh; }
  .ced-zl .spurkopf, .ced-zl .ecke { width:78px; }
}`;

function h(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== "string") e[k] = v; else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kinder.flat()) if (c != null && c !== false) e.append(c);
  return e;
}
const mb = b => (b / 1024 / 1024).toLocaleString("de-CH", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " MB";
const videoEndung = /\.(mp4|mov|m4v)$/i, bildEndung = /\.(png|jpe?g|webp|bmp|gif)$/i, tonEndung = /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i;

/** Editor öffnen. daten = { profile.json, uebergaenge.json }, dateien = Videos aus dem Schnellfeld (optional). */
export async function oeffnen(ctx, daten, dateien = []) {
  P.uebergaengeSetzen(daten.uebergaenge);
  document.querySelector(".ced")?.remove();
  const stil = h("style", {}, css);
  let p = P.neuesProjekt(), sel = null, selSpur = null, kopf = 0, pps = 60, spielt = false, abbruch = null;
  const medien = new Map();                 // Datei → { datei, info, clip?, url, bitmap?, puffer?, poster? }
  const verlauf = [], wieder = [];

  // ── Gerüst ──
  const profilWahl = h("select", { "aria-label": "Gerät", title: "Gerät oder Plattform: Bildformat, Auflösung, Codec" },
    ...[...new Set(daten.profile.map(x => x.gruppe))].map(g => h("optgroup", { label: g }, ...daten.profile.filter(x => x.gruppe === g).map(x => h("option", { value: x.id }, x.name)))));
  const formWahl = h("select", { "aria-label": "Ausrichtung" }, h("option", { value: "0" }, "Hochkant"), h("option", { value: "1" }, "Quer"));
  const fitWahl = h("select", { "aria-label": "Einpassen oder Füllen", title: "Einpassen: ganzes Bild mit Balken. Füllen: bildschirmfüllend, Ränder abgeschnitten." },
    h("option", { value: "Einpassen" }, "Einpassen"), h("option", { value: "Fuellen" }, "Füllen"));
  const knExport = h("button", { class: "haupt", onclick: () => exportStarten() }, "Exportieren");
  const dateiWahl = h("input", { type: "file", multiple: true, hidden: true, accept: "video/*,image/*,audio/*,.caelumcut" });
  const kopfLeiste = h("div", { class: "ced-kopf" },
    h("b", {}, "Caelum Cut · Editor"),
    h("button", { onclick: () => { if (bestaetigen()) { p = P.neuesProjekt(); sel = null; neu(true); } } }, "Neu"),
    h("button", { onclick: () => dateiWahl.click(), title: "Videos, Bilder, Musik oder ein Projekt (.caelumcut)" }, "Öffnen"),
    h("button", { onclick: speichernProjekt, title: "Projekt als .caelumcut speichern (öffnet auch die App)" }, "Speichern"),
    h("button", { onclick: rueck, title: "Rückgängig (Strg+Z)" }, "↶"), h("button", { onclick: vor, title: "Wiederholen (Strg+Y)" }, "↷"),
    profilWahl, formWahl, fitWahl,
    h("button", { onclick: () => spurNeu("Video"), title: "Videospur: obere Spuren liegen über den unteren" }, "+ Video"),
    h("button", { onclick: () => spurNeu("Audio") }, "+ Ton"), h("button", { onclick: () => spurNeu("Text") }, "+ Text"),
    h("button", { onclick: () => spurWeg(selSpur), title: "Angeklickte Spur entfernen" }, "− Spur"),
    h("span", { class: "luecke" }), knExport,
    h("button", { onclick: schliessen, title: "Editor schließen", "aria-label": "Schließen" }, "✕"), dateiWahl);

  const medienListe = h("ul", {});
  const medienFeld = h("div", { class: "ced-medien" },
    h("b", {}, "Medien"), h("div", { class: "hinweis" }, "Hineinziehen oder wählen. Doppelklick oder Ziehen → Zeitleiste."),
    h("div", { class: "knoepfe", style: "display:flex;gap:5px;flex-wrap:wrap" },
      h("button", { onclick: () => dateiWahl.click() }, "+ Importieren"), h("button", { onclick: titelNeu }, "Titel"),
      h("button", { onclick: farbeNeu, title: "Farbblock am Abspielkopf (Länge frei, mit Übergängen)" }, "Farbe")),
    medienListe,
    h("div", { class: "hinweis" }, "Alles bleibt auf deinem Gerät."));

  const buehne = h("canvas", { width: 360, height: 640 });
  const gb = buehne.getContext("2d");
  const zeitAnz = h("span", { class: "zeit" }), info = h("span", { class: "info" });
  const knSpiel = h("button", { onclick: () => spielen(!spielt), title: "Abspielen / anhalten (Leertaste)" }, "▶");
  const lauf = h("div", { class: "ced-lauf" },
    h("button", { onclick: () => setzeKopf(0), title: "Zum Anfang" }, "⏮"), h("button", { onclick: () => setzeKopf(kopf - 1) }, "−1 s"),
    knSpiel, h("button", { onclick: () => setzeKopf(kopf + 1) }, "+1 s"),
    h("button", { onclick: teilenJetzt, title: "Am Abspielkopf teilen (S)" }, "Teilen"), h("button", { onclick: loeschen, title: "Löschen (Entf)" }, "Löschen"),
    h("button", { onclick: () => zoom(1.3), title: "Hineinzoomen" }, "+"), h("button", { onclick: () => zoom(1 / 1.3), title: "Herauszoomen" }, "−"),
    h("button", { onclick: einpassen, title: "Ganze Zeitleiste zeigen" }, "⇔"), zeitAnz, info);
  const buehnenFeld = h("div", { class: "ced-buehne" }, h("div", { class: "flaeche" }, buehne), lauf);
  const eig = h("div", { class: "ced-eig" });
  const zl = h("div", { class: "ced-zl", tabindex: "0" });
  const balken = h("div", { class: "balken", hidden: true }, h("i", {}));
  const status = h("span", { class: "status" }, "Medien hineinziehen. Obere Videospuren liegen über den unteren.");
  const knAbbruch = h("button", { hidden: true, onclick: () => abbruch?.abort() }, "Abbrechen");
  const fuss = h("div", { class: "ced-fuss" }, balken, status, knAbbruch);
  const wurzel = h("div", { class: "ced cw", role: "dialog", "aria-label": "Caelum Cut Editor" }, stil, kopfLeiste, h("div", { class: "ced-mitte" }, medienFeld, buehnenFeld, eig), zl, fuss);
  document.body.append(wurzel);
  const altOverflow = document.body.style.overflow; document.body.style.overflow = "hidden";

  function melde(text, art = "") { status.textContent = text; status.className = "status " + art; }
  if (!kannKodieren()) melde("Dieser Browser kann keine Videos kodieren (WebCodecs fehlt). Bearbeiten geht, Exportieren nur in Chrome/Edge oder mit der App.", "fehler");

  // ── Verlauf ──
  const anhang = () => new Map(p.Tracks.flatMap(t => t.Items).map(i => [i.Id, { datei: i.datei, info: i.info }]));
  function schnappschuss() { return { json: P.zuJson(p), anh: anhang() }; }
  function zurueck(s) {
    p = P.ausJson(s.json);
    for (const t of p.Tracks) for (const it of t.Items) Object.assign(it, s.anh.get(it.Id) ?? {});
    sel = null; neu(false);
  }
  let letzter = schnappschuss();
  function merken() { const s = schnappschuss(); if (s.json === letzter.json) return; verlauf.push(letzter); if (verlauf.length > 60) verlauf.shift(); wieder.length = 0; letzter = s; }
  function rueck() { if (!verlauf.length) return; wieder.push(letzter); letzter = verlauf.pop(); zurueck(letzter); melde("Rückgängig."); }
  function vor() { if (!wieder.length) return; verlauf.push(letzter); letzter = wieder.pop(); zurueck(letzter); melde("Wiederholt."); }
  function bestaetigen() { return !p.Tracks.some(t => t.Items.length) || confirm("Das aktuelle Projekt verwerfen? (Vorher „Speichern“, wenn du es behalten willst.)"); }

  // ── Medien ──
  async function hinzufuegen(dateien, ziel = null) {
    const liste = [...dateien];
    const projekt = liste.find(f => /\.caelumcut$/i.test(f.name));
    if (projekt) { if (bestaetigen()) await projektLaden(projekt); liste.splice(liste.indexOf(projekt), 1); }
    const neu_ = [];
    for (const f of liste) {
      try {
        if (medien.has(f)) { neu_.push(f); continue; }
        let m;
        if (videoEndung.test(f.name) || f.type.startsWith("video/")) {
          const clip = await lesen(f);
          m = { datei: f, clip, info: { w: clip.breite, h: clip.hoehe, dauer: clip.dauer, ton: clip.ton, fps: clip.fps, bild: false } };
        } else if (bildEndung.test(f.name) || f.type.startsWith("image/")) {
          const bitmap = await createImageBitmap(f);
          m = { datei: f, bitmap, info: { w: bitmap.width, h: bitmap.height, dauer: 0, ton: false, bild: true } };
        } else if (tonEndung.test(f.name) || f.type.startsWith("audio/")) {
          const puffer = await tonPuffer(f);
          m = { datei: f, puffer, info: { w: 0, h: 0, dauer: puffer.duration, ton: true, bild: false } };
        } else { melde(`${f.name}: unbekannte Datei.`, "fehler"); continue; }
        m.url = URL.createObjectURL(f);
        medien.set(f, m); neu_.push(f);
        if (!m.info.bild && m.info.w > 0) poster(m);
        // fehlende Dateien eines geöffneten Projekts zuordnen (über den Namen)
        for (const t of p.Tracks) for (const it of t.Items) if (!it.datei && it.Path && it.Path.split(/[\\/]/).pop() === f.name) { it.datei = f; it.info = m.info; }
      } catch (e) { melde(e instanceof KodierFehler ? e.message : `${f.name}: ${e.message || e}`, "fehler"); }
    }
    medienZeichnen();
    if (ziel && neu_.length) { const last = einfuegen(neu_, ziel.spur, ziel.sek); if (last) { sel = last; merken(); } }
    neu(false);
  }
  const tonCache = new Map();
  async function tonPuffer(f) {
    if (!tonCache.has(f)) tonCache.set(f, (async () => { const ctxA = new OfflineAudioContext(2, 48000, 48000); return ctxA.decodeAudioData(await f.arrayBuffer()); })());
    return tonCache.get(f);
  }
  function poster(m) {
    const v = h("video", { src: m.url, muted: true, preload: "auto", playsInline: true });
    v.addEventListener("loadeddata", () => { v.currentTime = Math.min(1, (m.info.dauer || 1) / 2); }, { once: true });
    v.addEventListener("seeked", () => {
      const c = document.createElement("canvas"); c.height = 60; c.width = Math.round(60 * v.videoWidth / Math.max(1, v.videoHeight));
      c.getContext("2d").drawImage(v, 0, 0, c.width, c.height); m.poster = c.toDataURL("image/jpeg", 0.7); v.removeAttribute("src"); v.load(); zeitleiste();
    }, { once: true });
  }
  function medienZeichnen() {
    medienListe.replaceChildren(...[...medien.values()].map(m => {
      const li = h("li", { draggable: true, title: `${m.datei.name} · ${mb(m.datei.size)}`, ondblclick: () => { const it = einfuegen([m.datei], selSpur, kopf); if (it) { sel = it; setzeKopf(P.ende(it)); merken(); neu(false); } } },
        h("span", {}, m.datei.name), h("small", {}, m.info.bild ? "Bild" : (m.info.w ? "" : "♪ ") + zeit(m.info.dauer)));
      li.addEventListener("dragstart", e => { e.dataTransfer.setData("text/caelum-medium", m.datei.name); ziehMedium = m.datei; });
      return li;
    }));
  }
  let ziehMedium = null;

  /** Dateien ab Sekunde sek einfügen: auf die Spur, wenn sie passt, sonst auf die erste passende (oder eine neue). */
  function einfuegen(dateien, spur, sek) {
    let last = null; const ab = { bild: Math.max(0, sek), ton: Math.max(0, sek) };      // Videos/Bilder und Musik je für sich ab sek
    for (const f of dateien) {
      const m = medien.get(f); if (!m) continue;
      const nurTon = !m.info.bild && !m.info.w, k = nurTon ? "ton" : "bild";
      const it = P.element({ Path: f.name, Start: ab[k], In: 0, Out: m.info.bild ? 4 : Math.max(0.1, m.info.dauer) });
      it.datei = f; it.info = m.info;
      const passt = s => s && (s.Kind === "Text" ? false : s.Kind === "Video" ? !nurTon : m.info.ton);
      const s = passt(spur) ? spur : nurTon ? (p.Tracks.find(t => t.Kind === "Audio") ?? P.spurDazu(p, "Audio"))
                                           : (P.vonUnten(p, "Video")[0] ?? P.spurDazu(p, "Video"));
      s.Items.push(it); ab[k] = P.ende(it); last = it;
    }
    return last;
  }

  // ── Projekt ──
  function speichernProjekt() {
    const name = (p.Tracks.flatMap(t => t.Items).find(i => i.datei)?.datei.name.replace(/\.[^.]+$/, "") ?? "Projekt") + ".caelumcut";
    ctx.speichern(new Blob([P.zuJson(p)], { type: "application/json" }), name);
    melde(`Gespeichert: ${name} – öffnet auch die App (Caelum Cut › Editor).`, "ok");
  }
  async function projektLaden(f) {
    try {
      p = P.ausJson(await f.text()); sel = null;
      const namen = new Map([...medien.values()].map(m => [m.datei.name, m]));
      const fehlen = new Set();
      for (const t of p.Tracks) for (const it of t.Items) {
        if (P.istText(it) || P.istFarbe(it)) continue;
        const m = namen.get(String(it.Path).split(/[\\/]/).pop());
        if (m) { it.datei = m.datei; it.info = m.info; } else fehlen.add(String(it.Path).split(/[\\/]/).pop());
      }
      verlauf.length = 0; wieder.length = 0; letzter = schnappschuss(); neu(false);
      melde(fehlen.size ? `Projekt geöffnet. Bitte diese Dateien hineinziehen: ${[...fehlen].slice(0, 4).join(", ")}${fehlen.size > 4 ? " …" : ""}` : "Projekt geöffnet.", fehlen.size ? "fehler" : "ok");
    } catch (e) { melde("Projekt nicht lesbar: " + (e.message || e), "fehler"); }
  }

  // ── Spuren und Elemente ──
  function spurNeu(art) { const t = P.spurDazu(p, art); selSpur = t; merken(); neu(false); melde(`Spur ${t.Name} hinzugefügt.`); }
  function spurWeg(t) {
    if (!t) return melde("Erst eine Spur anklicken (links auf den Spurnamen).", "fehler");
    if (t.Kind === "Video" && p.Tracks.filter(x => x.Kind === "Video").length === 1) return melde("Mindestens eine Videospur bleibt.", "fehler");
    if (t.Items.length && !confirm(`Spur ${t.Name} mit ${t.Items.length} Element(en) entfernen?`)) return;
    p.Tracks.splice(p.Tracks.indexOf(t), 1); if (sel && !P.spurVon(p, sel)) sel = null; selSpur = null; merken(); neu(false);
  }
  function titelNeu() {
    const t = selSpur?.Kind === "Text" ? selSpur : p.Tracks.find(x => x.Kind === "Text") ?? P.spurDazu(p, "Text");
    const it = P.element({ Text: "Titel", Start: kopf, In: 0, Out: 3 }); t.Items.push(it); sel = it; merken(); neu(false);
    eig.querySelector("textarea")?.select();
  }
  let letzteFarbe = "#D97757";
  /** Wie EditorWindow.AddColorBlock: gewählte Videospur, sonst oberste Videospur mit Platz, sonst V1. */
  function farbeNeu() {
    const frei = t => !t.Items.some(i => kopf + 3 > i.Start && kopf < P.ende(i));
    const t = selSpur?.Kind === "Video" ? selSpur : p.Tracks.filter(x => x.Kind === "Video").find(frei) ?? P.vonUnten(p, "Video")[0];
    const it = P.farbblock(letzteFarbe, kopf); t.Items.push(it); sel = it; selSpur = t; merken(); neu(false);
    melde(`Farbblock auf ${t.Name}: Länge am Rand ziehen, Farbe rechts im Farbrad.`);
  }
  function amKopf() {
    if (sel && kopf > sel.Start && kopf < P.ende(sel)) return sel;
    const s = selSpur ?? P.vonUnten(p, "Video")[0];
    return s?.Items.find(i => kopf > i.Start && kopf < P.ende(i));
  }
  function teilenJetzt() {
    const it = amKopf(); if (!it) return melde("Am Abspielkopf liegt auf dieser Spur nichts zum Teilen.", "fehler");
    const r = P.teilen(p, it, kopf); if (r) { r.datei = it.datei; r.info = it.info; sel = r; merken(); neu(false); melde("Geteilt."); }
  }
  function loeschen() { if (!sel) return; const s = P.spurVon(p, sel); s.Items.splice(s.Items.indexOf(sel), 1); sel = null; merken(); neu(false); }
  function duplizieren() { if (!sel) return; const c = { ...sel, Id: P.neueId(), Start: P.ende(sel), Transition: "keine" }; P.spurVon(p, sel).Items.push(c); sel = c; merken(); neu(false); }

  // ── Zeichnen ──
  function neu(scrollen) {
    profilWahl.value = p.ProfileId; formWahl.value = p.Landscape ? "1" : "0"; fitWahl.value = p.Fit;
    zeitleiste(); eigenschaften(); vorschau(); if (scrollen) einpassen();
  }
  function vorschau() {
    const [W, H] = P.flaecheVon(p, datenProfile);
    const k = Math.min(1, 720 / Math.max(W, H)), w = Math.round(W * k), hh = Math.round(H * k);
    if (buehne.width !== w || buehne.height !== hh) { buehne.width = w; buehne.height = hh; }
    const amSchirm = buehne.getBoundingClientRect().width;                         // Griffe am Schirm immer etwa 11 px groß
    zeichnen(gb, p, kopf, w, hh, quelleVorschau, { markiere: sel, rahmen: !spielt, griff: amSchirm > 0 ? Math.round(11 * w / amSchirm) : 0 });
    zeitAnz.textContent = `${zeit(kopf)} / ${zeit(P.dauer(p))}`;
    const pr = datenProfile.profile.find(x => x.id === p.ProfileId);
    const warn = pr?.maxSekunden != null && P.dauer(p) > pr.maxSekunden + 0.05 ? ` · ⚠ ${pr.name} erlaubt bis ${zeit(pr.maxSekunden)}` : "";
    info.textContent = `${W}×${H} · ${pr?.hevc ? "H.265" : "H.264"}${warn}`;
  }
  const datenProfile = daten;
  // Video-Elemente je Element (für Vorschau und Abspielen)
  const pool = new Map();
  function element(it) {
    let v = pool.get(it.Id);
    const m = medien.get(it.datei);
    if (!m) return null;
    if (!v || v._url !== m.url) {
      v?.pause();
      v = h(m.info.w ? "video" : "audio", { src: m.url, preload: "auto", playsInline: true, muted: true });
      v._url = m.url; v.addEventListener("seeked", () => { if (!spielt) vorschau(); }); v.addEventListener("loadeddata", () => { if (!spielt) vorschau(); });
      pool.set(it.Id, v);
    }
    return v;
  }
  function quelleVorschau(it) {
    const m = medien.get(it.datei); if (!m) return null;
    if (m.info.bild) return { bild: m.bitmap, w: m.bitmap.width, h: m.bitmap.height };
    const v = element(it); if (!v || v.readyState < 2) return null;
    const soll = quellZeit(it, kopf);
    if (!spielt && Math.abs(v.currentTime - soll) > 0.02 && !v.seeking) v.currentTime = soll;
    return { bild: v, w: v.videoWidth, h: v.videoHeight };
  }

  // ── Griffe: gewähltes Bild-Element in der Vorschau verschieben (innen) und skalieren (Ecken), wie PreviewView ──
  function buehnenPunkt(e) { const r = buehne.getBoundingClientRect(); return [(e.clientX - r.left) * buehne.width / r.width, (e.clientY - r.top) * buehne.height / r.height, buehne.width / r.width]; }
  function griffAn(x, y, k) {
    const b = spielt ? null : griffFlaeche(p, sel, kopf, buehne.width, buehne.height); if (!b) return null;
    const tol = Math.max(10, 14 * k);
    const e = ecken(b).findIndex(([cx, cy]) => Math.abs(x - cx) <= tol && Math.abs(y - cy) <= tol);
    if (e >= 0) return { b, ecke: e };
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h ? { b, ecke: -1 } : null;
  }
  let griffZug = null;
  buehne.addEventListener("pointermove", e => {
    if (griffZug) return;
    const [x, y, k] = buehnenPunkt(e), g = griffAn(x, y, k);
    buehne.style.cursor = !g ? "" : g.ecke < 0 ? "move" : g.ecke % 2 === 0 ? "nwse-resize" : "nesw-resize";
  });
  buehne.addEventListener("pointerdown", e => {
    const [x, y, k] = buehnenPunkt(e), g = griffAn(x, y, k); if (!g) return;
    e.preventDefault(); buehne.setPointerCapture(e.pointerId); buehne.classList.add("griff");
    const W = buehne.width, H = buehne.height, it = sel, a = { X: it.X, Y: it.Y, Scale: it.Scale };
    const fest = g.ecke >= 0 ? ecken(g.b)[(g.ecke + 2) % 4] : null;
    griffZug = { it, a };
    const r4 = v => Math.round(v * 1e4) / 1e4;
    const mv = ev => {
      const [mx, my] = buehnenPunkt(ev);
      if (!fest) { it.X = r4(Math.min(1.5, Math.max(-0.5, a.X + (mx - x) / W))); it.Y = r4(Math.min(1.5, Math.max(-0.5, a.Y + (my - y) / H))); }
      else {
        // gegenüberliegende Ecke bleibt stehen, Größe gleichmäßig
        const s = r4(Math.min(3, Math.max(0.05, Math.max(Math.abs(mx - fest[0]) / W, Math.abs(my - fest[1]) / H))));
        const sx = g.ecke === 1 || g.ecke === 2 ? 1 : -1, sy = g.ecke === 2 || g.ecke === 3 ? 1 : -1;
        it.Scale = s; it.X = r4(fest[0] / W + sx * s / 2); it.Y = r4(fest[1] / H + sy * s / 2);
      }
      vorschau();
    };
    const up = () => {
      buehne.removeEventListener("pointermove", mv); buehne.removeEventListener("pointerup", up); buehne.removeEventListener("pointercancel", up);
      buehne.classList.remove("griff"); griffZug = null;
      if (it.X !== a.X || it.Y !== a.Y || it.Scale !== a.Scale) { merken(); eigenschaften(); }
    };
    buehne.addEventListener("pointermove", mv); buehne.addEventListener("pointerup", up); buehne.addEventListener("pointercancel", up);
  });

  // ── Abspielen ──
  let t0 = 0, k0 = 0;
  function spielen(an) {
    spielt = an; knSpiel.textContent = an ? "⏸" : "▶";
    if (!an) { for (const v of pool.values()) v.pause(); vorschau(); zeitleisteKopf(); return; }
    if (kopf >= P.dauer(p) - 0.05) kopf = 0;
    t0 = performance.now(); k0 = kopf; requestAnimationFrame(schritt);
  }
  function schritt() {
    if (!spielt) return;
    kopf = k0 + (performance.now() - t0) / 1000;
    if (kopf >= P.dauer(p)) { kopf = P.dauer(p); spielen(false); return; }
    const aktiv = new Set();
    // Bild
    for (const { it, sek } of gebraucht(p, kopf)) if (!P.istBild(it)) { aktiv.add(it.Id); synchron(it, sek); }
    // Ton (auch von ausgeblendeten Videospuren und Tonspuren)
    for (const s of p.Tracks.filter(t => t.Kind !== "Text"))
      for (const it of s.Items) {
        if (P.istText(it) || !it.info?.ton || P.istBild(it) || kopf < it.Start || kopf >= P.ende(it)) continue;
        aktiv.add(it.Id); const v = synchron(it, quellZeit(it, kopf)); if (!v) continue;
        v.muted = s.Muted; v.volume = Math.min(1, Math.max(0, it.Volume * (s.Volume ?? 1) * (p.MasterVolume ?? 1)));
      }
    for (const [id, v] of pool) if (!aktiv.has(id)) { v.pause(); v.muted = true; }
    vorschau(); zeitleisteKopf();
    requestAnimationFrame(schritt);
  }
  function synchron(it, sek) {
    const v = element(it); if (!v) return null;
    v.playbackRate = Math.min(4, Math.max(0.25, it.Speed));
    if (v.paused) { v.currentTime = sek; v.play().catch(() => {}); }
    else if (Math.abs(v.currentTime - sek) > 0.3) v.currentTime = sek;
    return v;
  }

  // ── Zeitleiste ──
  const KOPF = () => matchMedia("(max-width: 900px)").matches ? 78 : 112;
  const hoehe = art => art === "Video" ? 56 : art === "Audio" ? 44 : 32;
  let zlInnen, kopfLinie, zlEcke;
  function zeitleiste() {
    const breite = Math.max(zl.clientWidth - KOPF(), (P.dauer(p) + 10) * pps);
    const skala = h("div", { class: "skala", style: `width:${breite}px` });
    const schritte = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const st = schritte.find(s => s * pps >= 64) ?? 300;
    // Zehntel nur zeigen, wenn die Teilung feiner als 1 s ist (sonst stünde jede Sekunde doppelt da)
    for (let s = 0; s * pps < breite; s += st) skala.append(h("i", { style: `left:${s * pps}px` }, st < 1 ? zeit(s) : zeit(s).replace(/\.\d$/, "")));
    zlEcke = h("div", { class: "ecke" }, zeit(kopf));
    const zeilen = p.Tracks.map(t => {
      const kopfEl = h("div", { class: `spurkopf ${t.Kind === "Audio" ? "ton" : t.Kind === "Text" ? "text" : ""} ${t === selSpur ? "gewaehlt" : ""}`, onclick: () => { selSpur = t; sel = null; neu(false); } },
        h("b", {}, t.Name),
        h("div", { class: "knopfe" },
          t.Kind !== "Audio" ? h("button", { class: t.Hidden ? "aus" : "", title: "Ausblenden", onclick: e => { e.stopPropagation(); t.Hidden = !t.Hidden; merken(); neu(false); } }, t.Hidden ? "○" : "◉") : null,
          t.Kind !== "Text" ? h("button", { class: t.Muted ? "aus" : "", title: "Stumm", onclick: e => { e.stopPropagation(); t.Muted = !t.Muted; merken(); neu(false); } }, t.Muted ? "✕" : "♪") : null,
          h("button", { title: "Spur entfernen", onclick: e => { e.stopPropagation(); spurWeg(t); } }, "−")));
      const bahn = h("div", { class: "bahn", style: `width:${breite}px;height:${hoehe(t.Kind)}px` });
      bahn._spur = t;
      for (const it of t.Items) bahn.append(elementDiv(it, t));
      bahn.addEventListener("pointerdown", e => { if (e.target === bahn) { selSpur = t; sel = null; kopfZiehen(e, bahn); } });
      bahn.addEventListener("dragover", e => { e.preventDefault(); bahn.classList.add("ced-drop"); });
      bahn.addEventListener("dragleave", () => bahn.classList.remove("ced-drop"));
      bahn.addEventListener("drop", e => {
        e.preventDefault(); e.stopPropagation(); bahn.classList.remove("ced-drop");
        const sek = Math.max(0, (e.clientX - bahn.getBoundingClientRect().left) / pps);
        if (e.dataTransfer.files?.length) hinzufuegen(e.dataTransfer.files, { spur: t, sek });
        else if (ziehMedium) { const it = einfuegen([ziehMedium], t, sek); ziehMedium = null; if (it) { sel = it; merken(); neu(false); } }
      });
      return h("div", { class: "zeile" }, kopfEl, bahn);
    });
    kopfLinie = h("div", { class: "kopf-linie" });
    zlInnen = h("div", { class: "innen" }, h("div", { class: "lineal" }, zlEcke, skala), ...zeilen, kopfLinie);
    skala.addEventListener("pointerdown", e => kopfZiehen(e, skala));
    const sx = zl.scrollLeft, sy = zl.scrollTop;
    zl.replaceChildren(zlInnen); zl.scrollLeft = sx; zl.scrollTop = sy;
    zeitleisteKopf();
  }
  function zeitleisteKopf() {
    if (!kopfLinie) return;
    kopfLinie.style.left = `${KOPF() + kopf * pps}px`;
    if (zlEcke) zlEcke.textContent = zeit(kopf);
    if (spielt) { const x = KOPF() + kopf * pps; if (x > zl.scrollLeft + zl.clientWidth - 40) zl.scrollLeft = x - KOPF() - 40; }
  }
  function elementDiv(it, t) {
    const d = P.uebergang(it.Transition), text = P.istText(it), bild = P.istBild(it), m = medien.get(it.datei);
    const farbe = P.istFarbe(it);
    const art = farbe ? "farbe" : text ? "text" : !it.datei ? "fehlt" : bild ? "bild" : t.Kind === "Audio" || !it.info?.w ? "ton" : "video";
    const div = h("div", { class: `el ${art} ${it === sel ? "gewaehlt" : ""}`, style: `left:${it.Start * pps}px;width:${Math.max(4, P.laenge(it) * pps)}px` },
      P.hatUebergang(it) && !text ? h("div", { class: `ueb ${d.sanft ? "sanft" : ""}`, style: `width:${Math.max(8, it.TransitionSec * pps)}px` }) : null,
      !text && it.info?.ton && !bild && Math.abs(it.Volume - 1) > 0.005 ? h("div", { class: "vol", style: `bottom:${Math.min(100, it.Volume * 50)}%` }) : null,
      h("span", {}, P.name(it) + (!it.datei && !text && !farbe ? " – fehlt" : "") + (Math.abs(it.Speed - 1) > 0.01 && !P.zeitfrei(it) ? ` ×${it.Speed}` : "") +
        (!text && it.info?.ton && Math.abs(it.Volume - 1) > 0.005 ? ` ♪ ${Math.round(it.Volume * 100)} %` : "") + (P.beschnitten(it) ? " ⌗" : "") +
        (P.hatUebergang(it) ? ` ◢ ${d.name}` : "")),
      h("div", { class: "rand l" }), h("div", { class: "rand r" }));
    if (m?.poster && art === "video") div.style.backgroundImage = `url(${m.poster})`;
    if (farbe) div.style.backgroundColor = it.Fill;
    if (art === "bild" && m) { if (!m.poster) { const c = document.createElement("canvas"); c.height = 60; c.width = Math.round(60 * m.bitmap.width / m.bitmap.height); c.getContext("2d").drawImage(m.bitmap, 0, 0, c.width, c.height); m.poster = c.toDataURL("image/jpeg", 0.7); } div.style.backgroundImage = `url(${m.poster})`; }
    div.addEventListener("pointerdown", e => elementZiehen(e, it, div));
    div.addEventListener("contextmenu", e => { e.preventDefault(); sel = it; neu(false); });
    return div;
  }
  function kopfZiehen(e, ziel) {
    const r = ziel.getBoundingClientRect();
    const setz = x => setzeKopf(Math.max(0, (x - r.left) / pps));
    setz(e.clientX); ziel.setPointerCapture(e.pointerId);
    const mv = ev => setz(ev.clientX), up = () => { ziel.removeEventListener("pointermove", mv); ziel.removeEventListener("pointerup", up); };
    ziel.addEventListener("pointermove", mv); ziel.addEventListener("pointerup", up);
  }
  function fangen(sek, ausser) {
    let best = sek, d = 8 / pps;
    for (const s of [0, kopf, ...p.Tracks.flatMap(t => t.Items.filter(i => i !== ausser).flatMap(i => [i.Start, P.ende(i)]))])
      if (Math.abs(s - sek) < d) { d = Math.abs(s - sek); best = s; }
    return best;
  }
  function elementZiehen(e, it, div) {
    e.preventDefault(); e.stopPropagation();
    if (sel !== it) { sel = it; selSpur = P.spurVon(p, it); eigenschaften(); vorschau(); for (const x of zl.querySelectorAll(".el.gewaehlt")) x.classList.remove("gewaehlt"); div.classList.add("gewaehlt"); }
    const rand = e.target.classList.contains("rand") ? (e.target.classList.contains("l") ? "l" : "r") : null;
    const x0 = e.clientX, a = { Start: it.Start, In: it.In, Out: it.Out }, speed = P.zeitfrei(it) ? 1 : it.Speed;
    let bewegt = false;
    div.setPointerCapture(e.pointerId);
    const mv = ev => {
      const dsek = (ev.clientX - x0) / pps;
      if (!bewegt && Math.abs(ev.clientX - x0) < 3) return;
      bewegt = true;
      if (!rand) {
        let ns = Math.max(0, a.Start + dsek);
        const s1 = fangen(ns, it), s2 = fangen(ns + P.laenge(it), it) - P.laenge(it);
        it.Start = Math.max(0, Math.abs(s1 - ns) <= Math.abs(s2 - ns) ? s1 : s2);
        // auf eine andere Spur derselben Art
        const unter = document.elementsFromPoint(ev.clientX, ev.clientY).find(x => x.classList?.contains("bahn"));
        const ziel = unter?._spur, jetzt = P.spurVon(p, it);
        const nurTon = !P.istText(it) && !P.istFarbe(it) && !it.info?.bild && !it.info?.w;
        const passt = ziel && ziel !== jetzt && (ziel.Kind === "Text" ? P.istText(it) : ziel.Kind === "Video" ? !P.istText(it) && !nurTon : !P.istText(it) && !P.istFarbe(it) && it.info?.ton);
        if (passt) { jetzt.Items.splice(jetzt.Items.indexOf(it), 1); ziel.Items.push(it); selSpur = ziel; zeitleiste(); return; }
      } else if (rand === "l") {
        let ns = fangen(a.Start + dsek, it), delta = ns - a.Start;
        const min = P.zeitfrei(it) ? -a.Start : Math.max(-a.Start, -a.In / speed), max = (a.Out - a.In) / speed - 0.2;
        delta = Math.min(max, Math.max(min, delta));
        it.Start = a.Start + delta; if (P.zeitfrei(it)) it.Out = a.Out - delta; else it.In = a.In + delta * speed;
      } else {
        const ne = fangen(a.Start + (a.Out - a.In) / speed + dsek, it);
        let out = a.In + Math.max(0.2, ne - a.Start) * speed;
        if (!P.zeitfrei(it) && it.info) out = Math.min(out, it.info.dauer);
        it.Out = out;
      }
      div.style.left = `${it.Start * pps}px`; div.style.width = `${Math.max(4, P.laenge(it) * pps)}px`; vorschau();
    };
    const up = () => { div.removeEventListener("pointermove", mv); div.removeEventListener("pointerup", up); if (bewegt) { merken(); neu(false); } };
    div.addEventListener("pointermove", mv); div.addEventListener("pointerup", up);
  }
  function setzeKopf(s) { kopf = Math.max(0, Math.min(s, Math.max(P.dauer(p), 0))); if (spielt) { k0 = kopf; t0 = performance.now(); } vorschau(); zeitleisteKopf(); }
  function zoom(f) { const mitte = (zl.scrollLeft + zl.clientWidth / 2 - KOPF()) / pps; pps = Math.min(600, Math.max(2, pps * f)); zeitleiste(); zl.scrollLeft = Math.max(0, mitte * pps - zl.clientWidth / 2 + KOPF()); }
  function einpassen() { pps = Math.min(600, Math.max(2, (zl.clientWidth - KOPF() - 20) / Math.max(5, P.dauer(p) * 1.08))); zeitleiste(); zl.scrollLeft = 0; }
  zl.addEventListener("wheel", e => { if (e.ctrlKey) { e.preventDefault(); zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2); } }, { passive: false });
  zl.addEventListener("dragover", e => e.preventDefault());

  // ── Eigenschaften ──
  function feld(label, wert, min, max, schrittW, setze, einheit = "") {
    const inp = h("input", { type: "number", min, max, step: schrittW, value: Math.round(wert * 100) / 100 });
    inp.addEventListener("change", () => { const v = Math.min(max, Math.max(min, parseFloat(inp.value.replace(",", ".")))); if (isNaN(v)) return; setze(v); merken(); neu(false); });
    return h("label", {}, h("span", {}, label + einheit), inp);
  }
  function haken(label, wert, setze) { const c = h("input", { type: "checkbox", checked: wert, style: "justify-self:start" }); c.addEventListener("change", () => { setze(c.checked); merken(); neu(false); }); return h("label", {}, h("span", {}, label), c); }
  function wahl(label, optionen, wert, setze) {
    const s = h("select", {}, ...optionen.map(o => o.gruppe ? h("optgroup", { label: o.gruppe }, ...o.liste.map(x => h("option", { value: x[0] }, x[1]))) : h("option", { value: o[0] }, o[1])));
    s.value = wert; s.addEventListener("change", () => { setze(s.value); merken(); neu(false); });
    return h("label", {}, h("span", {}, label), s);
  }
  /** Schieber 0–100 % für einen Anteil 0 … 1 (Deckkraft); zieht die Vorschau sofort mit. */
  function regler(label, wert01, setze) {
    const r = h("input", { type: "range", min: 0, max: 100, step: 1, value: Math.round(Math.min(1, Math.max(0, wert01)) * 100), "aria-label": label });
    const o = h("output", {}, r.value + " %");
    r.addEventListener("input", () => { o.textContent = r.value + " %"; setze(r.value / 100); vorschau(); });
    r.addEventListener("change", () => { merken(); zeitleiste(); });
    return h("label", {}, h("span", {}, label), h("div", { class: "regler" }, r, o));
  }
  /** Farbfeld; Klick klappt das RGB-Farbrad auf (Farbton rundum, Sättigung nach außen, Helligkeit daneben, Hex, schnelle Farben). */
  function farbFeld(label, hex, setze) {
    const knopf = h("button", { class: "farbknopf", type: "button" }, h("i", {}), h("span", {}));
    const zeigen = x => { knopf.firstChild.style.background = x; knopf.lastChild.textContent = x + " ▾"; knopf.title = "Farbrad öffnen"; };
    zeigen(hex = normHex(hex));
    let rad = null;
    const zeile = h("label", {}, h("span", {}, label), knopf);
    knopf.addEventListener("click", e => {
      e.preventDefault();
      if (rad) { rad.remove(); rad = null; merken(); zeitleiste(); return; }
      rad = farbRad(hex, x => { hex = x; zeigen(x); setze(x); vorschau(); }, () => { rad?.remove(); rad = null; merken(); zeitleiste(); });
      zeile.after(rad);
    });
    return zeile;
  }
  const knoepfe = (...l) => h("div", { class: "knoepfe" }, ...l.map(([t, f]) => h("button", { onclick: () => { f(); merken(); neu(false); } }, t)));
  function eigenschaften() {
    const teile = [];
    const it = sel;
    if (!it) {
      const pr = datenProfile.profile.find(x => x.id === p.ProfileId), [W, H] = P.flaecheVon(p, datenProfile);
      teile.push(h("h5", { class: "titel" }, pr ? `${pr.gruppe} · ${pr.name}` : "Projekt"),
        h("div", { class: "hinweis" }, `Ausgabe ${W}×${H}, ${p.Fit === "Fuellen" ? "füllend (Ränder abgeschnitten)" : "eingepasst (Balken wo nötig)"}. Länge ${zeit(P.dauer(p))}, ${p.Tracks.length} Spuren.`));
      if (selSpur && selSpur.Kind !== "Text") {
        const t = selSpur;
        teile.push(h("h5", {}, `Spur ${t.Name}`), feld("Lautstärke", t.Volume * 100, 0, 200, 5, v => t.Volume = v / 100, " %"), haken("Stumm", t.Muted, v => t.Muted = v));
        if (t.Kind === "Video") teile.push(haken("Ausgeblendet", t.Hidden, v => t.Hidden = v));
      }
      teile.push(h("h5", {}, "Ton des ganzen Videos"), feld("Gesamt", p.MasterVolume * 100, 0, 200, 5, v => p.MasterVolume = v / 100, " %"),
        haken("Lautheit angleichen", p.Normalize, v => p.Normalize = v),
        h("div", { class: "hinweis" }, "Angleichen bringt das Video auf etwa −16 LUFS wie Handy-Apps: leise Stellen lauter, nichts übersteuert."),
        h("h5", {}, "So geht's"),
        h("div", { class: "hinweis" }, "Medien in die Zeitleiste ziehen. Element ziehen = verschieben, am Rand ziehen = kürzen. Obere Videospur liegt über der unteren (Bild im Bild, Logo). ◉ blendet aus, ♪ schaltet stumm, − entfernt die Spur."),
        h("div", { class: "hinweis" }, "Tasten: Leertaste abspielen · S teilen · Entf löschen · ←/→ ein Bild, mit Umschalt 1 s · Strg+Z/Y · Strg+D duplizieren · Strg+Mausrad zoomen."));
      eig.replaceChildren(...teile); return;
    }
    const spur = P.spurVon(p, it), text = P.istText(it), bild = P.istBild(it);
    teile.push(h("h5", { class: "titel", title: P.name(it) }, P.name(it)));
    if (it.info && !text) teile.push(h("div", { class: "hinweis" }, bild ? `Bild ${it.info.w}×${it.info.h}` : `${zeit(it.info.dauer)}${it.info.w ? `, ${it.info.w}×${it.info.h}` : ""}${it.info.ton ? ", mit Ton" : ", ohne Ton"}`));
    teile.push(h("h5", {}, "Zeit"), feld("Start", it.Start, 0, 36000, 0.1, v => it.Start = v, " s"),
      feld("Länge", P.laenge(it), 0.2, 36000, 0.1, v => { if (P.zeitfrei(it)) it.Out = it.In + v; else it.Out = Math.min(it.In + v * it.Speed, it.info?.dauer ?? 1e9); }, " s"));
    if (!P.zeitfrei(it)) teile.push(feld("Quelle ab", it.In, 0, Math.max(0, (it.info?.dauer ?? 1) - 0.2), 0.1, v => { const l = P.quellLaenge(it); it.In = v; it.Out = Math.min(v + l, it.info?.dauer ?? v + l); }, " s"),
      feld("Tempo", it.Speed, 0.25, 4, 0.25, v => it.Speed = v, " ×"));
    if (spur?.Kind === "Video" && !text) {
      if (P.istFarbe(it)) teile.push(h("h5", {}, "Farbe"), farbFeld("Farbe", it.Fill, x => { it.Fill = x; letzteFarbe = x; }));
      teile.push(h("h5", {}, "Bild"), regler("Deckkraft", it.Opacity, v => it.Opacity = v),
        feld("Größe", it.Scale * 100, 5, 300, 5, v => it.Scale = v / 100, " %"),
        feld("Position X", it.X * 100, -50, 150, 1, v => it.X = v / 100, " %"), feld("Position Y", it.Y * 100, -50, 150, 1, v => it.Y = v / 100, " %"),
        h("div", { class: "hinweis" }, "Oder in der Vorschau ziehen: innen verschieben, an den Ecken skalieren."),
        knoepfe(["Bild im Bild", () => Object.assign(it, { Scale: 0.35, X: 0.72, Y: 0.22 })], ["Ganze Fläche", () => Object.assign(it, { Scale: 1, X: 0.5, Y: 0.5, Opacity: 1 })]));
      if (!P.istFarbe(it)) teile.push(
        h("h5", {}, "Zuschnitt"), feld("Links", it.CropL * 100, 0, 45, 1, v => it.CropL = v / 100, " %"), feld("Rechts", it.CropR * 100, 0, 45, 1, v => it.CropR = v / 100, " %"),
        feld("Oben", it.CropT * 100, 0, 45, 1, v => it.CropT = v / 100, " %"), feld("Unten", it.CropB * 100, 0, 45, 1, v => it.CropB = v / 100, " %"),
        knoepfe(["Auf Bildschirm zuschneiden", () => aufBildschirm(it)], ["Zurücksetzen", () => Object.assign(it, { CropL: 0, CropR: 0, CropT: 0, CropB: 0 })]),
        h("h5", {}, "Effekte"), feld("Helligkeit", it.Brightness * 100, -100, 100, 5, v => it.Brightness = v / 100), feld("Kontrast", it.Contrast * 100, 0, 200, 5, v => it.Contrast = v / 100, " %"),
        feld("Sättigung", it.Saturation * 100, 0, 300, 5, v => it.Saturation = v / 100, " %"), haken("Schwarzweiß", it.Gray, v => it.Gray = v), feld("Weichzeichnen", it.Blur, 0, 20, 1, v => it.Blur = v));
      teile.push(
        h("h5", {}, "Übergang vom vorigen Element"),
        wahl("Art", [["keine", "Keiner (harter Schnitt)"], ...["Sanft", "Hart", "Formen"].map(g => ({ gruppe: g, liste: P.uebergaenge().filter(x => x.gruppe === g && x.id !== "keine").map(x => [x.id, x.name]) }))], P.uebergang(it.Transition).id, v => it.Transition = v),
        feld("Dauer", it.TransitionSec, 0.1, 5, 0.1, v => it.TransitionSec = v, " s"),
        knoepfe(["Hart 0,2 s", () => it.TransitionSec = 0.2], ["Normal 0,6 s", () => it.TransitionSec = 0.6], ["Sanft 1,5 s", () => it.TransitionSec = 1.5]),
        h("div", { class: "hinweis" }, P.hatUebergang(it) ? (P.uebergang(it.Transition).sanft ? "Sanft: weicher Verlauf." : "Hart: gleichmäßig, scharfe Kante.") + " Das vorige Element läuft dafür um die Dauer weiter." : "Wirkt, wenn das Element direkt an das vorige anschließt."));
    }
    if (!text && it.info?.ton && !bild)
      teile.push(h("h5", {}, "Ton"), feld("Lautstärke", it.Volume * 100, 0, 200, 5, v => it.Volume = v / 100, " %"),
        knoepfe(["Stumm", () => it.Volume = 0], ["100 %", () => it.Volume = 1], ["Leiser −6 dB", () => it.Volume = Math.round(it.Volume / 2 * 100) / 100]),
        feld("Einblenden", it.FadeIn, 0, 30, 0.5, v => it.FadeIn = v, " s"), feld("Ausblenden", it.FadeOut, 0, 30, 0.5, v => it.FadeOut = v, " s"));
    if (text) {
      const ta = h("textarea", { rows: 3 }); ta.value = it.Text ?? "";            // textarea kennt kein value-Attribut

      ta.addEventListener("input", () => { it.Text = ta.value; vorschau(); });
      ta.addEventListener("change", () => { merken(); zeitleiste(); });
      teile.push(h("h5", {}, "Text"), h("label", {}, h("span", {}, "Inhalt"), ta),
        feld("Größe", it.TextSize * 100, 1, 30, 0.5, v => it.TextSize = v / 100, " %"),
        farbFeld("Farbe", it.TextColor, x => it.TextColor = x),
        regler("Deckkraft", it.Opacity ?? 1, v => it.Opacity = v),
        wahl("Position", [["oben", "Oben"], ["mitte", "Mitte"], ["unten", "Unten"]], it.TextPos, v => it.TextPos = v),
        h("h5", {}, "Hintergrund"),
        haken("Hintergrund", it.TextBox, v => it.TextBox = v),
        farbFeld("Farbe", it.TextBoxColor ?? "#000000", x => { it.TextBoxColor = x; it.TextBox = true; }),
        regler("Deckkraft", it.TextBoxOpacity ?? 0.45, v => { it.TextBoxOpacity = v; it.TextBox = true; }));
    }
    teile.push(knoepfe(["Teilen", teilenJetzt], ["Duplizieren", duplizieren], ["Löschen", loeschen]));
    eig.replaceChildren(...teile);
  }
  function aufBildschirm(it) {
    if (!it.info?.w) return;
    const [W, H] = P.flaecheVon(p, datenProfile), ziel = W / H, src = it.info.w / it.info.h;
    Object.assign(it, { CropL: 0, CropR: 0, CropT: 0, CropB: 0 });
    if (src > ziel) it.CropL = it.CropR = Math.min(0.45, (1 - ziel / src) / 2); else it.CropT = it.CropB = Math.min(0.45, (1 - src / ziel) / 2);
    melde(`Zugeschnitten auf ${W}×${H}.`);
  }

  // ── Export ──
  async function exportStarten() {
    if (abbruch) return abbruch.abort();
    if (P.dauer(p) < 0.1) return melde("Die Zeitleiste ist leer.", "fehler");
    const fehlt = p.Tracks.flatMap(t => t.Items).filter(i => !P.istText(i) && !P.istFarbe(i) && !i.datei);
    if (fehlt.length) return melde(`Erst die fehlenden Dateien hineinziehen (${fehlt.length}).`, "fehler");
    spielen(false);
    abbruch = new AbortController(); knExport.textContent = "Abbrechen"; knAbbruch.hidden = false; balken.hidden = false;
    const i = balken.firstChild, start = performance.now();
    try {
      const r = await exportieren(p, datenProfile, {
        holeClip: async it => { const m = medien.get(it.datei); m.clip ??= await lesen(it.datei); return m.clip; },
        holeBild: async it => medien.get(it.datei)?.bitmap ?? null,
        tonDaten: async f => { const m = medien.get(f); return m?.puffer ?? await tonPuffer(f).catch(() => null); },
      }, (a, t) => { i.style.width = Math.round(a * 100) + "%"; melde(`${Math.round(a * 100)} % · ${t}`); }, abbruch.signal);
      const pr = datenProfile.profile.find(x => x.id === p.ProfileId);
      const name = `${(p.Tracks.flatMap(t => t.Items).find(x => x.datei)?.datei.name ?? "Video").replace(/\.[^.]+$/, "")}_${pr?.id ?? "handy"}.mp4`;
      ctx.speichern(r.blob, name);
      i.style.width = "100%";
      melde(`Fertig in ${zeit((performance.now() - start) / 1000)}: ${name}, ${mb(r.blob.size)}, ${r.w}×${r.h} ${r.art === "hevc" ? "H.265" : "H.264"}${r.notizen.length ? " · " + r.notizen.join(" ") : ""}`, "ok");
    } catch (e) {
      melde(e?.name === "AbortError" ? "Export abgebrochen." : "Export ging nicht: " + (e?.message || e), e?.name === "AbortError" ? "" : "fehler");
    } finally { abbruch = null; knExport.textContent = "Exportieren"; knAbbruch.hidden = true; }
  }

  // ── Schließen, Tasten, Ziehen ins Fenster ──
  function schliessen() {
    if (abbruch) abbruch.abort();
    spielen(false);
    if (p.Tracks.some(t => t.Items.length) && !confirm("Editor schließen? Nicht gespeicherte Änderungen gehen verloren (vorher „Speichern“).")) return;
    for (const v of pool.values()) { v.pause(); v.removeAttribute("src"); v.load(); }
    for (const m of medien.values()) URL.revokeObjectURL(m.url);
    removeEventListener("keydown", taste, true);
    document.body.style.overflow = altOverflow; wurzel.remove();
  }
  function taste(e) {
    if (!wurzel.isConnected) return;
    const tippt = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    const strg = e.ctrlKey || e.metaKey;
    if (strg && e.key.toLowerCase() === "s") { e.preventDefault(); speichernProjekt(); return; }
    if (tippt) return;
    if (strg && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? vor() : rueck(); }
    else if (strg && e.key.toLowerCase() === "y") { e.preventDefault(); vor(); }
    else if (strg && e.key.toLowerCase() === "d") { e.preventDefault(); duplizieren(); }
    else if (e.key === " ") { e.preventDefault(); spielen(!spielt); }
    else if (e.key === "s" || e.key === "S") teilenJetzt();
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); loeschen(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); setzeKopf(kopf - (e.shiftKey ? 1 : 1 / 30)); }
    else if (e.key === "ArrowRight") { e.preventDefault(); setzeKopf(kopf + (e.shiftKey ? 1 : 1 / 30)); }
    else if (e.key === "Home") setzeKopf(0); else if (e.key === "End") setzeKopf(P.dauer(p));
    else if (e.key === "Escape" && spielt) spielen(false);
  }
  addEventListener("keydown", taste, true);
  dateiWahl.addEventListener("change", () => { if (dateiWahl.files.length) hinzufuegen(dateiWahl.files); dateiWahl.value = ""; });
  medienFeld.addEventListener("dragover", e => { e.preventDefault(); medienFeld.classList.add("ced-drop"); });
  medienFeld.addEventListener("dragleave", () => medienFeld.classList.remove("ced-drop"));
  medienFeld.addEventListener("drop", e => { e.preventDefault(); medienFeld.classList.remove("ced-drop"); if (e.dataTransfer.files?.length) hinzufuegen(e.dataTransfer.files); });
  profilWahl.addEventListener("change", () => { p.ProfileId = profilWahl.value; merken(); neu(false); });
  formWahl.addEventListener("change", () => { p.Landscape = formWahl.value === "1"; merken(); neu(false); });
  fitWahl.addEventListener("change", () => { p.Fit = fitWahl.value; merken(); neu(false); });
  new ResizeObserver(() => zeitleiste()).observe(zl);

  neu(false);
  if (dateien.length) { await hinzufuegen(dateien, { spur: P.vonUnten(p, "Video")[0], sek: 0 }); merken(); }
  requestAnimationFrame(() => requestAnimationFrame(einpassen));                       // erst wenn das Fenster seine Breite kennt
  return { schliessen, get projekt() { return p; }, hinzufuegen, exportStarten, setzeKopf, waehle: it => { sel = it; neu(false); } };
}

// ── RGB-Farbrad (wie ColorWheel/ColorButton der App) ──
const SCHNELL = ["#FFFFFF", "#000000", "#D97757", "#F7B14F", "#FFE066", "#4DBF95", "#4F8FD9", "#9B6BD9", "#E05A5A", "#262624"];
function normHex(x) { const m = /^#?([0-9a-f]{6})$/i.exec(String(x ?? "").trim()); return m ? "#" + m[1].toUpperCase() : "#FFFFFF"; }
export function vonHsv(hh, s, v) {
  hh = ((hh % 360) + 360) % 360; const c = v * s, x = c * (1 - Math.abs((hh / 60) % 2 - 1)), m = v - c;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  return "#" + [r, g, b].map(k => Math.round((k + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase();
}
export function zuHsv(hex) {
  const n = parseInt(normHex(hex).slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const hh = d === 0 ? 0 : max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(hh + 360) % 360, max === 0 ? 0 : d / max, max];
}
function farbRad(hex, gewaehlt, fertig) {
  let [hu, sa, va] = zuHsv(hex);
  const D = 168, rad = h("canvas", { width: D, height: D, style: `width:${D}px;height:${D}px` });
  const leiste = h("canvas", { class: "leiste", width: 22, height: D, style: `width:22px;height:${D}px` });
  const feldHex = h("input", { value: normHex(hex), maxlength: 7, "aria-label": "Hex-Farbe", spellcheck: false });
  const rgb = h("small", {});
  const grund = document.createElement("canvas"); grund.width = grund.height = D;
  {
    const g = grund.getContext("2d"), bild = g.createImageData(D, D), r0 = D / 2;
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const dx = x + 0.5 - r0, dy = y + 0.5 - r0, dist = Math.hypot(dx, dy); if (dist > r0) continue;
      const c = parseInt(vonHsv((Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360, dist / r0, 1).slice(1), 16), i = (y * D + x) * 4;
      bild.data[i] = c >> 16 & 255; bild.data[i + 1] = c >> 8 & 255; bild.data[i + 2] = c & 255; bild.data[i + 3] = dist > r0 - 1 ? 255 * (r0 - dist) : 255;
    }
    g.putImageData(bild, 0, 0);
  }
  const rgbText = x => { const n = parseInt(x.slice(1), 16); return `R ${n >> 16 & 255}  G ${n >> 8 & 255}  B ${n & 255}`; };
  function malen() {
    const g = rad.getContext("2d"); g.clearRect(0, 0, D, D); g.drawImage(grund, 0, 0);
    if (va < 0.999) { g.fillStyle = `rgba(0,0,0,${1 - va})`; g.beginPath(); g.arc(D / 2, D / 2, D / 2, 0, Math.PI * 2); g.fill(); }
    const a = hu * Math.PI / 180, px = D / 2 + Math.cos(a) * sa * D / 2, py = D / 2 - Math.sin(a) * sa * D / 2;
    g.lineWidth = 2; g.strokeStyle = "#fff"; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 1; g.strokeStyle = "#000"; g.beginPath(); g.arc(px, py, 8, 0, Math.PI * 2); g.stroke();
    const l = leiste.getContext("2d"), gr = l.createLinearGradient(0, 0, 0, D);
    gr.addColorStop(0, vonHsv(hu, sa, 1)); gr.addColorStop(1, "#000"); l.fillStyle = gr; l.fillRect(0, 0, 22, D);
    const by = (1 - va) * D; l.strokeStyle = "#fff"; l.lineWidth = 2; l.strokeRect(1, Math.max(1, by - 3), 20, 6);
  }
  function melden(vonFeld = false) {
    const x = vonHsv(hu, sa, va); if (!vonFeld) feldHex.value = x;
    rgb.textContent = rgbText(x); malen(); gewaehlt(x);
  }
  function ziehen(el, setze) {
    el.addEventListener("pointerdown", e => {
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      const zu = ev => { const r = el.getBoundingClientRect(); setze(ev.clientX - r.left, ev.clientY - r.top); melden(); };
      zu(e);
      const up = () => { el.removeEventListener("pointermove", zu); el.removeEventListener("pointerup", up); };
      el.addEventListener("pointermove", zu); el.addEventListener("pointerup", up);
    });
  }
  ziehen(rad, (x, y) => { const dx = x - D / 2, dy = y - D / 2; hu = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360; sa = Math.min(1, Math.hypot(dx, dy) / (D / 2)); if (va < 0.05) va = 1; });
  ziehen(leiste, (x, y) => { va = Math.min(1, Math.max(0, 1 - y / D)); });
  feldHex.addEventListener("input", () => { const m = /^#?([0-9a-f]{6})$/i.exec(feldHex.value.trim()); if (m) { [hu, sa, va] = zuHsv(m[1]); melden(true); } });
  const schnell = h("div", { class: "schnell" }, ...SCHNELL.map(x => h("button", { type: "button", title: x, style: `background:${x}`, onclick: () => { [hu, sa, va] = zuHsv(x); melden(); } })));
  const box = h("div", { class: "farbrad" }, h("div", { class: "oben" }, rad, leiste),
    h("div", { class: "reihe" }, feldHex, rgb), schnell,
    h("div", { class: "reihe" }, h("button", { type: "button", class: "haupt", onclick: fertig }, "Fertig")));
  malen(); rgb.textContent = rgbText(normHex(hex));
  return box;
}
