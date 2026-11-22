// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Sound Design: „Caelum Motion im Browser“ – Prototyp (Motion ROADMAP Schritt 4). Bewegung wird Klang, ganz im Browser:
// Fläche ziehen (Maus/Finger) oder Handy neigen (DeviceOrientation, HTTPS) → Tonhöhe (links/rechts, Pentatonik) und Filter (oben/unten).
// Effekte wie in der App: Echo, Verzerrer, Breite. Daneben die MIDI-Vorschau: was das Plugin in Ableton daraus machen würde.
// Web Audio, kein Server, nichts wird gespeichert oder gesendet.
// KI-Beitrag (Claude, GB-7), 22.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function knopf(text, cls) { var b = el('button', cls, text); b.type = 'button'; return b; }
  var NOTEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
  var SKALA = [0, 3, 5, 7, 10];   // Moll-Pentatonik – jede Lage klingt
  var GRUND = 45;                 // A2

  function start(platz, farbe) {
    var gold = '#E8C547', rgb = '232,197,71', m = String(farbe || '').match(/^#([0-9a-f]{6})$|^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);   // Zeichenfarbe: #rrggbb oder rgb(…)
    if (m) { gold = farbe; rgb = m[1] ? [0, 2, 4].map(function (i) { return parseInt(m[1].substr(i, 2), 16); }).join(',') : [m[2], m[3], m[4]].join(','); }
    function rgba(a) { return 'rgba(' + rgb + ',' + a + ')'; }
    var block = el('div', 'motion-block'); block.id = 'motion'; block.style.setProperty('--c-motion', gold);
    block.appendChild(el('h2', null, 'Caelum Motion im Browser'));
    block.appendChild(el('p', 'lead', 'Der Prototyp zum Ausprobieren: Fläche ziehen oder Handy neigen – links/rechts ist die Tonhöhe, oben/unten der Filter. In Ableton macht das Plugin genau daraus Steuerdaten.'));
    var wrap = el('div', 'motion');
    var pad = el('div', 'pad'), cv = el('canvas'), hin = el('p', 'hinweis', 'Erst „Klang an“, dann hier ziehen');
    pad.setAttribute('role', 'application'); pad.setAttribute('aria-label', 'Klangfläche: ziehen = Tonhöhe und Filter');
    pad.appendChild(cv); pad.appendChild(hin); wrap.appendChild(pad);

    var seite = el('div', 'seite');
    var k1 = el('div', 'karte'); k1.appendChild(el('h3', null, 'Steuern'));
    var r1 = el('div', 'knoepfe'), an = knopf('▶ Klang an', 'gross'), neig = knopf('📱 Handy neigen'), halt = knopf('Halten');
    neig.setAttribute('aria-pressed', 'false'); halt.setAttribute('aria-pressed', 'false');
    r1.appendChild(an); r1.appendChild(neig); r1.appendChild(halt); k1.appendChild(r1);
    var info = el('p', 'klein', 'Am Handy: „Handy neigen“ antippen und erlauben. Am PC: mit der Maus über die Fläche ziehen.'); k1.appendChild(info);
    seite.appendChild(k1);

    var k2 = el('div', 'karte'); k2.appendChild(el('h3', null, 'Effekte'));
    var r2 = el('div', 'knoepfe'), fx = {};
    [['echo', 'Echo'], ['zerr', 'Verzerrer'], ['breit', 'Breite']].forEach(function (p) {
      var b = knopf(p[1]); b.setAttribute('aria-pressed', p[0] === 'echo' ? 'true' : 'false'); fx[p[0]] = b; r2.appendChild(b);
      b.addEventListener('click', function () { b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); effekte(); });
    });
    k2.appendChild(r2); seite.appendChild(k2);

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
    var X = 0.5, Y = 0.6, aktiv = false, quelle = 'pad', spur = [], ac = null, N = {};
    function note(x) { var i = Math.round(x * (SKALA.length * 2)); var o = Math.floor(i / SKALA.length), s = i % SKALA.length; return GRUND + o * 12 + SKALA[s]; }
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function filterHz(y) { return 180 * Math.pow(9000 / 180, y); }

    function audio() {
      if (ac) return;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) { info.textContent = 'Dieser Browser kann kein Web Audio.'; return; }
      ac = new AC();
      N.o1 = ac.createOscillator(); N.o1.type = 'sawtooth';
      N.o2 = ac.createOscillator(); N.o2.type = 'square'; N.o2.detune.value = 7;
      N.sub = ac.createOscillator(); N.sub.type = 'sine';
      var m1 = ac.createGain(), m2 = ac.createGain(), m3 = ac.createGain(); m1.gain.value = 0.32; m2.gain.value = 0.16; m3.gain.value = 0.28;
      N.filt = ac.createBiquadFilter(); N.filt.type = 'lowpass'; N.filt.Q.value = 6;
      N.zerr = ac.createWaveShaper(); N.zerr.oversample = '2x';
      N.vca = ac.createGain(); N.vca.gain.value = 0;
      N.pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
      N.trocken = ac.createGain(); N.nass = ac.createGain(); N.delay = ac.createDelay(1.5); N.fb = ac.createGain();
      N.delay.delayTime.value = 0.32; N.fb.gain.value = 0.38;
      N.out = ac.createGain(); N.out.gain.value = 0.7; N.ana = ac.createAnalyser(); N.ana.fftSize = 1024; N.ana.smoothingTimeConstant = 0.8;
      N.o1.connect(m1); N.o2.connect(m2); N.sub.connect(m3); m1.connect(N.filt); m2.connect(N.filt); m3.connect(N.filt);
      N.filt.connect(N.zerr); N.zerr.connect(N.vca); N.vca.connect(N.pan);
      N.pan.connect(N.trocken); N.pan.connect(N.delay); N.delay.connect(N.fb); N.fb.connect(N.delay); N.delay.connect(N.nass);
      N.trocken.connect(N.out); N.nass.connect(N.out); N.out.connect(N.ana); N.ana.connect(ac.destination);
      N.o1.start(); N.o2.start(); N.sub.start(); effekte(); setze(true);
    }
    function kurve(k) { var n = 1024, c = new Float32Array(n); for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); } return c; }
    function ein(b) { return fx[b].getAttribute('aria-pressed') === 'true'; }
    function effekte() {
      if (!ac) return; var t = ac.currentTime;
      N.zerr.curve = ein('zerr') ? kurve(8) : null;
      N.nass.gain.setTargetAtTime(ein('echo') ? 0.42 : 0, t, 0.05);
      if (!ein('breit') && N.pan.pan) N.pan.pan.setTargetAtTime(0, t, 0.05);
      setze(false);
    }
    function setze(sofort) {
      var m = note(X), f = filterHz(Y), t = ac ? ac.currentTime : 0, g = sofort ? 0.001 : 0.035;
      if (ac) {
        N.o1.frequency.setTargetAtTime(hz(m), t, g); N.o2.frequency.setTargetAtTime(hz(m), t, g); N.sub.frequency.setTargetAtTime(hz(m - 12), t, g);
        N.filt.frequency.setTargetAtTime(f, t, 0.03);
        if (ein('breit') && N.pan.pan) N.pan.pan.setTargetAtTime((X - 0.5) * 1.6, t, 0.05);
        N.vca.gain.setTargetAtTime(aktiv || ein2() ? 0.5 : 0, t, aktiv ? 0.02 : 0.25);
      }
      zeilen.x.i.style.width = Math.round(X * 100) + '%'; zeilen.x.c.textContent = NOTEN[m % 12] + (Math.floor(m / 12) - 1);
      zeilen.y.i.style.width = Math.round(Y * 100) + '%'; zeilen.y.c.textContent = Math.round(Y * 100) + ' %';
      zeilen.f.i.style.width = Math.round(Y * 100) + '%'; zeilen.f.c.textContent = f >= 1000 ? (f / 1000).toFixed(1) + ' kHz' : Math.round(f) + ' Hz';
      var cc74 = Math.round(Y * 127), cc1 = Math.round(Math.abs(X - 0.5) * 2 * 127);
      midi.textContent = 'CC 74  Filter      ' + String(cc74).padStart(3) + '\nCC  1  Modulation  ' + String(cc1).padStart(3) +
        '\nNote   ' + (aktiv || ein2() ? NOTEN[m % 12] + (Math.floor(m / 12) - 1) + '  an' : '–');
    }
    function ein2() { return halt.getAttribute('aria-pressed') === 'true' || quelle === 'neigung'; }

    an.addEventListener('click', function () {
      if (!ac) { audio(); if (!ac) return; an.textContent = '■ Klang aus'; hin.textContent = 'Ziehen: ↔ Tonhöhe · ↕ Filter'; return; }
      if (ac.state === 'running') { ac.suspend(); an.textContent = '▶ Klang an'; } else { ac.resume(); an.textContent = '■ Klang aus'; }
    });
    halt.addEventListener('click', function () { halt.setAttribute('aria-pressed', halt.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); setze(false); });

    // ---- Fläche ----
    function lage(e) { var r = pad.getBoundingClientRect(); X = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); Y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)); }
    pad.addEventListener('pointerdown', function (e) { if (!ac) { audio(); if (ac) { an.textContent = '■ Klang aus'; hin.textContent = 'Ziehen: ↔ Tonhöhe · ↕ Filter'; } } pad.setPointerCapture(e.pointerId); aktiv = true; lage(e); setze(false); e.preventDefault(); });
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
      if (!ac) { audio(); if (ac) an.textContent = '■ Klang aus'; }
      var D = window.DeviceOrientationEvent;
      if (!D) { info.textContent = 'Dieses Gerät meldet keine Neigung – am PC die Fläche ziehen.'; return; }
      var los2 = function () { quelle = 'neigung'; neig.setAttribute('aria-pressed', 'true'); info.textContent = 'Handy neigen: links/rechts = Tonhöhe, flach/aufrecht = Filter.'; window.addEventListener('deviceorientation', orient); setze(false); };
      if (typeof D.requestPermission === 'function') D.requestPermission().then(function (r) { if (r === 'granted') los2(); else info.textContent = 'Neigung nicht erlaubt.'; }).catch(function () { info.textContent = 'Neigung nicht erlaubt.'; });
      else los2();
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden && ac && ac.state === 'running') { ac.suspend(); an.textContent = '▶ Klang an'; } });

    // ---- Bild ----
    var g = cv.getContext('2d'), daten = null;
    function malen() {
      var r = pad.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      g.clearRect(0, 0, w, h);
      var stufen = SKALA.length * 2; g.lineWidth = 1 * dpr;
      for (var i = 0; i <= stufen; i++) { var x = (i + 0.5) / (stufen + 1) * w; g.strokeStyle = i % SKALA.length === 0 ? rgba(.22) : 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (var j = 1; j < 4; j++) { var y = j / 4 * h; g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      if (ac && N.ana) {   // 8 Bänder wie der Motion-EQ
        if (!daten) daten = new Uint8Array(N.ana.frequencyBinCount); N.ana.getByteFrequencyData(daten);
        var grenzen = [2, 4, 8, 16, 32, 64, 128, 256, 511], bw = w / 8;
        for (var b = 0; b < 8; b++) { var s = 0, n = 0; for (var q = grenzen[b]; q < grenzen[b + 1]; q++) { s += daten[q]; n++; } var v = s / n / 255;
          g.fillStyle = rgba(0.10 + v * 0.35); g.fillRect(b * bw + 3 * dpr, h - v * h * 0.45, bw - 6 * dpr, v * h * 0.45); }
      }
      spur.push([X, Y, aktiv || ein2()]); if (spur.length > 40) spur.shift();
      for (var k = 1; k < spur.length; k++) { if (!spur[k][2]) continue; g.strokeStyle = rgba(k / spur.length * 0.6); g.lineWidth = (2 + k / spur.length * 4) * dpr;
        g.beginPath(); g.moveTo(spur[k - 1][0] * w, (1 - spur[k - 1][1]) * h); g.lineTo(spur[k][0] * w, (1 - spur[k][1]) * h); g.stroke(); }
      var px = X * w, py = (1 - Y) * h, on = aktiv || ein2();
      g.fillStyle = on ? gold : rgba(.45); g.beginPath(); g.arc(px, py, (on ? 11 : 8) * dpr, 0, Math.PI * 2); g.fill();
      if (on) { g.strokeStyle = rgba(.35); g.lineWidth = 2 * dpr; g.beginPath(); g.arc(px, py, 22 * dpr, 0, Math.PI * 2); g.stroke(); }
      requestAnimationFrame(malen);
    }
    setze(false); requestAnimationFrame(malen);
  }
  (window.CaelumModul = window.CaelumModul || {})['motion-web'] = start;
  document.dispatchEvent(new CustomEvent('caelum-modul', { detail: 'motion-web' }));
})();
