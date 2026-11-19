// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Analyse – Codes lesen: Kamera (nur über HTTPS oder localhost) und Bilder. Zuerst der eingebaute BarcodeDetector des
// Browsers (Android-Chrome, schnell), sonst ZXing-js (vendor/, Apache-2.0) – beide ganz auf dem Gerät, kein Hochladen.
// Formate: QR, Data Matrix, Aztec, PDF417, EAN-13/-8, UPC-A/-E, Code 128/39/93, ITF, Codabar (Wunsch Kenny: auch Barcodes).
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
const FORMATE = ["qr_code", "data_matrix", "aztec", "pdf417", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar"];
let zxing = null;

async function zxingLaden() {
  if (zxing) return zxing;
  if (!globalThis.ZXing) await new Promise((ok, err) => { const s = document.createElement("script"); s.src = new URL("vendor/zxing-0.21.3.min.js", import.meta.url); s.onload = ok; s.onerror = () => err(new Error("ZXing fehlt")); document.head.append(s); });
  const Z = globalThis.ZXing, hints = new Map();
  hints.set(Z.DecodeHintType.TRY_HARDER, true);
  hints.set(Z.DecodeHintType.CHARACTER_SET, "UTF-8");
  const r = new Z.MultiFormatReader(); r.setHints(hints);
  zxing = { Z, r };
  return zxing;
}

let detektor = undefined;
async function detektorLaden() {
  if (detektor !== undefined) return detektor;
  detektor = null;
  try {
    if ("BarcodeDetector" in globalThis) {
      const da = await BarcodeDetector.getSupportedFormats();
      const f = FORMATE.filter(x => da.includes(x));
      if (f.includes("qr_code")) detektor = new BarcodeDetector({ formats: f });
    }
  } catch { detektor = null; }
  return detektor;
}
export async function wegName() { return (await detektorLaden()) ? "Browser (BarcodeDetector)" : "ZXing-js"; }

/** Liest Codes aus einem Bild, Video oder Canvas. Rückgabe: [{ text, format, stufe? }] (leer = nichts gefunden). */
export async function lesen(quelle, flaeche) {
  const d = await detektorLaden();
  if (d) { try { const r = await d.detect(quelle); if (r.length) return r.map(x => ({ text: x.rawValue, format: x.format })); } catch { } }
  const { Z, r } = await zxingLaden();
  const w = quelle.videoWidth || quelle.naturalWidth || quelle.width, h = quelle.videoHeight || quelle.naturalHeight || quelle.height;
  if (!w || !h) return [];
  const k = Math.min(1, 1600 / Math.max(w, h)), W = Math.round(w * k), H = Math.round(h * k);
  const c = flaeche || document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(quelle, 0, 0, W, H);
  const px = g.getImageData(0, 0, W, H).data, lum = new Uint8ClampedArray(W * H);
  for (let i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (px[j] * 77 + px[j + 1] * 150 + px[j + 2] * 29) >> 8;
  for (const invert of [false, true]) {
    try {
      let src = new Z.RGBLuminanceSource(lum, W, H); if (invert) src = src.invert();
      const res = r.decode(new Z.BinaryBitmap(new Z.HybridBinarizer(src)));
      const fmt = String(Z.BarcodeFormat[res.getBarcodeFormat()] || "").toLowerCase();
      const meta = res.getResultMetadata?.(), stufe = meta?.get?.(Z.ResultMetadataType.ERROR_CORRECTION_LEVEL);
      return [{ text: res.getText(), format: fmt, stufe: stufe ? String(stufe) : undefined }];
    } catch { r.reset?.(); }
  }
  return [];
}

/** Kamera starten (Rückkamera). Wirft mit verständlicher Meldung, wenn es nicht geht. */
export async function kamera(video) {
  if (!globalThis.isSecureContext) throw new Error("Die Kamera geht nur über HTTPS (z. B. www.caelum.one/analyse). Hier: Bild wählen oder Text einfügen.");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Dieser Browser gibt keinen Zugriff auf die Kamera.");
  const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  video.srcObject = s; video.setAttribute("playsinline", ""); await video.play();
  return () => s.getTracks().forEach(t => t.stop());
}
