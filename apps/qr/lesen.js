// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum QR · Web – Lesetest im Browser. Wie Reader.Check der App: der gezeichnete Code wird in drei Größen
// (900, 360, 220 px) zurückgelesen. Dazu Handy-Proben: so, wie eine Handy-Kamera den Code sieht (klein, schräg und
// unscharf, dunkel). Leser: jsQR 1.4.0 (Apache-2.0, vendor/jsqr.mjs) statt ZXing – der Gleichheitstest prüft, dass beide
// die Bilder der App gleich beurteilen. Alles läuft im Browser, kein Bild verlässt den Rechner.
import jsQR from "./vendor/jsqr.mjs";
import { bytesVon } from "./qr.js";

export const GROESSEN = [900, 360, 220];

/**
 * Liest RGBA-Pixel; true, wenn genau die erwarteten Bytes herauskommen. Klappt es nicht, wird wie bei einer Kamera
 * (und wie TryHarder bei ZXing) zusätzlich verkleinert gelesen (½, ⅓ … bis ≈ 150 px) – jsQR tastet sonst bei großen
 * Punkt-Modulen in die Lücken zwischen den Punkten (Design „Punkte“ in 900 px, 19.11.2026).
 */
export function liest(rgba, w, h, text) {
  const soll = bytesVon(text);
  const passt = r => { const ist = r?.binaryData || []; return !!r && ist.length === soll.length && soll.every((b, i) => b === ist[i]); };
  if (passt(jsQR(rgba, w, h, { inversionAttempts: "attemptBoth" }))) return true;
  for (let k = 2; w / k >= 150; k++) {
    const v = verkleinern(rgba, w, h, k);
    if (passt(jsQR(v.rgba, v.w, v.h, { inversionAttempts: "attemptBoth" }))) return true;
  }
  return false;
}

/** Mittelwert über k × k Pixel. */
function verkleinern(rgba, w, h, k) {
  const W = Math.floor(w / k), H = Math.floor(h / k), out = new Uint8ClampedArray(W * H * 4), n = k * k;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) { const o = ((y * k + dy) * w + x * k + dx) * 4; r += rgba[o]; g += rgba[o + 1]; b += rgba[o + 2]; }
      const o = (y * W + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  return { w: W, h: H, rgba: out };
}

const leinwand = n => { const c = document.createElement("canvas"); c.width = c.height = n; return c; };

/** Reader.Check: zeichnen(ctx, px) malt den ruhenden Code; Ergebnis = Zahl der richtigen Lesungen von 3. */
export function pruefen(zeichnen, text) {
  let ok = 0;
  for (const px of GROESSEN) {
    const c = leinwand(px), g = c.getContext("2d", { willReadFrequently: true });
    zeichnen(g, px);
    if (liest(g.getImageData(0, 0, px, px).data, px, px, text)) ok++;
  }
  return ok;
}

/** Kann dieser Browser Weichzeichnen/Abdunkeln auf der Leinwand? (ältere Safari nicht) */
function filterGeht(g) { try { g.filter = "blur(1px)"; const ok = g.filter === "blur(1px)"; g.filter = "none"; return ok; } catch { return false; } }

/**
 * Handy-Proben: der Code (als Bild) in einer Kameraszene. Jede Probe liefert { name, gelesen, bild (Canvas) }.
 * Schräg = gedreht und gekippt (affin), unscharf = Weichzeichnen, dunkel = wenig Licht und Rauschen.
 */
export function handyProben(quelle, text) {
  const N = 360, proben = [
    { name: "Klein im Bild", code: 0.42, dreh: 0, kipp: 0, blur: 0, hell: 1, kontrast: 1 },
    { name: "Schräg und unscharf", code: 0.7, dreh: -0.26, kipp: 0.22, blur: 1.3, hell: 1, kontrast: 1 },
    { name: "Wenig Licht", code: 0.7, dreh: 0.06, kipp: 0, blur: 0.6, hell: 0.5, kontrast: 0.7, rauschen: 22 },
  ];
  const aus = [];
  for (const p of proben) {
    const c = leinwand(N), g = c.getContext("2d", { willReadFrequently: true });
    const filter = filterGeht(g);
    if ((p.blur || p.hell !== 1) && !filter) { aus.push({ name: p.name, gelesen: null, bild: c }); continue; }
    g.fillStyle = "#8C8A86"; g.fillRect(0, 0, N, N);                         // Tisch/Wand hinter dem Code
    g.save();
    g.filter = filter ? `blur(${p.blur}px) brightness(${p.hell}) contrast(${p.kontrast})` : "none";
    const s = N * p.code;
    g.translate(N / 2, N / 2); g.rotate(p.dreh); g.transform(1, 0, p.kipp, 1 - p.kipp * 0.35, 0, 0);
    g.drawImage(quelle, -s / 2, -s / 2, s, s);
    g.restore();
    if (p.rauschen) {
      const im = g.getImageData(0, 0, N, N), d = im.data; let z = 12345;
      for (let i = 0; i < d.length; i += 4) { z = (z * 1103515245 + 12345) >>> 0; const r = ((z >>> 16) / 65536 - 0.5) * p.rauschen; d[i] += r; d[i + 1] += r; d[i + 2] += r; }
      g.putImageData(im, 0, 0);
    }
    aus.push({ name: p.name, gelesen: liest(g.getImageData(0, 0, N, N).data, N, N, text), bild: c });
  }
  return aus;
}
