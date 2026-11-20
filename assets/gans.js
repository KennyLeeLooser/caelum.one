// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Good Goose auf www.caelum.one: erscheint erst über „Good Goose öffnen“ (Caelum Optionen am Logo oder Karte Good Goose),
// läuft dann auf dem unteren Rand, hilft mit wenigen Funktionen und beantwortet Fragen zur Seite aus assets/gans-wissen.json.
// Alles läuft im Browser: keine Frage geht an einen Server, kein Tracking, keine Cookies. Persönliches blockt sie ab.
// Bilder: assets/gans/*.png, gerendert aus gans_char_goose.glb (GoodGoose/tools/web-gans-bilder.py, Blender headless).
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  if (window.CaelumGans) return;
  var BASIS = '/assets/gans/', PX = 64, MAX = 192, FUSS = 0.034;   // PX = kleinste Grösse; FUSS: Leerraum unter den Füssen (Anteil) → Gans steht auf dem Rand
  var FOLGEN = { waddle: 8, idle: 6, honk: 8, wave: 6, sleep: 4 };
  var TEMPO = { waddle: 90, idle: 160, honk: 110, wave: 120, sleep: 420 };
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function merk(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }

  var css = document.createElement('style');
  css.textContent = [
    '.gans{position:fixed;left:0;bottom:0;width:' + PX + 'px;height:' + PX + 'px;z-index:30;cursor:pointer;border:0;padding:0;background:none;touch-action:manipulation;-webkit-tap-highlight-color:transparent;transition:opacity .4s}',
    '.gans[hidden]{display:none}.gans.weg{opacity:0}',
    '.gans .bild{position:absolute;inset:0;background-repeat:no-repeat;background-size:auto 100%;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}',
    '.gans.rechts .bild{transform:scaleX(-1)}',
    '.gans.skalieren{cursor:ns-resize;touch-action:none}',
    // Umriss: gleiche Bildfolge dahinter, eingefärbt und nach allen Seiten verschoben, durch eine Maske gestrichelt
    '.gans .umriss{position:absolute;inset:0;background-repeat:no-repeat;background-size:auto 100%;opacity:0;transition:opacity .15s;filter:brightness(0) drop-shadow(2px 0 0 var(--accent,#D97757)) drop-shadow(-2px 0 0 var(--accent,#D97757)) drop-shadow(0 2px 0 var(--accent,#D97757)) drop-shadow(0 -2px 0 var(--accent,#D97757));-webkit-mask-image:repeating-conic-gradient(from 0deg at 50% 55%,#000 0 5deg,transparent 5deg 10deg);mask-image:repeating-conic-gradient(from 0deg at 50% 55%,#000 0 5deg,transparent 5deg 10deg)}',
    '.gans.skalieren .umriss{opacity:1}.gans.rechts .umriss{transform:scaleX(-1)}',
    '.gans:focus-visible{outline:2px solid var(--accent,#D97757);outline-offset:2px;border-radius:8px}',
    '.gans-blase{position:fixed;z-index:31;bottom:72px;width:min(320px,calc(100vw - 24px));max-height:calc(100vh - ' + (PX + 24) + 'px);overflow:auto;background:var(--surface,#30302E);color:var(--text,#E8E6E1);border:1px solid var(--line,#3A3A37);border-radius:14px;padding:12px 14px;font:14px/1.45 Inter,"Segoe UI",system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.4);opacity:0;transform:translateY(6px);transition:opacity .2s,transform .2s}',
    '.gans-blase.offen{opacity:1;transform:none}',
    '.gans-blase p{margin:0 0 8px}.gans-blase p:last-child{margin:0}',
    '.gans-blase .wahl{display:flex;flex-direction:column;gap:6px;margin-top:4px}',
    '.gans-blase button{all:unset;cursor:pointer;padding:8px 10px;border-radius:9px;background:var(--bg-deep,#1F1E1D);color:var(--text-soft,#C9C6BF)}',
    '.gans-blase button:hover,.gans-blase button:focus-visible{color:var(--text,#fff);box-shadow:inset 0 0 0 1px var(--accent,#D97757)}',
    '.gans-blase .zu{position:absolute;top:4px;right:6px;padding:2px 7px;background:none;color:var(--muted,#8A8780)}',
    '.gans-chat{display:flex;flex-direction:column;gap:6px;margin:4px 0 8px}',
    '.gans-chat .ich,.gans-chat .sie{padding:7px 10px;border-radius:11px;max-width:88%}',
    '.gans-chat .ich{align-self:flex-end;background:color-mix(in srgb,var(--accent,#D97757) 28%,var(--bg-deep,#1F1E1D))}',
    '.gans-chat .sie{align-self:flex-start;background:var(--bg-deep,#1F1E1D)}',
    '.gans-chat .sie button{display:inline-block;margin-top:6px;padding:4px 9px;font-size:13px;background:var(--surface,#30302E)}',
    '.gans-frage{display:flex;gap:6px}',
    '.gans-frage input{flex:1;min-width:0;font:inherit;color:var(--text,#E8E6E1);background:var(--bg-deep,#1F1E1D);border:1px solid var(--line,#3A3A37);border-radius:9px;padding:8px 10px}',
    '.gans-frage input:focus{outline:none;border-color:var(--accent,#D97757)}',
    '.gans-frage button{padding:8px 12px;background:var(--accent,#D97757);color:#1F1E1D;font-weight:600}'
  ].join('');
  document.head.appendChild(css);

  var gans = document.createElement('button');
  gans.type = 'button'; gans.className = 'gans'; gans.hidden = true; gans.setAttribute('aria-label', 'Good Goose – Hilfe zur Seite');
  var umriss = document.createElement('span'); umriss.className = 'umriss'; gans.appendChild(umriss);
  var bild = document.createElement('span'); bild.className = 'bild'; gans.appendChild(bild);
  var blase = document.createElement('div'); blase.className = 'gans-blase'; blase.setAttribute('role', 'dialog'); blase.setAttribute('aria-label', 'Good Goose'); blase.hidden = true;
  document.body.appendChild(gans); document.body.appendChild(blase);

  // --- Bildfolgen ---
  var folge = 'idle', bildNr = 0, seitZeit = 0, einmal = null, geladen = false;
  function laden() { if (geladen) return; geladen = true; Object.keys(FOLGEN).forEach(function (k) { new Image().src = BASIS + 'gans-' + k + '.png'; }); }
  function spiele(name, danach) { folge = name; bildNr = 0; seitZeit = 0; einmal = danach || null;
    bild.style.backgroundImage = umriss.style.backgroundImage = 'url(' + BASIS + 'gans-' + name + '.png)'; zeichne(); }
  function zeichne() { var n = FOLGEN[folge]; bild.style.backgroundPosition = umriss.style.backgroundPosition = (n > 1 ? bildNr / (n - 1) * 100 : 0) + '% 0'; }

  // --- Laufen ---
  var aktiv = false, x = 12, ziel = 12, pause = 1500, schlaf = merk('caelum-gans-schlaeft') === '1', redet = false, letzt = 0;
  function rand() { return Math.max(4, innerWidth - gr - 4); }
  // --- Grösse (Kenny 20.11.2026): Rechtsklick auf die Gans (Handy: lang drücken) und direkt ziehen. Nur der Umriss ist
  // gestrichelt, kein Text. Ziehen in die obere Hälfte (nach oben) = grösser, nach unten = kleiner. Nie über den Bildschirmrand.
  var gr = PX;
  function maxGr() { return Math.max(PX, Math.min(MAX, Math.round(innerHeight * 0.4), innerWidth - 8)); }
  function groesse(g, merken) {
    gr = Math.round(Math.max(PX, Math.min(maxGr(), g)));
    gans.style.width = gans.style.height = gr + 'px'; gans.style.bottom = (-Math.round(gr * FUSS)) + 'px';
    blase.style.bottom = (gr + 8) + 'px'; blase.style.maxHeight = 'calc(100vh - ' + (gr + 24) + 'px)';
    x = Math.max(4, Math.min(x, rand())); ziel = Math.min(ziel, rand()); setze();
    if (merken) merk('caelum-gans-groesse', String(gr));
  }
  var skal = null;   // { x0, y0, g0 } während des Ziehens
  function skalieren(e) {
    zu(); redet = true; spiele('idle'); gans.classList.add('skalieren');
    try { gans.setPointerCapture(e.pointerId); } catch (f) {}
    skal = { x0: e.clientX, y0: e.clientY, g0: gr };
  }
  var zugEnde = 0;   // Windows schickt contextmenu erst nach dem Loslassen der rechten Taste
  gans.addEventListener('contextmenu', function (e) { e.preventDefault(); if (skal || Date.now() - zugEnde < 600) return; gans.classList.toggle('skalieren'); });
  var halteUhr = 0, start = null;
  gans.addEventListener('pointerdown', function (e) {
    if (e.button === 2 || gans.classList.contains('skalieren')) { e.preventDefault(); skalieren(e); return; }   // rechte Taste: sofort ziehen
    if (e.pointerType === 'touch') { start = e; halteUhr = setTimeout(function () { halteUhr = 0; geschluckt = true; skalieren(start); }, 600); }   // Handy/iOS
  });
  gans.addEventListener('pointermove', function (e) {
    if (!skal) { if (halteUhr && start && Math.abs(e.clientX - start.clientX) + Math.abs(e.clientY - start.clientY) > 12) { clearTimeout(halteUhr); halteUhr = 0; } return; }
    var dx = e.clientX - skal.x0, dy = e.clientY - skal.y0, weg = Math.sqrt(dx * dx + dy * dy);
    groesse(skal.g0 + (dy <= 0 ? weg : -weg), false);
  });
  function loslassen(e) {
    clearTimeout(halteUhr); halteUhr = 0; if (!skal) return;
    skal = null; zugEnde = Date.now(); merk('caelum-gans-groesse', String(gr)); gans.classList.remove('skalieren'); redet = false; geschluckt = !(e && e.button === 2);   // nach rechter Taste folgt kein click
  }
  gans.addEventListener('pointerup', loslassen); gans.addEventListener('pointercancel', loslassen);
  addEventListener('resize', function () { if (gr > maxGr()) groesse(maxGr(), false); });
  var geschluckt = false;
  function setze() { gans.style.transform = 'translateX(' + Math.round(x) + 'px)'; }
  function takt(t) {
    if (!aktiv) { letzt = 0; return; }
    var dt = Math.min(64, t - (letzt || t)); letzt = t; seitZeit += dt;
    if (seitZeit >= TEMPO[folge]) {
      seitZeit = 0; bildNr++;
      if (bildNr >= FOLGEN[folge]) { if (einmal) { var f = einmal; einmal = null; f(); } else bildNr = 0; }
      zeichne();
    }
    if (!schlaf && !redet && !ruhig) {
      if (folge === 'waddle') {
        var d = ziel - x, s = Math.sign(d) * Math.min(Math.abs(d), dt * 0.045);
        x += s; if (s) gans.classList.toggle('rechts', s > 0);
        if (Math.abs(ziel - x) < 1) { spiele('idle'); pause = 2500 + Math.random() * 6000; }
      } else if (folge === 'idle') {
        pause -= dt;
        if (pause <= 0) { if (Math.random() < 0.15) spiele('honk', function () { spiele('idle'); pause = 3000; }); else { ziel = 8 + Math.random() * (rand() - 8); spiele('waddle'); } }
      }
      setze();
    }
    requestAnimationFrame(takt);
  }
  addEventListener('resize', function () { x = Math.min(x, rand()); ziel = Math.min(ziel, rand()); setze(); });

  // --- Wissen (nur lokal) ---
  var wissen = null;
  function wissenLaden() {
    if (wissen) return Promise.resolve(wissen);
    return fetch(BASIS.replace('gans/', '') + 'gans-wissen.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
      .then(function (j) { wissen = j; return j; }).catch(function () { wissen = { eintraege: [], unbekannt: ['Mein Wissen ist gerade nicht erreichbar.'] }; return wissen; });
  }
  function norm(t) {
    return ' ' + String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }
  // ganzes Wort; ab 4 Zeichen auch als Wortanfang („geheim“ trifft „geheimes“, „privat“ trifft „privates“)
  function trifft(text, wort) { var w = norm(wort).trim(); return text.indexOf(' ' + w + (w.length >= 4 ? '' : ' ')) >= 0; }
  function zufall(l) { return l[Math.floor(Math.random() * l.length)]; }
  function antworte(frage) {
    var t = norm(frage), w = wissen;
    if (w.persoenlich && w.persoenlich.worte.some(function (x) { return trifft(t, x); }))
      return { text: zufall(w.persoenlich.antworten), ziel: w.persoenlich.ziel, knopf: w.persoenlich.knopf };
    var best = null, punkte = 0;
    w.eintraege.forEach(function (e) {
      var p = 0; e.worte.forEach(function (x) { if (trifft(t, x)) p += norm(x).length; });
      if (p > punkte) { punkte = p; best = e; }
    });
    if (best) return { text: best.antwort, ziel: best.ziel, knopf: best.knopf };
    return { text: zufall(w.unbekannt), ziel: '#kontakt', knopf: 'Zum Kontakt' };
  }

  // --- Sprechblase ---
  var verlauf = [];
  function geh(h) {
    return function () {
      zu();
      if (h.indexOf('code:') === 0) { if (window.CaelumSprache && window.CaelumSprache.code) window.CaelumSprache.code(h.slice(5) || null); return; } // Seite als Code (Mond)
      if (h === '#oben') { scrollTo({ top: 0, behavior: ruhig ? 'auto' : 'smooth' }); return; }
      if (/^https?:/.test(h)) { open(h, '_blank', 'noopener'); return; }
      if (h.charAt(0) !== '#') { location.href = h; return; }
      var a = document.createElement('a'); a.href = h; a.hidden = true; document.body.appendChild(a); a.click(); a.remove();
    };
  }
  function knopf(text, tun) { var b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.onclick = tun; return b; }
  function rahmen() {
    blase.textContent = '';
    var x0 = knopf('×', zu); x0.className = 'zu'; x0.setAttribute('aria-label', 'Schliessen'); blase.appendChild(x0);
  }
  function zeigeBlase(fokus) {
    redet = true; blase.hidden = false;
    blase.style.left = Math.max(12, Math.min(x + gr / 2 - 40, innerWidth - blase.offsetWidth - 12)) + 'px';
    requestAnimationFrame(function () { blase.classList.add('offen'); });
    if (fokus) fokus.focus({ preventScroll: true });
  }
  function sag(text, wahl) {
    rahmen();
    var p = document.createElement('p'); p.textContent = text; blase.appendChild(p);
    var erster = null;
    if (wahl && wahl.length) {
      var w = document.createElement('div'); w.className = 'wahl';
      wahl.forEach(function (e) { var b = knopf(e[0], e[1]); w.appendChild(b); erster = erster || b; });
      blase.appendChild(w);
    }
    zeigeBlase(erster);
  }
  function chat() {
    rahmen();
    var p = document.createElement('p'); p.textContent = 'Frag mich etwas über Caelum und diese Seite.'; blase.appendChild(p);
    var log = document.createElement('div'); log.className = 'gans-chat'; blase.appendChild(log);
    function zeile(wer, text, ziel, k) {
      var d = document.createElement('div'); d.className = wer; d.textContent = text;
      if (ziel) { d.appendChild(document.createElement('br')); d.appendChild(knopf(k || 'Hin', geh(ziel))); }
      log.appendChild(d); blase.scrollTop = blase.scrollHeight;
    }
    verlauf.forEach(function (v) { zeile(v[0], v[1], v[2], v[3]); });
    var f = document.createElement('form'); f.className = 'gans-frage';
    var ein = document.createElement('input'); ein.type = 'text'; ein.maxLength = 140; ein.placeholder = 'z. B. Was ist Pandora?'; ein.setAttribute('aria-label', 'Frage an die Gans'); ein.autocomplete = 'off';
    f.appendChild(ein); f.appendChild(knopf('Fragen', null)); f.lastChild.type = 'submit';
    f.onsubmit = function (e) {
      e.preventDefault(); var q = ein.value.trim(); if (!q) return; ein.value = '';
      zeile('ich', q); verlauf.push(['ich', q]);
      wissenLaden().then(function () {
        var a = antworte(q);
        spiele('honk', function () { spiele('idle'); });
        setTimeout(function () { zeile('sie', a.text, a.ziel, a.knopf); verlauf.push(['sie', a.text, a.ziel, a.knopf]); if (verlauf.length > 12) verlauf.splice(0, 2); }, 350);
      });
    };
    blase.appendChild(f);
    zeigeBlase(ein);
    wissenLaden();
  }
  function menue() {
    spiele('wave', function () { spiele('idle'); });
    sag('Was darf es sein?', [
      ['Frag die Gans', chat],
      ['Downloads und Updates', geh('#downloads')],
      ['Kundenzugang', geh('#zugang')],
      ['Kontakt', geh('#kontakt')],
      ['Gans schlafen legen', schlafen],
      ['Gans verabschieden', schliessen]
    ]);
  }
  function zu() { if (gans.classList.contains('skalieren') && !skal) gans.classList.remove('skalieren'); if (blase.hidden) return; blase.classList.remove('offen'); blase.hidden = true; redet = false; pause = 2000; }
  function schlafen() { zu(); schlaf = true; merk('caelum-gans-schlaeft', '1'); spiele('sleep'); gans.setAttribute('aria-label', 'Good Goose schläft – antippen zum Wecken'); }
  function wecken() { schlaf = false; merk('caelum-gans-schlaeft', null); gans.setAttribute('aria-label', 'Good Goose – Hilfe zur Seite'); spiele('honk', function () { spiele('idle'); }); }
  gans.addEventListener('click', function () { if (geschluckt) { geschluckt = false; return; } if (gans.classList.contains('skalieren')) { gans.classList.remove('skalieren'); return; } if (schlaf) { wecken(); return; } if (!blase.hidden) { zu(); return; } menue(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') zu(); });
  document.addEventListener('pointerdown', function (e) { if (!blase.hidden && !blase.contains(e.target) && !gans.contains(e.target)) zu(); });

  // --- öffnen / schliessen (Caelum Optionen, Karte Good Goose) ---
  function oeffnen(neu) {
    laden();
    if (!aktiv) {
      aktiv = true; gans.hidden = false; gans.classList.add('weg'); merk('caelum-gans', 'an');
      x = Math.min(x, rand()); setze(); spiele(schlaf ? 'sleep' : 'idle');
      requestAnimationFrame(function () { gans.classList.remove('weg'); requestAnimationFrame(takt); });
    }
    if (neu && !schlaf) setTimeout(function () { spiele('wave', function () { spiele('idle'); }); sag('Hallo! Ich bin die Gans von Caelum. Frag mich etwas – oder tipp mich an.', [['Frag die Gans', chat], ['Später', zu]]); }, 500);
  }
  function schliessen() {
    zu(); merk('caelum-gans', null); gans.classList.add('weg');
    setTimeout(function () { aktiv = false; gans.hidden = true; document.dispatchEvent(new CustomEvent('caelum-gans', { detail: { offen: false } })); }, 400);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-gans]'); if (!a) return;
    e.preventDefault(); if (aktiv && a.getAttribute('data-gans') === 'umschalten') schliessen(); else oeffnen(true);
  });
  groesse(+merk('caelum-gans-groesse') || PX, false);
  if (merk('caelum-gans') === 'an') oeffnen(false);

  window.CaelumGans = { sag: function (t) { if (!aktiv) oeffnen(false); sag(t, null); }, chat: function () { oeffnen(false); chat(); },
    oeffnen: oeffnen, schliessen: schliessen, offen: function () { return aktiv; }, frage: function (q) { return wissenLaden().then(function () { return antworte(q); }); } };
})();
