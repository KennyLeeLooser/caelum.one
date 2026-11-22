// Copyright © 2026 Caelum GmbH. Skripte der Startseite (B 8 CSP, 22.11.2026): früher inline in index.html,
// jetzt hier, damit index.html mit CSP script-src 'self' läuft. Reihenfolge und Zeitpunkt wie vorher (klassisch, nicht defer).
// Downloads aus downloads.json (schreibt CAELUM Pandora aus den GitHub-Releases). Ohne Datei bleiben die Links oben stehen.
(function () {
  var list = document.getElementById('dl-list');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function mb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function date(d) { if (!d) return ''; var p = d.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  fetch('downloads.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    if (!data || !data.downloads || !data.downloads.length) return;
    list.innerHTML = data.downloads.map(function (d) {
      var files = (d.files || []).map(function (f) {
        return '<div class="dl-file"><a href="' + esc(f.url) + '">' + esc(f.name) + '</a><span class="size">' + mb(f.size) + '</span>'
          + (f.sha256 ? '<code>SHA-256 ' + esc(f.sha256) + '</code>' : '') + '</div>';
      }).join('');
      var plat = (d.platform || 'windows') === 'android' ? 'Android' : 'Windows';
      return '<article class="card"><div class="tag"><i style="background:var(--info)"></i>Version ' + esc(d.version) + ' · ' + esc(date(d.date)) + '<span class="plat">' + plat + '</span></div>'
        + '<h3>' + esc(d.product) + '</h3>' + (plat === 'Android' ? '<p class="small">Installation: APK auf dem Handy öffnen und „Aus dieser Quelle installieren“ einmal erlauben. Vorher die Prüfsumme vergleichen.</p>' : '') + (files || '<p>Noch keine Datei in diesem Release.</p>')
        + '<a class="more" href="' + esc(d.page) + '">Versionshinweise →</a></article>';
    }).join('') + (data.downloads.some(function (d) { return d.platform === 'android'; }) ? '' :
      '<article class="card"><div class="tag"><i style="background:var(--ok)"></i>Bald<span class="plat">Android</span></div><h3>Apps für Android</h3>'
      + '<p>Unsere Handy-Apps kommen als APK direkt hier zum Download – mit Prüfsumme, ohne Umweg über einen Store.</p></article>');
  }).catch(function () { /* Links oben bleiben stehen */ });
})();

// Updates aus updates.json, kompakt unter der Fusszeile (neueste zuerst; status "intern" wird nicht gezeigt).
(function () {
  var list = document.getElementById('upd-list'), alt = document.getElementById('upd-alt'), box = document.getElementById('upd-alt-box');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function date(d) { if (!d) return ''; var p = d.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function fail() { list.innerHTML = '<li class="upd leer">Die Updates lassen sich gerade nicht laden. Siehe <a href="#downloads">Downloads</a>.</li>'; }
  function zeile(u) {
    var badge = u.status === 'release' ? '<span class="badge release">Release</span>' : '<span class="badge">Vorschau</span>';
    var titel = esc(u.title) + (u.link ? ' · <a href="' + esc(u.link) + '">Hinweise</a>' : '');
    return '<li class="upd" title="' + esc((u.points || []).join(' · ')) + '"><time datetime="' + esc(u.date) + '">' + esc(date(u.date)) + '</time>'
      + '<span class="prod">' + esc(u.product) + '<span class="ver">' + esc(u.version) + '</span></span>'
      + '<span class="titel">' + titel + '</span>' + badge + '</li>';
  }
  fetch('updates.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (data) {
    var items = ((data && data.updates) || []).filter(function (u) { return u.status !== 'intern'; });
    if (!items.length) return fail();
    list.innerHTML = items.slice(0, 4).map(zeile).join('');
    if (items.length > 4) { alt.innerHTML = items.slice(4, 20).map(zeile).join(''); box.hidden = false; }
  }).catch(fail);
})();

// Einstellungen der Seite. KONTAKT_URL = Web-App-Adresse des Google Apps Script (Konto kenny@caelum.one); leer = E-Mail-Programm öffnen.
var CAELUM_SITE = {
  KONTAKT_URL: 'https://script.google.com/macros/s/AKfycbz7ljrIvnuA9frpcRCMdNliun200wI8iYmvCF26dgl_3swiT5yiRbfo8obZZncS9r33/exec',
  PORTALE: { gravur: { live: true, pfad: 'gravur/' } },
  // Google-Anmeldung: OAuth-Client (Projekt caelum-web) und Web-App „Caelum Kunden“. Beide leer = Knopf aus.
  GOOGLE: {
    CLIENT_ID: '787870908248-adg8d7ulv5ihiie4ahgefe5l63of6ecq.apps.googleusercontent.com',
    ZUGANG_URL: 'https://script.google.com/macros/s/AKfycby2-eYtWh-42XLM6Rq3k6PWXg_6TnZzL2eX3rnk4gHhyHwD8FhXPKMJ4MhaciZsDlSoeQ/exec'
  }
};
(function () {
  // Kontaktformular
  var f = document.getElementById('kontakt-form'), msg = document.getElementById('kontakt-msg');
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = { name: f.elements.name.value.trim(), email: f.elements.email.value.trim(), nachricht: f.elements.nachricht.value.trim(), website: f.elements.website.value };
    if (d.website) return;
    if (!CAELUM_SITE.KONTAKT_URL) {
      location.href = 'mailto:info@caelum.one?subject=' + encodeURIComponent('Anfrage von ' + d.name)
        + '&body=' + encodeURIComponent(d.nachricht + '\n\n' + d.name + ' <' + d.email + '>');
      msg.textContent = 'Dein E-Mail-Programm öffnet sich mit der Nachricht.';
      return;
    }
    var b = f.querySelector('button'); b.disabled = true; msg.className = 'msg'; msg.textContent = 'Wird gesendet …';
    fetch(CAELUM_SITE.KONTAKT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(d) })
      .then(function () { f.reset(); msg.className = 'msg ok'; msg.textContent = 'Danke! Deine Nachricht ist unterwegs zu uns.'; })
      .catch(function () { msg.textContent = 'Senden ging nicht. Bitte schreib direkt an info@caelum.one.'; })
      .then(function () { b.disabled = false; });
  });

  // Kundenzugang mit Baustellen-Code
  var z = document.getElementById('zugang'), zm = document.getElementById('zugang-msg');
  z.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = document.getElementById('zugang-code').value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!code) { zm.textContent = 'Bitte den Baustellen-Code eingeben.'; return; }
    var p = CAELUM_SITE.PORTALE.gravur;
    if (!p.live) { zm.textContent = 'Das Portal ist noch nicht freigeschaltet. Wir melden uns, sobald es bereit ist.'; return; }
    location.href = p.pfad + '?code=' + encodeURIComponent(code);
  });

  // Kundenzugang mit Google: lädt das Google-Skript erst nach dem Klick (Datenschutz)
  var gb = document.getElementById('zugang-google'), G = CAELUM_SITE.GOOGLE;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  // Nach der Anmeldung: Google-Knopf ausblenden, „Abmelden“ zeigen. Abmelden setzt alles zurück und
  // sagt Google, kein Konto mehr automatisch vorzuschlagen – so kann sich ein anderes Konto anmelden.
  function angemeldet(email) {
    var box = document.getElementById('zugang-google-box'); if (box) box.hidden = true;
    var out = document.getElementById('zugang-abmelden');
    if (!out) {
      out = document.createElement('button'); out.type = 'button'; out.id = 'zugang-abmelden'; out.className = 'btn plain';
      out.addEventListener('click', function () {
        try { google.accounts.id.disableAutoSelect(); } catch (e) {}
        out.remove(); if (box) box.hidden = false;
        zm.textContent = 'Abgemeldet. Du kannst dich mit einem anderen Google-Konto anmelden (Pfeil im Google-Knopf).';
      });
      (box || gb).after(out);
    }
    out.textContent = 'Abmelden (' + email + ')';
  }
  function baustellen(r) {
    if (r && r.ok) angemeldet(r.email);
    if (!r || !r.ok) { zm.textContent = 'Anmeldung ging nicht: ' + ((r && r.fehler) || 'unbekannter Fehler') + '.'; return; }
    if (!r.baustellen.length) { zm.textContent = 'Angemeldet als ' + r.email + '. Für diese Adresse ist noch keine Baustelle freigeschaltet – schreib uns an info@caelum.one.'; return; }
    var p = CAELUM_SITE.PORTALE.gravur;
    if (p.live && r.baustellen.length === 1) { location.href = p.pfad + '?code=' + encodeURIComponent(r.baustellen[0]); return; }
    zm.innerHTML = 'Angemeldet als ' + esc(r.email) + '. Deine Baustellen: ' + r.baustellen.map(function (c) {
      return p.live ? '<a href="' + p.pfad + '?code=' + encodeURIComponent(c) + '">' + esc(c) + '</a>' : '<b>' + esc(c) + '</b>';
    }).join(', ') + (p.live ? '' : ' – das Portal wird bald freigeschaltet.');
  }
  if (G.CLIENT_ID && G.ZUGANG_URL) {
    gb.disabled = false; gb.title = 'Anmeldung mit deinem Google-Konto';
    zm.textContent = 'Den Code bekommst du von uns zusammen mit der Baustelle – oder melde dich mit Google an.';
    gb.addEventListener('click', function () {
      gb.disabled = true; zm.textContent = 'Google-Anmeldung wird geladen …';
      var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onerror = function () { gb.disabled = false; zm.textContent = 'Google ist gerade nicht erreichbar. Bitte den Baustellen-Code verwenden.'; };
      s.onload = function () {
        google.accounts.id.initialize({ client_id: G.CLIENT_ID, ux_mode: 'popup', callback: function (c) {
          zm.textContent = 'Anmeldung wird geprüft …';
          fetch(G.ZUGANG_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ idToken: c.credential }) })
            .then(function (r) { return r.json(); }).then(baustellen)
            .catch(function () { zm.textContent = 'Prüfung ging nicht. Bitte später nochmals oder mit dem Baustellen-Code.'; });
        } });
        var box = document.createElement('div'); box.id = 'zugang-google-box'; gb.replaceWith(box);
        google.accounts.id.renderButton(box, { theme: 'filled_black', text: 'signin_with', shape: 'pill', locale: 'de' });
        zm.textContent = 'Bitte jetzt mit Google fortfahren.';
      };
      document.head.appendChild(s);
    });
  }
})();

// Developer-Schalter: erst umlegen, dann wechseln; mit Strg/Cmd/Mittelklick normal öffnen
document.addEventListener("click", function (e) {
  var a = e.target.closest && e.target.closest(".dev-schalter");
  if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches && a.getAttribute("href") !== "#") return;
  e.preventDefault(); a.classList.add("an");
  // Seit 20.11.2026 hat jeder Bereich eine eigene Seite (/bereiche/bereiche.json); Partner zeigt die Werkstatt dort als Karte (/#werkstatt).
  if (a.getAttribute("href") === "#") {   // Bereich ohne eigene Seite (noch): kurz umlegen, Gans sagt Bescheid
    setTimeout(function () { a.classList.remove("an"); }, 900);
    var satz = "Der Bereich {name} ist offen – Inhalte folgen bald.", name = { name: a.querySelector("b").textContent };   // Übersetzung: unterseiten.mjs
    if (window.CaelumGans) window.CaelumGans.sag(window.CaelumSprache && window.CaelumSprache.t ? window.CaelumSprache.t(satz, name) : satz.replace("{name}", name.name));
    return;
  }
  setTimeout(function () { location.href = a.href; }, 260);
});
// /#werkstatt (Karte im Bereich Partner) öffnet die Logo-Werkstatt direkt
window.addEventListener("load", function () {
  if (location.hash === "#werkstatt" && window.CaelumWerkstatt) window.CaelumWerkstatt.oeffnen();
});
window.addEventListener("hashchange", function () {
  if (location.hash === "#werkstatt" && window.CaelumWerkstatt) window.CaelumWerkstatt.oeffnen();
});

// Caelum Optionen (Kenny 20.11.2026): Rechtsklick auf ein Logo öffnet nie das Browser-Menü, sondern ein schlichtes
// Menü im Design der Seite. Die Akzentfarbe der Seite (früher fest Orange) folgt dem Logo; im Menü wählt man sie aus
// drei Farben des Logos. Das Logo in der Fusszeile startet leer – wer weiss, dass man die Felder anklicken kann
// (oder „Logo füllen“ im Menü findet), malt es aus. Esc schliesst das Menü.
document.addEventListener('DOMContentLoaded', function () {
  var NS = 'http://www.w3.org/2000/svg', root = document.documentElement;
  var signet = document.querySelector('.signet'), fuss = document.querySelector('.fusslogo');
  var ziel = fuss && fuss.querySelector('.felder'), quelle = document.querySelectorAll('.signet svg.felder path.cell');
  if (!signet || !quelle.length) return;
  var L = function () { return window.CaelumLogo || null; };
  function farben() { var l = L(); return (l && l.spektrum().farben.length) ? l.spektrum().farben : ['#D97757', '#F2B05A', '#A58BF5']; }
  // Fusslogo-Mal-Farben (B 6, Kenny 21.11.2026): immer gleich stehen lassen. Die Harmonien liefern 5 oder 6 Töne in
  // eigener Reihenfolge; im Fusslogo stehen sie deshalb fest von hell nach dunkel, Platz 1 ist immer der hellste Ton.
  // Hat eine Harmonie weniger Töne, nimmt ein Feld weiter hinten den dunkelsten (kein Umlauf an den Anfang).
  function hell(hex) {
    var n = parseInt(hex.slice(1), 16), k = [n >> 16 & 255, n >> 8 & 255, n & 255].map(function (v) { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
  }
  function malFarben() { return farben().slice().sort(function (a, b) { return (hell(b) - hell(a)) || (a < b ? -1 : a > b ? 1 : 0); }); }

  // --- Akzentfarbe der Seite folgt dem Logo ---
  function akzent() { var l = L(); if (l && l.spektrum().akzent) root.style.setProperty('--accent', l.spektrum().akzent); }
  akzent();
  document.addEventListener('caelum-spektrum', akzent);

  // --- Fusszeile: leer, Felder per Klick ausmalen ---
  function zeigen(p) {
    var i = +p.dataset.i, f = malFarben();
    if (i < 0) { p.removeAttribute('style'); p.classList.remove('voll'); return; }
    var c = f[Math.min(i, f.length - 1)]; p.style.fill = c; p.style.stroke = c; p.classList.add('voll');
  }
  var fussFelder = [];
  if (ziel) {
    Array.prototype.forEach.call(quelle, function (q) {
      var p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'cell'); p.setAttribute('d', q.getAttribute('d')); p.dataset.i = '-1';
      p.dataset.n = q.getAttribute('data-n') || '';
      p.addEventListener('click', function () { var n = +p.dataset.i + 1; p.dataset.i = n >= malFarben().length ? -1 : n; zeigen(p); });
      ziel.appendChild(p); fussFelder.push(p);
    });
  }
  function fuellen() {   // jedes Feld eine Farbe, Nachbarn verschieden, kleine Welle
    var f = farben(), byId = {};
    fussFelder.forEach(function (p, k) { byId['f' + ('0' + k).slice(-2)] = p; p.dataset.i = '-1'; });
    fussFelder.forEach(function (p, k) {
      var belegt = {};
      p.dataset.n.split(/\s+/).forEach(function (id) { var n = byId[id]; if (n && +n.dataset.i >= 0) belegt[n.dataset.i] = 1; });
      var frei = []; for (var i = 0; i < f.length; i++) if (!belegt[i]) frei.push(i);
      p.dataset.i = String(frei.length ? frei[Math.floor(Math.random() * frei.length)] : k % f.length);
      setTimeout(function () { zeigen(p); }, k * 40);
    });
    if (typeof pruefen === 'function') pruefen();
  }
  function leeren() { fussFelder.forEach(function (p, k) { p.dataset.i = '-1'; setTimeout(function () { zeigen(p); }, k * 25); }); if (typeof pruefen === 'function') pruefen(); }
  document.addEventListener('caelum-spektrum', function () { fussFelder.forEach(zeigen); });

  // --- Zeichen: ein bestimmtes Bild im Fusszeilen-Logo öffnet einen verborgenen Bereich (Kenny 20.11.2026) ---
  // felder = genau diese Felder gefüllt, alle anderen leer, alle in derselben Farbe. Feldkarte: WEBSEITE-LOGO-FELDER.svg.
  // Passt das Bild nicht mehr (andere Farbe, Feld dazu/weg), verschwindet der Schieber sofort wieder.
  // Nur eine versteckte Tür, kein Schutz: was geheim bleiben muss, gehört hinter den Kundenzugang (Server).
  var ZEICHEN = [
    { name: 'developer', titel: 'Developer', info: 'Demos aus unseren Spielen', href: '/developer/', felder: ['f00', 'f04'] },                                   // kleiner Tropfen
    { name: 'webdesign', titel: 'Webdesign', info: 'Webseiten und Web-Module', href: '/webdesign/', felder: ['f03'] },                                                              // 1 Mond
    { name: 'studio', titel: 'Studio', info: '3D, Unity und Blender', href: '/studio/', felder: ['f00', 'f03', 'f04', 'f05', 'f06', 'f07', 'f10', 'f11', 'f16', 'f17'] }, // 2 Dreieck
    { name: 'labor', titel: 'Labor', info: 'KI und Versuche', href: '/labor/', felder: ['f00', 'f03', 'f04', 'f16', 'f17'] },                                                     // 3 grosser Tropfen
    { name: 'partner', titel: 'Partner', info: 'Für Kunden und Partner', href: '/partner/', felder: ['f00', 'f01', 'f02', 'f03', 'f04', 'f05', 'f06', 'f07', 'f08', 'f09', 'f10', 'f11', 'f12', 'f13', 'f14', 'f15', 'f16', 'f17'] }, // 4 Viereck
    { name: 'community', titel: 'Community', info: 'Austausch mit anderen', href: '/community/', felder: ['f00', 'f01', 'f02', 'f03', 'f04', 'f05', 'f10', 'f11', 'f14', 'f15', 'f16', 'f17'] }, // 5 Kreis
    { name: 'sounddesign', titel: 'Sound Design', info: 'Klang, Musik und Bewegung', href: '/sounddesign/', felder: ['f01', 'f02'] }                                       // 6 Ohren (Kenny 21.11.2026)
  ];
  var WINZIG = { f18: 1, f19: 1 };   // im 76-px-Logo ~1 px gross, mit dem Finger nicht zu treffen → zählen nie mit
  function gemalt() {
    var voll = {};
    fussFelder.forEach(function (p, k) { var id = 'f' + ('0' + k).slice(-2); if (+p.dataset.i >= 0 && !WINZIG[id]) voll[id] = p.dataset.i; });
    return voll;
  }
  function passend() {
    var voll = gemalt(), ids = Object.keys(voll);
    return ZEICHEN.filter(function (z) {
      // genau diese Felder: jedes muss gemalt sein (vorher zählte nur die Anzahl – zwei beliebige Felder öffneten Developer, 21.11.2026)
      return ids.length === z.felder.length && z.felder.every(function (id) { return voll[id] !== undefined && voll[id] === voll[z.felder[0]]; });
    })[0] || null;
  }
  function pruefen() { var z = passend(); if (z) oeffnen(z); else schliessen(); }
  function offen() { return root.getAttribute('data-zeichen'); }
  function oeffnen(z, still) {
    var alle = document.querySelectorAll('.dev-schalter');   // oben im Kopf und unter dem Fusszeilen-Logo
    // Schieber in der Farbe, in der das Zeichen gemalt ist (Kenny 20.11.2026)
    var p0 = fussFelder[+z.felder[0].slice(1)], farbe = (p0 && p0.style.fill) || (function () { try { return localStorage.getItem('caelum-zeichen-farbe'); } catch (e) { return ''; } })() || '';
    if (farbe) { root.style.setProperty('--zeichen', farbe); try { localStorage.setItem('caelum-zeichen-farbe', farbe); } catch (e) {} }
    if (!alle.length || offen() === z.name) return;
    root.setAttribute('data-zeichen', z.name); root.classList.add('zeichen-offen');
    root.classList.toggle('dev-offen', z.name === 'developer');
    Array.prototype.forEach.call(alle, function (a) {
      a.href = z.href || '#'; a.title = z.titel + ': ' + z.info; a.setAttribute('aria-label', z.titel + ' – ' + z.info);
      a.dataset.zeichen = z.name; a.querySelector('b').textContent = z.titel;
      if (still !== true) { a.classList.remove('neu'); void a.offsetWidth; a.classList.add('neu'); setTimeout(function () { a.classList.remove('neu'); }, 2400); }
    });
    try { localStorage.setItem('caelum-zeichen', z.name); localStorage.removeItem('caelum-developer'); } catch (e) {}
  }
  function schliessen() {
    if (!offen()) return;
    root.removeAttribute('data-zeichen'); root.classList.remove('zeichen-offen', 'dev-offen'); root.style.removeProperty('--zeichen');
    try { localStorage.removeItem('caelum-zeichen'); localStorage.removeItem('caelum-developer'); } catch (e) {}
  }
  window.CaelumZeichen = { liste: ZEICHEN, offen: offen, pruefen: pruefen };
  try {
    var gemerkt = localStorage.getItem('caelum-zeichen') || (localStorage.getItem('caelum-developer') === '1' ? 'developer' : '');
    var zg = ZEICHEN.filter(function (z) { return z.name === gemerkt; })[0];
    if (zg) oeffnen(zg, true);
  } catch (e) {}
  fussFelder.forEach(function (p) { p.addEventListener('click', pruefen); });

  // --- Logo als SVG speichern (so wie es gerade aussieht) ---
  function speichern(von) {
    var linie = document.querySelector('.signet svg.lines path');
    var felder = von === 'fuss' ? fussFelder : Array.prototype.slice.call(quelle);
    var teile = felder.map(function (p) {
      var c = von === 'fuss' ? (p.style.fill || '#30302E') : (p.getAttribute('fill') || '#30302E');
      return '<path fill="' + c + '" stroke="' + c + '" stroke-width="4" stroke-linejoin="round" d="' + p.getAttribute('d') + '"/>';
    }).join('');
    var lc = '#E8E6E1';
    var svg = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Copyright © 2026 Caelum GmbH. Caelum-Logo, Farbharmonie: ' + (L() ? L().spektrum().name : '') + ' -->\n'
      + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="44 44 936 936" width="1024" height="1024">'
      + '<rect x="66" y="66" width="892" height="892" fill="#262624"/>' + teile
      + '<path fill="' + lc + '" fill-rule="evenodd" d="' + (linie ? linie.getAttribute('d') : '') + '"/></svg>\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = 'caelum-logo-' + (L() ? L().spektrum().art : 'farben') + '.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // --- Menü „Caelum Optionen“ ---
  var menu = document.createElement('div');
  menu.className = 'logo-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', 'Caelum Optionen'); menu.hidden = true;
  document.body.appendChild(menu);
  var vorher = null, von = 'signet', perTaste = false;
  function knopf(text, tun, cls) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem'); if (cls) b.className = cls;
    if (text) b.textContent = text;
    b.addEventListener('click', function (e) { tun(e); });
    return b;
  }
  function bauen() {
    menu.textContent = '';
    var l = L(), s = l ? l.spektrum() : null;
    var kopf = document.createElement('div'); kopf.className = 'kopf'; kopf.textContent = 'Caelum Optionen'; menu.appendChild(kopf);
    if (l) {
      // Harmonien als kleine Farbrunde, Name darunter
      var reihe = document.createElement('div'); reihe.className = 'reihe'; reihe.setAttribute('role', 'group'); reihe.setAttribute('aria-label', 'Farbharmonie');
      var name = document.createElement('div'); name.className = 'name'; name.textContent = s.name;
      l.harmonien.forEach(function (h) {
        var f = l.vorschau(h.art), n = f.length, stopps = f.map(function (c, i) { return c + ' ' + (i * 360 / n) + 'deg ' + ((i + 1) * 360 / n) + 'deg'; }).join(', ');
        var b = knopf('', function () { l.harmonie(h.art); bauen(); fokus(); }, 'rund');
        b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(s.art === h.art));
        b.setAttribute('aria-label', h.name); b.title = h.name;
        b.style.background = 'conic-gradient(' + stopps + ')';
        b.addEventListener('mouseenter', function () { name.textContent = h.name; });
        b.addEventListener('focus', function () { name.textContent = h.name; });
        reihe.appendChild(b);
      });
      reihe.addEventListener('mouseleave', function () { name.textContent = L().spektrum().name; });
      menu.appendChild(reihe); menu.appendChild(name);
      // drei Akzentfarben aus dem Logo
      var ak = document.createElement('div'); ak.className = 'akzente'; ak.setAttribute('role', 'group'); ak.setAttribute('aria-label', 'Akzentfarbe der Seite');
      s.akzente.forEach(function (c, i) {
        var b = knopf('', function () { l.akzent(i); bauen(); fokus(); }, 'feld');
        b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(s.akzentNr === i));
        b.setAttribute('aria-label', 'Akzentfarbe ' + (i + 1)); b.style.background = c;
        ak.appendChild(b);
      });
      menu.appendChild(ak);
      if (von !== 'fuss') {   // Linienfarbe: Schwarz (Standard), die sieben Grundtöne (Chakra-Farben), Weiss
        var kl = document.createElement('div'); kl.className = 'klein'; kl.textContent = 'Linienfarbe'; menu.appendChild(kl);
        var li = document.createElement('div'); li.className = 'linien'; li.setAttribute('role', 'group'); li.setAttribute('aria-label', 'Linienfarbe');
        var jetzt = linienfarbe();
        LINIEN.forEach(function (e) {
          var b = knopf('', function () { linienfarbe(e[0]); bauen(); fokus(); }, 'linie');
          b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', String(jetzt === e[0]));
          b.setAttribute('aria-label', e[1]); b.title = e[1]; b.style.background = e[0];
          li.appendChild(b);
        });
        menu.appendChild(li);
      }
      menu.appendChild(trenn());
    }
    if (von === 'fuss') {
      menu.appendChild(knopf('Logo füllen', function () { zu(); fuellen(); }));
      menu.appendChild(knopf('Logo leeren', function () { zu(); leeren(); }));
    } else if (l) {
      menu.appendChild(knopf('Neuer Grundton', function () { l.neuerTon(); bauen(); fokus(); }));
      menu.appendChild(knopf(s.halten ? 'Bewegung fortsetzen' : 'Bewegung anhalten', function () { zu(); l.halten(!s.halten); }));
    }
    // Good Goose nur noch am Fusslogo; „Als SVG speichern“ ist in die Logo-Werkstatt (Zeichen Partner) gewandert (Kenny 20.11.2026)
    var G = window.CaelumGans;
    if (G && von === 'fuss') menu.appendChild(knopf(G.offen() ? 'Good Goose schliessen' : 'Good Goose öffnen', function () { zu(); if (G.offen()) G.schliessen(); else G.oeffnen(true); }));
  }
  var LINIEN = [['#262624', 'Schwarz (Standard)'], ['#E53935', 'Rot'], ['#FB8C00', 'Orange'], ['#FDD835', 'Gelb'], ['#43A047', 'Grün'],
    ['#1E88E5', 'Blau'], ['#3949AB', 'Indigo'], ['#8E24AA', 'Violett'], ['#E8E6E1', 'Weiss']];
  function linienfarbe(c) {
    if (c === undefined) { try { return localStorage.getItem('caelum-logo-linie') || '#262624'; } catch (e) { return '#262624'; } }
    root.style.setProperty('--logo-linie', c);
    try { if (c === '#262624') localStorage.removeItem('caelum-logo-linie'); else localStorage.setItem('caelum-logo-linie', c); } catch (e) {}
  }
  if (linienfarbe() !== '#262624') root.style.setProperty('--logo-linie', linienfarbe());
  function trenn() { var d = document.createElement('div'); d.className = 'trenn'; d.setAttribute('role', 'separator'); return d; }
  function fokus() { var b = menu.querySelector('[aria-checked="true"]') || menu.querySelector('button'); if (b) b.focus({ preventScroll: true }); }
  function auf(e, wer) {
    e.preventDefault(); e.stopPropagation();
    von = wer; vorher = document.activeElement; perTaste = !e.clientX && !e.clientY;
    bauen();
    menu.classList.remove('offen'); menu.hidden = false;
    var x = e.clientX, y = e.clientY;
    if (!x && !y) { var r = e.currentTarget.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2; }
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var lx = Math.max(8, Math.min(x, innerWidth - w - 8)), ly = Math.max(8, Math.min(y, innerHeight - h - 8));
    menu.style.left = lx + 'px'; menu.style.top = ly + 'px';
    menu.style.transformOrigin = (x - lx) + 'px ' + (y - ly) + 'px';
    requestAnimationFrame(function () { menu.classList.add('offen'); });
    fokus();
  }
  function zu() {
    if (menu.hidden) return;
    menu.hidden = true; menu.classList.remove('offen');
    if (perTaste && vorher && vorher.focus) vorher.focus({ preventScroll: true }); else if (document.activeElement && menu.contains(document.activeElement)) document.activeElement.blur();
  }
  function rechts(el, wer) {
    el.addEventListener('contextmenu', function (e) { if (!menu.hidden && von === wer) { e.preventDefault(); return; } auf(e, wer); });
    // iOS Safari kennt kein contextmenu beim langen Drücken: 600 ms halten öffnet das Menü selbst
    var uhr = 0, x0 = 0, y0 = 0, geschluckt = false;
    function stopp() { clearTimeout(uhr); uhr = 0; }
    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch') return;
      stopp(); geschluckt = false; x0 = e.clientX; y0 = e.clientY;
      uhr = setTimeout(function () {
        uhr = 0; if (!menu.hidden) return;
        geschluckt = true;
        auf({ preventDefault: function () {}, stopPropagation: function () {}, clientX: x0 || 1, clientY: y0 || 1, currentTarget: el }, wer);
      }, 600);
    });
    el.addEventListener('pointermove', function (e) { if (uhr && Math.abs(e.clientX - x0) + Math.abs(e.clientY - y0) > 12) stopp(); });
    el.addEventListener('pointerup', stopp); el.addEventListener('pointercancel', stopp);
    // Loslassen nach dem Halten ist kein Klick (sonst wechselt die Harmonie)
    el.addEventListener('click', function (e) { if (geschluckt) { geschluckt = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }
  rechts(signet, 'signet');
  if (fuss) rechts(fuss, 'fuss');
  menu.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  document.addEventListener('pointerdown', function (e) { if (!menu.contains(e.target)) zu(); });
  addEventListener('scroll', zu, { passive: true }); addEventListener('resize', zu);
  menu.addEventListener('keydown', function (e) {
    var bs = Array.prototype.slice.call(menu.querySelectorAll('button')), i = bs.indexOf(document.activeElement);
    if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); zu(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
  });
});

// Sprünge auf derselben Seite (Schaubild, Menü, Karten): weite Wege nicht scrollen, sondern abblenden → springen → einblenden.
// Kurze Wege (unter einer Bildschirmhöhe) scrollen weiter sanft. Ziel-Karte bzw. Fusslogo leuchtet kurz auf.
(function () {
  var blende = document.createElement('div'); blende.className = 'blende'; blende.setAttribute('aria-hidden', 'true');
  document.body.appendChild(blende);
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)');
  function zeigen(z) {
    if (!z.matches('.card, .fusslogo')) return;
    z.classList.remove('ziel-blick'); void z.getBoundingClientRect(); z.classList.add('ziel-blick');
    setTimeout(function () { z.classList.remove('ziel-blick'); }, 1900);
  }
  function hin(z, sofort) {
    var html = document.documentElement, alt = html.style.scrollBehavior;
    if (sofort) html.style.scrollBehavior = 'auto';
    z.scrollIntoView({ block: z.matches('.fusslogo') ? 'center' : 'start', behavior: sofort ? 'auto' : 'smooth' });
    html.style.scrollBehavior = alt;
  }
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a || a.closest('.logo-menu')) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1)), z = id && document.getElementById(id); if (!z) return;
    e.preventDefault();
    if (location.hash !== '#' + id) history.pushState(null, '', '#' + id);
    var weit = Math.abs(z.getBoundingClientRect().top) > innerHeight * 0.9;
    if (ruhig.matches || !weit) { hin(z, ruhig.matches); zeigen(z); return; }
    blende.classList.remove('auf'); blende.classList.add('zu');
    setTimeout(function () {
      hin(z, true);
      requestAnimationFrame(function () { blende.classList.add('auf'); blende.classList.remove('zu'); zeigen(z); });
      setTimeout(function () { blende.classList.remove('auf'); }, 600);
    }, 230);
  });
})();
