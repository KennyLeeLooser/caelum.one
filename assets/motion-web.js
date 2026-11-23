// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Sound Design: „Caelum Motion im Browser“ – Prototyp (Motion ROADMAP Schritt 4). Bewegung wird Klang, ganz im Browser:
// Fläche ziehen (Maus/Finger) oder Handy neigen (DeviceOrientation, HTTPS) → Tonhöhe (links/rechts, Pentatonik) und Filter (oben/unten).
// Effekte wie in der App: Echo, Verzerrer, Breite. Daneben die MIDI-Vorschau: was das Plugin in Ableton daraus machen würde.
// Drei Ansichten wie in der Motion-App, per Reiter oder Wischen (Wunsch Kenny 23.11.2026):
//   Synth     – der Klang wird hier erzeugt (wie bisher).
//   Datei     – eigene Musikdatei (bleibt im Browser, decodeAudioData, kein Hochladen), ↔ Tempo, ↕ Filter, alle Effekte greifen.
//   Live-Musik – was gerade spielt: der Browser hört fremde Apps nicht → Emulation (spielt wie eine fremde App, an den Effekten
//               vorbei) oder Mikrofon (hört den Raum, nur Anzeige). Zeigt, warum Effekte nur auf die Datei greifen.
// Web Audio, kein Server, nichts wird gespeichert oder gesendet.
// KI-Beitrag (Claude, GB-7), 22.11.2026 – live mit OK Kenny (c785ea1); Ansichten Datei/Live 23.11.2026 – Freigabe ausstehend (GB-8).
(function () {
  'use strict';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function knopf(text, cls) { var b = el('button', cls, text); b.type = 'button'; return b; }
  var NOTEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
  var SKALA = [0, 3, 5, 7, 10];   // Moll-Pentatonik – jede Lage klingt
  var GRUND = 45;                 // A2
  var ANSICHTEN = ['synth', 'datei', 'live'];

  function start(platz, farbe) {
    var gold = '#E8C547', rgb = '232,197,71', m = String(farbe || '').match(/^#([0-9a-f]{6})$|^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);   // Zeichenfarbe: #rrggbb oder rgb(…)
    if (m) { gold = farbe; rgb = m[1] ? [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }).join(',') : [m[2], m[3], m[4]].join(','); }
    function rgba(a) { return 'rgba(' + rgb + ',' + a + ')'; }
    var block = el('div', 'motion-block'); block.id = 'motion'; block.style.setProperty('--c-motion', gold);
    block.appendChild(el('h2', null, 'Caelum Motion im Browser'));
    block.appendChild(el('p', 'lead', 'Der Prototyp zum Ausprobieren: Fläche ziehen oder Handy neigen – links/rechts ist die Tonhöhe, oben/unten der Filter. In Ableton macht das Plugin genau daraus Steuerdaten.'));

    // ---- Reiter: Synth · Datei · Live-Musik (auch wischen) ----
    var reiter = el('div', 'reiter'), tab = {};
    reiter.setAttribute('role', 'tablist'); reiter.setAttribute('aria-label', 'Ansicht');
    [['synth', 'Synth'], ['datei', 'Datei'], ['live', 'Live-Musik']].forEach(function (p) {
      var b = knopf(p[1]); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', p[0] === 'synth' ? 'true' : 'false');
      b.addEventListener('click', function () { zeige(p[0]); }); tab[p[0]] = b; reiter.appendChild(b);
    });
    reiter.appendChild(el('span', 'wisch', '‹ wischen ›'));
    block.appendChild(reiter);

    var wrap = el('div', 'motion');
    var pad = el('div', 'pad'), cv = el('canvas'), hin = el('p', 'hinweis', 'Erst „Klang an“, dann hier ziehen');
    pad.setAttribute('role', 'application'); pad.setAttribute('aria-label', 'Klangfläche: ziehen = Tonhöhe und Filter');
    pad.appendChild(cv); pad.appendChild(hin); wrap.appendChild(pad);

    var seite = el('div', 'seite');
    var k1 = el('div', 'karte'); k1.appendChild(el('h3', null, 'Steuern'));
    var r1 = el('div', 'knoepfe');
    // Synth
    var an = knopf('▶ Klang an', 'gross'), halt = knopf('Halten');
    halt.setAttribute('aria-pressed', 'false');
    // Datei
    var waehl = knopf('Eigene Datei', 'gross'), spiel = knopf('▶ Abspielen'), inp = el('input');
    inp.type = 'file'; inp.accept = 'audio/*'; inp.hidden = true;
    // Live
    var emuK = knopf('▶ Emulation', 'gross'), mikK = knopf('Mikrofon');
    emuK.setAttribute('aria-pressed', 'false'); mikK.setAttribute('aria-pressed', 'false');
    var neig = knopf('Handy neigen'); neig.setAttribute('aria-pressed', 'false');
    var gruppe = { synth: [an, halt], datei: [waehl, spiel], live: [emuK, mikK] };
    [an, halt, waehl, spiel, emuK, mikK, neig].forEach(function (b) { r1.appendChild(b); });
    k1.appendChild(r1); k1.appendChild(inp);
    var name = el('p', 'klein datei-name', 'Keine Datei gewählt');
    var info = el('p', 'klein', 'Am Handy: „Handy neigen“ antippen und erlauben. Am PC: mit der Maus über die Fläche ziehen.');
    k1.appendChild(name); k1.appendChild(info);
    seite.appendChild(k1);

    var k2 = el('div', 'karte'); k2.appendChild(el('h3', null, 'Effekte'));
    var r2 = el('div', 'knoepfe'), fx = {};
    [['echo', 'Echo'], ['zerr', 'Verzerrer'], ['breit', 'Breite']].forEach(function (p) {
      var b = knopf(p[1]); b.setAttribute('aria-pressed', p[0] === 'echo' ? 'true' : 'false'); fx[p[0]] = b; r2.appendChild(b);
      b.addEventListener('click', function () { if (ansicht === 'live') return; b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); effekte(); });
    });
    k2.appendChild(r2);
    var fxLive = el('p', 'klein', 'Live: nur anzeigen – Effekte greifen nicht'); fxLive.hidden = true; k2.appendChild(fxLive);
    // Erklärung „Datei segmentieren“
    var erkl = el('details', 'erkl'); erkl.appendChild(el('summary', null, 'Warum Effekte nur auf die Datei greifen'));
    erkl.appendChild(el('p', null, 'Datei segmentieren: Eine Datei (MP3, WAV …) liegt ganz vor. Der Browser zerlegt sie in kurze Stücke und schickt jedes durch Filter, Echo, Verzerrer und Breite, bevor du es hörst – darum lässt sie sich live verändern.'));
    erkl.appendChild(el('p', null, 'Live-Musik aus einer fremden App läuft daran vorbei: Android zeigt anderen Apps die gemeinsame Ausgabe (Sitzung 0) nur zum Anschauen, nicht zum Verändern. Ein Browser hört fremde Apps gar nicht.'));
    erkl.appendChild(el('p', null, 'Das Mikrofon hört den Raum, nicht die App – gut für die Anzeige, aber ohne Effekte. Verändern lässt sich nur, was als Datei vorliegt oder hier erzeugt wird.'));
    k2.appendChild(erkl);
    seite.appendChild(k2);

    var k3 = el('div', 'karte'); k3.appendChild(el('h3', null, 'Werte'));
    var werte = el('div', 'werte'), zeilen = {};
    [['x', 'Neigen ↔'], ['y', 'Neigen ↕'], ['f', 'Filter']].forEach(function (p) {
      werte.appendChild(el('span', null, p[1])); var bk = el('div', 'balken'), i = el('i'); bk.appendChild(i); werte.appendChild(bk);
      var c = el('code', null, '–'); werte.appendChild(c); zeilen[p[0]] = { i: i, c: c };
    });
    k3.appendChild(werte);
    k3.appendChild(el('p', 'klein', 'MIDI-Vorschau für Ableton:'));
    var midi = el('div', 'midi'); midi.setAttribute('translate', 'no'); midi.textContent = 'CC 74  Filter      –\nCC  1  Modulation  –\nNote   –'; k3.appendChild(midi);
    seite.appendChild(k3);
    wrap.appendChild(seite); block.appendChild(wrap); platz.appendChild(block);

    // ---- Zustand ----
    var X = 0.5, Y = 0.6, aktiv = false, quelle = 'pad', spur = [], ac = null, N = {}, ansicht = 'synth';
    var puffer = null, quelleD = null, pos = 0, t0 = 0, rate = 1, spielt = false, emu = null, mik = null;
    function note(x) { var i = Math.round(x * (SKALA.length * 2)); var o = Math.floor(i / SKALA.length), s = i % SKALA.length; return GRUND + o * 12 + SKALA[s]; }
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function filterHz(y) { return ansicht === 'datei' ? 120 * Math.pow(20000 / 120, y) : 180 * Math.pow(9000 / 180, y); }
    function tempo(x) { return x < 0.45 ? 0.5 + x / 0.45 * 0.5 : x > 0.55 ? 1 + (x - 0.55) / 0.45 * 0.5 : 1; }   // Mitte rastet auf 1×

    function audio() {
      if (ac) { if (ac.state !== 'running') ac.resume(); return true; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { info.textContent = 'Dieser Browser kann kein Web Audio.'; return false; }
      ac = new AC();
      N.o1 = ac.createOscillator(); N.o1.type = 'sawtooth';
      N.o2 = ac.createOscillator(); N.o2.type = 'square'; N.o2.detune.value = 7;
      N.sub = ac.createOscillator(); N.sub.type = 'sine';
      var m1 = ac.createGain(), m2 = ac.createGain(), m3 = ac.createGain(); m1.gain.value = 0.32; m2.gain.value = 0.16; m3.gain.value = 0.28;
      N.synth = ac.createGain(); N.synth.gain.value = ansicht === 'synth' ? 1 : 0;
      N.datei = ac.createGain(); N.datei.gain.value = 0.8;
      N.filt = ac.createBiquadFilter(); N.filt.type = 'lowpass'; N.filt.Q.value = 6;
      N.zerr = ac.createWaveShaper(); N.zerr.oversample = '2x';
      N.vca = ac.createGain(); N.vca.gain.value = 0;
      // Breite: Stereo erzwingen (Synth ist mono), rechter Kanal leicht verzögert (Haas), dazu im Synth Panorama nach ↔
      N.st = ac.createGain(); N.st.channelCount = 2; N.st.channelCountMode = 'explicit'; N.st.channelInterpretation = 'speakers';
      N.spl = ac.createChannelSplitter(2); N.mer = ac.createChannelMerger(2); N.haas = ac.createDelay(0.05);
      N.pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
      N.trocken = ac.createGain(); N.nass = ac.createGain(); N.delay = ac.createDelay(1.5); N.fb = ac.createGain();
      N.delay.delayTime.value = 0.32; N.fb.gain.value = 0.38;
      N.out = ac.createGain(); N.out.gain.value = 0.7; N.ana = ac.createAnalyser(); N.ana.fftSize = 1024; N.ana.smoothingTimeConstant = 0.8;
      N.o1.connect(m1); N.o2.connect(m2); N.sub.connect(m3); m1.connect(N.synth); m2.connect(N.synth); m3.connect(N.synth);
      N.synth.connect(N.filt); N.datei.connect(N.filt);
      N.filt.connect(N.zerr); N.zerr.connect(N.vca); N.vca.connect(N.st); N.st.connect(N.spl);
      N.spl.connect(N.mer, 0, 0); N.spl.connect(N.haas, 1); N.haas.connect(N.mer, 0, 1); N.mer.connect(N.pan);
      N.pan.connect(N.trocken); N.pan.connect(N.delay); N.delay.connect(N.fb); N.fb.connect(N.delay); N.delay.connect(N.nass);
      N.trocken.connect(N.out); N.nass.connect(N.out); N.out.connect(N.ana); N.ana.connect(ac.destination);
      // Live: an den Effekten vorbei – eigener Analysator; Mikrofon nur in den Analysator, nie in die Lautsprecher
      N.live = ac.createGain(); N.live.gain.value = 0.6; N.ana2 = ac.createAnalyser(); N.ana2.fftSize = 1024; N.ana2.smoothingTimeConstant = 0.8;
      N.live.connect(N.ana2); N.ana2.connect(ac.destination);
      N.rausch = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); var d = N.rausch.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      N.o1.start(); N.o2.start(); N.sub.start(); effekte(); setze(true);
      ac.onstatechange = knoepfe;
      return true;
    }
    function kurve(k) { var n = 1024, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
    function ein(b) { return fx[b].getAttribute('aria-pressed') === 'true'; }
    function effekte() {
      if (!ac) return; var t = ac.currentTime;
      N.zerr.curve = ein('zerr') ? kurve(ansicht === 'datei' ? 4 : 8) : null;
      N.nass.gain.setTargetAtTime(ein('echo') ? 0.42 : 0, t, 0.05);
      N.haas.delayTime.setTargetAtTime(ein('breit') ? 0.018 : 0, t, 0.05);
      if ((!ein('breit') || ansicht !== 'synth') && N.pan.pan) N.pan.pan.setTargetAtTime(0, t, 0.05);
      setze(false);
    }
    function klingt() { return ansicht === 'synth' ? (aktiv || ein2()) : ansicht === 'datei' ? spielt : false; }
    function setze(sofort) {
      var mm = note(X), f = filterHz(Y), t = ac ? ac.currentTime : 0, g = sofort ? 0.001 : 0.035, r = tempo(X);
      if (ac) {
        N.o1.frequency.setTargetAtTime(hz(mm), t, g); N.o2.frequency.setTargetAtTime(hz(mm), t, g); N.sub.frequency.setTargetAtTime(hz(mm - 12), t, g);
        N.filt.frequency.setTargetAtTime(f, t, 0.03); N.filt.Q.setTargetAtTime(ansicht === 'datei' ? 0.9 : 6, t, 0.05);
        if (ansicht === 'synth' && ein('breit') && N.pan.pan) N.pan.pan.setTargetAtTime((X - 0.5) * 1.6, t, 0.05);
        var v = ansicht === 'synth' ? (aktiv || ein2() ? 0.5 : 0) : ansicht === 'datei' ? 0.9 : 0;
        N.vca.gain.setTargetAtTime(v, t, aktiv ? 0.02 : 0.25);
        if (ansicht === 'datei') setzeRate(r);
      }
      zeilen.x.i.style.width = Math.round(X * 100) + '%';
      zeilen.x.c.textContent = ansicht === 'synth' ? NOTEN[mm % 12] + (Math.floor(mm / 12) - 1) : ansicht === 'datei' ? r.toFixed(2) + '×' : Math.round(X * 100) + ' %';
      zeilen.y.i.style.width = Math.round(Y * 100) + '%'; zeilen.y.c.textContent = Math.round(Y * 100) + ' %';
      zeilen.f.i.style.width = Math.round(Y * 100) + '%'; zeilen.f.c.textContent = f >= 1000 ? (f / 1000).toFixed(1) + ' kHz' : Math.round(f) + ' Hz';
      var cc74 = Math.round(Y * 127), cc1 = Math.round(Math.abs(X - 0.5) * 2 * 127);
      midi.textContent = 'CC 74  Filter      ' + String(cc74).padStart(3) + '\nCC  1  Modulation  ' + String(cc1).padStart(3) +
        '\nNote   ' + (ansicht === 'synth' && klingt() ? NOTEN[mm % 12] + (Math.floor(mm / 12) - 1) + '  an' : '–');
    }
    function ein2() { return halt.getAttribute('aria-pressed') === 'true' || quelle === 'neigung'; }

    // ---- Datei: bleibt im Browser, wird nur dekodiert ----
    function jetztPos() { return puffer ? (pos + (quelleD ? (ac.currentTime - t0) * rate : 0)) % puffer.duration : 0; }
    function setzeRate(r) { if (quelleD) { pos += (ac.currentTime - t0) * rate; t0 = ac.currentTime; quelleD.playbackRate.value = r; } rate = r; }
    function dateiStart() {
      if (!puffer || !audio()) return;
      if (quelleD) dateiStop();
      var s = ac.createBufferSource(); s.buffer = puffer; s.loop = true; rate = tempo(X); s.playbackRate.value = rate;
      s.connect(N.datei); s.start(0, pos % puffer.duration); t0 = ac.currentTime; quelleD = s; spielt = true; setze(false); knoepfe();
    }
    function dateiStop() {
      if (!quelleD) { spielt = false; knoepfe(); return; }
      pos = jetztPos(); try { quelleD.stop(); } catch (e) { /* schon gestoppt */ } quelleD.disconnect(); quelleD = null; spielt = false; setze(false); knoepfe();
    }
    waehl.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (!audio()) return;
      dateiStop(); name.removeAttribute('translate'); name.textContent = 'Datei wird gelesen …';
      f.arrayBuffer().then(function (b) { return new Promise(function (ok, nein) { ac.decodeAudioData(b, ok, nein); }); }).then(function (p) {
        puffer = p; pos = 0; name.setAttribute('translate', 'no');
        var s = Math.round(p.duration); name.textContent = f.name + ' · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
        hinweis(); if (ansicht === 'datei') dateiStart();
      }).catch(function () { puffer = null; name.removeAttribute('translate'); name.textContent = 'Diese Datei kann der Browser nicht lesen.'; hinweis(); knoepfe(); });
      inp.value = '';
    });
    spiel.addEventListener('click', function () {
      if (!puffer) { inp.click(); return; }
      if (spielt && ac.state !== 'running') { ac.resume(); return; }
      if (spielt) dateiStop(); else dateiStart();
    });

    // ---- Live: Emulation (wie eine fremde App) und Mikrofon (nur Anzeige) ----
    function ton(typ, t, a, b) {
      var g = ac.createGain(); g.connect(N.live);
      if (typ === 'kick') { var o = ac.createOscillator(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
        g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g); o.start(t); o.stop(t + 0.32); return; }
      if (typ === 'hat' || typ === 'snare') { var n = ac.createBufferSource(), fl = ac.createBiquadFilter(); n.buffer = N.rausch;
        fl.type = typ === 'hat' ? 'highpass' : 'bandpass'; fl.frequency.value = typ === 'hat' ? 7000 : 1800;
        var dauer = typ === 'hat' ? 0.05 : 0.16; g.gain.setValueAtTime(typ === 'hat' ? 0.22 : 0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer);
        n.connect(fl); fl.connect(g); n.start(t, Math.random() * 0.5); n.stop(t + dauer + 0.02); return; }
      var s = ac.createOscillator(), lp = ac.createBiquadFilter(); s.type = 'sawtooth'; s.frequency.value = hz(a); lp.type = 'lowpass'; lp.frequency.value = 900;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + b); s.connect(lp); lp.connect(g); s.start(t); s.stop(t + b + 0.02);
    }
    var BASS = [45, 0, 45, 48, 0, 45, 52, 0, 43, 0, 43, 47, 0, 43, 50, 0];
    function emuStart() {
      if (!audio()) return; var sz = 60 / 112 / 4; emu = { s: 0, t: ac.currentTime + 0.06 };
      emu.timer = setInterval(function () {
        if (ac.state !== 'running') return;
        while (emu.t < ac.currentTime + 0.12) { var s = emu.s, t = emu.t;
          if (s % 4 === 0) ton('kick', t); if (s % 4 === 2) ton('hat', t); if (s === 4 || s === 12) ton('snare', t); if (BASS[s]) ton('bass', t, BASS[s], sz * 0.9);
          emu.t += sz; emu.s = (s + 1) % 16; }
      }, 25);
      knoepfe();
    }
    function emuStop() { if (emu) { clearInterval(emu.timer); emu = null; } knoepfe(); }
    emuK.addEventListener('click', function () { if (emu) emuStop(); else emuStart(); });
    function mikStop() { if (mik) { mik.q.disconnect(); mik.s.getTracks().forEach(function (t) { t.stop(); }); mik = null; } knoepfe(); }
    mikK.addEventListener('click', function () {
      if (mik) { mikStop(); return; }
      if (!audio()) return;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { info.textContent = 'Mikrofon nicht erlaubt.'; return; }
      navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(function (s) {
        if (ansicht !== 'live') { s.getTracks().forEach(function (t) { t.stop(); }); return; }
        var q = ac.createMediaStreamSource(s); q.connect(N.ana2); mik = { s: s, q: q };   // nur Analysator → keine Rückkopplung
        info.textContent = 'Mikrofon hört den Raum – nur Anzeige, nichts wird aufgenommen.'; knoepfe();
      }).catch(function () { info.textContent = 'Mikrofon nicht erlaubt.'; });
    });

    // ---- Ansichten ----
    var INFO = {
      synth: 'Am Handy: „Handy neigen“ antippen und erlauben. Am PC: mit der Maus über die Fläche ziehen.',
      datei: 'Die Datei bleibt in deinem Browser – nichts wird hochgeladen.',
      live: 'Ein Browser hört andere Apps nicht. Die Emulation spielt wie eine fremde App – Effekte und Fläche ändern daran nichts, die Anzeige läuft mit.'
    };
    function hinweis() {
      hin.textContent = ansicht === 'synth' ? (ac ? 'Ziehen: ↔ Tonhöhe · ↕ Filter' : 'Erst „Klang an“, dann hier ziehen')
        : ansicht === 'datei' ? (puffer ? 'Ziehen: ↔ Tempo · ↕ Filter' : 'Erst eine Datei wählen') : 'Live: nur anzeigen – Effekte greifen nicht';
    }
    function knoepfe() {
      var laeuft = !!ac && ac.state === 'running';
      an.textContent = laeuft ? '■ Klang aus' : '▶ Klang an';
      spiel.textContent = spielt && laeuft ? '❚❚ Anhalten' : '▶ Abspielen';
      emuK.textContent = emu ? '■ Emulation aus' : '▶ Emulation'; emuK.setAttribute('aria-pressed', emu ? 'true' : 'false');
      mikK.textContent = mik ? '■ Mikrofon aus' : 'Mikrofon'; mikK.setAttribute('aria-pressed', mik ? 'true' : 'false');
    }
    function zeige(a) {
      if (a === ansicht) return;
      var alt = ansicht; ansicht = a;
      if (alt === 'datei') dateiStop();
      if (alt === 'live') { emuStop(); mikStop(); }
      ANSICHTEN.forEach(function (k) { tab[k].setAttribute('aria-selected', k === a ? 'true' : 'false'); gruppe[k].forEach(function (b) { b.hidden = k !== a; }); });
      name.hidden = a !== 'datei'; fxLive.hidden = a !== 'live';
      Object.keys(fx).forEach(function (k) { if (a === 'live') fx[k].setAttribute('aria-disabled', 'true'); else fx[k].removeAttribute('aria-disabled'); });
      info.textContent = INFO[a];
      if (a === 'synth') { X = 0.5; Y = 0.6; } else if (a === 'datei') { X = 0.5; Y = 1; }
      pad.setAttribute('aria-label', a === 'datei' ? 'Klangfläche: ziehen = Tempo und Filter' : 'Klangfläche: ziehen = Tonhöhe und Filter');
      if (ac) N.synth.gain.setTargetAtTime(a === 'synth' ? 1 : 0, ac.currentTime, 0.03);
      effekte(); hinweis(); setze(false); knoepfe();
    }
    ANSICHTEN.forEach(function (k) { gruppe[k].forEach(function (b) { b.hidden = k !== 'synth'; }); });
    name.hidden = true;

    // Wischen (ausserhalb der Fläche): links/rechts = nächste/vorige Ansicht
    var wisch = null;
    block.addEventListener('pointerdown', function (e) { wisch = e.pointerType === 'mouse' || pad.contains(e.target) ? null : { x: e.clientX, y: e.clientY }; });
    block.addEventListener('pointerup', function (e) {
      if (!wisch) return; var dx = e.clientX - wisch.x, dy = e.clientY - wisch.y; wisch = null;
      if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
      var i = ANSICHTEN.indexOf(ansicht) + (dx < 0 ? 1 : -1); if (i >= 0 && i < ANSICHTEN.length) zeige(ANSICHTEN[i]);
    });
    block.addEventListener('pointercancel', function () { wisch = null; });
    reiter.addEventListener('keydown', function (e) {   // Pfeiltasten im Reiter
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var i = (ANSICHTEN.indexOf(ansicht) + (e.key === 'ArrowRight' ? 1 : 2)) % 3; zeige(ANSICHTEN[i]); tab[ANSICHTEN[i]].focus(); e.preventDefault();
    });

    an.addEventListener('click', function () {
      if (!ac) { if (audio()) { hinweis(); knoepfe(); } return; }
      if (ac.state === 'running') ac.suspend(); else ac.resume();
    });
    halt.addEventListener('click', function () { halt.setAttribute('aria-pressed', halt.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); setze(false); });

    // ---- Fläche ----
    function lage(e) { var r = pad.getBoundingClientRect(); X = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); Y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)); }
    pad.addEventListener('pointerdown', function (e) {
      if (!ac && ansicht === 'synth') { if (audio()) { hinweis(); knoepfe(); } }
      pad.setPointerCapture(e.pointerId); aktiv = true; lage(e); setze(false); e.preventDefault();
    });
    pad.addEventListener('pointermove', function (e) { if (!aktiv) return; lage(e); setze(false); });
    function los() { aktiv = false; setze(false); }
    pad.addEventListener('pointerup', los); pad.addEventListener('pointercancel', los);

    // ---- Neigung (Handy) ----
    function orient(e) {
      if (quelle !== 'neigung' || e.gamma == null) return;
      X = Math.min(1, Math.max(0, (e.gamma + 40) / 80));          // links/rechts kippen
      Y = Math.min(1, Math.max(0, (70 - e.beta) / 70));           // flach = offen, aufrecht = zu
      setze(false);
    }
    neig.addEventListener('click', function () {
      if (quelle === 'neigung') { quelle = 'pad'; neig.setAttribute('aria-pressed', 'false'); setze(false); return; }
      if (!ac && ansicht === 'synth') { if (audio()) { hinweis(); knoepfe(); } }
      var D = window.DeviceOrientationEvent;
      if (!D) { info.textContent = 'Dieses Gerät meldet keine Neigung – am PC die Fläche ziehen.'; return; }
      var los2 = function () { quelle = 'neigung'; neig.setAttribute('aria-pressed', 'true'); info.textContent = 'Handy neigen: links/rechts = Tonhöhe, flach/aufrecht = Filter.'; window.addEventListener('deviceorientation', orient); setze(false); };
      if (typeof D.requestPermission === 'function') D.requestPermission().then(function (r) { if (r === 'granted') los2(); else info.textContent = 'Neigung nicht erlaubt.'; }).catch(function () { info.textContent = 'Neigung nicht erlaubt.'; });
      else los2();
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && ac && ac.state === 'running') ac.suspend(); });

    // ---- Bild ----
    var g = cv.getContext('2d'), daten = null;
    function malen() {
      var r = pad.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      g.clearRect(0, 0, w, h); g.lineWidth = 1 * dpr;
      if (ansicht === 'synth') {
        var stufen = SKALA.length * 2;
        for (var i = 0; i <= stufen; i++) { var x = (i + 0.5) / (stufen + 1) * w; g.strokeStyle = i % SKALA.length === 0 ? rgba(.22) : 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      } else if (ansicht === 'datei') {   // Tempo: Mitte = 1×, Rastzone hell
        g.fillStyle = rgba(.07); g.fillRect(0.45 * w, 0, 0.1 * w, h);
        g.strokeStyle = rgba(.25); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
        if (puffer) { g.fillStyle = rgba(.18); g.fillRect(0, 0, w, 3 * dpr); g.fillStyle = gold; g.fillRect(0, 0, jetztPos() / puffer.duration * w, 3 * dpr); }
      }
      for (var j = 1; j < 4; j++) { var y = j / 4 * h; g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      var ana = ansicht === 'live' ? N.ana2 : N.ana;
      if (ac && ana) {   // 8 Bänder wie der Motion-EQ; Live gross (reine Anzeige)
        if (!daten) daten = new Uint8Array(ana.frequencyBinCount); ana.getByteFrequencyData(daten);
        var grenzen = [2, 4, 8, 16, 32, 64, 128, 256, 511], bw = w / 8, hoch = ansicht === 'live' ? 0.8 : 0.45;
        for (var b = 0; b < 8; b++) { var s = 0, n = 0; for (var q = grenzen[b]; q < grenzen[b + 1]; q++) { s += daten[q]; n++; } var v = s / n / 255;
          g.fillStyle = rgba(0.10 + v * 0.35); g.fillRect(b * bw + 3 * dpr, h - v * h * hoch, bw - 6 * dpr, v * h * hoch); }
      }
      var on = ansicht === 'live' ? aktiv || quelle === 'neigung' : klingt() || aktiv;
      spur.push([X, Y, on]); if (spur.length > 40) spur.shift();
      for (var k = 1; k < spur.length; k++) { if (!spur[k][2]) continue; g.strokeStyle = rgba(k / spur.length * 0.6); g.lineWidth = (2 + k / spur.length * 4) * dpr;
        g.beginPath(); g.moveTo(spur[k - 1][0] * w, (1 - spur[k - 1][1]) * h); g.lineTo(spur[k][0] * w, (1 - spur[k][1]) * h); g.stroke(); }
      var px = X * w, py = (1 - Y) * h;
      g.fillStyle = on ? gold : rgba(.45); g.beginPath(); g.arc(px, py, (on ? 11 : 8) * dpr, 0, Math.PI * 2); g.fill();
      if (on) { g.strokeStyle = rgba(.35); g.lineWidth = 2 * dpr; g.beginPath(); g.arc(px, py, 22 * dpr, 0, Math.PI * 2); g.stroke(); }
      requestAnimationFrame(malen);
    }
    setze(false); requestAnimationFrame(malen);
  }
  (window.CaelumModul = window.CaelumModul || {})['motion-web'] = start;
  document.dispatchEvent(new CustomEvent('caelum-modul', { detail: 'motion-web' }));
})();
