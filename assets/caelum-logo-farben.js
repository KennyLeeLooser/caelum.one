// Kopie von CAELUM/Branding/caelum-logo-farben.js, geschrieben von tools/logo-felder.mjs – dort ändern.
// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum-Logo: Felder immer anders kolorieren (Entscheid Kenny 19.11.2026). Master in CAELUM/Branding, Regeln: FARBEN-LOGO.md.
// Jedes Element mit [data-caelum-logo] (oder .signet .felder) wird gefärbt: jedes Laden eine neue Anordnung,
// Nachbarfelder (data-n) nie gleich, danach wechselt alle paar Sekunden ein Feld sanft die Farbe.
// data-caelum-logo="programm:rorschach" → nur Töne dieses Programms (Hauptfarbe + Grund), für Programmseiten.
// Bei „Bewegung reduzieren“ bleibt die erste Anordnung stehen.
// KI-Beitrag (Claude, GB-7), 19.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  // Programmfarben wie farben.json / :root --c-* auf www.caelum.one
  var PROGRAMME = { pandora: '#D97757', viewer: '#F2B05A', gravur: '#E2557A', goose: '#6BAF73', vision: '#C44FD6',
    cut: '#4FB3C4', replay: '#7FA3D6', qr: '#A585D6', rorschach: '#6B74F0', analyse: '#9CCB3B' };
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

  window.CaelumLogo = { faerben: faerben, programme: PROGRAMME };
  function start() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-caelum-logo]'), faerben);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
