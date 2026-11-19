// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – Format R2 (verschlüsselt + signiert) in JavaScript mit WebCrypto. Master ist R2.cs; der Gleichheitstest
// öffnet Codes der App mit diesem Code. Wird von Caelum Analyse geladen (../r/r2.js). WebCrypto gibt es nur über HTTPS/localhost.
//   r2.<Base64url( [2][Schalter][Kreis 4] | Nonce 12 | Geheimtext+Tag 16 | Signatur 64 )>   Schalter: 1 verschlüsselt, 2 signiert
//   k1.<Base64url( [1] | Kreis 4 | gültig bis 4 | AES 32 | öffentlich 65 | Name )>
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
import { fromB64url, b64url, lesen as r1Lesen, KENNUNG as R1 } from "./befehl.js";

export const KENNUNG = "r2.", KOPPLUNG = "k1.";
const be32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];
const teil = t => { t = (t || "").trim(); const h = t.indexOf("#"); return h >= 0 ? t.slice(h + 1) : t; };

/** Kopf lesen, ohne Schlüssel: { ok, kreis, verschluesselt, signiert, bytes } */
export function kopf(text) {
  const t = teil(text); if (!t.startsWith(KENNUNG)) return { ok: false, fehler: "Kein R2-Code." };
  let b; try { b = fromB64url(t.slice(KENNUNG.length)); } catch { return { ok: false, fehler: "R2-Code beschädigt (Zeichen)." }; }
  if (b.length < 6 + 64 + 5 || b[0] !== 2) return { ok: false, fehler: "R2-Code beschädigt (Kopf)." };
  return { ok: true, kreis: be32(b, 2), verschluesselt: !!(b[1] & 1), signiert: !!(b[1] & 2), bytes: b };
}

/** Schlüssel aus Rohdaten bilden (nicht exportierbar). aes: 32 Byte, oeffentlich: 65 Byte (04|X|Y). */
export async function schluessel(aes, oeffentlich) {
  const s = crypto.subtle;
  return {
    aes: await s.importKey("raw", aes, { name: "AES-GCM" }, false, ["decrypt"]),
    pub: await s.importKey("raw", oeffentlich, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]),
  };
}

/** R2-Code öffnen. kreise: Map(kreisNummer → { aes, pub, name }) aus schluessel(). → { ok, u, kreis, name } oder { ok:false, fehler, art } */
export async function oeffnen(text, kreise) {
  const k = kopf(text); if (!k.ok) return { ...k, art: "beschaedigt" };
  const kr = kreise.get(k.kreis);
  if (!kr) return { ok: false, art: "fremd", kreis: k.kreis, fehler: `Verschlüsselt für Kreis ${k.kreis} – dieses Gerät ist nicht gekoppelt.` };
  if (!k.signiert) return { ok: false, art: "unsigniert", fehler: "R2-Code ohne Signatur wird nicht angenommen." };
  const b = k.bytes, ohne = b.slice(0, b.length - 64), sig = b.slice(b.length - 64);
  const echt = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, kr.pub, sig, ohne);
  if (!echt) return { ok: false, art: "signatur", kreis: k.kreis, fehler: "Signatur falsch – gefälscht oder beschädigt." };
  let inhalt;
  if (k.verschluesselt) {
    if (ohne.length < 6 + 12 + 16 + 5) return { ok: false, art: "beschaedigt", fehler: "R2-Code beschädigt (Länge)." };
    try { inhalt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: ohne.slice(6, 18), additionalData: ohne.slice(0, 6), tagLength: 128 }, kr.aes, ohne.slice(18))); }
    catch { return { ok: false, art: "entschluesseln", kreis: k.kreis, fehler: "Entschlüsseln fehlgeschlagen (falscher Schlüssel oder verändert)." }; }
  } else inhalt = ohne.slice(6);
  const r = r1Lesen("#" + R1 + b64url(inhalt));
  return r.ok ? { ok: true, u: r.u, kreis: k.kreis, name: kr.name, verschluesselt: k.verschluesselt } : { ok: false, art: "inhalt", fehler: r.fehler };
}

/** Kopplungs-Code lesen → { ok, kreis, bis (Date), aes, oeffentlich, name } (Rohdaten, gleich in schluessel() geben und vergessen) */
export function kopplung(text) {
  const t = teil(text); if (!t.startsWith(KOPPLUNG)) return { ok: false, fehler: "Kein Kopplungs-Code." };
  let b; try { b = fromB64url(t.slice(KOPPLUNG.length)); } catch { return { ok: false, fehler: "Kopplungs-Code beschädigt." }; }
  if (b.length < 1 + 4 + 4 + 32 + 65 + 1 || b[0] !== 1 || b[41] !== 4) return { ok: false, fehler: "Kopplungs-Code beschädigt." };
  let name; try { name = new TextDecoder("utf-8", { fatal: true }).decode(b.slice(106)); } catch { return { ok: false, fehler: "Kopplungs-Code beschädigt (Name)." }; }
  return { ok: true, kreis: be32(b, 1), bis: new Date(be32(b, 5) * 1000), aes: b.slice(9, 41), oeffentlich: b.slice(41, 106), name };
}

/** Fingerabdruck wie in Rorschach (erste 8 Hex-Zeichen von SHA-256 des öffentlichen Schlüssels, „ABCD 1234“). */
export async function fingerabdruck(oeffentlich) {
  const h = [...new Uint8Array(await crypto.subtle.digest("SHA-256", oeffentlich))].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
  return h.slice(0, 4) + " " + h.slice(4, 8);
}
