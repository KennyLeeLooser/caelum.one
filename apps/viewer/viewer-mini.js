// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum 3D-Viewer · Web-Modul „3D-Datei ansehen“ (CAELUM-STANDARD.md C2). Renderer = Widget der App (kern.js, erzeugt),
// Lader = laden.js (nach Loaders.cs), GIF = gif.js (nach GifEncoder.cs). Bedienung wie im Widget: ziehen dreht,
// Rad/zwei Finger zoomen, Doppelklick/Doppeltippen passt ein; am Handy ohne Endungs-Filter in der Dateiauswahl. Nimmt Schilder aus Caelum Gravur an („schild-glb“). Nichts wird hochgeladen.
import { VIEWS, VIEW_ANGLES, BG, viewerErzeugen } from "./kern.js";
import { laden, netz, dreiecke, drehungX, FormatFehler } from "./laden.js";
import { gifSchreiben, ausRgba } from "./gif.js";

const css = `
.vw-stage { position:relative; background:var(--bg-deep); border:1px solid var(--line); border-radius:10px; overflow:hidden; aspect-ratio:16/10;
  cursor:grab; touch-action:none; user-select:none; }
.vw-stage.drag { cursor:grabbing; }
.vw-stage.over { outline:2px dashed var(--accent); outline-offset:-6px; }
@media (max-width: 600px) { .vw-stage { aspect-ratio: 1 / 1; } }
@media (orientation: landscape) and (max-height: 520px) { .vw-stage { aspect-ratio: auto; height: 62vh; } }
.vw-stage canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
.vw-leer { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:safe center; overflow:auto; gap:10px; text-align:center; padding:16px; color:var(--muted); cursor:default; }
.vw-leer b { color:var(--text); font-size:16px; font-weight:600; }
.vw-winkel { position:absolute; left:8px; bottom:8px; font-size:11px; color:var(--muted); background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:1px 8px; }
.vw-busy { position:absolute; right:8px; top:8px; font-size:12px; color:var(--text); background:var(--surface); border:1px solid var(--line); border-radius:6px; padding:2px 8px; display:none; }
.vw-leiste { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
.cw .vw-leiste button { padding:5px 10px; font-size:13px; }
.cw .vw-leiste button.an { border-color:var(--accent); color:var(--accent); }
.vw-info { color:var(--muted); font-size:13px; margin-top:8px; }
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
const warte = ms => new Promise(r => setTimeout(r, ms));

export async function mount(root, ctx) {
  const hier = new URL("./", import.meta.url);
  root.append(h("style", {}, css));

  const state = { yaw: 35, pitch: 28, bg: "dunkel", ortho: false, animation: "", animation_time: 0 };
  try { const b = localStorage.getItem("caelum.viewer.web.bg"); if (b && BG[b]) state.bg = b; } catch { /* privat */ }
  const canvas = h("canvas", { "aria-label": "3D-Ansicht" });
  const winkel = h("span", { class: "vw-winkel", "aria-live": "off" });
  const busy = h("span", { class: "vw-busy" }, "lädt …");
  // Handy (Android/iOS): ohne Endungs-Filter – die Auswahl graut .glb/.stl/.3mf sonst aus, weil das System ihren MIME-Typ nicht kennt.
  // Das Format prüft laden.js selbst (FormatFehler mit klarer Meldung).
  const touch = matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  const datei = h("input", { type: "file", hidden: true, multiple: true, accept: touch ? null : ".glb,.gltf,.obj,.mtl,.stl,.3mf,.bin,.png,.jpg,.jpeg" });
  const beispiele = [["Prüfwürfel mit Textur (GLB)", "beispiele/knoten_textur.glb"], ["Bauteil mit Farben (3MF)", "beispiele/bauteil.3mf"]];
  const leer = h("div", { class: "vw-leer" },
    h("b", {}, touch ? "3D-Datei öffnen" : "3D-Datei hierher ziehen"),
    h("span", {}, "GLB, glTF, OBJ (+MTL), STL, 3MF – die Datei bleibt auf deinem Gerät."),
    h("div", { class: "cw-row", style: "justify-content:center" },
      h("button", { class: "cw-primary", type: "button", onclick: () => datei.click() }, "Datei wählen"),
      ...beispiele.map(([t, u]) => h("button", { type: "button", onclick: () => holen(u, t) }, t))),
    h("span", { style: "font-size:12.5px" }, "Tipp: In Caelum Gravur ein Schild gestalten und „Im 3D-Viewer ansehen“ wählen."));
  const stage = h("div", { class: "vw-stage" }, canvas, winkel, busy, leer);
  const $ = id => (id === "gl" ? canvas : id === "angle" ? winkel : null);
  const viewer = viewerErzeugen($, state);
  if (!viewer.ready) { root.append(h("p", { class: "caelum-try-err" }, "Dieser Browser kann kein WebGL2 – bitte einen aktuellen Browser nutzen oder die App verwenden.")); return; }

  const info = h("div", { class: "vw-info", "aria-live": "polite" });
  const hinweise = h("ul", { class: "cw-note" });
  const ansichten = h("div", { class: "vw-leiste", role: "group", "aria-label": "Ansichten" },
    ...VIEWS.map(v => h("button", { type: "button", onclick: () => ansicht(v) }, v)));
  const knOrtho = h("button", { type: "button", onclick: () => { state.ortho = !state.ortho; knOrtho.classList.toggle("an", state.ortho); viewer.draw(); } }, "Orthografisch");
  const knAuf = h("button", { type: "button", title: "Um X drehen (Z oben → Y oben)", onclick: () => { drehung = (drehung + 1) % 4; neuZeigen(); } }, "Aufrichten ⟳");
  const bgWahl = h("select", { "aria-label": "Hintergrund", onchange: e => { state.bg = e.target.value; try { localStorage.setItem("caelum.viewer.web.bg", state.bg); } catch { /* privat */ } viewer.draw(); } },
    ...Object.keys(BG).map(k => h("option", { value: k, selected: k === state.bg }, { hell: "Hell", weiss: "Weiss", dunkel: "Dunkel", schwarz: "Schwarz" }[k] || k)));
  const werkzeug = h("div", { class: "vw-leiste" },
    h("button", { type: "button", onclick: () => { viewer.fit(); viewer.draw(); } }, "Einpassen"), knOrtho, knAuf,
    h("button", { type: "button", onclick: () => datei.click() }, "Andere Datei"));
  const knPng = h("button", { class: "cw-primary", type: "button", onclick: alsPng }, "Bild speichern (PNG)");
  const knGif = h("button", { type: "button", onclick: alsGif }, "GIF 360° speichern");
  const knGlb = h("button", { type: "button", onclick: alsGlb, hidden: true }, "GLB speichern");
  const ausgabe = h("div", {},
    h("h4", {}, "Ansicht"), ansichten, werkzeug,
    h("label", { class: "cw-f cw-2", style: "margin-top:12px" }, h("span", {}, "Hintergrund"), bgWahl),
    h("h4", {}, "Ausgabe"),
    h("p", { class: "cw-hint" }, "Das Bild zeigt die aktuelle Ansicht. Das GIF dreht einmal ganz herum, ohne abzuschneiden."),
    h("div", { class: "cw-row" }, knPng, knGif, knGlb),
    h("p", { class: "cw-hint", style: "margin-top:16px" }, "Nur in der App: FBX, USDZ, BLEND und DXF, Animationen abspielen, Bild-Stopps, PDF-Datenblatt, 3D-Suche und der Anschluss an Claude und ChatGPT."));
  root.append(h("div", { class: "cw cw-grid" }, h("div", {}, stage, info, hinweise), ausgabe), datei);
  aktiv(false);

  // ── Laden ──
  let modell = null, original = null, drehung = 0;
  function aktiv(an) { for (const b of [...ansichten.children, ...werkzeug.children, knPng, knGif]) b.disabled = !an && b.textContent !== "Andere Datei"; leer.style.display = an ? "none" : ""; }
  async function oeffnen(liste) {
    busy.style.display = "block";
    try {
      const dateien = await Promise.all(liste.map(async f => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const m = await laden(dateien);
      modell = m; drehung = 0;
      original = /\.glb$/i.test(dateien[0].name) ? { name: dateien[0].name, bytes: dateien[0].bytes } : null;
      Object.assign(state, { yaw: VIEW_ANGLES.Iso[0], pitch: VIEW_ANGLES.Iso[1] });
      viewer.mesh = null; neuZeigen();
      info.textContent = `${m.name} · ${m.format} · ${dreiecke(m).toLocaleString("de-CH")} Dreiecke · ${m.parts.length} Teil${m.parts.length === 1 ? "" : "e"}`;
      hinweise.replaceChildren(...m.notes.map(t => h("li", {}, t)));
      knGlb.hidden = !original;
      aktiv(true);
    } catch (e) {
      info.textContent = "";
      hinweise.replaceChildren(h("li", { style: "color:#E5484D" }, e instanceof FormatFehler ? e.message : "Die Datei liess sich nicht lesen: " + (e?.message || e)));
    } finally { busy.style.display = "none"; }
  }
  function neuZeigen() {
    if (!modell) return;
    viewer.reorient = true;
    if (!viewer.load(netz(modell, drehungX(drehung)))) { hinweise.replaceChildren(h("li", {}, "Das Modell ist zu gross für die Anzeige im Browser – bitte die App verwenden.")); return; }
    viewer.home(); viewer.draw();
  }
  async function holen(url, name) {
    const r = await fetch(new URL(url, hier));
    const b = await r.blob();
    oeffnen([new File([b], url.split("/").pop(), { type: b.type })]).then(() => { if (modell) info.textContent = name + " · " + info.textContent.split(" · ").slice(1).join(" · "); });
  }
  datei.addEventListener("change", () => { if (datei.files.length) oeffnen([...datei.files]); datei.value = ""; });
  ["dragenter", "dragover"].forEach(t => stage.addEventListener(t, e => { if ([...(e.dataTransfer?.types || [])].includes("Files")) { e.preventDefault(); stage.classList.add("over"); } }));
  ["dragleave", "dragend"].forEach(t => stage.addEventListener(t, () => stage.classList.remove("over")));
  stage.addEventListener("drop", e => { e.preventDefault(); stage.classList.remove("over"); if (e.dataTransfer?.files?.length) oeffnen([...e.dataTransfer.files]); });
  ctx.nehmen("schild-glb", (blob, meta) => oeffnen([new File([blob], meta?.name || "Schild.glb", { type: "model/gltf-binary" })]));

  // ── Kamera (wie im Widget) ──
  let tween = 0;
  function setView(yaw, pitch, animate) {
    pitch = Math.max(-89.9, Math.min(89.9, pitch));
    clearInterval(tween);
    if (!animate) { state.yaw = yaw; state.pitch = pitch; viewer.draw(); return; }
    const y0 = state.yaw, p0 = state.pitch, t0 = performance.now(), dy = ((yaw - y0 + 540) % 360) - 180;
    tween = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 350), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      state.yaw = y0 + dy * e; state.pitch = p0 + (pitch - p0) * e; viewer.draw();
      if (k >= 1) { clearInterval(tween); state.yaw = ((state.yaw + 540) % 360) - 180; }
    }, 16);
  }
  function ansicht(v) { const [y, p] = VIEW_ANGLES[v]; viewer.home(); setView(y, p, true); }
  const ptrs = new Map(); let drag = null, pinch = 0;
  stage.addEventListener("pointerdown", e => {
    if (!modell || e.target.closest(".vw-leer")) return;
    stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 1) { if (viewer.fitted) { viewer.home(); viewer.draw(); } drag = { x: e.clientX, y: e.clientY, yaw: state.yaw, pitch: state.pitch }; stage.classList.add("drag"); }
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; }
  });
  stage.addEventListener("pointermove", e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); viewer.zoom = Math.max(0.05, Math.min(20, viewer.zoom * pinch / Math.max(1, d))); pinch = d; viewer.draw(); return; }
    if (drag) setView(drag.yaw - (e.clientX - drag.x) * 0.4, drag.pitch + (e.clientY - drag.y) * 0.4);
  });
  let letzterTipp = 0;
  const up = e => {
    if (e.type === "pointerup" && e.pointerType === "touch" && modell && ptrs.size === 1 && drag && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 10) {
      const t = performance.now(); if (t - letzterTipp < 320) { viewer.fit(); viewer.draw(); letzterTipp = 0; } else letzterTipp = t;   // Doppeltippen = einpassen
    }
    ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; if (!ptrs.size) { drag = null; stage.classList.remove("drag"); }
  };
  stage.addEventListener("pointerup", up); stage.addEventListener("pointercancel", up);
  stage.addEventListener("wheel", e => { if (!modell) return; e.preventDefault(); viewer.zoom = Math.max(0.05, Math.min(20, viewer.zoom * Math.exp(e.deltaY * 0.0015))); viewer.draw(); }, { passive: false });
  stage.addEventListener("dblclick", e => { if (modell && !e.target.closest(".vw-leer")) { viewer.fit(); viewer.draw(); } });

  // ── Ausgabe ──
  const name = () => (modell?.name || "Modell").replace(/[^\p{L}\p{N}_ -]/gu, "").trim() || "Modell";
  async function bildFertig() { viewer.draw(); await warte(90); }
  async function alsPng() {
    await bildFertig();
    canvas.toBlob(b => b && ctx.speichern(b, name() + ".png"), "image/png");
  }
  async function alsGif() {
    knGif.disabled = true; const alt = knGif.textContent;
    const yaw0 = state.yaw, zoom0 = viewer.zoom, fitted0 = viewer.fitted;
    try {
      viewer.home();                                      // Hüllkugel: nichts wird abgeschnitten
      const k = Math.min(1, 480 / canvas.width), w = Math.max(2, Math.round(canvas.width * k)), hh = Math.max(2, Math.round(canvas.height * k));
      const c2 = h("canvas", { width: w, height: hh }), g2 = c2.getContext("2d", { willReadFrequently: true });
      const bilder = [], n = 36;
      for (let i = 0; i < n; i++) {
        knGif.textContent = `GIF … ${Math.round(i / n * 100)} %`;
        state.yaw = yaw0 + i * 360 / n; await bildFertig();
        g2.clearRect(0, 0, w, hh); g2.drawImage(canvas, 0, 0, w, hh);
        bilder.push(ausRgba(g2.getImageData(0, 0, w, hh).data, w, hh));
      }
      knGif.textContent = "GIF wird geschrieben …"; await warte(20);
      ctx.speichern(new Blob([gifSchreiben(bilder, 80)], { type: "image/gif" }), name() + "_360.gif");
    } finally {
      state.yaw = yaw0; viewer.zoom = zoom0; if (fitted0) viewer.fit(); viewer.draw();
      knGif.textContent = alt; knGif.disabled = false;
    }
  }
  function alsGlb() { if (original) ctx.speichern(new Blob([original.bytes], { type: "model/gltf-binary" }), original.name); }
}
