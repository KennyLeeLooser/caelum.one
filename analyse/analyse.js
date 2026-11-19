// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Analyse – Oberfläche: Kamera/Bild/Text → lesen (leser.js) → prüfen (pruefen.js) → Ergebnis mit Ampel.
// Rorschach-Codes spielt Analyse selbst ab: Format und 3D kommen aus Caelum Rorschach (…/r/befehl.js, …/r/ueberraschung.js),
// verlinkt, nicht kopiert. Auf www.caelum.one liegt Rorschach unter /r/, in der Vorschau ebenso (werkzeuge/vorschau.mjs).
// Prüf-Schnittstelle: window.analyse.pruefe(text, format), .bild(dataUrl), .stand()
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
import { analysieren } from "./pruefen.js";
import { lesen, kamera, wegName } from "./leser.js";

const $ = id => document.getElementById(id);
const sp = new URLSearchParams(location.search);
const RORSCHACH = new URL(sp.get("r") || "../r/", location.href);
const stand = { rorschach: false, letztes: null, ueberraschung: null, fehler: null };
let BEF = null, U = null, stopKamera = null, sucht = false, spiel = null;

const STUFE_TEXT = { ok: "Unauffällig", hinweis: "Hinweis", vorsicht: "Vorsicht", gefahr: "Gefahr" };

function zeigen(r) {
  stand.letztes = r;
  $("ergebnis").hidden = false;
  $("eTitel").textContent = r.titel;
  $("eFormat").textContent = [r.format?.replace(/_/g, "-").toUpperCase(), r.stufeEcc ? "Stufe " + r.stufeEcc : ""].filter(Boolean).join(" · ");
  $("eAmpel").className = "ampel " + r.stufe; $("eAmpel").lastElementChild.textContent = STUFE_TEXT[r.stufe];
  $("eGruende").replaceChildren(...r.gruende.map(g => Object.assign(document.createElement("li"), { className: g.stufe, textContent: g.text })));
  $("eFelder").replaceChildren(...r.felder.flatMap(([k, v]) => [Object.assign(document.createElement("dt"), { textContent: k }), Object.assign(document.createElement("dd"), { textContent: v })]));
  const ak = [];
  if (r.aktion?.art === "ueberraschung") { const b = knopf("Überraschung öffnen", true); b.onclick = () => ueberraschung(r.aktion.adresse); ak.push(b); }
  if (r.aktion?.art === "oeffnen") {
    const b = knopf(r.stufe === "gefahr" ? "Trotzdem öffnen" : "Link öffnen", r.stufe === "ok");
    b.onclick = () => { if (r.stufe === "gefahr" && !confirm("Analyse warnt vor diesem Link. Wirklich öffnen?")) return; window.open(r.aktion.ziel, "_blank", "noopener,noreferrer"); };
    ak.push(b);
  }
  const k = knopf("Inhalt kopieren"); k.onclick = async () => { try { await navigator.clipboard.writeText(r.roh); $("meldung").textContent = "Kopiert."; } catch { $("meldung").textContent = "Kopieren nicht erlaubt."; } };
  ak.push(k);
  $("eAktion").replaceChildren(...ak);
  $("ergebnis").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function knopf(text, haupt) { const b = document.createElement("button"); b.type = "button"; b.textContent = text; if (haupt) b.className = "primary"; return b; }

function pruefe(text, format, stufeEcc) {
  const r = analysieren(text, format, BEF ? BEF.lesen : undefined);
  r.roh = text; r.stufeEcc = stufeEcc;
  zeigen(r); return r;
}

async function ueberraschung(adresse) {
  $("buehne").classList.add("an"); $("buehne").classList.remove("zeigen");
  spiel?.stop();
  try {
    U ??= await import(new URL("ueberraschung.js", RORSCHACH).href);
    spiel = await U.spielen($("bild"), { adresse, zeigen: an => $("buehne").classList.toggle("zeigen", an) });
    stand.ueberraschung = spiel.stand;
    $("bBotschaft").textContent = spiel.befehl.botschaft || (spiel.objekt ? `Eine Überraschung: ${spiel.objekt.name}` : "Überraschung!");
  } catch (e) { stand.fehler = String(e.message || e); $("bBotschaft").textContent = e.befehl?.botschaft || "Überraschung"; $("buehne").classList.add("zeigen"); $("meldung").textContent = e.message; }
}
$("bZu").onclick = () => { spiel?.stop(); spiel = null; $("buehne").classList.remove("an"); };
$("bNochmal").onclick = () => spiel?.neu();

// ---------------------------------------------------------------- Kamera, Bild, Text
async function suchen() {
  if (!sucht) return;
  try { const f = await lesen($("video")); if (f.length) { sucht = false; navigator.vibrate?.(60); kameraAus(); pruefe(f[0].text, f[0].format, f[0].stufe); return; } } catch { }
  setTimeout(suchen, 180);
}
function kameraAus() { stopKamera?.(); stopKamera = null; sucht = false; $("sucher").classList.remove("an"); $("start").textContent = "Kamera starten"; }
$("start").onclick = async () => {
  if (stopKamera) { kameraAus(); return; }
  try { stopKamera = await kamera($("video")); $("sucher").classList.add("an"); $("start").textContent = "Kamera stoppen"; $("meldung").textContent = ""; sucht = true; suchen(); }
  catch (e) { $("meldung").textContent = e.message || "Kamera nicht verfügbar."; }
};
async function bildLesen(src) {
  const img = new Image(); img.src = src; await img.decode();
  const f = await lesen(img);
  if (!f.length) { $("meldung").textContent = "Kein Code im Bild gefunden. Näher heran, schärfer oder heller probieren."; return null; }
  $("meldung").textContent = f.length > 1 ? `${f.length} Codes gefunden, der erste wird gezeigt.` : "";
  return pruefe(f[0].text, f[0].format, f[0].stufe);
}
$("datei").onchange = async e => { const d = e.target.files?.[0]; if (!d) return; const u = URL.createObjectURL(d); try { await bildLesen(u); } finally { URL.revokeObjectURL(u); e.target.value = ""; } };
$("pruefen").onclick = () => { const t = $("eingabe").value.trim(); if (t) pruefe(t, "eingabe"); };

window.analyse = {
  pruefe: (t, f) => JSON.stringify(pruefe(t, f)),
  bild: async d => JSON.stringify(await bildLesen(d)),
  ueberraschung: async a => { await ueberraschung(a); return JSON.stringify(stand.ueberraschung); },
  stand: () => JSON.stringify({ ...stand, letztes: stand.letztes && { art: stand.letztes.art, stufe: stand.letztes.stufe, titel: stand.letztes.titel } }),
};

(async () => {
  try {
    BEF = await import(new URL("befehl.js", RORSCHACH).href); stand.rorschach = true;
    const T = await import(new URL("tinte.js", RORSCHACH).href);
    await T.ladeLogo(new URL("logo-linie.svg", RORSCHACH).href);
    if (T.logo.d) $("markeLogo").firstElementChild.setAttribute("d", T.logo.d);
  } catch (e) { stand.fehler = "Rorschach-Teil nicht erreichbar: " + e.message; }
  $("weg").textContent = await wegName();
  // Kommt Analyse über einen Rorschach-Link (…/analyse/#r1.…), gleich prüfen
  if (location.hash.length > 4) pruefe("https://www.caelum.one/r/" + location.hash, "link");
  document.documentElement.dataset.bereit = "1";
})();
