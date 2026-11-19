// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Rorschach – Befehlsformat R1, JavaScript-Fassung von Befehl.cs (Master). <Basis>#r1.<Base64url([Typ][Objekt][Farbe][Botschaft][CRC-16])>
// Was hinter „#“ steht, schickt der Browser nie an einen Server.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
export const KENNUNG = "r1.";
export const TYP_UEBERRASCHUNG = 1;
export const MAX_BOTSCHAFT = 58;
export const FARBEN = ["caelum", "spektrum"];

export function crc16(data) { let c = 0xFFFF;
  for (const x of data) { c ^= x << 8; for (let i = 0; i < 8; i++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
  return c; }
export const botschaftBytes = t => new TextEncoder().encode((t || "").normalize("NFC")).length;

export function bytes({ objekt = 1, farbe = 0, botschaft = "" }) {
  const text = [...new TextEncoder().encode((botschaft || "").normalize("NFC"))];
  if (text.length > MAX_BOTSCHAFT) throw new Error(`Botschaft ist ${text.length} Byte lang, erlaubt sind ${MAX_BOTSCHAFT}.`);
  const b = [TYP_UEBERRASCHUNG, objekt & 255, farbe & 255, ...text], c = crc16(b);
  b.push(c >> 8, c & 255); return b;
}
export function b64url(b) { let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); }
export function fromB64url(s) { if (/[^A-Za-z0-9_-]/.test(s)) throw new Error("Zeichen"); s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const t = atob(s), r = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) r[i] = t.charCodeAt(i); return r; }

export const hash = u => KENNUNG + b64url(bytes(u));
export function normBasis(basis) { basis = (basis || "").trim(); const h = basis.indexOf("#"); if (h >= 0) basis = basis.slice(0, h);
  if (!basis.endsWith("/") && !basis.endsWith(".html")) basis += "/"; return basis; }
export const url = (basis, u) => normBasis(basis) + "#" + hash(u);

/** Adresse oder Teil hinter „#“ → {ok, u:{objekt, farbe, botschaft}, fehler} */
export function lesen(text) {
  text = (text || "").trim(); const h = text.indexOf("#"); if (h >= 0) text = text.slice(h + 1);
  if (!text.startsWith(KENNUNG)) return { ok: false, fehler: "Kein Rorschach-Befehl (r1. fehlt)." };
  let b; try { b = fromB64url(text.slice(KENNUNG.length)); } catch { return { ok: false, fehler: "Befehl ist beschädigt (Zeichen)." }; }
  if (b.length < 5) return { ok: false, fehler: "Befehl ist zu kurz." };
  if (crc16(b.slice(0, b.length - 2)) !== ((b[b.length - 2] << 8) | b[b.length - 1])) return { ok: false, fehler: "Befehl ist beschädigt (Prüfsumme)." };
  if (b[0] !== TYP_UEBERRASCHUNG) return { ok: false, fehler: `Befehlstyp ${b[0]} kennt diese Fassung nicht.` };
  if (b[2] > 1) return { ok: false, fehler: "Unbekannte Farbe." };
  let botschaft; try { botschaft = new TextDecoder("utf-8", { fatal: true }).decode(b.slice(3, b.length - 2)); } catch { return { ok: false, fehler: "Botschaft ist kein gültiges UTF-8." }; }
  return { ok: true, u: { objekt: b[1], farbe: b[2], botschaft } };
}
