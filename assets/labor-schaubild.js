// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Labor: Schaubilder „Vom PC aufs Handy“ (WLAN-Debugging, Handy-Schnittstelle) und „Master und Arbeitsplatz“ (CAELUM Pandora, UAC)
// im Stil des Hydra-Schaubilds der Startseite: Caelum im Kreis in der Mitte, links und rechts je drei Knoten, laufende Linien.
// Darunter ein Schritt-Spieler: Schritt wählen oder abspielen → Linien leuchten, Terminal tippt die echten Befehle, Erklärung daneben.
// Beispielwerte (Adressen, Codes) sind erfunden; Befehle und Abläufe sind die, die Caelum Vision und Pandora wirklich nutzen.
// KI-Beitrag (Claude, GB-7), 22.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sv(tag, attr) { var e = document.createElementNS(NS, tag); for (var k in attr) e.setAttribute(k, attr[k]); return e; }

  // ---- Lage der Knoten: breit (PC links, Handy rechts) und hoch (oben / unten) ----
  var LAGE = {
    breit: { w: 680, h: 330, kreis: [340, 168, 56], lbl: [[0, 14, ''], [680, 14, 'r']],
      links: [[0, 40], [0, 146], [0, 252]], rechts: [[510, 40], [510, 146], [510, 252]], nw: 170, nh: 44 },
    hoch: { w: 360, h: 430, kreis: [180, 216, 44], lbl: [[0, 14, ''], [0, 284, '']],
      links: [[0, 28], [190, 28], [95, 86]], rechts: [[95, 302], [0, 360], [190, 360]], nw: 170, nh: 44 }
  };

  function zeichne(spec, art) {
    var L = LAGE[art], s = sv('svg', { viewBox: '0 0 ' + L.w + ' ' + L.h, role: 'img', 'class': art, 'aria-label': spec.aria });
    var kx = L.kreis[0], ky = L.kreis[1], kr = L.kreis[2], teile = { kanten: {}, flows: {}, knoten: {} };
    var lb = [spec.lblLinks, spec.lblRechts];
    L.lbl.forEach(function (p, i) { var t = sv('text', { 'class': 'lbl' + (p[2] ? ' ' + p[2] : ''), x: p[0], y: p[1] }); t.textContent = lb[i]; s.appendChild(t); });
    var alle = spec.links.map(function (k, i) { return [k, L.links[i]]; }).concat(spec.rechts.map(function (k, i) { return [k, L.rechts[i]]; }));
    alle.forEach(function (a) {   // Kanten zuerst (Knoten liegen darüber)
      var k = a[0], x = a[1][0] + L.nw / 2, y = a[1][1] + L.nh / 2, dx = kx - x, dy = ky - y, d = Math.hypot(dx, dy) || 1;
      var ex = kx - dx / d * kr, ey = ky - dy / d * kr;
      var e = sv('line', { 'class': 'edge', x1: x, y1: y, x2: ex, y2: ey }), f = sv('line', { 'class': 'flow', x1: x, y1: y, x2: ex, y2: ey });
      f.style.stroke = k.c || '';
      s.appendChild(e); s.appendChild(f); teile.kanten[k.id] = e; teile.flows[k.id] = f;
    });
    var g = sv('g', { 'class': 'kreis' });
    g.appendChild(sv('circle', { 'class': 'ring', cx: kx, cy: ky, r: kr }));
    g.appendChild(sv('circle', { cx: kx, cy: ky, r: kr }));
    var t1 = sv('text', { x: kx, y: ky - 3 }); t1.textContent = 'Caelum'; g.appendChild(t1);
    var t2 = sv('text', { 'class': 'sub', x: kx, y: ky + 15 }); t2.textContent = spec.kreis; g.appendChild(t2);
    s.appendChild(g); teile.kreis = g;
    alle.forEach(function (a) {
      var k = a[0], x = a[1][0], y = a[1][1], n = sv('g', { 'class': 'node' + (k.app ? ' app' : '') });
      if (k.c) n.style.setProperty('--c', k.c);
      n.appendChild(sv('rect', { x: x, y: y, width: L.nw, height: L.nh, rx: 10 }));
      var a1 = sv('text', { x: x + L.nw / 2, y: y + 20 }); a1.textContent = k.t; n.appendChild(a1);
      var a2 = sv('text', { 'class': 'sub', x: x + L.nw / 2, y: y + 35 }); a2.textContent = k.sub; n.appendChild(a2);
      s.appendChild(n); teile.knoten[k.id] = n;
    });
    return { svg: s, teile: teile };
  }

  function baue(platz, spec) {
    var sec = el('div', 'schaubild-block');
    sec.appendChild(el('h2', null, spec.titel));
    sec.appendChild(el('p', 'lead', spec.lead));
    var box = el('div', 'sb'), b = zeichne(spec, 'breit'), h = zeichne(spec, 'hoch');
    box.appendChild(b.svg); box.appendChild(h.svg); sec.appendChild(box);

    var sp = el('div', 'spieler'), leiste = el('div', 'schritte'); leiste.setAttribute('role', 'group'); leiste.setAttribute('aria-label', 'Schritte');
    var knoepfe = spec.schritte.map(function (st, i) {
      var k = el('button'); k.type = 'button'; k.appendChild(el('b', null, String(i + 1))); k.appendChild(document.createTextNode(st.name));
      k.addEventListener('click', function () { selbst = true; auto(false); zeige(i); }); leiste.appendChild(k); return k;
    });
    var play = el('button', 'play'); play.type = 'button'; leiste.appendChild(play);
    sp.appendChild(leiste);

    var term = el('div', 'term'), tl = el('div', 'leiste');
    tl.appendChild(el('i')); tl.appendChild(el('i')); tl.appendChild(el('i')); tl.appendChild(el('span', null, spec.terminal));
    term.appendChild(tl);
    var pre = el('pre'); pre.setAttribute('aria-live', 'polite'); pre.setAttribute('translate', 'no'); term.appendChild(pre);
    var uac = el('div', 'uac');
    uac.innerHTML = '<svg viewBox="0 0 34 38" aria-hidden="true"><path d="M17 2 31 7v10c0 9-6 16-14 19C9 33 3 26 3 17V7z" fill="#E8C547"/><path d="M17 6v26c6-3 10-8 10-15V9.5z" fill="#1F1E1D" opacity=".25"/></svg>';
    var ut = el('div', 't'); ut.appendChild(el('b', null, 'Benutzerkontensteuerung')); ut.appendChild(el('small', null, 'Diese App möchte Änderungen am Gerät vornehmen.'));
    uac.appendChild(ut);
    var uk = el('div', 'k'); uk.appendChild(el('span', 'ja', 'Ja')); uk.appendChild(el('span', null, 'Nein')); uac.appendChild(uk);
    term.appendChild(uac);
    var erk = el('div', 'erklaer'), eh = el('h3'), ep = el('p'); erk.appendChild(eh); erk.appendChild(ep);
    sp.appendChild(term); sp.appendChild(erk); sec.appendChild(sp);
    platz.appendChild(sec);

    var jetzt = -1, laeuft = false, uhr = null, tipp = null, sichtbar = false, selbst = false;   // selbst = Nutzer hat gewählt → kein Selbststart
    function stopTipp() { if (tipp) { clearTimeout(tipp); tipp = null; } }
    function schreibe(zeilen, fertig) {
      stopTipp(); pre.textContent = '';
      var i = 0, cursor = el('span', 'cursor');
      function zeile() {
        if (i >= zeilen.length) { pre.appendChild(cursor); if (fertig) fertig(); return; }
        var z = zeilen[i++], art = z[0], text = z[1], span = el('span', art === 'o' ? null : art === 'uac' ? 'w' : art);
        pre.appendChild(span);
        if (art === 'uac') { span.textContent = text + '\n'; uac.classList.add('an'); tipp = setTimeout(function () { uac.classList.add('ok'); zeile(); }, ruhig ? 0 : 1200); return; }
        if (ruhig || art !== 'p') { span.textContent = text + '\n'; tipp = setTimeout(zeile, ruhig ? 0 : 260); return; }
        var n = 0; (function zeichen() { n++; span.textContent = text.slice(0, n); if (n < text.length) tipp = setTimeout(zeichen, 16); else { span.textContent += '\n'; tipp = setTimeout(zeile, 320); } })();
      }
      zeile();
    }
    function zeige(i) {
      jetzt = i; var st = spec.schritte[i];
      knoepfe.forEach(function (k, j) { if (j === i) k.setAttribute('aria-current', 'step'); else k.removeAttribute('aria-current'); });
      [b.teile, h.teile].forEach(function (T) {
        Object.keys(T.knoten).forEach(function (id) { T.knoten[id].classList.toggle('an', st.knoten.indexOf(id) >= 0); });
        Object.keys(T.flows).forEach(function (id) {
          var f = T.flows[id], w = st.wege.filter(function (x) { return x[0] === id; })[0];
          f.classList.toggle('an', !!w); f.classList.toggle('rueck', !!w && w[1] === 'her');
          T.kanten[id].style.stroke = w ? 'var(--sky)' : '';
        });
        T.kreis.classList.toggle('an', st.wege.length > 0);
      });
      eh.textContent = st.titel; ep.textContent = st.text;
      uac.classList.remove('an'); uac.classList.remove('ok');
      if (uhr) { clearTimeout(uhr); uhr = null; }
      schreibe(st.term, function () { if (laeuft) uhr = setTimeout(function () { zeige((jetzt + 1) % spec.schritte.length); }, 3400); });
    }
    function auto(an) {
      laeuft = an; play.textContent = an ? '❚❚ Anhalten' : '▶ Abspielen'; play.setAttribute('aria-pressed', an ? 'true' : 'false');
      if (!an && uhr) { clearTimeout(uhr); uhr = null; }
    }
    play.addEventListener('click', function () { selbst = true; auto(!laeuft); if (laeuft) zeige(jetzt < 0 ? 0 : (jetzt + 1) % spec.schritte.length); });
    auto(false); zeige(0);
    if ('IntersectionObserver' in window && !ruhig) {   // läuft von selbst, solange es zu sehen ist
      var gestartet = false;
      new IntersectionObserver(function (e) {
        sichtbar = e[0].isIntersecting;
        if (sichtbar && !gestartet && !selbst) { gestartet = true; auto(true); uhr = setTimeout(function () { zeige(1); }, 3400); }
        else if (!sichtbar && laeuft) auto(false);
      }, { threshold: 0.35 }).observe(box);
    }
  }

  // ---- Inhalt ----
  var WLAN = {
    titel: 'Vom PC aufs Handy – ohne Kabel',
    lead: 'So spricht Caelum Vision mit einem Android-Handy: über kabelloses Debugging im eigenen WLAN – oder über die Handy-Seite im Browser, ganz ohne Entwickleroptionen.',
    aria: 'Links der PC mit Caelum Vision, adb und eigener Zertifizierungsstelle, rechts das Android-Handy mit kabellosem Debugging, Bildschirm und Handy-Seite. In der Mitte Caelum im privaten WLAN.',
    lblLinks: 'PC · WINDOWS', lblRechts: 'HANDY · ANDROID', kreis: 'privates WLAN', terminal: 'PowerShell · Caelum Vision',
    links: [
      { id: 'vision', t: 'Caelum Vision', sub: 'Fenster · API', c: 'var(--c-vision)', app: true },
      { id: 'adb', t: 'adb', sub: 'Android Debug Bridge', c: 'var(--info)' },
      { id: 'ca', t: 'Lokal-CA', sub: 'eigenes Zertifikat', c: 'var(--sky)' }
    ],
    rechts: [
      { id: 'debug', t: 'Kabelloses Debugging', sub: 'Entwickleroptionen', c: 'var(--ok)' },
      { id: 'schirm', t: 'Bildschirm · Eingabe', sub: 'screencap · input', c: 'var(--ok)' },
      { id: 'seite', t: 'Handy-Seite', sub: 'Browser · HTTPS', c: 'var(--ok)' }
    ],
    schritte: [
      { name: 'Einschalten', titel: 'Das Handy meldet sich im WLAN', knoten: ['debug', 'adb'], wege: [['debug', 'hin'], ['adb', 'her']],
        text: 'Am Handy „Kabelloses Debugging“ einschalten. Es kündigt sich im eigenen Netz selbst an (mDNS) – kein Kabel, keine Zusatz-App.',
        term: [['k', '# Handy: Einstellungen › Entwickleroptionen › Kabelloses Debugging › an'], ['p', 'PS> adb mdns services'], ['o', 'List of discovered mdns services'], ['o', 'adb-7f3c…   _adb-tls-pairing._tcp   192.168.1.50:37123']] },
      { name: 'Koppeln', titel: 'Einmal koppeln, mit Code', knoten: ['adb', 'debug'], wege: [['adb', 'hin'], ['debug', 'her']],
        text: 'Das Handy zeigt einen 6-stelligen Code. Einmal eingeben – danach kennen sich PC und Handy, die Verbindung ist verschlüsselt.',
        term: [['p', 'PS> adb pair 192.168.1.50:37123 482913'], ['ok', 'Successfully paired to 192.168.1.50:37123 [guid=adb-7f3c…]']] },
      { name: 'Verbinden', titel: 'Verbinden – oder ehrlich melden', knoten: ['adb', 'debug', 'vision'], wege: [['adb', 'hin'], ['debug', 'her']],
        text: 'Vision verbindet sich mit der zuletzt bekannten Adresse. Ist Debugging am Handy aus, sagt Vision das sofort und zeigt den Weg zur Kachel.',
        term: [['p', 'PS> adb connect 192.168.1.50:43867'], ['ok', 'connected to 192.168.1.50:43867'], ['k', '# aus? → 10061 · Vision: „Kabelloses Debugging ist aus“']] },
      { name: 'Spiegeln', titel: 'Der Handy-Bildschirm am PC', knoten: ['schirm', 'vision'], wege: [['schirm', 'hin'], ['vision', 'her']],
        text: 'Ein einziger Strom von Bildschirmfotos, nur im Speicher. Ohne Zuschauer schaltet er nach 20 Sekunden selbst ab.',
        term: [['p', 'PS> adb exec-out "while true; do screencap -p; done"'], ['o', 'PNG 1080×2400 · IEND · PNG 1080×2400 · IEND …'], ['ok', '≈ 2,3 Bilder/s über WLAN']] },
      { name: 'Bedienen', titel: 'Klick am PC = Tippen am Handy', knoten: ['vision', 'schirm'], wege: [['vision', 'hin'], ['schirm', 'her']],
        text: 'Klicken tippt, Ziehen wischt, das Mausrad blättert, Rechtsklick geht zurück. Nur diese Eingaben sind erlaubt.',
        term: [['p', 'PS> adb shell input tap 540 1650'], ['p', 'PS> adb shell input swipe 540 1800 540 600 220'], ['p', 'PS> adb shell input keyevent BACK'], ['ok', '✓ 3 Eingaben']] },
      { name: 'Handy-Seite', titel: 'Ohne Entwickleroptionen: die Handy-Seite', knoten: ['ca', 'seite', 'vision'], wege: [['ca', 'hin'], ['seite', 'her'], ['vision', 'hin']],
        text: 'Das Handy öffnet die Handy-Seite im Browser und koppelt mit einem Code. Nur im privaten Netz oder über Tailscale, mit eigenem Zertifikat.',
        term: [['k', '# Handy-Browser → https://pc:36939/#code=482913'], ['o', 'TLS · Zertifikat der Caelum Lokal-CA'], ['ok', 'Kopplung ok · Geräteschlüssel gespeichert (nur SHA-256)'], ['o', 'POST /live  → Livebild am PC']] }
    ]
  };

  var MASTER = {
    titel: 'Master und Arbeitsplatz – CAELUM Pandora',
    lead: 'Wie unsere Zentrale einem Arbeitsplatz Aufträge gibt: unterschrieben, direkt von PC zu PC, und mit einem Menschen vor Ort, wenn Windows nach Adminrechten fragt.',
    aria: 'Links der Master mit CAELUM Pandora, Aufträgen und Updates, rechts der Arbeitsplatz mit Pandora, UAC und Antwort. In der Mitte Caelum mit Tailscale und Syncthing.',
    lblLinks: 'MASTER · ZENTRALE', lblRechts: 'ARBEITSPLATZ', kreis: 'Tailscale · Syncthing', terminal: 'PowerShell · CAELUM Pandora',
    links: [
      { id: 'zentrale', t: 'CAELUM Pandora', sub: 'Zentrale', c: 'var(--c-pandora)', app: true },
      { id: 'auftrag', t: 'Aufträge', sub: 'unterschrieben', c: 'var(--c-pandora)' },
      { id: 'update', t: 'Updates', sub: 'signiert · verteilt', c: 'var(--c-pandora)' }
    ],
    rechts: [
      { id: 'platz', t: 'CAELUM Pandora', sub: 'Arbeitsplatz', c: 'var(--c-pandora)', app: true },
      { id: 'uac', t: 'UAC', sub: 'Mensch bestätigt', c: '#E8C547' },
      { id: 'kopf', t: 'Antwort · Herzschlag', sub: 'Stand · Version', c: 'var(--info)' }
    ],
    schritte: [
      { name: 'Auftrag', titel: 'Der Master schreibt einen Auftrag', knoten: ['zentrale', 'auftrag'], wege: [['auftrag', 'hin']],
        text: 'Die Zentrale schreibt einen Auftrag und unterschreibt ihn. Nur Befehle aus einer festen Liste gehen überhaupt hinaus.',
        term: [['k', '# Mensch per Knopf oder KI per API – derselbe Weg'], ['p', 'POST /auftrag/senden {"an":"arbeitsplatz","befehl":"repos einrichten"}'], ['ok', 'Auftrag 4c51cbc4 · unterschrieben · in der Outbox']] },
      { name: 'Unterwegs', titel: 'Direkt von PC zu PC', knoten: ['auftrag', 'platz'], wege: [['auftrag', 'hin'], ['platz', 'her']],
        text: 'Tailscale verbindet die PCs direkt und verschlüsselt, Syncthing trägt die Datei. Kein fremder Server liest mit.',
        term: [['p', 'PS> tailscale status'], ['o', 'master        windows   -'], ['o', 'arbeitsplatz  windows   active; direct'], ['ok', 'syncthing · caelum-outbox · ↑ 1 Datei']] },
      { name: 'Prüfen', titel: 'Der Arbeitsplatz prüft', knoten: ['platz'], wege: [],
        text: 'Im Minutentakt holt der Arbeitsplatz neue Aufträge. Er prüft die Unterschrift und ob der Befehl erlaubt ist – alles andere bleibt liegen.',
        term: [['o', '[arbeitsplatz] Auftrag 4c51cbc4 gefunden'], ['ok', '[arbeitsplatz] Unterschrift ok · Befehl erlaubt'], ['o', '[arbeitsplatz] repos einrichten …']] },
      { name: 'UAC', titel: 'Adminrechte nur mit Mensch vor Ort', knoten: ['platz', 'uac'], wege: [],
        text: 'Braucht ein Schritt Adminrechte, fragt Windows. Bestätigen kann nur ein Mensch am Arbeitsplatz – die Fernsteuerung umgeht das nie. Neustarts ebenso nur mit Bestätigung.',
        term: [['p', 'PS> Start-Process CaelumStartUp.exe -Verb RunAs'], ['uac', '… Windows fragt nach Adminrechten'], ['ok', '✓ am Arbeitsplatz bestätigt']] },
      { name: 'Antwort', titel: 'Antwort und Herzschlag', knoten: ['kopf', 'zentrale'], wege: [['kopf', 'hin'], ['zentrale', 'her']],
        text: 'Ergebnis und Herzschlag kommen denselben Weg zurück. Die Zentrale sieht Stand, Dauer und Version jedes Arbeitsplatzes.',
        term: [['o', '[arbeitsplatz] Antwort 4c51cbc4 · 17/18 ok · 151 s'], ['ok', '[master] Herzschlag arbeitsplatz · CAELUM Pandora 1.0.0.41']] },
      { name: 'Update', titel: 'Neue Version für alle', knoten: ['update', 'platz'], wege: [['update', 'hin'], ['platz', 'her']],
        text: 'Neue Versionen gehen signiert an alle Arbeitsplätze, dazu der Auftrag „aktualisieren“. Ein Knopf statt USB-Stick.',
        term: [['p', 'PS> CAELUM.exe update-verteilen'], ['ok', '1.0.0.41 signiert · 9 Dateien · Auftrag „aktualisieren“ an alle']] }
    ]
  };

  function start(platz) { baue(platz, WLAN); baue(platz, MASTER); }
  (window.CaelumModul = window.CaelumModul || {}).verbindungen = start;
  document.dispatchEvent(new CustomEvent('caelum-modul', { detail: 'verbindungen' }));
})();
