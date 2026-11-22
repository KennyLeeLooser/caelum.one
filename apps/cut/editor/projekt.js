// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
// Caelum Cut · Web-Editor: Projektregeln, MASTER ist die App (Project.cs, TimelineRender.Ext/CanvasOf, Transitions.cs).
// Gleiche Feldnamen wie die .caelumcut-Datei der App (Tracks, Items, Start, In, Out …) – ein Projekt aus dem Web öffnet die App
// und umgekehrt (Pfade der App zeigen im Web auf nichts; dort hängen die Dateien am Element als „datei“). Ohne DOM,
// geprüft von web/test/gleich.mjs gegen web/test/faelle/editor.soll.json.
const { flaeche, optionen } = await import("../plan.js" + new URL(import.meta.url).search);   // gleiche Versionsangabe wie dieses Modul

export const ART = { Video: "Video", Audio: "Audio", Text: "Text" };

/** Neues Projekt wie Project.New(): T1, V2, V1, A1, A2. */
export function neuesProjekt() {
  return {
    Version: 1, ProfileId: "android", Landscape: false, Fit: "Einpassen", MasterVolume: 1, Normalize: false,
    Tracks: [spur("Text", "T1"), spur("Video", "V2"), spur("Video", "V1"), spur("Audio", "A1"), spur("Audio", "A2")],
  };
}
export const spur = (Kind, Name) => ({ Kind, Name, Hidden: false, Muted: false, Volume: 1, Items: [] });

let zaehler = 0;
export const neueId = () => (Date.now().toString(16).slice(-5) + (zaehler++).toString(16)).padStart(8, "0").slice(-8);

/** Element wie Item (Standardwerte aus Project.cs). */
export function element(werte = {}) {
  return {
    Id: neueId(), Path: null, Start: 0, In: 0, Out: 4, Speed: 1, Volume: 1, FadeIn: 0, FadeOut: 0, Opacity: 1, Scale: 1, X: 0.5, Y: 0.5,
    Brightness: 0, Contrast: 1, Saturation: 1, Gray: false, Blur: 0, CropL: 0, CropT: 0, CropR: 0, CropB: 0,
    Transition: "keine", TransitionSec: 0.6, Text: null, TextSize: 0.07, TextColor: "#FFFFFF", TextPos: "unten", TextBox: true,
    TextBoxColor: "#000000", TextBoxOpacity: 0.45, Fill: null,                   // 0.3.0: Hintergrund per Farbrad, Farbblock
    ...werte,
  };
}
/** Project.MakeColor: Farbblock (ganze Fläche in einer Farbe), 3 s lang. */
export const farbblock = (hex, start) => element({ Fill: hex ?? "#D97757", Start: Math.max(0, start), In: 0, Out: 3 });

// ── Eigenschaften eines Elements (wie die [JsonIgnore]-Eigenschaften von Item). info = { w, h, dauer, ton, bild } ──
export const istFarbe = it => it.Path == null && !it.datei && it.Fill != null;
export const istText = it => it.Path == null && !it.datei && it.Fill == null;
export const istBild = it => !!it.info?.bild;
/** Item.IsVisual: liegt als Bild auf einer Videospur (Video, Bild oder Farbblock). */
export const istSichtbar = it => istFarbe(it) || (!istText(it) && !!it.info && (it.info.bild || it.info.w > 0));
export const zeitfrei = it => istText(it) || istBild(it) || istFarbe(it);
export const quellLaenge = it => Math.max(0, it.Out - it.In);
export const laenge = it => zeitfrei(it) ? quellLaenge(it) : quellLaenge(it) / Math.min(4, Math.max(0.25, it.Speed));
export const ende = it => it.Start + laenge(it);
export const name = it => istFarbe(it) ? "Farbe " + it.Fill : istText(it) ? (it.Text?.trim() ? it.Text.replace(/\n/g, " ") : "Text") : (it.datei?.name ?? String(it.Path).split(/[\\/]/).pop());
export const beschnitten = it => it.CropL + it.CropT + it.CropR + it.CropB > 0.0005;

export const dauer = p => Math.max(0, ...p.Tracks.flatMap(t => t.Items.map(ende)));
/** Spuren einer Art von unten nach oben (V1 zuerst). */
export const vonUnten = (p, art) => p.Tracks.filter(t => t.Kind === art).reverse();
export const spurVon = (p, it) => p.Tracks.find(t => t.Items.includes(it));

// ── Übergänge (Katalog aus der App: daten/uebergaenge.json) ──
let katalog = null;
export function uebergaengeSetzen(daten) { katalog = daten; }
export function uebergang(id) {
  const k = katalog; if (!k) return { id: "keine", art: "none" };
  if (id && k.alt[id]) id = k.alt[id];
  return k.uebergaenge.find(t => t.id.toLowerCase() === String(id ?? "").toLowerCase()) ?? k.uebergaenge[0];
}
export const hatUebergang = it => uebergang(it.Transition).id !== "keine";
export const uebergaenge = () => katalog?.uebergaenge ?? [];
/** Transitions.Ease: sanfte Kurve s = q²(3−2q). */
export const kurve = (q, sanft) => { q = Math.min(1, Math.max(0, q)); return sanft ? q * q * (3 - 2 * q) : q; };

/** TimelineRender.Ext: wie lange items[i] für den Übergang zum direkt anschließenden Nachfolger weiterläuft. */
export function ext(items, i) {
  if (i + 1 >= items.length) return 0;
  const a = items[i], b = items[i + 1];
  if (Math.abs(b.Start - ende(a)) > 0.05 || !hatUebergang(b)) return 0;
  return Math.min(Math.max(0.1, b.TransitionSec), Math.min(laenge(b), laenge(a)));
}

/** TimelineRender.CanvasOf: Fläche des Projekts (Profil, sonst Form des ersten Videos auf V1). */
export function flaecheVon(p, daten, langeSeite) {
  const profil = daten.profile.find(x => x.id.toLowerCase() === String(p.ProfileId).toLowerCase()) ?? null;
  const op = optionen({ profil, quer: p.Landscape, form: "Original", fuellen: p.Fit === "Fuellen" }, daten);
  const erstes = vonUnten(p, "Video").flatMap(t => t.Items).filter(i => istSichtbar(i) && i.info)
    .sort((a, b) => a.Start - b.Start)[0];
  return flaeche(erstes?.info.w ?? 0, erstes?.info.h ?? 0, op, langeSeite ?? op.langeSeite);
}

/** Project.Split: Element bei Sekunde t teilen; gibt den rechten Teil zurück (oder null). */
export function teilen(p, it, t) {
  if (t <= it.Start + 0.05 || t >= ende(it) - 0.05) return null;
  const s = spurVon(p, it); if (!s) return null;
  const rechts = { ...it, Id: neueId() };
  const src = zeitfrei(it) ? t - it.Start : (t - it.Start) * it.Speed;
  it.Out = it.In + src;
  Object.assign(rechts, { In: it.Out, Start: t, Transition: "keine", FadeIn: 0 }); it.FadeOut = 0;
  s.Items.splice(s.Items.indexOf(it) + 1, 0, rechts);
  return rechts;
}

/** Project.AddTrack: Text oben, Video über der obersten Videospur, Ton unten. */
export function spurDazu(p, art) {
  const pre = { Video: "V", Audio: "A", Text: "T" }[art];
  let n = 1; while (p.Tracks.some(t => t.Name === pre + n)) n++;
  const t = spur(art, pre + n);
  const vi = p.Tracks.findIndex(x => x.Kind === "Video");
  const at = art === "Text" ? 0 : art === "Video" ? (vi >= 0 ? vi : p.Tracks.filter(x => x.Kind === "Text").length) : p.Tracks.length;
  p.Tracks.splice(at, 0, t);
  return t;
}

/** Für die .caelumcut-Datei: ohne Laufzeit-Felder (datei, info, Bildquellen). */
export function zuJson(p) {
  return JSON.stringify(p, (k, v) => (k === "datei" || k === "info" || k.startsWith("_")) ? undefined : v, 2);
}
/** Projekt lesen; alte Übergangsnamen umsetzen. Dateien muss die Oberfläche neu zuordnen (Name = Path). */
export function ausJson(text) {
  const p = JSON.parse(text);
  for (const t of p.Tracks) for (const it of t.Items) { Object.assign(it, element({ ...it })); it.Transition = uebergang(it.Transition).id; }
  return p;
}
