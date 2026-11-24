// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Bereich Pandora – Schaubild „Was Pandora ist“ (P3): Pandora als Rahmen in der Mitte, vier Köpfe der Hydra in den Ecken
// (Geräte, Tresor-Stick, ausser Haus, Archiv). Kopf antippen → Erklärung; „Diesen Kopf wegnehmen“ zeigt, dass die anderen
// weitertragen, „Zurückholen“ füllt ihn wieder. Nur das Prinzip, nie der echte Notfallplan (Sicherheitsregel Strang Pandora).
// Ohne Skript stehen alle Texte offen da. KI-Beitrag (Claude, GB-7), 24.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  var sec = document.querySelector('.pd-was');
  if (!sec) return;
  var lis = Array.prototype.slice.call(sec.querySelectorAll('.pd-koepfe li'));
  var koepfe = Array.prototype.slice.call(sec.querySelectorAll('.pd-kopf'));
  var lage = sec.querySelector('.pd-was-lage');
  var weg = sec.querySelector('.pd-weg');
  var gewaehlt = 'geraete', fehlt = '';

  function name(k) { var li = sec.querySelector('.pd-koepfe li[data-k="' + k + '"] b'); return li ? li.textContent : k; }

  function zeige() {
    lis.forEach(function (li) {
      var k = li.getAttribute('data-k');
      li.classList.toggle('an', k === gewaehlt);
      li.classList.toggle('weg', k === fehlt);
      li.querySelector('button').setAttribute('aria-pressed', k === gewaehlt ? 'true' : 'false');
    });
    koepfe.forEach(function (g) {
      var k = g.getAttribute('data-k');
      g.classList.toggle('an', k === gewaehlt);
      g.classList.toggle('weg', k === fehlt);
    });
    sec.querySelectorAll('[data-k]').forEach(function (e) {
      if (e.tagName === 'line') e.classList.toggle('weg', e.getAttribute('data-k') === fehlt);
    });
    sec.classList.toggle('fehlt', !!fehlt);
    weg.textContent = fehlt === gewaehlt ? '▶ Zurückholen' : 'Diesen Kopf wegnehmen';
  }

  function waehle(k) { gewaehlt = k; zeige(); }

  lis.forEach(function (li) {
    li.querySelector('button').addEventListener('click', function () { waehle(li.getAttribute('data-k')); });
  });
  koepfe.forEach(function (g) {
    g.addEventListener('click', function () { waehle(g.getAttribute('data-k')); });
  });
  weg.addEventListener('click', function () {
    if (fehlt === gewaehlt) {
      fehlt = '';
      lage.textContent = name(gewaehlt) + ' ist zurück. Pandora hat ihn aus den anderen Köpfen neu befüllt. Wieder vier.';
    } else {
      fehlt = gewaehlt;
      lage.textContent = name(fehlt) + ' ist weg. Die anderen drei Köpfe tragen weiter: deine Arbeit ist noch da.';
    }
    zeige();
  });

  sec.classList.add('lebt');
  weg.hidden = false;
  zeige();
})();
