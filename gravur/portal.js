"use strict";
// ───────── Grundlagen ─────────
const PORTAL_VERSION = "0.1";
const K = window.CAELUM_KATALOG, PREISE = window.CAELUM_PREISE, CODES = window.CAELUM_BAUSTELLEN || {};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n, d = 1) => Number(n).toLocaleString("de-CH", { maximumFractionDigits: d, minimumFractionDigits: 0 });
const pchf = n => n == null ? "auf Anfrage" : chf(n);
const chf = n => PREISE.waehrung + " " + Number(n).toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Kunststofftypen aus katalog.js (erzeugt aus src/Caelum.Gravur.Core/katalog.json) → eine Farbliste
// Nur Typen, die der P2S graviert UND schneidet (katalog.json: laserSchneiden "j") – Entscheid Kenny 18.11.2026
const LIEF = K.lieferant || { name: "gravurshop24.ch", web: "https://www.gravurshop24.ch/kunststoffe/" };
const HAUPT = { LASERPLY: ["S00", "S10", "S35", "S48", "S26", "S60", "S71", "S55", "S88", "S66"] };
const FAMS = (K.typen || [{ id: "LASERPLY", name: "LASERPLY", kurz: "", laserSchneiden: "j", dicken: K.dicken, farben: K.materialien }])
  .filter(t => t.laserSchneiden === "j")
  .map(t => ({ ...t, supplier: LIEF.name, url: LIEF.web, laserCut: true, empfohlen: t.id === "LASERPLY",
               haupt: HAUPT[t.id] || (t.farben.length > 12 ? t.farben.slice(0, 10).map(f => f.code) : null),
               note: [t.temperatur ? "Temperatur " + t.temperatur : "", t.schichten?.length ? t.schichten.length + " Schichten" : ""].filter(Boolean).join(" · ") }));
const ALL = FAMS.flatMap(f => f.farben.map(m => ({ ...m, fam: f, metal: !!(m.metal || f.metal) })));
const mat = code => ALL.find(m => m.code === code) || ALL[0];
const stockFor = (m, t) => { const i = m.fam.dicken.findIndex(x => Math.abs(x - t) < 0.01); return i < 0 ? "-" : (m.avail[i] || "-"); };
// gewünschte Dicke, sonst die nächstliegende lieferbare (ab Lager vor Bestellung)
const firstThickness = (m, pref) => {
  if (stockFor(m, pref) !== "-") return pref;
  const ok = m.fam.dicken.filter(t => stockFor(m, t) !== "-").sort((a, b) => (stockFor(m, a) === "L" ? 0 : 1) - (stockFor(m, b) === "L" ? 0 : 1) || Math.abs(a - pref) - Math.abs(b - pref));
  return ok[0] ?? m.fam.dicken[0];
};
let showAllColors = false;
const stockText = s => s === "L" ? "ab Lager" : s === "B" ? "auf Bestellung (längere Lieferzeit)" : "in dieser Dicke nicht lieferbar";
const P2S = { w: 600, h: 308 }, SHEET_MARGIN = 5;

// Standardwerte = SignSettings in Settings.cs
function defaultSettings() {
  return {
    MaterialType: "LASERPLY", MaterialCode: "S00", Thickness: 1.5, Width: 100, Height: 30, CornerRadius: 0, Holes: "Links", HoleDiameter: 4, HoleOffset: 5,
    Rows: 2, Columns: 1, TextHeight: 5, Font: "Arial", Bold: false, Align: "Mitte", TextMargin: 2, AutoShrink: true, ColumnLines: false,
    Contour: "Schneiden", CutHoles: true, TextOp: "Gravieren",
    SheetWidth: 610, SheetHeight: 305, SheetMargin: 5, Gap: 2, AllowRotate: true, WorkWidth: 600, WorkHeight: 308, SheetFrame: false,
    WastePercent: 10, OrderLargeSheets: true, HeaderRow: true,
  };
}

// ───────── Zustand ─────────
let site = null;           // entschlüsselte Baustellen-Daten
let siteCode = "";
// Auftragseingang (20.11.2026): Apps Script „Caelum Kunden“ legt die ZIP in Drive, Caelum Gravur holt sie unter Admin → Eingang
const EINGANG_URL = "https://script.google.com/macros/s/AKfycby2-eYtWh-42XLM6Rq3k6PWXg_6TnZzL2eX3rnk4gHhyHwD8FhXPKMJ4MhaciZsDlSoeQ/exec";
let state = { positions: [], contact: {} };
let cur = 0, curSign = 0;

function newPosition() {
  const s = Object.assign(defaultSettings(), site?.vorgaben || {});
  if (site?.farbenFest && site.farben?.length && !site.farben.includes(s.MaterialCode)) s.MaterialCode = site.farben[0];
  return { name: "", s, shape: s.CornerRadius > 0 ? "round" : "rect", signs: [{ count: 1, ort: "", fields: ["LÜF 01", "Zuluft Temperatur"] }] };
}
const P = () => state.positions[cur];
const fieldCount = s => Math.max(1, s.Rows) * Math.max(1, s.Columns);

function save() {
  try { localStorage.setItem("caelum-gravur-" + siteCode, JSON.stringify(state)); }
  catch { try { localStorage.setItem("caelum-gravur-" + siteCode, JSON.stringify({ ...state, plans: [] })); } catch {} } // Pläne zu gross: ohne Bilder sichern
}
function restore() {
  try { const t = localStorage.getItem("caelum-gravur-" + siteCode); if (t) { const v = JSON.parse(t); if (v?.positions?.length) return v; } } catch {}
  return null;
}

// ───────── Baustellen-Code ─────────
const norm = c => c.trim().toUpperCase().replace(/\s+/g, "");
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function openCode(code) {
  code = norm(code);
  if (!code) throw new Error("Bitte den Code eingeben.");
  if (!crypto?.subtle) throw new Error("Der Browser unterstützt die Prüfung nicht (nur über https möglich).");
  const id = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("caelum-gravur:" + code)));
  const e = CODES[id];
  if (!e) throw new Error("Code unbekannt. Bitte prüfen oder bei Caelum nachfragen.");
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(code), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(e.salt), iterations: 150000, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv) }, key, unb64(e.data));
  return { code, data: JSON.parse(new TextDecoder().decode(plain)) };
}
async function enter() {
  $("codeErr").textContent = "";
  $("codeBtn").disabled = true;
  try {
    const r = await openCode($("codeIn").value);
    site = r.data; siteCode = r.code;
    try { sessionStorage.setItem("caelum-gravur-code", siteCode); } catch {}
    state = restore() || { positions: [newPosition()], contact: {} };
    // Entwürfe mit Material, das es im Portal nicht mehr gibt: auf das erste Angebot setzen
    state.positions.forEach(p => { if (!ALL.some(m => m.code === p.s.MaterialCode)) { p.s.MaterialCode = ALL[0].code; p.s.Thickness = firstThickness(ALL[0], p.s.Thickness); } });
    cur = 0; curSign = 0;
    $("gate").classList.add("hidden"); $("app").classList.remove("hidden");
    $("siteHead").innerHTML = esc(site.baustelle) + "<br>" + esc(site.kunde || "");
    $("siteInfo").innerHTML = `<b>${esc(site.baustelle)}</b>${site.projekt ? " · Projekt " + esc(site.projekt) : ""}${site.hinweis ? "<br>" + esc(site.hinweis) : ""}`;
    fillContact(); renderAll();
  } catch (e) { $("codeErr").textContent = e.message || String(e); }
  $("codeBtn").disabled = false;
}

// ───────── Geometrie (wie SignGeometry.cs) ─────────
const measureCtx = document.createElement("canvas").getContext("2d");
const CAP = 0.716; // Grossbuchstabenhöhe Arial / Schriftgrösse
function measure(text, bold) { measureCtx.font = `${bold ? "bold " : ""}100px Arial, Helvetica, sans-serif`; return measureCtx.measureText(text).width / 100; }

function holesFor(s) {
  const w = s.Width, h = s.Height, o = s.HoleOffset, r = s.HoleDiameter / 2;
  return ({ Links: [[o, h / 2]], Rechts: [[w - o, h / 2]], Beide: [[o, h / 2], [w - o, h / 2]], ObenMitte: [[w / 2, o]],
            VierEcken: [[o, o], [w - o, o], [o, h - o], [w - o, h - o]] }[s.Holes] || []).map(([x, y]) => ({ x, y, r }));
}
function layout(s, fields) {
  const w = s.Width, h = s.Height, notes = [], texts = [], lines = [];
  const reserve = s.HoleOffset + s.HoleDiameter / 2 + 1;
  let x0 = s.TextMargin, x1 = w - s.TextMargin, y0 = s.TextMargin, y1 = h - s.TextMargin;
  if (s.Holes === "Links") x0 = Math.max(x0, reserve);
  if (s.Holes === "Rechts") x1 = Math.min(x1, w - reserve);
  if (s.Holes === "Beide" || s.Holes === "VierEcken") { x0 = Math.max(x0, reserve); x1 = Math.min(x1, w - reserve); }
  if (s.Holes === "ObenMitte") y0 = Math.max(y0, reserve);
  if (x1 - x0 < 1 || y1 - y0 < 1) return { texts, lines, notes: ["Kein Platz für Text."] };
  const rows = Math.max(1, s.Rows), cols = Math.max(1, s.Columns), cw = (x1 - x0) / cols, chh = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const text = (fields[r * cols + c] || "").replace(/\r/g, "");
    if (!text.trim()) continue;
    const ls = text.split("\n"), slot = chh / ls.length;
    const cap = Math.min(s.TextHeight, slot / 1.45);
    if (cap < s.TextHeight - 0.05) notes.push(`Zeile ${r + 1}: Schrift auf ${fmt(cap)} mm verkleinert (Höhe).`);
    ls.forEach((raw, li) => {
      const line = raw.trim(); if (!line) return;
      let lc = cap, tw = measure(line, s.Bold) * lc / CAP;
      const avail = cw - 0.6;
      if (tw > avail) {
        if (s.AutoShrink) { lc *= avail / tw; tw = avail; notes.push(`„${line}“ auf ${fmt(lc)} mm verkleinert (Breite).`); }
        else notes.push(`„${line}“ ist zu lang für das Feld.`);
      }
      const cx0 = x0 + c * cw + 0.3, cx1 = x0 + (c + 1) * cw - 0.3;
      // Blocksatz: in der Vorschau wie links (eine Zeile je Feld), CaelumGravur setzt ihn beim Gravieren
      const x = s.Align === "Links" || s.Align === "Blocksatz" ? cx0 : s.Align === "Rechts" ? cx1 - tw : (cx0 + cx1 - tw) / 2;
      const mid = y0 + r * chh + (li + 0.5) * slot;
      texts.push({ x, y: mid + lc / 2, size: lc / CAP, text: line, cap: lc });
    });
  }
  if (s.ColumnLines && cols > 1) for (let c = 1; c < cols; c++) lines.push({ x: x0 + c * cw, y0, y1 });
  return { texts, lines, notes };
}
function check(s) {
  const w = [], m = mat(s.MaterialCode);
  if (stockFor(m, s.Thickness) === "-") w.push(`${m.code} gibt es nicht in ${fmt(s.Thickness)} mm.`);
  if (!(s.Width >= 10 && s.Height >= 5)) w.push("Schild ist zu klein (mindestens 10 × 5 mm).");
  const fits = (a, b) => a <= P2S.w - 2 * SHEET_MARGIN && b <= P2S.h - 2 * SHEET_MARGIN;
  if (!fits(s.Width, s.Height) && !fits(s.Height, s.Width)) w.push(`Schild ist zu gross für den Laser (max. ${P2S.w - 10} × ${P2S.h - 10} mm).`);
  if (s.Holes !== "Keine" && s.HoleOffset < s.HoleDiameter / 2 + 0.5) w.push("Loch liegt zu nah an der Kante.");
  if (s.Holes !== "Keine" && s.HoleDiameter >= Math.min(s.Width, s.Height) - 1) w.push("Loch ist zu gross für das Schild.");
  if (s.CornerRadius > Math.min(s.Width, s.Height) / 2) w.push("Eckenradius ist grösser als das halbe Schild.");
  if (site?.farbenFest && site.farben?.length && !site.farben.includes(s.MaterialCode)) w.push("Diese Farbe ist für die Baustelle nicht vorgesehen.");
  return w;
}

// ───────── Zeichnen ─────────
// Schild als SVG in mm. dims = Bemassung zeichnen.
function signSvg(s, fields, dims, maxPx) {
  const m = mat(s.MaterialCode), w = s.Width, h = s.Height, r = Math.min(s.CornerRadius, Math.min(w, h) / 2);
  const L = layout(s, fields), holes = holesFor(s);
  const big = Math.max(w, h), fs = Math.min(Math.max(big * 0.045, 2.4), 9), pad = dims ? fs * 4.2 : big * 0.03;
  const vb = [-pad, -pad, w + 2 * pad, h + 2 * pad];
  const id = "c" + Math.random().toString(36).slice(2, 8);
  let g = "";
  g += `<defs><mask id="${id}"><rect x="-1" y="-1" width="${w + 2}" height="${h + 2}" fill="#000"/><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/>`;
  holes.forEach(o => g += `<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="#000"/>`);
  g += `</mask></defs>`;
  // Kante (Dicke angedeutet) + Oberfläche
  const edge = Math.min(Math.max(s.Thickness * 0.6, 0.4), 2);
  g += `<rect x="${edge * 0.5}" y="${edge}" width="${w}" height="${h}" rx="${r}" fill="${m.core}" opacity=".9"/>`;
  g += `<g mask="url(#${id})"><rect width="${w}" height="${h}" fill="${m.surface}"/>`;
  if (m.metal) g += `<rect width="${w}" height="${h}" fill="url(#${id}g)" opacity=".35"/>`;
  L.texts.forEach(t => g += `<text x="${t.x}" y="${t.y}" font-family="Arial, Helvetica, sans-serif" font-size="${t.size}" ${s.Bold ? 'font-weight="bold"' : ""} fill="${m.core}" textLength="${measure(t.text, s.Bold) * t.size}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${esc(t.text)}</text>`);
  L.lines.forEach(l => g += `<rect x="${l.x - 0.15}" y="${l.y0}" width="0.3" height="${l.y1 - l.y0}" fill="${m.core}"/>`);
  g += `</g>`;
  if (m.metal) g = g.replace(`</defs>`, `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#000" stop-opacity=".25"/><stop offset="1" stop-color="#fff"/></linearGradient></defs>`);
  g += `<rect width="${w}" height="${h}" rx="${r}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${big / 600}"/>`;
  holes.forEach(o => g += `<circle cx="${o.x}" cy="${o.y}" r="${o.r}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="${big / 600}"/>`);
  if (dims) g += dimensions(s, holes, fs);
  const style = maxPx ? `style="max-width:${maxPx}px"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(" ")}" ${style} role="img" aria-label="Schild ${fmt(w)} × ${fmt(h)} mm">${g}</svg>`;
}
function dimensions(s, holes, fs) {
  const w = s.Width, h = s.Height, sw = fs / 14, col = "var(--dim, #2E6FB8)", a = fs * 0.5;
  const arrow = (x, y, ang) => `<path d="M${x} ${y} l${a * Math.cos(ang + 0.35)} ${a * Math.sin(ang + 0.35)} M${x} ${y} l${a * Math.cos(ang - 0.35)} ${a * Math.sin(ang - 0.35)}" />`;
  const t = (x, y, txt, rot) => `<text x="${x}" y="${y}" font-size="${fs}" font-family="Segoe UI, Arial, sans-serif" fill="${col}" stroke="none" text-anchor="middle" ${rot ? `transform="rotate(-90 ${x} ${y})"` : ""}>${txt}</text>`;
  let d = `<g stroke="${col}" stroke-width="${sw}" fill="none">`;
  // Breite oben
  const yT = -fs * 1.9;
  d += `<line x1="0" y1="${-fs * 0.4}" x2="0" y2="${yT - fs * 0.4}"/><line x1="${w}" y1="${-fs * 0.4}" x2="${w}" y2="${yT - fs * 0.4}"/>`;
  d += `<line x1="0" y1="${yT}" x2="${w}" y2="${yT}"/>` + arrow(0, yT, 0) + arrow(w, yT, Math.PI);
  d += t(w / 2, yT - fs * 0.35, `${fmt(w)} mm`);
  // Höhe links
  const xL = -fs * 1.9;
  d += `<line x1="${-fs * 0.4}" y1="0" x2="${xL - fs * 0.4}" y2="0"/><line x1="${-fs * 0.4}" y1="${h}" x2="${xL - fs * 0.4}" y2="${h}"/>`;
  d += `<line x1="${xL}" y1="0" x2="${xL}" y2="${h}"/>` + arrow(xL, 0, Math.PI / 2) + arrow(xL, h, -Math.PI / 2);
  d += t(xL - fs * 0.35, h / 2, `${fmt(h)} mm`, true);
  // Löcher unten
  if (holes.length) {
    const o = holes[0], yB = h + fs * 1.9;
    d += `<line x1="0" y1="${h + fs * 0.4}" x2="0" y2="${yB + fs * 0.4}"/><line x1="${o.x}" y1="${o.y}" x2="${o.x}" y2="${yB + fs * 0.4}" stroke-dasharray="${fs * 0.3} ${fs * 0.2}"/>`;
    d += `<line x1="0" y1="${yB}" x2="${o.x}" y2="${yB}"/>`;
    d += t(Math.max(o.x / 2, fs * 1.2) + (o.x < fs * 2.4 ? fs * 1.6 : 0), yB + fs * 1.25, `${fmt(o.x)}`);
    d += t(w / 2 + (holes.length > 1 ? 0 : fs * 2), yB + fs * 1.25, `${holes.length} × Ø ${fmt(s.HoleDiameter)} mm`);
  }
  if (s.CornerRadius > 0) d += t(w - fs * 1.8, h + fs * 1.25 + (holes.length ? fs * 1.6 : 0), `R ${fmt(s.CornerRadius)}`);
  return d + "</g>";
}

// Schichtaufbau der gewählten Farbe: oben die Sichtseite (Farbwerte aus farben[].schichten, Namen aus typen[].schichten)
function layerStack(m) {
  const cols = m.schichten?.length ? m.schichten : [m.surface, m.core], names = m.fam.schichten || [];
  const parts = m.name.split("/").map(x => x.trim());
  return `<div class="layers">` + cols.map((c, i) =>
    `<div class="layer"><i style="background:${c === "transparent" ? "repeating-linear-gradient(45deg,#e8f1f4 0 4px,#cfdde2 4px 8px)" : c}"></i><span>${esc(names[i] || "Schicht " + (i + 1))}${parts[i] ? " · " + esc(parts[i]) : ""}</span></div>`).join("") + `</div>`;
}

// ───────── Preis ─────────
function rabatt(n) { let r = 0; for (const [ab, p] of PREISE.mengenrabatt) if (n >= ab) r = p; return r; }
// Gemeinsame Schnittkanten wie SignSettings.UsesSharedCuts: rechteckig (Radius 0) und Umriss geschnitten → Kante an Kante,
// ein Schnitt trennt zwei Schilder, Abstand 0. Runde Ecken: eingestellter Abstand (Standard 2 mm).
const sharedCuts = s => s.SharedCuts !== false && s.Contour === "Schneiden" && !(s.CornerRadius > 0.01);
const gapOf = s => sharedCuts(s) ? 0 : s.Gap;
// Schilder je Platte: Raster im Arbeitsfeld (wie Nesting.cs, ohne Reststreifen); Platte w × h in mm
function perSheet(s, sw, sh) {
  const big = Math.max(sw, sh), small = Math.min(sw, sh); // Platte so einlegen, dass sie ins Feld passt
  const W = Math.min(big, s.WorkWidth) - 2 * s.SheetMargin, H = Math.min(small, s.WorkHeight) - 2 * s.SheetMargin, g = gapOf(s);
  const fit = (w, h) => Math.max(0, Math.floor((W + g) / (w + g))) * Math.max(0, Math.floor((H + g) / (h + g)));
  return Math.max(fit(s.Width, s.Height), s.AllowRotate ? fit(s.Height, s.Width) : 0);
}
// Formate, die in den P2S passen, mit Preis laut Lieferant (katalog.json typen[].preise, zuschnitte)
// Preis wie Catalog.PriceFor: preise["305x610"][Dicke.toFixed(1)] × faktor[Format] × sonder[Code], auf 0.05; Zuschnitt = Basis × faktor[aus] ÷ teile
function sheetFormats(m, thickness) {
  const pr = m.fam.preise, base = pr?.["305x610"]?.[Number(thickness).toFixed(1)];
  if (base == null) return [];
  const sonder = pr.sonder?.[m.code] ?? 1, r05 = v => Math.round(v * 20) / 20, out = [];
  for (const f of m.fam.formate || ["305x610"]) {
    const [w, h] = f.split("x").map(Number);
    if (Math.min(w, h) <= P2S.h + 2 && Math.max(w, h) <= 612) out.push({ id: f, name: `${w} × ${h} mm`, w, h, price: r05(base * (pr.faktor?.[f] ?? 1) * sonder) });
  }
  for (const z of K.zuschnitte || []) {
    if (!(m.fam.formate || []).includes(z.aus)) continue;
    if (Math.min(z.w, z.h) <= P2S.h + 2 && Math.max(z.w, z.h) <= 612)
      out.push({ id: `${z.w}x${z.h}`, name: `${z.name} ${z.w} × ${z.h} mm`, w: z.w, h: z.h, price: r05(base * (pr.faktor?.[z.aus] ?? 1) * sonder / z.teile), aus: z.aus, teile: z.teile });
  }
  return out;
}
// Richtpreis eines Schildtyps; unit = null → Preis auf Anfrage
function posPrice(pos) {
  const s = Object.assign(defaultSettings(), pos.s), n = posCount(pos), m = mat(s.MaterialCode);
  if (!n) return { n, unit: 0, total: 0 };
  const rab = rabatt(n), siteR = site?.rabatt ?? (site?.preisFaktor ? 1 - site.preisFaktor : 0);
  const fixed = site?.preisProSchild ?? PREISE.preisProSchild;
  const opts = sheetFormats(m, s.Thickness).map(f => ({ ...f, per: perSheet(s, f.w, f.h) })).filter(f => f.per > 0);
  const want = PREISE.format && PREISE.format !== "auto" ? opts.filter(f => f.id === PREISE.format) : opts;
  // Zuschnitt beim Lieferanten (Sechstel/Achtel) kostet je Position extra (zuschnittService.mindestbetrag) – zählt auch im Vergleich „auto“
  const cutFee = f => f.teile ? (PREISE.zuschnittProPosition ?? 0) : 0;
  const cost = f => n / f.per * f.price + cutFee(f);
  const f = want.sort((a, b) => cost(a) - cost(b))[0];
  let calc = null;
  if (f) {
    // Reserve wie Order.cs: belegte Platten + gerundete Reserve, immer ganze Platten (5 → 6, 4 → 4, 15 → 17)
    const used = Math.ceil(n / f.per), sheets = used + Math.round(used * PREISE.reserve);
    const material = (PREISE.abrechnung === "platten" ? sheets * f.price : n / f.per * (1 + PREISE.reserve) * f.price) + cutFee(f);
    calc = { format: f.id, formatName: f.name, zuschnitt: cutFee(f), perSheet: f.per, sheets, sheetPrice: f.price, material: Math.round(material * 100) / 100 };
  }
  let unit;
  if (fixed != null) unit = fixed * Math.max(1, s.Width * s.Height / 100 / (PREISE.referenzFlaeche || 30)); // Firmenpreis je Schild, grosse Schilder nach Fläche
  else if (calc) unit = calc.material / n * PREISE.aufschlag + PREISE.bearbeitung;
  else return { n, unit: null, total: null };
  unit = Math.round(unit * (1 - rab) * (1 - siteR) * 20) / 20;
  return { n, unit, total: unit * n, rabatt: rab, modell: fixed != null ? "firmenpreis" : "material", ...(calc || {}) };
}
const posCount = pos => pos.signs.reduce((a, x) => a + (x.count > 0 ? x.count : 0), 0);
function orderPrice() {
  const items = state.positions.map(posPrice);
  const sum = items.reduce((a, x) => a + (x.total || 0), 0), open = items.some(x => x.unit == null);
  return { items, open, net: sum + (sum > 0 ? PREISE.grundProAuftrag : 0) };
}

// ───────── Oberfläche ─────────
const PRESETS = [[100, 30], [80, 20], [60, 15], [120, 40], [150, 50], [200, 60]];
function posTitle(pos, i) { const s = pos.s; return `${i + 1}. ${pos.name || `${fmt(s.Width)} × ${fmt(s.Height)}`} · ${s.MaterialCode}`; }

function renderPositions() {
  const el = $("positions");
  el.innerHTML = state.positions.map((p, i) =>
    `<div class="pos ${i === cur ? "on" : ""}" data-i="${i}"><i style="background:${mat(p.s.MaterialCode).surface}"></i>${esc(posTitle(p, i))} <span class="hint" style="margin:0">${posCount(p)} Stk.</span></div>`).join("")
    + `<button id="addPos">+ Schildtyp</button>`;
  el.querySelectorAll(".pos").forEach(d => d.onclick = () => { cur = +d.dataset.i; curSign = 0; renderAll(); });
  $("addPos").onclick = () => { state.positions.push(newPosition()); cur = state.positions.length - 1; curSign = 0; save(); renderAll(); };
}

function renderForm() {
  const p = P(), s = p.s;
  $("posLabel").textContent = cur + 1;
  $("pName").value = p.name;
  $("pW").value = s.Width; $("pH").value = s.Height;
  $("pShape").value = p.shape; $("pR").value = s.CornerRadius; $("radiusRow").classList.toggle("hidden", p.shape !== "round");
  $("pHoles").value = s.Holes; $("pHD").value = s.HoleDiameter; $("pHO").value = s.HoleOffset; $("holeRow").classList.toggle("hidden", s.Holes === "Keine");
  $("pRows").value = s.Rows; $("pCols").value = s.Columns; $("pTH").value = s.TextHeight; $("pAlign").value = s.Align;
  $("pBold").checked = s.Bold; $("pLines").checked = s.ColumnLines;
  $("sizePresets").innerHTML = PRESETS.map(([w, h]) => `<button data-w="${w}" data-h="${h}" class="${s.Width === w && s.Height === h ? "on" : ""}">${w} × ${h}</button>`).join("");
  $("sizePresets").querySelectorAll("button").forEach(b => b.onclick = () => { s.Width = +b.dataset.w; s.Height = +b.dataset.h; changed(true); });
  // Farben
  const allowed = site?.farbenFest && site.farben?.length ? site.farben : null;
  const cm = mat(s.MaterialCode), fam = cm.fam;
  $("families").innerHTML = FAMS.filter(f => !allowed || f.farben.some(m => allowed.includes(m.code))).map(f =>
    `<button class="fam ${f === fam ? "on" : ""}" data-f="${f.id}"><b>${esc(f.name)}</b><span>${esc(f.kurz || "")}</span>${f.empfohlen ? '<span class="tag">empfohlen</span>' : ""}</button>`).join("");
  $("families").querySelectorAll(".fam").forEach(b => b.onclick = () => {
    const f = FAMS.find(x => x.id === b.dataset.f); if (f === fam) return;
    const pick = f.farben.find(m => (!allowed || allowed.includes(m.code)) && (f.haupt || []).includes(m.code)) || f.farben.find(m => !allowed || allowed.includes(m.code));
    s.MaterialCode = pick.code; s.Thickness = firstThickness(mat(pick.code), s.Thickness); showAllColors = false; changed(true);
  });
  const many = !allowed && fam.haupt && fam.farben.length > fam.haupt.length;
  const shown = ALL.filter(m => m.fam === fam && (!allowed || allowed.includes(m.code)) && (!many || showAllColors || fam.haupt.includes(m.code) || m.code === s.MaterialCode));
  $("moreColors").classList.toggle("hidden", !many);
  $("moreColors").textContent = showAllColors ? "Nur Hauptfarben" : `Alle ${fam.farben.length} Farben zeigen`;
  $("moreColors").onclick = () => { showAllColors = !showAllColors; renderForm(); };
  $("swatches").innerHTML = shown.map(m => {
    const st = stockFor(m, s.Thickness);
    return `<button class="sw ${m.code === s.MaterialCode ? "on" : ""} ${st === "-" ? "na" : st === "B" ? "b" : ""}" data-c="${m.code}" title="${m.code} ${esc(m.name)} – ${stockText(st)}">
      <svg viewBox="0 0 40 40"><rect width="40" height="40" fill="${m.surface}"/><path d="M40 0 L40 40 L0 40 Z" fill="${m.core}"/><text x="4" y="14" font-size="10" font-family="Arial" fill="${m.core}">${m.code}</text></svg></button>`;
  }).join("");
  $("swatches").querySelectorAll(".sw").forEach(b => b.onclick = () => {
    s.MaterialCode = b.dataset.c;
    const m = mat(s.MaterialCode);
    s.Thickness = firstThickness(m, s.Thickness);
    changed(true);
  });
  const m = mat(s.MaterialCode), st = stockFor(m, s.Thickness);
  $("matInfo").innerHTML = `<b>${m.code}</b> ${esc(m.name)}${m.metal && m.fam.id === "LASERPLY" ? " · Metalleffekt" : ""} · <span class="stock-${st}">${stockText(st)}</span>`
    + `<br>${m.fam.laserCut ? "Gelasert und geschnitten bei Caelum" : "Graviert bei Caelum, Zuschnitt beim Lieferanten, Löcher gebohrt"} · Rohmaterial: <a href="${m.fam.url}" target="_blank" rel="noopener">${esc(m.fam.supplier)}</a>`
    + (m.fam.note ? `<br><span class="hint">${esc(m.fam.note)}</span>` : "")
    + layerStack(m)
    + (m.fam.beschreibung ? `<details class="hint"><summary>Über ${esc(m.fam.name)}</summary>${esc(m.fam.beschreibung)}</details>` : "");
  // Dicken
  $("thick").innerHTML = m.fam.dicken.map(t => { const st = stockFor(m, t); return `<button data-t="${t}" class="${Math.abs(t - s.Thickness) < 0.01 ? "on" : ""} ${st === "-" ? "na" : ""}" ${st === "-" ? "disabled" : ""} title="${stockText(st)}">${fmt(t)} mm</button>`; }).join("");
  $("thick").querySelectorAll("button").forEach(b => b.onclick = () => { s.Thickness = +b.dataset.t; changed(true); });
  $("delPos").disabled = state.positions.length < 2;
}

function renderTable() {
  const p = P(), s = p.s, n = fieldCount(s);
  if (curSign >= p.signs.length) curSign = Math.max(0, p.signs.length - 1);
  let head = `<tr><th>Nr.</th><th>Anzahl</th><th>Montageort</th>`;
  for (let r = 0; r < Math.max(1, s.Rows); r++) for (let c = 0; c < Math.max(1, s.Columns); c++)
    head += `<th>${s.Columns > 1 ? `Zeile ${r + 1} · Sp. ${c + 1}` : `Zeile ${r + 1}`}</th>`;
  head += `<th>Plan</th><th></th></tr>`;
  const body = p.signs.map((x, i) => {
    let tds = `<td class="nr" data-i="${i}">${cur + 1}.${String(i + 1).padStart(2, "0")}</td>`
      + `<td><input class="n" type="number" min="0" step="1" value="${x.count}" data-i="${i}" data-k="count"></td>`
      + `<td><input class="ort" value="${esc(x.ort)}" data-i="${i}" data-k="ort" placeholder="z. B. UG Technik, SS-01"></td>`;
    for (let f = 0; f < n; f++) tds += `<td><input value="${esc(x.fields[f] || "")}" data-i="${i}" data-f="${f}"></td>`;
    const pl = x.pin && plans().find(q => q.id === x.pin.plan);
    tds += `<td title="${pl ? "Im Plan: " + esc(pl.name) : "noch nicht im Plan"}" style="text-align:center">${pl ? "📍" : ""}</td>`;
    return `<tr class="${i === curSign ? "on" : ""}">${tds}<td><button class="link" data-del="${i}" title="Zeile löschen">✕</button></td></tr>`;
  }).join("");
  $("signTable").innerHTML = head + body;
  $("signTable").querySelectorAll("input").forEach(inp => {
    inp.onfocus = () => { if (curSign !== +inp.dataset.i) { curSign = +inp.dataset.i; markRow(); renderPreview(); } };
    inp.oninput = () => {
      const x = p.signs[+inp.dataset.i];
      if (inp.dataset.k === "count") x.count = Math.max(0, parseInt(inp.value || "0", 10) || 0);
      else if (inp.dataset.k === "ort") x.ort = inp.value;
      else x.fields[+inp.dataset.f] = inp.value;
      save(); renderPreview(); renderTotals(); renderPositions();
    };
    inp.onpaste = e => {
      const t = e.clipboardData?.getData("text") || "";
      if (!t.includes("\t") && !t.includes("\n")) return;
      e.preventDefault(); importRows(t, false, +inp.dataset.i);
    };
  });
  $("signTable").querySelectorAll("td.nr").forEach(td => td.onclick = () => { curSign = +td.dataset.i; markRow(); renderPreview(); });
  $("signTable").querySelectorAll("[data-del]").forEach(b => b.onclick = () => { p.signs.splice(+b.dataset.del, 1); if (!p.signs.length) p.signs.push({ count: 1, ort: "", fields: [] }); save(); renderAll(); });
}
function markRow() { $("signTable").querySelectorAll("tr").forEach((tr, i) => tr.classList.toggle("on", i - 1 === curSign)); }

function renderPreview() {
  const p = P(), x = p.signs[curSign] || { fields: [] };
  $("preview").innerHTML = signSvg(p.s, x.fields, true);
  $("pvWhich").textContent = `Schild ${cur + 1}.${String(curSign + 1).padStart(2, "0")}${x.ort ? " · " + x.ort : ""}`;
  const w = check(p.s), notes = [...new Set(layout(p.s, x.fields).notes)];
  $("warnList").innerHTML = w.map(t => `<li>${esc(t)}</li>`).join("");
  $("noteList").innerHTML = notes.map(t => `<li>${esc(t)}</li>`).join("");
}
function renderTotals() {
  const p = P(), pp = posPrice(p), s = p.s;
  $("posTotals").innerHTML = `<span><b>${pp.n}</b> Schilder</span><span>${fmt(s.Width)} × ${fmt(s.Height)} × ${fmt(s.Thickness)} mm</span>`
    + `<span>Richtpreis <b>${pchf(pp.unit)}</b>${pp.unit == null ? "" : " / Stk."}${pp.rabatt ? ` (−${Math.round(pp.rabatt * 100)} % Menge)` : ""}</span>`
    + (pp.sheets ? `<span class="hint" style="margin:0">${pp.perSheet} je Platte · ${pp.sheets} Platte(n) ${esc(pp.formatName)}</span>` : "")
    + (pp.unit == null ? `<span class="hint" style="margin:0">Für ${esc(mat(s.MaterialCode).fam.name)} ist kein Plattenpreis hinterlegt – Offerte folgt.</span>` : "");
  const op = orderPrice(), n = op.items.reduce((a, x) => a + x.n, 0);
  $("orderTotals").innerHTML = `<span><b>${state.positions.length}</b> Schildtyp(en), <b>${n}</b> Schilder</span>`
    + `<span>Einrichtung ${chf(n ? PREISE.grundProAuftrag : 0)}</span>`
    + `<span class="price">Richtpreis ${chf(op.net)}${op.open ? " + Positionen auf Anfrage" : ""}</span><span>exkl. MWST · unverbindlich</span>`
    + (PREISE.platzhalter ? ` <span class="badge">Preise noch nicht freigegeben</span>` : "");
}
function renderAll() { renderPositions(); renderForm(); renderTable(); renderPreview(); renderTotals(); renderPlans(); }

// ───────── Pläne: Schilder auf Grundriss/Schema setzen ─────────
let curPlan = 0;
const plans = () => (state.plans ||= []);
const signNr = (pi, si) => `${pi + 1}.${pad2(si + 1)}`;
function allPins(planId) {
  const r = [];
  state.positions.forEach((p, pi) => p.signs.forEach((x, si) => { if (x.pin?.plan === planId) r.push({ pi, si, x, nr: signNr(pi, si) }); }));
  return r;
}
// Plan mit Nummern als SVG (für Portal und Montageverzeichnis)
function planSvg(pl, pins, activeNr, linkCards) {
  const R = Math.max(pl.w, pl.h) / 60, fs = R * 1.3;
  let g = `<image href="${pl.img}" width="${pl.w}" height="${pl.h}"/>`;
  for (const p of pins) {
    const x = p.x.pin.x * pl.w, y = p.x.pin.y * pl.h, on = p.nr === activeNr, col = mat(state.positions[p.pi].s.MaterialCode);
    const inner = `<circle cx="${x}" cy="${y}" r="${R}" fill="${on ? "#C7603F" : "#1F4E8C"}" stroke="#fff" stroke-width="${R / 5}"/>`
      + `<rect x="${x + R * 1.1}" y="${y - fs * 0.75}" width="${fs * 0.5 * p.nr.length + fs * 0.6}" height="${fs * 1.5}" rx="${fs * 0.3}" fill="${col.surface}" stroke="${col.core}" stroke-width="${R / 8}"/>`
      + `<text x="${x + R * 1.1 + fs * 0.3}" y="${y + fs * 0.4}" font-size="${fs}" font-family="Arial" font-weight="bold" fill="${col.core}">${p.nr}</text>`;
    g += linkCards ? `<a href="#s${p.nr}">${inner}</a>` : `<g data-pin="${p.pi}:${p.si}" style="cursor:pointer">${inner}</g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pl.w} ${pl.h}" style="width:100%;height:auto;display:block">${g}</svg>`;
}
function renderPlans() {
  const ps = plans();
  if (curPlan >= ps.length) curPlan = Math.max(0, ps.length - 1);
  $("planTabs").innerHTML = ps.map((pl, i) => `<div class="pos ${i === curPlan ? "on" : ""}" data-i="${i}">${esc(pl.name || "Plan " + (i + 1))} <span class="hint" style="margin:0">${allPins(pl.id).length} Punkte</span></div>`).join("")
    + `<button id="planAdd">+ Plan laden …</button>`;
  $("planTabs").querySelectorAll(".pos").forEach(d => d.onclick = () => { curPlan = +d.dataset.i; renderPlans(); });
  $("planAdd").onclick = () => $("planFile").click();
  $("planBody").classList.toggle("hidden", !ps.length);
  if (!ps.length) return;
  const pl = ps[curPlan], x = P().signs[curSign], nr = signNr(cur, curSign);
  $("planName").value = pl.name || "";
  $("planHint").innerHTML = `Tippen setzt <b>Schild ${nr}</b>${x?.fields?.filter(Boolean).length ? " (" + esc(x.fields.filter(Boolean).join(" · ")) + ")" : ""}${x?.pin ? ` · liegt auf „${esc(ps.find(q => q.id === x.pin.plan)?.name || "Plan")}“` : " · noch ohne Punkt"}. Punkt antippen wählt das Schild.`;
  $("planView").innerHTML = planSvg(pl, allPins(pl.id), nr, false);
  $("pinDel").disabled = !x?.pin;
}
$("planView").addEventListener("click", e => {
  const pin = e.target.closest("[data-pin]");
  if (pin) { const [pi, si] = pin.dataset.pin.split(":").map(Number); cur = pi; curSign = si; renderAll(); return; }
  const svg = $("planView").querySelector("svg"); if (!svg) return;
  const b = svg.getBoundingClientRect(), pl = plans()[curPlan], x = P().signs[curSign]; if (!x) return;
  x.pin = { plan: pl.id, x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  if (!x.ort) x.ort = pl.name || "";
  save(); renderTable(); renderPlans();
});
$("pinDel").onclick = () => { const x = P().signs[curSign]; if (x) delete x.pin; save(); renderTable(); renderPlans(); };
$("planName").oninput = () => { plans()[curPlan].name = $("planName").value; save(); renderPlans(); $("planName").focus(); };
$("planDel").onclick = () => {
  const pl = plans()[curPlan]; if (!pl || !confirm(`Plan „${pl.name || "Plan"}“ und seine Punkte entfernen?`)) return;
  state.positions.forEach(p => p.signs.forEach(x => { if (x.pin?.plan === pl.id) delete x.pin; }));
  plans().splice(curPlan, 1); save(); renderAll();
};
$("planFile").onchange = async () => {
  const f = $("planFile").files[0]; $("planFile").value = ""; if (!f) return;
  const img = new Image(); img.src = URL.createObjectURL(f);
  try { await img.decode(); } catch { alert("Bild konnte nicht gelesen werden. Bitte PNG oder JPG verwenden (PDF: Seite als Bild speichern)."); return; }
  const k = Math.min(1, 2200 / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
  const cx = c.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  plans().push({ id: "p" + Date.now().toString(36), name: f.name.replace(/\.[^.]+$/, ""), w: c.width, h: c.height, img: c.toDataURL("image/jpeg", 0.82) });
  curPlan = plans().length - 1; save(); renderPlans();
};

let tmr = 0;
function changed(full) {
  const p = P(), s = p.s;
  const n = fieldCount(s);
  p.signs.forEach(x => { if (x.fields.length > n) x.fields.length = Math.max(n, x.fields.filter(Boolean).length ? n : 0); });
  save();
  if (full) renderAll(); else { renderPreview(); renderTotals(); clearTimeout(tmr); tmr = setTimeout(() => { renderPositions(); renderTable(); }, 400); }
}
function bindNum(id, key, isInt) {
  $(id).addEventListener("input", () => {
    const v = isInt ? parseInt($(id).value, 10) : parseFloat(String($(id).value).replace(",", "."));
    if (!isFinite(v)) return;
    P().s[key] = v; changed(false);
  });
  $(id).addEventListener("change", () => changed(true));
}
bindNum("pW", "Width"); bindNum("pH", "Height"); bindNum("pR", "CornerRadius"); bindNum("pHD", "HoleDiameter"); bindNum("pHO", "HoleOffset");
bindNum("pRows", "Rows", true); bindNum("pCols", "Columns", true); bindNum("pTH", "TextHeight");
$("pName").oninput = () => { P().name = $("pName").value; save(); renderPositions(); };
$("pShape").onchange = () => { const p = P(); p.shape = $("pShape").value; p.s.CornerRadius = p.shape === "round" ? (p.s.CornerRadius || 3) : 0; changed(true); };
$("pHoles").onchange = () => { P().s.Holes = $("pHoles").value; changed(true); };
$("pAlign").onchange = () => { P().s.Align = $("pAlign").value; changed(false); };
$("pBold").onchange = () => { P().s.Bold = $("pBold").checked; changed(false); };
$("pLines").onchange = () => { P().s.ColumnLines = $("pLines").checked; changed(false); };
$("delPos").onclick = () => { if (state.positions.length < 2 || !confirm("Diesen Schildtyp mit allen Schildern entfernen?")) return; state.positions.splice(cur, 1); cur = Math.max(0, cur - 1); save(); renderAll(); };
$("addSign").onclick = () => { const p = P(); p.signs.push({ count: 1, ort: p.signs.at(-1)?.ort || "", fields: [] }); curSign = p.signs.length - 1; save(); renderAll(); $("signTable").querySelector(`tr:nth-child(${curSign + 2}) input[data-f="0"]`)?.focus(); };

// Einfügen aus Excel: Anzahl, Montageort, Textfelder
function parseTsv(t) { return t.replace(/\r/g, "").split("\n").filter(l => l.trim()).map(l => l.split("\t")); }
function importRows(text, replace, at) {
  const p = P(), n = fieldCount(p.s);
  let rows = parseTsv(text);
  if (rows.length && isNaN(parseInt(rows[0][0], 10)) && /anzahl|menge|stk/i.test(rows[0][0])) rows = rows.slice(1);
  const ns = rows.map(r => r.length >= 2 && /^\d+$/.test(r[0].trim())
    ? { count: parseInt(r[0], 10), ort: (r[1] || "").trim(), fields: r.slice(2, 2 + n).map(v => v.trim()) }
    : { count: 1, ort: "", fields: r.slice(0, n).map(v => v.trim()) });
  if (replace) p.signs = ns;
  else if (at != null) p.signs.splice(at, 1, ...ns);
  else p.signs.push(...ns);
  if (!p.signs.length) p.signs.push({ count: 1, ort: "", fields: [] });
  save(); renderAll();
}
$("pasteBtn").onclick = () => { $("pasteBox").value = ""; $("pasteDlg").showModal(); };
$("pasteOk").onclick = () => { importRows($("pasteBox").value, false); $("pasteDlg").close(); };
$("pasteReplace").onclick = () => { importRows($("pasteBox").value, true); $("pasteDlg").close(); };
$("pasteCancel").onclick = () => $("pasteDlg").close();

// Kontakt
const CF = { cName: "name", cFirm: "firma", cMail: "email", cTel: "telefon", cAddr: "lieferung", cDate: "termin", cNote: "bemerkung" };
function fillContact() { for (const [id, k] of Object.entries(CF)) $(id).value = state.contact?.[k] || ""; }
for (const [id, k] of Object.entries(CF)) $(id).addEventListener("input", () => { state.contact[k] = $(id).value; save(); });

// ───────── Auftrag erzeugen ─────────
const pad2 = n => String(n).padStart(2, "0");
function stamp(d = new Date()) { return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`; }
const safe = t => String(t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
function posFolder(p, i) { return `Pos${pad2(i + 1)}_${safe(p.name) || `${p.s.Width}x${p.s.Height}`}_${p.s.MaterialCode}`; }

function csvCell(v) { v = String(v ?? ""); return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
function positionCsv(p, i) {
  const s = p.s, rows = Math.max(1, s.Rows), cols = Math.max(1, s.Columns), n = rows * cols;
  // „Bemerkung“ ignoriert CaelumGravur beim Gravieren (TableIO.IgnoreNames): Schild-Nr und Montageort für Kenny
  const head = ["Anzahl", "Material", "Bemerkung"];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) head.push(cols === 1 ? `Zeile ${r + 1}` : `Zeile ${r + 1} Spalte ${c + 1}`);
  const lines = [head.map(csvCell).join(";")];
  p.signs.forEach((x, k) => {
    if (!(x.count > 0)) return;
    const f = []; for (let j = 0; j < n; j++) f.push(x.fields[j] || "");
    lines.push([x.count, s.MaterialCode, `${i + 1}.${pad2(k + 1)}${x.ort ? " · " + x.ort : ""}`, ...f].map(csvCell).join(";"));
  });
  return "﻿" + lines.join("\r\n") + "\r\n";
}
function settingsJson(p) {
  const s = Object.assign(defaultSettings(), p.s);
  if (p.shape !== "round") s.CornerRadius = 0;
  s.MaterialType = mat(s.MaterialCode).fam.id; // Kunststofftyp für Catalog.Use in CaelumGravur
  // Familie ohne Laserschnitt (ABS, Alu): Umriss nicht schneiden, Löcher nur ritzen (Bohrmarke)
  if (!mat(s.MaterialCode).fam.laserCut) { s.Contour = "Aus"; s.CutHoles = false; }
  return JSON.stringify(s, null, 2);
}

function validateOrder() {
  const errs = [];
  if (!state.contact.name?.trim()) errs.push("Name fehlt.");
  if (!/^\S+@\S+\.\S+$/.test(state.contact.email || "")) errs.push("E-Mail fehlt oder ist ungültig.");
  state.positions.forEach((p, i) => {
    check(p.s).forEach(w => errs.push(`Schildtyp ${i + 1}: ${w}`));
    if (!posCount(p)) errs.push(`Schildtyp ${i + 1}: keine Schilder.`);
  });
  return errs;
}

function orderJson(created) {
  const op = orderPrice();
  return {
    format: "caelum-gravur-auftrag", version: 1, portal: PORTAL_VERSION, erstellt: created.toISOString(),
    baustelle: { name: site.baustelle, kunde: site.kunde || "", projekt: site.projekt || "" },
    kontakt: state.contact,
    positionen: state.positions.map((p, i) => ({
      nr: i + 1, name: p.name || "", ordner: posFolder(p, i), liste: "schilder.csv", einstellungen: "einstellungen.json",
      schilder: p.signs.filter(x => x.count > 0).length, stueck: posCount(p),
      mass: `${p.s.Width} × ${p.s.Height} × ${p.s.Thickness} mm`, material: p.s.MaterialCode,
      familie: mat(p.s.MaterialCode).fam.id, lieferant: mat(p.s.MaterialCode).fam.supplier, bezugsquelle: mat(p.s.MaterialCode).fam.url,
      laserschnitt: mat(p.s.MaterialCode).fam.laserCut,
      richtpreisStueck: op.items[i].unit, richtpreis: op.items[i].total == null ? null : Math.round(op.items[i].total * 100) / 100,
      kalkulation: op.items[i].sheets || op.items[i].modell ? { modell: op.items[i].modell, format: op.items[i].format, jePlatte: op.items[i].perSheet, platten: op.items[i].sheets, plattenpreis: op.items[i].sheetPrice, materialkosten: op.items[i].material, mengenrabatt: op.items[i].rabatt, aufschlag: PREISE.aufschlag, bearbeitung: PREISE.bearbeitung } : null,
    })),
    plaene: plans().map((pl, i) => ({ id: pl.id, name: pl.name || "", datei: `Plaene/${pad2(i + 1)}_${safe(pl.name) || "Plan"}.jpg`, breite: pl.w, hoehe: pl.h })),
    punkte: plans().flatMap(pl => allPins(pl.id).map(p => ({ schild: p.nr, plan: pl.id, x: +p.x.pin.x.toFixed(4), y: +p.x.pin.y.toFixed(4), montageort: p.x.ort || "", text: p.x.fields.filter(Boolean).join(" · ") }))),
    richtpreis: { netto: Math.round(op.net * 100) / 100, einrichtung: PREISE.grundProAuftrag, waehrung: PREISE.waehrung, platzhalter: !!PREISE.platzhalter, hinweis: "unverbindlich, exkl. MWST" },
  };
}
function orderText(o) {
  const L = [`Caelum Gravur · Auftrag aus dem Kundenportal · ${new Date(o.erstellt).toLocaleString("de-CH")}`, "─".repeat(64),
    `Baustelle:  ${o.baustelle.name}`, `Kunde:      ${o.baustelle.kunde}${o.baustelle.projekt ? " · Projekt " + o.baustelle.projekt : ""}`,
    `Besteller:  ${o.kontakt.name || ""}${o.kontakt.firma ? ", " + o.kontakt.firma : ""}`, `E-Mail:     ${o.kontakt.email || ""}   Tel. ${o.kontakt.telefon || "–"}`,
    `Lieferung:  ${o.kontakt.lieferung || "–"}   Wunschtermin ${o.kontakt.termin || "–"}`];
  if (o.kontakt.bemerkung) L.push(`Bemerkung:  ${o.kontakt.bemerkung}`);
  L.push("", "Schildtypen:");
  o.positionen.forEach(p => L.push(`  ${p.nr}. ${p.name || "(ohne Bezeichnung)"} – ${p.mass}, ${mat(p.material).fam.name} ${p.material} ${mat(p.material).name}: ${p.stueck} Stk. à ${pchf(p.richtpreisStueck)} = ${pchf(p.richtpreis)}  → ${p.ordner}`,
    `     Rohmaterial: ${p.lieferant} ${p.bezugsquelle}${p.laserschnitt ? "" : " · Zuschnitt beim Lieferanten, Löcher bohren"}`));
  L.push("", `Richtpreis: ${chf(o.richtpreis.netto)} (inkl. Einrichtung ${chf(o.richtpreis.einrichtung)}), ${o.richtpreis.hinweis}${o.richtpreis.platzhalter ? " – PLATZHALTER-PREISE" : ""}`);
  L.push("", "In Caelum Gravur: Datei laden (ZIP ins Fenster ziehen) oder", "  CaelumGravur.exe auftrag <diese.zip>");
  return "﻿" + L.join("\r\n") + "\r\n";
}

// Montageverzeichnis: alle Schilder nach Montageort, in echten Farben, zum Zuordnen und Abhaken
function directoryHtml(o) {
  const items = [];
  state.positions.forEach((p, i) => p.signs.forEach((x, k) => { if (x.count > 0) items.push({ p, i, x, nr: `${i + 1}.${pad2(k + 1)}` }); }));
  const groups = new Map();
  items.forEach(it => { const g = (it.x.ort || "").trim() || "ohne Montageort"; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(it); });
  const keys = [...groups.keys()].sort((a, b) => (a === "ohne Montageort") - (b === "ohne Montageort") || a.localeCompare(b, "de", { numeric: true }));
  const total = items.reduce((a, it) => a + it.x.count, 0);
  let h = `<!doctype html><html lang="de-CH"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Montageverzeichnis · ${esc(o.baustelle.name)}</title><style>
body{font:14px/1.4 "Segoe UI",Arial,sans-serif;color:#222;margin:0;background:#fff}
.wrap{max-width:1000px;margin:0 auto;padding:20px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:22px 0 8px;padding-bottom:4px;border-bottom:2px solid #222;break-after:avoid}
.meta{color:#555;font-size:13px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.c{border:1px solid #ddd;border-radius:8px;padding:10px;break-inside:avoid;display:flex;flex-direction:column;gap:6px}
.c .n{font-weight:700;font-size:15px;display:flex;justify-content:space-between;align-items:center}
.c .n label{font-weight:400;font-size:13px;color:#444;display:flex;gap:4px;align-items:center}
.c .pv{background:#ECEAE4;border-radius:6px;padding:4px}.c svg{width:100%;height:auto;display:block}
.c .d{font-size:12.5px;color:#555}.c .t{font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:8px}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}
.hint{color:#666;font-size:12.5px}@media print{.noprint{display:none}.wrap{padding:0}}
</style></head><body><div class="wrap">
<h1>Montageverzeichnis</h1>
<div class="meta"><b>${esc(o.baustelle.name)}</b>${o.baustelle.projekt ? " · Projekt " + esc(o.baustelle.projekt) : ""}<br>
Besteller: ${esc(o.kontakt.name || "")}${o.kontakt.firma ? ", " + esc(o.kontakt.firma) : ""} · erstellt ${new Date(o.erstellt).toLocaleDateString("de-CH")} · ${total} Schilder in ${keys.length} Montageort(en)</div>
<p class="hint">Jedes Schild trägt im Verzeichnis eine Nummer (Schildtyp.Zeile). Die Schilder werden je Montageort gebündelt geliefert. Nach dem Montieren abhaken. Abbildungen in echten Farben, Masse in mm; drucken = PDF.</p>
<p class="noprint"><b>Drucken / PDF:</b> Strg + P (Mac: ⌘ + P), auf dem Handy über „Teilen → Drucken“.</p>
<table><tr><th>Typ</th><th>Bezeichnung</th><th>Mass</th><th>Material</th><th>Löcher</th><th>Stück</th></tr>
${state.positions.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name || "")}</td><td>${fmt(p.s.Width)} × ${fmt(p.s.Height)} × ${fmt(p.s.Thickness)}</td><td>${p.s.MaterialCode} ${esc(mat(p.s.MaterialCode).name)}</td><td>${p.s.Holes === "Keine" ? "keine" : holesFor(p.s).length + " × Ø " + fmt(p.s.HoleDiameter)}</td><td>${posCount(p)}</td></tr>`).join("")}
</table>`;
  for (const pl of plans()) {
    const pins = allPins(pl.id);
    if (!pins.length) continue;
    h += `<h2>Plan: ${esc(pl.name || "Plan")} <span class="hint">· ${pins.length} Schild-Positionen · Nummer anklicken zeigt das Schild</span></h2><div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;break-inside:avoid">${planSvg(pl, pins, null, true)}</div>`;
  }
  for (const g of keys) {
    const its = groups.get(g);
    h += `<h2>${esc(g)} <span class="hint">· ${its.reduce((a, it) => a + it.x.count, 0)} Schilder</span></h2><div class="grid">`;
    for (const it of its) {
      const s = it.p.s;
      const pl = it.x.pin && plans().find(q => q.id === it.x.pin.plan);
      h += `<div class="c" id="s${it.nr}"><div class="n"><span>${it.nr}${pl ? ` <span class="hint">📍 ${esc(pl.name || "Plan")}</span>` : ""}</span><label><input type="checkbox"> montiert</label></div>
<div class="pv">${signSvg(s, it.x.fields, false)}</div>
<div class="t">${esc(it.x.fields.filter(Boolean).join(" · "))}</div>
<div class="d">${it.x.count} Stk. · ${fmt(s.Width)} × ${fmt(s.Height)} mm · ${s.MaterialCode}${s.Holes === "Keine" ? " · kleben" : " · " + holesFor(s).length + " × Ø " + fmt(s.HoleDiameter) + " mm"}</div></div>`;
    }
    h += `</div>`;
  }
  h += `<p class="hint" style="margin-top:24px">© 2026 Caelum GmbH · www.caelum.one · erstellt mit dem Caelum Kundenportal ${PORTAL_VERSION}</p></div></body></html>`;
  return h;
}

// ───────── Auftragsbestätigung als PDF (Wunsch Kenny 21.11.2026) ─────────
// Kleiner PDF-Schreiber ohne Fremdbibliothek: A4, Helvetica (WinAnsi), Text, Linien, Flächen. Der Kunde speichert damit
// nach dem Senden, was er bestellt hat (Eingangsnummer, Positionen, Schilderliste mit Montageort, Richtpreis).
const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,
  667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,
  556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const W1252 = { "€": 128, "‚": 130, "„": 132, "…": 133, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151, "™": 153 };
function pdfText(s) { // in WinAnsi-Zeichen (je Zeichen ein Byte), Unbekanntes ersetzen
  return [...String(s ?? "").replace(/→/g, "->").replace(/[   ]/g, " ")].map(c => {
    const n = c.charCodeAt(0);
    if (W1252[c]) return String.fromCharCode(W1252[c]);
    return n < 256 && n >= 32 ? c : n === 10 ? " " : "?";
  }).join("");
}
function pdfWidth(s, size, bold) {
  let w = 0;
  for (const c of pdfText(s)) {
    let n = c.charCodeAt(0);
    if (n > 126) n = (c.normalize("NFD").charCodeAt(0) < 127 ? c.normalize("NFD").charCodeAt(0) : 110);
    w += HELV[n - 32] ?? 556;
  }
  return w / 1000 * size * (bold ? 1.06 : 1);
}
function pdfFit(s, size, bold, max) { // auf Breite kürzen
  s = String(s ?? "");
  if (pdfWidth(s, size, bold) <= max) return s;
  while (s.length > 1 && pdfWidth(s + "…", size, bold) > max) s = s.slice(0, -1);
  return s + "…";
}
function pdfWrap(s, size, bold, max) {
  const out = []; let line = "";
  for (const w of String(s ?? "").split(/\s+/).filter(Boolean)) {
    const t = line ? line + " " + w : w;
    if (pdfWidth(t, size, bold) <= max || !line) line = t; else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.map(l => pdfFit(l, size, bold, max));
}
function makePdf() {
  const pages = []; let cur = null;
  const rgb = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); const v = m ? parseInt(m[1], 16) : 0; return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255].map(x => x.toFixed(3)).join(" "); };
  const esc = s => pdfText(s).replace(/[\\()]/g, "\\$&");
  const Y = y => (842 - y).toFixed(2);
  const doc = {
    W: 595, H: 842,
    page() { cur = []; pages.push(cur); return doc; },
    text(x, y, s, size = 10, { bold = false, color = "#222222", align = "left" } = {}) {
      const w = pdfWidth(s, size, bold), dx = align === "right" ? -w : align === "center" ? -w / 2 : 0;
      cur.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${(x + dx).toFixed(2)} ${Y(y)} Td (${esc(s)}) Tj ET`);
    },
    rect(x, y, w, h, { fill = null, stroke = null, lw = 0.6 } = {}) {
      const r = `${x.toFixed(2)} ${Y(y + h)} ${w.toFixed(2)} ${h.toFixed(2)} re`;
      cur.push(`${lw} w ${fill ? rgb(fill) + " rg " : ""}${stroke ? rgb(stroke) + " RG " : ""}${r} ${fill && stroke ? "B" : fill ? "f" : "S"}`);
    },
    line(x1, y1, x2, y2, color = "#cccccc", lw = 0.6) { cur.push(`${lw} w ${rgb(color)} RG ${x1} ${Y(y1)} m ${x2} ${Y(y2)} l S`); },
    blob() {
      const objs = ["<< /Type /Catalog /Pages 2 0 R >>", null,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"];
      const kids = [];
      for (const p of pages) {
        const c = p.join("\n");
        objs.push(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
        const ci = objs.length;
        objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${ci} 0 R >>`);
        kids.push(`${objs.length} 0 R`);
      }
      objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>`;
      let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"; const offs = [];
      objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const x = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")
        + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
      return new Blob([Uint8Array.from(out, c => c.charCodeAt(0))], { type: "application/pdf" });
    },
  };
  return doc;
}

// Bestätigung: o = orderJson, nr = Eingangsnummer (leer = noch nicht gesendet)
function confirmationPdf(o, nr) {
  const d = makePdf(), L = 42, R = 553, ACC = "#C8553D", MUT = "#6B6B6B";
  let y = 0, pageNo = 0;
  const foot = () => {
    d.line(L, 806, R, 806, "#dddddd");
    d.text(L, 818, "Caelum GmbH · www.caelum.one · info@caelum.one · Freeware der Datenpunkt engineering AG, erstellt von Caelum GmbH", 7.5, { color: MUT });
    d.text(R, 818, `Seite ${pageNo}`, 7.5, { color: MUT, align: "right" });
  };
  const newPage = () => {
    if (pageNo) foot();
    d.page(); pageNo++;
    d.rect(L, 36, 6, 22, { fill: ACC });
    d.text(L + 14, 52, "Caelum Gravurschilder", 16, { bold: true });
    d.text(R, 52, nr ? `Eingang ${nr}` : "Entwurf (noch nicht gesendet)", 10, { bold: true, color: nr ? ACC : MUT, align: "right" });
    y = 84;
  };
  const need = h => { if (y + h > 790) newPage(); };
  const kv = (k, v) => { if (!v) return; need(14); d.text(L, y, k, 9, { color: MUT }); pdfWrap(v, 10, false, R - L - 110).forEach((l, i) => { if (i) { y += 13; need(13); } d.text(L + 110, y, l, 10); }); y += 15; };
  newPage();
  d.text(L, y, nr ? "Auftragsbestätigung" : "Auftrag (Entwurf)", 20, { bold: true }); y += 18;
  d.text(L, y, `${new Date(o.erstellt).toLocaleString("de-CH")} · Kundenportal www.caelum.one/gravur`, 9, { color: MUT }); y += 24;
  const k = o.kontakt || {};
  kv("Baustelle", o.baustelle.name); kv("Kunde", o.baustelle.kunde); kv("Projekt", o.baustelle.projekt);
  kv("Besteller", [k.name, k.firma].filter(Boolean).join(", ")); kv("E-Mail / Telefon", [k.email, k.telefon].filter(Boolean).join(" · "));
  kv("Lieferung an", k.lieferung); kv("Wunschtermin", k.termin ? new Date(k.termin).toLocaleDateString("de-CH") : ""); kv("Bemerkung", k.bemerkung);
  y += 8;
  // Positionen
  const cols = [L, L + 28, L + 200, L + 300, L + 420, R];
  const head = () => { need(40); d.text(L, y, "Positionen", 12, { bold: true }); y += 14; d.rect(L, y - 10, R - L, 16, { fill: "#F1EFEA" });
    ["Pos.", "Bezeichnung", "Mass (mm)", "Material", "Stück", "Richtpreis"].forEach((t, i) => d.text(i >= 4 ? (i === 4 ? cols[5] - 70 : R - 4) : cols[i] + 4, y + 1, t, 8.5, { bold: true, align: i >= 4 ? "right" : "left" })); y += 18; };
  head();
  o.positionen.forEach(p => {
    need(18);
    const m = mat(p.material);
    d.text(cols[0] + 4, y, String(p.nr), 9.5);
    d.text(cols[1] + 4, y, pdfFit(p.name || `Schildtyp ${p.nr}`, 9.5, false, cols[2] - cols[1] - 8), 9.5);
    d.text(cols[2] + 4, y, p.mass.replace(" mm", ""), 9.5);
    d.rect(cols[3] + 4, y - 8, 10, 10, { fill: m.surface, stroke: "#999999", lw: 0.4 });
    d.text(cols[3] + 18, y, pdfFit(`${p.material} ${m.name || ""}`, 9.5, false, cols[4] - cols[3] - 22), 9.5);
    d.text(cols[5] - 70, y, String(p.stueck), 9.5, { align: "right" });
    d.text(R - 4, y, p.richtpreis == null ? "auf Anfrage" : chf(p.richtpreis), 9.5, { align: "right" });
    d.line(L, y + 5, R, y + 5, "#e4e2dc"); y += 17;
  });
  const rp = o.richtpreis;
  need(40);
  d.text(R - 4, y + 4, `Richtpreis total ${chf(rp.netto)}`, 11, { bold: true, align: "right" }); y += 16;
  d.text(R - 4, y, `inkl. Einrichtung ${chf(rp.einrichtung)} · ${rp.hinweis}${rp.platzhalter ? " · Preise noch nicht freigegeben" : ""}`, 8.5, { color: MUT, align: "right" }); y += 26;
  // Schilderliste
  need(40); d.text(L, y, "Schilder", 12, { bold: true }); y += 6;
  d.text(R, y - 6, `${o.positionen.reduce((a, p) => a + p.stueck, 0)} Stück`, 9, { color: MUT, align: "right" }); y += 10;
  state.positions.forEach((p, i) => p.signs.forEach((x, n) => {
    if (!(x.count > 0)) return;
    const m = mat(p.s.MaterialCode), lines = (x.fields || []).filter(Boolean);
    const h = Math.max(30, 12 + lines.length * 11);
    need(h + 4);
    // Mini-Schild in echten Farben
    const sw = 70, sh = Math.min(40, Math.max(16, sw * p.s.Height / Math.max(1, p.s.Width)));
    d.rect(L, y, sw, sh, { fill: m.surface, stroke: "#9a9a9a", lw: 0.4 });
    lines.slice(0, 3).forEach((t, j) => d.text(L + sw / 2, y + (sh / (Math.min(3, lines.length) + 1)) * (j + 1) + 2.5, pdfFit(t, 6, true, sw - 6), 6, { bold: true, color: m.core, align: "center" }));
    d.text(L + sw + 12, y + 9, `${i + 1}.${pad2(n + 1)}`, 10, { bold: true });
    d.text(L + sw + 52, y + 9, pdfFit(x.ort ? "Montageort: " + x.ort : "ohne Montageort", 9, false, R - L - sw - 110), 9, { color: MUT });
    d.text(R, y + 9, `${x.count} Stk.`, 9.5, { align: "right" });
    lines.forEach((t, j) => d.text(L + sw + 52, y + 21 + j * 11, pdfFit(t, 9.5, false, R - L - sw - 60), 9.5));
    y += h + 6; d.line(L + sw + 12, y - 3, R, y - 3, "#eeeeee");
  }));
  y += 10; need(50);
  pdfWrap("Diese Bestätigung zeigt, was Sie über das Kundenportal gesendet haben. Der Richtpreis ist unverbindlich und versteht sich exkl. MWST. "
    + "Caelum prüft den Auftrag und schickt Ihnen eine Offerte bzw. einen Gut zum Druck per E-Mail. Fragen: info@caelum.one"
    + (nr ? ` (bitte Eingang ${nr} angeben).` : "."), 9, false, R - L).forEach(l => { d.text(L, y, l, 9, { color: MUT }); y += 12; });
  foot();
  return d.blob();
}
let lastEingang = "";
function savePdf(nr) {
  const o = lastZip?.o || orderJson(new Date());
  const blob = confirmationPdf(o, nr);
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `${nr ? "Auftragsbestaetigung" : "Auftrag_Entwurf"}_${safe(o.baustelle.projekt || o.baustelle.name) || "Baustelle"}${nr ? "_" + nr.replace(/[^\w]/g, "") : ""}.pdf`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

// ZIP (ohne Kompression, UTF-8-Namen) – reicht für Text und wird von Windows und CaelumGravur gelesen
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
  for (const f of files) {
    const name = enc.encode(f.name), data = typeof f.data === "string" ? enc.encode(f.data) : f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

function buildOrder() {
  const created = new Date(), o = orderJson(created);
  const base = `Auftrag_${safe(site.projekt || site.baustelle) || "Baustelle"}_${stamp(created)}`;
  const files = [
    { name: "auftrag.json", data: JSON.stringify(o, null, 2) },
    { name: "Auftrag.txt", data: orderText(o) },
    { name: "Montageverzeichnis.html", data: directoryHtml(o) },
  ];
  o.plaene.forEach((pp, i) => files.push({ name: pp.datei, data: unb64(plans()[i].img.split(",")[1]) }));
  state.positions.forEach((p, i) => {
    const d = posFolder(p, i);
    files.push({ name: `${d}/schilder.csv`, data: positionCsv(p, i) }, { name: `${d}/einstellungen.json`, data: settingsJson(p) });
  });
  return { o, name: base + ".zip", blob: makeZip(files) };
}
function guarded() {
  const errs = validateOrder();
  $("orderErr").innerHTML = errs.map(esc).join("<br>");
  return errs.length === 0;
}
let lastZip = null;
$("zipBtn").onclick = () => {
  if (!guarded()) return;
  lastZip = buildOrder();
  const a = document.createElement("a"); a.href = URL.createObjectURL(lastZip.blob); a.download = lastZip.name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  $("orderErr").innerHTML = `<span class="ok">Gespeichert: ${esc(lastZip.name)} – jetzt per E-Mail senden und die Datei anhängen.</span>`;
};
// Direkt senden: ZIP als Base64 an das Apps Script (text/plain = ohne CORS-Vorabfrage)
$("sendBtn").onclick = async () => {
  if (!guarded()) return;
  const btn = $("sendBtn");
  btn.disabled = true;
  $("orderErr").innerHTML = `<span class="ok">Wird gesendet …</span>`;
  try {
    lastZip = buildOrder();
    const buf = new Uint8Array(await lastZip.blob.arrayBuffer());
    let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const codeId = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("caelum-gravur:" + siteCode)));
    const o = lastZip.o, c = o.kontakt || {};
    const meta = { baustelle: o.baustelle.name, kunde: o.baustelle.kunde, projekt: o.baustelle.projekt, name: c.name || "", firma: c.firma || "", email: c.email || "",
      stueck: o.positionen.reduce((a, p) => a + p.stueck, 0), positionen: o.positionen.length,
      richtpreis: `${chf(o.richtpreis.netto)}${o.richtpreis.platzhalter ? " (Platzhalter)" : ""}` };
    const r = await fetch(EINGANG_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ auftrag: { codeId, name: lastZip.name, zip: btoa(bin), meta } }) });
    const a = await r.json();
    if (!a.ok) throw new Error(a.fehler || "Senden fehlgeschlagen");
    lastEingang = String(a.eingang || "");
    $("orderErr").innerHTML = `<span class="ok"><span class="thanks">Danke für Ihre Bestellung!</span>Der Auftrag ist bei Caelum angekommen (Eingang ${esc(a.eingang)}). Caelum prüft ihn und meldet sich mit einer Offerte per E-Mail.</span>`
      + `<br><button class="primary" id="pdfDoneBtn" style="margin-top:8px">Bestätigung als PDF speichern</button>`;
    $("pdfDoneBtn").onclick = () => savePdf(lastEingang);
    $("pdfBtn").textContent = "Bestätigung als PDF";
  } catch (e) {
    $("orderErr").innerHTML = esc(String(e.message || e)) + "<br>Bitte „Auftrag herunterladen“ und per E-Mail senden.";
  } finally { btn.disabled = false; }
};
$("pdfBtn").onclick = () => { if (lastEingang || guarded()) savePdf(lastEingang); };
$("mailBtn").onclick = () => {
  if (!guarded()) return;
  const o = lastZip?.o || orderJson(new Date());
  const body = orderText(o).replace("﻿", "").split("\r\n").slice(0, 40).join("\n")
    + `\n\nAuftragsdatei im Anhang: ${lastZip?.name || "(bitte zuerst „Auftrag herunterladen“ und die ZIP-Datei anhängen)"}\n`;
  location.href = `mailto:info@caelum.one?subject=${encodeURIComponent("Gravurschilder · " + site.baustelle)}&body=${encodeURIComponent(body)}`;
};
if (navigator.canShare && navigator.canShare({ files: [new File(["x"], "x.zip", { type: "application/zip" })] })) {
  $("shareBtn").classList.remove("hidden");
  $("shareBtn").onclick = async () => {
    if (!guarded()) return;
    lastZip = buildOrder();
    try { await navigator.share({ title: "Gravurschilder · " + site.baustelle, text: "Auftrag für Caelum GmbH (info@caelum.one)", files: [new File([lastZip.blob], lastZip.name, { type: "application/zip" })] }); } catch {}
  };
}
$("dirBtn").onclick = () => {
  const o = orderJson(new Date());
  const url = URL.createObjectURL(new Blob([directoryHtml(o)], { type: "text/html" }));
  const w = window.open(url, "_blank");
  if (!w) { const a = document.createElement("a"); a.href = url; a.download = "Montageverzeichnis.html"; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

// ───────── Start ─────────
$("codeBtn").onclick = enter;
$("codeIn").addEventListener("keydown", e => { if (e.key === "Enter") enter(); });
(() => {
  const q = new URLSearchParams(location.search).get("code");
  let c = q; try { c = c || sessionStorage.getItem("caelum-gravur-code"); } catch {}
  if (c) { $("codeIn").value = c; enter(); }
})();
// Zurück: Code vergessen, sonst springt /gravur/ beim nächsten Besuch gleich wieder in die Baustelle
$("backBtn").addEventListener("click", () => { try { sessionStorage.removeItem("caelum-gravur-code"); } catch {} });
// Prüfhilfe für Tests: window.caelumPortal
window.caelumPortal = { get state() { return state; }, buildOrder, layout, check, directoryHtml, orderJson };
