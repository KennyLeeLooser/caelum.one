// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Bereich Pandora – „Die 7 Schritte im Notfall“ (P4): Schritt-Spieler mit Bild je Schritt, Umschalter Verlust | Bedrohung,
// ▶ Abspielen, ◀ / ▶▶, Wischen am Bild, Pfeiltasten. Nur das Prinzip, nie der echte Notfallplan (Sicherheitsregel Strang Pandora).
// Ohne Skript stehen alle 7 Schritte mit beiden Fällen offen da. KI-Beitrag (Claude, GB-7), 24.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  var sec = document.querySelector('.pd-not');
  if (!sec) return;
  var lis = Array.prototype.slice.call(sec.querySelectorAll('.pd-not-schritte li'));
  var bild = sec.querySelector('.pd-not-bild');
  var jetzt = sec.querySelector('.pd-not-jetzt');
  var spielen = sec.querySelector('.pd-not-spielen');
  var fallKnoepfe = Array.prototype.slice.call(sec.querySelectorAll('.pd-fall button'));
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var n = lis.length, s = 0, uhr = 0, TAKT = 6000;

  // Satz des Schritts im gewählten Fall: eigener Satz für Bedrohung, sonst der gemeinsame (ohne das Vorwort „Bei Bedrohung:“)
  var WAHL = { verlust: '.nf-v', bedrohung: '.nf-bd' }, AKTUELL = ['false', 'step'];
  function satz(li) {
    var e = li.querySelector(WAHL[sec.getAttribute('data-f')]) || li.querySelector('.nf-satz:not(.nf-v):not(.nf-bd)');
    if (!e) return '';
    var x = e.cloneNode(true), w = x.querySelector('.nf-wenn');
    if (w) w.remove();
    return x.textContent.trim();
  }

  function zeige() {
    lis.forEach(function (li, i) {
      li.classList.toggle('an', i <= s);
      li.classList.toggle('jetzt', i === s);
      li.querySelector('button').setAttribute('aria-current', AKTUELL[+(i === s)]);
    });
    bild.setAttribute('data-s', String(s + 1));
    var li = lis[s];
    jetzt.innerHTML = '';
    var b = document.createElement('b'); b.textContent = (s + 1) + ' ·' + li.querySelector('b span').textContent.replace(/^\s*·/, '');
    var p = document.createElement('span'); p.textContent = satz(li);
    var em = document.createElement('em'); em.textContent = li.querySelector('em').textContent;
    jetzt.appendChild(b); jetzt.appendChild(p); jetzt.appendChild(em);
  }

  function halt() { clearInterval(uhr); uhr = 0; spielen.textContent = '▶ Abspielen'; spielen.setAttribute('aria-pressed', 'false'); }
  function geh(i) { s = (i + n) % n; zeige(); }
  function los() {
    if (s === n - 1) geh(0);
    spielen.textContent = '■ Anhalten'; spielen.setAttribute('aria-pressed', 'true');
    uhr = setInterval(function () { if (s === n - 1) { halt(); return; } geh(s + 1); }, TAKT);
  }

  // Der Kasten liest die (schon übersetzten) Texte der Liste – nach einem Sprachwechsel neu füllen
  document.addEventListener('caelum-sprache', zeige);

  lis.forEach(function (li, i) { li.querySelector('button').addEventListener('click', function () { halt(); geh(i); }); });
  sec.querySelector('.pd-not-zurueck').addEventListener('click', function () { halt(); geh(s - 1); });
  sec.querySelector('.pd-not-weiter').addEventListener('click', function () { halt(); geh(s + 1); });
  spielen.addEventListener('click', function () { if (uhr) halt(); else los(); });

  fallKnoepfe.forEach(function (k) {
    k.addEventListener('click', function () {
      sec.setAttribute('data-f', k.getAttribute('data-f'));
      fallKnoepfe.forEach(function (x) { x.setAttribute('aria-pressed', x === k ? 'true' : 'false'); });
      zeige();
    });
  });

  // Wischen am Bild (Handy): links = weiter, rechts = zurück
  var x0 = null;
  bild.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  bild.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 40) { halt(); geh(s + (dx < 0 ? 1 : -1)); }
  }, { passive: true });

  sec.querySelector('.pd-not-schritte').addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault(); halt();
    geh(s + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1));
    lis[s].querySelector('button').focus();
  });

  sec.classList.add('lebt');
  sec.querySelector('.pd-fall').hidden = false;
  sec.querySelector('.pd-not-knoepfe').hidden = false;
  zeige();

  // Von selbst abspielen, sobald der Abschnitt ins Bild kommt (einmal); bei „weniger Bewegung“ nicht
  if (!ruhig && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); if (!uhr && s === 0) los(); }
    }, { threshold: 0.5 });
    io.observe(bild);
  }
})();
