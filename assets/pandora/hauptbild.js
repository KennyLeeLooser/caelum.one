// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Bereich Pandora – Hauptbild: erst jede Logo-Schicht einzeln (1 Rahmen = Pandora, 2 Ecken + Kreis, 3 alle Linien = Schlüsselbund),
// jede zeichnet sich an ihrem Platz aus dem Nichts und füllt sich; dann 4 = der Merge: alle Schichten zusammen, eine Farbe.
// Läuft von selbst, sobald das Bild zu sehen ist; ein Schritt daneben lässt sich antippen (springt dorthin, läuft weiter).
// „Nochmal ansehen“ spielt von vorn. Bei „weniger Bewegung“ läuft nichts von selbst: Endstand, Schritte zeigen die Schichten ruhig.
// Wunsch Kenny 23.11.2026 („aus dem Nichts, zuerst die Beschreibung, dann die Finalisierung, so dass wir den Merge verstehen“).
// KI-Beitrag (Claude, GB-7), 23.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  var bild = document.querySelector('.pd-bild');
  if (!bild) return;
  var schritte = Array.prototype.slice.call(document.querySelectorAll('.pd-schritte li'));
  var knopf = document.querySelector('.pd-nochmal');
  var jetzt = document.querySelector('.pd-jetzt');
  var DAUER = [5200, 5800, 5800, 6800];   // ms je Schritt – passend zu den Animationen in pandora.css
  var uhr = 0;
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function zeige(n) {
    bild.removeAttribute('data-s');
    void bild.getBoundingClientRect();   // gleiche Stufe nochmal: Animation neu starten
    bild.setAttribute('data-s', String(n));
    schritte.forEach(function (li, i) {
      li.classList.toggle('an', i < n);
      li.classList.toggle('jetzt', i === n - 1);
      var b = li.querySelector('button');
      if (b) b.setAttribute('aria-current', i === n - 1 ? 'step' : 'false');
    });
    // Handy: nur Nummern-Knöpfe, darunter Name + Satz des aktuellen Schritts (am Desktop ausgeblendet)
    var li = schritte[Math.max(n, 1) - 1];
    if (jetzt && li) {
      jetzt.querySelector('b').textContent = li.querySelector('b span').textContent.replace(/^\s*·\s*/, '');
      jetzt.querySelector('span').textContent = li.querySelector('.pd-satz').textContent;
    }
  }

  function ab(n) {   // Schritt n zeigen und von dort weiterlaufen
    clearTimeout(uhr);
    zeige(n);
    if (ruhig || n >= schritte.length) return;
    uhr = setTimeout(function () { ab(n + 1); }, DAUER[n - 1]);
  }

  bild.classList.add('bereit');
  schritte.forEach(function (li, i) {
    var b = li.querySelector('button');
    if (b) b.addEventListener('click', function () { ab(i + 1); });
  });
  if (knopf) knopf.addEventListener('click', function () { ab(ruhig ? schritte.length : 1); });

  if (ruhig || !('IntersectionObserver' in window)) { ab(ruhig ? schritte.length : 1); return; }
  zeige(0);
  var io = new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) { io.disconnect(); ab(1); }
  }, { threshold: 0.4 });
  io.observe(bild);
})();
