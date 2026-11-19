// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Analyse – Prüfregeln für gescannte Codes („Kryptoanalyse“, Entscheid Kenny 19.11.2026: fremde QR prüfen, auch Barcodes
// und andere Codes). Rein lokal, ohne Netz: Der Inhalt verlässt das Gerät nie.
// analysieren(text, format) → { art, titel, stufe: "ok"|"hinweis"|"vorsicht"|"gefahr", gruende: [..], felder: [[name, wert]], aktion }
// Link-Regeln angelehnt an den Mailschutz der Gans (GoodGoose\Browser\src\mailcheck.js: Punycode, Kurzlinks, Markennamen).
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).

const STUFEN = ["ok", "hinweis", "vorsicht", "gefahr"];
const KURZLINKS = ["bit.ly", "tinyurl.com", "cutt.ly", "is.gd", "rb.gy", "shorturl.at", "ow.ly", "t.ly", "tiny.cc", "rebrand.ly", "s.id", "goo.su", "t.co", "qrco.de", "qr.link", "bl.ink"];
const TLD_VORSICHT = ["zip", "mov", "top", "xyz", "click", "country", "gq", "tk", "ml", "cf", "ga", "work", "rest", "icu", "cam", "lol"];
const DATEIEN_GEFAHR = ["apk", "exe", "msi", "scr", "bat", "cmd", "ps1", "vbs", "js", "jar", "dmg", "pkg"];
// Marken, die Betrüger gern vorgeben (Auswahl Schweiz/DE + global), mit echten Domains
const MARKEN = [
  { name: "PayPal", w: ["paypal"], d: ["paypal.com", "paypal.ch", "paypal.de"] },
  { name: "Microsoft", w: ["microsoft", "office365", "outlook"], d: ["microsoft.com", "office.com", "live.com", "outlook.com", "microsoftonline.com"] },
  { name: "Apple", w: ["apple", "icloud"], d: ["apple.com", "icloud.com"] },
  { name: "Google", w: ["google", "gmail"], d: ["google.com", "google.ch", "gmail.com", "youtube.com", "goo.gl"] },
  { name: "Amazon", w: ["amazon"], d: ["amazon.com", "amazon.de", "amazon.ch"] },
  { name: "Die Post", w: ["post", "postfinance"], d: ["post.ch", "postfinance.ch", "deutschepost.de", "dhl.de", "dhl.com"] },
  { name: "SBB", w: ["sbb"], d: ["sbb.ch"] },
  { name: "TWINT", w: ["twint"], d: ["twint.ch"] },
  { name: "UBS", w: ["ubs"], d: ["ubs.com"] },
  { name: "Raiffeisen", w: ["raiffeisen"], d: ["raiffeisen.ch"] },
  { name: "Swisscom", w: ["swisscom"], d: ["swisscom.ch", "swisscom.com"] },
  { name: "Caelum", w: ["caelum"], d: ["caelum.one"] },
];
const VERTRAUT_RORSCHACH = ["www.caelum.one", "caelum.one", "rorschach.caelum"];
const LOCKWORTE = /(login|log-in|signin|verify|verif|konto|account|passwort|password|bestaetig|bestätig|sperr|update|secure|sicherheit|zahlung|payment)/i;

function stufeMax(a, b) { return STUFEN.indexOf(b) > STUFEN.indexOf(a) ? b : a; }
function neu(art, titel) { return { art, titel, stufe: "ok", gruende: [], felder: [], aktion: null }; }
function grund(r, stufe, text) { r.gruende.push({ stufe, text }); r.stufe = stufeMax(r.stufe, stufe); }

export function istPrivateIp(h) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h); if (!m) return false; const [a, b] = [+m[1], +m[2]];
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
function basisDomain(host) { const t = host.split("."); return t.length <= 2 ? host : t.slice(-2).join("."); }
function gehoert(host, domains) { return domains.some(d => host === d || host.endsWith("." + d)); }

// ---------------------------------------------------------------- Prüfziffern
export function eanGueltig(code) {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const z = [...code].map(Number), p = z.pop(); let s = 0;
  for (let i = z.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) s += z[i] * w;
  return (10 - s % 10) % 10 === p;
}
export function ibanGueltig(iban) {
  const s = (iban || "").replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{8,30}$/.test(s)) return false;
  const r = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, c => (c.charCodeAt(0) - 55).toString());
  let m = 0; for (const ch of r) m = (m * 10 + +ch) % 97; return m === 1;
}
const GS1_LAND = [[[0, 19], "USA/Kanada"], [[30, 37], "Frankreich"], [[40, 44], "Deutschland"], [[45, 49], "Japan"], [[50, 50], "Grossbritannien"],
  [[54, 54], "Belgien/Luxemburg"], [[57, 57], "Dänemark"], [[64, 64], "Finnland"], [[69, 69], "China"], [[70, 70], "Norwegen"], [[73, 73], "Schweden"],
  [[76, 76], "Schweiz/Liechtenstein"], [[80, 83], "Italien"], [[84, 84], "Spanien"], [[87, 87], "Niederlande"], [[90, 91], "Österreich"],
  [[200, 299], "firmenintern (Ladenpreis, Gewichtsware)"], [[977, 977], "Zeitschrift (ISSN)"], [[978, 979], "Buch (ISBN)"]];
function gs1Land(code) {
  const c = code.length === 12 ? "0" + code : code, p3 = +c.slice(0, 3), p2 = +c.slice(0, 2);
  for (const [[a, b], name] of GS1_LAND) { if (b >= 100 ? (p3 >= a && p3 <= b) : (p2 >= a && p2 <= b)) return name; }
  return null;
}

// ---------------------------------------------------------------- Links
export function pruefeLink(text) {
  const r = neu("link", "Link");
  let u; try { u = new URL(text); } catch { r.art = "text"; r.titel = "Text"; r.felder.push(["Inhalt", text]); return r; }
  const host = u.hostname.toLowerCase();
  r.felder.push(["Ziel", host || u.protocol], ["Adresse", text]);
  if (/^(javascript|data|file|vbscript):$/.test(u.protocol)) { grund(r, "gefahr", `Der Code startet ein Skript oder eine Datei (${u.protocol}) statt einer Webseite.`); return r; }
  if (u.protocol === "http:") grund(r, istPrivateIp(host) ? "hinweis" : "vorsicht", "Unverschlüsselte Verbindung (http statt https).");
  if (u.username || u.password || /@/.test(text.split("//")[1]?.split("/")[0] || "")) grund(r, "gefahr", "Die Adresse enthält „@“ – das echte Ziel steht dahinter, nicht davor.");
  if (/(^|\.)xn--/.test(host)) grund(r, "gefahr", `Punycode-Adresse (${host}): sieht aus wie eine bekannte Seite, ist aber eine andere.`);
  let roh = text.split("//")[1]?.split("/")[0] || ""; try { roh = decodeURIComponent(roh); } catch { }
  if (/[^\x00-\x7f]/.test(roh)) grund(r, "gefahr", "Die Adresse enthält Sonderzeichen, die bekannte Buchstaben nachahmen können.");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) grund(r, istPrivateIp(host) ? "hinweis" : "vorsicht", istPrivateIp(host) ? "Ziel ist ein Gerät im eigenen Netz." : "Ziel ist eine nackte IP-Adresse statt eines Namens.");
  if (gehoert(host, KURZLINKS)) grund(r, "vorsicht", `Kurzlink (${basisDomain(host)}): Das echte Ziel ist erst nach dem Öffnen sichtbar.`);
  const tld = host.split(".").pop(); if (TLD_VORSICHT.includes(tld)) grund(r, "vorsicht", `Endung „.${tld}“ wird oft für Betrug genutzt.`);
  if (host.split(".").length > 4) grund(r, "vorsicht", "Ungewöhnlich viele Unterdomänen – oft, um einen bekannten Namen vorne zu zeigen.");
  // kurze Namen (post, sbb, ubs) nur als eigenes Wort, lange auch mitten im Namen (mypaypal-login.com)
  const nennt = w => w.length <= 4 ? new RegExp(`(^|[.-])${w}([.-]|$)`).test(host) : host.includes(w);
  for (const m of MARKEN) if (m.w.some(nennt) && !gehoert(host, m.d)) { grund(r, "gefahr", `Der Name „${m.name}“ steht in der Adresse, die Seite gehört aber nicht zu ${m.name}.`); break; }
  const ext = (u.pathname.split(".").pop() || "").toLowerCase();
  if (u.pathname.includes(".") && DATEIEN_GEFAHR.includes(ext)) grund(r, "gefahr", `Der Code lädt direkt ein Programm herunter (.${ext}).`);
  if (LOCKWORTE.test(u.pathname + u.search) && !MARKEN.some(m => gehoert(host, m.d))) grund(r, "vorsicht", "Die Seite fragt vermutlich nach Anmeldung oder Zahlung – nur auf bekannten Seiten eingeben.");
  if (text.length > 300) grund(r, "hinweis", "Sehr lange Adresse.");
  if (!r.gruende.length) grund(r, "ok", "Keine Auffälligkeit gefunden. Prüfe trotzdem, ob du die Seite erwartest.");
  r.aktion = { art: "oeffnen", ziel: text };
  return r;
}

// ---------------------------------------------------------------- Rorschach (Befehl hinter „#“)
export function pruefeRorschach(text, befehlLesen) {
  const r = neu("rorschach", "Rorschach-Befehl");
  const h = text.slice(text.indexOf("#") + 1);
  if (h.startsWith("r2.")) { r.titel = "Verschlüsselter Rorschach-Code"; grund(r, "hinweis", "Verschlüsselt und signiert (Format R2). Entschlüsseln kommt mit dem Schlüssel aus Rorschach (Stufe 2)."); return r; }
  const b = befehlLesen(text);
  if (!b.ok) { grund(r, "gefahr", b.fehler); return r; }
  let host = ""; try { host = new URL(text).hostname; } catch { }
  r.felder.push(["Befehl", "Überraschung"], ["Objekt", String(b.u.objekt)], ["Botschaft", "versteckt – erscheint beim Öffnen"]);
  if (host && !VERTRAUT_RORSCHACH.includes(host) && !istPrivateIp(host)) grund(r, "vorsicht", `Rorschach-Befehl auf einer fremden Seite (${host}). Analyse spielt ihn trotzdem nur hier ab.`);
  else grund(r, "ok", "Echter Rorschach-Aufbau mit gültiger Prüfsumme. Wird hier abgespielt, ohne eine Seite zu öffnen.");
  grund(r, "hinweis", "Noch nicht signiert (Format R1) – die Echtheit des Absenders ist erst mit R2 prüfbar.");
  r.befehl = b.u; r.aktion = { art: "ueberraschung", adresse: text };
  return r;
}

// ---------------------------------------------------------------- andere Inhalte
function felderAus(text, re) { const f = {}; let m; while ((m = re.exec(text))) f[m[1].toUpperCase()] = m[2]; return f; }
export function pruefeWlan(text) {
  const r = neu("wlan", "WLAN-Zugang"), f = felderAus(text.slice(5), /([TSPH]):((?:\\.|[^;])*);/g);
  r.felder.push(["Netz", (f.S || "").replace(/\\(.)/g, "$1")], ["Schutz", f.T || "keiner"], ["Passwort", f.P ? "enthalten (wird nicht angezeigt)" : "keins"]);
  if (!f.T || /nopass/i.test(f.T)) grund(r, "vorsicht", "Offenes WLAN ohne Passwort – darüber nichts Vertrauliches senden.");
  else if (/WEP/i.test(f.T)) grund(r, "vorsicht", "WEP ist veraltet und leicht zu knacken.");
  else grund(r, "ok", "Geschütztes WLAN. Nur verbinden, wenn der Code vom Betreiber stammt.");
  return r;
}
export function pruefeKontakt(text) {
  const r = neu("kontakt", "Kontakt");
  const z = k => (new RegExp("^" + k + "[^:]*:(.*)$", "im").exec(text) || [])[1]?.trim();
  for (const [k, n] of [["FN", "Name"], ["ORG", "Firma"], ["TEL", "Telefon"], ["EMAIL", "E-Mail"], ["URL", "Webseite"]]) { const v = z(k); if (v) r.felder.push([n, v]); }
  const url = z("URL"); if (url) { const l = pruefeLink(url); for (const g of l.gruende) if (g.stufe !== "ok") grund(r, g.stufe, "Webseite im Kontakt: " + g.text); }
  if (!r.gruende.length) grund(r, "ok", "Visitenkarte. Wird erst nach deiner Bestätigung gespeichert.");
  return r;
}
export function pruefeZahlung(text) {
  const z = text.split(/\r?\n/), r = neu("zahlung", "Zahlungscode");
  let iban, betrag, waehrung, name;
  if (z[0] === "SPC") { r.titel = "Schweizer QR-Rechnung"; iban = z[3]; name = z[5]; betrag = z[18]; waehrung = z[19]; }
  else { r.titel = "SEPA-Überweisung (GiroCode)"; name = z[5]; iban = z[6]; const b = z[7] || ""; waehrung = b.slice(0, 3); betrag = b.slice(3); }
  r.felder.push(["Empfänger", name || "?"], ["IBAN", iban || "?"], ["Betrag", betrag ? `${betrag} ${waehrung || ""}`.trim() : "offen"]);
  if (!ibanGueltig(iban)) grund(r, "gefahr", "Die IBAN ist ungültig (Prüfziffer stimmt nicht).");
  grund(r, "vorsicht", "Zahlungscode: Empfänger und Betrag vor dem Bezahlen mit der Rechnung vergleichen. Analyse bezahlt nie selbst.");
  return r;
}
export function pruefeProdukt(text, format) {
  const r = neu("produkt", "Produktcode");
  r.felder.push(["Nummer", text], ["Art", format || (text.length === 8 ? "EAN-8" : text.length === 12 ? "UPC-A" : "EAN-13")]);
  if (!eanGueltig(text)) { grund(r, "gefahr", "Prüfziffer falsch – der Code ist beschädigt oder gefälscht."); return r; }
  const land = gs1Land(text); if (land) r.felder.push(["Herkunft der Nummer", land]);
  grund(r, "ok", "Prüfziffer stimmt.");
  return r;
}

/** Hauptprüfung. befehlLesen = Funktion aus Rorschach (befehl.js → lesen), damit das Format nur einmal existiert. */
export function analysieren(text, format = "", befehlLesen = () => ({ ok: false, fehler: "Rorschach-Leser fehlt." })) {
  text = (text ?? "").replace(/^﻿/, "");
  const f = (format || "").toLowerCase();
  let r;
  if (/#r[12]\./.test(text) || /^r[12]\./.test(text)) r = pruefeRorschach(text, befehlLesen);
  else if (/^(ean|upc)/.test(f) || (/^\d{8}$|^\d{12,13}$/.test(text) && !f.includes("qr"))) r = pruefeProdukt(text, format);
  else if (/^WIFI:/i.test(text)) r = pruefeWlan(text);
  else if (/^BEGIN:VCARD/i.test(text) || /^MECARD:/i.test(text)) r = pruefeKontakt(text.replace(/^MECARD:/i, "").replace(/;/g, "\n"));
  else if (/^SPC\r?\n/.test(text) || /^BCD\r?\n/.test(text)) r = pruefeZahlung(text);
  else if (/^(mailto|tel|sms|smsto|geo):/i.test(text)) { r = neu("aktion", { mailto: "E-Mail schreiben", tel: "Anrufen", sms: "SMS", smsto: "SMS", geo: "Ort" }[text.split(":")[0].toLowerCase()]);
    r.felder.push(["Inhalt", text]); grund(r, /^(sms|smsto|tel)/i.test(text) ? "vorsicht" : "hinweis", "Der Code möchte eine Aktion auf dem Handy starten – erst nach deiner Bestätigung."); }
  else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || /^(javascript|data|vbscript):/i.test(text)) r = pruefeLink(text);
  else { r = neu("text", "Text"); r.felder.push(["Inhalt", text]); grund(r, "ok", "Reiner Text, keine Aktion."); }
  r.format = format || "";
  return r;
}
