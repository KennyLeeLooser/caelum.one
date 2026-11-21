// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Sprachwahl für www.caelum.one (Kenny 20.11.2026): Deutsch ist Standard, English direkt wählbar, alle anderen Sprachen über
// eine Suche nach Sprache oder Land (keine grosse Tabelle; Portugiesisch getrennt nach Portugal und Brasilien).
// Übersetzt wird im Browser: Wörterbuch assets/sprachen/<code>.json (deutscher Text → Übersetzung). Kein Google, kein Server.
// Weitere Sprache = neue JSON-Datei + Eintrag „da: true“ in SPRACHEN. Gemerkt wird nur die Wahl (localStorage „caelum-sprache“).
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  // Basis aus der eigenen Skript-Adresse (Basis-Umbau 21.11.2026, GB-35): auf caelum.one /assets/, auf einem Landeplatz https://www.caelum.one/assets/
  var BASIS_ASSETS = (function () { try { return new URL(".", document.currentScript.src).href; } catch (e) { return "/assets/"; } })();
  // code, Name in der Sprache selbst, deutscher Name, Länder/Suchwörter, da = Übersetzung vorhanden
  var SPRACHEN = [
    ['de', 'Deutsch', 'Deutsch', 'Schweiz Deutschland Österreich Liechtenstein German', true],
    ['en', 'English', 'Englisch', 'USA Vereinigte Staaten Grossbritannien England UK Irland Kanada Australien Neuseeland America', true],
    ['fr', 'Français', 'Französisch', 'Frankreich Schweiz Romandie Belgien Kanada Québec Luxemburg French', true],
    ['it', 'Italiano', 'Italienisch', 'Italien Tessin Schweiz Italy', true],
    ['rm', 'Rumantsch', 'Rätoromanisch', 'Graubünden Schweiz Romansh', false],
    ['es', 'Español', 'Spanisch', 'Spanien Mexiko Argentinien Kolumbien Chile Peru Spain Mexico', true],
    ['pt-PT', 'Português (Portugal)', 'Portugiesisch (Portugal)', 'Portugal Europa europäisch Angola Mosambik Portuguese', true],
    ['pt-BR', 'Português (Brasil)', 'Portugiesisch (Brasilien)', 'Brasilien Brazil brasilianisch Portuguese', false],
    ['nl', 'Nederlands', 'Niederländisch', 'Niederlande Holland Belgien Flandern Dutch', false],
    ['pl', 'Polski', 'Polnisch', 'Polen Poland Polish', false],
    ['cs', 'Čeština', 'Tschechisch', 'Tschechien Czech', false],
    ['sk', 'Slovenčina', 'Slowakisch', 'Slowakei Slovak', false],
    ['hu', 'Magyar', 'Ungarisch', 'Ungarn Hungary Hungarian', false],
    ['ro', 'Română', 'Rumänisch', 'Rumänien Moldau Romania', false],
    ['hr', 'Hrvatski', 'Kroatisch', 'Kroatien Croatia', false],
    ['sr', 'Српски', 'Serbisch', 'Serbien Serbia', false],
    ['sl', 'Slovenščina', 'Slowenisch', 'Slowenien Slovenia', false],
    ['sq', 'Shqip', 'Albanisch', 'Albanien Kosovo Albania', false],
    ['el', 'Ελληνικά', 'Griechisch', 'Griechenland Zypern Greece', false],
    ['tr', 'Türkçe', 'Türkisch', 'Türkei Turkey Turkish', false],
    ['sv', 'Svenska', 'Schwedisch', 'Schweden Sweden', false],
    ['da', 'Dansk', 'Dänisch', 'Dänemark Denmark', false],
    ['no', 'Norsk', 'Norwegisch', 'Norwegen Norway', false],
    ['fi', 'Suomi', 'Finnisch', 'Finnland Finland', false],
    ['uk', 'Українська', 'Ukrainisch', 'Ukraine', false],
    ['ru', 'Русский', 'Russisch', 'Russland Russia', true],
    ['ar', 'العربية', 'Arabisch', 'Ägypten Saudi-Arabien Emirate Marokko Arabic', false],
    ['he', 'עברית', 'Hebräisch', 'Israel Hebrew', false],
    ['fa', 'فارسی', 'Persisch', 'Iran Afghanistan Persian Farsi', false],
    ['hi', 'हिन्दी', 'Hindi', 'Indien India', false],
    ['zh', '中文 (简体)', 'Chinesisch', 'China Taiwan Hongkong Singapur Chinese', true],
    ['ja', '日本語', 'Japanisch', 'Japan Japanese', true],
    ['ko', '한국어', 'Koreanisch', 'Korea Südkorea Korean', false],
    ['th', 'ไทย', 'Thailändisch', 'Thailand Thai', false],
    ['vi', 'Tiếng Việt', 'Vietnamesisch', 'Vietnam Vietnamese', false],
    ['id', 'Bahasa Indonesia', 'Indonesisch', 'Indonesien Indonesia', false]
  ];
  var root = document.documentElement, aktuell = 'de', woerter = null, original = new WeakMap(), attrOriginal = new WeakMap();
  var ATTR = ['aria-label', 'title', 'placeholder', 'alt'];
  function merk(v) { try { if (v === undefined) return localStorage.getItem('caelum-sprache'); localStorage.setItem('caelum-sprache', v); } catch (e) {} return null; }
  function eintrag(code) { return SPRACHEN.filter(function (s) { return s[0] === code; })[0]; }

  // --- Übersetzen: jeder Textknoten / jedes Attribut, dessen deutscher Text im Wörterbuch steht ---
  function uebersetzeKnoten(n) {
    var o = original.has(n) ? original.get(n) : n.nodeValue, t = o.replace(/\s+/g, ' ').trim();
    if (!t) return;
    if (aktuell === 'de' || !woerter) { if (original.has(n)) n.nodeValue = o; return; }
    var u = woerter[t]; if (typeof u !== 'string') return;
    if (!original.has(n)) original.set(n, o);
    var vorne = o.match(/^\s*/)[0], hinten = o.match(/\s*$/)[0];
    if (/^(zh|ja|ko)$/.test(aktuell)) {   // keine Leerzeichen zwischen chinesischen/japanischen Zeichen
      if (/[　-鿿＀-￯]$/.test(u)) hinten = '';
      if (/^[　-鿿＀-￯]/.test(u)) vorne = '';
    }
    n.nodeValue = vorne + u + hinten;
  }
  function uebersetzeAttr(el) {
    var gemerkt = attrOriginal.get(el) || {};
    ATTR.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var o = a in gemerkt ? gemerkt[a] : el.getAttribute(a), t = o.replace(/\s+/g, ' ').trim();
      if (aktuell === 'de' || !woerter) { if (a in gemerkt) el.setAttribute(a, o); return; }
      var u = woerter[t]; if (typeof u !== 'string') return;
      gemerkt[a] = o; attrOriginal.set(el, gemerkt); el.setAttribute(a, u);
    });
  }
  function durch(wurzel) {
    if (wurzel.nodeType === 3) { uebersetzeKnoten(wurzel); return; }
    if (wurzel.nodeType !== 1 || wurzel.closest('script,style,.sprache-wahl,.code-fassung,.code-leiste')) return;
    var w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null), n = wurzel;
    do {
      if (n.nodeType === 1) { if (n.matches('script,style,.sprache-wahl,.code-fassung,.code-leiste')) continue; uebersetzeAttr(n); }
      else uebersetzeKnoten(n);
    } while ((n = w.nextNode()));
  }
  var HINWEIS = 'Diese Seite gibt es nur auf Deutsch. Rechtlich gilt die deutsche Fassung.';
  var titelDe = document.title, beschr = document.querySelector('meta[name="description"]'), beschrDe = beschr ? beschr.content : '';
  function anwenden() {
    root.lang = aktuell === 'de' ? 'de-CH' : aktuell;
    root.dir = /^(ar|he|fa)$/.test(aktuell) ? 'rtl' : 'ltr';
    document.title = (aktuell !== 'de' && woerter && woerter[titelDe]) || titelDe;
    if (beschr) beschr.content = (aktuell !== 'de' && woerter && woerter[beschrDe]) || beschrDe;
    // Rechtsseiten (<html data-nur-deutsch>): Text bleibt Deutsch, nur Kopf und Fuss werden übersetzt – oben ein Hinweis
    if (root.hasAttribute('data-nur-deutsch')) {
      var h = document.querySelector('.sprache-hinweis'), ziel = document.querySelector('main .wrap, main');
      var m = document.querySelector('main'); if (m) m.lang = 'de';   // Vorlesen: der Text bleibt Deutsch
      if (aktuell === 'de') { if (h) h.remove(); }
      else if (!h && ziel) { h = document.createElement('p'); h.className = 'sprache-hinweis'; h.setAttribute('role', 'note'); h.textContent = HINWEIS; ziel.insertBefore(h, ziel.firstChild); }
    }
    durch(document.body);
    knopfText();
    document.dispatchEvent(new CustomEvent('caelum-sprache', { detail: { code: aktuell } }));
  }
  var beobachter = new MutationObserver(function (liste) {
    if (aktuell === 'de') return;
    liste.forEach(function (m) { m.addedNodes.forEach(function (n) { durch(n); }); });
  });
  beobachter.observe(document.body, { childList: true, subtree: true });

  function waehle(code) {
    var e = eintrag(code); if (!e || !e[4]) return;
    aktuell = code; merk(code);
    if (code === 'de') { woerter = null; anwenden(); return; }
    fetch(BASIS_ASSETS + 'sprachen/' + code + '.json', { cache: 'no-cache' }).then(function (r) { return r.json(); })
      .then(function (j) { woerter = j; anwenden(); })
      .catch(function () { aktuell = 'de'; woerter = null; anwenden(); });
  }

  // --- Auswahl im Kopf ---
  // Stile in assets/sprache.css (eigene Datei wegen der strengen CSP der Unterseiten: style-src 'self', S46)
  if (!document.querySelector('link[data-caelum="assets/sprache.css"]')) {
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = BASIS_ASSETS + 'sprache.css?v=2'; css.setAttribute('data-caelum', 'assets/sprache.css');
    document.head.appendChild(css);
  }

  var knopf = document.createElement('button'); knopf.type = 'button'; knopf.className = 'sprache-knopf';
  knopf.setAttribute('aria-haspopup', 'dialog'); knopf.setAttribute('aria-expanded', 'false');
  knopf.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9s1.3-6.4 3.9-9z"/></svg><span></span>';
  function knopfText() { knopf.querySelector('span').textContent = aktuell === 'de' ? 'DE' : aktuell.toUpperCase().replace('PT-', 'PT·'); knopf.setAttribute('aria-label', (aktuell === 'de' ? 'Sprache' : (woerter && woerter['Sprache']) || 'Language') + ': ' + eintrag(aktuell)[1]); }
  var nav = document.querySelector('header nav'); if (nav) nav.appendChild(knopf);

  var wahl = document.createElement('div'); wahl.className = 'sprache-wahl'; wahl.hidden = true;
  wahl.setAttribute('role', 'dialog'); wahl.setAttribute('aria-label', 'Sprache / Language');
  document.body.appendChild(wahl);
  var rollZeit = 0;
  wahl.addEventListener('scroll', function () { wahl.classList.add('rollt'); clearTimeout(rollZeit); rollZeit = setTimeout(function () { wahl.classList.remove('rollt'); }, 900); }, { passive: true });
  function sprKnopf(e) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'spr'; b.lang = e[0];
    b.innerHTML = '<span></span><small></small>';
    b.firstChild.textContent = e[1]; b.lastChild.textContent = e[4] ? (e[0] === 'de' ? 'Standard' : '') : 'folgt · soon';
    if (!e[4]) b.disabled = true;
    b.setAttribute('aria-pressed', String(aktuell === e[0]));
    b.onclick = function () { waehle(e[0]); zu(); };
    return b;
  }
  function bauen() {
    wahl.textContent = '';
    var k = document.createElement('div'); k.className = 'kopf'; k.textContent = 'Sprache · Language'; wahl.appendChild(k);
    var zwei = document.createElement('div'); zwei.className = 'zwei';
    zwei.appendChild(sprKnopf(eintrag('de'))); zwei.appendChild(sprKnopf(eintrag('en'))); wahl.appendChild(zwei);
    var kugelOrt = document.createElement('div'); wahl.appendChild(kugelOrt);
    var such = document.createElement('input'); such.type = 'search'; such.placeholder = 'Andere Sprache oder Land suchen …';
    such.setAttribute('aria-label', 'Sprache oder Land suchen'); wahl.appendChild(such);
    var treffer = document.createElement('div'); treffer.className = 'treffer'; treffer.setAttribute('aria-live', 'polite'); wahl.appendChild(treffer);
    such.oninput = function () {
      treffer.textContent = '';
      var q = such.value.trim().toLowerCase(); if (q.length < 2) return;
      SPRACHEN.filter(function (s) { return s[0] !== 'de' && s[0] !== 'en' && (s[1] + ' ' + s[2] + ' ' + s[3] + ' ' + s[0]).toLowerCase().indexOf(q) >= 0; })
        .slice(0, 5).forEach(function (s) { var b = sprKnopf(s); b.lastChild.textContent = (s[4] ? '' : 'folgt · ') + s[2]; treffer.appendChild(b); });
      if (!treffer.firstChild) { var p = document.createElement('div'); p.style.color = 'var(--muted)'; p.textContent = 'Nichts gefunden · nothing found'; treffer.appendChild(p); }
    };
    var opt = document.createElement('div'); opt.className = 'optionen';
    opt.appendChild(haken('Sprache des Browsers verwenden', 'Beim ersten Besuch automatisch wählen, wenn vorhanden', 'caelum-sprache-auto', false));
    opt.appendChild(haken('Weltkugel zum Auswählen', 'Region auf dem Globus antippen und hineinzoomen', 'caelum-sprache-kugel', false, function () { kugel(kugelOrt, kugelAn()); }));
    opt.appendChild(haken('Technisch: der Mond', 'Bereiche als Segmente, Krater zeigen die Seite als Code', 'caelum-sprache-mond', false, function () { kugel(kugelOrt, kugelAn()); }));
    wahl.appendChild(opt);
    kugel(kugelOrt, kugelAn());
    return such;
  }
  function haken(titel, info, schluessel, bald, geaendert) {
    var l = document.createElement('label'); if (bald) l.className = 'bald';
    var c = document.createElement('input'); c.type = 'checkbox'; c.disabled = !!bald;
    try { if (schluessel) c.checked = localStorage.getItem(schluessel) === '1'; } catch (e) {}
    c.onchange = function () { try { localStorage.setItem(schluessel, c.checked ? '1' : '0'); } catch (e) {} if (geaendert) geaendert(c.checked); };
    var t = document.createElement('span'); t.innerHTML = '<b></b><br><small></small>';
    t.querySelector('b').textContent = titel + (bald ? ' · bald' : ''); t.querySelector('b').style.fontWeight = '500';
    t.querySelector('small').textContent = info; t.querySelector('small').style.color = 'var(--muted)';
    l.appendChild(c); l.appendChild(t); return l;
  }
  // --- Weltkugel (assets/weltkugel.js, erst beim Einschalten geladen) ---
  var kugelJetzt = null, kugelSkript = null;
  function gesetzt(k) { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }
  function kugelAn() { return gesetzt('caelum-sprache-kugel') || gesetzt('caelum-sprache-mond'); }
  // --- Seite als Code (assets/als-code.js, erst bei der ersten Wahl geladen) ---
  var codeSkript = null;
  function codeLaden() {
    if (!codeSkript) codeSkript = new Promise(function (ok, nein) {
      var s = document.createElement('script'); s.src = BASIS_ASSETS + 'als-code.js?v=3'; s.onload = ok;
      s.onerror = function () { codeSkript = null; nein(); }; document.head.appendChild(s);
    });
    return codeSkript;
  }
  function waehleCode(c) {
    if (!c) { if (window.CaelumCode) window.CaelumCode.aus(); zu(); return; }
    codeLaden().then(function () { window.CaelumCode.zeige(c); zu(); });
  }
  function kugelWeg() { if (kugelJetzt) { kugelJetzt.zerstoere(); kugelJetzt = null; } wahl.classList.remove('mit-kugel'); }
  function kugel(ort, an) {
    kugelWeg(); if (!an) return;
    wahl.classList.add('mit-kugel');
    if (!kugelSkript) kugelSkript = new Promise(function (ok, nein) {
      var s = document.createElement('script'); s.src = BASIS_ASSETS + 'weltkugel.js?v=5'; s.onload = ok;
      s.onerror = function () { kugelSkript = null; nein(); }; document.head.appendChild(s);
    });
    kugelSkript.then(function () {
      if (wahl.hidden || !ort.isConnected || kugelJetzt) return;
      kugelJetzt = window.CaelumWeltkugel.erstelle(ort, {
        art: gesetzt('caelum-sprache-mond') ? 'mond' : 'welt', liste: SPRACHEN, aktuell: function () { return aktuell; }, knopf: sprKnopf,
        waehleCode: waehleCode, code: function () { return window.CaelumCode ? window.CaelumCode.aktuell() : null; },
        offen: function () { return window.CaelumZeichen ? window.CaelumZeichen.offen() : null; }
      });
    }).catch(function (e) { if (e) console.error('Weltkugel:', e); wahl.classList.remove('mit-kugel'); });
  }
  function auf() {
    var such = bauen(); wahl.hidden = false; knopf.setAttribute('aria-expanded', 'true');
    var r = knopf.getBoundingClientRect(); wahl.style.top = Math.round(r.bottom + 10) + 'px';
    (wahl.querySelector('[aria-pressed="true"]') || such).focus({ preventScroll: true });
  }
  function zu() { if (wahl.hidden) return; kugelWeg(); wahl.hidden = true; knopf.setAttribute('aria-expanded', 'false'); }
  knopf.addEventListener('click', function () { if (wahl.hidden) auf(); else zu(); });
  document.addEventListener('pointerdown', function (e) { if (!wahl.hidden && !wahl.contains(e.target) && !knopf.contains(e.target)) zu(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !wahl.hidden) { zu(); knopf.focus(); } });
  addEventListener('scroll', zu, { passive: true });

  // --- Start: gemerkte Wahl, sonst (wenn Haken gesetzt) Browser-Sprache, sonst Deutsch ---
  var start = merk();
  if (!start) { try { if (localStorage.getItem('caelum-sprache-auto') === '1') { var b = (navigator.languages || [navigator.language || 'de'])[0]; start = (eintrag(b) || eintrag(b.slice(0, 2)) || ['de'])[0]; } } catch (e) {} }
  knopfText();
  if (start && start !== 'de') waehle(start);
  // Sätze mit Platzhalter für Skripte: CaelumSprache.t('Der Bereich {name} ist offen …', { name: 'Studio' }) – Schlüssel = deutscher Satz im Wörterbuch
  function t(de, werte) {
    var s = (aktuell !== 'de' && woerter && typeof woerter[de] === 'string') ? woerter[de] : de;
    return s.replace(/\{(\w+)\}/g, function (m, k) { return werte && k in werte ? werte[k] : m; });
  }
  window.CaelumSprache = { waehle: waehle, aktuell: function () { return aktuell; }, t: t, liste: SPRACHEN, auf: auf, zu: zu, kugel: function () { return kugelJetzt; }, code: waehleCode };
})();
