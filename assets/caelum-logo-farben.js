// Kopie von CAELUM/Branding/caelum-logo-farben.js, geschrieben von tools/logo-felder.mjs – dort ändern.
// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum-Logo: Felder immer anders kolorieren (Entscheid Kenny 19.11.2026). Master in CAELUM/Branding, Regeln: FARBEN-LOGO.md.
// Jedes Element mit [data-caelum-logo] (oder .signet .felder) wird gefärbt: jedes Laden eine neue Anordnung,
// Nachbarfelder (data-n) nie gleich, danach wechselt alle paar Sekunden ein Feld sanft die Farbe.
// data-caelum-logo="programm:rorschach" → nur Töne dieses Programms (Hauptfarbe + Grund), für Programmseiten.
// data-caelum-logo="spektrum" → Töne einer Farbharmonie (OKLCH), Klick wechselt die Harmonie (siehe unten, 20.11.2026).
// Bei „Bewegung reduzieren“ bleibt die erste Anordnung stehen.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  // Programmfarben wie farben.json / :root --c-* auf www.caelum.one
  var PROGRAMME = { pandora: '#D97757', viewer: '#F2B05A', gravur: '#E2557A', goose: '#6BAF73', vision: '#C44FD6',
    cut: '#4DBF95', replay: '#7FA3D6', qr: '#A585D6', rorschach: '#6B74F0', analyse: '#9CCB3B' };
  var HIMMEL = '#A58BF5';

  function palette(el) {
    var wahl = (el.getAttribute('data-caelum-logo') || '').trim();
    if (wahl.indexOf('programm:') === 0) {
      var f = PROGRAMME[wahl.slice(9)] || PROGRAMME.pandora;
      return [f, mische(f, '#FFF8F0', 0.35), mische(f, '#262624', 0.25), mische(f, '#FFF8F0', 0.65)];
    }
    var cs = getComputedStyle(document.documentElement), liste = [];
    for (var k in PROGRAMME) liste.push((cs.getPropertyValue('--c-' + k) || '').trim() || PROGRAMME[k]);
    liste.push(HIMMEL);
    return liste;
  }
  function mische(a, b, t) {
    var x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16), r = [16, 8, 0].map(function (s) {
      var p = (x >> s) & 255, q = (y >> s) & 255; return Math.round(p + (q - p) * t); });
    return '#' + r.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('').toUpperCase();
  }
  function zufall(n) { return Math.floor(Math.random() * n); }
  function mischen(a) { for (var i = a.length - 1; i > 0; i--) { var j = zufall(i + 1), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function setzen(p, farbe) { p.setAttribute('fill', farbe); p.setAttribute('stroke', farbe); p.dataset.farbe = farbe; }
  function nachbarn(felder, p) {
    var ids = (p.getAttribute('data-n') || '').split(/\s+/).filter(Boolean);
    return ids.map(function (id) { return felder.byId[id]; }).filter(Boolean);
  }
  // freie Farbe: nicht bei Nachbarn, am wenigsten benutzt, sonst zufällig
  function waehlen(felder, p, farben, ausser) {
    var belegt = {}; nachbarn(felder, p).forEach(function (n) { belegt[n.dataset.farbe] = 1; });
    if (ausser) belegt[ausser] = 1;
    var zaehl = {}; felder.liste.forEach(function (q) { zaehl[q.dataset.farbe] = (zaehl[q.dataset.farbe] || 0) + 1; });
    var frei = mischen(farben.filter(function (f) { return !belegt[f]; }));
    if (!frei.length) frei = farben.slice();
    frei.sort(function (a, b) { return (zaehl[a] || 0) - (zaehl[b] || 0); });
    return frei[0];
  }

  function faerben(el) {
    var liste = Array.prototype.slice.call(el.querySelectorAll('path.feld, path.cell'));
    if (!liste.length) return;
    var felder = { liste: liste, byId: {} };
    liste.forEach(function (p, i) { felder.byId[p.id || ('f' + ('0' + i).slice(-2))] = p; p.dataset.farbe = ''; });
    var farben = palette(el);
    mischen(liste.slice()).forEach(function (p) { setzen(p, waehlen(felder, p, farben)); });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || el.hasAttribute('data-still')) return;
    setInterval(function () {
      if (document.hidden) return;
      var p = liste[zufall(liste.length)];
      setzen(p, waehlen(felder, p, farben, p.dataset.farbe));
    }, 2600);
  }

  // Modus data-caelum-logo="spektrum" (Wunsch Kenny 20.11.2026): ruhiger, alle Felder aus EINER Farbharmonie,
  // weicher Wechsel. Klick/Enter → nächste Harmonie, nach „Farbe aus“ ein neuer Grundton (goldener Winkel 137,5°).
  // Farbharmonie gerechnet in OKLCH (wahrnehmungsgleich): gleiche Zahl L = gleich hell empfunden, anders als HSL,
  // wo Gelb viel heller wirkt als Blau. Jeder Ton wird in den sRGB-Raum geholt (Buntheit C senken, Ton bleibt) und
  // muss auf den Logo-Linien #262624 mindestens 3 : 1 Kontrast haben (sonst L heben).
  // Andere Teile der Seite: Ereignis „caelum-spektrum“, CaelumLogo.spektrum() / .weiter() / .harmonie(name) /
  // .neuerTon() / .neuMischen() / .halten(true|false) / .harmonien.
  var HARMONIEN = [
    // Art, Anzeige, Töne als [Winkel zum Grundton, L, C]
    ['analog', 'Analog', [[-30, .62, .15], [-15, .70, .13], [0, .66, .16], [15, .74, .12], [30, .60, .14]]],
    ['monochrom', 'Monochrom', [[0, .48, .10], [0, .58, .14], [0, .68, .16], [0, .78, .11], [0, .87, .06]]],
    ['komplementaer', 'Komplementär', [[-10, .62, .15], [0, .70, .14], [10, .78, .10], [170, .66, .13], [180, .74, .12], [190, .60, .14]]],
    ['split', 'Split-komplementär', [[0, .64, .16], [0, .76, .11], [150, .70, .13], [150, .60, .14], [210, .72, .13], [210, .62, .14]]],
    ['triade', 'Triade', [[0, .66, .15], [0, .76, .10], [120, .70, .14], [120, .60, .13], [240, .64, .14], [240, .74, .10]]],
    ['quadrat', 'Quadrat (Tetrade)', [[0, .68, .14], [90, .72, .13], [180, .66, .13], [270, .70, .13], [0, .78, .08], [180, .78, .08]]],
    ['rechteck', 'Rechteck', [[0, .66, .15], [60, .74, .13], [180, .68, .13], [240, .64, .14], [60, .82, .08]]],
    ['grau', 'Farbe aus', [[0, .45, .012], [0, .55, .012], [0, .65, .012], [0, .75, .012], [0, .85, .012]]]
  ];
  var spek = { ton: 0, art: 0, farben: [], halten: false, akzent: 0 };
  // sRGB ↔ OKLab (Björn Ottosson, 2020)
  function lin(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function enc(c) { return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function tonVon(hex) {
    var x = parseInt(hex.slice(1), 16), r = lin((x >> 16 & 255) / 255), g = lin((x >> 8 & 255) / 255), b = lin((x & 255) / 255);
    var l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    var m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    var s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    var A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    return (Math.atan2(B, A) * 180 / Math.PI + 360) % 360;
  }
  function oklchRgb(L, C, h) {   // linear sRGB
    var a = C * Math.cos(h * Math.PI / 180), b = C * Math.sin(h * Math.PI / 180);
    var l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3), m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3),
      s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function imRaum(c) { return c.every(function (v) { return v >= -0.0005 && v <= 1.0005; }); }
  function leucht(c) { return 0.2126 * Math.max(0, c[0]) + 0.7152 * Math.max(0, c[1]) + 0.0722 * Math.max(0, c[2]); }
  var LINIE = 0.0188;   // relative Leuchtdichte der Logo-Linien #262624
  function holen(L, C, h) {   // in den sRGB-Raum: Buntheit senken, Ton und Helligkeit bleiben
    var c = oklchRgb(L, C, h);
    while (!imRaum(c) && C > 0) { C = Math.max(0, C - 0.004); c = oklchRgb(L, C, h); }
    return c;
  }
  function oklchHex(L, C, h) {
    var c = holen(L, C, h);
    while ((leucht(c) + 0.05) / (LINIE + 0.05) < 3 && L < 0.95) { L += 0.02; c = holen(L, C, h); }
    return '#' + c.map(function (v) {
      return ('0' + Math.round(Math.min(1, Math.max(0, enc(Math.max(0, v)))) * 255).toString(16)).slice(-2);
    }).join('').toUpperCase();
  }
  function spektrumFarben(art) {
    var liste = [];
    HARMONIEN[art == null ? spek.art : art][2].forEach(function (t) {
      var f = oklchHex(t[1], t[2], (spek.ton + t[0] + 360) % 360);
      if (liste.indexOf(f) < 0) liste.push(f);
    });
    return liste;
  }
  // Akzentfarben (Kenny 20.11.2026: „das Orange im System passt sich an“): bis zu drei Töne der Harmonie in
  // gleicher Helligkeit L 0.72 – hell genug für dunkle Knopfschrift #1F1E1D (≥ 4.5 : 1) und Text auf #262624.
  function akzente() {
    var t = HARMONIEN[spek.art][2], winkel = [], aus = HARMONIEN[spek.art][0] === 'grau';
    t.forEach(function (x) { if (winkel.indexOf(x[0]) < 0) winkel.push(x[0]); });
    if (HARMONIEN[spek.art][0] === 'analog') winkel = [0, -30, 30];
    var liste = winkel.slice(0, 3).map(function (w) { return oklchHex(0.72, aus ? 0.012 : 0.14, (spek.ton + w + 360) % 360); });
    var hell = [0.80, 0.64];
    while (liste.length < 3) liste.push(oklchHex(hell[liste.length - 1] || 0.8, aus ? 0.012 : 0.12, spek.ton));
    return liste;
  }
  function info() {
    var a = akzente();
    return { farben: spek.farben.slice(), art: HARMONIEN[spek.art][0], name: HARMONIEN[spek.art][1],
      ton: Math.round(spek.ton), halten: spek.halten, akzente: a, akzent: a[Math.min(spek.akzent, a.length - 1)],
      akzentNr: spek.akzent };
  }
  var steuer = null;   // gesetzt vom ersten Spektrum-Logo der Seite
  function spektrum(el) {
    var liste = Array.prototype.slice.call(el.querySelectorAll('path.feld, path.cell'));
    if (!liste.length) return;
    var felder = { liste: liste, byId: {} };
    liste.forEach(function (p, i) { felder.byId[p.id || ('f' + ('0' + i).slice(-2))] = p; });
    var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches || el.hasAttribute('data-still');
    var namen = Object.keys(PROGRAMME);
    spek.ton = tonVon(PROGRAMME[namen[zufall(namen.length)]]);
    spek.farben = spektrumFarben();
    el.classList.add('spektrum');
    // erst alle Farben wählen (Nachbarn verschieden), dann zeigen – beim Wechsel als Welle
    function alle(welle) {
      liste.forEach(function (p) { p.dataset.farbe = ''; });
      var reihe = mischen(liste.slice());
      reihe.forEach(function (p) { p.dataset.farbe = waehlen(felder, p, spek.farben); });
      reihe.forEach(function (p, i) {
        var f = p.dataset.farbe, zeigen = function () { p.setAttribute('fill', f); p.setAttribute('stroke', f); };
        if (welle && !ruhig) setTimeout(zeigen, i * 70); else zeigen();
      });
    }
    function melden() {
      el.setAttribute('data-spektrum', HARMONIEN[spek.art][0]);
      document.dispatchEvent(new CustomEvent('caelum-spektrum', { detail: info() }));
    }
    function setzeArt(i, neuerTon) {
      spek.art = i;
      if (neuerTon) spek.ton = (spek.ton + 137.5) % 360;
      spek.farben = spektrumFarben();
      alle(true); melden();
    }
    function weiter() { var i = (spek.art + 1) % HARMONIEN.length; setzeArt(i, i === 0); }
    if (!steuer) steuer = {
      weiter: weiter,
      harmonie: function (name) {
        for (var i = 0; i < HARMONIEN.length; i++) if (HARMONIEN[i][0] === name) { setzeArt(i, false); return true; }
        return false;
      },
      neuerTon: function () { setzeArt(spek.art, true); },
      neuMischen: function () { alle(true); melden(); }
    };
    alle(false);
    el.setAttribute('data-spektrum', HARMONIEN[spek.art][0]);
    // Ein Link im Signet (Pandora-Tor: Rahmen → /pandora/) führt, statt das Spektrum zu wechseln
    function imLink(e) { return e.target && e.target.closest && e.target.closest('a'); }
    el.addEventListener('click', function (e) { if (!imLink(e)) weiter(); });
    el.addEventListener('keydown', function (e) {
      if (imLink(e)) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); weiter(); }
    });
    if (ruhig) { spek.halten = true; return; }
    setInterval(function () {
      if (document.hidden || spek.halten) return;
      var p = liste[zufall(liste.length)];
      setzen(p, waehlen(felder, p, spek.farben, p.dataset.farbe));
    }, 1800);
  }

  window.CaelumLogo = { faerben: faerben, programme: PROGRAMME, spektrum: info,
    harmonien: HARMONIEN.map(function (h) { return { art: h[0], name: h[1] }; }),
    weiter: function () { if (steuer) steuer.weiter(); },
    harmonie: function (name) { return steuer ? steuer.harmonie(name) : false; },
    neuerTon: function () { if (steuer) steuer.neuerTon(); },
    neuMischen: function () { if (steuer) steuer.neuMischen(); },
    halten: function (an) { spek.halten = !!an; document.dispatchEvent(new CustomEvent('caelum-spektrum', { detail: info() })); },
    vorschau: function (art) {   // Farben einer Harmonie zum heutigen Grundton, ohne umzuschalten (für Menüs)
      for (var i = 0; i < HARMONIEN.length; i++) if (HARMONIEN[i][0] === art) return spektrumFarben(i);
      return [];
    },
    akzent: function (nr) { spek.akzent = Math.max(0, Math.min(2, nr | 0)); document.dispatchEvent(new CustomEvent('caelum-spektrum', { detail: info() })); },
    oklchHex: oklchHex };
  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-caelum-logo]'), function (el) {
      if ((el.getAttribute('data-caelum-logo') || '').trim() === 'spektrum') spektrum(el); else faerben(el);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
