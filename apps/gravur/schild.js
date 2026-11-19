// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Gravur · Web-Fassung der Schild-Geometrie und des SVG für xTool Studio.
// MASTER ist die App: src/Caelum.Gravur.Core/SignGeometry.cs (BuildStandard) und SvgExport.cs (Single).
// Diese Datei bildet sie für ein Schild nach; web/test/gleich.mjs prüft sie gegen Referenzfälle aus der App.
// Unterschiede (bewusst, CAELUM-STANDARD.md C1): kein Logo, kein Freiform-Design, kein Unterstrich, kein Blocksatz,
// Schrift Arimo (gleiche Zeichenbreiten wie Arial) statt Systemschrift. Reine Logik ohne DOM – läuft im Browser und in Node.

// ───────────────────────── Vorgaben (wie SignSettings in Settings.cs) ─────────────────────────

export const VORGABE = Object.freeze({
  typ: "LASERPLY", code: "S00", dicke: 1.5,
  breite: 100, hoehe: 30, radius: 0,
  loecher: "Links", lochD: 4, lochAbstand: 5, befestigung: "Schraube",
  rahmen: false, rahmenAbstand: 1.5, rahmenBreite: 0.4,
  qr: false, qrText: "https://www.datenpunkt.ch/?schild={nr:0000}", qrGroesse: 20, qrSeite: "Rechts",
  nummer: 1,
  zeilen: 2, spalten: 1,
  schrifthoehe: 5, fett: false, ausrichtung: "Mitte", umriss: false,
  randOben: 2, randUnten: 2, randLinks: 2, randRechts: 2,
  zeilenabstand: 0, spaltenabstand: 0,
  verkleinern: true,
  zweiteTiefeZeilen: [2], zweiteTiefeQr: true,
  felder: ["", ""],
});

export const LOCHARTEN = ["Keine", "Links", "Rechts", "Beide", "ObenMitte", "ObenBeide", "VierEcken"];

// SvgExport.cs – je Bearbeitung eine Farbe = eine Ebene in xTool Studio
export const FARBEN = Object.freeze({
  gravieren: "#000000", gravieren2: "#00A000", ritzen: "#FF00FF", schriftUmriss: "#FF8C00",
  detailSchneiden: "#0000FF", kantenSchneiden: "#FF0000",
});
export const LEGENDE = "schwarz = Gravieren · orange = Schrift-Umriss · blau = Detail schneiden (Löcher) · rot = Kanten schneiden (Grundform) · magenta = Ritzen";

// ───────────────────────── Pfade (Befehle wie opentype.js: M L Q C Z) ─────────────────────────

const K = 0.5522847498; // Kreisbogen als kubische Bézierkurve

class Pfad {
  constructor() { this.b = []; }
  get leer() { return this.b.length === 0; }
  add(p) { for (const c of p.b) this.b.push(c); return this; }
  M(x, y) { this.b.push({ type: "M", x, y }); return this; }
  L(x, y) { this.b.push({ type: "L", x, y }); return this; }
  C(x1, y1, x2, y2, x, y) { this.b.push({ type: "C", x1, y1, x2, y2, x, y }); return this; }
  Z() { this.b.push({ type: "Z" }); return this; }
  rect(x0, y0, x1, y1, ccw = false) {
    return ccw ? this.M(x0, y0).L(x0, y1).L(x1, y1).L(x1, y0).Z() : this.M(x0, y0).L(x1, y0).L(x1, y1).L(x0, y1).Z();
  }
  /** Rechteck mit runden Ecken, im oder gegen den Uhrzeigersinn (für Ringe mit nonzero-Füllung). */
  roundRect(x0, y0, x1, y1, r, ccw = false) {
    r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
    if (r <= 0.01) return this.rect(x0, y0, x1, y1, ccw);
    const k = r * K;
    if (!ccw) {
      this.M(x0 + r, y0).L(x1 - r, y0).C(x1 - r + k, y0, x1, y0 + r - k, x1, y0 + r)
        .L(x1, y1 - r).C(x1, y1 - r + k, x1 - r + k, y1, x1 - r, y1)
        .L(x0 + r, y1).C(x0 + r - k, y1, x0, y1 - r + k, x0, y1 - r)
        .L(x0, y0 + r).C(x0, y0 + r - k, x0 + r - k, y0, x0 + r, y0).Z();
    } else {
      this.M(x0 + r, y0).C(x0 + r - k, y0, x0, y0 + r - k, x0, y0 + r)
        .L(x0, y1 - r).C(x0, y1 - r + k, x0 + r - k, y1, x0 + r, y1)
        .L(x1 - r, y1).C(x1 - r + k, y1, x1, y1 - r + k, x1, y1 - r)
        .L(x1, y0 + r).C(x1, y0 + r - k, x1 - r + k, y0, x1 - r, y0).Z();
    }
    return this;
  }
  /** Fremde Befehle (opentype.js) übernehmen, Q in C umwandeln. */
  befehle(cmds) {
    let lx = 0, ly = 0;
    for (const c of cmds) {
      if (c.type === "Q") {
        this.C(lx + 2 / 3 * (c.x1 - lx), ly + 2 / 3 * (c.y1 - ly), c.x + 2 / 3 * (c.x1 - c.x), c.y + 2 / 3 * (c.y1 - c.y), c.x, c.y);
      } else if (c.type === "Z") this.Z();
      else this.b.push({ ...c });
      if (c.x !== undefined) { lx = c.x; ly = c.y; }
    }
    return this;
  }
  grenzen() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.b) for (const [kx, ky] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) {
      if (c[kx] === undefined) continue;
      x0 = Math.min(x0, c[kx]); x1 = Math.max(x1, c[kx]); y0 = Math.min(y0, c[ky]); y1 = Math.max(y1, c[ky]);
    }
    return x0 === Infinity ? null : { x0, y0, x1, y1 };
  }
  /** SVG-Pfaddaten, verschoben um dx/dy, Werte wie in C# „0.###“. */
  d(dx = 0, dy = 0) {
    const o = [];
    for (const c of this.b) {
      if (c.type === "Z") o.push("Z");
      else if (c.type === "C") o.push("C" + f(c.x1 + dx) + " " + f(c.y1 + dy) + " " + f(c.x2 + dx) + " " + f(c.y2 + dy) + " " + f(c.x + dx) + " " + f(c.y + dy));
      else if (c.type === "Q") o.push("Q" + f(c.x1 + dx) + " " + f(c.y1 + dy) + " " + f(c.x + dx) + " " + f(c.y + dy));
      else o.push(c.type + f(c.x + dx) + " " + f(c.y + dy));
    }
    return o.join("");
  }
}

/** Zahl wie C# ToString("0.###", InvariantCulture). */
export function f(v) {
  const r = Math.round(v * 1000) / 1000;
  return (Object.is(r, -0) ? 0 : r).toString();
}
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
const f2 = v => (Math.round(v * 100) / 100).toFixed(2);

// ───────────────────────── Platzhalter (SignGeometry.Expand) ─────────────────────────

export function ersetzen(vorlage, felder, nummer, url = false) {
  return String(vorlage).replace(/\{(nr(?::(0+))?|qr|(\d+))\}/gi, (m, _a, fmt, feld) => {
    if (feld !== undefined) {
      const i = parseInt(feld, 10);
      const v = i >= 1 ? String(felder[i - 1] ?? "").replace(/\n/g, " ") : "";
      return url ? encodeURIComponent(v) : v;
    }
    if (/^\{qr/i.test(m)) return "";
    const s = String(Math.abs(nummer));
    const pad = fmt ? s.padStart(fmt.length, "0") : s;
    return nummer < 0 ? "-" + pad : pad;
  });
}

export function qrInhalt(s) {
  const url = /^\s*http/i.test(s.qrText || "");
  return ersetzen(s.qrText || "", s.felder || [], s.nummer ?? 1, url).trim();
}

// ───────────────────────── Ausschnitte (SignGeometry.CutoutsFor) ─────────────────────────

export function ausschnitte(s) {
  if (s.befestigung === "Kleben") return [];
  const w = s.breite, h = s.hoehe, o = s.lochAbstand, d = s.lochD;
  const L = (x, y) => ({ x, y, w: d, h: d });
  switch (s.loecher) {
    case "Links": return [L(o, h / 2)];
    case "Rechts": return [L(w - o, h / 2)];
    case "Beide": return [L(o, h / 2), L(w - o, h / 2)];
    case "ObenMitte": return [L(w / 2, o)];
    case "ObenBeide": return [L(o, o), L(w - o, o)];
    case "VierEcken": return [L(o, o), L(w - o, o), L(o, h - o), L(w - o, h - o)];
    default: return [];
  }
}

// ───────────────────────── Aufbau (SignGeometry.BuildStandard) ─────────────────────────

/**
 * Schild aufbauen. hilfe = { schrift(fett) → opentype-Font, qr(text) → { n, dunkel(x, y) } | null, zweiTiefen: bool }.
 * Ergebnis in mm, Ursprung oben links, y nach unten.
 */
export function aufbauen(eingabe, hilfe) {
  const s = { ...VORGABE, ...eingabe };
  const two = !!hilfe.zweiTiefen;
  const depth2Rows = new Set(two ? s.zweiteTiefeZeilen : []);
  const w = s.breite, h = s.hoehe;
  const rr = Math.min(s.radius, Math.min(w, h) / 2);
  const g = {
    breite: w, hoehe: h, radius: rr,
    umriss: new Pfad().roundRect(0, 0, w, h, rr),
    loecher: ausschnitte(s),
    gravur: new Pfad(), gravur2: new Pfad(), text: new Pfad(), text2: new Pfad(), schriftUmriss: new Pfad(),
    zellen: [], textBoxen: [], qr: null, hinweise: [],
  };

  let minFrame = 0;
  if (s.rahmen) {
    const a = s.rahmenAbstand, b = s.rahmenAbstand + s.rahmenBreite;
    const ziel = two && false ? g.gravur2 : g.gravur; // Depth2Frame ist in der App standardmässig aus
    ziel.roundRect(a, a, w - a, h - a, Math.max(0, rr - a), false);
    ziel.roundRect(b, b, w - b, h - b, Math.max(0, rr - b), true);
    minFrame = s.rahmenAbstand + s.rahmenBreite + 0.8;
  }

  const margin = Math.max(minFrame, Math.min(Math.min(s.randOben, s.randUnten), Math.min(s.randLinks, s.randRechts)));
  let x0 = Math.max(minFrame, s.randLinks), x1 = w - Math.max(minFrame, s.randRechts);
  let y0 = Math.max(minFrame, s.randOben);
  const y1 = h - Math.max(minFrame, s.randUnten);
  const reserve = s.lochAbstand + s.lochD / 2 + 1.0;
  if (s.befestigung !== "Kleben") {
    switch (s.loecher) {
      case "Links": x0 = Math.max(x0, reserve); break;
      case "Rechts": x1 = Math.min(x1, w - reserve); break;
      case "Beide": case "VierEcken": x0 = Math.max(x0, reserve); x1 = Math.min(x1, w - reserve); break;
      case "ObenBeide": x0 = Math.max(x0, reserve); x1 = Math.min(x1, w - reserve); break;
      case "ObenMitte": y0 = Math.max(y0, s.lochAbstand + s.lochD / 2 + 1.0); break;
    }
  }

  // QR-Code
  if (s.qr && hilfe.qr) {
    const inhalt = qrInhalt(s);
    if (inhalt.length > 0) {
      const size = Math.min(s.qrGroesse, Math.min(h - 2 * margin, x1 - x0));
      const code = hilfe.qr(inhalt);
      if (code) {
        const n = code.n, mod = size / (n + 2), over = 0.003;
        const qx = s.qrSeite === "Links" ? x0 : x1 - size, qy = (h - size) / 2;
        const ziel = two && s.zweiteTiefeQr ? g.gravur2 : g.gravur;
        for (let y = 0; y < n; y++) {
          let run = -1;
          for (let x = 0; x <= n; x++) {
            const dark = x < n && code.dunkel(x, y);
            if (dark && run < 0) run = x;
            else if (!dark && run >= 0) {
              ziel.rect(qx + (run + 1) * mod, qy + (y + 1) * mod - over, qx + (x + 1) * mod, qy + (y + 2) * mod + over);
              run = -1;
            }
          }
        }
        g.qr = { inhalt, x: qx, y: qy, groesse: size, modul: mod, n };
        if (mod < 0.35) g.hinweise.push("QR-Modul nur " + f2(mod) + " mm – QR grösser machen oder Link kürzen.");
        if (s.qrSeite === "Links") x0 = qx + size + 1.0; else x1 = qx - 1.0;
      }
    }
  }

  if (x1 - x0 < 1 || y1 - y0 < 1) { g.hinweise.push("Kein Platz für Text."); fertig(g); return g; }

  const rows = Math.max(1, s.zeilen | 0), cols = Math.max(1, s.spalten | 0);
  const rg = Math.max(0, s.zeilenabstand), cg = Math.max(0, s.spaltenabstand);
  const cw = Math.max(0.5, (x1 - x0 - cg * (cols - 1)) / cols), ch = Math.max(0.5, (y1 - y0 - rg * (rows - 1)) / rows);
  const font = hilfe.schrift(!!s.fett);
  const capRatio = grossbuchstabenHoehe(font);
  const opt = { kerning: false, hinting: false, features: { liga: false, rlig: false } };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = x0 + c * (cw + cg), cy = y0 + r * (ch + rg);
      g.zellen.push({ x0: cx, y0: cy, x1: cx + cw, y1: cy + ch });
      const text = ersetzen(String(s.felder[r * cols + c] ?? "").replace(/\r/g, ""), s.felder, s.nummer);
      if (!text.trim() || !font) continue;
      const lines = text.split("\n");
      const slot = ch / lines.length;
      const cap = Math.min(s.schrifthoehe, slot / 1.45);
      if (cap < s.schrifthoehe - 0.05) g.hinweise.push("Zeile " + (r + 1) + ": Schrift auf " + f1(cap) + " mm verkleinert (Höhe).");
      const target = s.umriss ? g.schriftUmriss : depth2Rows.has(r + 1) ? g.text2 : g.text;
      for (let li = 0; li < lines.length; li++) {
        const line = lines[li].trim();
        if (!line) continue;
        let lineCap = cap;
        let size = lineCap / capRatio;
        const avail = cw - 0.6;
        let tw = font.getAdvanceWidth(line, size, opt);
        if (tw > avail) {
          if (s.verkleinern) {
            lineCap *= avail / tw; size = lineCap / capRatio; tw = font.getAdvanceWidth(line, size, opt);
            g.hinweise.push("„" + line + "“ auf " + f1(lineCap) + " mm verkleinert (Breite).");
          } else g.hinweise.push("„" + line + "“ ist zu lang für das Feld.");
        }
        const cx0 = cx + 0.3, cx1 = cx + cw - 0.3;
        const mid = cy + (li + 0.5) * slot;
        const baseline = mid + lineCap / 2;
        const x = s.ausrichtung === "Links" ? cx0 : s.ausrichtung === "Rechts" ? cx1 - tw : (cx0 + cx1 - tw) / 2;
        const glyphen = new Pfad().befehle(font.getPath(line, x, baseline, size, opt).commands);
        target.add(glyphen);
        g.textBoxen.push({ zeile: r + 1, text: line, cap: lineCap, x, baseline, breite: tw, grenzen: glyphen.grenzen() });
      }
    }
  }
  fertig(g);
  return g;
}

/**
 * Grossbuchstabenhöhe je Schriftgrösse. Die App rechnet mit Arial (Skia liest sCapHeight 1467/2048 = 0,716).
 * Arimo hat dieselben Zeichenbreiten, aber niedrigere Grossbuchstaben (1409). Die App ist Master: wir nehmen das
 * Arial-Mass, damit Schriftgrösse, Breiten und Lage gleich sind wie in der App (Grossbuchstaben im Web ~4 % niedriger).
 */
const ARIAL_CAP = 1467 / 2048;
function grossbuchstabenHoehe(font) {
  return /arimo|arial|liberation sans/i.test(font?.names?.fontFamily?.en || "Arimo") ? ARIAL_CAP
    : (font.tables.os2?.sCapHeight || 1467) / font.unitsPerEm;
}

function fertig(g) {
  // Gefüllter Text gehört zur Gravurfläche; Umriss-Schrift liegt in schriftUmriss (eigene Ebene)
  g.gravur.add(g.text); g.gravur2.add(g.text2);
}

// ───────────────────────── SVG (SvgExport.Single → Sheet) ─────────────────────────

/** Probeschild wie in der App: Platte = Schild + 4 mm, Schild bei (2, 2), Kontur schneiden, Löcher schneiden. */
export function svg(eingabe, g, material) {
  const s = { ...VORGABE, ...eingabe };
  const dx = 2, dy = 2, sw = s.breite + 4, sh = s.hoehe + 4;
  const teile = [];
  const gruppe = (id, attr, inhalt) => { if (inhalt) teile.push(`  <g id="${id}" ${attr}>\n${inhalt}  </g>\n`); };
  const p = (pf) => pf.leer ? "" : `    <path d="${pf.d(dx, dy)}"/>\n`;
  let loecher = "";
  for (const l of g.loecher) loecher += `    <circle cx="${f(l.x + dx)}" cy="${f(l.y + dy)}" r="${f(Math.min(l.w, l.h) / 2)}"/>\n`;

  gruppe("Gravieren", `fill="${FARBEN.gravieren}" fill-rule="nonzero" stroke="none"`, p(g.gravur));
  gruppe("Gravieren-Tiefe2", `fill="${FARBEN.gravieren2}" fill-rule="nonzero" stroke="none"`, p(g.gravur2));
  gruppe("Schrift-Umriss", `fill="none" stroke="${FARBEN.schriftUmriss}" stroke-width="0.1"`, p(g.schriftUmriss));
  gruppe("Detail-schneiden", `fill="none" stroke="${FARBEN.detailSchneiden}" stroke-width="0.1"`, loecher);
  gruppe("Kanten-schneiden", `fill="none" stroke="${FARBEN.kantenSchneiden}" stroke-width="0.1"`, p(g.umriss));

  const m = material || {};
  let kopf = '<?xml version="1.0" encoding="UTF-8"?>\n';
  kopf += `<!-- Caelum Gravur · Freeware der Datenpunkt engineering AG, erstellt von Caelum GmbH · Web-Fassung · Platte 1/1 · ${m.typName || s.typ} ${m.code || s.code} ${m.name || ""} · ${f(s.dicke)} mm · 1 Schilder -->\n`;
  kopf += `<!-- xTool Studio: ${LEGENDE}. Reihenfolge: Gravieren → Detail schneiden → Kanten schneiden. -->\n`;
  if (m.zweiTiefen) kopf += "<!-- Zwei Tiefen: schwarz = 1. Tiefe, grün = 2. Tiefe (stärker oder zweiter Durchgang). -->\n";
  return kopf + `<svg xmlns="http://www.w3.org/2000/svg" width="${f(sw)}mm" height="${f(sh)}mm" viewBox="0 0 ${f(sw)} ${f(sh)}">\n` + teile.join("") + "</svg>\n";
}

/** Prüfdaten für den Gleichheitstest (gleicher Aufbau wie web/export in C#). */
export function pruefdaten(g) {
  const r = v => Math.round(v * 100) / 100;
  return {
    zellen: g.zellen.map(z => [r(z.x0), r(z.y0), r(z.x1), r(z.y1)]),
    loecher: g.loecher.map(l => [r(l.x), r(l.y), r(l.w), r(l.h)]),
    qr: g.qr ? { modul: Math.round(g.qr.modul * 1000) / 1000, n: g.qr.n, x: r(g.qr.x), y: r(g.qr.y) } : null,
    text: (() => { const b = g.text.grenzen(); return b ? [r(b.x0), r(b.y0), r(b.x1), r(b.y1)] : null; })(),
    text2: (() => { const b = g.text2.grenzen(); return b ? [r(b.x0), r(b.y0), r(b.x1), r(b.y1)] : null; })(),
  };
}
