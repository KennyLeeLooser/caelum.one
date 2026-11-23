// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Sound Design: „Drum & 808“ – Klangkern im Browser. 16 Drum-Stimmen, rein gerechnet (keine Samples), Rechenweg 1:1 aus der App
// (CaelumMotion/android/src/one/caelum/motion/Klang808.java, Analyse KLANG-ANALYSE.md §2) – eine Quelle für App und Web.
//   Bass Drum   gedämpfter Sinus (Bridged-T) ≈ 52 Hz mit Tonhöhen-Sturz + Klick, weich übersteuert
//   Snare       238 / 476 Hz + hochpass-gefiltertes Rauschen · Toms/Congas Sinus mit Gleiten · Rim Shot 455 + 1667 Hz · Claves 2,5 kHz
//   Hand Clap   Rauschen durch Bandpass ≈ 1,1 kHz, drei Stösse + Fahne
//   Metall      sechs Rechteck-Oszillatoren 205,3 / 304,4 / 369,6 / 522,7 / 540 / 800 Hz (PolyBLEP) → Hats, Cymbal; Cowbell 540 + 800 Hz
//   Closed Hat würgt Open Hat ab. Je Stimme: Ton (±7 Halbtöne), Länge, Pegel; Anschlag 0…1.
// Jede Stimme wird beim ersten Anschlag einmal in einen AudioBuffer gerechnet (Zwischenspeicher je Ton/Länge) und dann als
// AudioBufferSourceNode abgespielt – das geht live und in einer OfflineAudioContext (● Loop) gleich.
// Schnittstelle: window.CaelumDrum808 (im Browser) bzw. module.exports (Node, Prüfung). Nichts wird gesendet oder gespeichert.
// KI-Beitrag (Claude, GB-7), 23.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8). v1: Klangkern (Strang Drum & 808, Schritt 1).
// v2: Karte „Drum & 808“ (Modul drum808) mit 16 Pads + Ton/Länge/Pegel der gewählten Stimme (Schritt 2).
// v4: Regler „Lautstärke“ für die Pads statt „■ Stille“ (Wunsch Kenny 23.11.2026), wirkt live und im ● Loop.
// v3: Schritt 3 – das Motion-Fenster setzt ausgang()/angeschlagen(); ein später geplanter Anschlag wird nicht abgewürgt.
(function (wurzel) {
  'use strict';
  var BD = 0, RS = 1, SD = 2, CP = 3, CL = 4, LT = 5, CH = 6, MT = 7, MA = 8, HT = 9, OH = 10, LC = 11, MC = 12, CY = 13, HC = 14, CB = 15, ANZAHL = 16;
  // Reihenfolge = Pad 1 … 16 (Pad 1 unten links) = MIDI-Note 36 … 51, wie in der App
  var KURZ = ['BD', 'RS', 'SD', 'CP', 'CL', 'LT', 'CH', 'MT', 'MA', 'HT', 'OH', 'LC', 'MC', 'CY', 'HC', 'CB'];
  var NAME = ['Bass Drum', 'Rim Shot', 'Snare', 'Hand Clap', 'Claves', 'Low Tom', 'Closed Hat', 'Mid Tom',
    'Maracas', 'High Tom', 'Open Hat', 'Low Conga', 'Mid Conga', 'Cymbal', 'High Conga', 'Cowbell'];
  var METALL = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
  var PI2 = 2 * Math.PI;

  function klemm(v) { v = Number(v); return v > 0 ? (v < 1 ? v : 1) : 0; }
  function span(min, max, L) { return min * Math.pow(max / min, klemm(L)); }
  function tanh(x) { if (Math.tanh) return Math.tanh(x); var e = Math.exp(2 * x); return (e - 1) / (e + 1); }

  // Biquad nach RBJ (gleich wie Klang808.Bq)
  function Bq() { this.b0 = this.b1 = this.b2 = this.a1 = this.a2 = 0; this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  Bq.prototype.setzen = function (b0, b1, b2, a0, a1, a2) {
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; this.x1 = this.x2 = this.y1 = this.y2 = 0; return this;
  };
  Bq.prototype.bp = function (f, q, sr) {
    f = Math.min(f, sr * 0.45); var w = PI2 * f / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
    return this.setzen(al, 0, -al, 1 + al, -2 * c, 1 - al);
  };
  Bq.prototype.hp = function (f, q, sr) {
    f = Math.min(f, sr * 0.45); var w = PI2 * f / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
    return this.setzen((1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + al, -2 * c, 1 - al);
  };
  Bq.prototype.lp = function (f, q, sr) {
    f = Math.min(f, sr * 0.45); var w = PI2 * f / sr, al = Math.sin(w) / (2 * q), c = Math.cos(w);
    return this.setzen((1 - c) / 2, 1 - c, (1 - c) / 2, 1 + al, -2 * c, 1 - al);
  };
  Bq.prototype.p = function (x) {
    var y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
  };

  // Rechteck mit PolyBLEP (Phase 0…1, Schritt d)
  function blep(t, d) {
    if (t < d) { t /= d; return t + t - t * t - 1; }
    if (t > 1 - d) { t = (t - 1) / d; return t * t + t + t + 1; }
    return 0;
  }
  function rechteck(ph, d) {
    var v = ph < 0.5 ? 1 : -1; v += blep(ph, d);
    var p2 = ph + 0.5; if (p2 >= 1) p2 -= 1;
    return v - blep(p2, d);
  }

  // Eine Stimme rechnen: roher Verlauf ohne Pegel/Anschlag (die wirken linear beim Abspielen), mono, −1…1.
  // Länge wie in der App: bis e^−9,5 (≈ −83 dB), mindestens 20 ms.
  function rechnen(i, ton, laenge, sr) {
    i = i | 0; if (i < 0 || i >= ANZAHL) return new Float32Array(1);
    sr = sr || 48000; ton = ton == null ? 0.5 : klemm(ton); laenge = laenge == null ? 0.5 : klemm(laenge);
    var tf = Math.pow(2, (ton - 0.5) * 14 / 12), L = laenge, tau = 0.1, f1 = new Bq(), f2 = new Bq();
    switch (i) {
      case BD: tau = span(0.07, 1.1, L); break;
      case SD: tau = span(0.05, 0.32, L); f1.hp(1800, 0.7, sr); break;
      case LT: case MT: case HT: tau = span(0.10, 0.65, L); f1.lp(1200, 0.7, sr); break;
      case LC: case MC: case HC: tau = span(0.05, 0.35, L); break;
      case RS: tau = span(0.004, 0.03, L); f1.hp(500, 0.7, sr); break;
      case CL: tau = span(0.01, 0.07, L); break;
      case CP: tau = span(0.05, 0.45, L); f1.bp(1100 * tf, 1.4, sr); break;
      case MA: tau = span(0.012, 0.09, L); f1.hp(5000 * tf, 0.7, sr); break;
      case CH: tau = span(0.012, 0.09, L); f1.bp(7100, 1.2, sr); f2.hp(6000, 0.7, sr); break;
      case OH: tau = span(0.10, 0.9, L); f1.bp(7100, 1.2, sr); f2.hp(6000, 0.7, sr); break;
      case CY: tau = span(0.35, 2.2, L); f1.bp(3440, 1.0, sr); f2.hp(7100, 0.7, sr); break;
      case CB: tau = span(0.06, 0.45, L); f1.bp(2640 * tf, 2.2, sr); f2.bp(800 * tf, 3, sr); break;
    }
    var n = Math.max(Math.ceil(0.02 * sr), Math.ceil(tau * 9.5 * sr)) + 1, x = new Float32Array(n);
    var metall = i === CH || i === OH || i === CY, metPh = [0, 0, 0, 0, 0, 0], rausch = 0x1234567, ph1 = 0, ph2 = 0, dt = 1 / sr;
    function rauschen() { var r = rausch; r ^= r << 13; r ^= r >>> 17; r ^= r << 5; rausch = r | 0; return rausch / 2147483648; }
    var tt = -dt;   // Zeit aufsummiert wie in der App (t += dt), damit die Clap-Stösse auf denselben Abtastwert fallen
    for (var k = 0; k < n; k++) {
      tt = k ? tt + dt : 0; var e = Math.exp(-tt / tau), met = 0, v = 0, a, h, f;
      if (metall) {
        for (var m = 0; m < 6; m++) { var d = METALL[m] / sr; met += rechteck(metPh[m], d); metPh[m] += d; if (metPh[m] >= 1) metPh[m] -= 1; }
        met /= 6;
      }
      switch (i) {
        case BD:
          f = 52 * tf * (1 + 0.9 * Math.exp(-tt / 0.010)); ph1 += PI2 * f / sr;
          v = tanh(1.5 * (Math.sin(ph1) * e + Math.sin(PI2 * 1600 * tt) * Math.exp(-tt / 0.0012) * 0.3)) * 0.95; break;
        case SD:
          a = Math.sin(PI2 * 238 * tf * tt) * Math.exp(-tt / 0.05) * 0.55 + Math.sin(PI2 * 476 * tf * tt) * Math.exp(-tt / 0.035) * 0.3;
          v = a + f1.p(rauschen()) * e * 0.8; break;
        case LT: case MT: case HT:
          ph1 += PI2 * (i === LT ? 90 : i === MT ? 132 : 180) * tf * (1 + 0.25 * Math.exp(-tt / 0.04)) / sr;
          v = Math.sin(ph1) * e * 0.9 + f1.p(rauschen()) * Math.exp(-tt / 0.015) * 0.15; break;
        case LC: case MC: case HC:
          ph1 += PI2 * (i === LC ? 165 : i === MC ? 245 : 370) * tf * (1 + 0.1 * Math.exp(-tt / 0.02)) / sr;
          v = Math.sin(ph1) * e * 0.85; break;
        case RS:
          a = Math.sin(PI2 * 455 * tf * tt) + 0.6 * Math.sin(PI2 * 1667 * tf * tt);
          v = tanh(3 * f1.p(a) * e) * 0.6; break;
        case CL: v = Math.sin(PI2 * 2500 * tf * tt) * e * 0.7; break;
        case CP:
          if (tt < 0.0285) h = Math.exp(-(tt % 0.0095) / 0.0028); else h = 0.75 * Math.exp(-(tt - 0.0285) / tau);
          v = f1.p(rauschen()) * h * 1.6; break;
        case MA: v = f1.p(rauschen()) * Math.min(1, tt / 0.002) * e * 0.9; break;
        case CH: case OH: v = f2.p(f1.p(met)) * e * 1.8; break;
        case CY: v = f1.p(met) * Math.exp(-tt / (tau * 0.45)) * 0.9 + f2.p(met) * e * 1.3; break;
        case CB: {
          var d1 = 540 * tf / sr, d2 = 800 * tf / sr, q = rechteck(ph1, d1) + rechteck(ph2, d2);
          ph1 += d1; if (ph1 >= 1) ph1 -= 1; ph2 += d2; if (ph2 >= 1) ph2 -= 1;
          v = (f1.p(q) * 0.5 + f2.p(q) * 0.5) * (0.6 * Math.exp(-tt / 0.008) + 0.4 * e) * 0.9; break;
        }
      }
      x[k] = v;
    }
    return x;
  }

  // Ein Satz = 16 Stimmen mit Ton/Länge/Pegel (wie ein Klang808-Objekt der App). Spielt in jede AudioContext/OfflineAudioContext.
  function Satz() {
    this.ton = []; this.laenge = []; this.pegel = []; this.master = 0.8;
    for (var i = 0; i < ANZAHL; i++) { this.ton[i] = 0.5; this.laenge[i] = 0.5; this.pegel[i] = 0.8; }
    this.pegel[CY] = 0.6; this.pegel[OH] = 0.7; this.pegel[CH] = 0.7; this.pegel[MA] = 0.6; this.pegel[CB] = 0.6;
    this._puffer = {}; this._zahl = 0; this._laeuft = typeof WeakMap === 'function' ? new WeakMap() : null;
  }
  // AudioBuffer für Stimme i (Zwischenspeicher je Abtastrate/Ton/Länge, auf 1/100 gerundet; höchstens 96 Einträge)
  Satz.prototype.puffer = function (ctx, i) {
    var sr = ctx.sampleRate, tn = Math.round(this.ton[i] * 100), ln = Math.round(this.laenge[i] * 100), k = sr + ':' + i + ':' + tn + ':' + ln;
    var b = this._puffer[k];
    if (!b) {
      if (this._zahl >= 96) { this._puffer = {}; this._zahl = 0; }
      var x = rechnen(i, tn / 100, ln / 100, sr);
      b = ctx.createBuffer(1, x.length, sr); b.getChannelData(0).set(x);
      this._puffer[k] = b; this._zahl++;
    }
    return b;
  };
  // Alle 16 Puffer vorab rechnen, eine Stimme je Takt der Ereignisschleife (erster Pad-Tipp ruckelt nicht; alle 16 ≈ 0,15 s am PC)
  Satz.prototype.vorbereiten = function (ctx, fertig) {
    var self = this, i = 0;
    (function weiter() {
      if (i >= ANZAHL) { if (fertig) fertig(); return; }
      self.puffer(ctx, i++); setTimeout(weiter, 0);
    })();
  };
  // Stimme i zur Zeit t (Sekunden in ctx) mit Anschlag vel (0…1) nach ziel (AudioNode) spielen.
  // Wie in der App: jede Stimme ist einstimmig (neuer Anschlag beendet den alten), Closed Hat würgt Open Hat ab (≈ 3 ms).
  Satz.prototype.spielen = function (ctx, ziel, i, t, vel) {
    i = i | 0; if (i < 0 || i >= ANZAHL || !ctx || !ziel) return null;
    t = Math.max(t || 0, ctx.currentTime); vel = vel == null ? 1 : Math.max(0.05, Math.min(1, vel));
    var lauf = this._laeuftIn(ctx), alt = lauf[i];
    if (alt) abwuergen(alt, t, 0.0008);
    if (i === CH && lauf[OH]) { abwuergen(lauf[OH], t, 1 / (ctx.sampleRate * 0.007)); lauf[OH] = null; }
    var q = ctx.createBufferSource(), g = ctx.createGain();
    q.buffer = this.puffer(ctx, i);
    g.gain.value = this.pegel[i] * (0.35 + 0.65 * vel) * this.master;
    q.connect(g); g.connect(ziel); q.start(t);
    var st = { q: q, g: g, start: t, ende: t + q.buffer.duration };
    lauf[i] = st;
    q.onended = function () { if (lauf[i] === st) lauf[i] = null; try { g.disconnect(); } catch (x) { } };
    return q;
  };
  Satz.prototype._laeuftIn = function (ctx) {
    if (!this._laeuft) return this._lauf1 || (this._lauf1 = []);
    var l = this._laeuft.get(ctx); if (!l) { l = []; this._laeuft.set(ctx, l); } return l;
  };
  function abwuergen(st, t, zeitk) {
    if (t >= st.ende || t < st.start) return;   // verklungen, oder erst später geplant (Sequenzer plant voraus) – dann klingen beide
    try { st.g.gain.cancelScheduledValues(t); st.g.gain.setTargetAtTime(0, t, zeitk); st.q.stop(t + zeitk * 8 + 0.002); } catch (x) { }
  }
  // Alles sofort stumm (z. B. Stopp)
  Satz.prototype.stille = function (ctx) {
    var l = this._laeuftIn(ctx), t = ctx.currentTime;
    for (var i = 0; i < ANZAHL; i++) if (l[i]) { abwuergen(l[i], t, 0.005); l[i] = null; }
  };
  // Speichern/Laden im selben Text wie die App (ton;laenge;pegel je Stimme, durch Komma getrennt)
  Satz.prototype.speichern = function () {
    var s = [];
    for (var i = 0; i < ANZAHL; i++) s.push(this.ton[i].toFixed(3) + ';' + this.laenge[i].toFixed(3) + ';' + this.pegel[i].toFixed(3));
    return s.join(',');
  };
  Satz.prototype.laden = function (s) {
    if (!s) return false; var t = String(s).split(','); if (t.length !== ANZAHL) return false;
    var neu = [];
    for (var i = 0; i < ANZAHL; i++) {
      var w = t[i].split(';').map(Number); if (w.length < 3 || w.some(isNaN)) return false; neu.push(w);
    }
    for (i = 0; i < ANZAHL; i++) { this.ton[i] = klemm(neu[i][0]); this.laenge[i] = klemm(neu[i][1]); this.pegel[i] = klemm(neu[i][2]); }
    return true;
  };

  var api = {
    ANZAHL: ANZAHL, KURZ: KURZ, NAME: NAME, METALL: METALL,
    BD: BD, RS: RS, SD: SD, CP: CP, CL: CL, LT: LT, CH: CH, MT: MT, MA: MA, HT: HT, OH: OH, LC: LC, MC: MC, CY: CY, HC: HC, CB: CB,
    note: function (i) { return 36 + i; },
    rechnen: rechnen, Satz: Satz, neu: function () { return new Satz(); }
  };
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  wurzel.CaelumDrum808 = api;

  // ================= Karte „Drum & 808“ auf /sounddesign/ (Schritt 2: Pads) =================
  // 16 Pads wie das Ableton Drum Rack (Pad 1 unten links = C1 = Note 36), Farbe wie Rec. › Drum in der App (Rot #E5484D).
  // Antippen = spielen; Dynamik an: oben im Pad = stark, unten = leise (wie die App). Tastatur (wenn die Pads den Fokus haben):
  // 1 2 3 4 / Q W E R / A S D F / Y X C V (Lage der Tasten, nicht Buchstaben). Das zuletzt gespielte Pad ist gewählt:
  // rechts Ton (±7 Halbtöne), Länge, Pegel. Klang geht in die Summe des Motion-Fensters, sobald es den Ausgang anbietet
  // (api.ausgang = function () { return { ctx, ein }; }), sonst direkt an die Lautsprecher. Nichts wird gesendet oder gespeichert.
  var document = wurzel.document; if (!document) return;
  var NOTEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function notenName(n) { return NOTEN[n % 12] + (Math.floor(n / 12) - 2); }
  var TASTEN = ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4'];
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function knopf(text, cls) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function setz(e, t) { if (e._t !== t) { e._t = t; e.textContent = t; } }   // nur bei Änderung (sprache.js übersetzt jede Änderung neu)

  function karte(platz) {
    var satz = new Satz(), eigenCtx = null, gewaehlt = 0, dynamik = true, laut = 0.8, lautG = null;
    api.padLaut = function () { return laut; };   // Lautstärke der Pads (das Motion-Fenster nimmt sie für ● Loop mit)
    function roh() {
      var a = typeof api.ausgang === 'function' ? api.ausgang() : null;
      if (a && a.ctx && a.ein) { if (a.ctx.state === 'suspended') a.ctx.resume(); return a; }
      if (!eigenCtx) {
        var AC = wurzel.AudioContext || wurzel.webkitAudioContext; if (!AC) return null;
        eigenCtx = new AC(); satz.vorbereiten(eigenCtx);
      }
      if (eigenCtx.state === 'suspended') eigenCtx.resume();
      return { ctx: eigenCtx, ein: eigenCtx.destination };
    }
    // Pads laufen über einen eigenen Lautstärke-Regler, danach in die Summe (oder an die Lautsprecher)
    function ausgang() {
      var a = roh(); if (!a) return null;
      if (!lautG || lautG.context !== a.ctx || lautG._ziel !== a.ein) {
        lautG = a.ctx.createGain(); lautG.gain.value = laut; lautG.connect(a.ein); lautG._ziel = a.ein;
      }
      return { ctx: a.ctx, ein: lautG };
    }
    function spielen(i, vel) {
      var a = ausgang(); if (!a) return;
      satz.spielen(a.ctx, a.ein, i, a.ctx.currentTime, vel);
      var p = pads[i]; p.classList.remove('an'); void p.offsetWidth; p.classList.add('an');
      clearTimeout(p._aus); p._aus = setTimeout(function () { p.classList.remove('an'); }, 140);
      if (gewaehlt !== i) { gewaehlt = i; waehlen(); }
      if (typeof api.angeschlagen === 'function') api.angeschlagen(i, vel);   // für Schritt 3 (● Loop)
    }

    var block = el('div', 'd8-block'); block.id = 'drum-808';
    block.appendChild(el('h2', null, 'Drum & 808'));
    block.appendChild(el('p', 'd8-hilfe', '16 Pads wie das Drum Rack in Ableton, Klang wie die Caelum Motion App: rein gerechnet, ohne Samples.'));
    var gross = el('div', 'd8');
    var links = el('div', 'd8-links'), leiste = el('div', 'd8-leiste');
    var dynK = knopf('Dynamik'); dynK.setAttribute('aria-pressed', 'true'); dynK.title = 'Anschlag nach Höhe im Pad an oder aus';
    var lautZ = el('label', 'd8-regler d8-laut'), lautR = el('input'), lautW = el('span', 'd8-wert');
    lautR.type = 'range'; lautR.min = 0; lautR.max = 100; lautR.step = 1; lautR.value = Math.round(laut * 100);
    lautZ.appendChild(el('span', null, 'Lautstärke')); lautZ.appendChild(lautR); lautZ.appendChild(lautW);
    function lautSetz() {
      setz(lautW, Math.round(laut * 100) + ' %');
      if (lautG) lautG.gain.setTargetAtTime(laut, lautG.context.currentTime, 0.02);
    }
    lautR.addEventListener('input', function () { laut = Number(lautR.value) / 100; lautSetz(); });
    lautR.addEventListener('dblclick', function () { laut = 0.8; lautR.value = 80; lautSetz(); });
    leiste.appendChild(dynK); leiste.appendChild(lautZ); lautSetz();
    var raster = el('div', 'd8-pads'); raster.tabIndex = 0; raster.setAttribute('role', 'group'); raster.setAttribute('aria-label', 'Drum Pads');
    var pads = [], tasteZ = /^de/i.test(document.documentElement.lang || navigator.language || '') ? 'Y' : 'Z';
    function padBauen(i) {
      var b = knopf(null, 'd8-pad'); b.tabIndex = -1;
      b.appendChild(el('b', null, KURZ[i]));
      b.appendChild(el('span', 'd8-name', NAME[i]));
      b.appendChild(el('span', 'd8-note', notenName(36 + i)));
      b.appendChild(el('span', 'd8-taste', TASTEN[i] === 'KeyZ' ? tasteZ : TASTEN[i].slice(-1)));
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); try { raster.focus({ preventScroll: true }); } catch (x) { }
        var r = b.getBoundingClientRect(), y = (e.clientY - r.top) / Math.max(1, r.height);
        spielen(i, dynamik ? Math.max(0.15, Math.min(1, 1 - y * 0.85)) : 0.85);
      });
      pads[i] = b;
    }
    for (var i = 0; i < ANZAHL; i++) padBauen(i);
    for (var reihe = 3; reihe >= 0; reihe--) for (var sp = 0; sp < 4; sp++) raster.appendChild(pads[reihe * 4 + sp]);   // Pad 1 unten links
    raster.addEventListener('keydown', function (e) {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      var k = TASTEN.indexOf(e.code);
      if (k < 0 && (e.key === 'Enter' || e.key === ' ')) k = gewaehlt;
      if (k < 0) return;
      e.preventDefault(); spielen(k, dynamik ? (e.shiftKey ? 1 : 0.75) : 0.85);
    });
    links.appendChild(leiste); links.appendChild(raster);
    links.appendChild(el('p', 'd8-info', 'Pad 1 unten links = C1 wie im Ableton Drum Rack.'));
    links.appendChild(el('p', 'd8-info d8-tasten', tasteZ === 'Y' ? 'Tastatur: erst ein Pad antippen, dann 1–4 · Q–R · A–F · Y–V (Umschalt = Akzent).' : 'Tastatur: erst ein Pad antippen, dann 1–4 · Q–R · A–F · Z–V (Umschalt = Akzent).'));

    // rechts: gewählte Stimme
    var rechts = el('div', 'd8-stimme'), kopf = el('h3'), kopfName = el('span'), kopfNote = el('span', 'd8-note');
    kopf.appendChild(kopfName); kopf.appendChild(document.createTextNode(' · ')); kopf.appendChild(kopfNote); rechts.appendChild(kopf);
    var regler = {};
    [['ton', 'Ton', -7, 7], ['laenge', 'Länge', 0, 100], ['pegel', 'Pegel', 0, 100]].forEach(function (d) {
      var z = el('label', 'd8-regler'), r = el('input'), w = el('span', 'd8-wert');
      r.type = 'range'; r.min = d[2]; r.max = d[3]; r.step = 1;
      z.appendChild(el('span', null, d[1])); z.appendChild(r); z.appendChild(w); rechts.appendChild(z);
      r.addEventListener('input', function () { setzeWert(d[0], Number(r.value)); zeigeWerte(); });
      r.addEventListener('change', function () { spielen(gewaehlt, 0.85); });
      r.addEventListener('dblclick', function () { grund(d[0]); zeigeWerte(); spielen(gewaehlt, 0.85); });
      regler[d[0]] = { r: r, w: w };
    });
    var unten = el('div', 'd8-leiste'), hoerK = knopf('▶ Anhören'), grundK = knopf('Grundwerte');
    unten.appendChild(hoerK); unten.appendChild(grundK); rechts.appendChild(unten);
    rechts.appendChild(el('p', 'd8-info', 'Das zuletzt gespielte Pad ist gewählt. Doppelt tippen = Grundwert.'));
    gross.appendChild(links); gross.appendChild(rechts); block.appendChild(gross); platz.appendChild(block);

    var GRUND = new Satz();
    function setzeWert(k, v) { if (k === 'ton') satz.ton[gewaehlt] = 0.5 + v / 14; else satz[k][gewaehlt] = v / 100; }
    function grund(k) { satz[k][gewaehlt] = GRUND[k][gewaehlt]; }
    function zeigeWerte() {
      var i = gewaehlt, st = Math.round((satz.ton[i] - 0.5) * 14), ln = Math.round(satz.laenge[i] * 100), pg = Math.round(satz.pegel[i] * 100);
      regler.ton.r.value = st; setz(regler.ton.w, (st > 0 ? '+' : '') + st);   // Halbtöne
      regler.laenge.r.value = ln; setz(regler.laenge.w, ln + ' %');
      regler.pegel.r.value = pg; setz(regler.pegel.w, pg + ' %');
    }
    function waehlen() {
      pads.forEach(function (p, k) { p.classList.toggle('gewaehlt', k === gewaehlt); });
      setz(kopfName, NAME[gewaehlt]); setz(kopfNote, 'Pad ' + (gewaehlt + 1) + ' · ' + notenName(36 + gewaehlt));
      zeigeWerte();
    }
    dynK.addEventListener('click', function () { dynamik = !dynamik; dynK.setAttribute('aria-pressed', dynamik ? 'true' : 'false'); });
    hoerK.addEventListener('click', function () { spielen(gewaehlt, 0.85); });
    grundK.addEventListener('click', function () { ['ton', 'laenge', 'pegel'].forEach(grund); zeigeWerte(); spielen(gewaehlt, 0.85); });
    waehlen();
    api.satz = satz;   // für Schritt 3 (Sequenzer-Klang „808“) und die Prüfung
  }
  (wurzel.CaelumModul = wurzel.CaelumModul || {}).drum808 = karte;
  document.dispatchEvent(new CustomEvent('caelum-modul', { detail: 'drum808' }));
})(typeof window !== 'undefined' ? window : this);
