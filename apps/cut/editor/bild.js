// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Cut · Web-Editor: ein Bild der Zeitleiste zusammensetzen (Canvas 2D). Gleiche Regeln wie die Vorschau der App
// (PreviewView.cs) und ihr Export (TimelineRender, ffmpeg xfade): Videospuren von unten nach oben, Größe/Position/Deckkraft,
// Zuschnitt, Einpassen/Füllen, Effekte (CSS-Filter), Übergänge (Blende, über Farbe nach der ffmpeg-Formel, Wischen,
// Schieben, Abdecken, Aufdecken, Kreis; übrige Formen als Blende), Texte. Dient der Vorschau und dem Export.
// Mit derselben Versionsangabe laden wie dieses Modul – sonst entstehen zwei Kopien von projekt.js, und der Übergangs-Katalog
// steckt nur in einer (auf caelum.one hängt das Grundmodul immer ?v=<hash> an; gefunden 20.11.2026).
const V = new URL(import.meta.url).search;
const { vonUnten, istFarbe, istSichtbar, ende, ext, laenge, uebergang, hatUebergang, kurve, spurVon } = await import("./projekt.js" + V);

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const bildElemente = (t) => t.Items.filter(istSichtbar).sort((a, b) => a.Start - b.Start);
/** #RRGGBB + Deckkraft → rgba() */
export function rgba(hex, a = 1) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? "").trim()); const n = m ? parseInt(m[1], 16) : 0xffffff;
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${Math.min(1, Math.max(0, a))})`;
}

/** Welche Bild-Elemente bei Sekunde t gebraucht werden und bei welcher Quellzeit (für das Holen der Bilder vor dem Zeichnen). */
export function gebraucht(p, t) {
  const l = [];
  for (const s of vonUnten(p, "Video")) {
    if (s.Hidden) continue;
    const items = bildElemente(s);
    items.forEach((it, i) => { const e = ext(items, i); if (!istFarbe(it) && t >= it.Start && t < ende(it) + e) l.push({ it, sek: quellZeit(it, t) }); });
  }
  return l;
}
export const quellZeit = (it, t) => it.info?.bild ? 0 : Math.min(it.In + (t - it.Start) * it.Speed, Math.max(0, (it.info?.dauer ?? 0) - 0.04));

function box(it, R, dx = 0, dy = 0) {
  return { x: R.x + it.X * R.w - it.Scale * R.w / 2 + dx, y: R.y + it.Y * R.h - it.Scale * R.h / 2 + dy, w: it.Scale * R.w, h: it.Scale * R.h };
}
/** Wo das Bild in seiner Fläche liegt (Zuschnitt, Einpassen/Füllen) – aus den Maßen der Quelle. */
function inhalt(it, b, fuellen) {
  if (istFarbe(it)) return b;                                                     // Farbblock füllt seine Fläche
  const w = (it.info?.w || 16) * (1 - it.CropL - it.CropR), h = (it.info?.h || 9) * (1 - it.CropT - it.CropB);
  const k = fuellen ? Math.max(b.w / w, b.h / h) : Math.min(b.w / w, b.h / h);
  return { x: b.x + (b.w - w * k) / 2, y: b.y + (b.h - h * k) / 2, w: w * k, h: h * k };
}
const schnitt = (a, b) => { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y); return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) }; };

function aufdecken(dir, q, R) {
  if (dir === "r") return { x: R.x, y: R.y, w: R.w * q, h: R.h };
  if (dir === "u") return { x: R.x, y: R.y + R.h * (1 - q), w: R.w, h: R.h * q };
  if (dir === "d") return { x: R.x, y: R.y, w: R.w, h: R.h * q };
  return { x: R.x + R.w * (1 - q), y: R.y, w: R.w * q, h: R.h };
}
function versatz(dir, a, R, vz) {
  if (dir === "r") return [-vz * R.w * a, 0];
  if (dir === "u") return [0, vz * R.h * a];
  if (dir === "d") return [0, -vz * R.h * a];
  return [vz * R.w * a, 0];
}

/** Ausschnitt als Pfad: { rect } oder { ellipse }, mit „ohne“ = alles in R außer dieser Form (evenodd). */
function setzeClip(g, R, c) {
  if (!c) return;
  g.beginPath();
  if (c.ohne) g.rect(R.x, R.y, R.w, R.h);
  if (c.rect) g.rect(c.rect.x, c.rect.y, c.rect.w, c.rect.h);
  if (c.kreis) g.ellipse(c.kreis.x, c.kreis.y, c.kreis.r, c.kreis.r, 0, 0, Math.PI * 2);
  g.clip(c.ohne ? "evenodd" : "nonzero");
}

/** CSS-Filter für die Effekte (Näherung von ffmpeg eq/hue/boxblur) und den Ton Richtung Schwarz. */
function filter(it, ton, weiss, W) {
  const f = [];
  const hell = (1 + it.Brightness) * (weiss ? 1 : ton);
  if (Math.abs(hell - 1) > 0.001) f.push(`brightness(${hell})`);
  if (Math.abs(it.Contrast - 1) > 0.001) f.push(`contrast(${it.Contrast})`);
  if (it.Gray) f.push("grayscale(1)"); else if (Math.abs(it.Saturation - 1) > 0.001) f.push(`saturate(${it.Saturation})`);
  if (it.Blur > 0.2) f.push(`blur(${(it.Blur * W / 1080).toFixed(2)}px)`);
  return f.length ? f.join(" ") : "none";
}

/**
 * Bild zur Sekunde t auf g (W×H) zeichnen. quelle(it) liefert { bild, w, h } (aufrechtes Bild in Anzeigegröße) oder null.
 * fuellen = Projekt „Füllen“. markiere = Element mit Rahmen (nur Vorschau).
 */
export function zeichnen(g, p, t, W, H, quelle, { markiere = null, rahmen = false, griff = 0 } = {}) {
  const R = { x: 0, y: 0, w: W, h: H }, fuellen = p.Fit === "Fuellen";
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = "none";
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  let mark = null;
  for (const s of vonUnten(p, "Video")) {
    if (s.Hidden) continue;
    const items = bildElemente(s);
    for (let i = 0; i < items.length; i++) {
      const it = items[i], e = ext(items, i);
      if (t < it.Start || t >= ende(it) + e) continue;
      const lokal = t - it.Start, look = { alpha: Math.min(1, Math.max(0, it.Opacity)), ton: 1, weiss: false, dx: 0, dy: 0, clip: null };
      const din = i > 0 ? ext(items, i - 1) : 0, d = uebergang(it.Transition);
      if (hatUebergang(it) && din > 0 && lokal < din) herein(d, kurve(lokal / din, d.kurve), R, look);
      else if (hatUebergang(it) && din === 0 && lokal < it.TransitionSec) look.alpha *= kurve(lokal / Math.max(0.05, it.TransitionSec), d.kurve);
      const q = quelle(it);
      if (e > 0 && t >= ende(it)) {
        const nx = items[i + 1], nd = uebergang(nx.Transition), qq = kurve((t - ende(it)) / e, nd.kurve);
        if (nd.art === "slide" || nd.art === "reveal") [look.dx, look.dy] = versatz(nd.richtung, qq, R, -1);
        else if (nd.art === "wipe") look.clip = { ohne: true, rect: aufdecken(nd.richtung, qq, R) };
        else if (nd.art === "cover") { const [dx, dy] = versatz(nd.richtung, 1 - qq, R, +1); look.clip = { ohne: true, rect: { x: R.x + dx, y: R.y + dy, w: R.w, h: R.h } }; }
        else if (nd.art === "circle") {
          const r = Math.hypot(R.w, R.h) / 2 * (nd.richtung === "open" ? qq : 1 - qq);
          look.clip = { ohne: nd.richtung === "open", kreis: { x: R.x + R.w / 2, y: R.y + R.h / 2, r } };
        } else {
          // Blende: im Bereich des neuen Bildes deckt es darüber; außerhalb blendet das alte aus (wie ffmpeg xfade auf Ebenen)
          if (nd.art === "color") { look.ton = smooth(0.8, 1, 1 - qq); look.weiss = nd.farbe === "#FFFFFF"; }
          const drin = schnitt(inhalt(nx, box(nx, R), fuellen), R);
          ein(g, it, q, R, { ...look, alpha: look.alpha * (1 - qq), clip: { ohne: true, rect: drin } }, fuellen, W);
          look.clip = { rect: drin };
        }
      }
      const b = ein(g, it, q, R, look, fuellen, W);
      if (it === markiere) mark = b;
    }
  }
  texte(g, p, t, R);
  if (mark && rahmen) { g.save(); g.setLineDash([6, 4]); g.strokeStyle = "#D97757"; g.lineWidth = 2; g.strokeRect(mark.x, mark.y, mark.w, mark.h); g.restore(); }
  const gb = rahmen ? griffFlaeche(p, markiere, t, W, H) : null;
  if (gb) {
    // Griffe an den Ecken (0.3.0): innen ziehen = verschieben, Ecke ziehen = skalieren
    const s = griff || Math.max(7, Math.round(Math.min(W, H) / 60));              // griff = Größe in Bildpunkten der Fläche (Editor: 11 px am Schirm)
    g.save(); g.fillStyle = "#D97757"; g.strokeStyle = "#1F1E1D"; g.lineWidth = Math.max(1, s / 8);
    for (const [x, y] of ecken(gb)) { g.fillRect(x - s / 2, y - s / 2, s, s); g.strokeRect(x - s / 2, y - s / 2, s, s); }
    g.restore();
  }
  g.restore();
}

/** Fläche des gewählten Bild-Elements, wenn es bei t zu sehen ist (für die Griffe), sonst null. Wie PreviewView.HandleBox. */
export function griffFlaeche(p, it, t, W, H) {
  if (!it || !istSichtbar(it)) return null;
  const s = spurVon(p, it); if (!s || s.Kind !== "Video" || s.Hidden) return null;
  if (t < it.Start || t >= ende(it)) return null;
  return box(it, { x: 0, y: 0, w: W, h: H });
}
/** Ecken im Uhrzeigersinn ab oben links (Reihenfolge wie die App). */
export const ecken = b => [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]];

/** Das neue Element B im Übergang, q = 0 … 1. */
function herein(d, q, R, l) {
  switch (d.art) {
    case "color": l.alpha *= q; l.ton = 1 - smooth(0.2, 1, 1 - q); l.weiss = d.farbe === "#FFFFFF"; break;
    case "wipe": case "reveal": l.clip = { rect: aufdecken(d.richtung, q, R) }; break;
    case "slide": case "cover": [l.dx, l.dy] = versatz(d.richtung, 1 - q, R, +1); break;
    case "circle": {
      const r = Math.hypot(R.w, R.h) / 2 * (d.richtung === "open" ? q : 1 - q);
      l.clip = { ohne: d.richtung !== "open", kreis: { x: R.x + R.w / 2, y: R.y + R.h / 2, r } }; break;
    }
    default: l.alpha *= q;
  }
}

/** Ein Element zeichnen (Zuschnitt, Fläche, Drehung, Filter, Ausschnitt). Gibt seine Fläche zurück (für die Markierung). */
function ein(g, it, q, R, look, fuellen, W) {
  const b = box(it, R, look.dx, look.dy);
  if (look.alpha <= 0.002) return b;
  g.save();
  g.beginPath(); g.rect(b.x, b.y, b.w, b.h); g.clip();
  setzeClip(g, R, look.clip);
  if (istFarbe(it)) {
    // Farbblock: Farbe mit Deckkraft; Helligkeit und Schwarzblende über denselben Filter wie Bilder, Weißblende darüber
    g.globalAlpha = look.alpha; g.filter = filter(it, look.ton, look.weiss, W);
    g.fillStyle = rgba(it.Fill, 1); g.fillRect(b.x, b.y, b.w, b.h);
    if (look.weiss && look.ton < 1) { g.filter = "none"; g.globalAlpha = look.alpha * (1 - look.ton); g.fillStyle = "#fff"; g.fillRect(b.x, b.y, b.w, b.h); }
    g.restore(); return b;
  }
  if (!q) { g.fillStyle = "rgba(61,61,58,.35)"; const c = inhalt(it, b, fuellen); g.fillRect(c.x, c.y, c.w, c.h); g.restore(); return b; }
  const c = inhalt(it, b, fuellen);
  g.globalAlpha = look.alpha;
  g.filter = filter(it, look.ton, look.weiss, W);
  // q.bild ist immer aufrecht (export.js dreht Handy-Bilder vorher); Zuschnitt als Ausschnitt der Quelle
  const sx = it.CropL * q.w, sy = it.CropT * q.h, sw = (1 - it.CropL - it.CropR) * q.w, sh = (1 - it.CropT - it.CropB) * q.h;
  g.drawImage(q.bild, sx, sy, sw, sh, c.x, c.y, c.w, c.h);
  if (look.weiss && look.ton < 1) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.filter = "none"; g.globalAlpha = look.alpha * (1 - look.ton);
    g.fillStyle = "#fff"; g.fillRect(c.x, c.y, c.w, c.h);
  }
  g.restore();
  return b;
}

function texte(g, p, t, R) {
  for (const s of p.Tracks.filter(x => x.Kind === "Text" && !x.Hidden).reverse())
    for (const it of s.Items) {
      if (!it.Text?.trim() || t < it.Start || t >= ende(it)) continue;
      const size = Math.max(6, Math.min(R.w, R.h) * it.TextSize), fd = Math.min(0.3, laenge(it) / 3), lt = t - it.Start;
      const a = Math.min(1, Math.max(0, Math.min(fd > 0 ? lt / fd : 1, fd > 0 ? (ende(it) - t) / fd : 1))) * Math.min(1, Math.max(0, it.Opacity ?? 1));
      g.save();
      g.font = `600 ${size}px "Segoe UI", system-ui, -apple-system, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "top";
      const zeilen = it.Text.replace(/\r/g, "").split("\n"), lh = size * 1.2;
      const bw = Math.max(...zeilen.map(z => g.measureText(z).width)), bh = lh * zeilen.length;
      const y = it.TextPos === "oben" ? R.y + R.h * 0.08 : it.TextPos === "mitte" ? R.y + (R.h - bh) / 2 : R.y + R.h - bh - R.h * 0.10;
      const x = R.x + R.w / 2;
      if (it.TextBox) { const pad = size * 0.35; g.fillStyle = rgba(it.TextBoxColor ?? "#000000", (it.TextBoxOpacity ?? 0.45) * a); g.fillRect(x - bw / 2 - pad, y - pad, bw + 2 * pad, bh + 2 * pad); }
      else { g.shadowColor = `rgba(0,0,0,${0.6 * a})`; g.shadowBlur = size * 0.15; }
      g.globalAlpha = a; g.fillStyle = it.TextColor || "#FFFFFF";
      zeilen.forEach((z, k) => g.fillText(z, x, y + k * lh));
      g.restore();
    }
}
