// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Cut · Kodieren im Browser mit WebCodecs (Video-Encoder des Browsers, meist mit Grafikkarte). Ablauf wie Jobs.Render:
// Clips mit Von/Bis → gemeinsame Fläche (Einpassen = schwarze Balken, Füllen = Ränder abschneiden), Bildrate ≤ Profil,
// fehlender Ton = Stille, aneinandergereiht → H.264 (oder H.265 „hvc1“) + AAC (sonst Opus) in MP4 mit faststart.
// Lesen: mp4box.js (BSD-3), Schreiben: mp4-muxer (MIT). Ton: decodeAudioData des Browsers (rechnet gleich auf 48 kHz um).
import MP4Box, { DataStream } from "./vendor/mp4box.mjs";
import { Muxer, ArrayBufferTarget } from "./vendor/mp4-muxer.mjs";

export class KodierFehler extends Error {}

/** Was dieser Browser kann (vor dem Start anzeigen). */
export function kannKodieren() {
  return typeof VideoEncoder !== "undefined" && typeof VideoDecoder !== "undefined" && typeof VideoFrame !== "undefined" && typeof OffscreenCanvas !== "undefined";
}

// ───────────────────────── MP4 lesen ─────────────────────────

function beschreibung(trak) {
  for (const e of trak.mdia.minf.stbl.stsd.entries) {
    const box = e.avcC || e.hvcC || e.vpcC || e.av1C;
    if (box) { const s = new DataStream(undefined, 0, DataStream.BIG_ENDIAN); box.write(s); return new Uint8Array(s.buffer, 8); }
  }
  return undefined;
}

/** MP4/MOV lesen: Videospur (Konfiguration, Proben, Drehung), Dauer, Ton vorhanden? */
export async function lesen(datei) {
  const buf = await datei.arrayBuffer();
  const mp4 = MP4Box.createFile();
  let info = null, fehler = null;
  const proben = new Map();
  mp4.onError = e => { fehler = e; };
  mp4.onReady = i => {
    info = i;
    const v = i.videoTracks[0];
    if (v) { mp4.setExtractionOptions(v.id, null, { nbSamples: 1e9 }); proben.set(v.id, []); }
    mp4.start();
  };
  mp4.onSamples = (id, _u, s) => { const l = proben.get(id); for (const x of s) l.push(x); };
  const ab = buf.slice(0); ab.fileStart = 0;
  mp4.appendBuffer(ab); mp4.flush();
  if (fehler || !info) throw new KodierFehler(`${datei.name}: keine lesbare MP4/MOV-Datei.`);
  const v = info.videoTracks[0];
  if (!v) throw new KodierFehler(`${datei.name} hat kein Bild – Tondateien gehören in den Editor der App.`);
  const m = v.matrix || [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824];
  const drehung = ((Math.round(Math.atan2(m[1], m[0]) * 180 / Math.PI) % 360) + 360) % 360;   // 0, 90, 180, 270
  const breit = v.video?.width || v.track_width, hoch = v.video?.height || v.track_height;
  const quer = drehung === 90 || drehung === 270;
  const dauer = v.duration / v.timescale || info.duration / info.timescale;
  const anzahl = v.nb_samples || proben.get(v.id).length;
  return {
    name: datei.name, datei, buf, groesse: buf.byteLength,
    breite: quer ? hoch : breit, hoehe: quer ? breit : hoch, drehung, dauer,
    fps: anzahl > 1 && dauer > 0 ? anzahl / dauer : 30, ton: info.audioTracks.length > 0,
    hdr: /hvc1\.2|hev1\.2|vp09\.02|av01\.\d\.\d\dM\.10/.test(v.codec),
    video: {
      config: { codec: v.codec.startsWith("avc3") ? v.codec.replace("avc3", "avc1") : v.codec, codedWidth: breit, codedHeight: hoch, description: beschreibung(mp4.getTrackById(v.id)) },
      proben: proben.get(v.id), timescale: v.timescale, t0: erstesBild(proben.get(v.id)),
    },
  };
}

// Videos mit B-Bildern (x264, Handy-HEVC) zeigen das erste Bild erst bei cts = 1–2 Bildern (Composition-Offset, sonst per
// Edit-Liste ausgeglichen). ffmpeg und Player beginnen dort bei 0 – ohne Abzug lag das Web-Ergebnis 2 Bilder zu spät
// (Bild 0 dreifach, SSIM 0,92 statt 0,97; 19.11.2026). Zeiten darum immer ab dem ersten angezeigten Bild.
function erstesBild(pr) {
  let t = Infinity;
  for (const p of pr) if (p.cts < t) t = p.cts;
  return Number.isFinite(t) ? t : 0;
}

// ───────────────────────── Encoder wählen ─────────────────────────

export async function videoKonfig(plan, notizen) {
  const gross = plan.w * plan.h > 1920 * 1088;
  const basis = { width: plan.w, height: plan.h, bitrate: plan.videoKbps * 1000, bitrateMode: "variable", framerate: plan.fps, latencyMode: "quality" };
  const kandidaten = [];
  if (plan.hevc) kandidaten.push({ ...basis, codec: gross ? "hvc1.1.6.L153.B0" : "hvc1.1.6.L123.B0", hevc: { format: "hevc" }, art: "hevc" });
  kandidaten.push({ ...basis, codec: gross ? "avc1.640033" : "avc1.640028", avc: { format: "avc" }, art: "avc" });
  kandidaten.push({ ...basis, codec: gross ? "avc1.4d0033" : "avc1.4d0028", avc: { format: "avc" }, art: "avc" });
  // Zuerst „quantizer“ (fester QP je Bild, wie CRF in der App: die Datenmenge folgt dem Inhalt), sonst feste Bitrate.
  for (const mitQp of plan.qp ? [true, false] : [false])
    for (const k of kandidaten) {
      const { art, ...cfg } = k;
      if (mitQp && art === "hevc") continue;   // H.265 + quantizer: Chrome meldet „geht“, hält den QP aber nicht (19.11.2026) – siehe hevcMitMessung
      if (mitQp) { cfg.bitrateMode = "quantizer"; delete cfg.bitrate; }
      try {
        const r = await VideoEncoder.isConfigSupported(cfg);
        if (r.supported) {
          if (plan.hevc && art === "avc") {
            // H.265 kann dieser Browser nicht kodieren: H.264 mit mehr Daten (Faustregel aus der App: x265-CRF ≈ x264-CRF + 4)
            if (cfg.bitrate) cfg.bitrate = Math.round(cfg.bitrate * 1.75);
            notizen.push("Dieser Browser kodiert kein H.265 – es wird H.264 (etwas grösser). Die App kann H.265.");
          }
          if (!mitQp && plan.qp) notizen.push("Dieser Browser kodiert nur mit fester Bitrate – die Grösse ist dann nur grob geschätzt.");
          return { cfg, art, qp: mitQp ? plan.qp[art] : null };
        }
      } catch { /* nächster Versuch */ }
    }
  throw new KodierFehler(`Dieser Browser kann kein ${plan.w}×${plan.h}-Video kodieren. Bitte Chrome oder Edge nehmen – oder die App.`);
}

export async function tonKonfig(plan, notizen) {
  if (typeof AudioEncoder === "undefined") { notizen.push("Dieser Browser kodiert keinen Ton – das Video bleibt stumm."); return null; }
  for (const [codec, art] of [["mp4a.40.2", "aac"], ["opus", "opus"]]) {
    const cfg = { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: plan.tonKbps * 1000 };
    try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) { if (art === "opus") notizen.push("Ton als Opus (dieser Browser kodiert kein AAC)."); return { cfg, art }; } } catch { /* weiter */ }
  }
  notizen.push("Dieser Browser kodiert keinen Ton – das Video bleibt stumm.");
  return null;
}

// ───────────────────────── Ton: dekodieren, schneiden, 48 kHz Stereo ─────────────────────────

async function tonLesen(clip, von, bis) {
  const n = Math.max(1, Math.round((bis - von) * 48000));
  const links = new Float32Array(n), rechts = new Float32Array(n);
  if (clip.ton) {
    try {
      const ctx = new OfflineAudioContext(2, 48000, 48000);
      const ab = await ctx.decodeAudioData(clip.buf.slice(0));           // rechnet auf 48 kHz um
      const a = Math.round(von * 48000), l = ab.getChannelData(0), r = ab.numberOfChannels > 1 ? ab.getChannelData(1) : l;
      links.set(l.subarray(a, Math.min(l.length, a + n))); rechts.set(r.subarray(a, Math.min(r.length, a + n)));
    } catch { /* Ton nicht lesbar → Stille, wie anullsrc */ }
  }
  return [links, rechts];
}

// ───────────────────────── Bild auf die Fläche bringen ─────────────────────────

function zeichnen(g, frame, clip, w, h, fuellen) {
  const quer = clip.drehung === 90 || clip.drehung === 270;
  const sw = clip.breite, sh = clip.hoehe;                                   // Anzeigegrösse (Drehung berücksichtigt)
  const k = fuellen ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
  const dw = sw * k, dh = sh * k;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  g.translate(w / 2, h / 2);
  g.rotate(clip.drehung * Math.PI / 180);
  const [bw, bh] = quer ? [dh, dw] : [dw, dh];
  g.drawImage(frame, -bw / 2, -bh / 2, bw, bh);
}

// ───────────────────────── Ablauf ─────────────────────────

/**
 * teile = [{ clip (aus lesen()), von, bis }], plan aus planen(). melde(anteil 0..1, text), signal = AbortSignal.
 * Ergebnis: { blob, art, notizen }.
 */
export async function kodieren(teile, plan, melde = () => {}, signal) {
  if (!kannKodieren()) throw new KodierFehler("Dieser Browser kann kein WebCodecs (Video-Encoder). Bitte Chrome, Edge oder ein aktuelles Safari nehmen – oder die App.");
  if (await hevcMitMessung(plan)) {
    melde(0, "Bild wird vermessen …");
    const m = await messen(teile, { ...plan, hevc: false }, signal);
    plan = { ...plan, qp: null, videoKbps: Math.max(150, Math.round(m.video * 8 / plan.total / 1000 * HEVC_ANTEIL)) };
  }
  const notizen = [];
  const v = await videoKonfig(plan, notizen);
  const t = plan.ton ? await tonKonfig(plan, notizen) : null;
  const ziel = new ArrayBufferTarget();
  const muxer = new Muxer({
    target: ziel, fastStart: "in-memory", firstTimestampBehavior: "offset",
    video: { codec: v.art, width: plan.w, height: plan.h, frameRate: plan.fps },
    ...(t ? { audio: { codec: t.art, numberOfChannels: 2, sampleRate: 48000 } } : {}),
  });
  let encFehler = null;
  const stat = { keyBytes: 0, keys: 0, otherBytes: 0, frames: 0, audioBytes: 0 };   // für schaetzen()
  const enc = new VideoEncoder({
    output: (c, m) => { muxer.addVideoChunk(c, m); stat.frames++; if (c.type === "key") { stat.keyBytes += c.byteLength; stat.keys++; } else stat.otherBytes += c.byteLength; },
    error: e => { encFehler = e; },
  });
  enc.configure(v.cfg);
  const qp = v.cfg.bitrateMode === "quantizer" ? v.qp : null;             // wie CRF: Datenmenge folgt dem Inhalt
  const qOpt = qp == null ? {} : v.art === "hevc" ? { hevc: { quantizer: qp } } : { avc: { quantizer: qp } };
  const aenc = t ? new AudioEncoder({ output: (c, m) => { muxer.addAudioChunk(c, m); stat.audioBytes += c.byteLength; }, error: e => { encFehler = e; } }) : null;
  if (aenc) aenc.configure(t.cfg);

  const leinwand = new OffscreenCanvas(plan.w, plan.h), g = leinwand.getContext("2d", { alpha: false });
  const schritt = 1e6 / plan.fps, gop = Math.max(1, Math.round(plan.fps * (plan.gopSek ?? 2)));
  let bildNr = 0, offset = 0;                                               // Ausgabe-Bildnummer, Startzeit des Clips (µs)
  const prueft = () => { if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError"); if (encFehler) throw encFehler; };
  const warte = async () => { while (enc.encodeQueueSize > 6 || (aenc && aenc.encodeQueueSize > 12)) { prueft(); await new Promise(r => setTimeout(r, 4)); } };

  for (let ti = 0; ti < teile.length; ti++) {
    const { clip, von, bis } = teile[ti];
    const laenge = bis - von, ende = offset + laenge * 1e6;
    melde(offset / 1e6 / plan.total, `Clip ${ti + 1}/${teile.length}: ${clip.name}`);
    // Video: ab dem letzten Schlüsselbild vor „Von“ dekodieren, Bilder ausserhalb Von/Bis verwerfen, Bildrate begrenzen
    const pr = clip.video.proben, ts = clip.video.timescale;
    let start = 0;
    const t0 = clip.video.t0 ?? 0, sekVon = p => (p.cts - t0) / ts;
    for (let i = 0; i < pr.length; i++) { if (sekVon(pr[i]) > von + 1e-6) break; if (pr[i].is_sync) start = i; }
    // Der Decoder hat nur wenige Bildpuffer: jedes Bild sofort verarbeiten und freigeben (sonst warten Decoder und Ablauf
    // aufeinander). Die Bilder kommen in Anzeigereihenfolge; die Kette arbeitet sie nacheinander ab.
    let decFehler = null, kette = Promise.resolve(), offen = 0;
    const bild = async f => {
      try {
        const sek = f.timestamp / 1e6;
        if (sek >= von - 1e-4 && sek < bis - 1e-4) {
          const tOut = offset + (sek - von) * 1e6;
          while (bildNr * schritt <= tOut + schritt / 2 && bildNr * schritt < ende - 1) {
            zeichnen(g, f, clip, plan.w, plan.h, plan.fuellen);
            const vf = new VideoFrame(leinwand, { timestamp: Math.round(bildNr * schritt), duration: Math.round(schritt) });
            await warte();
            enc.encode(vf, { keyFrame: bildNr % gop === 0, ...qOpt });
            vf.close(); bildNr++;
          }
          melde(Math.min(0.98, tOut / 1e6 / plan.total), `Clip ${ti + 1}/${teile.length}: ${clip.name}`);
        }
      } finally { f.close(); offen--; }
    };
    const dec = new VideoDecoder({
      output: f => { offen++; kette = kette.then(() => bild(f)).catch(e => { decFehler = decFehler || e; }); },
      error: e => { decFehler = e; },
    });
    dec.configure(clip.video.config);
    for (let i = start; i < pr.length; i++) {
      const p = pr[i];
      if (sekVon(p) > bis + 1) break;                                      // B-Bilder: etwas Vorlauf über „Bis“ hinaus
      prueft(); if (decFehler) throw new KodierFehler(`${clip.name}: Bild nicht dekodierbar (${decFehler.message}).`);
      dec.decode(new EncodedVideoChunk({ type: p.is_sync ? "key" : "delta", timestamp: Math.round(sekVon(p) * 1e6), duration: Math.round(p.duration / ts * 1e6), data: p.data }));
      while (dec.decodeQueueSize > 6 || offen > 3) { prueft(); await new Promise(r => setTimeout(r, 2)); }
    }
    await dec.flush(); await kette; dec.close();
    if (decFehler) throw (decFehler instanceof DOMException && decFehler.name === "AbortError") ? decFehler : new KodierFehler(`${clip.name}: Bild nicht dekodierbar (${decFehler.message}).`);
    // Ton: geschnitten, 48 kHz Stereo, fehlender Ton = Stille
    if (aenc) {
      const [l, r] = await tonLesen(clip, von, bis);
      const block = 4800;
      for (let a = 0; a < l.length; a += block) {
        prueft();
        const n = Math.min(block, l.length - a), data = new Float32Array(n * 2);
        data.set(l.subarray(a, a + n), 0); data.set(r.subarray(a, a + n), n);
        const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(offset + a / 48000 * 1e6), data });
        await warte(); aenc.encode(ad); ad.close();
      }
    }
    offset = ende;
  }
  melde(0.99, "Wird abgeschlossen …");
  await enc.flush(); if (aenc) await aenc.flush();
  prueft();
  muxer.finalize();
  enc.close(); aenc?.close();
  return { blob: new Blob([ziel.buffer], { type: "video/mp4" }), art: v.art, notizen, stat, quantizer: qp != null };
}

/**
 * Grösse vorab schätzen wie Jobs.Estimate der App: Teile bis 30 s ganz kodieren, längere mit 3–6 Probestücken à 4 s
 * (eines je 10 s), Keyframes getrennt hochrechnen (einer je Keyframe-Abstand), Ton messen. Höchstens 12 Probestücke,
 * weitere Teile nach Durchschnitt. Ergebnis in Bytes. Gemessen 19.11.2026: App ±4 %.
 */
export async function schaetzen(teile, plan, signal) {
  if (await hevcMitMessung(plan)) { const m = await messen(teile, { ...plan, hevc: false }, signal); return (m.video * HEVC_ANTEIL + m.ton) * 1.005; }
  const m = await messen(teile, plan, signal);
  return (m.video + m.ton) * 1.005;                                          // MP4-Verwaltung
}

/** H.265 ohne brauchbaren „quantizer“: erst mit H.264-QP messen, dann H.265 mit diesem Anteil der Bitrate (App: x265 ≈ 57 %). */
const HEVC_ANTEIL = 0.6;
async function hevcMitMessung(plan) {
  if (!plan.hevc || !plan.qp || typeof VideoEncoder === "undefined") return false;
  const gross = plan.w * plan.h > 1920 * 1088;
  try {
    const r = await VideoEncoder.isConfigSupported({ codec: gross ? "hvc1.1.6.L153.B0" : "hvc1.1.6.L123.B0", width: plan.w, height: plan.h, bitrate: 1e6, bitrateMode: "variable", framerate: plan.fps, hevc: { format: "hevc" } });
    return !!r.supported;
  } catch { return false; }
}

/** Probestücke kodieren und hochrechnen → { video, ton } in Bytes (ohne MP4-Verwaltung). */
async function messen(teile, plan, signal) {
  const gopBilder = Math.max(1, Math.round(plan.fps * (plan.gopSek ?? 2)));
  let video = 0, tonAlle = 0, gesehen = 0, rest = 0, frei = 12;
  for (let i = 0; i < teile.length; i++) {
    const { clip, von, bis } = teile[i], laenge = bis - von;
    if (frei <= 0) { rest += laenge; continue; }
    const ganz = laenge <= 30;
    let n = ganz ? 1 : Math.min(6, Math.max(3, Math.ceil(laenge / 10)));
    n = Math.min(n, Math.max(1, Math.floor(frei / Math.max(1, teile.length - i)))); frei -= n;
    const s = ganz ? laenge : Math.min(4, laenge / n);
    let other = 0, keySum = 0, keys = 0, frames = 0, ton = 0, probeSek = 0;
    for (let k = 0; k < n; k++) {
      const a = von + Math.min(Math.max(0, laenge * (k + 0.5) / n - s / 2), laenge - s);
      const r = await kodieren([{ clip, von: a, bis: a + s }], { ...plan, total: s }, () => {}, signal);
      other += r.stat.otherBytes; keySum += r.stat.keyBytes; keys += r.stat.keys; frames += r.stat.frames; ton += r.stat.audioBytes; probeSek += s;
    }
    const fps = frames > 0 ? frames / probeSek : plan.fps;
    const keyAnzahl = laenge * fps / gopBilder + 1;                          // der Web-Kodierer setzt sie fest (kein Szenenwechsel)
    video += other / probeSek * laenge + (keys ? keySum / keys : 0) * keyAnzahl;
    tonAlle += ton / probeSek * laenge; gesehen += laenge;
  }
  if (rest > 0 && gesehen > 0) { video += video / gesehen * rest; tonAlle += tonAlle / gesehen * rest; }
  return { video, ton: tonAlle };
}
