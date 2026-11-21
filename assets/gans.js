// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Good Goose auf www.caelum.one: erscheint erst über „Good Goose öffnen“ (Caelum Optionen am Logo oder Karte Good Goose),
// läuft dann auf dem unteren Rand, hilft mit wenigen Funktionen und beantwortet Fragen zur Seite aus assets/gans-wissen.json.
// Alles läuft im Browser: keine Frage geht an einen Server, kein Tracking, keine Cookies. Persönliches blockt sie ab.
// Bilder: assets/gans/*.png, gerendert aus gans_char_goose.glb (GoodGoose/tools/web-gans-bilder.py, Blender headless).
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  if (window.CaelumGans) return;
  // Basis aus der eigenen Skript-Adresse (Basis-Umbau 21.11.2026, GB-35): auf caelum.one /assets/, auf einem Landeplatz https://www.caelum.one/assets/
  var BASIS_ASSETS = (function () { try { return new URL(".", document.currentScript.src).href; } catch (e) { return "/assets/"; } })();
  var HEIMAT = new URL(BASIS_ASSETS, location.href).origin;   // caelum.one, auch wenn die Gans auf einem Landeplatz läuft
  var BASIS = BASIS_ASSETS + 'gans/', PX = 64, MAX = 192, FUSS = 0.034;   // PX = kleinste Grösse; FUSS: Leerraum unter den Füssen (Anteil) → Gans steht auf dem Rand
  var FOLGEN = { waddle: 8, idle: 6, honk: 8, wave: 6, sleep: 4 };
  var TEMPO = { waddle: 90, idle: 160, honk: 110, wave: 120, sleep: 420 };
  var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function merk(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }

  // Stile in assets/gans.css (strenge CSP: style-src 'self', S46; auch auf Landeplätzen)
  if (!document.querySelector('link[data-caelum="assets/gans.css"]')) {
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = BASIS_ASSETS + 'gans.css?v=1'; css.setAttribute('data-caelum', 'assets/gans.css');
    document.head.appendChild(css);
  }

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
  // 9 Sprachen: gans-wissen.json (Deutsch) + gans-wissen.<code>.json, Einträge in gleicher Reihenfolge (Eintrag i = gleiche Frage).
  // Eingabesprache = Ausgabesprache (Kenny 20.11.2026): gesucht wird mit den Stichworten ALLER Sprachen,
  // geantwortet in der Sprache der Frage. Ist die nicht sicher erkennbar, in der Sprache der Seite (sonst Englisch).
  var SPRACHEN_W = ['de', 'en', 'fr', 'it', 'es', 'pt-PT', 'ru', 'zh', 'ja'];
  // kleine Kennwörter je lateinischer Sprache (ohne Akzente, klein) – nur zum Erkennen der Sprache
  var KENN = {
    de: 'ist was wie wer wo der die das und ich du nicht kann gibt ihr euch mit fuer bitte macht kostet habt seid',
    en: 'what is the how do does i you can where who and are your about please much it this',
    fr: 'est que quoi comment le les je tu et qui ou combien vous des une pour c qu ce fait sont',
    it: 'che cos come il lo gli sono chi dove quanto cosa posso fa voi una per si costa questo',
    es: 'que como el los es y quien donde cuanto puedo hay sois una para se hace cuesta esto',
    'pt-PT': 'o que como os quem onde quanto posso voces tu uma para faz da do nao sao custa isto'
  };
  var wissen = null;   // { de: {...}, en: {...}, … } – nur geladene Sprachen
  function seitenSprache() { var c = (window.CaelumSprache && window.CaelumSprache.aktuell && window.CaelumSprache.aktuell()) || 'de'; return SPRACHEN_W.indexOf(c) >= 0 ? c : 'en'; }
  function holen(code) { return fetch(BASIS.replace('gans/', '') + 'gans-wissen' + (code === 'de' ? '' : '.' + code) + '.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw r.status; return r.json(); }); }
  function wissenLaden() {
    if (wissen) return Promise.resolve(wissen);
    return Promise.all(SPRACHEN_W.map(function (c) { return holen(c).catch(function () { return null; }); })).then(function (l) {
      var w = {}; l.forEach(function (j, i) { if (j && j.eintraege) w[SPRACHEN_W[i]] = j; });
      if (!w.de) throw 'kein Wissen';
      wissen = w; return w;
    }).catch(function () { wissen = { de: { eintraege: [], unbekannt: ['Mein Wissen ist gerade nicht erreichbar.'] } }; return wissen; });
  }
  function norm(t) {
    return ' ' + String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFD').replace(/\p{M}/gu, '')   // é → e, ç → c, ã → a, ё → е (Akzente zählen nicht)
      .replace(/[^\p{L}\p{N}\- ]+/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
  }
  var CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
  // ganzes Wort; ab 4 Zeichen auch als Wortanfang („geheim“ trifft „geheimes“, „privat“ trifft „privates“).
  // Chinesisch/Japanisch kennen keine Leerzeichen zwischen Wörtern → dort genügt, dass das Wort im Text steht.
  function trifft(text, wort) { var w = norm(wort).trim(); if (CJK.test(w)) return text.indexOf(w) >= 0; return text.indexOf(' ' + w + (w.length >= 4 ? '' : ' ')) >= 0; }
  function punkte(t, worte) { var p = 0; worte.forEach(function (x) { if (trifft(t, x)) p += norm(x).length; }); return p; }
  function zufall(l) { return l[Math.floor(Math.random() * l.length)]; }
  // Sprache der Frage: Schrift (Kyrillisch, Kana, Han) entscheidet sofort, sonst Kennwörter + eigene Stichworte je Sprache
  function frageSprache(t, w) {
    var da = function (c) { return !!w[c]; };
    if (/\p{Script=Cyrillic}/u.test(t) && da('ru')) return 'ru';
    if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(t) && da('ja')) return 'ja';
    if (/\p{Script=Han}/u.test(t) && da('zh')) return 'zh';
    var wort = t.trim().split(' '), seite = seitenSprache(), best = null, max = 0;
    Object.keys(KENN).forEach(function (c) {
      if (!da(c)) return;
      var k = KENN[c].split(' '), p = 0;
      wort.forEach(function (x) { if (k.indexOf(x) >= 0) p += 2; });
      p += punkte(t, w[c].eintraege.reduce(function (a, e) { return a.concat(e.worte); }, []).concat(w[c].persoenlich ? w[c].persoenlich.worte : [])) / 4;
      if (p > max || (p === max && p > 0 && c === seite)) { max = p; best = c; }
    });
    return best || (da(seite) ? seite : 'de');
  }
  function antworte(frage) {
    // „Caelum Vision“ → „Vision“: sonst gewinnt „was macht caelum“ (Firma) gegen den Produktnamen
    var t = norm(frage).replace(/ caelum (?=(vision|cut|qr|gravur|3d|3d-viewer|viewer|re-play|replay|pandora|analyse|rorschach) )/g, ' ');
    var w = wissen, sp = frageSprache(t, w), a = w[sp], sprachen = Object.keys(w);
    var privat = sprachen.some(function (c) { var p = w[c].persoenlich; return p && p.worte.some(function (x) { return trifft(t, x); }); });
    if (privat && a.persoenlich) return { text: zufall(a.persoenlich.antworten), ziel: a.persoenlich.ziel, knopf: a.persoenlich.knopf, sprache: sp };
    var best = -1, max = 0;
    a.eintraege.forEach(function (e, i) {
      var p = 0; sprachen.forEach(function (c) { var x = w[c].eintraege[i]; if (x) p = Math.max(p, punkte(t, x.worte)); });
      if (p > max) { max = p; best = i; }
    });
    if (best >= 0) { var e = a.eintraege[best]; return { text: e.antwort, ziel: e.ziel, knopf: e.knopf, sprache: sp }; }
    return { text: zufall(a.unbekannt), ziel: '#kontakt', knopf: a.persoenlich ? a.persoenlich.knopf : 'Zum Kontakt', sprache: sp };
  }

  // --- Sprechblase ---
  var verlauf = [];
  function geh(h) {
    return function () {
      zu();
      if (h.indexOf('code:') === 0) { if (window.CaelumSprache && window.CaelumSprache.code) window.CaelumSprache.code(h.slice(5) || null); return; } // Seite als Code (Mond)
      if (h === '#oben') { scrollTo({ top: 0, behavior: ruhig ? 'auto' : 'smooth' }); return; }
      if (/^https?:/.test(h)) { open(h, '_blank', 'noopener'); return; }
      if (HEIMAT !== location.origin) { location.href = HEIMAT + (h.charAt(0) === '#' ? '/' : '') + h; return; } // Landeplatz: Ziele liegen auf caelum.one
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
    function zeile(wer, text, ziel, k, sprache) {
      var d = document.createElement('div'); d.className = wer; d.textContent = text; if (sprache) d.lang = sprache === 'de' ? 'de-CH' : sprache;   // Antwort in der Sprache der Frage
      if (ziel) { d.appendChild(document.createElement('br')); d.appendChild(knopf(k || 'Hin', geh(ziel))); }
      log.appendChild(d); blase.scrollTop = blase.scrollHeight;
    }
    verlauf.forEach(function (v) { zeile(v[0], v[1], v[2], v[3], v[4]); });
    var f = document.createElement('form'); f.className = 'gans-frage';
    var ein = document.createElement('input'); ein.type = 'text'; ein.maxLength = 140; ein.placeholder = 'z. B. Was ist Pandora?'; ein.setAttribute('aria-label', 'Frage an die Gans'); ein.autocomplete = 'off';
    f.appendChild(ein); f.appendChild(knopf('Fragen', null)); f.lastChild.type = 'submit';
    f.onsubmit = function (e) {
      e.preventDefault(); var q = ein.value.trim(); if (!q) return; ein.value = '';
      zeile('ich', q); verlauf.push(['ich', q]);
      wissenLaden().then(function () {
        var a = antworte(q);
        spiele('honk', function () { spiele('idle'); });
        setTimeout(function () { zeile('sie', a.text, a.ziel, a.knopf, a.sprache); verlauf.push(['sie', a.text, a.ziel, a.knopf, a.sprache]); if (verlauf.length > 12) verlauf.splice(0, 2); }, 350);
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
      aktiv = true; gans.hidden = false; gans.classList.add('weg'); try { sessionStorage.setItem('caelum-gans', 'an'); } catch (e) {}
      x = Math.min(x, rand()); setze(); spiele(schlaf ? 'sleep' : 'idle');
      requestAnimationFrame(function () { gans.classList.remove('weg'); requestAnimationFrame(takt); });
    }
    if (neu && !schlaf) setTimeout(function () { spiele('wave', function () { spiele('idle'); }); sag('Hallo! Ich bin die Gans von Caelum. Frag mich etwas – oder tipp mich an.', [['Frag die Gans', chat], ['Später', zu]]); }, 500);
  }
  function schliessen() {
    zu(); try { sessionStorage.removeItem('caelum-gans'); } catch (e) {} gans.classList.add('weg');
    setTimeout(function () { aktiv = false; gans.hidden = true; document.dispatchEvent(new CustomEvent('caelum-gans', { detail: { offen: false } })); }, 400);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-gans]'); if (!a) return;
    e.preventDefault(); if (aktiv && a.getAttribute('data-gans') === 'umschalten') schliessen(); else oeffnen(true);
  });
  groesse(+merk('caelum-gans-groesse') || PX, false);
  // Kenny 21.11.2026: die Gans kommt nur, wenn man sie ruft – nicht von selbst beim nächsten Besuch.
  // Während des Besuchs (dieser Tab) bleibt sie beim Seitenwechsel offen.
  merk('caelum-gans', null);
  try { if (sessionStorage.getItem('caelum-gans') === 'an') oeffnen(false); } catch (e) {}

  window.CaelumGans = { sag: function (t) { if (!aktiv) oeffnen(false); sag(t, null); }, chat: function () { oeffnen(false); chat(); },
    oeffnen: oeffnen, schliessen: schliessen, offen: function () { return aktiv; }, frage: function (q) { return wissenLaden().then(function () { return antworte(q); }); } };
})();
