// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Cut · Web-Editor: Projekt als MP4 ausgeben (wie TimelineRender.Export der App, mit Browser-Mitteln).
// Bild: je Element ein Decoder-Strom (WebCodecs) – Bilder kommen in Anzeigereihenfolge und werden freigegeben, sobald das
// nächste da ist; je Ausgabebild setzt bild.js die Fläche zusammen. Gedrehte Handy-Videos werden vorher aufrecht gestellt.
// Ton: OfflineAudioContext mischt alle Quellen (Lautstärke Element × Spur, Blenden, Übergänge, Gesamt, auf Wunsch angeglichen
// auf etwa −16 LUFS). Kodieren wie kodieren.js (gleiche Encoder-Wahl, QP/Bitrate aus plan.js), MP4 mit faststart.
// Teile mit derselben Versionsangabe wie dieses Modul laden (sonst doppelte Modul-Kopien, siehe bild.js)
const V = new URL(import.meta.url).search;
const { Muxer, ArrayBufferTarget } = await import("../vendor/mp4-muxer.mjs");
const { videoKonfig, tonKonfig, KodierFehler, kannKodieren } = await import("../kodieren.js" + V);
const { planen } = await import("../plan.js" + V);
const { dauer, vonUnten, istText, istBild, istFarbe, ext, laenge, flaecheVon } = await import("./projekt.js" + V);
const { zeichnen, gebraucht } = await import("./bild.js" + V);

/** Bilder eines Videos ab einer Quellzeit, in Anzeigereihenfolge; bei(sek) = letztes Bild mit Zeit ≤ sek. */
class Strom {
  constructor(clip, abSek) {
    this.clip = clip; this.fertig = false; this.liste = []; this.fehler = null; this.warten = null;
    const pr = clip.video.proben, ts = clip.video.timescale, t0 = clip.video.t0 ?? 0;
    this.sek = p => (p.cts - t0) / ts;
    let start = 0;
    for (let i = 0; i < pr.length; i++) { if (this.sek(pr[i]) > abSek + 1e-6) break; if (pr[i].is_sync) start = i; }
    this.i = start;
    this.dec = new VideoDecoder({
      output: f => { this.liste.push(f); this.warten?.(); },
      error: e => { this.fehler = e; this.warten?.(); },
    });
    this.dec.configure(clip.video.config);
  }
  async mehr() {
    const pr = this.clip.video.proben, ts = this.clip.video.timescale;
    if (this.i >= pr.length) { if (!this.fertig) { await this.dec.flush().catch(e => { this.fehler = e; }); this.fertig = true; } return; }
    while (this.i < pr.length && this.dec.decodeQueueSize < 6) {
      const p = pr[this.i++];
      this.dec.decode(new EncodedVideoChunk({ type: p.is_sync ? "key" : "delta", timestamp: Math.round(this.sek(p) * 1e6), duration: Math.round(p.duration / ts * 1e6), data: p.data }));
    }
    await new Promise(r => { this.warten = r; setTimeout(r, 15); });
    this.warten = null;
  }
  /** Bild zur Quellzeit sek (ältere werden freigegeben). */
  async bei(sek) {
    for (let runde = 0; ; runde++) {
      if (this.fehler) throw new KodierFehler(`${this.clip.name}: Bild nicht dekodierbar (${this.fehler.message}).`);
      while (this.liste.length > 1 && this.liste[1].timestamp / 1e6 <= sek + 1e-4) this.liste.shift().close();
      const letzt = this.liste[this.liste.length - 1];
      if (this.liste.length && (letzt.timestamp / 1e6 > sek + 1e-4 || this.fertig)) return this.liste[0];
      if (this.fertig) return this.liste[0] ?? null;
      if (runde > 4000) throw new KodierFehler(`${this.clip.name}: Decoder antwortet nicht.`);
      await this.mehr();
    }
  }
  schliessen() { for (const f of this.liste) f.close(); this.liste = []; try { this.dec.close(); } catch { /* schon zu */ } }
}

/** Decoder-Bild aufrecht in Anzeigegröße (Handy-Videos haben eine Drehung in der Datei). */
function aufrecht(frame, clip, leinwaende) {
  if (!clip.drehung) return frame;
  let c = leinwaende.get(clip);
  if (!c) { c = new OffscreenCanvas(clip.breite, clip.hoehe); leinwaende.set(clip, c); }
  const g = c.getContext("2d"), quer = clip.drehung === 90 || clip.drehung === 270;
  g.setTransform(1, 0, 0, 1, 0, 0); g.translate(clip.breite / 2, clip.hoehe / 2); g.rotate(clip.drehung * Math.PI / 180);
  const [bw, bh] = quer ? [clip.hoehe, clip.breite] : [clip.breite, clip.hoehe];
  g.drawImage(frame, -bw / 2, -bh / 2, bw, bh);
  return c;
}

/** Ton mischen: Element × Spur, Blenden (auch in Übergängen), Tempo, Gesamt, auf Wunsch angleichen. → [links, rechts] 48 kHz. */
async function tonMischen(p, gesamt, tonDaten, signal) {
  const n = Math.max(1, Math.ceil(gesamt * 48000));
  const ctx = new OfflineAudioContext(2, n, 48000);
  const master = ctx.createGain(); master.gain.value = Math.min(2, Math.max(0, p.MasterVolume ?? 1)); master.connect(ctx.destination);
  let quellen = 0;
  const legen = async (it, spurVol, start, len, fadeIn, fadeOut) => {
    const vol = Math.min(2, Math.max(0, it.Volume)) * Math.min(2, Math.max(0, spurVol));
    if (vol <= 0.001 || len <= 0.02 || !it.datei) return;
    const buf = await tonDaten(it.datei); if (!buf || signal?.aborted) return;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const speed = Math.min(4, Math.max(0.25, it.Speed)); src.playbackRate.value = speed;
    const gn = ctx.createGain(), gv = gn.gain;
    gv.setValueAtTime(fadeIn > 0.01 ? 0 : vol, start);
    if (fadeIn > 0.01) gv.linearRampToValueAtTime(vol, start + Math.min(fadeIn, len));
    if (fadeOut > 0.01) { gv.setValueAtTime(vol, Math.max(start, start + len - fadeOut)); gv.linearRampToValueAtTime(0, start + len); }
    src.connect(gn).connect(master);
    src.start(start, it.In, Math.min(len * speed, Math.max(0, buf.duration - it.In)));
    quellen++;
  };
  for (const s of vonUnten(p, "Video")) {
    if (s.Muted) continue;
    const items = s.Items.filter(i => !istText(i) && i.info?.ton && !istBild(i)).sort((a, b) => a.Start - b.Start);
    const alle = s.Items.filter(i => istFarbe(i) || !istText(i) && i.info).sort((a, b) => a.Start - b.Start);
    for (const it of items) {
      const k = alle.indexOf(it), e = ext(alle, k), din = k > 0 ? ext(alle, k - 1) : 0;
      await legen(it, s.Volume ?? 1, it.Start, laenge(it) + e, Math.max(it.FadeIn, din), e > 0 ? e : it.FadeOut);
    }
  }
  for (const s of p.Tracks.filter(t => t.Kind === "Audio" && !t.Muted))
    for (const it of s.Items.filter(i => !istText(i) && i.info?.ton)) await legen(it, s.Volume ?? 1, it.Start, laenge(it), it.FadeIn, it.FadeOut);
  const ab = await ctx.startRendering();
  let l = ab.getChannelData(0), r = ab.getChannelData(1);
  if (p.Normalize && quellen > 0) {
    // Lautheit grob angleichen: Ziel etwa −16 LUFS ≈ RMS −18 dBFS bei Musik/Sprache, dann weicher Begrenzer bei 0,95
    let sum = 0; for (let i = 0; i < l.length; i++) sum += l[i] * l[i] + r[i] * r[i];
    const rms = Math.sqrt(sum / (2 * l.length)) || 1e-9, k = Math.min(20, Math.pow(10, -18 / 20) / rms);
    l = l.map(x => x * k); r = r.map(x => x * k);
  }
  const grenze = x => Math.abs(x) <= 0.9 ? x : Math.sign(x) * (0.9 + 0.05 * Math.tanh((Math.abs(x) - 0.9) / 0.05));
  return [l.map(grenze), r.map(grenze)];
}

/**
 * Projekt ausgeben. holeClip(it) → Clip aus kodieren.lesen() (für Videos), holeBild(it) → ImageBitmap (für Bilder),
 * tonDaten(datei) → AudioBuffer (48 kHz). melde(anteil, text). Ergebnis { blob, art, notizen, w, h }.
 */
export async function exportieren(p, daten, { holeClip, holeBild, tonDaten }, melde = () => {}, signal) {
  if (!kannKodieren()) throw new KodierFehler("Dieser Browser kann kein WebCodecs (Video-Encoder). Bitte Chrome, Edge oder ein aktuelles Safari nehmen – oder die App.");
  const gesamt = dauer(p);
  if (gesamt < 0.1) throw new KodierFehler("Die Zeitleiste ist leer.");
  const profil = daten.profile.find(x => x.id === p.ProfileId) ?? null;
  const videos = p.Tracks.flatMap(t => t.Items).filter(i => !istText(i) && i.info);
  const ton = videos.some(i => i.info.ton);
  const [w0, h0] = flaecheVon(p, daten);
  const plan = planen({ profil, quer: p.Landscape, form: "Original", fuellen: p.Fit === "Fuellen" },
    [{ w: w0, h: h0, fps: videos.length ? Math.max(1, ...videos.map(i => i.info.fps || 30)) : 30, dauer: gesamt, ton }], daten);
  // Fläche wie flaecheVon (Profil); bei Zielgrösse kann planen kleiner gehen – dann diese nehmen
  if (plan.zielKbps == null) { plan.w = w0; plan.h = h0; }
  // H.265: Der Browser hält einen festen QP nicht (19.11.2026) – darum Bitrate aus der Kalibrierung der App
  if (plan.hevc) plan.qp = null;
  const notizen = [];
  const v = await videoKonfig(plan, notizen);
  const t = ton ? await tonKonfig(plan, notizen) : null;
  const ziel = new ArrayBufferTarget();
  const muxer = new Muxer({
    target: ziel, fastStart: "in-memory", firstTimestampBehavior: "offset",
    video: { codec: v.art, width: plan.w, height: plan.h, frameRate: plan.fps },
    ...(t ? { audio: { codec: t.art, numberOfChannels: 2, sampleRate: 48000 } } : {}),
  });
  let encFehler = null;
  const enc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { encFehler = e; } });
  enc.configure(v.cfg);
  const qOpt = v.cfg.bitrateMode === "quantizer" && v.qp != null ? (v.art === "hevc" ? { hevc: { quantizer: v.qp } } : { avc: { quantizer: v.qp } }) : {};
  const aenc = t ? new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => { encFehler = e; } }) : null;
  if (aenc) aenc.configure(t.cfg);
  const pruefen = () => { if (signal?.aborted) throw new DOMException("Abgebrochen", "AbortError"); if (encFehler) throw encFehler; };
  const warte = async () => { while (enc.encodeQueueSize > 6 || (aenc && aenc.encodeQueueSize > 12)) { pruefen(); await new Promise(r => setTimeout(r, 4)); } };

  // Ton zuerst (geht schnell, zeigt Fehler früh)
  if (aenc) {
    melde(0, "Ton wird gemischt …");
    const [l, r] = await tonMischen(p, gesamt, tonDaten, signal);
    for (let a = 0; a < l.length; a += 4800) {
      pruefen();
      const n = Math.min(4800, l.length - a), d = new Float32Array(n * 2);
      d.set(l.subarray(a, a + n), 0); d.set(r.subarray(a, a + n), n);
      const ad = new AudioData({ format: "f32-planar", sampleRate: 48000, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(a / 48000 * 1e6), data: d });
      await warte(); aenc.encode(ad); ad.close();
    }
  }

  const leinwand = new OffscreenCanvas(plan.w, plan.h), g = leinwand.getContext("2d", { alpha: false });
  const stroeme = new Map(), bilder = new Map(), leinwaende = new Map();
  const schritt = 1e6 / plan.fps, gop = Math.max(1, Math.round(plan.fps * (plan.gopSek ?? 8))), anzahl = Math.max(1, Math.round(gesamt * plan.fps));
  try {
    for (let n = 0; n < anzahl; n++) {
      pruefen();
      const zeit = n / plan.fps, aktiv = gebraucht(p, zeit), jetzt = new Map();
      for (const { it, sek } of aktiv) {
        if (istBild(it)) {
          if (!bilder.has(it.datei)) bilder.set(it.datei, await holeBild(it));
          const b = bilder.get(it.datei); if (b) jetzt.set(it, { bild: b, w: b.width, h: b.height });
          continue;
        }
        let s = stroeme.get(it);
        if (!s) { const clip = await holeClip(it); s = new Strom(clip, sek); stroeme.set(it, s); }
        const f = await s.bei(sek);
        if (f) jetzt.set(it, { bild: aufrecht(f, s.clip, leinwaende), w: s.clip.breite, h: s.clip.hoehe });
      }
      // Ströme von Elementen, die vorbei sind, schließen (Speicher)
      for (const [it, s] of stroeme) if (!aktiv.some(a => a.it === it)) { s.schliessen(); stroeme.delete(it); }
      zeichnen(g, p, zeit, plan.w, plan.h, it => jetzt.get(it) ?? null);
      const vf = new VideoFrame(leinwand, { timestamp: Math.round(n * schritt), duration: Math.round(schritt) });
      await warte(); enc.encode(vf, { keyFrame: n % gop === 0, ...qOpt }); vf.close();
      if (n % 5 === 0) melde(0.05 + 0.93 * n / anzahl, `Bild ${n + 1} von ${anzahl}`);
    }
  } finally { for (const s of stroeme.values()) s.schliessen(); }
  melde(0.99, "Wird abgeschlossen …");
  await enc.flush(); if (aenc) await aenc.flush();
  pruefen();
  muxer.finalize(); enc.close(); aenc?.close();
  return { blob: new Blob([ziel.buffer], { type: "video/mp4" }), art: v.art, notizen, w: plan.w, h: plan.h, fps: plan.fps };
}
