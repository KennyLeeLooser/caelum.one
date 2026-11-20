// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Developer-Bereich: Karten aus /developer/demos.json. Ohne Bild zeichnet die Karte ein ruhiges Muster in der Farbe der Demo.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  var ziel = document.getElementById('demos');
  if (!ziel) return;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  // Platzhalter ohne Bildschirmfoto: Rauten im Farbton der Demo, still (kein Zufall bei jedem Laden)
  function muster(canvas, farbe) {
    var r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    var g = canvas.getContext('2d'), w = canvas.width, h = canvas.height, s = 46 * dpr;
    g.fillStyle = '#1F1E1D'; g.fillRect(0, 0, w, h);
    g.strokeStyle = farbe; g.lineWidth = 1.2 * dpr;
    for (var y = -s; y < h + s; y += s) for (var x = -s; x < w + s; x += s) {
      var t = ((x * 7 + y * 13) / s) % 5, a = 0.10 + 0.05 * t;
      g.globalAlpha = a;
      g.beginPath(); g.moveTo(x + s / 2, y); g.lineTo(x + s, y + s / 2); g.lineTo(x + s / 2, y + s); g.lineTo(x, y + s / 2); g.closePath(); g.stroke();
    }
    g.globalAlpha = 1;
  }

  function karte(d) {
    var a = el('article', 'demo');
    var bild = el('div', 'bild');
    if (d.bild) { var img = el('img'); img.src = d.bild; img.alt = d.bildText || ('Bild aus ' + d.titel); img.loading = 'lazy'; bild.appendChild(img); }
    else { var c = el('canvas'); c.setAttribute('aria-hidden', 'true'); bild.appendChild(c); requestAnimationFrame(function () { muster(c, d.farbe || '#A58BF5'); }); }
    a.appendChild(bild);
    var inhalt = el('div', 'inhalt');
    var h = el('h2', null, d.titel);
    if (d.untertitel) h.appendChild(el('small', null, d.untertitel));
    inhalt.appendChild(h);
    if (d.text) inhalt.appendChild(el('p', null, d.text));
    var tags = el('div', 'tags');
    if (d.status) tags.appendChild(el('span', 'status', d.status));
    if (d.engine) tags.appendChild(el('span', null, d.engine));
    (d.plattformen || []).forEach(function (p) { tags.appendChild(el('span', null, p)); });
    if (d.webgl) tags.appendChild(el('span', null, 'Browser'));
    inhalt.appendChild(tags);
    var k = el('div', 'knopf');
    if (d.webgl) { var l = el('a', 'btn', 'Im Browser spielen'); l.href = '/developer/spielen.html?id=' + encodeURIComponent(d.id); k.appendChild(l); }
    else k.appendChild(el('span', 'btn aus', 'Web-Demo folgt'));
    inhalt.appendChild(k);
    a.appendChild(inhalt);
    return a;
  }

  fetch('/developer/demos.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) {
      ziel.textContent = '';
      (j.demos || []).forEach(function (d) { ziel.appendChild(karte(d)); });
      if (!ziel.children.length) ziel.appendChild(el('p', 'leer', 'Noch keine Demos veröffentlicht.'));
    })
    .catch(function () { ziel.textContent = ''; ziel.appendChild(el('p', 'leer', 'Die Demos konnten nicht geladen werden.')); });
})();
