// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Web-Grundmodul (CAELUM-STANDARD.md, Teil B): liest apps/apps.json, hängt unter jede passende Produktkarte das Feld
// „Im Browser ausprobieren“ und lädt den Code eines Moduls erst beim Aufklappen. Übergabe zwischen Modulen über
// caelum.geben(art, blob, meta) / ctx.nehmen(art, fn). Keine Anmeldung, kein Hochladen, nichts verlässt den Browser.

const BASIS = new URL("../", import.meta.url);          // …/apps/
const module_ = new Map();                                // id → { app, details, body, geladen (Promise) }
const nehmer = new Map();                                 // art → [{ id, fn }]
const warten = new Map();                                 // art → Liste von Übergaben, die noch keinen Nehmer haben

function el(tag, attrs = {}, ...kinder) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kinder) if (k != null) e.append(k);
  return e;
}

/** Datei im Browser speichern (ohne Server). */
export function speichern(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Daten an ein anderes Modul geben: klappt das Ziel auf, lädt es und ruft dessen Nehmer auf. */
export async function geben(art, blob, meta = {}) {
  const ziel = [...module_.values()].find(m => (m.app.nimmt || []).includes(art));
  if (!ziel) throw new Error("Kein Modul nimmt „" + art + "“ an.");
  (warten.get(art) || warten.set(art, []).get(art)).push({ blob, meta });
  ziel.details.open = true;
  await laden(ziel);
  ausliefern(art);
  ziel.details.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ausliefern(art) {
  const liste = warten.get(art), fns = nehmer.get(art);
  if (!liste || !fns || !fns.length) return;
  while (liste.length) { const x = liste.shift(); for (const n of fns) n.fn(x.blob, x.meta); }
}

function kontext(m) {
  return {
    id: m.app.id,
    version: m.app.version,
    basis: new URL(m.app.id + "/", BASIS).href,             // Ordner des Moduls (Daten, Schriften)
    geben,
    speichern,
    nehmen(art, fn) { (nehmer.get(art) || nehmer.set(art, []).get(art)).push({ id: m.app.id, fn }); ausliefern(art); },
  };
}

function laden(m) {
  if (!m.geladen) {
    m.body.replaceChildren(el("p", { class: "caelum-try-wait" }, "Wird geladen …"));
    m.geladen = import(new URL(m.app.id + "/" + m.app.einstieg + "?v=" + encodeURIComponent(m.app.hash || m.app.version), BASIS).href)
      .then(async mod => { m.body.replaceChildren(); await mod.mount(m.body, kontext(m)); })
      .catch(e => {
        m.geladen = null;
        m.body.replaceChildren(el("p", { class: "caelum-try-err" }, "Das Modul konnte nicht geladen werden: " + (e && e.message || e)));
        throw e;
      });
  }
  return m.geladen;
}

async function start() {
  let liste;
  try {
    const r = await fetch(new URL("apps.json", BASIS), { cache: "no-cache" });
    if (!r.ok) return;
    liste = (await r.json()).apps || [];
  } catch { return; }

  for (const app of liste) {
    if (!app || app.status === "aus") continue;
    const karte = document.getElementById(app.karte);
    if (!karte) continue;
    const body = el("div", { class: "caelum-try-body" });
    const kopf = el("summary", {},
      el("span", { class: "caelum-try-pfeil", "aria-hidden": "true" }, "▸"),
      el("span", {}, "Im Browser ausprobieren"),
      el("span", { class: "caelum-try-titel" }, app.titel || ""),
      app.status === "vorschau" ? el("span", { class: "caelum-try-badge" }, "Vorschau") : null);
    const details = el("details", { class: "caelum-try", id: "try-" + app.id, "data-app": app.id }, kopf, body,
      el("p", { class: "caelum-try-fuss" },
        "Läuft nur in deinem Browser – nichts wird hochgeladen. Web-Fassung von ", el("b", {}, app.produkt || app.id), " " + (app.version || "") + ". ",
        el("a", { href: app.vollversion || "#downloads" }, "Volle Version")));
    const m = { app, details, body, geladen: null };
    module_.set(app.id, m);
    details.addEventListener("toggle", () => { if (details.open) laden(m).catch(() => {}); });
    const links = karte.querySelector(".links");
    karte.insertBefore(details, links || null);
    if (location.hash === "#try-" + app.id) {
      // Direktlink: aufklappen und nach dem Laden hinscrollen (das Feld entsteht erst nach dem Laden der Seite)
      details.open = true;
      const hin = () => window.scrollTo({ top: details.getBoundingClientRect().top + window.scrollY - 80, behavior: "instant" });
      laden(m).then(() => { hin(); setTimeout(hin, 600); }).catch(() => {});
    }
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
window.caelum = { geben, speichern };
