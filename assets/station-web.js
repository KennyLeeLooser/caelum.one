// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// /sounddesign/station/: die Caelum Station kundenfreundlich erklärt – Schritt-Kette, drei Bilder (G1–G3 aus CaelumMotion/bild/)
// als Karten zum Wischen, je Karte eine aufklappbare Erklärung. Kategorie Station = eigenes Projekt nach Motion (Kenny 23.11.2026);
// die Bilder sind ein Entwurf und nur ein Anhaltspunkt. Ohne fremde Dateien, ohne Bibliothek (CSP: nur 'self').
// KI-Beitrag (Claude, GB-7), 23.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var SCHRITTE = ['Bewegen', 'Klang', 'Zusammen spielen', 'Hören'];
  var KARTEN = [
    { bild: 'studio-ueberblick.svg', w: 1200, h: 640, titel: 'So spielt ihr zusammen',
      kurz: 'Vom Handy über die Brücke in die Station und live ins Radio.',
      alt: 'Mitspieler bewegen Handy oder Joy-Con, die Brücke macht daraus Klang, die Caelum Station mischt alle Runden, Caelum Radio sendet den Mix mit Live-Chat an die Hörer.',
      mehr: 'Jede Person bewegt ihr Handy oder einen Joy-Con – oder spielt einfach im Browser mit. Die Brücke am PC macht aus der Bewegung Klang. Die Station sammelt, was alle spielen, und mischt es zu einem Stück. Das Radio sendet diesen Mix, und im Chat reden alle mit.',
      punkte: ['Ohne Installation im Browser mitspielen', 'Ableton ist Gast, nicht Pflicht', 'Bewegungsdaten bleiben im eigenen Netz'] },
    { bild: 'jam-runde.svg', w: 1200, h: 680, titel: 'Eine Runde später',
      kurz: 'Was du jetzt spielst, hören alle in der nächsten Runde und spielen dazu.',
      alt: 'Zeitstrahl über vier Runden zu je 8 Sekunden: Was in Runde n gespielt wird, hören alle in Runde n+1.',
      mehr: 'Die Station spielt in Runden von 4 Takten, etwa 8 Sekunden. Was du in dieser Runde spielst, hören alle in der nächsten – und spielen darauf. So passt alles zusammen, auch wenn das Internet einmal langsamer ist.',
      punkte: ['Eine Runde: 4 Takte, 8 Sekunden', 'Die Schleife wartet nie', 'Spielt niemand, läuft das Grundmuster'] },
    { bild: 'aufbau-kern.svg', w: 1200, h: 660, titel: 'Ein Kern für alles',
      kurz: 'Gleicher Klang im Handy, in Ableton und im Browser.',
      alt: 'Der Klang-Kern in C++ mit drei Hüllen: Handy-App, VST3-Plugins und Web-Studio, zusammengehalten vom Gleichheitstest.',
      mehr: 'Alle Klänge kommen aus einem einzigen Klang-Kern. Die Handy-App, die Plugins für Ableton und das Studio im Browser nutzen ihn alle. Ein Test prüft Ton für Ton, dass überall dasselbe herauskommt.',
      punkte: ['Einmal gebaut, dreimal genutzt', 'Geprüft: Ton für Ton gleich', 'Handy-App, VST3, Browser'] }
  ];

  // Grossansicht (Redmi-Test 23.11.2026: der neue Tab zeigte das SVG hochkant klein auf weissem Grund).
  // Dunkles <dialog>: am Handy in voller Bildgrösse zum Verschieben, Antippen wechselt zwischen gross und ganz.
  // Zurück-Taste am Handy schliesst (eigener Verlaufseintrag), ebenso Esc und der Knopf.
  var gross = null;
  function baueGross() {
    if (typeof HTMLDialogElement !== 'function') return null;
    var dlg = el('dialog', 'st-gross'); dlg.setAttribute('aria-label', 'Bild gross öffnen');
    var zu = el('button', 'st-gross-zu', '✕'); zu.type = 'button'; zu.setAttribute('aria-label', 'Schliessen');
    var flaeche = el('div', 'st-gross-flaeche');
    var img = el('img'); img.decoding = 'async';
    var tipp = el('p', 'st-gross-tipp', 'Mit dem Finger verschieben · antippen zum Zoomen');
    flaeche.appendChild(img); dlg.appendChild(zu); dlg.appendChild(flaeche); dlg.appendChild(tipp);
    document.body.appendChild(dlg);
    var verlauf = false;
    function schliess() { if (dlg.open) dlg.close(); }
    zu.addEventListener('click', function () { if (verlauf) history.back(); else schliess(); });
    img.addEventListener('click', function () { dlg.classList.toggle('st-ganz'); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target === flaeche) zu.click(); });
    dlg.addEventListener('close', function () { document.documentElement.classList.remove('st-gross-auf'); if (verlauf) { verlauf = false; history.back(); } });
    window.addEventListener('popstate', function () { if (verlauf) { verlauf = false; schliess(); } });
    return {
      zeig: function (k) {
        img.src = '/assets/station/' + k.bild; img.alt = k.alt; img.width = k.w; img.height = k.h; img.style.setProperty('--w', k.w + 'px');   // SVG hat nur viewBox: Breite fest vorgeben
        dlg.classList.toggle('st-ganz', window.innerWidth >= k.w);   // breiter Bildschirm: gleich ganz
        document.documentElement.classList.add('st-gross-auf');
        dlg.showModal(); flaeche.scrollLeft = 0; flaeche.scrollTop = 0;
        try { history.pushState({ stGross: 1 }, ''); verlauf = true; } catch (e) { verlauf = false; }
        zu.focus();
      }
    };
  }

  function start(platz) {
    platz.classList.add('station');
    gross = baueGross();
    var zurueck = el('a', 'st-zurueck', '← Zurück zu Sound Design'); zurueck.href = '/sounddesign/';
    platz.appendChild(zurueck);
    platz.appendChild(el('p', 'st-entwurf', 'Entwurf – so planen wir die Station. Die Bilder wachsen mit.'));

    var kette = el('ol', 'st-kette'); kette.setAttribute('aria-label', 'Ablauf');
    SCHRITTE.forEach(function (s, i) { var li = el('li'); li.appendChild(el('b', null, String(i + 1))); li.appendChild(document.createTextNode(s)); kette.appendChild(li); });
    platz.appendChild(kette);

    var rahmen = el('div', 'st-rahmen');
    var bahn = el('div', 'st-bahn'); bahn.setAttribute('role', 'group'); bahn.setAttribute('aria-label', 'Bilder zur Station'); bahn.tabIndex = 0;
    KARTEN.forEach(function (k, i) {
      var a = el('article', 'st-karte'); a.id = 'station-' + (i + 1);
      var kopf = el('div', 'st-kopf');
      kopf.appendChild(el('span', 'st-nr', String(i + 1)));
      var tx = el('div'); tx.appendChild(el('h2', null, k.titel)); tx.appendChild(el('p', null, k.kurz)); kopf.appendChild(tx);
      a.appendChild(kopf);
      var bl = el('a', 'st-bild'); bl.href = '/assets/station/' + k.bild; bl.target = '_blank'; bl.rel = 'noopener';
      bl.title = 'Bild gross öffnen';
      bl.addEventListener('click', function (e) {   // Grossansicht auf der Seite; Strg/Mittelklick öffnet weiter das SVG im neuen Tab
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button || !gross) return;
        e.preventDefault(); gross.zeig(k);
      });
      var img = el('img'); img.src = '/assets/station/' + k.bild; img.width = k.w; img.height = k.h; img.alt = k.alt;
      img.loading = i ? 'lazy' : 'eager'; img.decoding = 'async';
      bl.appendChild(img); a.appendChild(bl);
      var d = el('details', 'st-mehr');
      d.appendChild(el('summary', null, 'So funktioniert es'));
      d.appendChild(el('p', null, k.mehr));
      var ul = el('ul'); k.punkte.forEach(function (p) { ul.appendChild(el('li', null, p)); }); d.appendChild(ul);
      a.appendChild(d);
      bahn.appendChild(a);
    });
    rahmen.appendChild(bahn);

    var leiste = el('div', 'st-leiste');
    var vor = el('button', 'st-pfeil', '‹'); vor.type = 'button'; vor.setAttribute('aria-label', 'Voriges Bild');
    var nach = el('button', 'st-pfeil', '›'); nach.type = 'button'; nach.setAttribute('aria-label', 'Nächstes Bild');
    var punkte = el('div', 'st-punkte');
    var knoepfe = KARTEN.map(function (k, i) {
      var b = el('button'); b.type = 'button'; b.setAttribute('aria-label', k.titel);
      b.addEventListener('click', function () { geh(i); }); punkte.appendChild(b); return b;
    });
    leiste.appendChild(vor); leiste.appendChild(punkte); leiste.appendChild(nach);
    rahmen.appendChild(leiste);
    rahmen.appendChild(el('p', 'st-wisch', 'Wischen für das nächste Bild'));
    platz.appendChild(rahmen);

    var karten = bahn.children, jetzt = 0;
    function geh(i) {
      i = Math.max(0, Math.min(karten.length - 1, i));
      bahn.scrollTo({ left: karten[i].offsetLeft - bahn.offsetLeft, behavior: ruhig ? 'auto' : 'smooth' });
      markiere(i);
    }
    function markiere(i) {
      jetzt = i;
      knoepfe.forEach(function (b, j) { if (j === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      vor.disabled = i === 0; nach.disabled = i === karten.length - 1;
    }
    vor.addEventListener('click', function () { geh(jetzt - 1); });
    nach.addEventListener('click', function () { geh(jetzt + 1); });
    bahn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); geh(jetzt + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); geh(jetzt - 1); }
    });
    var warte;
    bahn.addEventListener('scroll', function () {   // nach dem Wischen den Punkt nachführen
      clearTimeout(warte);
      warte = setTimeout(function () {
        var x = bahn.scrollLeft, best = 0, abst = Infinity;
        for (var j = 0; j < karten.length; j++) { var d = Math.abs(karten[j].offsetLeft - bahn.offsetLeft - x); if (d < abst) { abst = d; best = j; } }
        markiere(best);
      }, 80);
    }, { passive: true });
    markiere(0);
    var m = /^#station-(\d)$/.exec(location.hash); if (m) setTimeout(function () { geh(+m[1] - 1); }, 50);
  }

  (window.CaelumModul = window.CaelumModul || {})['station-web'] = start;
  document.dispatchEvent(new CustomEvent('caelum-modul', { detail: 'station-web' }));
})();
