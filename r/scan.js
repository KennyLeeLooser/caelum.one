// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – Scan-Seite: liest den Befehl hinter „#“ und spielt die Überraschung (Baustein ueberraschung.js) in 3D.
// Entscheid Kenny 19.11.2026: WebGL im Handy-Browser, später Caelum Analyse (Web-App, dann Android).
// Standbild für den Selbsttest: scan.html?t=4.6#r1.…  · Prüf-Schnittstelle window.rorschachScan.stand()
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
import { ladeLogo, logo } from "./tinte.js";
import { spielen } from "./ueberraschung.js";

const $ = id => document.getElementById(id);
const sp = new URLSearchParams(location.search);
const stand = { befehl: null, fehler: null, webgl: false, objekt: null, glb: false, wuerfel: 0, version: 0 };
window.rorschachScan = { stand: () => JSON.stringify(stand) };
// Zurück (Wunsch Kenny 20.11.2026): in der App zur Auswahl und zum Erzeuger, am Handy weiter zum nächsten Scan mit Caelum Analyse
if (window.chrome?.webview) { $("zurueck").hidden = false; $("erzeuger").hidden = false; }
else if (location.protocol === "https:") $("weiter").hidden = false;
const fertig = () => document.documentElement.dataset.bereit = "1";
function fehler(titel, text) { $("fehlerTitel").textContent = titel; $("fehlerText").textContent = text; $("fehler").classList.add("an"); stand.fehler = text; fertig(); }

(async () => {
  // Verschlüsselte Codes (R2) und Kopplungen gehören zu Caelum Analyse – nur dort liegen die Schlüssel
  if (/^#(r2|k1)\./.test(location.hash) && !window.chrome?.webview) { location.replace(new URL("../analyse/" + location.hash, location.href)); return; }
  ladeLogo().then(() => { if (logo.d) $("markeLogo").firstElementChild.setAttribute("d", logo.d); });
  try {
    const sp1 = await spielen($("bild"), {
      adresse: location.origin + location.pathname + location.hash,
      still: sp.has("t") ? +sp.get("t") : null,
      zeigen: an => document.body.classList.toggle("zeigen", an),
    });
    Object.assign(stand, sp1.stand);
    $("botschaft").textContent = sp1.befehl.botschaft || (sp1.objekt ? `Eine Überraschung: ${sp1.objekt.name}` : "Überraschung!");
    $("objektname").textContent = sp1.objekt?.name ?? "";
    $("nochmal").onclick = () => sp1.neu();
    fertig();
  } catch (e) {
    if (e.art === "befehl") fehler("Kein Rorschach-Code", e.message + " Bitte den Code noch einmal scannen.");
    else if (e.art === "webgl") { stand.befehl = e.befehl; document.body.classList.add("zeigen"); $("botschaft").textContent = e.befehl?.botschaft || "Überraschung!";
      fehler("Überraschung", "Dieses Gerät kann kein WebGL2, darum ohne 3D."); }
    else fehler("Fehler", String(e));
  }
})();
