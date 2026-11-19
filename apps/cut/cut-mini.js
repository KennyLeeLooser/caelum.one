// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Cut · Web-Modul „Video fürs Handy“ (CAELUM-STANDARD.md C3). Vorbild: Schnellfenster der App (CutWindow).
// Videos hineinziehen, je Clip Von/Bis schneiden, Reihenfolge ändern, Stufe oder Geräteprofil wählen, komprimieren, speichern.
// Regeln aus plan.js (= Jobs.cs/Profiles.cs der App), Kodieren in kodieren.js (WebCodecs). Nichts wird hochgeladen.
// Teile mit derselben Versionsangabe laden wie dieses Grundmodul (caelum.js hängt ?v=<hash> an) – sonst mischt der Browser
// nach einem Update bis ~10 min alte plan.js/kodieren.js/profile.json mit dem neuen cut-mini.js.
const V = new URL(import.meta.url).search;
const { planen, zeit, PlanFehler } = await import("./plan.js" + V);
const { lesen, kodieren, schaetzen, kannKodieren, KodierFehler } = await import("./kodieren.js" + V);

const css = `
.ct-drop { border:2px dashed var(--line); border-radius:10px; padding:20px; text-align:center; color:var(--muted); }
.ct-drop.over { border-color:var(--accent); color:var(--text); }
.ct-drop b { color:var(--text); font-size:16px; font-weight:600; display:block; margin-bottom:4px; }
.ct-clip { background:var(--bg-deep); border:1px solid var(--line); border-radius:10px; padding:12px; margin-top:8px; }
.ct-kopf { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.ct-kopf .ct-name { font-weight:600; flex:1; min-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ct-kopf .ct-meta { color:var(--muted); font-size:12.5px; }
.cw .ct-kopf button { padding:3px 9px; font-size:13px; }
.ct-clip video { width:100%; max-height:220px; background:#000; border-radius:8px; margin-top:8px; display:block; }
.ct-zeit { display:grid; grid-template-columns:auto minmax(0,1fr) auto; gap:8px; align-items:center; margin-top:8px; }
.ct-zeit input[type=text] { width:84px; text-align:center; font-variant-numeric:tabular-nums; }
.ct-balken { height:8px; background:var(--line); border-radius:4px; overflow:hidden; margin-top:12px; }
.ct-balken i { display:block; height:100%; width:0; background:var(--accent); transition:width .2s; }
.ct-plan { font-size:13px; color:var(--text-soft); margin-top:8px; }
.ct-ergebnis video { width:100%; max-height:280px; background:#000; border-radius:8px; margin-top:8px; }
`;

function h(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== "string") e[k] = v; else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kinder) if (c != null) e.append(c);
  return e;
}
/** Store.ParseTime: „1:20“, „1:02:03“, „75“, „75,5“, „1:20.5“ → Sekunden; leer → null. */
function zeitLesen(s) {
  if (!s || !s.trim()) return null;
  let t = 0;
  for (const teil of s.trim().replace(",", ".").split(":")) { const v = parseFloat(teil); if (isNaN(v)) return NaN; t = t * 60 + v; }
  return t;
}
const mb = b => (b / 1024 / 1024).toLocaleString("de-CH", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + " MB";

export async function mount(root, ctx) {
  const daten = await fetch(new URL("daten/profile.json" + V, import.meta.url)).then(r => r.json());
  root.append(h("style", {}, css));
  const SPEICHER = "caelum.cut.web.v1";
  let wahl = { auswahl: "stufe:Handy", form: "Original", quer: false, zielMB: 16, fuellen: false };
  try { wahl = { ...wahl, ...JSON.parse(localStorage.getItem(SPEICHER) || "{}") }; } catch { /* privat */ }
  const merken = () => { try { localStorage.setItem(SPEICHER, JSON.stringify(wahl)); } catch { /* privat */ } };

  const clips = [];               // { clip, von, bis, el }
  const liste = h("div", {});
  const datei = h("input", { type: "file", hidden: true, multiple: true, accept: "video/mp4,video/quicktime,.mp4,.mov,.m4v" });
  const drop = h("div", { class: "ct-drop" },
    h("b", {}, "Videos hierher ziehen"),
    h("span", {}, "MP4 oder MOV vom Handy – sie bleiben auf deinem Gerät. "),
    h("button", { type: "button", onclick: () => datei.click() }, "Videos wählen"));
  const fehlerBox = h("ul", { class: "cw-note", "aria-live": "polite" });

  // ── Einstellungen ──
  const gruppen = new Map();
  for (const p of daten.profile) (gruppen.get(p.gruppe) || gruppen.set(p.gruppe, []).get(p.gruppe)).push(p);
  const auswahl = h("select", { "aria-label": "Qualität oder Gerät" },
    h("optgroup", { label: "Qualität" }, ...Object.entries(daten.stufen).map(([k, s]) => h("option", { value: "stufe:" + k }, s.text))),
    ...[...gruppen].map(([g, l]) => h("optgroup", { label: g }, ...l.map(p => h("option", { value: "profil:" + p.id }, p.name + (p.hinweis ? " – " + p.hinweis : ""))))));
  const form = h("select", { "aria-label": "Format" }, ...[["Original", "wie das erste Video"], ["Hochkant", "hochkant 9:16"], ["Quer", "quer 16:9"]].map(([v, t]) => h("option", { value: v }, t)));
  const quer = h("input", { type: "checkbox" }), fuellen = h("input", { type: "checkbox" });
  const ziel = h("input", { type: "number", min: "1", max: "4000", step: "1", "aria-label": "Zielgrösse in MB" });
  const zeileForm = h("label", { class: "cw-f cw-2" }, h("span", {}, "Format"), form);
  const zeileQuer = h("label", { class: "cw-c" }, quer, "Quer (Profil gedreht)");
  const zeileZiel = h("label", { class: "cw-f cw-2" }, h("span", {}, "Zielgrösse (MB)"), ziel);
  const planText = h("div", { class: "ct-plan", "aria-live": "polite" });
  const knStart = h("button", { class: "cw-primary", type: "button", onclick: start }, "Fürs Handy speichern");
  const knStop = h("button", { type: "button", hidden: true, onclick: () => abbruch?.abort() }, "Abbrechen");
  const balken = h("div", { class: "ct-balken", hidden: true }, h("i", {}));
  const status = h("p", { class: "cw-hint", "aria-live": "polite" });
  const ergebnis = h("div", { class: "ct-ergebnis" });

  const einstellungen = h("div", {},
    h("h4", {}, "Für welches Gerät?"),
    h("label", { class: "cw-f cw-2" }, h("span", {}, "Qualität / Gerät"), auswahl),
    zeileForm, zeileQuer, zeileZiel,
    h("label", { class: "cw-c" }, fuellen, "Bildschirm füllen (Ränder abschneiden statt Balken)"),
    planText,
    h("div", { class: "cw-row" }, knStart, knStop), balken, status, ergebnis,
    h("p", { class: "cw-hint", style: "margin-top:16px" }, "Nur in der App: Editor mit Spuren, Übergängen, Musik und Titeln, HDR → SDR, ganze Ordner, Bildschirmfotos, Datei auf die Gans ziehen. Sehr grosse Dateien (über 1–2 GB) besser mit der App."));
  root.append(h("div", { class: "cw cw-grid" }, h("div", {}, drop, liste, fehlerBox), einstellungen), datei);
  if (!kannKodieren()) fehlerBox.replaceChildren(h("li", { style: "color:#E5484D" }, "Dieser Browser kann keine Videos kodieren (WebCodecs fehlt). Bitte Chrome, Edge oder ein aktuelles Safari nehmen – oder die App."));

  auswahl.value = wahl.auswahl; form.value = wahl.form; quer.checked = wahl.quer; fuellen.checked = wahl.fuellen; ziel.value = wahl.zielMB;
  for (const el of [auswahl, form, quer, fuellen, ziel]) el.addEventListener("input", () => {
    wahl = { auswahl: auswahl.value, form: form.value, quer: quer.checked, fuellen: fuellen.checked, zielMB: Math.max(1, parseFloat(ziel.value) || 16) };
    merken(); neuPlanen();
  });

  function optionen() {
    const [art, id] = wahl.auswahl.split(":");
    return { stufe: art === "stufe" ? id : null, form: wahl.form, profil: art === "profil" ? daten.profile.find(p => p.id === id) : null, quer: wahl.quer, zielMB: wahl.zielMB, fuellen: wahl.fuellen };
  }
  let plan = null, schaetzAbbruch = null, schaetzUhr = 0;
  /** Grösse wie in der App mit Probestücken schätzen: 0,7 s nach der letzten Änderung, im Hintergrund, neueste gewinnt. */
  function neuSchaetzen(zeile) {
    schaetzAbbruch?.abort(); clearTimeout(schaetzUhr);
    if (!plan || abbruch || !kannKodieren()) return;
    const p = plan, teile = clips.map(c => ({ clip: c.clip, von: c.von, bis: c.bis }));
    if (p.zielKbps != null) { zeile.textContent = zeile.dataset.vor + mb(p.groesseMB * 1024 * 1024) + zeile.dataset.nach; return; }
    zeile.textContent = "Grösse wird geschätzt …";
    schaetzUhr = setTimeout(async () => {
      const ac = schaetzAbbruch = new AbortController();
      try {
        const bytes = await schaetzen(teile, p, ac.signal);
        if (!ac.signal.aborted && plan === p) zeile.textContent = zeile.dataset.vor + mb(bytes) + zeile.dataset.nach;
      } catch (e) { if (e?.name !== "AbortError" && plan === p) zeile.textContent = "Schätzen ging nicht: " + (e?.message || e); }
    }, 700);
  }
  function neuPlanen() {
    const o = optionen();
    zeileForm.hidden = !!o.profil; zeileQuer.hidden = !o.profil; zeileZiel.hidden = !(o.stufe === "Ziel");
    plan = null; knStart.disabled = !clips.length || !kannKodieren();
    if (!clips.length) { planText.textContent = "Erst Videos hinzufügen."; return; }
    try {
      plan = planen(o, clips.map(c => ({ w: c.clip.breite, h: c.clip.hoehe, fps: c.clip.fps, dauer: Math.max(0, c.bis - c.von), ton: c.clip.ton })), daten);
      const vorher = clips.reduce((s, c) => s + c.clip.groesse, 0);
      const groesse = h("div", { "data-vor": "Geschätzt etwa ", "data-nach": ` (vorher ${mb(vorher)})` });
      planText.replaceChildren(...[
        h("div", {}, `${plan.w} × ${plan.h} · ${Math.round(plan.fps * 100) / 100} fps · ${plan.hevc ? "H.265" : "H.264"} · ${zeit(plan.total)}`),
        groesse,
        plan.warnung ? h("div", { style: "color:#E5484D" }, "Achtung: " + plan.warnung) : null].filter(Boolean));
      neuSchaetzen(groesse);
    } catch (e) {
      knStart.disabled = true;
      planText.replaceChildren(h("div", { style: "color:#E5484D" }, e instanceof PlanFehler ? e.message : String(e)));
    }
  }

  // ── Clips ──
  async function hinzufuegen(dateien) {
    fehlerBox.replaceChildren();
    for (const f of dateien) {
      try {
        const clip = await lesen(f);
        const c = { clip, von: 0, bis: clip.dauer };
        c.el = clipKarte(c); clips.push(c); liste.append(c.el);
      } catch (e) { fehlerBox.append(h("li", { style: "color:#E5484D" }, e instanceof KodierFehler ? e.message : `${f.name}: ${e.message || e}`)); }
    }
    neuPlanen();
  }
  function clipKarte(c) {
    const url = URL.createObjectURL(c.clip.datei);
    const video = h("video", { src: url, controls: true, preload: "metadata", muted: true, playsInline: true });
    const vonF = h("input", { type: "text", value: zeit(c.von), "aria-label": "Von" }), bisF = h("input", { type: "text", value: zeit(c.bis), "aria-label": "Bis" });
    const meta = h("span", { class: "ct-meta" });
    const zeigen = () => { meta.textContent = `${c.clip.breite}×${c.clip.hoehe} · ${Math.round(c.clip.fps)} fps · ${zeit(c.bis - c.von)} von ${zeit(c.clip.dauer)} · ${mb(c.clip.groesse)}${c.clip.ton ? "" : " · ohne Ton"}${c.clip.hdr ? " · HDR" : ""}`; };
    const setzen = (feld, wert) => {
      if (isNaN(wert)) return;
      if (feld === "von") c.von = Math.min(Math.max(0, wert ?? 0), c.bis - 0.1); else c.bis = Math.max(Math.min(c.clip.dauer, wert ?? c.clip.dauer), c.von + 0.1);
      vonF.value = zeit(c.von); bisF.value = zeit(c.bis); zeigen(); neuPlanen();
    };
    vonF.addEventListener("change", () => setzen("von", zeitLesen(vonF.value)));
    bisF.addEventListener("change", () => setzen("bis", zeitLesen(bisF.value)));
    const karte = h("div", { class: "ct-clip" },
      h("div", { class: "ct-kopf" }, h("span", { class: "ct-name", title: c.clip.name }, c.clip.name),
        h("button", { type: "button", title: "Nach oben", "aria-label": "Nach oben", onclick: () => schieben(c, -1) }, "↑"),
        h("button", { type: "button", title: "Nach unten", "aria-label": "Nach unten", onclick: () => schieben(c, 1) }, "↓"),
        h("button", { type: "button", title: "Entfernen", "aria-label": "Entfernen", onclick: () => { clips.splice(clips.indexOf(c), 1); karte.remove(); URL.revokeObjectURL(url); neuPlanen(); } }, "−")),
      meta, video,
      h("div", { class: "ct-zeit" },
        h("span", {}, "Von"), h("div", { class: "cw-row", style: "margin:0" }, vonF, h("button", { type: "button", onclick: () => setzen("von", video.currentTime) }, "= Stelle"),
          h("span", { style: "flex:1" }), h("button", { type: "button", onclick: () => setzen("bis", video.currentTime) }, "= Stelle"), bisF), h("span", {}, "Bis")),
      h("p", { class: "cw-hint", style: "margin:6px 0 0" }, "Video an die Stelle spulen und „= Stelle“ drücken – oder Zeit eintippen (1:20 oder 80,5)."));
    zeigen();
    return karte;
  }
  function schieben(c, d) {
    const i = clips.indexOf(c), j = i + d;
    if (j < 0 || j >= clips.length) return;
    [clips[i], clips[j]] = [clips[j], clips[i]];
    liste.replaceChildren(...clips.map(x => x.el)); neuPlanen();
  }
  datei.addEventListener("change", () => { if (datei.files.length) hinzufuegen([...datei.files]); datei.value = ""; });
  ["dragenter", "dragover"].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(t => drop.addEventListener(t, () => drop.classList.remove("over")));
  drop.addEventListener("drop", e => { e.preventDefault(); if (e.dataTransfer?.files?.length) hinzufuegen([...e.dataTransfer.files]); });

  // ── Start ──
  let abbruch = null, letzteUrl = null;
  async function start() {
    if (!plan) return;
    schaetzAbbruch?.abort(); clearTimeout(schaetzUhr);
    abbruch = new AbortController();
    knStart.disabled = true; knStop.hidden = false; balken.hidden = false; ergebnis.replaceChildren();
    const i = balken.firstChild, t0 = performance.now();
    const vorher = clips.reduce((s, c) => s + c.clip.groesse, 0);
    try {
      const r = await kodieren(clips.map(c => ({ clip: c.clip, von: c.von, bis: c.bis })), plan,
        (a, text) => { i.style.width = Math.round(a * 100) + "%"; status.textContent = `${Math.round(a * 100)} % · ${text}`; }, abbruch.signal);
      const name = clips[0].clip.name.replace(/\.[^.]+$/, "") + "_handy.mp4";
      ctx.speichern(r.blob, name);
      if (letzteUrl) URL.revokeObjectURL(letzteUrl);
      letzteUrl = URL.createObjectURL(r.blob);
      i.style.width = "100%";
      status.textContent = `Fertig in ${zeit((performance.now() - t0) / 1000)} · ${name}`;
      ergebnis.replaceChildren(...[
        h("div", {}, h("b", {}, `${mb(vorher)} → ${mb(r.blob.size)}`), ` (${Math.round(100 * r.blob.size / vorher)} %) · ${plan.w}×${plan.h} · ${r.art === "hevc" ? "H.265" : "H.264"}`),
        r.notizen.length ? h("ul", { class: "cw-note" }, ...r.notizen.map(n => h("li", {}, n))) : null,
        h("video", { src: letzteUrl, controls: true, playsInline: true }),
        h("div", { class: "cw-row" }, h("button", { type: "button", onclick: () => ctx.speichern(r.blob, name) }, "Nochmals speichern"))].filter(Boolean));
    } catch (e) {
      status.textContent = e?.name === "AbortError" ? "Abgebrochen." : "";
      if (e?.name !== "AbortError") fehlerBox.replaceChildren(h("li", { style: "color:#E5484D" }, (e instanceof KodierFehler ? e.message : "Fehler beim Kodieren: " + (e?.message || e))));
    } finally { knStart.disabled = false; knStop.hidden = true; abbruch = null; }
  }
  neuPlanen();
}
