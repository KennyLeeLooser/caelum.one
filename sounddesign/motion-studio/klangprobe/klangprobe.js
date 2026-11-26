// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
import { planLesen, zustandBei, wegPunkt } from './plan.js';

const SPUR_S = 1.4;            // so lange leuchtet die Spur des Punkts nach

function el(tag, klasse, text) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (text != null) e.textContent = text;
  return e;
}
const zeit = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const zahl = v => v.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Baustein in element einhängen. probe = Adresse der *.probe.json (Audio relativ dazu). Liefert { stoppen }. */
export async function mount(element, { probe }) {
  const basis = new URL(probe, location.href);
  const plan = planLesen(await (await fetch(basis)).json());
  const audioUrl = new URL(plan.audio, basis);

  const block = el('div', 'kp');
  const kopf = el('div', 'kp-kopf');
  const titel = el('div');
  titel.append(el('h2', null, plan.titel), el('p', 'hint', plan.text));
  const knopf = el('button', 'primary', '▶ Abspielen');
  knopf.disabled = true;
  kopf.append(titel, knopf);

  const buehne = el('div', 'kp-buehne');
  const feld = el('div', 'kp-feld');
  const cv = el('canvas');
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', `XY-Feld: links/rechts ${plan.achsen.x}, unten/oben ${plan.achsen.y}`);
  const ax = el('span', 'kp-achse x', `↔ ${plan.achsen.x}`), ay = el('span', 'kp-achse y', `↕ ${plan.achsen.y}`);
  feld.append(cv, ax, ay);

  const seite = el('div', 'kp-seite');
  const marken = el('div', 'kp-marken');
  const mAn = el('span', 'kp-marke', 'Sound Design aus'), mHalten = el('span', 'kp-marke', 'Halten');
  marken.append(mAn, mHalten);
  const werte = el('div', 'kp-werte'), zeilen = {};
  for (const [k, name] of [['x', plan.achsen.x], ['y', plan.achsen.y]]) {
    const b = el('div', 'kp-balken'), i = el('i'), c = el('code', null, '0,50');
    b.append(i);
    werte.append(el('span', null, name), b, c);
    zeilen[k] = { i, c };
  }
  const detail = el('div', 'kp-detail');
  const dTitel = el('h3'), dText = el('p');
  detail.append(dTitel, dText);
  seite.append(marken, werte, detail);
  buehne.append(feld, seite);

  const leiste = el('div', 'kp-leiste');
  leiste.setAttribute('role', 'list');
  const kacheln = plan.abschnitte.map(a => {
    const k = el('button', 'kp-kachel');
    k.style.flexGrow = String(a.sekunden);
    k.setAttribute('role', 'listitem');
    k.title = `${a.nr} · ${a.name} (${zeit(a.von)}–${zeit(a.bis)})`;
    const fort = el('i');
    k.append(el('b', null, String(a.nr)), el('span', null, a.name), fort);
    k.addEventListener('click', () => springen(a.von, a));
    leiste.append(k);
    return { k, fort, a };
  });
  const uhr = el('div', 'kp-uhr', `0:00 / ${zeit(plan.dauer)}`);
  block.append(kopf, buehne, leiste, uhr);
  element.append(block);

  let ctx = null, puffer = null, quelle = null, startCtx = 0, ab = 0, spielt = false, gewaehlt = null;
  const roh = fetch(audioUrl).then(r => { if (!r.ok) throw new Error(`Hörprobe fehlt (${r.status})`); return r.arrayBuffer(); });
  roh.then(() => { knopf.disabled = false; }, e => { dText.textContent = e.message; });

  async function bereit() {
    if (puffer) return true;
    const Ctx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!Ctx) { dText.textContent = 'Dieser Browser kann keinen Ton abspielen.'; return false; }
    ctx = new Ctx();
    puffer = await ctx.decodeAudioData((await roh).slice(0));
    return true;
  }

  /** Was gerade zu hören ist (Sekunden in der Probe): Ausgabe-Latenz eingerechnet, damit Bild und Ohr übereinstimmen. */
  function jetzt() {
    if (!spielt) return ab;
    const ts = ctx.getOutputTimestamp?.();
    const gehoert = ts && ts.contextTime > 0 ? ts.contextTime + (performance.now() - ts.performanceTime) / 1000 : ctx.currentTime - (ctx.outputLatency || 0);
    return Math.max(ab, Math.min(plan.dauer, ab + gehoert - startCtx));
  }

  function starten(von) {
    quelle?.stop(); quelle?.disconnect();
    quelle = ctx.createBufferSource();
    quelle.buffer = puffer;
    quelle.connect(ctx.destination);
    ab = Math.max(0, Math.min(von, plan.dauer - 0.05));
    startCtx = ctx.currentTime + 0.03;
    quelle.start(startCtx, ab);
    quelle.onended = () => { if (quelle?.buffer && jetzt() >= plan.dauer - 0.1) { spielt = false; ab = 0; knopf.textContent = '▶ Nochmals'; } };
    spielt = true;
    knopf.textContent = '❚❚ Anhalten';
  }
  function anhalten() { ab = jetzt(); spielt = false; quelle?.stop(); quelle = null; knopf.textContent = '▶ Weiter'; }

  knopf.addEventListener('click', async () => {
    if (spielt) { anhalten(); return; }
    if (!(await bereit())) return;
    await ctx.resume();
    starten(ab >= plan.dauer - 0.1 ? 0 : ab);
  });
  async function springen(t, a) {
    gewaehlt = a;
    if (spielt) starten(t);
    else ab = t;
  }

  const spur = [];
  let gr = 0;
  function groesse() {
    const r = feld.getBoundingClientRect(), d = devicePixelRatio || 1;
    gr = Math.round(r.width);
    cv.width = Math.round(r.width * d); cv.height = Math.round(r.width * d);
    cv.style.height = `${r.width}px`;
  }
  new ResizeObserver(groesse).observe(feld);
  groesse();
  const farbe = n => getComputedStyle(block).getPropertyValue(n).trim();

  function zeichnen(z, t) {
    const g = cv.getContext('2d'), w = cv.width, d = w / Math.max(1, gr), akz = farbe('--akzent') || '#C8479A';
    g.clearRect(0, 0, w, w);
    const P = (x, y) => [x * w, (1 - y) * w];                 // y = 1 oben (Filter offen)
    g.lineWidth = 1 * d;
    for (let i = 1; i < 4; i++) {
      g.strokeStyle = i === 2 ? farbe('--text-blass') : farbe('--linie');
      g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, w); g.moveTo(0, i * w / 4); g.lineTo(w, i * w / 4); g.stroke();
    }
    const a = z.abschnitt;
    if (a.weg.art !== 'fest') {
      g.strokeStyle = farbe('--text-blass'); g.setLineDash([4 * d, 5 * d]); g.beginPath();
      for (let i = 0; i <= 64; i++) {
        const s = wegPunkt(a.weg, i / 64);
        const [px, py] = P(s.x, s.y);
        if (i) g.lineTo(px, py); else g.moveTo(px, py);
      }
      g.stroke(); g.setLineDash([]);
    }
    while (spur.length && (t - spur[0].t > SPUR_S || spur[0].t > t)) spur.shift();
    for (let i = 1; i < spur.length; i++) {
      const al = (1 - (t - spur[i].t) / SPUR_S) * (z.an ? 0.7 : 0.25);
      g.strokeStyle = akz; g.globalAlpha = Math.max(0, al); g.lineWidth = 3 * d; g.lineCap = 'round';
      g.beginPath(); g.moveTo(...P(spur[i - 1].x, spur[i - 1].y)); g.lineTo(...P(spur[i].x, spur[i].y)); g.stroke();
    }
    g.globalAlpha = 1;
    const [px, py] = P(z.x, z.y), r = 9 * d;
    g.lineWidth = 2 * d;
    if (z.an) {
      const puls = spielt ? 1 + 0.08 * Math.sin(t * Math.PI * 4) : 1;      // 120 BPM: Ring atmet im Takt der Achtel
      g.strokeStyle = akz; g.globalAlpha = 0.45; g.beginPath(); g.arc(px, py, r * 2.1 * puls, 0, 2 * Math.PI); g.stroke();
      g.globalAlpha = 1; g.fillStyle = akz; g.beginPath(); g.arc(px, py, r, 0, 2 * Math.PI); g.fill();
      if (z.halten) { g.strokeStyle = farbe('--text'); g.beginPath(); g.arc(px, py, r * 3, 0, 2 * Math.PI); g.stroke(); }
    } else {
      g.strokeStyle = farbe('--text-blass'); g.beginPath(); g.arc(px, py, r, 0, 2 * Math.PI); g.stroke();
    }
  }

  let letzter = null;
  function schritt() {
    requestAnimationFrame(schritt);
    const t = jetzt(), z = zustandBei(plan, t);
    if (spielt) spur.push({ t, x: z.x, y: z.y });
    feld.classList.toggle('aus', !z.an);
    zeichnen(z, t);
    for (const [k, v] of [['x', z.x], ['y', z.y]]) { zeilen[k].i.style.width = `${v * 100}%`; zeilen[k].c.textContent = zahl(v); }
    mAn.textContent = z.an ? 'Sound Design an' : 'Sound Design aus';
    mAn.classList.toggle('an', z.an);
    mHalten.classList.toggle('an', z.halten);
    for (const { k, fort, a } of kacheln) {
      k.classList.toggle('jetzt', a === z.abschnitt);
      fort.style.width = `${a === z.abschnitt ? z.u * 100 : t >= a.bis ? 100 : 0}%`;
    }
    const zeige = spielt ? z.abschnitt : gewaehlt ?? z.abschnitt;
    if (zeige !== letzter) {
      letzter = zeige;
      dTitel.textContent = `${zeige.nr} · ${zeige.name}`;
      dText.textContent = zeige.info ?? '';
    }
    uhr.textContent = `${zeit(t)} / ${zeit(plan.dauer)}`;
  }
  requestAnimationFrame(schritt);
  return { plan, stoppen: () => { quelle?.stop(); ctx?.close(); } };
}
