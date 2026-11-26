// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.

export const FORMAT = 'caelum-klangprobe/1';

/** Plan prüfen und Abschnitte mit Anfangszeit versehen. Wirft bei Fehlern (mit Grund). */
export function planLesen(daten) {
  if (!daten || daten.format !== FORMAT) throw new Error(`kein ${FORMAT}`);
  if (!Array.isArray(daten.abschnitte) || !daten.abschnitte.length) throw new Error('keine Abschnitte');
  let t = 0;
  const abschnitte = daten.abschnitte.map((a, i) => {
    if (!(a.sekunden > 0)) throw new Error(`Abschnitt ${i + 1}: Dauer fehlt`);
    const w = a.weg ?? { art: 'fest', x: 0.5, y: 0.5 };
    if (!['fest', 'linie', 'kreis'].includes(w.art)) throw new Error(`Abschnitt ${i + 1}: Weg ${w.art} unbekannt`);
    const b = { ...a, nr: i + 1, von: t, bis: t + a.sekunden, weg: w, an: a.an !== false, halten: !!a.halten, haltenAb: a.haltenAb ?? 0.25 };
    t += a.sekunden;
    return b;
  });
  return { ...daten, abschnitte, dauer: t };
}

const klemmen = v => Math.max(0, Math.min(1, v));

/** Punkt auf dem Weg bei u (0…1 im Abschnitt). */
export function wegPunkt(w, u) {
  if (w.art === 'linie') return { x: w.von.x + (w.nach.x - w.von.x) * u, y: w.von.y + (w.nach.y - w.von.y) * u };
  if (w.art === 'kreis') {
    const m = w.mitte ?? { x: 0.5, y: 0.5 }, r = w.radius ?? 0.45;
    return { x: m.x + r * Math.cos(2 * Math.PI * u), y: m.y + r * Math.sin(2 * Math.PI * u) };
  }
  return { x: w.x ?? 0.5, y: w.y ?? 0.5 };
}

/** Zustand bei t Sekunden: { abschnitt, u, an, x, y, halten }. Ausserhalb des Plans: erster bzw. letzter Abschnitt. */
export function zustandBei(plan, t) {
  const liste = plan.abschnitte;
  let a = liste.find(s => t < s.bis) ?? liste[liste.length - 1];
  if (t < 0) a = liste[0];
  const u = klemmen((t - a.von) / a.sekunden);
  let halten = false, uw = u;
  if (a.halten && u > a.haltenAb) { halten = true; uw = a.haltenAb; }      // Kupplung zu: Wert vom Moment des Haltens
  const p = wegPunkt(a.weg, uw);
  return { abschnitt: a, u, an: a.an, x: klemmen(p.x), y: klemmen(p.y), halten };
}
