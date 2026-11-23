// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Sound Design: „Motion-Fenster im Browser“ – Web-Nachbildung des Fensters „Caelum Vision – DAW Ableton › Caelum Motion“
// (Vorlage CaelumVision/src/CaelumVision/MotionFenster.cs, Wunsch Kenny 23.11.2026).
// Links das Handy mit der Motion-App (Bank A–D, 4 Pads: Schwenken CC 20, Kippen CC 21, Drehen CC 22, Höhe CC 23 …), es kippt mit
// der Lage. Rechts die Sensoren (Winkel, gyro, beschl, schwer, lage, höhe, tasten, gesten) und „MIDI an Ableton (Kanal 1, CC 20–35)“
// mit 4 Bänken × 4 Balken. Pad halten = Kupplung: nur solange gehalten, bewegt die Bewegung diesen Wert; loslassen → Wert bleibt.
// Quelle: Maus (ziehen = kippen/neigen, Rad = schwenken, Umschalt+Rad = Höhe) oder echte Handy-Sensoren (DeviceOrientation/-Motion).
// Ohne Eingabe läuft ein Beispiel. Nichts wird gesendet oder gespeichert.
// KI-Beitrag (Claude, GB-7), 23.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function knopf(text, cls) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function klemm(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrap180(v) { v = (v + 180) % 360; if (v < 0) v += 360; return v - 180; }
  var BANK = ['A', 'B', 'C', 'D'];
  var ACHSE = ['Schwenken', 'Kippen', 'Drehen', 'Höhe'];
  var RAD = Math.PI / 180;

  // Quaternion [w,x,y,z] aus Kippen (x), Neigen (y), Drehen (z) in Grad – Reihenfolge Z·X·Y wie DeviceOrientation
  function quat(kip, nei, dre) {
    var cx = Math.cos(kip * RAD / 2), sx = Math.sin(kip * RAD / 2), cy = Math.cos(nei * RAD / 2), sy = Math.sin(nei * RAD / 2),
      cz = Math.cos(dre * RAD / 2), sz = Math.sin(dre * RAD / 2);
    return [cz * cx * cy - sz * sx * sy, cz * sx * cy - sz * cx * sy, cz * cx * sy + sz * sx * cy, sz * cx * cy + cz * sx * sy];
  }
  function setz(e, s) { if (e._t !== s) { e._t = s; e.textContent = s; } }   // nur bei Änderung (sprache.js übersetzt jede Änderung neu)
  function wort(e, s) { e.appendChild(el('span', null, s)); }
  function f(v, n) { var s = (v >= 0 ? ' ' : '') + v.toFixed(n == null ? 2 : n); while (s.length < 7) s = ' ' + s; return s; }

  // ================= Sequenzer =================
  // Nachbildung der Sequenzer-Seite der Motion-App (SequenzerSeite.java, App 0.9.0): ▤ Lauflicht (ein Instrument, 16 Schritte)
  // und ▦ Matrix (alle Instrumente × 16 Schritte), oben ▶ · BPM · Clock-Punkte (antippen = Klick) · Swing.
  // Bewegung koppeln: Bank A steuert den Klang – CC 20 Schwenken → Swing, CC 21 Kippen → Filter, CC 22 Drehen → Echo, CC 23 Höhe → Lautstärke.
  // Klang mit Web Audio (Drum-Stimmen aus Oszillator + Rauschen), nichts geladen, nichts gesendet. Noten wie GM-Drums (Kanal 10).
  var INSTR = [['BD', 36], ['SD', 38], ['CP', 39], ['CH', 42], ['OH', 46], ['LT', 45], ['HT', 50], ['RS', 37]];
  var MUSTER = {
    grund: ['x...x...x...x...', '....x.......x...', '............x...', 'x.x.x.x.x.x.x.x.', '..............x.', '................', '................', '.......x........'],
    break: ['x.....x...x.....', '....x.....x.x..x', '................', 'x.xxx.x.x.xxx.x.', '......x.......x.', '.........x......', '.............x..', '..x.........x...'],
    leer: ['................', '................', '................', '................', '................', '................', '................', '................']
  };
  function sequenzer(platz, holeCc, logZeile) {
    var muster = [], instr = 0, schritt = 0, naechst = 0, spielt = false, timer = null, warte = [], jetztS = -1;
    var bpm = 112, swingHand = 0.1, klick = false, koppeln = true, ansicht = 'matrix';
    var ctx = null, rausch = null, eingang, filt, laut, echo, echoG, rueck;
    function laden(n) { muster = MUSTER[n].map(function (z) { return z.split('').map(function (c) { return c === 'x'; }); }); }
    laden('grund');

    var karte = el('div', 'mf-seq-karte');
    karte.appendChild(el('h3', null, 'Sequenzer – wie in der Motion-App'));
    // Kopf: ▶ · BPM · Clock · Swing
    var kopf = el('div', 'mf-seq-kopf');
    var spielK = knopf('▶ Start', 'gross'); spielK.setAttribute('aria-pressed', 'false');
    var bpmG = el('span', 'mf-wert'), bpmMinus = knopf('−'), bpmZ = el('b'), bpmPlus = knopf('+');
    bpmMinus.setAttribute('aria-label', 'Tempo langsamer'); bpmPlus.setAttribute('aria-label', 'Tempo schneller');
    bpmG.appendChild(bpmMinus); bpmG.appendChild(bpmZ); bpmG.appendChild(el('span', 'mf-einheit', 'BPM')); bpmG.appendChild(bpmPlus);
    var uhr = knopf('', 'mf-uhr'), punkte = [];
    for (var u = 0; u < 4; u++) { var pk = el('i'); punkte.push(pk); uhr.appendChild(pk); }
    uhr.setAttribute('aria-pressed', 'false'); uhr.setAttribute('aria-label', 'Clock-Punkte: antippen = Klick');
    var swG = el('span', 'mf-wert'), swMinus = knopf('−'), swZ = el('b'), swPlus = knopf('+');
    swMinus.setAttribute('aria-label', 'Weniger Swing'); swPlus.setAttribute('aria-label', 'Mehr Swing');
    swG.appendChild(el('span', 'mf-einheit', 'Swing')); swG.appendChild(swMinus); swG.appendChild(swZ); swG.appendChild(swPlus);
    [spielK, bpmG, uhr, swG].forEach(function (e) { kopf.appendChild(e); });
    karte.appendChild(kopf);
    // Ansicht + Muster
    var zeile2 = el('div', 'mf-seq-zeile'), ans = {}, mus = {};
    [['lauf', '▤ Lauflicht'], ['matrix', '▦ Matrix']].forEach(function (p) {
      var b = knopf(p[1]); b.setAttribute('aria-pressed', p[0] === ansicht ? 'true' : 'false'); ans[p[0]] = b; zeile2.appendChild(b);
      b.addEventListener('click', function () { ansicht = p[0]; bauen(); });
    });
    zeile2.appendChild(el('span', 'mf-trenn'));
    [['grund', 'Grundbeat'], ['break', 'Breakbeat'], ['leer', 'Leer']].forEach(function (p) {
      var b = knopf(p[1]); mus[p[0]] = b; zeile2.appendChild(b);
      b.addEventListener('click', function () { laden(p[0]); bauen(); });
    });
    karte.appendChild(zeile2);
    var raster = el('div', 'mf-raster'); karte.appendChild(raster);
    // Bewegung koppeln
    var bew = el('div', 'mf-seq-bew'), kopK = knopf('Bewegung koppeln'); kopK.setAttribute('aria-pressed', 'true');
    bew.appendChild(kopK);
    var bewW = [];
    [['Schwenken', 'Swing'], ['Kippen', 'Filter'], ['Drehen', 'Echo'], ['Höhe', 'Lautstärke']].forEach(function (p, k) {
      var s = el('span', 'mf-bew'); s.appendChild(el('span', null, p[0])); s.appendChild(document.createTextNode(' → ')); s.appendChild(el('span', null, p[1]));
      var bal = el('span', 'mf-bal'), vi = el('i'); bal.appendChild(vi); s.appendChild(bal); bew.appendChild(s); bewW.push(vi);
    });
    kopK.addEventListener('click', function () { koppeln = !koppeln; kopK.setAttribute('aria-pressed', koppeln ? 'true' : 'false'); });
    karte.appendChild(bew);
    karte.appendChild(el('p', 'mf-hilfe', 'Bank A halten und das Handy bewegen: Schwenken, Kippen, Drehen und Höhe formen den Beat. In der App gehen dazu die Noten und die MIDI-Clock (24 Takte je Viertel) an Ableton.'));
    platz.appendChild(karte);

    // ---- Raster ----
    var zellen = [];   // [instrument][schritt] → Knopf
    function zelle(i, s) {
      var b = knopf('', 'mf-schritt'); b.setAttribute('aria-pressed', muster[i][s] ? 'true' : 'false');
      b.setAttribute('aria-label', INSTR[i][0] + ' ' + (s + 1)); if (s % 4 === 0) b.classList.add('takt');
      b.addEventListener('click', function () { muster[i][s] = !muster[i][s]; b.setAttribute('aria-pressed', muster[i][s] ? 'true' : 'false'); if (muster[i][s] && !spielt) ton(i, 0, 0.8); });
      return b;
    }
    function bauen() {
      Object.keys(ans).forEach(function (k) { ans[k].setAttribute('aria-pressed', k === ansicht ? 'true' : 'false'); });
      raster.textContent = ''; raster.className = 'mf-raster ' + ansicht; zellen = INSTR.map(function () { return []; });
      if (ansicht === 'lauf') {
        var chips = el('div', 'mf-chips');
        INSTR.forEach(function (p, i) { var c = knopf(p[0]); c.setAttribute('aria-pressed', i === instr ? 'true' : 'false'); c.addEventListener('click', function () { instr = i; bauen(); ton(i, 0, 0.8); }); chips.appendChild(c); });
        raster.appendChild(chips);
        var reihe = el('div', 'mf-reihe gross');
        for (var s = 0; s < 16; s++) { var z = zelle(instr, s); zellen[instr][s] = z; reihe.appendChild(z); }
        raster.appendChild(reihe);
      } else {
        INSTR.forEach(function (p, i) {
          var reihe = el('div', 'mf-reihe'), nm = knopf(p[0], 'mf-name'); nm.addEventListener('click', function () { ton(i, 0, 0.8); });
          reihe.appendChild(nm);
          for (var s = 0; s < 16; s++) { var z = zelle(i, s); zellen[i][s] = z; reihe.appendChild(z); }
          raster.appendChild(reihe);
        });
      }
      jetztS = -1;
    }
    bauen();

    // ---- Klang ----
    function audio() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      rausch = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = rausch.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      eingang = ctx.createGain(); filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 12000; filt.Q.value = 0.8;
      laut = ctx.createGain(); laut.gain.value = 0.7;
      echo = ctx.createDelay(1); rueck = ctx.createGain(); rueck.gain.value = 0.35; echoG = ctx.createGain(); echoG.gain.value = 0;
      eingang.connect(filt); filt.connect(laut); laut.connect(ctx.destination);
      filt.connect(echoG); echoG.connect(echo); echo.connect(rueck); rueck.connect(echo); echo.connect(laut);
    }
    function huell(t, a, dauer) { var g = ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer); g.connect(eingang); return g; }
    function rauschen(t, typ, freq, a, dauer) {
      var q = ctx.createBufferSource(); q.buffer = rausch; var fl = ctx.createBiquadFilter(); fl.type = typ; fl.frequency.value = freq;
      q.connect(fl); fl.connect(huell(t, a, dauer)); q.start(t); q.stop(t + dauer + 0.02);
    }
    function osz(t, typ, f0, f1, a, dauer) {
      var o = ctx.createOscillator(); o.type = typ; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dauer * 0.6);
      o.connect(huell(t, a, dauer)); o.start(t); o.stop(t + dauer + 0.02);
    }
    function ton(i, t, v) {
      audio(); if (!ctx) return; t = Math.max(t || 0, ctx.currentTime); v = v || 1;
      switch (INSTR[i][0]) {
        case 'BD': osz(t, 'sine', 140, 45, 1.0 * v, 0.45); break;
        case 'SD': osz(t, 'triangle', 220, 160, 0.35 * v, 0.12); rauschen(t, 'highpass', 1200, 0.5 * v, 0.18); break;
        case 'CP': [0, 0.012, 0.024].forEach(function (x) { rauschen(t + x, 'bandpass', 1500, 0.55 * v, 0.06); }); rauschen(t + 0.03, 'bandpass', 1300, 0.4 * v, 0.2); break;
        case 'CH': rauschen(t, 'highpass', 7500, 0.32 * v, 0.045); break;
        case 'OH': rauschen(t, 'highpass', 7000, 0.28 * v, 0.32); break;
        case 'LT': osz(t, 'sine', 160, 90, 0.7 * v, 0.35); break;
        case 'HT': osz(t, 'sine', 260, 170, 0.6 * v, 0.28); break;
        case 'RS': osz(t, 'square', 1700, 1600, 0.12 * v, 0.03); rauschen(t, 'bandpass', 3000, 0.25 * v, 0.03); break;
      }
    }
    function klickTon(t, eins) { osz(t, 'sine', eins ? 1800 : 1200, eins ? 1800 : 1200, 0.18, 0.04); }

    // ---- Bewegung → Klang (Bank A = CC 20–23), sonst Handwerte ----
    function wert(k, std) { var v = holeCc(k); return koppeln && v >= 0 ? v / 127 : std; }
    function swing() { return koppeln && holeCc(0) >= 0 ? holeCc(0) / 127 * 0.6 : swingHand; }
    function formen() {
      var fw = wert(1, 1), ew = wert(2, 0), lw = wert(3, 0.75);
      bewW[0].style.width = (swing() / 0.6 * 100) + '%'; bewW[1].style.width = (fw * 100) + '%'; bewW[2].style.width = (ew * 100) + '%'; bewW[3].style.width = (lw * 100) + '%';
      setz(swZ, Math.round(swing() * 100) + ' %');
      if (!ctx) return;
      var t = ctx.currentTime;
      filt.frequency.setTargetAtTime(180 * Math.pow(12000 / 180, fw), t, 0.05);
      echoG.gain.setTargetAtTime(ew * 0.55, t, 0.08);
      laut.gain.setTargetAtTime(lw * 0.95, t, 0.05);
      echo.delayTime.setTargetAtTime(60 / bpm * 0.75, t, 0.1);
    }

    // ---- Takt (vorausplanen, Lauflicht nach Gehör) ----
    function planen() {
      var dauer = 60 / bpm / 4;
      while (naechst < ctx.currentTime + 0.12) {
        var t = naechst + (schritt % 2 ? swing() * dauer : 0);
        var noten = [];
        for (var i = 0; i < INSTR.length; i++) if (muster[i][schritt]) { ton(i, t, schritt % 4 === 0 ? 1 : 0.82); noten.push(INSTR[i][1]); }
        if (klick && schritt % 4 === 0) klickTon(t, schritt === 0);
        warte.push({ s: schritt, t: t, n: noten });
        naechst += dauer; schritt = (schritt + 1) % 16;
      }
    }
    function lauflicht() {
      if (!spielt) return;
      while (warte.length && warte[0].t <= ctx.currentTime) {
        var w = warte.shift();
        if (jetztS >= 0) zellen.forEach(function (r) { if (r[jetztS]) r[jetztS].classList.remove('jetzt'); });
        jetztS = w.s; zellen.forEach(function (r) { if (r[jetztS]) r[jetztS].classList.add('jetzt'); });
        punkte.forEach(function (p, k) { p.classList.toggle('an', k === Math.floor(w.s / 4)); });
        if (w.n.length) logZeile('Note ' + w.n.join(' ') + '  · Kanal 10', true);
      }
      requestAnimationFrame(lauflicht);
    }
    function start() {
      audio(); if (!ctx) return;
      spielt = true; schritt = 0; warte = []; naechst = ctx.currentTime + 0.06;
      spielK.textContent = '■ Stopp'; spielK.setAttribute('aria-pressed', 'true');
      logZeile('MIDI-Clock Start · ' + bpm + ' BPM', true);
      timer = setInterval(function () { formen(); planen(); }, 25); planen(); requestAnimationFrame(lauflicht);
    }
    function stopp() {
      if (!spielt) return;
      spielt = false; clearInterval(timer); timer = null; warte = [];
      spielK.textContent = '▶ Start'; spielK.setAttribute('aria-pressed', 'false');
      if (jetztS >= 0) zellen.forEach(function (r) { if (r[jetztS]) r[jetztS].classList.remove('jetzt'); });
      punkte.forEach(function (p) { p.classList.remove('an'); }); jetztS = -1;
      logZeile('MIDI-Clock Stopp', true);
    }
    spielK.addEventListener('click', function () { spielt ? stopp() : start(); });
    function bpmSetz(v) { bpm = klemm(v, 60, 180); setz(bpmZ, String(bpm)); }
    bpmMinus.addEventListener('click', function () { bpmSetz(bpm - 2); }); bpmPlus.addEventListener('click', function () { bpmSetz(bpm + 2); });
    swMinus.addEventListener('click', function () { swingHand = klemm(Math.round((swingHand - 0.05) * 100) / 100, 0, 0.6); formen(); });
    swPlus.addEventListener('click', function () { swingHand = klemm(Math.round((swingHand + 0.05) * 100) / 100, 0, 0.6); formen(); });
    uhr.addEventListener('click', function () { klick = !klick; uhr.setAttribute('aria-pressed', klick ? 'true' : 'false'); });
    bpmSetz(bpm); formen();
    setInterval(function () { if (!spielt && platz.offsetParent) formen(); }, 200);   // Balken auch im Stand
    return { stopp: stopp, spielt: function () { return spielt; }, muster: function () { return muster; } };
  }

  function start(platz) {
    var block = el('div', 'mf-block'); block.id = 'motion-fenster';
    block.appendChild(el('h2', null, 'Motion-Fenster: was in Ableton ankommt'));
    block.appendChild(el('p', 'lead', 'So sieht es am PC aus, wenn das Handy mit Caelum Motion verbunden ist: links das Handy mit der App, rechts die echten Sensorwerte und die MIDI-Regler, die Ableton bekommt. Pad halten und bewegen – nur das gehaltene Pad ändert seinen Wert.'));

    // ---------- Leiste: Handy-Sensoren · Sequenzer (fährt aus) ----------
    var leiste = el('div', 'mf-leiste'), sensGross = knopf('Handy-Sensoren einschalten', 'gross'), seqK = knopf('', 'mf-auf');
    sensGross.setAttribute('aria-pressed', 'false');
    seqK.appendChild(el('span', null, 'Sequenzer')); seqK.appendChild(el('i', 'mf-pfeil'));
    seqK.setAttribute('aria-expanded', 'false'); seqK.setAttribute('aria-controls', 'mf-sequenzer');
    leiste.appendChild(sensGross); leiste.appendChild(seqK);
    var sensInfo = el('span', 'mf-hinweis', 'Am Handy: einschalten und erlauben – dann bewegt das echte Handy alles.'); leiste.appendChild(sensInfo);
    block.appendChild(leiste);
    var seqHuelle = el('div', 'mf-seq'), seqIn = el('div', 'mf-seq-in'); seqHuelle.id = 'mf-sequenzer'; seqHuelle.inert = true;
    seqHuelle.appendChild(seqIn); block.appendChild(seqHuelle);

    var fenster = el('div', 'mf');
    // ---------- links: Handy ----------
    var buehne = el('div', 'mf-buehne'), handy = el('div', 'mf-handy'), app = el('div', 'mf-app');
    buehne.setAttribute('role', 'application'); buehne.setAttribute('aria-label', 'Handy-Nachbildung: ziehen = kippen und neigen, Mausrad = schwenken');
    app.appendChild(el('div', 'mf-titel', 'Caelum Motion'));
    var status = el('div', 'mf-status', 'Beispiel läuft'); app.appendChild(status);
    var baenke = el('div', 'mf-baenke'), bankK = [];
    BANK.forEach(function (n, i) { var b = knopf(); wort(b, 'Bank'); b.appendChild(document.createTextNode(' ' + n)); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); b.addEventListener('click', function () { bankWahl(i, true); }); bankK.push(b); baenke.appendChild(b); });
    app.appendChild(baenke);
    var pads = el('div', 'mf-pads'), padK = [];
    for (var i = 0; i < 4; i++) (function (i) {
      var p = knopf(''), tag = el('span', 'mf-tag'), ach = el('b', null, ACHSE[i]), cc = el('span', 'mf-cc'), sp = el('span', 'mf-spur'), vo = el('i');
      sp.appendChild(vo); p.appendChild(tag); p.appendChild(ach); p.appendChild(cc); p.appendChild(sp);
      p.setAttribute('aria-pressed', 'false'); p.setAttribute('aria-label', ACHSE[i]);
      function an(e) { e.preventDefault(); e.stopPropagation(); demoAus(); halte(i, true); try { p.setPointerCapture(e.pointerId); } catch (x) { } }
      function aus() { halte(i, false); }
      p.addEventListener('pointerdown', an); p.addEventListener('pointerup', aus); p.addEventListener('pointercancel', aus); p.addEventListener('lostpointercapture', aus);
      p.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); demoAus(); halte(i, true); } });
      p.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') halte(i, false); });
      padK.push({ k: p, tag: tag, cc: cc, voll: vo }); pads.appendChild(p);
    })(i);
    app.appendChild(pads);
    var gehaltenR = el('div', 'mf-gehalten'), gehaltenZ = el('span', null, '–'); wort(gehaltenR, 'Gehalten:'); gehaltenR.appendChild(document.createTextNode(' '));
    gehaltenR.appendChild(gehaltenZ); app.appendChild(gehaltenR);
    var unten = el('div', 'mf-unten'), mitteK = knopf('Mitte setzen'), seqApp = knopf('Sequenzer'), sensK = knopf('Sensoren');
    sensK.setAttribute('aria-pressed', 'false'); seqApp.setAttribute('aria-pressed', 'false');
    unten.appendChild(mitteK); unten.appendChild(seqApp); unten.appendChild(sensK); app.appendChild(unten);
    handy.appendChild(app); buehne.appendChild(handy);
    function winkelZeile(e) {   // „kippen 0.0°  neigen 0.0°  drehen 0.0°“ mit übersetzbaren Wörtern
      return ['kippen', 'neigen', 'drehen'].map(function (w, k) { if (k) e.appendChild(document.createTextNode('  ')); wort(e, w); var v = el('span'); e.appendChild(v); return v; });
    }
    var lageZ = el('p', 'mf-lage'), lageW = winkelZeile(lageZ); buehne.appendChild(lageZ);
    var hilfe = el('p', 'mf-hilfe', 'Am PC: Handy ziehen = kippen/neigen · Mausrad auf dem Handy = schwenken · Umschalt+Rad = Höhe · Tasten 1–4 halten Pads');
    buehne.appendChild(hilfe);
    fenster.appendChild(buehne);

    // ---------- rechts: Daten ----------
    var daten = el('div', 'mf-daten');
    daten.appendChild(el('h3', null, 'Sensoren (vom Handy)'));
    var sens = el('div', 'mf-sens'), zeile = {};
    [['winkel', 'Winkel °'], ['gyro', 'gyro rad/s'], ['beschl', 'beschl m/s²'], ['schwer', 'schwer m/s²'], ['lage', 'lage w x y z'], ['hoehe', 'höhe m'], ['tasten', 'tasten'], ['gesten', 'gesten']]
      .forEach(function (p) { sens.appendChild(el('span', 'mf-k', p[1])); var v = el('code'); sens.appendChild(v); zeile[p[0]] = v; });
    var winkelW = winkelZeile(zeile.winkel), hoeheW = el('span'), hoeheS = el('span', null, '(geschätzt)');
    zeile.hoehe.appendChild(hoeheW); zeile.hoehe.appendChild(document.createTextNode('  ')); zeile.hoehe.appendChild(hoeheS);
    daten.appendChild(sens);
    daten.appendChild(el('h3', null, 'MIDI an Ableton (Kanal 1, CC 20–35)'));
    var midi = el('div', 'mf-midi'), balken = [];
    for (var b = 0; b < 4; b++) {
      var sp2 = el('div', 'mf-bank'), kopf = el('span', 'mf-bk'); wort(kopf, 'Bank'); kopf.appendChild(document.createTextNode(' ' + BANK[b])); sp2.appendChild(kopf); balken.push({ kopf: kopf, z: [] });
      for (var q = 0; q < 4; q++) {
        var r = el('div', 'mf-z'), n = el('span', 'mf-n', String(20 + b * 4 + q)), bk = el('span', 'mf-bal'), vi = el('i'), w = el('span', 'mf-w', '–');
        bk.appendChild(vi); r.appendChild(n); r.appendChild(bk); r.appendChild(w); sp2.appendChild(r); balken[b].z.push({ r: r, i: vi, w: w });
      }
      midi.appendChild(sp2);
    }
    daten.appendChild(midi);
    var log = el('div', 'mf-log'); log.setAttribute('aria-live', 'off'); daten.appendChild(log);
    daten.appendChild(el('p', 'mf-hilfe', 'Halten = Kupplung · Lautstärketasten = Bank. Im Browser wird nichts gesendet – in Ableton macht Caelum Motion genau diese Regler.'));
    fenster.appendChild(daten);
    block.appendChild(fenster);
    platz.appendChild(block);

    // ---------- Zustand ----------
    var roh = { kip: 0, nei: 0, dre: 0, h: 0 }, mitte = { kip: 0, nei: 0, dre: 0, h: 0 };
    var bank = 0, gehalten = [false, false, false, false], cc = [], ccZeit = [], gesten = [];
    for (var c = 0; c < 16; c++) { cc.push(-1); ccZeit.push(0); }
    var quelle = 'demo', demoT = 0, letzt = null, gyro = [0, 0, 0], beschl = [0, 0, 0], lin = null, sichtbar = true;
    var basis = {};   // Achsenwert beim Einrasten der Kupplung (relativ weiterbewegen)

    function rel() { return { kip: klemm(roh.kip - mitte.kip, -90, 90), nei: klemm(roh.nei - mitte.nei, -90, 90), dre: wrap180(roh.dre - mitte.dre), h: roh.h - mitte.h }; }
    function achswert(a, i) {   // 0…127 je Achse
      var v = i === 0 ? a.dre / 90 : i === 1 ? a.kip / 60 : i === 2 ? a.nei / 60 : a.h / 0.5;
      return klemm(Math.round(63.5 + v * 63.5), 0, 127);
    }
    function geste(g) { gesten.push(g); if (gesten.length > 6) gesten.shift(); }
    function bankWahl(i, hand) { if (hand) demoAus(); bank = i; bankK.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); }); gehalten = [false, false, false, false]; }
    function halte(i, an) {
      if (gehalten[i] === an) return; gehalten[i] = an;
      if (an) { var k = bank * 4 + i; basis[k] = { a: achswert(rel(), i), c: cc[k] < 0 ? achswert(rel(), i) : cc[k] }; if (quelle !== 'demo' && navigator.vibrate) try { navigator.vibrate(12); } catch (x) { } }
    }
    function demoAus() { if (quelle === 'demo') { quelle = 'maus'; gehalten = [false, false, false, false]; status.textContent = 'Maus · Handy ziehen'; } }

    // ---------- Maus / Finger am Handy ----------
    var zieh = null;
    buehne.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      demoAus(); if (quelle === 'sensor') return;
      zieh = { x: e.clientX, y: e.clientY, kip: roh.kip, nei: roh.nei }; try { buehne.setPointerCapture(e.pointerId); } catch (x) { }
    });
    buehne.addEventListener('pointermove', function (e) {
      if (!zieh) return;
      roh.nei = klemm(zieh.nei + (e.clientX - zieh.x) * 0.45, -90, 90);
      roh.kip = klemm(zieh.kip + (e.clientY - zieh.y) * 0.45, -90, 90);
    });
    function zEnde() { zieh = null; }
    buehne.addEventListener('pointerup', zEnde); buehne.addEventListener('pointercancel', zEnde);
    handy.addEventListener('wheel', function (e) {   // nur über dem Handy, damit die Seite sonst scrollt
      if (quelle === 'sensor') return;
      e.preventDefault(); demoAus();
      if (e.shiftKey) roh.h = klemm(roh.h - (e.deltaY || e.deltaX) * 0.0015, -0.6, 0.6);
      else roh.dre = wrap180(roh.dre + e.deltaY * 0.15);
    }, { passive: false });
    buehne.addEventListener('dblclick', function () { geste('tippen'); });
    block.addEventListener('keydown', function (e) {
      var n = '1234'.indexOf(e.key); if (n >= 0 && !e.repeat && !e.target.closest('input')) { demoAus(); halte(n, true); }
    });
    block.addEventListener('keyup', function (e) { var n = '1234'.indexOf(e.key); if (n >= 0) halte(n, false); });
    mitteK.addEventListener('click', function () { demoAus(); var a = roh; mitte = { kip: a.kip, nei: a.nei, dre: a.dre, h: a.h }; geste('mitte'); });

    // ---------- echte Sensoren ----------
    function orient(e) {
      if (e.beta == null) return;
      roh.kip = klemm(e.beta, -90, 90); roh.nei = klemm(e.gamma || 0, -90, 90); roh.dre = wrap180(-(e.alpha || 0));
      if (Math.abs(e.beta) > 150) geste('umdrehen');
    }
    var vz = 0, hz = 0, schuettelZ = 0;
    function bewegung(e) {
      var a = e.acceleration, g = e.accelerationIncludingGravity, r = e.rotationRate, dt = (e.interval || 16) / 1000;
      if (dt > 1) dt /= 1000;   // manche Geräte melden ms
      if (r && r.beta != null) gyro = [(r.beta || 0) * RAD, (r.gamma || 0) * RAD, (r.alpha || 0) * RAD];
      if (a && a.x != null) {
        lin = [a.x || 0, a.y || 0, a.z || 0];
        var m = Math.hypot(lin[0], lin[1], lin[2]), jetzt = performance.now();
        if (m > 14 && jetzt - schuettelZ > 800) { schuettelZ = jetzt; geste('schütteln'); }
        if (g && g.x != null) {   // Höhe grob: Beschleunigung entlang der Schwerkraft, zweimal aufintegriert mit Leck (nur Schätzung)
          var gm = Math.hypot(g.x, g.y, g.z) || 9.81, auf = (lin[0] * g.x + lin[1] * g.y + lin[2] * g.z) / gm;
          vz = (vz + auf * dt) * 0.96; hz = (hz + vz * dt) * 0.985; roh.h = klemm(hz, -0.6, 0.6);
        }
      }
    }
    function sensAnzeige(an) {   // beide Knöpfe (in der App und in der Leiste) zeigen denselben Stand
      sensK.setAttribute('aria-pressed', an ? 'true' : 'false'); sensGross.setAttribute('aria-pressed', an ? 'true' : 'false');
      setz(sensGross, an ? 'Handy-Sensoren ausschalten' : 'Handy-Sensoren einschalten');
    }
    function meld(s) { status.textContent = s; sensInfo.textContent = s; }
    function sensorSchalter() {
      if (quelle === 'sensor') { quelle = 'maus'; sensAnzeige(false); window.removeEventListener('deviceorientation', orient); window.removeEventListener('devicemotion', bewegung); status.textContent = 'Maus · Handy ziehen'; lin = null; return; }
      var D = window.DeviceOrientationEvent, M = window.DeviceMotionEvent;
      if (!D) { meld('Keine Sensoren in diesem Browser'); return; }
      if (!window.isSecureContext) { meld('Sensoren nur über https'); return; }
      function los() {
        demoAus(); quelle = 'sensor'; sensAnzeige(true); meld('Sensoren · Handy bewegen');
        window.addEventListener('deviceorientation', orient); window.addEventListener('devicemotion', bewegung);
        setTimeout(function () { mitte = { kip: roh.kip, nei: roh.nei, dre: roh.dre, h: roh.h }; }, 300);
      }
      var bitten = [];
      if (typeof D.requestPermission === 'function') bitten.push(D.requestPermission());
      if (M && typeof M.requestPermission === 'function') bitten.push(M.requestPermission());
      if (!bitten.length) return los();
      Promise.all(bitten).then(function (r) { if (r[0] === 'granted') los(); else meld('Sensoren nicht erlaubt'); })
        .catch(function () { meld('Sensoren nicht erlaubt'); });
    }
    sensK.addEventListener('click', sensorSchalter); sensGross.addEventListener('click', sensorSchalter);

    // ---------- Beispiel (läuft, bis jemand übernimmt) ----------
    function demo(t) {
      roh.kip = Math.sin(t * 0.7) * 28; roh.nei = Math.sin(t * 0.45 + 1) * 34; roh.dre = Math.sin(t * 0.3) * 50; roh.h = Math.sin(t * 0.9) * 0.25;
      var takt = Math.floor(t / 2.2), schritt = takt % 6;
      var b = Math.floor(takt / 6) % 2;
      if (b !== bank) bankWahl(b, false);
      var soll = [schritt === 0 || schritt === 4, schritt === 1 || schritt === 4, schritt === 2, schritt === 3 || schritt === 5];
      for (var i = 0; i < 4; i++) halte(i, soll[i]);
      if (schritt === 5 && t % 2.2 < 0.03) geste('schütteln');
    }

    // ---------- Takt ----------
    function rechnen(t) {
      if (quelle === 'demo') demo(t / 1000);
      var a = rel();
      // gyro aus der Winkeländerung, wenn das Gerät keine eigene Rate liefert
      if (letzt && quelle !== 'sensor') {
        var dt = Math.max(0.001, (t - letzt.t) / 1000);
        gyro = [(a.kip - letzt.kip) * RAD / dt, (a.nei - letzt.nei) * RAD / dt, wrap180(a.dre - letzt.dre) * RAD / dt].map(function (v, k) { return gyro[k] * 0.8 + v * 0.2; });
      }
      letzt = { t: t, kip: a.kip, nei: a.nei, dre: a.dre };
      var q = quat(a.kip, a.nei, a.dre);
      var schwer = [9.81 * Math.sin(a.nei * RAD) * Math.cos(a.kip * RAD) * -1, 9.81 * Math.sin(a.kip * RAD), 9.81 * Math.cos(a.kip * RAD) * Math.cos(a.nei * RAD)];
      beschl = lin ? lin : [gyro[1] * 0.4, gyro[0] * 0.4, 0];
      var jetzt = performance.now();
      for (var i = 0; i < 4; i++) {
        if (!gehalten[i]) continue;
        var k = bank * 4 + i, w = achswert(a, i), bs = basis[k] || { a: w, c: w };
        var neu = klemm(bs.c + (w - bs.a), 0, 127);
        if (neu !== cc[k]) { cc[k] = neu; ccZeit[k] = jetzt; logZeile('CC ' + (20 + k) + ' = ' + neu); }
      }
      return { a: a, q: q, schwer: schwer, jetzt: jetzt };
    }
    var logZ = [], logLetzt = 0;
    function logZeile(s, immer) { var j = performance.now(); if (!immer && j - logLetzt < 90) return; logLetzt = j; logZ.push(s); if (logZ.length > 4) logZ.shift(); log.textContent = logZ.join('\n'); }

    // ---------- Sequenzer (wie die Motion-App 0.9.0: Lauflicht + Matrix, ▶ · BPM · Clock-Punkte · Swing) ----------
    var seq = sequenzer(seqIn, function (k) { return cc[k]; }, logZeile);
    function seqOffen(auf) {
      seqHuelle.classList.toggle('offen', auf); seqHuelle.inert = !auf;
      seqK.setAttribute('aria-expanded', auf ? 'true' : 'false'); seqApp.setAttribute('aria-pressed', auf ? 'true' : 'false');
      if (!auf) seq.stopp();
    }
    seqK.addEventListener('click', function () { seqOffen(seqK.getAttribute('aria-expanded') !== 'true'); });
    seqApp.addEventListener('click', function (e) {
      var auf = seqK.getAttribute('aria-expanded') !== 'true'; seqOffen(auf);
      if (auf) setTimeout(function () { block.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
    });

    function zeigen(r) {
      var a = r.a;
      handy.style.transform = 'rotateX(' + (-a.kip * 0.8).toFixed(1) + 'deg) rotateY(' + (a.nei * 0.8).toFixed(1) + 'deg) rotateZ(' + (-a.dre * 0.5).toFixed(1) + 'deg) translateY(' + (-a.h * 60).toFixed(1) + 'px)';
      [a.kip, a.nei, a.dre].forEach(function (v, k) { setz(lageW[k], ' ' + v.toFixed(1) + '°'); setz(winkelW[k], f(v, 1)); });
      var tasten = [];
      padK.forEach(function (p, i) {
        var k = bank * 4 + i, an = gehalten[i];
        if (an) tasten.push(BANK[bank] + (i + 1));
        setz(p.tag, BANK[bank] + (i + 1)); setz(p.cc, an ? 'gehalten' : 'CC ' + (20 + k));
        p.k.setAttribute('aria-pressed', an ? 'true' : 'false');
        p.voll.style.width = (cc[k] < 0 ? 0 : cc[k] / 127 * 100) + '%';
      });
      setz(gehaltenZ, tasten.length ? tasten.join(' ') : '–');
      setz(zeile.gyro, gyro.map(function (v) { return f(v); }).join(' '));
      setz(zeile.beschl, beschl.map(function (v) { return f(v); }).join(' '));
      setz(zeile.schwer, r.schwer.map(function (v) { return f(v); }).join(' '));
      setz(zeile.lage, r.q.map(function (v) { return f(v, 3); }).join(' '));
      setz(hoeheW, f(a.h, 3)); hoeheS.hidden = quelle !== 'sensor';
      setz(zeile.tasten, tasten.length ? tasten.join(' ') : '–');
      var gs = gesten.slice(-4).reverse(), gk = gs.join('|');
      if (zeile.gesten._g !== gk) {   // jede Geste ein eigenes Wort (übersetzbar)
        zeile.gesten._g = gk; zeile.gesten.textContent = gs.length ? '' : '–';
        gs.forEach(function (g, k) { if (k) zeile.gesten.appendChild(document.createTextNode('  ')); wort(zeile.gesten, g); });
      }
      balken.forEach(function (bk, b) {
        bk.kopf.classList.toggle('an', b === bank);
        bk.z.forEach(function (z, q2) {
          var k = b * 4 + q2, v = cc[k], frisch = r.jetzt - ccZeit[k] < 400;
          z.i.style.width = (v < 0 ? 0 : v / 127 * 100) + '%'; setz(z.w, v < 0 ? '–' : String(v));
          z.r.classList.toggle('frisch', frisch);
        });
      });
    }

    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { sichtbar = e[0].isIntersecting; }).observe(block);
    function schleife(t) { if (sichtbar && !document.hidden) zeigen(rechnen(t)); requestAnimationFrame(schleife); }
    requestAnimationFrame(schleife);
  }
  (window.CaelumModul = window.CaelumModul || {})['motion-fenster'] = start;
  document.dispatchEvent(new CustomEvent('caelum-modul', { detail: 'motion-fenster' }));
})();
