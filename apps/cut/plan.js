// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Cut · Web-Fassung der Regeln, MASTER ist die App: Options (Stufen, Profil), Jobs.Canvas (Bildfläche), Jobs.TargetKbps
// (Zielgrösse), Jobs.Render (Bildrate, kleineres Bild bei wenig Daten), Profiles.LengthWarning, Store.Time.
// Dazu nur im Web: Der Browser-Encoder kennt kein CRF. Er bekommt einen festen QP je Bild („quantizer“, CRF + Versatz aus
// profile.json → kalibrierung.qpVersatz, gemessen 19.11.2026), sonst als Rückfall eine Bitrate aus Bit je Bildpunkt
// (gemessen an echten Videos). Keyframe alle 250 Bilder wie x264/x265 in der App.
// Reine Logik ohne DOM – web/test/gleich.mjs prüft sie gegen 160 Referenzfälle der App.

/** C# Math.Round (bei .5 zur geraden Zahl). */
function rundeGerade(x) { const f = Math.floor(x), d = x - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); }
export const even = v => Math.max(2, rundeGerade(v / 2) * 2);
/** Ffmpeg.N: Zahl wie „0.###“. */
export const n3 = v => String(Math.round(v * 1000) / 1000);
/** Store.Time: „m:ss.z“ bzw. „h:mm:ss“. */
export function zeit(sec) {
  if (!(sec >= 0)) sec = 0;
  const ms = Math.round(sec * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60, z = Math.floor((ms % 1000) / 100);
  return h >= 1 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${Math.floor(ms / 60000)}:${String(s).padStart(2, "0")}.${z}`;
}

/** Einstellungen wie Options in Jobs.cs. o = { stufe, form, profil (Objekt aus profile.json oder null), quer, zielMB, fuellen }. */
export function optionen(o, daten) {
  const p = o.profil || null, st = daten.stufen[o.stufe || "Handy"];
  return {
    p, quer: !!o.quer, form: o.form || "Original", fuellen: !!o.fuellen,
    maxFps: p ? p.fps : st.maxFps,
    hevc: p ? p.hevc : st.hevc,
    langeSeite: p ? Math.max(p.w, p.h) : st.langeSeite,
    crf: p ? p.crf : st.crf,
    tonKbps: p ? p.tonKbps : st.tonKbps,
    ziel: p ? p.maxMB != null : st.ziel,
    zielMB: p?.maxMB ?? o.zielMB ?? 16,
    text: p ? p.name + (o.quer ? " quer" : "") : st.text,
  };
}

export class PlanFehler extends Error {}

/** Jobs.TargetKbps: Videobitrate für die Zielgrösse; wirft, wenn sie für die Länge nicht reicht. */
export function zielKbps(op, total, ton) {
  const bits = op.zielMB * 1024 * 1024 * 8 * 0.97;
  const kbps = Math.trunc(bits / total / 1000) - (ton ? op.tonKbps : 0);
  if (kbps < 150) throw new PlanFehler(`${n3(op.zielMB)} MB sind für ${zeit(total)} zu wenig. Mindestens ${Math.ceil((150 + (ton ? 128 : 0)) * 1000 * total / 8 / 1024 / 1024 / 0.97)} MB wählen.`);
  return kbps;
}

/** Jobs.Canvas: gemeinsame Bildfläche. */
export function flaeche(firstW, firstH, op, langeSeite) {
  if (op.p) {
    const pw = op.quer ? op.p.h : op.p.w, ph = op.quer ? op.p.w : op.p.h, k = Math.min(1, langeSeite / Math.max(pw, ph));
    return [even(pw * k), even(ph * k)];
  }
  const kurz = even(langeSeite * 9 / 16);
  if (op.form === "Hochkant") return [kurz, even(langeSeite)];
  if (op.form === "Quer") return [even(langeSeite), kurz];
  if (firstW <= 0 || firstH <= 0) return [kurz, even(langeSeite)];
  const s = Math.min(1, langeSeite / Math.max(firstW, firstH));
  return [even(firstW * s), even(firstH * s)];
}

/** Profiles.LengthWarning */
export function laengeWarnung(p, sek) {
  return p?.maxSekunden != null && sek > p.maxSekunden + 0.05 ? `${p.name} erlaubt bis ${zeit(p.maxSekunden)}, das Video ist ${zeit(sek)} lang.` : null;
}

const qpGrenze = q => Math.min(51, Math.max(10, Math.round(q)));

/** Bit je Bildpunkt für Codec + CRF aus der Kalibrierung der App; fehlt die Stufe: +6 CRF ≈ halbe Datenmenge. */
export function bitJePunkt(kalib, hevc, crf) {
  const art = hevc ? "hevc" : "h264";
  if (kalib[`${art}_${crf}`] != null) return kalib[`${art}_${crf}`];
  const da = Object.entries(kalib).filter(([k]) => k.startsWith(art + "_")).map(([k, v]) => [+k.split("_")[1], v]);
  if (!da.length) return hevc ? 0.04 : 0.07;
  const [c0, v0] = da.reduce((a, b) => Math.abs(b[0] - crf) < Math.abs(a[0] - crf) ? b : a);
  return v0 * Math.pow(2, -(crf - c0) / 6);
}

/**
 * Plan eines Exports wie Jobs.Render vor ffmpeg. clips = [{ w, h, fps, dauer (geschnitten), ton }].
 * Ergebnis: { w, h, fps, hevc, crf, tonKbps, zielKbps, warnung, ton, total, videoKbps (Web), groesseMB (Schätzung) }.
 */
export function planen(o, clips, daten) {
  if (!clips.length) throw new PlanFehler("Keine Videos in der Liste.");
  const op = optionen(o, daten);
  const total = clips.reduce((s, c) => s + c.dauer, 0);
  const fpsMax = Math.max(...clips.map(c => c.fps || 0));
  const fps = fpsMax <= 1 ? op.maxFps : Math.min(op.maxFps, fpsMax);
  const ton = clips.some(c => c.ton);
  let lang = op.langeSeite, kbps = null;
  if (op.ziel) { kbps = zielKbps(op, total, ton); lang = Math.min(lang, kbps < 700 ? 854 : kbps < 1800 ? 1280 : 1920); }
  const [w, h] = flaeche(clips[0].w, clips[0].h, op, lang);
  const hevc = op.ziel ? false : op.hevc;                                   // Zielgrösse immer H.264 (wie Encode)
  const videoKbps = kbps ?? Math.max(150, Math.round(bitJePunkt(daten.kalibrierung, hevc, op.crf) * w * h * fps / 1000));
  const qv = daten.kalibrierung?.qpVersatz;
  const qp = kbps == null && qv ? { avc: qpGrenze((hevc ? op.crf - 4 : op.crf) + qv.avc) } : null;   // H.265: siehe kodieren.js hevcVorbereiten
  return {
    w, h, fps, hevc, crf: op.crf, tonKbps: op.tonKbps, zielKbps: kbps, warnung: laengeWarnung(op.p, total), ton, total, text: op.text,
    fuellen: op.fuellen, videoKbps, qp, gopSek: 250 / fps,
    groesseMB: (videoKbps + (ton ? op.tonKbps : 0)) * 1000 * total / 8 / 1024 / 1024 / 0.97,   // grob; genau: kodieren.js schaetzen()
  };
}
