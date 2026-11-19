// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Analyse – gekoppelte Kreise (Format R2, KRYPTO.md): nur im Browser dieses Geräts, IndexedDB „caelum-analyse“.
// Die Schlüssel liegen als nicht exportierbare CryptoKeys dort – kein Skript kann sie wieder auslesen, nur benutzen.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – freigegeben von Kenny Looser am 19.11.2026 (GB-8).
const DB = "caelum-analyse", STORE = "kreise";

function oeffnenDb() {
  return new Promise((ok, err) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "kreis" });
    r.onsuccess = () => ok(r.result); r.onerror = () => err(r.error);
  });
}
async function mit(modus, fn) {
  const db = await oeffnenDb();
  try { return await new Promise((ok, err) => { const t = db.transaction(STORE, modus), s = t.objectStore(STORE), r = fn(s);
    t.oncomplete = () => ok(r?.result); t.onerror = () => err(t.error); }); }
  finally { db.close(); }
}
/** Alle Kreise als Map(kreis → { kreis, name, aes, pub, fingerabdruck, gekoppelt }) */
export async function alle() { const l = await mit("readonly", s => s.getAll()); return new Map((l || []).map(k => [k.kreis, k])); }
export async function speichern(k) { await mit("readwrite", s => s.put(k)); }
export async function entfernen(kreis) { await mit("readwrite", s => s.delete(kreis)); }
