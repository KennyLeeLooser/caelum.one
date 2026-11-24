// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Strang Pandora P7 (Kenny 24.11.2026: „Okey, können wir probieren“): Wer auf dem Startsignet mit Finger oder Maus ein Viereck zieht,
// öffnet den Kundenzugang. Erkannt wird im Browser (kein Server, nichts wird gesendet): Strich geschlossen, gross genug, fast alle
// Punkte nahe am Rand des umschliessenden Rechtecks, alle vier Seiten berührt. Das Viereck ist nur der Türgriff, kein Passwort –
// jeder kennt es aus dem Logo. Angemeldet wird danach wie bisher (Baustellen-Code oder Google; Passkey folgt, braucht einen Server).
// Ein Tippen bleibt, was es war (Farbspektrum, Rahmen-Rand → /pandora/). KI-Beitrag (Claude, GB-7) – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  var signet = document.querySelector('.signet'), logo = signet && signet.querySelector('.logo');
  var zugang = document.getElementById('zugang'), code = document.getElementById('zugang-code'), msg = document.getElementById('zugang-msg');
  if (!logo || !zugang) return;
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var punkte = null, gezogen = false, id = null;

  function t(de) { return window.CaelumSprache ? window.CaelumSprache.t(de) : de; }

  // Ist der Strich ein Viereck? Masse relativ zur Logo-Grösse, damit es am Handy (200 px) wie am Desktop (340 px) geht
  function istViereck(p, groesse) {
    if (p.length < 12) return false;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, lang = 0, i;
    for (i = 0; i < p.length; i++) {
      x0 = Math.min(x0, p[i][0]); x1 = Math.max(x1, p[i][0]); y0 = Math.min(y0, p[i][1]); y1 = Math.max(y1, p[i][1]);
      if (i) lang += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    }
    var b = x1 - x0, h = y1 - y0;
    if (b < groesse * 0.35 || h < groesse * 0.35) return false;          // gross genug
    if (b / h > 1.8 || h / b > 1.8) return false;                          // eher Quadrat als Strich
    if (lang < 2 * (b + h) * 0.75) return false;                           // einmal rundherum
    var ende = Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]);
    if (ende > Math.min(b, h) * 0.45) return false;                        // geschlossen
    var band = Math.min(b, h) * 0.22, amRand = 0, seiten = [0, 0, 0, 0];
    for (i = 0; i < p.length; i++) {
      var d = [p[i][0] - x0, x1 - p[i][0], p[i][1] - y0, y1 - p[i][1]];     // links, rechts, oben, unten
      var m = Math.min.apply(null, d);
      if (m <= band) { amRand++; seiten[d.indexOf(m)]++; }
    }
    if (amRand / p.length < 0.8) return false;                             // kein Gekritzel
    if (!seiten.every(function (n) { return n / p.length > 0.08; })) return false;   // alle vier Seiten
    // Kreis ausschliessen: ein Viereck ist ~4·Seite lang (Kreis ~3,14·Seite) und kommt in alle vier Ecken
    if (lang < 2 * (b + h) * 0.88) return false;
    var nah = Math.min(b, h) * 0.18;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(function (e) {
      return p.some(function (q) { return Math.hypot(q[0] - e[0], q[1] - e[1]) <= nah; });
    });
  }

  function erkannt() {
    signet.classList.add('viereck');
    setTimeout(function () { signet.classList.remove('viereck'); }, 1600);
    if (msg) msg.textContent = t('Viereck erkannt. Hier meldest du dich an: mit dem Baustellen-Code oder mit Google.');
    zugang.classList.add('viereck-ziel');
    setTimeout(function () { zugang.classList.remove('viereck-ziel'); }, 2600);
    zugang.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'center' });
    setTimeout(function () { try { code.focus({ preventScroll: true }); } catch (e) { code.focus(); } }, ruhig ? 0 : 500);
  }

  logo.addEventListener('pointerdown', function (e) {
    if (e.button !== 0 || id !== null) return;
    id = e.pointerId; gezogen = false;
    var r = logo.getBoundingClientRect();
    punkte = [[e.clientX - r.left, e.clientY - r.top]];
  });
  logo.addEventListener('pointermove', function (e) {
    if (e.pointerId !== id || !punkte) return;
    var r = logo.getBoundingClientRect(), q = [e.clientX - r.left, e.clientY - r.top], l = punkte[punkte.length - 1];
    if (Math.hypot(q[0] - l[0], q[1] - l[1]) < 3) return;
    punkte.push(q);
    if (!gezogen && Math.hypot(q[0] - punkte[0][0], q[1] - punkte[0][1]) > 12) {
      gezogen = true;
      try { logo.setPointerCapture(id); } catch (x) {}
    }
  });
  function fertig(e) {
    if (e.pointerId !== id) return;
    id = null;
    var p = punkte; punkte = null;
    if (gezogen && p && istViereck(p, logo.getBoundingClientRect().width)) erkannt();
  }
  logo.addEventListener('pointerup', fertig);
  logo.addEventListener('pointercancel', function (e) { if (e.pointerId === id) { id = null; punkte = null; gezogen = false; } });
  // Nach dem Ziehen kein Klick hinterher (sonst wechselt das Spektrum oder der Rahmen-Link führt weg)
  signet.addEventListener('click', function (e) {
    if (!gezogen) return;
    gezogen = false; e.preventDefault(); e.stopPropagation();
  }, true);

  window.CaelumViereck = { pruefe: istViereck };   // für die Prüfung im Browser
})();
