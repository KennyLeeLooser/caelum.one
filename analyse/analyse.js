// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Analyse – Oberfläche: Kamera/Bild/Text → lesen (leser.js) → prüfen (pruefen.js) → Ergebnis mit Ampel.
// Rorschach-Codes spielt Analyse selbst ab: Format, R2 und 3D kommen aus Caelum Rorschach (…/r/befehl.js, r2.js, ueberraschung.js),
// verlinkt, nicht kopiert. R2 (verschlüsselt + signiert) öffnet Analyse mit den gekoppelten Kreisen (kreise.js, IndexedDB).
// Kopplung: Rorschach zeigt …/analyse/#k1.… – Analyse löscht die Adresse sofort aus dem Verlauf und speichert erst nach „Koppeln“.
// Prüf-Schnittstelle: window.analyse.pruefe(text, format), .bild(dataUrl), .ueberraschung(adresse), .koppeln(), .stand()
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
import { analysieren, pruefeR2, pruefeKopplung } from "./pruefen.js";
import { lesen, kamera, wegName } from "./leser.js";
import * as KREISE from "./kreise.js";

const $ = id => document.getElementById(id);
const sp = new URLSearchParams(location.search);
const RORSCHACH = new URL(sp.get("r") || "../r/", location.href);
const stand = { rorschach: false, r2: false, letztes: null, ueberraschung: null, fehler: null, kreise: 0 };
let BEF = null, R2 = null, U = null, stopKamera = null, sucht = false, spiel = null, offeneKopplung = null;

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
  if (r.aktion?.art === "ueberraschung") { const b = knopf("Überraschung öffnen", true); b.onclick = () => ueberraschung(r.aktion.adresse, r.aktion.befehl); ak.push(b); }
  if (r.aktion?.art === "koppeln") { const b = knopf("Koppeln", true); b.onclick = koppeln; ak.push(b); const n = knopf("Nicht koppeln"); n.onclick = () => { offeneKopplung = null; $("ergebnis").hidden = true; }; ak.push(n); }
  if (r.aktion?.art === "oeffnen") {
    const b = knopf(r.stufe === "gefahr" ? "Trotzdem öffnen" : "Link öffnen", r.stufe === "ok");
    b.onclick = () => { if (r.stufe === "gefahr" && !confirm("Analyse warnt vor diesem Link. Wirklich öffnen?")) return; window.open(r.aktion.ziel, "_blank", "noopener,noreferrer"); };
    ak.push(b);
  }
  if (r.art !== "kopplung") { const k = knopf("Inhalt kopieren"); k.onclick = async () => { try { await navigator.clipboard.writeText(r.roh); $("meldung").textContent = "Kopiert."; } catch { $("meldung").textContent = "Kopieren nicht erlaubt."; } }; ak.push(k); }
  $("eAktion").replaceChildren(...ak);
  $("ergebnis").scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function knopf(text, haupt) { const b = document.createElement("button"); b.type = "button"; b.textContent = text; if (haupt) b.className = "primary"; return b; }

async function pruefe(text, format, stufeEcc) {
  let r = analysieren(text, format, BEF ? BEF.lesen : undefined);
  if (r.aktion?.art === "r2") r = await r2Oeffnen(text);
  else if (r.aktion?.art === "k1") r = await kopplungLesen(text);
  r.roh = r.art === "kopplung" ? "" : text; r.stufeEcc = stufeEcc; r.format = format || "";
  zeigen(r); return r;
}

async function r2Oeffnen(text) {
  if (!R2 || !globalThis.crypto?.subtle) return pruefeR2(text, { ok: false, art: "technik", fehler: "Entschlüsseln geht nur über HTTPS (www.caelum.one/analyse)." });
  const o = await R2.oeffnen(text, await KREISE.alle());
  if (o.ok) o.fingerabdruck = (await KREISE.alle()).get(o.kreis)?.fingerabdruck;
  return pruefeR2(text, o);
}

async function kopplungLesen(text) {
  if (!R2 || !globalThis.crypto?.subtle) return pruefeKopplung({ ok: false, fehler: "Koppeln geht nur über HTTPS (www.caelum.one/analyse)." });
  const k = R2.kopplung(text);
  if (k.ok) k.fingerabdruck = await R2.fingerabdruck(k.oeffentlich);
  offeneKopplung = k.ok ? k : null;
  return pruefeKopplung(k, new Date(), k.ok && (await KREISE.alle()).has(k.kreis));
}

async function koppeln() {
  const k = offeneKopplung; if (!k) return;
  offeneKopplung = null;
  const s = await R2.schluessel(k.aes, k.oeffentlich);
  k.aes.fill(0);                                                       // Rohschlüssel nicht im Speicher liegen lassen
  await KREISE.speichern({ kreis: k.kreis, name: k.name, aes: s.aes, pub: s.pub, fingerabdruck: k.fingerabdruck, gekoppelt: new Date().toISOString() });
  $("meldung").textContent = `Gekoppelt mit Kreis „${k.name}“. Codes dieses Kreises öffnen sich jetzt hier.`;
  $("ergebnis").hidden = true;
  await kreiseZeigen();
}

async function kreiseZeigen() {
  if (!R2) return;
  const alle = [...(await KREISE.alle()).values()]; stand.kreise = alle.length;
  $("kreise").hidden = alle.length === 0;
  $("kListe").replaceChildren(...alle.map(k => {
    const li = document.createElement("li"), t = document.createElement("span"), x = knopf("Entfernen");
    t.textContent = `${k.name} · ${k.fingerabdruck}`;
    x.onclick = async () => { if (!confirm(`Kreis „${k.name}“ von diesem Gerät entfernen? Codes dieses Kreises lassen sich dann hier nicht mehr öffnen.`)) return; await KREISE.entfernen(k.kreis); kreiseZeigen(); };
    li.append(t, x); return li;
  }));
}

async function ueberraschung(adresse, befehl) {
  $("buehne").classList.add("an"); $("buehne").classList.remove("zeigen");
  spiel?.stop();
  try {
    U ??= await import(new URL("ueberraschung.js", RORSCHACH).href);
    spiel = await U.spielen($("bild"), { adresse, befehl, zeigen: an => $("buehne").classList.toggle("zeigen", an) });
    stand.ueberraschung = spiel.stand;
    $("bBotschaft").textContent = spiel.befehl.botschaft || (spiel.objekt ? `Eine Überraschung: ${spiel.objekt.name}` : "Überraschung!");
  } catch (e) { stand.fehler = String(e.message || e); $("bBotschaft").textContent = e.befehl?.botschaft || "Überraschung"; $("buehne").classList.add("zeigen"); $("meldung").textContent = e.message; }
}
$("bZu").onclick = () => { spiel?.stop(); spiel = null; $("buehne").classList.remove("an"); };
$("bNochmal").onclick = () => spiel?.neu();

// ---------------------------------------------------------------- Kamera, Bild, Text
async function suchen() {
  if (!sucht) return;
  try { const f = await lesen($("video")); if (f.length) { sucht = false; navigator.vibrate?.(60); kameraAus(); await pruefe(f[0].text, f[0].format, f[0].stufe); return; } } catch { }
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

const kurz = r => r && { art: r.art, stufe: r.stufe, titel: r.titel, befehl: r.befehl };
window.analyse = {
  pruefe: async (t, f) => JSON.stringify(kurz(await pruefe(t, f))),
  bild: async d => JSON.stringify(kurz(await bildLesen(d))),
  koppeln: async () => { await koppeln(); return JSON.stringify({ kreise: stand.kreise }); },
  ueberraschung: async (a, b) => { await ueberraschung(a, b); return JSON.stringify(stand.ueberraschung); },
  stand: () => JSON.stringify({ ...stand, letztes: kurz(stand.letztes) }),
};

/** Code aus der Adresse (…/analyse/#r1.… / #r2.… / #k1.…) übernehmen; Kopplungen sofort aus dem Verlauf nehmen. */
async function ausAdresse() {
  const h = location.hash.length > 4 ? location.hash : "";
  if (!h) return;
  history.replaceState(null, "", location.pathname + location.search);   // Kreis-Schlüssel und Befehle nicht in der Chronik lassen
  await pruefe(location.origin + location.pathname + h, "link");
}
addEventListener("hashchange", () => { if (BEF) ausAdresse(); });

(async () => {
  try {
    BEF = await import(new URL("befehl.js", RORSCHACH).href); stand.rorschach = true;
    R2 = await import(new URL("r2.js", RORSCHACH).href); stand.r2 = !!globalThis.crypto?.subtle;
    const T = await import(new URL("tinte.js", RORSCHACH).href);
    await T.ladeLogo(new URL("logo-linie.svg", RORSCHACH).href);
    if (T.logo.d) $("markeLogo").firstElementChild.setAttribute("d", T.logo.d);
  } catch (e) { stand.fehler = "Rorschach-Teil nicht erreichbar: " + e.message; }
  $("weg").textContent = await wegName();
  try { await kreiseZeigen(); } catch { }
  // Kommt Analyse über einen Code-Link, gleich prüfen
  await ausAdresse();
  document.documentElement.dataset.bereit = "1";
})();
