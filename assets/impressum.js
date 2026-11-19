// Impressum: verborgener Teil „Zweck“ und Begriffsliste (aus impressum.html ausgelagert, damit die CSP ohne Inline-Skripte auskommt).
// Verborgener Teil: Link „Zweck“ (oder Adresse mit #zweck-erklaert, #kryptologie, #skripte) klappt ihn auf.
(function () {
  var d = document.getElementById('zweck-erklaert');
  function zeigen() {
    var h = location.hash.slice(1);
    if (h && (h === d.id || d.querySelector('[id="' + h + '"]'))) { d.open = true; (document.getElementById(h) || d).scrollIntoView(); }
  }
  window.addEventListener('hashchange', zeigen);
  zeigen();
})();

// Begriffe dynamisch: begriffe.json frisch laden (gleicher Aufbau wie CAELUM/tools/begriffe.mjs), sonst bleibt der eingebaute Block.
(function () {
  var liste = document.getElementById('begriffe-liste'), suche = document.getElementById('begriffe-suche'), leer = document.getElementById('begriffe-leer');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function datum(d) { var t = String(d || '').split('-'); return t.length === 3 ? t[2] + '.' + t[1] + '.' + t[0] : ''; }
  function sicher(u) { return /^(https:\/\/|#)/.test(u || '') ? u : ''; }
  function bauen(d) {
    var z = [];
    (d.gruppen || []).forEach(function (g) {
      var s = (g.begriffe || []).filter(function (b) { return b.status !== 'entwurf' && b.text; });
      if (!s.length) return;
      z.push('<h4 id="b-' + esc(g.id) + '">' + esc(g.titel) + '</h4>');
      if (g.einleitung) z.push('<p>' + esc(g.einleitung) + '</p>');
      z.push('<dl class="abk">');
      s.forEach(function (b) {
        var name = sicher(b.link) ? '<a href="' + esc(b.link) + '" rel="noopener">' + esc(b.name) + '</a>' : esc(b.name);
        var bei = sicher(b.bei) ? ' <a class="bei" href="./' + esc(b.bei) + '">bei uns</a>' : '';
        z.push('<dt>' + name + '</dt><dd>' + esc(b.text) + bei + '</dd>');
      });
      z.push('</dl>');
    });
    if (d.schluss) z.push('<p class="quelle">' + esc(d.schluss) + ' Stand der Liste: ' + esc(datum(d.stand)) + '.</p>');
    liste.innerHTML = z.join('\n');
    filtern();
  }
  function filtern() {
    var q = (suche.value || '').trim().toLowerCase(), treffer = 0;
    liste.querySelectorAll('dl.abk').forEach(function (dl) {
      var sichtbar = 0, dts = dl.querySelectorAll('dt');
      dts.forEach(function (dt) {
        var dd = dt.nextElementSibling, ok = !q || (dt.textContent + ' ' + (dd ? dd.textContent : '')).toLowerCase().indexOf(q) >= 0;
        dt.hidden = !ok; if (dd) dd.hidden = !ok; if (ok) sichtbar++;
      });
      treffer += sichtbar;
      var h = dl.previousElementSibling; if (h && h.tagName === 'P') { h.hidden = !!q && !sichtbar; h = h.previousElementSibling; }
      if (h && h.tagName === 'H4') h.hidden = !sichtbar;
      dl.hidden = !sichtbar;
    });
    leer.hidden = treffer > 0;
  }
  suche.addEventListener('input', filtern);
  fetch('begriffe.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.gruppen) bauen(d); }).catch(function () { /* eingebauter Block bleibt */ });
})();
