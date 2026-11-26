// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
(() => {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  const STIL = `
    .kb-svg { display: block; width: 100%; height: auto; }
    .kb-svg .bg { fill: transparent !important; }
    .cms-bild .kb-svg.kb-fokus { min-width: 0 !important; }
    .kb-schleier { fill: var(--bg, #262624); opacity: 0; pointer-events: none; transition: opacity .35s ease; }
    .kb-fokus .kb-schleier { opacity: .78; }
    .kb-flaeche { fill: transparent; stroke: transparent; stroke-width: 2.5; cursor: pointer; transition: fill .15s, stroke .15s; }
    .kb-flaeche:hover { fill: rgba(200, 71, 154, .07); stroke: rgba(200, 71, 154, .45); }
    .kb-flaeche:focus { outline: none; }
    .kb-flaeche:focus-visible, .kb-flaeche.kb-an { stroke: var(--accent, #C8479A); }
    .kb-flaeche.kb-an { fill: transparent; }
    .kb-leiste { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 12px 0 0; }
    .kb-knopf { font: inherit; font-size: 13px; color: var(--text, #E8E6E1); background: var(--surface, #30302E);
                border: 1px solid var(--line, #3D3D3A); border-radius: 8px; padding: 6px 12px; cursor: pointer; min-height: 32px; }
    .kb-knopf:hover { border-color: var(--accent, #C8479A); }
    .kb-knopf:disabled { opacity: .4; cursor: default; border-color: var(--line, #3D3D3A); }
    .kb-leiste .kb-tipp { color: var(--muted, #9C9A94); font-size: 12px; margin-left: 4px; }
    .kb-punkte { display: flex; gap: 6px; margin-left: auto; }
    .kb-punkte i { width: 8px; height: 8px; border-radius: 50%; background: var(--line, #3D3D3A); transition: background .2s; cursor: pointer; }
    .kb-punkte i.an { background: var(--accent, #C8479A); }
    .kb-info { margin: 12px 0 0; padding: 16px 20px; border-radius: 12px; background: var(--surface, #30302E);
               border: 1px solid var(--accent, #C8479A); color: var(--text, #E8E6E1); }
    .kb-kopf { display: flex; align-items: center; gap: 12px; margin: 0 0 2px; }
    .kb-kopf small { color: var(--accent, #C8479A); font-size: 12px; font-weight: 600; }
    .kb-kopf .kb-link { margin-left: auto; font-size: 12px; min-height: 28px; padding: 4px 10px; }
    .kb-info h3 { margin: 0 0 4px; font-size: 17px; font-weight: 600; }
    .kb-info p { margin: 0 0 10px; color: var(--muted, #9C9A94); }
    .kb-info ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; }
    .kb-info li { display: flex; gap: 10px; align-items: baseline; }
    .kb-info li::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--accent, #C8479A);
                          flex: none; transform: translateY(-1px); }
    .kb-stand { font-size: 11px; font-weight: 600; border-radius: 999px; padding: 2px 9px; border: 1px solid currentColor; }
    .kb-stand[data-stand="läuft"] { color: #6BAF73; }
    .kb-stand[data-stand="in Arbeit"] { color: var(--accent, #C8479A); }
    .kb-stand[data-stand="geplant"] { color: var(--muted, #9C9A94); border-style: dashed; }
    @media (prefers-color-scheme: light) { :root:not([data-thema="dunkel"]) .kb-stand[data-stand="läuft"] { color: #3F8A4A; } }
    :root[data-thema="hell"] .kb-stand[data-stand="läuft"] { color: #3F8A4A; }
    .kb-werte { display: grid; grid-template-columns: minmax(120px, max-content) 1fr; gap: 6px 20px; margin: 14px 0 0; padding: 12px 14px;
                border-radius: 8px; background: var(--bg, #262624); font-size: 13px; }
    .kb-werte dt { color: var(--muted, #9C9A94); }
    .kb-werte dd { margin: 0; font-variant-numeric: tabular-nums; }
    @media (max-width: 560px) { .kb-werte { grid-template-columns: 1fr; gap: 2px; } .kb-werte dd { margin-bottom: 6px; } }
    .kb-mehr { margin: 12px 0 0; }
    .kb-mehr summary { cursor: pointer; color: var(--accent, #C8479A); font-size: 13px; font-weight: 600; }
    .kb-mehr p { margin: 8px 0 0; color: var(--text, #E8E6E1); line-height: 1.6; }
    .kb-bezug { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 14px 0 0; padding: 12px 0 0;
                border-top: 1px solid var(--line, #3D3D3A); font-size: 12px; color: var(--muted, #9C9A94); }
    .kb-bezug a { color: var(--text, #E8E6E1); text-decoration: none; border: 1px solid var(--line, #3D3D3A); border-radius: 999px;
                  padding: 3px 10px; }
    .kb-bezug a:hover, .kb-bezug a:focus-visible { border-color: var(--accent, #C8479A); color: var(--accent, #C8479A); }
    .kb-bezug a span { color: var(--muted, #9C9A94); }
    @media (prefers-reduced-motion: no-preference) {
      .kb-info { animation: kb-ein .25s ease; }
      .kb-info li { animation: kb-ein .3s ease both; }
      .kb-info li:nth-child(2) { animation-delay: .05s; } .kb-info li:nth-child(3) { animation-delay: .1s; } .kb-info li:nth-child(4) { animation-delay: .15s; }
    }
    @keyframes kb-ein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }`;

  const begrenzen = (css, id) =>
    css.replace(/(?<=^|[{}])(\s*)([^{}]+?)\s*\{/g, (ganz, leer, wahl) =>
      wahl.trim().startsWith("@") || /^(\d+(\.\d+)?%|from|to)(\s*,\s*(\d+(\.\d+)?%|from|to))*$/.test(wahl.trim()) ? ganz
        : leer + wahl.split(",").map(s => `#${id} ${s.trim()}`).join(", ") + " {");

  const HELL = /@media\s*\(prefers-color-scheme:\s*light\)\s*\{((?:[^{}]*\{[^{}]*\})*[^{}]*)\}/g;
  const vorsetzen = (regeln, vor) => regeln.replace(/([^{}]+)\{([^{}]*)\}/g, (_, wahl, inhalt) =>
    wahl.split(",").map(s => `${vor} ${s.trim()}`).join(", ") + " {" + inhalt + "}");
  const themaFolgen = css => css.replace(HELL, (_, regeln) =>
    `@media (prefers-color-scheme: light) {${vorsetzen(regeln, ':root:not([data-thema="dunkel"])')}}\n` +
    vorsetzen(regeln, ':root[data-thema="hell"]'));

  const ruhig = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([a, v]) => e.setAttribute(a, v));
    if (text != null) e.textContent = text;
    return e;
  };
  const holen = async (url, art) => { const r = await fetch(url, { cache: "no-store" }); if (!r.ok) throw new Error(url + " " + r.status); return art === "json" ? r.json() : r.text(); };

  const KAPITEL = new Map();   // kapitel-id → { titel, teile[], waehlen(i), zurueck(), sichtbar() }
  const teilTitel = ref => { const [k, t] = ref.split("/"); return KAPITEL.get(k)?.teile.find(x => x.id === t)?.titel ?? t; };
  const kapitelTitel = k => KAPITEL.get(k)?.titel ?? k;

  function springen(ref, { scrollen = true } = {}) {
    const [k, t] = ref.split("/");
    const kap = KAPITEL.get(k);
    if (!kap) return false;
    kap.sichtbar();
    const i = t ? kap.teile.findIndex(x => x.id === t) : -1;
    if (i >= 0) kap.waehlen(i); else kap.zurueck();
    if (scrollen) kap.svg.scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: "start" });
    return true;
  }
  const adresseSetzen = ref => { if (location.hash.slice(1) !== ref) history.replaceState(null, "", "#" + ref); };

  async function einbauen(img) {
    let daten, text;
    try {
      [daten, text] = await Promise.all([holen(img.getAttribute("data-kacheln"), "json"), holen(img.src)]);
    } catch (f) { console.warn("kacheln:", f.message); return; }
    const kap = daten.kapitel;
    const id = "kb-" + kap;
    text = text.replace(/\bid="([^"]+)"/g, `id="${id}-$1"`)
               .replace(/url\(#([^)]+)\)/g, `url(#${id}-$1)`)
               .replace(/href="#([^"]+)"/g, `href="#${id}-$1"`)
               .replace(/aria-labelledby="([^"]+)"/, (_, l) => `aria-labelledby="${l.split(" ").map(x => id + "-" + x).join(" ")}"`);
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    if (doc.documentElement.nodeName !== "svg") return;
    const svg = document.importNode(doc.documentElement, true);
    svg.id = id;
    svg.classList.add("kb-svg");
    svg.querySelectorAll("style").forEach(s => { s.textContent = themaFolgen(begrenzen(s.textContent, id)); });
    const [vx, vy, vw, vh] = svg.getAttribute("viewBox").split(/\s+/).map(Number);
    const ganz = [vx, vy, vw, vh];

    const imSvg = new Map([...svg.querySelectorAll("[data-teil]")].map(e => [e.getAttribute("data-teil"), e]));
    const teile = daten.teile.filter(t => {
      const e = imSvg.get(t.id);
      if (!e) { console.warn(`kacheln: „${kap}/${t.id}“ steht in der JSON-Datei, aber nicht im SVG (data-teil).`); return false; }
      t.f = ["x", "y", "width", "height"].map(a => Number(e.getAttribute(a)));
      return t.f.every(n => Number.isFinite(n));
    });
    imSvg.forEach((_, t) => { if (!daten.teile.some(x => x.id === t)) console.warn(`kacheln: „${kap}/${t}“ hat data-teil im SVG, aber keinen Text in der JSON-Datei.`); });

    const schleier = document.createElementNS(NS, "path");
    schleier.setAttribute("class", "kb-schleier");
    schleier.setAttribute("fill-rule", "evenodd");
    const ebene = document.createElementNS(NS, "g");
    const flaechen = teile.map((k, i) => {
      const [x, y, w, h] = k.f;
      const r = document.createElementNS(NS, "rect");
      Object.entries({ x: x - 3, y: y - 3, width: w + 6, height: h + 6, rx: 12, class: "kb-flaeche", tabindex: 0, role: "button" })
        .forEach(([a, v]) => r.setAttribute(a, v));
      r.setAttribute("aria-label", `${k.titel} – einzeln ansehen`);
      const los = () => (aktiv === i ? zurueck() : waehlen(i));
      r.addEventListener("click", los);
      r.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); los(); } });
      ebene.append(r);
      return r;
    });
    svg.append(schleier, ebene);

    const leiste = el("div", { class: "kb-leiste" });
    const vorKnopf = el("button", { type: "button", class: "kb-knopf", "aria-label": "Vorheriger Kernteil" }, "◀");
    const nachKnopf = el("button", { type: "button", class: "kb-knopf", "aria-label": "Nächster Kernteil" }, "▶");
    const ganzKnopf = el("button", { type: "button", class: "kb-knopf" }, "Gesamtbild");
    const tipp = el("span", { class: "kb-tipp" }, "Kernteil anklicken oder mit ▶ Schritt für Schritt durchgehen.");
    const punkte = el("span", { class: "kb-punkte" });
    teile.forEach((k, i) => { const p = el("i", { title: k.titel }); p.addEventListener("click", () => waehlen(i)); punkte.append(p); });
    leiste.append(vorKnopf, nachKnopf, ganzKnopf, tipp, punkte);
    const info = el("div", { class: "kb-info", "aria-live": "polite" });
    info.hidden = true;

    let aktiv = -1, box = ganz.slice(), lauf = 0;
    const setzeBox = b => { box = b; svg.setAttribute("viewBox", b.map(n => n.toFixed(2)).join(" ")); };
    const fahren = ziel => {
      cancelAnimationFrame(lauf);
      if (ruhig() || !svg.isConnected || !svg.getClientRects().length) { setzeBox(ziel); return; }
      const von = box.slice(), t0 = performance.now(), dauer = 550;
      const schritt = t => {
        const p = Math.min(1, (t - t0) / dauer), e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        setzeBox(von.map((v, i) => v + (ziel[i] - v) * e));
        if (p < 1) lauf = requestAnimationFrame(schritt);
      };
      lauf = requestAnimationFrame(schritt);
    };
    const ausschnitt = ([x, y, w, h]) => {
      const rand = 36, seiten = vw / vh;
      const breite = svg.getBoundingClientRect().width || 1000;
      const schmal = breite < 600 || (svg.closest(".cms-bild")?.clientWidth ?? 1000) < 600;
      let bw = Math.max(w + 2 * rand, vw * (schmal ? 0 : 0.45)), bh = Math.max(h + 2 * rand, bw / seiten);
      bw = Math.max(bw, bh * seiten);
      let bx = x + w / 2 - bw / 2, by = y + h / 2 - bh / 2;
      bx = Math.min(Math.max(bx, vx), vx + vw - bw); by = Math.min(Math.max(by, vy), vy + vh - bh);
      if (bw >= vw) bx = vx; if (bh >= vh) by = vy;
      return [bx, by, Math.min(bw, vw), Math.min(bh, vh)];
    };
    const loch = ([x, y, w, h]) => {
      const r = Math.min(12, h / 2 + 6);
      return `M${vx - 10},${vy - 10}h${vw + 20}v${vh + 20}h${-(vw + 20)}z ` +
        `M${x - 6},${y - 6 + r}a${r},${r} 0 0 1 ${r},${-r}h${w + 12 - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h + 12 - 2 * r}` +
        `a${r},${r} 0 0 1 ${-r},${r}h${-(w + 12 - 2 * r)}a${r},${r} 0 0 1 ${-r},${-r}z`;
    };
    const leisteAuffrischen = () => {
      vorKnopf.disabled = aktiv <= 0;
      nachKnopf.disabled = aktiv >= teile.length - 1;
      ganzKnopf.disabled = aktiv < 0;
      tipp.hidden = aktiv >= 0;
      [...punkte.children].forEach((p, i) => p.classList.toggle("an", i === aktiv));
    };
    const waehlen = i => {
      aktiv = i;
      const k = teile[i];
      flaechen.forEach((r, j) => r.classList.toggle("kb-an", j === i));
      schleier.setAttribute("d", loch(k.f));
      svg.classList.add("kb-fokus");
      const wisch = svg.closest(".cms-bild"); if (wisch) wisch.scrollLeft = 0;
      fahren(ausschnitt(k.f));
      const ref = `${kap}/${k.id}`;
      const linkKnopf = el("button", { type: "button", class: "kb-knopf kb-link", title: "Adresse dieses Teils kopieren" }, "Link kopieren");
      linkKnopf.addEventListener("click", async () => {
        const url = location.href.split("#")[0] + "#" + ref;
        try { await navigator.clipboard.writeText(url); linkKnopf.textContent = "Kopiert: #" + ref; }
        catch { linkKnopf.textContent = "#" + ref; }
        setTimeout(() => { linkKnopf.textContent = "Link kopieren"; }, 2500);
      });
      const kopf = el("div", { class: "kb-kopf" });
      kopf.append(el("small", {}, `${daten.titel} · Teil ${i + 1} von ${teile.length}`));
      if (k.stand) kopf.append(el("span", { class: "kb-stand", "data-stand": k.stand }, k.stand));
      kopf.append(linkKnopf);
      info.replaceChildren(kopf, el("h3", {}, k.titel), el("p", {}, k.satz));
      const ul = el("ul");
      (k.punkte || []).forEach(t => ul.append(el("li", {}, t)));
      info.append(ul);
      if (k.werte?.length) {
        const dl = el("dl", { class: "kb-werte" });
        k.werte.forEach(([name, wert]) => dl.append(el("dt", {}, name), el("dd", {}, wert)));
        info.append(dl);
      }
      if (k.mehr) {
        const d = el("details", { class: "kb-mehr" });
        d.append(el("summary", {}, "Hintergrund"), el("p", {}, k.mehr));
        info.append(d);
      }
      if (k.bezug?.length) {
        const bz = el("div", { class: "kb-bezug" });
        bz.append(el("span", {}, "Bezug:"));
        k.bezug.forEach(b => {
          const [bk] = b.split("/");
          const a = el("a", { href: "#" + b });
          a.append(document.createTextNode(teilTitel(b)));
          if (bk !== kap) { a.append(" "); a.append(el("span", {}, "· " + kapitelTitel(bk))); }
          a.addEventListener("click", e => { e.preventDefault(); if (springen(b)) adresseSetzen(b); });
          bz.append(a);
        });
        info.append(bz);
      }
      info.hidden = false;
      leisteAuffrischen();
      adresseSetzen(ref);
    };
    const zurueck = () => {
      aktiv = -1;
      flaechen.forEach(r => r.classList.remove("kb-an"));
      svg.classList.remove("kb-fokus");
      fahren(ganz);
      info.hidden = true;
      leisteAuffrischen();
      if (location.hash.slice(1).split("/")[0] === kap) adresseSetzen(kap);
    };
    vorKnopf.addEventListener("click", () => waehlen(Math.max(0, aktiv - 1)));
    nachKnopf.addEventListener("click", () => waehlen(Math.min(teile.length - 1, aktiv + 1)));
    ganzKnopf.addEventListener("click", zurueck);
    const tasten = e => {
      if (e.key === "Escape" && aktiv >= 0) zurueck();
      else if (e.key === "ArrowRight" && aktiv < teile.length - 1) { e.preventDefault(); waehlen(aktiv + 1); }
      else if (e.key === "ArrowLeft" && aktiv > 0) { e.preventDefault(); waehlen(aktiv - 1); }
    };
    svg.addEventListener("keydown", tasten);
    leiste.addEventListener("keydown", tasten);

    img.replaceWith(svg);
    (svg.closest(".cms-bild, figure") || svg).after(leiste, info);
    leisteAuffrischen();

    const sichtbar = () => {
      const panel = svg.closest('[role="tabpanel"]');
      if (panel?.hidden) document.querySelector(`[role="tab"][aria-controls="${panel.id}"]`)?.click();
      const karte = svg.closest("details");
      if (karte && !karte.open) karte.open = true;
    };
    KAPITEL.set(kap, { titel: daten.titel, teile, svg, waehlen, zurueck, sichtbar });
  }

  const start = async () => {
    if (location.protocol === "file:") return; // file:// liefert kein fetch – stilles Bild bleibt
    document.head.append(el("style", {}, STIL));
    await Promise.all([...document.querySelectorAll("img[data-kacheln]")].map(einbauen));
    const ziel = decodeURIComponent(location.hash.slice(1));
    if (ziel.includes("/") || KAPITEL.has(ziel)) springen(ziel, { scrollen: ziel.includes("/") });
    addEventListener("hashchange", () => springen(decodeURIComponent(location.hash.slice(1))));
    window.CaelumKacheln = { springen, kapitel: () => [...KAPITEL.keys()] };
    document.dispatchEvent(new CustomEvent("kb-bereit"));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
