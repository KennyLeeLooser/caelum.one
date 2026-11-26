// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Sound Design: „Motion-Fenster im Browser“ – Web-Nachbildung des Fensters „Caelum Vision – DAW Ableton › Caelum Motion“
// (Vorlage CaelumVision/src/CaelumVision/MotionFenster.cs, Wunsch Kenny 23.11.2026).
// Links das Handy mit der Motion-App (Bank A–D, 4 Pads: Schwenken CC 20, Kippen CC 21, Drehen CC 22, Höhe CC 23 …), es kippt mit
// der Lage. Rechts die Sensoren (Winkel, gyro, beschl, schwer, lage, höhe, tasten, gesten) und „MIDI an Ableton (Kanal 1, CC 20–35)“
// mit 4 Bänken × 4 Balken. Pad halten = Kupplung: nur solange gehalten, bewegt die Bewegung diesen Wert; loslassen → Wert bleibt.
// Quelle: Maus (ziehen = kippen/neigen, Rad = schwenken, Umschalt+Rad = Höhe) oder echte Handy-Sensoren (DeviceOrientation/-Motion).
// Ohne Eingabe läuft ein Beispiel. Nichts wird gesendet oder gespeichert.
// KI-Beitrag (Claude, GB-7), 23.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8). v3 (23.11. nachts): ● Loop + Looper-Spuren, EQ 8 Bänder + Balance. v4 (23.11. spätnachts): ◷ Uhr – Loop-Länge, Raster, Vorlauf (quantisiert). v12 (23.11. spät): U4 Kreispunkt-Uhr, U5 Hip-Hop/Techno, U6 Klang Organisch/Technisch, U7 Looper ▶/■ rot, U8 kleineres Handy.
// v5 (23.11.): Strang Drum & 808 Schritt 3 – Klang-Wahl „808“ (Stimmen aus drum808.js), Pads der Karte „Drum & 808“ klingen in die
// Summe vor dem EQ, ● Loop nimmt die Pad-Anschläge mit.
(function () {
  'use strict';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function knopf(text, cls) { var b = el('button', cls, text); b.type = 'button'; return b; }
  function klemm(v, a, b) { return v < a ? a : v > b ? b : v; }
  function wrap180(v) { v = (v + 180) % 360; if (v < 0) v += 360; return v - 180; }
  var BANK = ['A', 'B', 'C', 'D'];
  var ACHSE = ['Schwenken', 'Kippen', 'Drehen', 'Höhe'];
  var RAD = Math.PI / 180;

  // ================= Bewegung für alle Module (U0, Wunsch Kenny 23.11.2026 abends) =================
  // Caelum Motion oben ist die Quelle: jedes Modul (Sequenzer, Looper, EQ, Drum & 808) liest hier die Lage des Handys,
  // direkt und ohne Pad halten (das Halten bleibt die Kupplung für die MIDI-Regler an Ableton).
  // Werte −1 … +1, 0 = Mitte („Mitte setzen“): s Schwenken, k Kippen, d Drehen, h Höhe. Das Beispiel bewegt den Klang nicht.
  var BEW = window.CaelumBewegung = window.CaelumBewegung || {};
  var NULL_BEW = { s: 0, k: 0, d: 0, h: 0, aktiv: false };
  if (!BEW.jetzt) BEW.jetzt = function () { return NULL_BEW; };
  var BEW_NAME = { s: 'Schwenken', k: 'Kippen', d: 'Drehen', h: 'Höhe' };
  // Kopplungs-Zeile für ein Modul: Knopf „Bewegung“ (an/aus) + je Ziel „Kippen → Filter“ mit Balken ab der Mitte.
  // ziele = [[achse, 'Ziel'], …]. lesen() gibt die Werte (bei aus: alles 0) und zeigt sie.
  BEW.kopplung = function (ziele, cls) {
    var z = el('div', 'mf-kopp' + (cls ? ' ' + cls : '')), k = knopf('Bewegung', 'mf-kopp-k'), an = true, bal = [];
    k.setAttribute('aria-pressed', 'true'); z.appendChild(k);
    ziele.forEach(function (p) {
      var s = el('span', 'mf-bew'); s.appendChild(el('span', null, BEW_NAME[p[0]])); s.appendChild(document.createTextNode(' → '));
      s.appendChild(el('span', null, p[1]));
      var b = el('span', 'mf-bal mf-bal-mitte'), i = el('i'); b.appendChild(i); s.appendChild(b); z.appendChild(s); bal.push(i);
    });
    k.addEventListener('click', function () { an = !an; k.setAttribute('aria-pressed', an ? 'true' : 'false'); z.classList.toggle('aus', !an); });
    return {
      el: z, an: function () { return an; },
      lesen: function () {
        var w = an ? BEW.jetzt() : NULL_BEW;
        z.classList.toggle('still', !w.aktiv);
        ziele.forEach(function (p, n) {
          var v = klemm(w[p[0]], -1, 1), st = bal[n].style;
          st.left = (50 + Math.min(0, v) * 50).toFixed(1) + '%'; st.width = (Math.abs(v) * 50).toFixed(1) + '%';
        });
        return w;
      }
    };
  };

  // Quaternion [w,x,y,z] aus Kippen (x), Neigen (y), Drehen (z) in Grad – Reihenfolge Z·X·Y wie DeviceOrientation
  function quat(kip, nei, dre) {
    var cx = Math.cos(kip * RAD / 2), sx = Math.sin(kip * RAD / 2), cy = Math.cos(nei * RAD / 2), sy = Math.sin(nei * RAD / 2),
      cz = Math.cos(dre * RAD / 2), sz = Math.sin(dre * RAD / 2);
    return [cz * cx * cy - sz * sx * sy, cz * sx * cy - sz * cx * sy, cz * cx * sy + sz * sx * cy, sz * cx * cy + cz * sx * sy];
  }
  function setz(e, s) { if (e._t !== s) { e._t = s; e.textContent = s; } }   // nur bei Änderung (sprache.js übersetzt jede Änderung neu)
  function wort(e, s) { e.appendChild(el('span', null, s)); }
  function f(v, n) { var s = (v >= 0 ? ' ' : '') + v.toFixed(n == null ? 2 : n); while (s.length < 7) s = ' ' + s; return s; }

  // ================= Karten auf- und zuklappen (U2, wie /labor/) =================
  // Der Titel der Karte wird zum Knopf (Pfeil rechts), alles darunter fährt aus/ein. Zu = inert (nicht fokussierbar).
  // Der Klang läuft zugeklappt weiter. #id der Karte (oder „Sequenzer ↓“) öffnet sie. bei(offen) läuft nach jedem Wechsel.
  var KLAPP = {};
  BEW.aufklappen = function (karte, offen, bei) {
    var h = karte.querySelector('h2, h3'); if (!h || karte._klapp) return karte._klapp;
    var huelle = el('div', 'mf-huelle'), innen = el('div', 'mf-huelle-in');
    while (h.nextSibling) innen.appendChild(h.nextSibling);
    huelle.appendChild(innen); karte.appendChild(huelle); karte.classList.add('mf-klappbar');
    var k = knopf(null, 'mf-klapp'); while (h.firstChild) k.appendChild(h.firstChild);
    k.appendChild(el('i', 'mf-pfeil')); h.appendChild(k);
    if (karte.id) { huelle.id = karte.id + '-inhalt'; k.setAttribute('aria-controls', huelle.id); }
    function setz(an) {
      offen = an; karte.classList.toggle('zu', !an); huelle.inert = !an; k.setAttribute('aria-expanded', an ? 'true' : 'false');
      if (bei) bei(an);
    }
    k.addEventListener('click', function () { setz(!offen); });
    setz(offen !== false);
    karte._klapp = { auf: function () { if (!offen) setz(true); }, offen: function () { return offen; } };
    if (karte.id) KLAPP[karte.id] = karte._klapp;
    return karte._klapp;
  };
  // #anker öffnet die Karte (auch später, wenn der Anker schon gesetzt ist)
  function ankerAuf() { var id = decodeURIComponent((location.hash || '').slice(1)); if (KLAPP[id]) KLAPP[id].auf(); }
  window.addEventListener('hashchange', ankerAuf);

  // ================= Module: Sequenzer (Modul 1) · TR 808 (Modul 2) · Looper · EQ =================
  // U1 (Wunsch Kenny 23.11.2026 abends): jedes Gefüge eine eigene Karte unter dem Motion-Fenster.
  // Sequenzer wie SequenzerSeite.java (App 0.9.0): ▤ Lauflicht (ein Instrument, 16 Schritte) und ▦ Matrix, oben ▶ · BPM · Clock-Punkte · Swing.
  // TR 808 (Modul 2): eigenes Muster mit den 808-Stimmen aus drum808.js, läuft im selben Takt wie Modul 1.
  // Looper: ● Loop nimmt beide Module und die Pads auf. EQ: wirkt auf alles, was klingt.
  // Jede Karte hört auf die Bewegung des Handys oben (U0). Klang mit Web Audio, nichts geladen, nichts gesendet.
  var INSTR = [['BD', 36], ['SD', 38], ['CP', 39], ['CH', 42], ['OH', 46], ['LT', 45], ['HT', 50], ['RS', 37]];
  var MUSTER = {
    grund: ['x...x...x...x...', '....x.......x...', '............x...', 'x.x.x.x.x.x.x.x.', '..............x.', '................', '................', '.......x........'],
    break: ['x.....x...x.....', '....x.....x.x..x', '................', 'x.xxx.x.x.xxx.x.', '......x.......x.', '.........x......', '.............x..', '..x.........x...'],
    // U5 (Kenny 23.11.): Hip-Hop (Boom-Bap, lebt vom Swing) und Techno (gerade Bassdrum, offene Hi-Hat auf dem Offbeat)
    hiphop: ['x......x.xx.....', '....x.......x...', '............x...', 'x.x.x.x.x.x.x.xx', '................', '................', '................', '...x......x.....'],
    techno: ['x...x...x...x...', '................', '....x.......x...', 'xx.xxx.xxx.xxx.x', '..x...x...x...x.', '.......x.......x', '................', '...x.....x......'],
    leer: ['................', '................', '................', '................', '................', '................', '................', '................']
  };
  // TR 808 (Modul 2, Wunsch Kenny 23.11.2026 spät: Aufbau wie eine klassische Drum Machine – 4 Muster A B C D als Zeilen, 16 Schritt-Tasten,
  // Instrument-Wahl wie die Drehschalter). [Kürzel, Stimme in drum808.js (BD RS SD CP CL LT CH MT MA HT OH LC MC CY HC CB)], Note = 36 + Stimme
  var INSTR808 = [['BD', 0], ['SD', 2], ['LT', 5], ['MT', 7], ['HT', 9], ['RS', 1], ['CP', 3], ['CB', 15], ['CY', 13], ['OH', 10], ['CH', 6], ['MA', 8]];
  function m808(o) { return INSTR808.map(function (p) { return o[p[0]] || '................'; }); }
  var MUSTER808 = {
    A: m808({ BD: 'x..x..x...x.....', SD: '....x.......x...', CP: '............x...', CH: '..x...x...x...x.', OH: '..............x.' }),
    B: m808({ BD: 'x.....x...x..x..', SD: '....x.......x...', CP: '............x...', CH: 'x.xxx.x.x.xxx.x.', OH: '......x.......x.', CB: '...x......x.....' }),
    C: m808({ BD: 'x..x..x...x.....', SD: '....x.......x...', RS: '..x.....x.....x.', CH: 'x.x.x.x.x.x.x.x.', MA: 'xxxxxxxxxxxxxxxx', CB: '.......x........' }),
    D: m808({ BD: 'x...x...x.x.....', SD: '....x.......xxxx', LT: '..........x.....', MT: '.........x......', HT: '........x.......', CH: 'x.x.x.x.x.x.....', CY: 'x...............' })
  };
  function d808() { return window.CaelumDrum808 || null; }
  function karteNeu(titel, unter, id) {
    var k = el('section', 'mf-seq-karte mf-modul'); if (id) k.id = id;
    var h = el('h3'); h.appendChild(el('span', null, titel));
    if (unter) { h.appendChild(document.createTextNode(' ')); h.appendChild(el('span', 'mf-modnr', unter)); }
    k.appendChild(h); return k;
  }

  function sequenzer(platz, logZeile) {
    var schritt = 0, naechst = 0, spielt = false, timer = null, warte = [], jetztS = -1;
    var bpm = 112, swingHand = 0.1, klick = false, eigen808 = null;
    var ctx = null, rausch = null, summe, eqB = [], pan, loopBus, loopFilt;
    var startK = [], mods = [];

    function startKnopf() {
      // U3: nur das Zeichen ▶ / ■ (spart Platz), läuft der Takt = grün; der Name steht im aria-label
      var b = knopf('▶', 'gross mf-start'); b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Start');
      b.addEventListener('click', modulTippen);
      startK.push(b); return b;
    }
    function startZeigen() {
      var an = spielt && !nurLoop;
      startK.forEach(function (b) { setz(b, an ? '■' : '▶'); b.setAttribute('aria-label', an ? 'Stopp' : 'Start'); b.setAttribute('aria-pressed', an ? 'true' : 'false'); });
      if (lpStartK) { var la = spielt && lpAn; setz(lpStartK, la ? '■' : '▶'); lpStartK.setAttribute('aria-label', la ? 'Stopp' : 'Start'); lpStartK.setAttribute('aria-pressed', la ? 'true' : 'false'); }
    }
    // U7: Module und Looper haben je ihr eigenes ▶/■ auf demselben Takt. nurLoop = Takt läuft nur für die Loops (Module schweigen).
    var lpAn = true, nurLoop = false, lpStartK = null;
    function hatLoops() { return spuren.some(function (s) { return !!s.buf; }); }
    function modulTippen() {
      if (!spielt) { nurLoop = false; start(); }
      else if (nurLoop) { nurLoop = false; startZeigen(); }
      else if (lpAn && hatLoops()) { nurLoop = true; lichtAus(); startZeigen(); }   // Module aus, Loops spielen weiter
      else stopp();
    }
    function looperTippen() {
      if (spielt && lpAn) { lpAn = false; spuren.forEach(spurHalt); if (nurLoop) stopp(); else { startZeigen(); spurenZeigen(); } }
      else { lpAn = true; if (!spielt) { nurLoop = true; start(); } else startZeigen(); }   // Loops steigen auf der nächsten Eins ein
    }

    // ---- ein Muster-Modul (Sequenzer oder TR 808) ----
    function musterModul(def) {
      var m = { def: def, muster: [], instr: 0, ansicht: 'matrix', zellen: [], kette: null, bw: NULL_BEW, ton: 0 };
      m.laden = function (n) { m.name = n; m.muster = def.muster[n].map(function (z) { return z.split('').map(function (c) { return c === 'x'; }); }); };
      m.laden(def.start);
      var karte = karteNeu(def.titel, def.unter, def.id); m.karte = karte;
      m.kopf = el('div', 'mf-seq-kopf'); m.kopf.appendChild(startKnopf()); karte.appendChild(m.kopf);
      var zeile2 = el('div', 'mf-seq-zeile'), ans = {};
      [['lauf', '▤ Lauflicht'], ['matrix', '▦ Matrix']].forEach(function (p) {
        var b = knopf(p[1]); ans[p[0]] = b; zeile2.appendChild(b);
        b.addEventListener('click', function () { m.ansicht = p[0]; bauen(); });
      });
      zeile2.appendChild(el('span', 'mf-trenn'));
      var musterK = {};
      [['grund', 'Grundbeat'], ['break', 'Breakbeat'], ['hiphop', 'Hip-Hop'], ['techno', 'Techno'], ['leer', 'Leer']].forEach(function (p) {
        var b = knopf(p[1]); zeile2.appendChild(b); musterK[p[0]] = b;
        b.addEventListener('click', function () { m.laden(p[0]); bauen(); });
      });
      karte.appendChild(zeile2);
      // U6: Klang des Sequenzers – Einfach · Organisch · Technisch (808 ist Modul 2)
      m.klang = def.klang;
      if (def.klaenge) {
        var zeile3 = el('div', 'mf-seq-zeile mf-klangwahl'), klangK = {};
        zeile3.appendChild(el('span', 'mf-einheit', 'Klang'));
        def.klaenge.forEach(function (p) {
          var b = knopf(p[1]); klangK[p[0]] = b; zeile3.appendChild(b);
          b.addEventListener('click', function () { m.klang = p[0]; klangZeigen(); if (!spielt) ton(m, 0, 0, 0.8); });
        });
        var klangZeigen = function () { Object.keys(klangK).forEach(function (k) { klangK[k].setAttribute('aria-pressed', k === m.klang ? 'true' : 'false'); }); };
        klangZeigen(); karte.appendChild(zeile3);
      }
      var raster = el('div', 'mf-raster'); karte.appendChild(raster);
      m.kopp = BEW.kopplung(def.ziele); karte.appendChild(m.kopp.el);
      karte.appendChild(el('p', 'mf-hilfe', def.hilfe));
      platz.appendChild(karte);

      function zelle(i, s) {
        var b = knopf('', 'mf-schritt'); b.setAttribute('aria-pressed', m.muster[i][s] ? 'true' : 'false');
        b.setAttribute('aria-label', def.instr[i][0] + ' ' + (s + 1)); if (s % 4 === 0) b.classList.add('takt');
        b.addEventListener('click', function () {
          m.muster[i][s] = !m.muster[i][s]; b.setAttribute('aria-pressed', m.muster[i][s] ? 'true' : 'false');
          if (m.muster[i][s] && !spielt) ton(m, i, 0, 0.8);
        });
        return b;
      }
      function bauen() {
        Object.keys(ans).forEach(function (k) { ans[k].setAttribute('aria-pressed', k === m.ansicht ? 'true' : 'false'); });
        Object.keys(musterK).forEach(function (k) { musterK[k].setAttribute('aria-pressed', k === m.name ? 'true' : 'false'); });
        raster.textContent = ''; raster.className = 'mf-raster ' + m.ansicht; m.zellen = def.instr.map(function () { return []; });
        if (m.ansicht === 'lauf') {
          var chips = el('div', 'mf-chips');
          def.instr.forEach(function (p, i) {
            var c = knopf(p[0]); c.setAttribute('aria-pressed', i === m.instr ? 'true' : 'false');
            c.addEventListener('click', function () { m.instr = i; bauen(); ton(m, i, 0, 0.8); }); chips.appendChild(c);
          });
          raster.appendChild(chips);
          var reihe = el('div', 'mf-reihe gross');
          for (var s = 0; s < 16; s++) { var z = zelle(m.instr, s); m.zellen[m.instr][s] = z; reihe.appendChild(z); }
          raster.appendChild(reihe);
        } else {
          def.instr.forEach(function (p, i) {
            var reihe = el('div', 'mf-reihe'), nm = knopf(p[0], 'mf-name'); nm.addEventListener('click', function () { ton(m, i, 0, 0.8); });
            reihe.appendChild(nm);
            for (var s = 0; s < 16; s++) { var z = zelle(i, s); m.zellen[i][s] = z; reihe.appendChild(z); }
            raster.appendChild(reihe);
          });
        }
      }
      m.bauen = bauen; bauen();
      mods.push(m); return m;
    }

    // Modul 1: Sequenzer (Klang „Einfach“: Oszillator + Rauschen), Kopf mit BPM · Clock · Swing
    var m1 = musterModul({
      id: 'mf-sequenzer', titel: 'Sequenzer', unter: 'Modul 1', instr: INSTR, muster: MUSTER, start: 'grund', klang: 'einfach', klaenge: [['einfach', 'Einfach'], ['organisch', 'Organisch'], ['technisch', 'Technisch']],
      ziele: [['s', 'Swing'], ['k', 'Filter'], ['d', 'Echo'], ['h', 'Lautstärke']],
      hilfe: 'Handy-Sensoren oben einschalten und das Handy bewegen: Schwenken, Kippen, Drehen und Höhe formen den Beat – ohne ein Pad zu halten. In der App gehen dazu die Noten und die MIDI-Clock (24 Takte je Viertel) an Ableton.'
    });
    var bpmG = el('span', 'mf-wert'), bpmMinus = knopf('−'), bpmZ = el('b'), bpmPlus = knopf('+');
    bpmMinus.setAttribute('aria-label', 'Tempo langsamer'); bpmPlus.setAttribute('aria-label', 'Tempo schneller');
    bpmG.appendChild(bpmMinus); bpmG.appendChild(bpmZ); bpmG.appendChild(el('span', 'mf-einheit', 'BPM')); bpmG.appendChild(bpmPlus);
    var uhr = knopf('', 'mf-uhr'), punkte = [];
    // U4: Kreispunkt-Uhr – 16 Punkte im Kreis (einer je Schritt), die 4 Schläge grösser, Mitte = Klick an/aus
    for (var u = 0; u < 16; u++) { var pk = el('i'); if (u % 4 === 0) pk.classList.add('schlag'); pk.style.setProperty('--w', (u * 22.5) + 'deg'); punkte.push(pk); uhr.appendChild(pk); }
    uhr.appendChild(el('b', 'mitte'));
    uhr.setAttribute('aria-pressed', 'false'); uhr.setAttribute('aria-label', 'Clock-Punkte: antippen = Klick');
    var swG = el('span', 'mf-wert'), swMinus = knopf('−'), swZ = el('b'), swPlus = knopf('+');
    swMinus.setAttribute('aria-label', 'Weniger Swing'); swPlus.setAttribute('aria-label', 'Mehr Swing');
    swG.appendChild(el('span', 'mf-einheit', 'Swing')); swG.appendChild(swMinus); swG.appendChild(swZ); swG.appendChild(swPlus);
    [bpmG, uhr, swG].forEach(function (e) { m1.kopf.appendChild(e); });

    // Modul 2: TR 808 – eigener Aufbau wie eine klassische Drum Machine, gleicher Takt wie Modul 1
    function tr808Modul(def) {
      var B4 = ['A', 'B', 'C', 'D'];
      var m = { def: def, baenke: {}, bank: 'A', folge: false, instr: 0, zellen: [], kette: null, bw: NULL_BEW, ton: 0, gezeigt: 'A', erste: false };
      B4.forEach(function (b) { m.baenke[b] = def.muster[b].map(function (z) { return z.split('').map(function (c) { return c === 'x'; }); }); });
      m.muster = m.baenke.A;
      var karte = karteNeu(def.titel, def.unter, def.id); karte.classList.add('tr8'); m.karte = karte;
      m.kopf = el('div', 'mf-seq-kopf'); m.kopf.appendChild(startKnopf()); karte.appendChild(m.kopf);
      // 4 Zeilen A B C D (je 16 Schritte, Punkte = wie viele Stimmen dort spielen) – antippen wählt das Muster
      var zeilen = el('div', 'tr8-zeilen'), zK = {}, zP = {};
      B4.forEach(function (b) {
        var z = knopf(null, 'tr8-zeile'), pk = el('span', 'tr8-punkte'), ps = [];
        z.setAttribute('aria-label', 'Muster ' + b); z.appendChild(el('b', null, b));
        for (var s = 0; s < 16; s++) { var pt = el('i'); if (s % 4 === 0) pt.className = 'takt'; ps.push(pt); pk.appendChild(pt); }
        z.appendChild(pk); zeilen.appendChild(z); zK[b] = z; zP[b] = ps;
        z.addEventListener('click', function () { m.bank = b; m.muster = m.baenke[b]; m.gezeigt = b; zeigen(); });
      });
      karte.appendChild(zeilen);
      var zw = el('div', 'mf-seq-zeile tr8-zw'), folgeK = knopf('A → D', 'tr8-folge'), leerK = knopf('Leeren');
      folgeK.setAttribute('aria-pressed', 'false'); folgeK.title = 'Muster A bis D nacheinander, je ein Takt';
      folgeK.addEventListener('click', function () { m.folge = !m.folge; folgeK.setAttribute('aria-pressed', m.folge ? 'true' : 'false'); });
      leerK.addEventListener('click', function () { m.muster.forEach(function (r) { for (var s = 0; s < 16; s++) r[s] = false; }); zeigen(); });
      zw.appendChild(folgeK); zw.appendChild(leerK); karte.appendChild(zw);
      // Instrument-Wahl (wie die Drehschalter): antippen = wählen und anhören
      var wahl = el('div', 'tr8-instr'), wK = [];
      def.instr.forEach(function (p, i) {
        var b = knopf(null, 'tr8-knopf'), dr = el('i', 'tr8-dreh'); dr.style.setProperty('--w', (i * 27 - 150) + 'deg');
        b.appendChild(dr); b.appendChild(el('b', null, p[0]));
        b.addEventListener('click', function () { m.instr = i; zeigen(); if (!spielt) ton(m, i, 0, 0.85); });
        wahl.appendChild(b); wK.push(b);
      });
      karte.appendChild(wahl);
      // 16 Schritt-Tasten in vier Farben (je ein Viertel), Leuchtpunkt = Schritt gesetzt
      var tasten = el('div', 'tr8-tasten'), tk = [];
      for (var s0 = 0; s0 < 16; s0++) (function (s) {
        var b = knopf(null, 'tr8-taste f' + Math.floor(s / 4)); b.appendChild(el('i', 'tr8-led')); b.appendChild(el('span', null, String(s + 1)));
        b.addEventListener('click', function () { var r = m.muster[m.instr]; r[s] = !r[s]; zeigen(); if (r[s] && !spielt) ton(m, m.instr, 0, 0.85); });
        tk.push(b); tasten.appendChild(b);
      })(s0);
      karte.appendChild(tasten);
      m.zellen = [tk];
      m.kopp = BEW.kopplung(def.ziele); karte.appendChild(m.kopp.el);
      karte.appendChild(el('p', 'mf-hilfe', def.hilfe));
      platz.appendChild(karte);
      function zeigen() {
        wK.forEach(function (b, i) { b.setAttribute('aria-pressed', i === m.instr ? 'true' : 'false'); b.classList.toggle('hat', m.muster[i].some(Boolean)); });
        var r = m.muster[m.instr];
        tk.forEach(function (b, s) { b.setAttribute('aria-pressed', r[s] ? 'true' : 'false'); b.setAttribute('aria-label', def.instr[m.instr][0] + ' ' + (s + 1)); });
        B4.forEach(function (b) {
          zK[b].setAttribute('aria-pressed', b === m.gezeigt ? 'true' : 'false');
          var mu = m.baenke[b];
          zP[b].forEach(function (pt, s) { var n = 0; mu.forEach(function (row) { if (row[s]) n++; }); pt.classList.toggle('an', n > 0); pt.style.opacity = n ? String(Math.min(1, 0.45 + n * 0.18)) : ''; });
        });
      }
      m.start = function () { m.erste = true; };
      // auf jeder Eins (beim Planen): bei „A → D“ zum nächsten Muster – der allererste Takt bleibt
      m.eins = function () { if (m.erste) { m.erste = false; return; } if (m.folge) { m.bank = B4[(B4.indexOf(m.bank) + 1) % 4]; m.muster = m.baenke[m.bank]; } };
      var zeileJetzt = null;
      m.jetzt = function (s, bank) {
        if (bank && bank !== m.gezeigt) { m.gezeigt = bank; zeigen(); }
        if (zeileJetzt) zeileJetzt.classList.remove('jetzt');
        zeileJetzt = zP[m.gezeigt][s]; zeileJetzt.classList.add('jetzt');
      };
      m.aus = function () { if (zeileJetzt) zeileJetzt.classList.remove('jetzt'); zeileJetzt = null; };
      zeigen();
      mods.push(m); return m;
    }
    var m2 = tr808Modul({
      id: 'mf-tr808', titel: 'TR 808', unter: 'Modul 2', instr: INSTR808, muster: MUSTER808, klang: '808',
      ziele: [['k', 'Filter'], ['d', 'Ton'], ['h', 'Lautstärke']],
      hilfe: 'Wie eine klassische Drum Machine: Instrument wählen, dann die 16 Tasten setzen. A B C D sind vier Muster – antippen wählt eins, A → D spielt sie nacheinander, je ein Takt. Läuft im Takt von Modul 1, ▶ startet beide.'
    });

    // ---- Looper (eigene Karte): ● Loop, Spurwahl Auto · 1 · 2 …, ◷ Länge/Raster/Vorlauf, Spuren ----
    var lpKarte = karteNeu('Looper', null, 'mf-looper');
    var lpK = el('div', 'mf-seq-zeile mf-lp-kopf');
    var loopK = knopf('● Loop', 'mf-loop'); loopK.setAttribute('aria-pressed', 'false');
    // 24.11.2026 Lighthouse label-content-name-mismatch: Name = verborgener Titel + sichtbarer Wert (statt aria-label ohne den Wert)
    var wahlK = knopf('', 'mf-wahl'); wahlK.setAttribute('aria-expanded', 'false'); wahlK.appendChild(el('span', 'mf-vh', 'Spurwahl für ● Loop'));
    var wahlZ = el('span'); wahlK.appendChild(document.createTextNode('▸ ')); wahlK.appendChild(wahlZ);
    var qK = knopf('', 'mf-wahl mf-q'); qK.setAttribute('aria-expanded', 'false'); qK.appendChild(el('span', 'mf-vh', 'Loop-Länge und Quantisieren'));
    var ring = el('i', 'mf-ring'), qN = el('span'), qW = el('span'); qK.appendChild(ring); qK.appendChild(qN); qK.appendChild(qW);
    lpStartK = knopf('▶', 'gross mf-start mf-lp-start'); lpStartK.setAttribute('aria-pressed', 'false'); lpStartK.setAttribute('aria-label', 'Start');
    lpStartK.addEventListener('click', looperTippen);
    lpK.appendChild(lpStartK); lpK.appendChild(loopK); lpK.appendChild(wahlK); lpK.appendChild(qK);
    lpKarte.appendChild(lpK);
    var wahlZeile = el('div', 'mf-seq-zeile mf-chips mf-wahlzeile'); wahlZeile.hidden = true; lpKarte.appendChild(wahlZeile);
    var qZeile = el('div', 'mf-qzeile'); qZeile.hidden = true; lpKarte.appendChild(qZeile);
    var laenge = 0, rasterArt = 'takt', vorlauf = 0;   // laenge 0 = Frei
    function qZeigen() {
      qZeile.textContent = '';
      [['Länge', [[0, 'Frei'], [1, '1'], [2, '2'], [4, '4'], [8, '8']], function () { return laenge; }, function (v) { laenge = v; }],
       ['Raster', [['aus', 'Aus'], ['schlag', 'Schlag'], ['takt', 'Takt']], function () { return rasterArt; }, function (v) { rasterArt = v; }],
       ['Vorlauf', [[0, '0'], [1, '1'], [2, '2'], [4, '4']], function () { return vorlauf; }, function (v) { vorlauf = v; }]
      ].forEach(function (g) {
        var z = el('div', 'mf-seq-zeile mf-chips'); z.appendChild(el('span', 'mf-einheit', g[0]));
        g[1].forEach(function (o) {
          var b = knopf(o[1]); b.setAttribute('aria-pressed', o[0] === g[2]() ? 'true' : 'false');
          if (g[0] === 'Raster' && laenge > 0) b.disabled = true;   // feste Länge endet immer auf dem Takt
          b.addEventListener('click', function () { g[3](o[0]); qZeigen(); });
          z.appendChild(b);
        });
        if (g[0] !== 'Raster') z.appendChild(el('span', 'mf-einheit', 'Takte'));
        qZeile.appendChild(z);
      });
      qZeile.appendChild(el('p', 'mf-hilfe', 'Frei: ● Loop nochmal tippen beendet die Runde – sie endet auf dem nächsten Schlag oder Takt (Raster). Feste Länge: die Runde endet von selbst. Vorlauf zählt hörbar ein.'));
      setz(qN, laenge ? laenge + ' ' : ''); setz(qW, laenge ? (laenge === 1 ? 'Takt' : 'Takte') : 'Frei');
    }
    qK.addEventListener('click', function () { var auf = qZeile.hidden; qZeile.hidden = !auf; qK.setAttribute('aria-expanded', auf ? 'true' : 'false'); });
    var looper = el('div', 'mf-looper'); lpKarte.appendChild(looper);
    var lpFuss = el('div', 'mf-seq-zeile'), dazuK = knopf('+ Spur'), alleWegK = knopf('⌫ Alle Spuren');
    lpFuss.appendChild(dazuK); lpFuss.appendChild(alleWegK); lpKarte.appendChild(lpFuss);
    var bewLp = BEW.kopplung([['k', 'Filter'], ['h', 'Pegel']]); lpKarte.appendChild(bewLp.el);
    lpKarte.appendChild(el('p', 'mf-hilfe', '● Loop nimmt den Sequenzer, die TR 808 und die Pads auf, nie das Mikrofon. Die Aufnahme beginnt auf der nächsten Eins, die Spur schweigt, solange sie läuft. Wechselst du dabei das Muster, nimmt der Loop jeden Takt so auf, wie er klang. Danach spielt die Spur ab der nächsten Eins mit – dann ein anderes Muster wählen und die nächste Spur füllen.'));
    platz.appendChild(lpKarte);

    // ---- Effekte (eigene Karte, 24.11.2026; Vorlage Effekte.java der App): 8 Pads in zwei Reihen wie die Wisch-Seiten der App ----
    // Reihe 1 „Filter“ (Purpur, in der App auch auf alle Apps): Filter · Auto Filter · Auto Pan · Pumpen.
    // Reihe 2 „Raum · FX“ (Grün, in der App nur eigener Track): Hall · Echo · Crush · Gate.
    // Steuerung wie in der App: Pad halten = Kupplung, ziehen (oder mit Sensoren neigen) = Stärke, loslassen = Wert bleibt, doppelt tippen = aus.
    // Weg: Summe → Crush → Filter → Auto Filter → Gate → Pumpen → Auto Pan → (trocken + Hall + Echo) → EQ. Takt-Effekte folgen dem BPM.
    var FX = [['filter', 'Filter', 1], ['auto', 'Auto Filter', 1], ['pan', 'Auto Pan', 1], ['pump', 'Pumpen', 1],
      ['hall', 'Hall', 2], ['echo', 'Echo', 2], ['crush', 'Crush', 2], ['gate', 'Gate', 2]].map(function (p) {
      return { id: p[0], name: p[1], reihe: p[2], wert: 0, mitte: p[0] === 'filter', el: null };
    });
    var fxN = null, fxHalt = null;
    function fxWert(id) { for (var i = 0; i < FX.length; i++) if (FX[i].id === id) return FX[i].wert; return 0; }
    function fxText(e) { return e.mitte ? (e.wert === 0 ? 'aus' : e.wert < 0 ? '↓ ' + Math.round(-e.wert * 100) + ' %' : '↑ ' + Math.round(e.wert * 100) + ' %') : (e.wert === 0 ? 'aus' : Math.round(e.wert * 100) + ' %'); }
    function fxBauen(c, ziel) {
      var n = { c: c }, schlag = 60 / bpm;
      n.ein = c.createGain();
      n.crushD = c.createGain(); n.crushW = c.createGain(); n.crushS = c.createWaveShaper(); n.crushW.gain.value = 0;
      var kurve = new Float32Array(1024); for (var i = 0; i < 1024; i++) { var x = i / 511.5 - 1; kurve[i] = Math.round(x * 6) / 6; } n.crushS.curve = kurve;
      n.lp = c.createBiquadFilter(); n.lp.type = 'lowpass'; n.lp.frequency.value = 20000; n.lp.Q.value = 0.9;
      n.hp = c.createBiquadFilter(); n.hp.type = 'highpass'; n.hp.frequency.value = 20; n.hp.Q.value = 0.9;
      n.auto = c.createBiquadFilter(); n.auto.type = 'lowpass'; n.auto.frequency.value = 20000; n.auto.Q.value = 4;
      n.gate = c.createGain(); n.pump = c.createGain();
      n.pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      n.trocken = c.createGain(); n.hallS = c.createGain(); n.hallS.gain.value = 0; n.hall = c.createConvolver();
      var lang = Math.round(c.sampleRate * 2.4), ir = c.createBuffer(2, lang, c.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = ir.getChannelData(ch); for (var k = 0; k < lang; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / lang, 3.2); }
      n.hall.buffer = ir;
      n.echoS = c.createGain(); n.echoS.gain.value = 0; n.echo = c.createDelay(2); n.echo.delayTime.value = schlag * 0.75; n.echoR = c.createGain(); n.echoR.gain.value = 0.42;
      n.ein.connect(n.crushD); n.ein.connect(n.crushS); n.crushS.connect(n.crushW);
      n.crushD.connect(n.lp); n.crushW.connect(n.lp); n.lp.connect(n.hp); n.hp.connect(n.auto); n.auto.connect(n.gate); n.gate.connect(n.pump); n.pump.connect(n.pan);
      n.pan.connect(n.trocken); n.trocken.connect(ziel);
      n.pan.connect(n.hallS); n.hallS.connect(n.hall); n.hall.connect(ziel);
      n.pan.connect(n.echoS); n.echoS.connect(n.echo); n.echo.connect(n.echoR); n.echoR.connect(n.echo); n.echo.connect(ziel);
      // Takt-Schwinger (LFO): Auto Filter 1/2 Takt, Auto Pan 1 Takt, Gate 1/16, Pumpen je Schlag – Tiefe über Gain
      n.lfo = {};
      [['auto', 'sine', 2], ['pan', 'sine', 4], ['gate', 'square', 0.25], ['pump', 'sawtooth', 1]].forEach(function (p) {
        var o = c.createOscillator(), t = c.createGain(); o.type = p[1]; o.frequency.value = 1 / (schlag * p[2]); t.gain.value = 0; o.connect(t); o.start();
        n.lfo[p[0]] = { o: o, t: t, schlaege: p[2] };
      });
      n.lfo.auto.t.connect(n.auto.frequency); n.lfo.pan.t.connect(n.pan.pan || n.pan.gain);
      n.lfo.gate.t.connect(n.gate.gain); n.lfo.pump.t.connect(n.pump.gain);
      return n;
    }
    // Takt-Schwinger neu starten (beim Start auf die Eins) und dem BPM folgen
    function fxTakt(beiEins) {
      if (!fxN) return; var c = fxN.c, schlag = 60 / bpm;
      Object.keys(fxN.lfo).forEach(function (k) {
        var l = fxN.lfo[k];
        if (beiEins != null) { try { l.o.stop(); } catch (x) { } l.o.disconnect(); var o = c.createOscillator(); o.type = k === 'gate' ? 'square' : k === 'pump' ? 'sawtooth' : 'sine';
          o.frequency.value = 1 / (schlag * l.schlaege); o.connect(l.t); o.start(beiEins); l.o = o; }
        else l.o.frequency.setTargetAtTime(1 / (schlag * l.schlaege), c.currentTime, 0.05);
      });
      fxN.echo.delayTime.setTargetAtTime(schlag * 0.75, c.currentTime, 0.1);
    }
    function fxSetz() {
      FX.forEach(function (e) { setz(e.z.w, fxText(e)); e.z.k.setAttribute('aria-pressed', e.wert !== 0 ? 'true' : 'false');
        e.z.bal.style.height = (Math.abs(e.wert) * 100).toFixed(0) + '%'; });
      if (!fxN) return; var n = fxN, t = n.c.currentTime, T = function (p, v) { p.setTargetAtTime(v, t, 0.03); };
      var fl = fxWert('filter');
      T(n.lp.frequency, fl < 0 ? 20000 * Math.pow(250 / 20000, -fl) : 20000); T(n.hp.frequency, fl > 0 ? 20 * Math.pow(3000 / 20, fl) : 20);
      var au = fxWert('auto'); T(n.auto.frequency, au ? 1400 : 20000); T(n.lfo.auto.t.gain, au * 1300);
      var pa = fxWert('pan'); T(n.lfo.pan.t.gain, pa * 0.9);
      var ga = fxWert('gate'); T(n.gate.gain, 1 - ga / 2); T(n.lfo.gate.t.gain, ga / 2);
      var pu = fxWert('pump'); T(n.pump.gain, 1 - pu * 0.45); T(n.lfo.pump.t.gain, pu * 0.45);
      var ha = fxWert('hall'); T(n.hallS.gain, ha * 0.9); T(n.trocken.gain, 1 - ha * 0.25);
      T(n.echoS.gain, fxWert('echo') * 0.7);
      var cr = fxWert('crush'); T(n.crushW.gain, cr); T(n.crushD.gain, 1 - cr);
    }
    var fxKarte = karteNeu('Effekte', null, 'mf-fx');
    var fxFeld = el('div', 'mf-fx');
    [['Filter', 1], ['Raum · FX', 2]].forEach(function (r) {
      var reihe = el('div', 'mf-fx-reihe r' + r[1]); reihe.appendChild(el('span', 'mf-fx-titel', r[0]));
      var pads = el('div', 'mf-fx-pads');
      FX.filter(function (e) { return e.reihe === r[1]; }).forEach(function (e) {
        var k = knopf('', 'mf-fx-pad'), bal = el('i', 'mf-fx-bal'), w = el('span', 'mf-fx-w');
        k.appendChild(bal); k.appendChild(el('b', null, e.name)); k.appendChild(w); k.setAttribute('aria-pressed', 'false');
        var y0 = 0, w0 = 0, letzt = 0;
        k.addEventListener('pointerdown', function (ev) {
          ev.preventDefault(); audio(); var jetzt = performance.now();
          if (jetzt - letzt < 320) { e.wert = 0; fxHalt = null; letzt = 0; fxSetz(); return; }   // doppelt tippen = aus
          letzt = jetzt; y0 = ev.clientY; w0 = e.wert; try { k.setPointerCapture(ev.pointerId); } catch (x) { }
          var b = BEW.jetzt(), sens = b.quelle === 'sensor'; fxHalt = { e: e, w0: e.wert, k0: b.k, aktiv: sens }; k.classList.add('halt');
          if (!e.mitte && e.wert === 0 && !sens) { e.wert = 0.5; fxSetz(); }   // antippen = halbe Stärke
        });
        k.addEventListener('pointermove', function (ev) {
          if (!fxHalt || fxHalt.e !== e) return;
          var v = w0 + (y0 - ev.clientY) / 110; e.wert = Math.round(klemm(v, e.mitte ? -1 : 0, 1) * 100) / 100; fxSetz();
        });
        var los = function () { if (fxHalt && fxHalt.e === e) fxHalt = null; k.classList.remove('halt'); };
        k.addEventListener('pointerup', los); k.addEventListener('pointercancel', los); k.addEventListener('lostpointercapture', los);
        k.addEventListener('keydown', function (ev) {
          var d = ev.key === 'ArrowUp' || ev.key === 'ArrowRight' ? 0.1 : ev.key === 'ArrowDown' || ev.key === 'ArrowLeft' ? -0.1 : 0;
          if (d) { ev.preventDefault(); audio(); e.wert = Math.round(klemm(e.wert + d, e.mitte ? -1 : 0, 1) * 10) / 10; fxSetz(); }
          else if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); e.wert = 0; fxSetz(); }
        });
        e.z = { k: k, w: w, bal: bal }; pads.appendChild(k);
      });
      reihe.appendChild(pads); fxFeld.appendChild(reihe);
    });
    fxKarte.appendChild(fxFeld);
    var fxZeile = el('div', 'mf-seq-zeile'), fxAus = knopf('Alle aus');
    fxAus.addEventListener('click', function () { FX.forEach(function (e) { e.wert = 0; }); fxSetz(); }); fxZeile.appendChild(fxAus);
    fxKarte.appendChild(fxZeile);
    fxKarte.appendChild(el('p', 'mf-hilfe', 'Pad halten und nach oben ziehen = stärker, nach unten = schwächer; mit Handy-Sensoren hält man das Pad und neigt das Handy. Loslassen = der Wert bleibt, doppelt tippen = aus. Filter: nach unten dumpf, nach oben dünn. Auto Filter, Auto Pan, Pumpen, Gate und Echo laufen im Takt. In der App wirken Filter-Pads auch auf alle Apps, Raum und FX nur auf den eigenen Track.'));
    platz.appendChild(fxKarte);
    FX.forEach(function (e) { e.z.w.textContent = fxText(e); });
    // mit Sensoren: gehaltenes Pad folgt dem Neigen (relativ ab dem Griff, wie die Kupplung der App)
    function fxNeigen() {
      if (!fxHalt) return; var b = BEW.jetzt(); if (b.quelle !== 'sensor') return;   // Maus/Finger zieht selbst
      if (!fxHalt.aktiv) { fxHalt.aktiv = true; fxHalt.k0 = b.k; fxHalt.w0 = fxHalt.e.wert; }
      var e = fxHalt.e, v = Math.round(klemm(fxHalt.w0 + (b.k - fxHalt.k0) * 1.4, e.mitte ? -1 : 0, 1) * 100) / 100;
      if (v !== e.wert) { e.wert = v; fxSetz(); }
    }

    // ---- Mixer (eigene Karte, 24.11.2026; Vorlage MixerSeite.java „wie ein Akai“): ein Kanalzug je Quelle ----
    // Fader (dB, doppelt tippen = 0 dB) · Panorama · M = stumm (Orange wie in der App) · ● = kommt in den ● Loop · Pegelanzeige.
    // Weg: Sequenzer/TR 808 (je Kette) → Kanal → Summe → EQ; Drum Pads → Kanal; Loops (Bus + Filter) → Kanal. Bewegung: Kippen = Überblenden
    // Sequenzer ↔ TR 808, Schwenken = Panorama aller Kanäle. Der ● Loop nimmt auf, was man hört (Fader, Panorama, stumm, ●).
    var mix = [['seq', 'Sequenzer'], ['tr', 'TR 808'], ['pads', 'Drum Pads'], ['loops', 'Loops']].map(function (p) {
      return { id: p[0], name: p[1], pegel: 1, pan: 0, stumm: false, rec: p[0] !== 'loops', g: null, p: null, ana: null, z: {} };
    });
    var mixXf = 0, mixPanBew = 0;
    function mixDb(v) { return v <= 0.0001 ? '−∞' : ((v >= 1 ? '+' : '') + (20 * Math.log10(v)).toFixed(1)).replace('.', ',').replace('+0,0', '0,0'); }
    function mixFaktor(i) { return i === 0 ? Math.min(1, 1 - mixXf) : i === 1 ? Math.min(1, 1 + mixXf) : 1; }   // Überblenden
    function mixGain(i) { var c = mix[i]; return c.stumm ? 0 : c.pegel * mixFaktor(i); }
    function mixPan(i) { return klemm(mix[i].pan + mixPanBew, -1, 1); }
    function mixSetz() {
      midiZ.forEach(function (l) { l.forEach(function (c) { if (!c.z.zug) return; setz(c.z.db, mixDb(c.pegel)); c.z.r.value = String(c.pegel);
        c.z.m.setAttribute('aria-pressed', c.stumm ? 'true' : 'false'); c.z.rec.setAttribute('aria-pressed', c.rec ? 'true' : 'false'); c.z.zug.classList.toggle('stumm', c.stumm); }); });
      mix.forEach(function (c, i) {
        setz(c.z.db, mixDb(c.pegel)); c.z.r.value = String(c.pegel);
        c.z.m.setAttribute('aria-pressed', c.stumm ? 'true' : 'false'); if (c.z.rec) c.z.rec.setAttribute('aria-pressed', c.rec ? 'true' : 'false');
        c.z.zug.classList.toggle('stumm', c.stumm);
        if (c.g) { var t = ctx.currentTime; c.g.gain.setTargetAtTime(mixGain(i), t, 0.03); if (c.p.pan) c.p.pan.setTargetAtTime(mixPan(i), t, 0.04); }
      });
      if (knobs) knobs.forEach(knobZeigen);
    }
    // Kanal im Klangweg (live oder in der OfflineAudioContext des ● Loop): Eingang → Panorama → Ziel (+ Abgriff für die Anzeige)
    function mixKanal(c, i, ziel, live) {
      var g = c.createGain(), p = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      g.gain.value = mixGain(i); if (p.pan) p.pan.value = mixPan(i);
      g.connect(p); p.connect(ziel);
      if (live) { var a = c.createAnalyser(); a.fftSize = 512; p.connect(a); mix[i].g = g; mix[i].p = p; mix[i].ana = a; }
      return g;
    }
    var mixKarte = karteNeu('Mixer', null, 'mf-mixer');
    // Bänke A–D wie die App (MixerSeite.java, Kenny 25.11.2026): je Bank 8 Kanalzüge (Fader · M · ●). Bank A Spur 1–4 = die vier
    // Klangkanäle oben, alle übrigen Züge sind MIDI-Fader wie in der App (im Browser ohne Klang). MIDI wie STANDARD.md: Kanal Bank + 2,
    // Fader CC 40–47, M CC 72–79, ● CC 80–87; Fader-Wert wie die App (0 dB = 0,85 → CC 108).
    var mixBank = 0, mixBankK = [], mixSeiten = [], mixBeiBank = null;
    var midiZ = [0, 1, 2, 3].map(function (b) { var l = []; for (var s = 0; s < 8; s++) l.push({ name: 'Spur ' + (s + 1), pegel: 1, pan: 0, stumm: false, rec: false, midi: true, z: {} }); return l; });
    function faderCC(p) { return Math.round(Math.min(1, 0.85 * Math.sqrt(Math.max(0, p))) * 127); }
    var mixMidiZ = el('p', 'mf-mix-midi'), mixLetztZ = el('p', 'mf-mix-midi mf-mix-letzt');
    function midiZeile() {
      mixMidiZ.textContent = ''; wort(mixMidiZ, 'Bank'); mixMidiZ.appendChild(document.createTextNode(' ' + BANK[mixBank] + ' · ')); wort(mixMidiZ, 'MIDI-Kanal');
      if (mixArt === 1) mixMidiZ.appendChild(document.createTextNode(' ' + (mixBank + 2) + ' · Knobs CC 48–55 · M CC 72–79'));
      else mixMidiZ.appendChild(document.createTextNode(' ' + (mixBank + 2) + ' · Fader CC 40–47 · M CC 72–79 · ● CC 80–87'));
    }
    // Knobs (Stufe 1, 26.11.2026; MixerSeite.java knobsZeichnen): je Bank 8 Drehregler mit M, Bogen über 270°, Grundwert 0,5 (Mixer.KNOB_GRUND),
    // nach oben ziehen = mehr (220 px = ganzer Weg wie die App), doppelt tippen = Mitte. M ist dasselbe Stumm wie beim Fader dieser Spur.
    // Bank A Knob 1–4 = Panorama der vier Klangkanäle (Mitte = 0), alle übrigen sind MIDI (Kanal Bank + 2, CC 48–55).
    var mixArt = 0, knobs = [], knobSeiten = [];
    function knobPunkt(w, r) { var a = (135 + 270 * w) * Math.PI / 180; return [(30 + Math.cos(a) * r).toFixed(2), (30 + Math.sin(a) * r).toFixed(2)]; }
    function knobWert(k) { return k.pan ? klemm(k.c.pan / 2 + 0.5, 0, 1) : k.w; }
    function knobText(k, w) {
      if (!k.pan) return String(Math.round(w * 127));
      var p = Math.round((w - 0.5) * 200); return p === 0 ? 'C' : (p < 0 ? 'L ' + (-p) : 'R ' + p);
    }
    function knobZeigen(k) {
      var w = knobWert(k), a = knobPunkt(w, 8), b = knobPunkt(w, 15), t = knobText(k, w);
      k.wert.setAttribute('stroke-dasharray', (w * 100).toFixed(1) + ' 100');
      k.zeiger.setAttribute('x1', a[0]); k.zeiger.setAttribute('y1', a[1]); k.zeiger.setAttribute('x2', b[0]); k.zeiger.setAttribute('y2', b[1]);
      setz(k.zahl, t); k.dreh.setAttribute('aria-valuenow', String(Math.round(w * 127))); k.dreh.setAttribute('aria-valuetext', t);
      k.m.setAttribute('aria-pressed', k.c.stumm ? 'true' : 'false'); k.zelle.classList.toggle('stumm', k.c.stumm);
    }
    function knobSetzen(k, w) {
      w = klemm(w, 0, 1);
      if (k.pan) { k.c.pan = Math.abs(w - 0.5) < 0.015 ? 0 : (w - 0.5) * 2; mixSetz(); }   // rastet in der Mitte
      else { k.w = w; knobZeigen(k); }
      midiGesendet(k.c, k.s, 'k', knobWert(k));
    }
    function knobBauen(b, s) {
      var pan = b === 0 && s < 4, c = pan ? mix[s] : midiZ[b][s];
      var k = { s: s, c: c, pan: pan, w: 0.5 }, zelle = el('div', 'mf-mix-zug mf-knob-zelle'), nm = el('span', 'mf-mix-name');
      if (pan) nm.textContent = c.name; else { zelle.classList.add('mf-midi'); wort(nm, 'Spur'); nm.appendChild(document.createTextNode(' ' + (s + 1))); }
      zelle.appendChild(nm);
      var dreh = el('div', 'mf-knob'); dreh.tabIndex = 0; dreh.setAttribute('role', 'slider'); dreh.setAttribute('aria-label', pan ? 'Panorama' : 'Drehregler');
      dreh.setAttribute('aria-valuemin', '0'); dreh.setAttribute('aria-valuemax', '127');
      var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 60 60'); svg.setAttribute('aria-hidden', 'true');
      var bogen = 'M13.03 46.97 A24 24 0 1 1 46.97 46.97';
      [['path', 'mf-knob-grund'], ['path', 'mf-knob-wert'], ['circle', 'mf-knob-kopf'], ['line', 'mf-knob-zeiger']].forEach(function (p) {
        var e = document.createElementNS(NS, p[0]); e.setAttribute('class', p[1]);
        if (p[0] === 'path') { e.setAttribute('d', bogen); e.setAttribute('pathLength', '100'); }
        if (p[0] === 'circle') { e.setAttribute('cx', '30'); e.setAttribute('cy', '30'); e.setAttribute('r', '17'); }
        svg.appendChild(e); if (p[1] === 'mf-knob-wert') k.wert = e; else if (p[1] === 'mf-knob-zeiger') k.zeiger = e;
      });
      dreh.appendChild(svg); zelle.appendChild(dreh);
      var y0 = 0, w0 = 0, zieht = false;
      dreh.addEventListener('pointerdown', function (e) {
        if (e.button > 0) return; zieht = true; y0 = e.clientY; w0 = knobWert(k);
        try { dreh.setPointerCapture(e.pointerId); } catch (x) {} dreh.classList.add('aktiv'); e.preventDefault(); dreh.focus({ preventScroll: true });
      });
      dreh.addEventListener('pointermove', function (e) { if (zieht) knobSetzen(k, w0 + (y0 - e.clientY) / 220); });
      function los() { zieht = false; dreh.classList.remove('aktiv'); }
      dreh.addEventListener('pointerup', los); dreh.addEventListener('pointercancel', los);
      dreh.addEventListener('dblclick', function () { knobSetzen(k, 0.5); });
      dreh.addEventListener('keydown', function (e) {
        var w = knobWert(k), st = e.shiftKey ? 10 / 127 : 1 / 127, n = null;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') n = w + st; else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') n = w - st;
        else if (e.key === 'PageUp') n = w + 10 / 127; else if (e.key === 'PageDown') n = w - 10 / 127;
        else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = 1;
        if (n !== null) { e.preventDefault(); knobSetzen(k, n); }
      });
      var zahl = el('b', 'mf-mix-db'); zelle.appendChild(zahl);
      var kn = el('div', 'mf-mix-k'), m = knopf('M', 'mf-mix-m'); m.setAttribute('aria-label', 'Stumm schalten');
      m.addEventListener('click', function () { c.stumm = !c.stumm; mixSetz(); midiGesendet(c, s, 'm'); }); kn.appendChild(m); zelle.appendChild(kn);
      zelle.setAttribute('role', 'group'); if (pan) zelle.setAttribute('aria-label', c.name);
      k.zelle = zelle; k.dreh = dreh; k.zahl = zahl; k.m = m; knobs.push(k); knobZeigen(k);
      return zelle;
    }
    function midiGesendet(c, s, art, kw) {   // was Ableton jetzt bekäme (im Browser wird nichts gesendet); kw = Knob-Wert 0–1
      var cc = art === 'm' ? 72 + s : art === 'r' ? 80 + s : art === 'k' ? 48 + s : 40 + s;
      var w = art === 'm' ? (c.stumm ? 127 : 0) : art === 'r' ? (c.rec ? 127 : 0) : art === 'k' ? Math.round(kw * 127) : faderCC(c.pegel);
      mixLetztZ.textContent = ''; wort(mixLetztZ, 'Zuletzt:'); mixLetztZ.appendChild(document.createTextNode(' ' + BANK[mixBank] + (s + 1) + ' · '));
      wort(mixLetztZ, 'MIDI-Kanal'); mixLetztZ.appendChild(document.createTextNode(' ' + (mixBank + 2) + ' · CC ' + cc + ' = ' + w));
    }
    function zugBauen(c, s) {
      var klang = !c.midi, zug = el('div', 'mf-mix-zug'), r = el('input'), db = el('b', 'mf-mix-db'), led = el('span', 'mf-mix-led'), li = el('i');
      var nm = el('span', 'mf-mix-name'); if (klang) nm.textContent = c.name; else { wort(nm, 'Spur'); nm.appendChild(document.createTextNode(' ' + (s + 1))); }
      zug.appendChild(nm); if (!klang) zug.classList.add('mf-midi');
      // Panorama der Klangkanäle liegt seit 26.11.2026 auf Bank A Knob 1–4 (wie die App), hier nur die Kennzeichnung
      if (klang) { var kz = el('span', 'mf-mix-cc'); wort(kz, 'Klang'); zug.appendChild(kz); zug.appendChild(el('span', 'mf-mix-lr', 'Audio')); }
      else { zug.appendChild(el('span', 'mf-mix-cc', 'CC ' + (40 + s))); zug.appendChild(el('span', 'mf-mix-lr', 'MIDI')); }
      var knoepfe = el('div', 'mf-mix-k'), m = knopf('M', 'mf-mix-m'); m.setAttribute('aria-label', 'Stumm schalten'); m.setAttribute('aria-pressed', 'false');
      m.addEventListener('click', function () { c.stumm = !c.stumm; mixSetz(); midiGesendet(c, s, 'm'); }); knoepfe.appendChild(m);
      var rk = null;
      if (c.id !== 'loops') {
        rk = knopf('●', 'mf-mix-rec'); rk.setAttribute('aria-label', 'In den ● Loop aufnehmen'); rk.setAttribute('aria-pressed', c.rec ? 'true' : 'false');
        rk.addEventListener('click', function () { c.rec = !c.rec; mixSetz(); midiGesendet(c, s, 'r'); }); knoepfe.appendChild(rk);
      } else knoepfe.appendChild(el('span', 'mf-mix-rec leer'));
      zug.appendChild(knoepfe);
      var fz = el('div', 'mf-mix-fz');
      r.type = 'range'; r.min = '0'; r.max = '1.41'; r.step = '0.01'; r.value = '1'; r.setAttribute('aria-label', 'Lautstärke'); zug.setAttribute('role', 'group');
      if (klang) zug.setAttribute('aria-label', c.name);
      r.addEventListener('input', function () { c.pegel = Number(r.value); if (Math.abs(c.pegel - 1) < 0.03) c.pegel = 1; mixSetz(); midiGesendet(c, s, 'f'); });   // rastet bei 0 dB
      r.addEventListener('dblclick', function () { c.pegel = 1; mixSetz(); midiGesendet(c, s, 'f'); });
      led.appendChild(li); fz.appendChild(r); fz.appendChild(led); zug.appendChild(fz); zug.appendChild(db);
      c.z = { zug: zug, r: r, db: db, m: m, rec: rk, led: li };
      return zug;
    }
    var mixBaenke = el('div', 'mf-mix-baenke');
    var mixZuege = el('div', 'mf-mix-wrap');
    [0, 1, 2, 3].forEach(function (b) {
      var bk = knopf(); wort(bk, 'Bank'); bk.appendChild(document.createTextNode(' ' + BANK[b])); bk.setAttribute('aria-pressed', b === 0 ? 'true' : 'false');
      bk.addEventListener('click', function () { mixBankSetzen(b, true); }); mixBankK.push(bk); mixBaenke.appendChild(bk);
      var seite = el('div', 'mf-mix'); seite.hidden = b !== 0;
      for (var s = 0; s < 8; s++) seite.appendChild(zugBauen(b === 0 && s < 4 ? mix[s] : midiZ[b][s], s));
      mixSeiten.push(seite); mixZuege.appendChild(seite);
      var ks = el('div', 'mf-mix mf-knobs'); ks.hidden = true;
      for (var t = 0; t < 8; t++) ks.appendChild(knobBauen(b, t));
      knobSeiten.push(ks); mixZuege.appendChild(ks);
    });
    // Seite Fader ↔ Knobs (wie die App; Stufe 2 bringt das Wischen dazu)
    var mixArtZ = el('div', 'mf-mix-art'), mixArtK = [];
    ['Fader', 'Knobs'].forEach(function (n, i) {
      var k = knopf(); wort(k, n); k.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      k.addEventListener('click', function () { mixArtSetzen(i); }); mixArtK.push(k); mixArtZ.appendChild(k);
    });
    function mixArtSetzen(i) { mixArt = i; mixArtK.forEach(function (k, j) { k.setAttribute('aria-pressed', j === i ? 'true' : 'false'); }); mixBankSetzen(mixBank, false); }
    function mixBankSetzen(b, hand) {
      mixBank = b; mixBankK.forEach(function (k, i) { k.setAttribute('aria-pressed', i === b ? 'true' : 'false'); });
      mixSeiten.forEach(function (x, i) { x.hidden = i !== b || mixArt !== 0; });
      knobSeiten.forEach(function (x, i) { x.hidden = i !== b || mixArt !== 1; }); midiZeile();
      if (hand && mixBeiBank) mixBeiBank(b);
    }
    midiZeile();
    mixKarte.appendChild(mixBaenke); mixKarte.appendChild(mixArtZ);
    mixKarte.appendChild(mixZuege); mixKarte.appendChild(mixMidiZ); mixKarte.appendChild(mixLetztZ);
    var bewMix = BEW.kopplung([['k', 'Überblenden'], ['s', 'Panorama']]); mixKarte.appendChild(bewMix.el);
    mixKarte.appendChild(el('p', 'mf-hilfe', 'Ein Kanalzug je Quelle: Fader ziehen (doppelt tippen = 0 dB), M = stumm, ● = kommt in den ● Loop. Unter „Knobs“ liegen je Bank 8 Drehregler: nach oben ziehen = mehr, doppelt tippen = Mitte; in Bank A sind Knob 1–4 das Panorama der vier Klangkanäle. Kippen blendet zwischen Sequenzer und TR 808 über. In der App gehen Fader und Drehregler als MIDI an Ableton.'));
    platz.appendChild(mixKarte);
    // Pegelanzeige: nur solange die Karte offen und sichtbar ist und Klang da ist
    var mixSicht = false, mixLaeuft = false, mixPuffer = null;
    function mixAnzeige() {
      if (!mixSicht || !ctx || document.hidden) { mixLaeuft = false; mix.forEach(function (c) { c.z.led.style.height = '0%'; }); return; }
      mix.forEach(function (c) {
        if (!c.ana) return; if (!mixPuffer) mixPuffer = new Float32Array(c.ana.fftSize);
        c.ana.getFloatTimeDomainData(mixPuffer); var spitze = 0; for (var k = 0; k < mixPuffer.length; k++) { var a = Math.abs(mixPuffer[k]); if (a > spitze) spitze = a; }
        var dbv = spitze > 0 ? 20 * Math.log10(spitze) : -60, h = klemm((dbv + 48) / 54, 0, 1);   // −48 … +6 dB
        c.z.led.style.height = (h * 100).toFixed(0) + '%'; c.z.led.classList.toggle('heiss', dbv > -1);
      });
      requestAnimationFrame(mixAnzeige);
    }
    function mixAnzeigeStart() { if (!mixLaeuft && mixSicht && ctx) { mixLaeuft = true; requestAnimationFrame(mixAnzeige); } }
    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { mixSicht = e[e.length - 1].isIntersecting; mixAnzeigeStart(); }).observe(mixZuege);
    else mixSicht = true;
    mixSetz();

    // ---- EQ (eigene Karte; Eq.java: 8 Glocken 60 Hz – 15 kHz, ±12 dB, Q 1,4, doppelt tippen = 0, Flach, Balance) ----
    var FREQ = [60, 150, 400, 1000, 2400, 6000, 10000, 15000], EQ_Q = 1.4, db = FREQ.map(function () { return 0; }), balance = 0;
    var eqKarte = karteNeu('EQ', null, 'mf-eq'); eqKarte.classList.add('mf-eq');
    var kurve = el('canvas', 'mf-kurve'); kurve.setAttribute('aria-hidden', 'true'); eqKarte.appendChild(kurve);
    var fader = el('div', 'mf-fader'), regler = [], dbZ = [];
    FREQ.forEach(function (fq, i) {
      var sp = el('label', 'mf-band'), z = el('b'), r = el('input');
      r.type = 'range'; r.min = '-12'; r.max = '12'; r.step = '0.5'; r.value = '0';
      r.setAttribute('aria-label', (fq >= 1000 ? (fq / 1000) + ' kHz' : fq + ' Hz'));
      r.addEventListener('input', function () { db[i] = Number(r.value); eqSetz(); });
      r.addEventListener('dblclick', function () { r.value = '0'; db[i] = 0; eqSetz(); });
      sp.appendChild(z); sp.appendChild(r); sp.appendChild(el('span', 'mf-hz', fq >= 1000 ? String(fq / 1000).replace('.', ',') + 'k' : String(fq)));
      fader.appendChild(sp); regler.push(r); dbZ.push(z);
    });
    eqKarte.appendChild(fader);
    var balZ = el('div', 'mf-seq-zeile mf-balance'), balR = el('input'), flachK = knopf('Flach');
    balR.type = 'range'; balR.min = '-1'; balR.max = '1'; balR.step = '0.05'; balR.value = '0'; balR.setAttribute('aria-label', 'Balance');
    balR.addEventListener('input', function () { balance = Number(balR.value); eqSetz(); });
    balR.addEventListener('dblclick', function () { balR.value = '0'; balance = 0; eqSetz(); });
    balZ.appendChild(el('span', 'mf-einheit', 'Balance')); balZ.appendChild(el('span', 'mf-einheit', 'links')); balZ.appendChild(balR);
    balZ.appendChild(el('span', 'mf-einheit', 'rechts')); balZ.appendChild(flachK);
    eqKarte.appendChild(balZ);
    var bewEq = BEW.kopplung([['k', 'Klangwaage'], ['s', 'Balance']]); eqKarte.appendChild(bewEq.el);
    eqKarte.appendChild(el('p', 'mf-hilfe', 'Fader ziehen: ±12 dB je Band, doppelt tippen = 0. Der EQ wirkt hier auf alles, was klingt – Sequenzer und Loops. In der App wirkt er auf alle Apps am Handy.'));
    flachK.addEventListener('click', function () { db = db.map(function () { return 0; }); regler.forEach(function (r) { r.value = '0'; }); balance = 0; balR.value = '0'; eqSetz(); });
    platz.appendChild(eqKarte);

    // ---- Klang ----
    // Kette je Modul: Eingang → Filter → Lautstärke → Summe, mit Echo am Filter (live oder in der OfflineAudioContext des ● Loop)
    function ketteBauen(c, ziel, p) {
      var e = c.createGain(), fl = c.createBiquadFilter(), lg = c.createGain(), ec = c.createDelay(1), rg = c.createGain(), eg = c.createGain();
      fl.type = 'lowpass'; fl.frequency.value = p ? p.fq : 12000; fl.Q.value = 0.8; lg.gain.value = p ? p.laut : 0.7;
      ec.delayTime.value = p ? p.zeit : 0.4; rg.gain.value = 0.35; eg.gain.value = p ? p.echo : 0;
      e.connect(fl); fl.connect(lg); lg.connect(ziel); fl.connect(eg); eg.connect(ec); ec.connect(rg); rg.connect(ec); ec.connect(lg);
      return { ctx: c, ein: e, filt: fl, laut: lg, echo: ec, echoG: eg };
    }
    function ketteWerte(k) { return { fq: k.filt.frequency.value, laut: k.laut.gain.value, echo: k.echoG.gain.value, zeit: k.echo.delayTime.value }; }
    function audio() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      rausch = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = rausch.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      // Summe (Module + Loops + Pads) → 8 Glocken (EQ) → Balance → Lautsprecher
      summe = ctx.createGain();
      eqB = FREQ.map(function (fq) { var b = ctx.createBiquadFilter(); b.type = 'peaking'; b.frequency.value = Math.min(fq, ctx.sampleRate * 0.45); b.Q.value = EQ_Q; return b; });
      pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      fxN = fxBauen(ctx, eqB[0]); summe.connect(fxN.ein); fxSetz();   // Summe → Effekte → EQ
       for (var k = 1; k < eqB.length; k++) eqB[k - 1].connect(eqB[k]); eqB[eqB.length - 1].connect(pan); pan.connect(ctx.destination);
      // Mixer: je Quelle ein Kanal (Fader, Panorama, stumm) vor der Summe
      var kanal = mix.map(function (c, i) { return mixKanal(ctx, i, summe, true); });
      mods.forEach(function (m, i) { m.kette = ketteBauen(ctx, kanal[Math.min(i, 1)]); });
      // Loops: eigener Bus mit Filter (Bewegung des Loopers), dann über den Kanal „Loops“ in die Summe
      loopBus = ctx.createGain(); loopFilt = ctx.createBiquadFilter(); loopFilt.type = 'lowpass'; loopFilt.frequency.value = 18000; loopFilt.Q.value = 0.7;
      loopBus.connect(loopFilt); loopFilt.connect(kanal[3]);
      mixAnzeigeStart();
      spuren.forEach(spurAnschliessen); eqSetz(); formen();
      if (d808()) satz808().vorbereiten(ctx);
    }
    // Satz der Karte „Drum & 808“ (gleiche Ton/Länge/Pegel wie die Pads), sonst ein eigener
    function satz808() { var D = d808(); return D.satz || eigen808 || (eigen808 = D.neu()); }
    function huell(z, t, a, dauer) { var g = z.ctx.createGain(); g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.001, t + dauer); g.connect(z.ein); return g; }
    function rauschen(z, t, typ, freq, a, dauer) {
      var q = z.ctx.createBufferSource(); q.buffer = rausch; var fl = z.ctx.createBiquadFilter(); fl.type = typ; fl.frequency.value = freq;
      q.connect(fl); fl.connect(huell(z, t, a, dauer)); q.start(t); q.stop(t + dauer + 0.02);
    }
    function osz(z, t, typ, f0, f1, a, dauer) {
      var o = z.ctx.createOscillator(); o.type = typ; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dauer * 0.6);
      o.connect(huell(z, t, a, dauer)); o.start(t); o.stop(t + dauer + 0.02);
    }
    // Stimme i des Moduls m zur Zeit t; z = Ziel { ctx, ein } (Standard: die Kette des Moduls), st = Ton in Halbtönen (TR 808)
    function ton(m, i, t, v, z, st) {
      if (!z) { audio(); if (!ctx) return; z = m.kette; st = m.ton; }
      t = Math.max(t || 0, z.ctx.currentTime); v = v || 1;
      if (m.def.klang === '808') {
        if (!d808()) return;
        var q = satz808().spielen(z.ctx, z.ein, m.def.instr[i][1], t, v);
        if (q && st) q.playbackRate.value = Math.pow(2, st / 12);
        return;
      }
      var art = m.klang || m.def.klang, ins = m.def.instr[i][0];
      if (art === 'organisch') return organisch(z, t, v, ins);
      if (art === 'technisch') return technisch(z, t, v, ins);
      switch (ins) {
        case 'BD': osz(z, t, 'sine', 140, 45, 1.0 * v, 0.45); break;
        case 'SD': osz(z, t, 'triangle', 220, 160, 0.35 * v, 0.12); rauschen(z, t, 'highpass', 1200, 0.5 * v, 0.18); break;
        case 'CP': [0, 0.012, 0.024].forEach(function (x) { rauschen(z, t + x, 'bandpass', 1500, 0.55 * v, 0.06); }); rauschen(z, t + 0.03, 'bandpass', 1300, 0.4 * v, 0.2); break;
        case 'CH': rauschen(z, t, 'highpass', 7500, 0.32 * v, 0.045); break;
        case 'OH': rauschen(z, t, 'highpass', 7000, 0.28 * v, 0.32); break;
        case 'LT': osz(z, t, 'sine', 160, 90, 0.7 * v, 0.35); break;
        case 'HT': osz(z, t, 'sine', 260, 170, 0.6 * v, 0.28); break;
        case 'RS': osz(z, t, 'square', 1700, 1600, 0.12 * v, 0.03); rauschen(z, t, 'bandpass', 3000, 0.25 * v, 0.03); break;
      }
    }
    // U6 Organisch: weich, holzig, wie von Hand – Felle, Shaker, Holzblock
    function organisch(z, t, v, ins) {
      switch (ins) {
        case 'BD': osz(z, t, 'sine', 110, 50, 1.0 * v, 0.55); rauschen(z, t, 'lowpass', 220, 0.35 * v, 0.03); break;
        case 'SD': osz(z, t, 'triangle', 190, 150, 0.25 * v, 0.1); rauschen(z, t, 'bandpass', 2200, 0.45 * v, 0.28); break;
        case 'CP': [0, 0.009, 0.021, 0.035].forEach(function (x) { rauschen(z, t + x, 'bandpass', 1100, 0.5 * v, 0.05); }); rauschen(z, t + 0.04, 'bandpass', 1000, 0.3 * v, 0.25); break;
        case 'CH': rauschen(z, t, 'bandpass', 6000, 0.22 * v, 0.05); rauschen(z, t + 0.018, 'bandpass', 6500, 0.16 * v, 0.04); break;
        case 'OH': rauschen(z, t, 'bandpass', 5000, 0.22 * v, 0.4); break;
        case 'LT': osz(z, t, 'sine', 120, 95, 0.7 * v, 0.5); break;
        case 'HT': osz(z, t, 'sine', 220, 190, 0.55 * v, 0.35); break;
        case 'RS': osz(z, t, 'triangle', 900, 850, 0.3 * v, 0.05); break;
      }
    }
    // U6 Technisch: hart, kurz, metallisch – Rechteck, Sägezahn, enge Filter
    function metall(z, t, a, dauer) { [5400, 7900, 10200].forEach(function (f) { osz(z, t, 'square', f, f, a, dauer); }); }
    function technisch(z, t, v, ins) {
      switch (ins) {
        case 'BD': osz(z, t, 'sine', 200, 45, 1.0 * v, 0.3); osz(z, t, 'square', 90, 40, 0.12 * v, 0.05); break;
        case 'SD': osz(z, t, 'square', 330, 300, 0.12 * v, 0.08); rauschen(z, t, 'highpass', 2500, 0.45 * v, 0.1); break;
        case 'CP': [0, 0.008, 0.016].forEach(function (x) { rauschen(z, t + x, 'bandpass', 2200, 0.5 * v, 0.03); }); rauschen(z, t + 0.02, 'bandpass', 2000, 0.3 * v, 0.12); break;
        case 'CH': metall(z, t, 0.04 * v, 0.03); rauschen(z, t, 'highpass', 9000, 0.2 * v, 0.03); break;
        case 'OH': metall(z, t, 0.035 * v, 0.22); rauschen(z, t, 'highpass', 8500, 0.16 * v, 0.22); break;
        case 'LT': osz(z, t, 'sawtooth', 140, 70, 0.22 * v, 0.2); break;
        case 'HT': osz(z, t, 'sawtooth', 240, 140, 0.2 * v, 0.15); break;
        case 'RS': osz(z, t, 'square', 2600, 2500, 0.1 * v, 0.02); break;
      }
    }
    function note(m, i) { return m.def.klang === '808' ? 36 + m.def.instr[i][1] : m.def.instr[i][1]; }
    function klickTon(t, eins) { osz(m1.kette, t, 'sine', eins ? 1800 : 1200, eins ? 1800 : 1200, 0.18, 0.04); }

    // ---- EQ setzen + Kurve (RBJ-Glocke, gleich wie Biquad.glocke in der App) ----
    var kippEq = 0, balBew = 0;
    // Band i mit Bewegung: Kippen hebt die Höhen und senkt die Tiefen (oder umgekehrt), ±6 dB an den Rändern
    function eqDb(i) { return klemm(db[i] + kippEq * (i - 3.5) / 3.5, -18, 18); }
    function eqSetz() {
      regler.forEach(function (r, i) { setz(dbZ[i], (db[i] > 0 ? '+' : '') + String(db[i]).replace('.', ',')); });
      if (ctx) {
        var t = ctx.currentTime;
        eqB.forEach(function (b, i) { b.gain.setTargetAtTime(eqDb(i), t, 0.04); });
        if (pan.pan) pan.pan.setTargetAtTime(klemm(balance + balBew, -1, 1), t, 0.04);
      }
      kurveZeichnen();
    }
    function glockeDb(f, f0, g) {
      var sr = 48000, A = Math.pow(10, g / 40), w0 = 2 * Math.PI * f0 / sr, al = Math.sin(w0) / (2 * EQ_Q), cw = Math.cos(w0);
      var b0 = 1 + al * A, b1 = -2 * cw, b2 = 1 - al * A, a0 = 1 + al / A, a1 = -2 * cw, a2 = 1 - al / A;
      var w = 2 * Math.PI * f / sr, c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
      var nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2), dr = a0 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
      return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
    }
    function kurveZeichnen() {
      if (!kurve.offsetParent) return;
      var dpr = window.devicePixelRatio || 1, w = kurve.clientWidth, h = kurve.clientHeight;
      if (kurve.width !== Math.round(w * dpr)) { kurve.width = Math.round(w * dpr); kurve.height = Math.round(h * dpr); }
      var g = kurve.getContext('2d'), cs = getComputedStyle(kurve);
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      g.strokeStyle = cs.getPropertyValue('--mf-linie') || '#555'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      g.strokeStyle = cs.getPropertyValue('--mf-gelb') || '#E8C547'; g.lineWidth = 2; g.beginPath();
      for (var x = 0; x <= w; x += 2) {
        var f = 30 * Math.pow(20000 / 30, x / w), s = 0;
        for (var i = 0; i < FREQ.length; i++) { var gi = eqDb(i); if (gi) s += glockeDb(f, FREQ[i], gi); }
        var y = h / 2 - klemm(s, -15, 15) / 15 * (h / 2 - 3);
        x ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }

    // ---- Looper-Spuren ----
    var spuren = [], wahl = 'auto', liveSpur = -1;
    // auf = laufende Aufnahme: { phase: 'warte' | 'vor' | 'auf', rest (Vorlauf-Takte), takte (Muster aller Module je Takt), n (Schritte), start, stopp }
    var auf = null;
    function spurNeu() {
      var s = { buf: null, bpm: bpm, stumm: false, pegel: 0.9, g: null, q: null };
      var z = el('div', 'mf-spurzeile'), nm = el('span', 'mf-spurname'); wort(nm, 'Spur'); var nr = el('span'); nm.appendChild(document.createTextNode(' ')); nm.appendChild(nr);
      var welle = el('canvas', 'mf-welle'), st = el('span', 'mf-spurstand'), m = knopf('M', 'mf-m'), pg = el('input'), weg = knopf('⌫', 'mf-weg');
      m.setAttribute('aria-pressed', 'false'); m.setAttribute('aria-label', 'Stumm schalten'); weg.setAttribute('aria-label', 'Spur löschen');
      pg.type = 'range'; pg.min = '0'; pg.max = '1.2'; pg.step = '0.05'; pg.value = String(s.pegel); pg.setAttribute('aria-label', 'Pegel');
      [nm, welle, st, m, pg, weg].forEach(function (e) { z.appendChild(e); });
      m.addEventListener('click', function () { s.stumm = !s.stumm; m.setAttribute('aria-pressed', s.stumm ? 'true' : 'false'); spurPegel(s); });
      pg.addEventListener('input', function () { s.pegel = Number(pg.value); spurPegel(s); });
      weg.addEventListener('click', function () { spurLeeren(spuren.indexOf(s)); });
      var stW = el('span'), stZ = el('span'); st.appendChild(stW); st.appendChild(stZ);
      s.z = z; s.nr = nr; s.welle = welle; s.st = st; s.stW = stW; s.stZ = stZ;
      spuren.push(s); looper.appendChild(z); if (ctx) spurAnschliessen(s);
      return s;
    }
    function spurAnschliessen(s) { if (s.g) return; s.g = ctx.createGain(); s.g.connect(loopBus); spurPegel(s); }
    function spurPegel(s) {
      if (!s.g) return;
      var live = spuren.indexOf(s) === liveSpur;
      s.g.gain.setTargetAtTime(s.stumm || live ? 0 : s.pegel, ctx.currentTime, 0.02);
    }
    function spurHalt(s) { if (s.q) { try { s.q.stop(); } catch (x) { } s.q.disconnect(); s.q = null; } }
    function spurLeeren(i) {
      var s = spuren[i]; if (!s) return;
      if (i === liveSpur) { liveSpur = -1; auf = null; loopAnzeige(); }
      spurHalt(s); s.buf = null; spurenZeigen(); logZeile('Spur ' + (i + 1) + ' gelöscht', true);
    }
    function welleZeichnen(s) {
      var c = s.welle, dpr = window.devicePixelRatio || 1, w = c.clientWidth || 120, h = c.clientHeight || 24;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      if (!s.buf) return;
      var d = s.buf.getChannelData(0), schritt = Math.max(1, Math.floor(d.length / w));
      g.fillStyle = getComputedStyle(c).getPropertyValue('--mf-purpur') || '#C8479A';
      for (var x = 0; x < w; x++) {
        var m = 0; for (var k = x * schritt, e = Math.min(d.length, k + schritt); k < e; k += 4) { var a = Math.abs(d[k]); if (a > m) m = a; }
        var hh = Math.max(1, Math.min(1, m) * (h - 2)); g.fillRect(x, (h - hh) / 2, 1, hh);
      }
    }
    function spurenZeigen() {
      spuren.forEach(function (s, i) {
        setz(s.nr, String(i + 1));
        var live = i === liveSpur;
        s.z.classList.toggle('live', live);
        if (!live) { setz(s.stW, s.buf ? (spielt ? 'spielt' : 'bereit') : 'leer'); setz(s.stZ, ''); }
        else if (!auf) { setz(s.stW, 'rechnet'); setz(s.stZ, ''); }
        welleZeichnen(s); if (ctx) spurPegel(s);
      });
      dazuK.disabled = spuren.length >= 8;
      // Spurwahl: Auto · 1 · 2 · … (passt sich der Spurenzahl an)
      wahlZeile.textContent = '';
      ['auto'].concat(spuren.map(function (s, i) { return i; })).forEach(function (w) {
        var b = knopf(w === 'auto' ? 'Auto' : String(w + 1)); b.setAttribute('aria-pressed', w === wahl ? 'true' : 'false');
        b.addEventListener('click', function () { wahl = w; spurenZeigen(); wahlK.click(); });
        wahlZeile.appendChild(b);
      });
      setz(wahlZ, wahl === 'auto' ? 'Auto' : String(wahl + 1));
    }
    for (var sp0 = 0; sp0 < 4; sp0++) spurNeu();
    dazuK.addEventListener('click', function () { if (spuren.length < 8) { spurNeu(); spurenZeigen(); } });
    alleWegK.addEventListener('click', function () { for (var i = 0; i < spuren.length; i++) spurLeeren(i); });
    wahlK.addEventListener('click', function () { var auf = wahlZeile.hidden; wahlZeile.hidden = !auf; wahlK.setAttribute('aria-expanded', auf ? 'true' : 'false'); });

    // Die aufgenommene Runde offline rendern (takte = Muster aller Module je Takt, sek = Länge) – zweimal, die zweite bleibt
    // (der Echo-Schwanz der ersten läuft hinein, die Schleife ist nahtlos)
    function runde(takte, sek, pads) {
      var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!OAC || !ctx) return Promise.reject(new Error('kein Audio'));
      var d = 60 / bpm / 4, sr = ctx.sampleRate, n = Math.max(1, Math.round(sek * sr)), oc = new OAC(2, n * 2, sr);
      var L = Math.ceil(sek / d - 1e-6);
      // wie live: Kette → Mixer-Kanal (Fader, Panorama, stumm) → Summe; ● aus im Mixer = Quelle kommt nicht in die Runde
      var ketten = mods.map(function (m, i) { return ketteBauen(oc, mixKanal(oc, Math.min(i, 1), oc.destination), ketteWerte(m.kette)); });
      var nimm = function (i) { var c = mix[i]; return c.rec && !c.stumm; };
      if (!nimm(2)) pads = [];
      // Pads (Karte „Drum & 808“) gehen wie live an Filter und Echo vorbei über ihren Kanal in die Summe
      var padZiel = oc.createGain(); padZiel.connect(mixKanal(oc, 2, oc.destination));
      if (d808() && typeof d808().padLaut === 'function') padZiel.gain.value = d808().padLaut();   // Lautstärke der Pads
      var sw = swing(), ev = [];
      for (var r = 0; r < 2; r++) {
        for (var k = 0; k < L; k++) {
          var s = k % 16, tk = takte[Math.min(Math.floor(k / 16), takte.length - 1)];
          var t = r * n / sr + k * d + (s % 2 ? sw * d : 0);
          if (t >= (r + 1) * n / sr) continue;   // was nach dem Ende der Runde käme, fällt weg (Raster aus)
          mods.forEach(function (m, mi) { if (!nimm(Math.min(mi, 1))) return; var mu = tk[mi]; for (var i = 0; i < m.def.instr.length; i++) if (mu[i][s]) ev.push({ t: t, m: mi, i: i, v: s % 4 === 0 ? 1 : 0.82 }); });
        }
        (pads || []).forEach(function (p) { if (p.dt < sek) ev.push({ t: r * n / sr + p.dt, pad: p.i, v: p.vel }); });
      }
      // nach Zeit geordnet planen – die 808-Stimmen sind einstimmig, ein späterer Anschlag darf keinen früheren abwürgen
      ev.sort(function (a, b) { return a.t - b.t; });
      ev.forEach(function (x) {
        if (x.pad == null) ton(mods[x.m], x.i, x.t, x.v, ketten[x.m], mods[x.m].ton);
        else if (d808()) satz808().spielen(oc, padZiel, x.pad, x.t, x.v);
      });
      var fertig = oc.startRendering();
      if (!fertig || !fertig.then) fertig = new Promise(function (ok) { oc.oncomplete = function (ev) { ok(ev.renderedBuffer); }; });
      return fertig.then(function (b) {
        var aus = ctx.createBuffer(2, n, sr);
        for (var ch = 0; ch < 2; ch++) aus.getChannelData(ch).set(b.getChannelData(Math.min(ch, b.numberOfChannels - 1)).subarray(n, 2 * n));
        return aus;
      });
    }
    function loopAnzeige() {
      var an = liveSpur >= 0;
      loopK.setAttribute('aria-pressed', an ? 'true' : 'false'); setz(loopK, an ? '■ Loop' : '● Loop');
      spurenZeigen();
    }
    function kopie() { return mods.map(function (m) { return m.muster.map(function (z) { return z.slice(); }); }); }
    function schrittDauer() { return 60 / bpm / 4; }
    function loopTippen() {
      if (liveSpur < 0) {
        var ziel = wahl === 'auto' ? spuren.findIndex(function (s) { return !s.buf; }) : wahl;
        if (ziel < 0) { logZeile('Alle Spuren voll – eine löschen oder + Spur.', true); return; }
        // erst scharf machen, dann starten – so beginnt die Aufnahme (oder der Vorlauf) schon auf der allerersten Eins
        liveSpur = ziel; spurHalt(spuren[ziel]);
        auf = { phase: 'warte', rest: vorlauf, takte: [], pads: [], n: 0, start: 0, stopp: false };
        if (!spielt) start();
        if (!ctx) { liveSpur = -1; auf = null; loopAnzeige(); return; }
        loopAnzeige(); uhrZeigen();
        logZeile('● Loop → Spur ' + (ziel + 1) + ' · intern · wartet auf die Eins', true);
      } else if (!auf) {
        return;                                   // Runde wird gerade gerechnet
      } else if (auf.phase !== 'auf') {
        logZeile('● Loop abgebrochen (Spur ' + (liveSpur + 1) + ')', true);
        liveSpur = -1; auf = null; loopAnzeige(); uhrZeigen();
      } else if (laenge === 0 && rasterArt === 'aus') {
        aufEnde(Math.max(schrittDauer(), ctx.currentTime - auf.start));   // ohne Raster: genau jetzt
      } else {
        auf.stopp = true; uhrZeigen();          // endet auf dem nächsten Schlag/Takt (planen)
      }
    }
    // Wird für jeden geplanten Schritt aufgerufen (t = Zeit ohne Swing, s = Schritt 0–15).
    function aufSchritt(t, s) {
      if (!auf) return;
      if (auf.phase !== 'auf') {
        if (s !== 0) return;
        if (auf.rest > 0) { auf.phase = 'vor'; auf.rest--; auf.vorT = t; return; }   // ein Takt Vorlauf
        auf.phase = 'auf'; auf.start = t; auf.n = 0; auf.takte = []; auf.pads = [];
      }
      var n = auf.n, ende = false;
      if (n > 0) {
        if (laenge > 0) ende = n >= laenge * 16;
        else if (auf.stopp) ende = rasterArt === 'takt' ? s === 0 : s % 4 === 0;
        else ende = n >= 16 * 16;                 // Frei höchstens 16 Takte
      }
      if (ende) { aufEnde(n * schrittDauer()); return; }
      if (s === 0 || n === 0) auf.takte.push(kopie());
      auf.n++;
    }
    function aufEnde(sek) {
      var i = liveSpur, s = spuren[i], takte = auf.takte.length ? auf.takte : [kopie()], pads = auf.pads;
      auf = null; spurenZeigen(); uhrZeigen();
      runde(takte, sek, pads).then(function (b) {
        if (liveSpur !== i) return;               // inzwischen gelöscht
        s.buf = b; s.bpm = bpm; spurHalt(s); liveSpur = -1;
        loopAnzeige(); logZeile('Loop auf Spur ' + (i + 1) + ' · ' + b.duration.toFixed(2) + ' s · ' + takte.length + ' Takt(e)' + (pads.length ? ' · ' + pads.length + ' Pads' : ''), true);
      }).catch(function () { liveSpur = -1; loopAnzeige(); });
    }
    // ◷ Uhr: Ring = Fortschritt der Runde, in der Spur „Vorlauf 2“ / „● Takt 2/4“
    function uhrZeigen() {
      var p = 0, s = liveSpur >= 0 ? spuren[liveSpur] : null, tk = 16 * schrittDauer();
      if (ctx && auf && auf.phase === 'auf') {
        var tl = Math.max(0, ctx.currentTime - auf.start) / tk, nr = Math.floor(tl) + 1;
        p = laenge ? Math.min(1, tl / laenge) : tl % 1;
        if (s) { setz(s.stW, auf.stopp ? '● endet' : '● Takt'); setz(s.stZ, ' ' + (laenge ? Math.min(nr, laenge) + '/' + laenge : nr)); }
      } else if (ctx && auf && auf.phase === 'vor') {
        p = Math.max(0, ctx.currentTime - auf.vorT) / tk % 1;
        if (s) { setz(s.stW, 'Vorlauf'); setz(s.stZ, ' ' + (auf.rest + 1)); }
      } else if (auf) {
        if (s) { setz(s.stW, 'wartet auf die Eins'); setz(s.stZ, ''); }
      } else if (spielt && jetztS >= 0) p = (jetztS + 1) / 16;
      ring.style.setProperty('--p', p.toFixed(3));
      qK.classList.toggle('live', !!auf);
    }
    loopK.addEventListener('click', loopTippen);
    // auf jeder Eins: Spuren mit Loop, die noch nicht laufen, mitstarten (Tempo folgt dem BPM wie in der App)
    function spurenAufEins(t) {
      spuren.forEach(function (s, i) {
        if (!s.buf || s.q || i === liveSpur) return;
        spurAnschliessen(s);
        var q = ctx.createBufferSource(); q.buffer = s.buf; q.loop = true; q.playbackRate.value = bpm / s.bpm;
        q.connect(s.g); q.start(t); s.q = q;
      });
    }

    // ---- Bewegung → Klang (direkt vom Handy, U0); in der Mitte klingt alles wie ohne Bewegung ----
    function swing() { return klemm(swingHand + Math.abs(m1.bw.s) * 0.5, 0, 0.6); }
    function formen() {
      m1.bw = m1.kopp.lesen(); m2.bw = m2.kopp.lesen(); fxNeigen();
      var bwLp = bewLp.lesen(), bwEq = bewEq.lesen();
      setz(swZ, Math.round(swing() * 100) + ' %');
      // EQ: Kippen = Klangwaage (Tiefen ↔ Höhen, ±6 dB), Schwenken = Balance
      var kn = Math.round(bwEq.k * 6 * 4) / 4, bn = Math.round(bwEq.s * 0.8 * 20) / 20;
      if (kn !== kippEq || bn !== balBew) { kippEq = kn; balBew = bn; eqSetz(); }
      // Mixer: Kippen = Überblenden Sequenzer ↔ TR 808, Schwenken = Panorama aller Kanäle
      var bwMix = bewMix.lesen(), xn = Math.round(bwMix.k * 20) / 20, pn = Math.round(bwMix.s * 0.8 * 20) / 20;
      if (xn !== mixXf || pn !== mixPanBew) { mixXf = xn; mixPanBew = pn; mixSetz(); }
      m2.ton = Math.round(m2.bw.d * 5 * 2) / 2;   // TR 808: Drehen → Ton ±5 Halbtöne (bei jedem Anschlag)
      if (!ctx) return;
      var t = ctx.currentTime, k1 = m1.kette, k2 = m2.kette;
      // Modul 1: Kippen → Filter, Drehen → Echo, Höhe → Lautstärke (Schwenken → Swing oben)
      k1.filt.frequency.setTargetAtTime(180 * Math.pow(12000 / 180, 1 - Math.abs(m1.bw.k) * 0.9), t, 0.05);
      k1.echoG.gain.setTargetAtTime(Math.abs(m1.bw.d) * 0.55, t, 0.08);
      k1.laut.gain.setTargetAtTime(klemm(0.75 + m1.bw.h * 0.25, 0, 1) * 0.95, t, 0.05);
      k1.echo.delayTime.setTargetAtTime(60 / bpm * 0.75, t, 0.1);
      // Modul 2: Kippen → Filter, Höhe → Lautstärke
      k2.filt.frequency.setTargetAtTime(180 * Math.pow(16000 / 180, 1 - Math.abs(m2.bw.k) * 0.9), t, 0.05);
      k2.laut.gain.setTargetAtTime(klemm(0.75 + m2.bw.h * 0.25, 0, 1) * 0.95, t, 0.05);
      // Looper: Kippen → Filter der Loops, Höhe → Pegel der Loops
      loopFilt.frequency.setTargetAtTime(200 * Math.pow(18000 / 200, 1 - Math.abs(bwLp.k) * 0.9), t, 0.05);
      loopBus.gain.setTargetAtTime(klemm(1 + bwLp.h * 0.6, 0, 1.6), t, 0.05);
    }

    // ---- Takt (vorausplanen, Lauflicht nach Gehör) ----
    function planen() {
      var dauer = 60 / bpm / 4;
      while (naechst < ctx.currentTime + 0.12) {
        var t = naechst + (schritt % 2 ? swing() * dauer : 0);
        if (schritt === 0) mods.forEach(function (m) { if (m.eins) m.eins(); });   // TR 808: Muster A → D wechseln vor der Aufnahme des Takts
        aufSchritt(naechst, schritt);
        if (schritt === 0 && lpAn) spurenAufEins(naechst);
        var noten = [];
        if (!nurLoop) mods.forEach(function (m) {
          for (var i = 0; i < m.def.instr.length; i++) if (m.muster[i][schritt]) { ton(m, i, t, schritt % 4 === 0 ? 1 : 0.82); noten.push(note(m, i)); }
        });
        if (((klick && !nurLoop) || (auf && auf.phase === 'vor')) && schritt % 4 === 0) klickTon(naechst, schritt === 0);   // Vorlauf zählt immer hörbar ein
        warte.push({ s: schritt, t: t, n: noten, b: mods.map(function (m) { return m.bank; }) });
        naechst += dauer; schritt = (schritt + 1) % 16;
      }
    }
    function lichtAus() { if (jetztS >= 0) mods.forEach(function (m) { m.zellen.forEach(function (r) { if (r[jetztS]) r[jetztS].classList.remove('jetzt'); }); if (m.aus) m.aus(); }); }
    function lauflicht() {
      if (!spielt) return;
      while (warte.length && warte[0].t <= ctx.currentTime) {
        var w = warte.shift();
        lichtAus();
        jetztS = w.s; if (!nurLoop) mods.forEach(function (m, mi) { if (m.jetzt) m.jetzt(w.s, w.b[mi]); m.zellen.forEach(function (r) { if (r[jetztS]) r[jetztS].classList.add('jetzt'); }); });
        punkte.forEach(function (p, k) { p.classList.toggle('an', k === w.s); p.classList.toggle('takt', k === w.s - w.s % 4); });
        if (w.n.length) logZeile('Note ' + w.n.join(' ') + '  · Kanal 10', true);
      }
      uhrZeigen();
      requestAnimationFrame(lauflicht);
    }
    function start() {
      audio(); if (!ctx) return;
      spielt = true; schritt = 0; warte = []; naechst = ctx.currentTime + 0.06;
      mods.forEach(function (m) { if (m.start) m.start(); });
      startZeigen();
      logZeile('MIDI-Clock Start · ' + bpm + ' BPM', true);
      fxTakt(naechst);   // Takt-Effekte auf die Eins
      timer = setInterval(function () { formen(); planen(); }, 25); planen(); requestAnimationFrame(lauflicht);
      spurenZeigen();
    }
    function stopp() {
      if (!spielt) return;
      // laufende Aufnahme: bis zum Raster aufgerundet behalten, Warten/Vorlauf abbrechen
      if (auf && auf.phase === 'auf' && auf.n > 0) {
        var g = laenge ? laenge * 16 : rasterArt === 'takt' ? 16 : rasterArt === 'schlag' ? 4 : 1;
        aufEnde(Math.ceil(auf.n / g) * g * schrittDauer());
      } else if (auf) { liveSpur = -1; auf = null; loopAnzeige(); }
      spielt = false; nurLoop = false; clearInterval(timer); timer = null; warte = [];
      spuren.forEach(spurHalt); spurenZeigen();
      startZeigen();
      lichtAus();
      punkte.forEach(function (p) { p.classList.remove('an', 'takt'); }); jetztS = -1; uhrZeigen();
      logZeile('MIDI-Clock Stopp', true);
    }
    function bpmSetz(v) {
      bpm = klemm(v, 60, 180); setz(bpmZ, String(bpm)); fxTakt();
      spuren.forEach(function (s) { if (s.q) s.q.playbackRate.setTargetAtTime(bpm / s.bpm, ctx.currentTime, 0.05); });
    }
    bpmMinus.addEventListener('click', function () { bpmSetz(bpm - 2); }); bpmPlus.addEventListener('click', function () { bpmSetz(bpm + 2); });
    swMinus.addEventListener('click', function () { swingHand = klemm(Math.round((swingHand - 0.05) * 100) / 100, 0, 0.6); formen(); });
    swPlus.addEventListener('click', function () { swingHand = klemm(Math.round((swingHand + 0.05) * 100) / 100, 0, 0.6); formen(); });
    uhr.addEventListener('click', function () { klick = !klick; uhr.setAttribute('aria-pressed', klick ? 'true' : 'false'); });
    // ---- Karte „Drum & 808“ anschliessen: Pads klingen in die Summe (vor EQ), ● Loop nimmt die Anschläge mit ----
    function drumAnschliessen() {
      var D = d808(); if (!D) return;
      D.ausgang = function () { audio(); return ctx ? { ctx: ctx, ein: mix[2].g || summe } : null; };   // Kanal „Drum Pads“ im Mixer
      D.angeschlagen = function (i, vel) {
        if (!ctx || !auf || auf.phase !== 'auf') return;
        var dt = ctx.currentTime - auf.start;   // auf.start liegt bis 0,12 s voraus (geplant) – knapp davor zählt als Eins
        if (dt > -0.08) auf.pads.push({ i: i, vel: vel, dt: Math.max(0, dt) });
      };
      if (ctx) satz808().vorbereiten(ctx);
    }
    drumAnschliessen();
    document.addEventListener('caelum-modul', function (e) { if (e.detail === 'drum808') drumAnschliessen(); });
    bpmSetz(bpm); formen(); eqSetz(); spurenZeigen(); qZeigen(); uhrZeigen();
    setInterval(function () { if (!spielt && platz.offsetParent) formen(); }, 100);   // Balken auch im Stand
    // U2: jede Karte klappt auf/zu – Sequenzer, TR 808 und Looper offen, EQ zu (keine Informationsflut)
    BEW.aufklappen(m1.karte, true); BEW.aufklappen(m2.karte, true);
    BEW.aufklappen(lpKarte, true, function (an) { if (an) requestAnimationFrame(spurenZeigen); });
    BEW.aufklappen(fxKarte, true);
    BEW.aufklappen(mixKarte, true);
    BEW.aufklappen(eqKarte, false, function (an) { if (an) requestAnimationFrame(kurveZeichnen); });
    ankerAuf();
    return { stopp: stopp, spielt: function () { return spielt; }, bank: function (b) { mixBankSetzen(b, false); }, beiBank: function (f) { mixBeiBank = f; } };
  }

  function start(platz) {
    // 25.11.2026 (Kenny): das Motion-Fenster ist die erste Einstellung – es steht oben im Block „Caelum Motion im Browser“
    // (nach Titel + Text, vor Synth/Datei/Live-Musik); die Module (Sequenzer, TR 808 …) bleiben hier unten.
    var oben = el('div', 'mf-block mf-oben'); oben.id = 'motion-fenster';
    var block = el('div', 'mf-block');
    oben.appendChild(el('h3', 'mf-ueber', 'Motion-Fenster: was in Ableton ankommt'));
    oben.appendChild(el('p', 'mf-einleitung','So sieht es am PC aus, wenn das Handy mit Caelum Motion verbunden ist: links das Handy mit der App, rechts die echten Sensorwerte und die MIDI-Regler, die Ableton bekommt. Pad halten und bewegen – nur das gehaltene Pad ändert seinen Wert.'));

    // ---------- Leiste: Handy-Sensoren · Sequenzer (fährt aus) ----------
    // Leiste: Handy-Sensoren · Sprung zum Sequenzer (die Module stehen als eigene Karten unter dem Fenster, U1)
    var leiste = el('div', 'mf-leiste'), sensGross = knopf('Handy-Sensoren einschalten', 'gross'), seqK = knopf('Sequenzer ↓');
    sensGross.setAttribute('aria-pressed', 'false');
    leiste.appendChild(sensGross); leiste.appendChild(seqK);
    var sensInfo = el('span', 'mf-hinweis', 'Am Handy: einschalten und erlauben – dann bewegt das echte Handy alles.'); leiste.appendChild(sensInfo);
    oben.appendChild(leiste);

    var fenster = el('div', 'mf');
    // ---------- links: Handy ----------
    var buehne = el('div', 'mf-buehne'), handy = el('div', 'mf-handy'), app = el('div', 'mf-app');
    buehne.setAttribute('role', 'application'); buehne.setAttribute('aria-label', 'Handy-Nachbildung: ziehen = kippen und neigen, Mausrad = schwenken');
    app.appendChild(el('div', 'mf-titel', 'Caelum Motion'));
    var status = el('div', 'mf-status', 'Beispiel läuft'); app.appendChild(status);
    var baenke = el('div', 'mf-baenke'), bankK = [];
    BANK.forEach(function (n, i) { var b = knopf(); wort(b, 'Bank'); b.appendChild(document.createTextNode(' ' + n)); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); b.addEventListener('click', function () { bankWahl(i, true); }); bankK.push(b); baenke.appendChild(b); });
    app.appendChild(baenke);
    var pads = el('div', 'mf-pads'), padK = [];
    for (var i = 0; i < 4; i++) (function (i) {
      var p = knopf(''), tag = el('span', 'mf-tag'), ach = el('b', null, ACHSE[i]), cc = el('span', 'mf-cc'), sp = el('span', 'mf-spur'), vo = el('i');
      sp.appendChild(vo); p.appendChild(tag); p.appendChild(ach); p.appendChild(cc); p.appendChild(sp);
      p.setAttribute('aria-pressed', 'false');   // Name = sichtbarer Inhalt (A1 Schwenken CC 20), kein aria-label (24.11.2026)
      function an(e) { e.preventDefault(); e.stopPropagation(); demoAus(); halte(i, true); try { p.setPointerCapture(e.pointerId); } catch (x) { } }
      function aus() { halte(i, false); }
      p.addEventListener('pointerdown', an); p.addEventListener('pointerup', aus); p.addEventListener('pointercancel', aus); p.addEventListener('lostpointercapture', aus);
      p.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); demoAus(); halte(i, true); } });
      p.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') halte(i, false); });
      padK.push({ k: p, tag: tag, cc: cc, voll: vo }); pads.appendChild(p);
    })(i);
    app.appendChild(pads);
    var gehaltenR = el('div', 'mf-gehalten'), gehaltenZ = el('span', null, '–'); wort(gehaltenR, 'Gehalten:'); gehaltenR.appendChild(document.createTextNode(' '));
    gehaltenR.appendChild(gehaltenZ); app.appendChild(gehaltenR);
    var unten = el('div', 'mf-unten'), mitteK = knopf('Mitte setzen'), seqApp = knopf('Sequenzer'), sensK = knopf('Sensoren');
    sensK.setAttribute('aria-pressed', 'false'); seqApp.setAttribute('aria-pressed', 'false');
    unten.appendChild(mitteK); unten.appendChild(seqApp); unten.appendChild(sensK); app.appendChild(unten);
    handy.appendChild(app); buehne.appendChild(handy);
    function winkelZeile(e) {   // „kippen 0.0°  neigen 0.0°  drehen 0.0°“ mit übersetzbaren Wörtern
      return ['kippen', 'neigen', 'drehen'].map(function (w, k) { if (k) e.appendChild(document.createTextNode('  ')); wort(e, w); var v = el('span'); e.appendChild(v); return v; });
    }
    // Hoch-/Querformat (25.11.2026): folgt dem echten Handy (quer gehalten = quer), der Knopf übersteuert; neue Seiten mit Tastatur hängen
    // ihren breiten Teil als .mf-breit in die App (siehe motion-fenster.css „Querformat“).
    var lagek = knopf('Querformat', 'mf-lagek'), querWahl = null, querMq = null;   // 25.11.: keine Automatik mehr (quer gehalten wurde das Bild XXL, Kenny)
    function querSetzen() {
      var q = querWahl != null ? querWahl : !!(querMq && querMq.matches);
      handy.classList.toggle('quer', q); lagek.setAttribute('aria-pressed', q ? 'true' : 'false');
    }
    lagek.addEventListener('click', function () { querWahl = !handy.classList.contains('quer'); querSetzen(); });
    if (querMq) { var mqNeu = function () { querWahl = null; querSetzen(); }; if (querMq.addEventListener) querMq.addEventListener('change', mqNeu); else if (querMq.addListener) querMq.addListener(mqNeu); }
    querSetzen(); buehne.appendChild(lagek);
    var lageZ = el('p', 'mf-lage'), lageW = winkelZeile(lageZ); buehne.appendChild(lageZ);
    var hilfe = el('p', 'mf-hilfe', 'Am PC: Handy ziehen = kippen/neigen · Mausrad auf dem Handy = schwenken · Umschalt+Rad = Höhe · Tasten 1–4 halten Pads');
    buehne.appendChild(hilfe);
    fenster.appendChild(buehne);

    // ---------- rechts: Daten ----------
    var daten = el('div', 'mf-daten');
    daten.appendChild(el('h3', null, 'Sensoren (vom Handy)'));
    var sens = el('div', 'mf-sens'), zeile = {};
    [['winkel', 'Winkel °'], ['gyro', 'gyro rad/s'], ['beschl', 'beschl m/s²'], ['schwer', 'schwer m/s²'], ['lage', 'lage w x y z'], ['hoehe', 'höhe m'], ['tasten', 'tasten'], ['gesten', 'gesten']]
      .forEach(function (p) { sens.appendChild(el('span', 'mf-k', p[1])); var v = el('code'); sens.appendChild(v); zeile[p[0]] = v; });
    var winkelW = winkelZeile(zeile.winkel), hoeheW = el('span'), hoeheS = el('span', null, '(geschätzt)');
    zeile.hoehe.appendChild(hoeheW); zeile.hoehe.appendChild(document.createTextNode('  ')); zeile.hoehe.appendChild(hoeheS);
    daten.appendChild(sens);
    daten.appendChild(el('h3', null, 'MIDI an Ableton (Kanal 1, CC 20–35)'));
    var midi = el('div', 'mf-midi'), balken = [];
    for (var b = 0; b < 4; b++) {
      var sp2 = el('div', 'mf-bank'), kopf = el('span', 'mf-bk'); wort(kopf, 'Bank'); kopf.appendChild(document.createTextNode(' ' + BANK[b])); sp2.appendChild(kopf); balken.push({ kopf: kopf, z: [] });
      for (var q = 0; q < 4; q++) {
        var r = el('div', 'mf-z'), n = el('span', 'mf-n', String(20 + b * 4 + q)), bk = el('span', 'mf-bal'), vi = el('i'), w = el('span', 'mf-w', '–');
        bk.appendChild(vi); r.appendChild(n); r.appendChild(bk); r.appendChild(w); sp2.appendChild(r); balken[b].z.push({ r: r, i: vi, w: w });
      }
      midi.appendChild(sp2);
    }
    daten.appendChild(midi);
    var log = el('div', 'mf-log'); log.setAttribute('aria-live', 'off'); daten.appendChild(log);
    daten.appendChild(el('p', 'mf-hilfe', 'Halten = Kupplung · Lautstärketasten = Bank. Im Browser wird nichts gesendet – in Ableton macht Caelum Motion genau diese Regler.'));
    fenster.appendChild(daten);
    oben.appendChild(fenster);
    var modulePlatz = el('div', 'mf-module'); block.appendChild(modulePlatz);
    platz.appendChild(oben); platz.appendChild(block);
    // nach oben in den Motion-Block, sobald dessen Reiter stehen (bereiche.json „zusammen“ baut beide Module gleichzeitig)
    (function obenSetzen() {
      function setzen() {
        var r = document.querySelector('#motion > .reiter'); if (!r) return false; r.parentNode.insertBefore(oben, r);
        // Sprungmarke ins Fenster (#motion-fenster …): bereich.js springt nur, wenn das Ziel noch im eigenen Abschnitt liegt
        var h = location.hash.slice(1), z = h && document.getElementById(decodeURIComponent(h));
        if (z && oben.contains(z)) setTimeout(function () { z.scrollIntoView({ block: 'start' }); }, 80);
        return true;
      }
      if (setzen()) return;
      var mo = new MutationObserver(function () { if (setzen()) mo.disconnect(); });
      mo.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
    })();

    // ---------- Zustand ----------
    var roh = { kip: 0, nei: 0, dre: 0, h: 0 }, mitte = { kip: 0, nei: 0, dre: 0, h: 0 };
    var bank = 0, gehalten = [false, false, false, false], cc = [], ccZeit = [], gesten = [];
    for (var c = 0; c < 16; c++) { cc.push(-1); ccZeit.push(0); }
    var quelle = 'demo', demoT = 0, letzt = null, gyro = [0, 0, 0], beschl = [0, 0, 0], lin = null, sichtbar = true;
    var basis = {};   // Achsenwert beim Einrasten der Kupplung (relativ weiterbewegen)

    function rel() { return { kip: klemm(roh.kip - mitte.kip, -90, 90), nei: klemm(roh.nei - mitte.nei, -90, 90), dre: wrap180(roh.dre - mitte.dre), h: roh.h - mitte.h }; }
    function achswert(a, i) {   // 0…127 je Achse
      var v = i === 0 ? a.dre / 90 : i === 1 ? a.kip / 60 : i === 2 ? a.nei / 60 : a.h / 0.5;
      return klemm(Math.round(63.5 + v * 63.5), 0, 127);
    }
    function geste(g) { gesten.push(g); if (gesten.length > 6) gesten.shift(); }
    function bankWahl(i, hand) { if (hand) demoAus(); bank = i; bankK.forEach(function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); }); gehalten = [false, false, false, false]; if (seq && seq.bank) seq.bank(i); }   // Mixer-Bank folgt (wie die App)
    function halte(i, an) {
      if (gehalten[i] === an) return; gehalten[i] = an;
      if (an) { var k = bank * 4 + i; basis[k] = { a: achswert(rel(), i), c: cc[k] < 0 ? achswert(rel(), i) : cc[k] }; if (quelle !== 'demo' && navigator.vibrate) try { navigator.vibrate(12); } catch (x) { } }
    }
    function demoAus() { if (quelle === 'demo') { quelle = 'maus'; gehalten = [false, false, false, false]; status.textContent = 'Maus · Handy ziehen'; } }

    // ---------- Maus / Finger am Handy ----------
    var zieh = null;
    buehne.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      demoAus(); if (quelle === 'sensor') return;
      zieh = { x: e.clientX, y: e.clientY, kip: roh.kip, nei: roh.nei }; try { buehne.setPointerCapture(e.pointerId); } catch (x) { }
    });
    buehne.addEventListener('pointermove', function (e) {
      if (!zieh) return;
      roh.nei = klemm(zieh.nei + (e.clientX - zieh.x) * 0.45, -90, 90);
      roh.kip = klemm(zieh.kip + (e.clientY - zieh.y) * 0.45, -90, 90);
    });
    function zEnde() { zieh = null; }
    buehne.addEventListener('pointerup', zEnde); buehne.addEventListener('pointercancel', zEnde);
    handy.addEventListener('wheel', function (e) {   // nur über dem Handy, damit die Seite sonst scrollt
      if (quelle === 'sensor') return;
      e.preventDefault(); demoAus();
      if (e.shiftKey) roh.h = klemm(roh.h - (e.deltaY || e.deltaX) * 0.0015, -0.6, 0.6);
      else roh.dre = wrap180(roh.dre + e.deltaY * 0.15);
    }, { passive: false });
    buehne.addEventListener('dblclick', function () { geste('tippen'); });
    block.addEventListener('keydown', function (e) {
      var n = '1234'.indexOf(e.key); if (n >= 0 && !e.repeat && !e.target.closest('input')) { demoAus(); halte(n, true); }
    });
    block.addEventListener('keyup', function (e) { var n = '1234'.indexOf(e.key); if (n >= 0) halte(n, false); });
    mitteK.addEventListener('click', function () { demoAus(); var a = roh; mitte = { kip: a.kip, nei: a.nei, dre: a.dre, h: a.h }; geste('mitte'); });

    // ---------- echte Sensoren ----------
    function orient(e) {
      if (e.beta == null) return;
      roh.kip = klemm(e.beta, -90, 90); roh.nei = klemm(e.gamma || 0, -90, 90); roh.dre = wrap180(-(e.alpha || 0));
      if (Math.abs(e.beta) > 150) geste('umdrehen');
    }
    var vz = 0, hz = 0, schuettelZ = 0;
    function bewegung(e) {
      var a = e.acceleration, g = e.accelerationIncludingGravity, r = e.rotationRate, dt = (e.interval || 16) / 1000;
      if (dt > 1) dt /= 1000;   // manche Geräte melden ms
      if (r && r.beta != null) gyro = [(r.beta || 0) * RAD, (r.gamma || 0) * RAD, (r.alpha || 0) * RAD];
      if (a && a.x != null) {
        lin = [a.x || 0, a.y || 0, a.z || 0];
        var m = Math.hypot(lin[0], lin[1], lin[2]), jetzt = performance.now();
        if (m > 14 && jetzt - schuettelZ > 800) { schuettelZ = jetzt; geste('schütteln'); }
        if (g && g.x != null) {   // Höhe grob: Beschleunigung entlang der Schwerkraft, zweimal aufintegriert mit Leck (nur Schätzung)
          var gm = Math.hypot(g.x, g.y, g.z) || 9.81, auf = (lin[0] * g.x + lin[1] * g.y + lin[2] * g.z) / gm;
          vz = (vz + auf * dt) * 0.96; hz = (hz + vz * dt) * 0.985; roh.h = klemm(hz, -0.6, 0.6);
        }
      }
    }
    function sensAnzeige(an) {   // beide Knöpfe (in der App und in der Leiste) zeigen denselben Stand
      sensK.setAttribute('aria-pressed', an ? 'true' : 'false'); sensGross.setAttribute('aria-pressed', an ? 'true' : 'false');
      setz(sensGross, an ? 'Handy-Sensoren ausschalten' : 'Handy-Sensoren einschalten');
    }
    function meld(s) { status.textContent = s; sensInfo.textContent = s; }
    function sensorSchalter() {
      if (quelle === 'sensor') { quelle = 'maus'; sensAnzeige(false); window.removeEventListener('deviceorientation', orient); window.removeEventListener('devicemotion', bewegung); status.textContent = 'Maus · Handy ziehen'; lin = null; return; }
      var D = window.DeviceOrientationEvent, M = window.DeviceMotionEvent;
      if (!D) { meld('Keine Sensoren in diesem Browser'); return; }
      if (!window.isSecureContext) { meld('Sensoren nur über https'); return; }
      function los() {
        demoAus(); quelle = 'sensor'; sensAnzeige(true); meld('Sensoren · Handy bewegen');
        window.addEventListener('deviceorientation', orient); window.addEventListener('devicemotion', bewegung);
        setTimeout(function () { mitte = { kip: roh.kip, nei: roh.nei, dre: roh.dre, h: roh.h }; }, 300);
      }
      var bitten = [];
      if (typeof D.requestPermission === 'function') bitten.push(D.requestPermission());
      if (M && typeof M.requestPermission === 'function') bitten.push(M.requestPermission());
      if (!bitten.length) return los();
      Promise.all(bitten).then(function (r) { if (r[0] === 'granted') los(); else meld('Sensoren nicht erlaubt'); })
        .catch(function () { meld('Sensoren nicht erlaubt'); });
    }
    sensK.addEventListener('click', sensorSchalter); sensGross.addEventListener('click', sensorSchalter);

    // ---------- Beispiel (läuft, bis jemand übernimmt) ----------
    function demo(t) {
      roh.kip = Math.sin(t * 0.7) * 28; roh.nei = Math.sin(t * 0.45 + 1) * 34; roh.dre = Math.sin(t * 0.3) * 50; roh.h = Math.sin(t * 0.9) * 0.25;
      var takt = Math.floor(t / 2.2), schritt = takt % 6;
      var b = Math.floor(takt / 6) % 2;
      if (b !== bank) bankWahl(b, false);
      var soll = [schritt === 0 || schritt === 4, schritt === 1 || schritt === 4, schritt === 2, schritt === 3 || schritt === 5];
      for (var i = 0; i < 4; i++) halte(i, soll[i]);
      if (schritt === 5 && t % 2.2 < 0.03) geste('schütteln');
    }

    // ---------- Takt ----------
    function rechnen(t) {
      if (quelle === 'demo') demo(t / 1000);
      var a = rel();
      // gyro aus der Winkeländerung, wenn das Gerät keine eigene Rate liefert
      if (letzt && quelle !== 'sensor') {
        var dt = Math.max(0.001, (t - letzt.t) / 1000);
        gyro = [(a.kip - letzt.kip) * RAD / dt, (a.nei - letzt.nei) * RAD / dt, wrap180(a.dre - letzt.dre) * RAD / dt].map(function (v, k) { return gyro[k] * 0.8 + v * 0.2; });
      }
      letzt = { t: t, kip: a.kip, nei: a.nei, dre: a.dre };
      var q = quat(a.kip, a.nei, a.dre);
      var schwer = [9.81 * Math.sin(a.nei * RAD) * Math.cos(a.kip * RAD) * -1, 9.81 * Math.sin(a.kip * RAD), 9.81 * Math.cos(a.kip * RAD) * Math.cos(a.nei * RAD)];
      beschl = lin ? lin : [gyro[1] * 0.4, gyro[0] * 0.4, 0];
      var jetzt = performance.now();
      for (var i = 0; i < 4; i++) {
        if (!gehalten[i]) continue;
        var k = bank * 4 + i, w = achswert(a, i), bs = basis[k] || { a: w, c: w };
        var neu = klemm(bs.c + (w - bs.a), 0, 127);
        if (neu !== cc[k]) { cc[k] = neu; ccZeit[k] = jetzt; logZeile('CC ' + (20 + k) + ' = ' + neu); }
      }
      return { a: a, q: q, schwer: schwer, jetzt: jetzt };
    }
    var logZ = [], logLetzt = 0;
    function logZeile(s, immer) { var j = performance.now(); if (!immer && j - logLetzt < 90) return; logLetzt = j; logZ.push(s); if (logZ.length > 4) logZ.shift(); log.textContent = logZ.join('\n'); }

    // ---------- Sequenzer (wie die Motion-App 0.9.0: Lauflicht + Matrix, ▶ · BPM · Clock-Punkte · Swing) ----------
    var seq = sequenzer(modulePlatz, logZeile);
    seq.beiBank(function (b) { bankWahl(b, true); });   // Bank im Mixer = Bank am Handy
    function zumSequenzer() { var z = document.getElementById('mf-sequenzer'); if (z) { if (z._klapp) z._klapp.auf(); z.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }
    seqK.addEventListener('click', zumSequenzer); seqApp.addEventListener('click', zumSequenzer);

    function zeigen(r) {
      var a = r.a;
      handy.style.transform = 'rotateX(' + (-a.kip * 0.8).toFixed(1) + 'deg) rotateY(' + (a.nei * 0.8).toFixed(1) + 'deg) rotateZ(' + (-a.dre * (handy.classList.contains('quer') ? 0.25 : 0.5)).toFixed(1) + 'deg) translateY(' + (-a.h * 60).toFixed(1) + 'px)';
      [a.kip, a.nei, a.dre].forEach(function (v, k) { setz(lageW[k], ' ' + v.toFixed(1) + '°'); setz(winkelW[k], f(v, 1)); });
      var tasten = [];
      padK.forEach(function (p, i) {
        var k = bank * 4 + i, an = gehalten[i];
        if (an) tasten.push(BANK[bank] + (i + 1));
        setz(p.tag, BANK[bank] + (i + 1)); setz(p.cc, an ? 'gehalten' : 'CC ' + (20 + k));
        p.k.setAttribute('aria-pressed', an ? 'true' : 'false');
        p.voll.style.width = (cc[k] < 0 ? 0 : cc[k] / 127 * 100) + '%';
      });
      setz(gehaltenZ, tasten.length ? tasten.join(' ') : '–');
      setz(zeile.gyro, gyro.map(function (v) { return f(v); }).join(' '));
      setz(zeile.beschl, beschl.map(function (v) { return f(v); }).join(' '));
      setz(zeile.schwer, r.schwer.map(function (v) { return f(v); }).join(' '));
      setz(zeile.lage, r.q.map(function (v) { return f(v, 3); }).join(' '));
      setz(hoeheW, f(a.h, 3)); hoeheS.hidden = quelle !== 'sensor';
      setz(zeile.tasten, tasten.length ? tasten.join(' ') : '–');
      var gs = gesten.slice(-4).reverse(), gk = gs.join('|');
      if (zeile.gesten._g !== gk) {   // jede Geste ein eigenes Wort (übersetzbar)
        zeile.gesten._g = gk; zeile.gesten.textContent = gs.length ? '' : '–';
        gs.forEach(function (g, k) { if (k) zeile.gesten.appendChild(document.createTextNode('  ')); wort(zeile.gesten, g); });
      }
      balken.forEach(function (bk, b) {
        bk.kopf.classList.toggle('an', b === bank);
        bk.z.forEach(function (z, q2) {
          var k = b * 4 + q2, v = cc[k], frisch = r.jetzt - ccZeit[k] < 400;
          z.i.style.width = (v < 0 ? 0 : v / 127 * 100) + '%'; setz(z.w, v < 0 ? '–' : String(v));
          z.r.classList.toggle('frisch', frisch);
        });
      });
    }

    if ('IntersectionObserver' in window) new IntersectionObserver(function (e) { sichtbar = e[0].isIntersecting; }).observe(oben);   // 25.11.: oben = Handy + Werte (block hat nur noch die Module)
    // Quelle für alle Module: immer rechnen (auch wenn das Handy-Bild weggescrollt ist), nur sichtbar zeichnen
    BEW.jetzt = function () {
      if (quelle === 'demo') return NULL_BEW;
      var a = rel();
      return { s: klemm(a.dre / 90, -1, 1), k: klemm(a.kip / 60, -1, 1), d: klemm(a.nei / 60, -1, 1), h: klemm(a.h / 0.5, -1, 1), aktiv: true, quelle: quelle };
    };
    function schleife(t) {
      // 24.11.2026 Leistung: das Beispiel rechnet nur, wenn man es sieht (BEW.jetzt liefert im Beispiel ohnehin die Mitte)
      if (!document.hidden && (sichtbar || quelle !== 'demo')) { var r = rechnen(t); if (sichtbar) zeigen(r); }
      else letzt = null;
      requestAnimationFrame(schleife);
    }
    requestAnimationFrame(schleife);
  }
  (window.CaelumModul = window.CaelumModul || {})['motion-fenster'] = start;
  document.dispatchEvent(new CustomEvent('caelum-modul', { detail: 'motion-fenster' }));
})();
