// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Baukasten der Bereiche (Webdesign, Studio, Labor, Partner, Community): eine Hülle je Ordner (<body data-bereich="…">),
// Inhalt aus /bereiche/bereiche.json. Regler oben wie bei /developer/, in der Farbe des gemalten Zeichens.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
// „module“ (Schaubilder Labor, Motion im Browser) – KI-Beitrag (Claude, GB-7), 22.11.2026 – Freigabe ausstehend (GB-8).
(function () {
  'use strict';
  var id = document.body.getAttribute('data-bereich');
  var main = document.getElementById('bereich');
  if (!id || !main) return;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function farbe(b) {
    var f = '';
    try { if (localStorage.getItem('caelum-zeichen') === id) f = localStorage.getItem('caelum-zeichen-farbe') || ''; } catch (e) {}
    return f || b.farbe || '#8FB8F0';
  }

  function karte(k, f) {
    var a = el('article', 'demo');
    var streif = el('div', 'streif'); streif.style.background = f; a.appendChild(streif);
    var inhalt = el('div', 'inhalt');
    var h = el('h2', null, k.titel);
    if (k.untertitel) h.appendChild(el('small', null, k.untertitel));
    inhalt.appendChild(h);
    if (k.text) inhalt.appendChild(el('p', null, k.text));
    var tags = el('div', 'tags');
    if (k.status) tags.appendChild(el('span', 'status', k.status));
    (k.tags || []).forEach(function (t) { tags.appendChild(el('span', null, t)); });
    inhalt.appendChild(tags);
    var kn = el('div', 'knopf');
    if (k.link) { var l = el('a', 'btn', k.knopf || 'Öffnen'); l.href = k.link; kn.appendChild(l); }
    else kn.appendChild(el('span', 'btn aus', k.knopf || 'Folgt bald'));
    inhalt.appendChild(kn);
    a.appendChild(inhalt);
    return a;
  }

  function zeigen(b) {
    var f = farbe(b);
    document.documentElement.style.setProperty('--sky', f);
    document.documentElement.style.setProperty('--accent', f);
    main.textContent = '';

    var kopf = el('section', 'kopf');
    kopf.appendChild(el('p', 'ueber', b.ueber || '/' + b.id));
    kopf.appendChild(el('h1', null, b.h1 || b.titel));
    if (b.text) kopf.appendChild(el('p', null, b.text));
    main.appendChild(kopf);

    if (b.chat) {
      var c = el('section', 'chat-platz'); c.id = 'chat'; c.setAttribute('aria-label', 'Chat');
      main.appendChild(c);
      if (window.CaelumChat) window.CaelumChat.start(c, b.chat);
      else document.addEventListener('caelum-chat-bereit', function () { window.CaelumChat.start(c, b.chat); }, { once: true });
    }

    if (b.karten && b.karten.length) {
      var s = el('section'); s.setAttribute('aria-label', b.kartenTitel || b.titel);
      if (b.kartenTitel) s.appendChild(el('h2', 'abschnitt', b.kartenTitel));
      var g = el('div', 'demos');
      b.karten.forEach(function (k) { g.appendChild(karte(k, f)); });
      s.appendChild(g); main.appendChild(s);
    }

    // 25.11.2026 „zusammen“: Module, die gemeinsam gebaut werden (Motion-Fenster steht oben im Motion-Block, Wunsch Kenny)
    var wecker = {}, zusammen = b.zusammen || [];
    function weckeMit(m) { if (zusammen.indexOf(m) >= 0) zusammen.forEach(function (n) { if (n !== m && wecker[n]) wecker[n](); }); }
    (b.module || []).forEach(function (m) {   // eigene Module (Schaubilder, Prototypen) aus /assets/*.js, siehe „skripte“
      var s = el('section', 'modul'); s.setAttribute('data-modul', m); main.appendChild(s);
      var los = function () {
        if (s.dataset.an) return; s.dataset.an = '1'; window.CaelumModul[m](s, f);
        // Sprungmarke (#drum-808 …) zeigt in ein Modul, das erst jetzt da ist – der Browser ist schon vorbeigesprungen
        var h = location.hash.slice(1), z = h && document.getElementById(decodeURIComponent(h));
        if (z && s.contains(z)) setTimeout(function () { z.scrollIntoView({ block: 'start' }); }, 50);
      };
      // 24.11.2026 Leistung (Lighthouse TBT): ein Modul wird erst gebaut, wenn man in seine Nähe scrollt; mit Sprungmarke sofort
      var nah = !('IntersectionObserver' in window) || !!location.hash, bereit = false;
      var versuch = function () { if (nah && bereit) { s.style.minHeight = ''; los(); } };
      if (!nah) {
        s.style.minHeight = '60vh';   // Platzhalter, damit die Module untereinander liegen und nicht alle zugleich „nah“ sind
        var wach = function () { if (nah) return; io.disconnect(); nah = true; versuch(); weckeMit(m); };
        var io = new IntersectionObserver(function (e) { if (e.some(function (x) { return x.isIntersecting; })) wach(); }, { rootMargin: '700px 0px' });
        io.observe(s); wecker[m] = wach;
        window.addEventListener('hashchange', wach, { once: true });
      }
      if (window.CaelumModul && window.CaelumModul[m]) { bereit = true; versuch(); }
      else document.addEventListener('caelum-modul', function h(e) { if (e.detail === m) { document.removeEventListener('caelum-modul', h); bereit = true; versuch(); } });
    });

    if (b.wie && b.wie.length) {
      var w = el('section', 'wie');
      w.appendChild(el('h2', null, b.wieTitel || 'So geht es'));
      var ol = el('ol');
      b.wie.forEach(function (p) { var li = el('li'); li.appendChild(el('b', null, p[0] + ':')); li.appendChild(document.createTextNode(' ' + p[1])); ol.appendChild(li); });
      w.appendChild(ol); main.appendChild(w);
    }
  }   // Übersetzung: sprache.js beobachtet neue Inhalte selbst (MutationObserver)

  fetch('/bereiche/bereiche.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) {
      var b = (j.bereiche || []).filter(function (x) { return x.id === id; })[0];
      if (!b) throw new Error('unbekannt');
      zeigen(b);
    })
    .catch(function () { main.textContent = ''; main.appendChild(el('p', 'leer', 'Dieser Bereich konnte nicht geladen werden.')); });
})();
