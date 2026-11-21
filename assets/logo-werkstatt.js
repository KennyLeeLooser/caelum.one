// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Logo-Werkstatt (Kenny 20.11.2026): hinter dem Zeichen „Partner“ (Viereck = alle Felder in einer Farbe im Fusslogo).
// Das Caelum-Logo Feld für Feld einfärben, Linien- und Grundfarbe wählen, animieren und als SVG speichern – statisch oder animiert.
// Animationen wie in Caelum Start-Up (LogoView/LogoKit): die fünf Bauteile Viereck, Kreis, Dreieck, Mond, Tropfen erscheinen
// nacheinander; „Auseinander“ trennt die Felder und setzt sie wieder zusammen; „Atmen“ = ruhiges Pulsieren.
// Felder und Linien kommen aus dem Startsignet der Seite (eine Quelle). Gemerkt wird der Stand im localStorage dieses Browsers.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  if (window.CaelumWerkstatt) return;
  var NS = 'http://www.w3.org/2000/svg';
  var GRUND = [['#262624', 'Dunkel'], ['#FFF8F0', 'Hell'], ['none', 'Durchsichtig']];
  var LINIEN = [['#262624', 'Schwarz'], ['#E53935', 'Rot'], ['#FB8C00', 'Orange'], ['#FDD835', 'Gelb'], ['#43A047', 'Grün'],
    ['#1E88E5', 'Blau'], ['#3949AB', 'Indigo'], ['#8E24AA', 'Violett'], ['#E8E6E1', 'Weiss']];
  // Bauteile wie in Caelum Start-Up, als Feldgruppen (dieselben Felder wie die Zeichen im Fusslogo)
  var TEILE = [
    ['Viereck', ['f06', 'f07', 'f08', 'f09', 'f12', 'f13']],
    ['Kreis', ['f01', 'f02', 'f14', 'f15']],
    ['Dreieck', ['f05', 'f10', 'f11', 'f18', 'f19']],
    ['Mond', ['f03']],
    ['Tropfen', ['f04', 'f16', 'f17', 'f00']]
  ];
  function merk(v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('caelum-werkstatt') || 'null'); localStorage.setItem('caelum-werkstatt', JSON.stringify(v)); } catch (e) {} return null; }
  function startFarben() { return Array.prototype.map.call(document.querySelectorAll('.signet svg.felder path.cell'), function (p) { return p.getAttribute('fill') || '#30302E'; }); }
  function harmonie() { var l = window.CaelumLogo; return l ? l.spektrum().farben.slice() : ['#D97757', '#F2B05A', '#A58BF5']; }

  // Bewegungen – dieselben Regeln gehen in die animierte SVG-Datei (dort ohne .werkstatt .bild)
  var ANIM_CSS = [
    '.werkstatt .bild svg .feld{transform-box:fill-box;transform-origin:center}',
    '.werkstatt .bild svg.anim-einzeichnen .feld{animation:wz-ein .55s ease both}',
    '.werkstatt .bild svg.anim-einzeichnen .t1{animation-delay:.55s}.werkstatt .bild svg.anim-einzeichnen .t2{animation-delay:1.1s}.werkstatt .bild svg.anim-einzeichnen .t3{animation-delay:1.65s}.werkstatt .bild svg.anim-einzeichnen .t4{animation-delay:2.2s}',
    '@keyframes wz-ein{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}',
    '.werkstatt .bild svg.anim-auseinander .feld{transform-box:view-box;transform-origin:512px 512px;animation:wz-weg 3s ease-in-out both;animation-delay:calc(var(--n) * 25ms)}',
    '.werkstatt .bild svg.anim-auseinander .linie{animation:wz-linie 3s ease-in-out both}',
    '@keyframes wz-weg{0%,100%{transform:none}40%,60%{transform:translate(var(--dx),var(--dy)) scale(.9)}}',
    '@keyframes wz-linie{0%,100%{opacity:1}40%,60%{opacity:.12}}',
    '.werkstatt .bild svg.anim-atmen{transform-origin:center;animation:wz-atmen 4s ease-in-out infinite}',
    '@keyframes wz-atmen{50%{transform:scale(.965)}}',
    '@media (prefers-reduced-motion:reduce){.werkstatt .bild svg *{animation:none!important}}'
  ].join('');
  var css = document.createElement('style');
  css.textContent = [
    '.werkstatt{position:fixed;inset:0;z-index:60;background:color-mix(in srgb,var(--bg-deep,#1F1E1D) 92%,transparent);display:grid;place-items:center;padding:16px;overflow:auto}',
    '.werkstatt[hidden]{display:none}',
    '.werkstatt .rahmen{width:min(980px,100%);background:var(--surface,#30302E);border:1px solid var(--line,#3A3A37);border-radius:16px;padding:18px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:20px;color:var(--text,#E8E6E1);font-size:14px}',
    '@media (max-width:760px){.werkstatt{place-items:start center}.werkstatt .rahmen{grid-template-columns:1fr}}',
    '.werkstatt h2{grid-column:1/-1;margin:0;font-size:18px;display:flex;justify-content:space-between;align-items:center}',
    '.werkstatt h2 small{font-weight:400;color:var(--muted,#8A8780);font-size:13px;margin-left:8px}',
    '.werkstatt .x{all:unset;cursor:pointer;color:var(--muted,#8A8780);font-size:22px;padding:0 6px}',
    '.werkstatt .bild{aspect-ratio:1;width:100%;border-radius:12px;background:repeating-conic-gradient(#2c2c2a 0 25%,#323230 0 50%) 0 0/24px 24px;touch-action:none}',
    '.werkstatt .bild svg{width:100%;height:100%;display:block}',
    '.werkstatt .bild path.feld{cursor:crosshair;transition:fill .2s;pointer-events:all}',   // auch leere Felder (fill none) treffbar
    '.werkstatt .bild path.linie{pointer-events:none}',
    '.werkstatt .bild path.feld:hover{filter:brightness(1.15)}',
    '.werkstatt .seite{display:flex;flex-direction:column;gap:14px}',
    '.werkstatt .titel{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#8A8780);margin-bottom:6px}',
    '.werkstatt .reihe{display:flex;flex-wrap:wrap;gap:7px;align-items:center}',
    '.werkstatt .tupf{width:26px;height:26px;border-radius:50%;border:1px solid var(--line,#3A3A37);cursor:pointer;padding:0}',
    '.werkstatt .tupf[aria-pressed="true"]{box-shadow:0 0 0 2px var(--surface,#30302E),0 0 0 4px var(--text-soft,#C9C6BF)}',
    '.werkstatt .tupf.leer{background:repeating-conic-gradient(#555 0 25%,#333 0 50%) 0 0/10px 10px}',
    '.werkstatt input[type=color]{width:34px;height:28px;border:0;padding:0;background:none;cursor:pointer}',
    '.werkstatt button.k{all:unset;cursor:pointer;padding:8px 12px;border-radius:10px;background:var(--bg-deep,#1F1E1D);color:var(--text-soft,#C9C6BF)}',
    '.werkstatt button.k:hover,.werkstatt button.k:focus-visible{color:var(--text,#fff);box-shadow:inset 0 0 0 1px var(--accent,#D97757)}',
    '.werkstatt button.k[aria-pressed="true"]{color:var(--text,#fff);box-shadow:inset 0 0 0 2px var(--accent,#D97757)}',
    '.werkstatt button.k.haupt{background:var(--accent,#D97757);color:#1F1E1D;font-weight:600}',
    '.werkstatt select{font:inherit;color:var(--text,#E8E6E1);background:var(--bg-deep,#1F1E1D);border:1px solid var(--line,#3A3A37);border-radius:10px;padding:7px 10px}',
    // Animationen (gleiche Regeln landen in der animierten SVG)
    ANIM_CSS
  ].join('');

  var ANIM_CSS_TEXT = ANIM_CSS;
  document.head.appendChild(css);

  var stand = merk() || { felder: null, linie: '#262624', grund: '#262624', anim: 'einzeichnen' };
  var pinsel = null, malt = false, svg = null, huelle = null, linienReihe = null;

  function bauen() {
    huelle = document.createElement('div'); huelle.className = 'werkstatt'; huelle.hidden = true;
    huelle.setAttribute('role', 'dialog'); huelle.setAttribute('aria-modal', 'true'); huelle.setAttribute('aria-label', 'Logo-Werkstatt');
    var r = document.createElement('div'); r.className = 'rahmen'; huelle.appendChild(r);
    var h = document.createElement('h2'); h.innerHTML = '<span>Logo-Werkstatt<small>Partner</small></span>';
    var x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Schliessen'); x.onclick = zu; h.appendChild(x); r.appendChild(h);

    var bild = document.createElement('div'); bild.className = 'bild'; r.appendChild(bild);
    svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 1024 1024'); bild.appendChild(svg);
    var seite = document.createElement('div'); seite.className = 'seite'; r.appendChild(seite);

    // Pinsel: Farben des Startbilds (Harmonie), Grundtöne, eigene Farbe, Radierer
    // Zeichnen: Pinsel (darüberziehen) oder Tippen (genau ein Feld) – Kenny 21.11.2026
    var p0 = gruppe(seite, 'Zeichnen');
    var artPinsel = knopf('Pinsel – darüberziehen', function () { zeichenArt('pinsel'); }), artTippen = knopf('Tippen – ein Feld', function () { zeichenArt('tippen'); });
    function zeichenArt(a) { stand.modus = a; artPinsel.setAttribute('aria-pressed', String(a === 'pinsel')); artTippen.setAttribute('aria-pressed', String(a === 'tippen')); merk(stand); }
    p0.reihe.appendChild(artPinsel); p0.reihe.appendChild(artTippen); zeichenArt(stand.modus === 'tippen' ? 'tippen' : 'pinsel');

    var p1 = gruppe(seite, 'Farbe');
    var pr = p1.reihe;
    function pinselTupf(c, name) {
      var b = tupf(c, name, function () { pinsel = c; markiere(pr, b); }); pr.appendChild(b); return b;
    }
    harmonie().forEach(function (c, i) { var b = pinselTupf(c, 'Startbild ' + (i + 1)); if (!pinsel) { pinsel = c; b.setAttribute('aria-pressed', 'true'); } });
    LINIEN.slice(1, 8).forEach(function (e) { pinselTupf(e[0], e[1]); });
    var eigen = document.createElement('input'); eigen.type = 'color'; eigen.value = '#D97757'; eigen.title = 'Eigene Farbe'; eigen.setAttribute('aria-label', 'Eigene Farbe');
    eigen.oninput = function () { pinsel = eigen.value; markiere(pr, null); }; pr.appendChild(eigen);
    var rad = tupf('none', 'Radierer (Feld leer)', function () { pinsel = 'none'; markiere(pr, rad); }); rad.classList.add('leer'); pr.appendChild(rad);

    var p2 = gruppe(seite, 'Linien');
    linienReihe = p2.reihe;
    LINIEN.forEach(function (e) { var b = tupf(e[0], e[1], function () { stand.linie = e[0]; markiere(p2.reihe, b); zeichnen(); }); b.dataset.farbe = e[0]; if (stand.linie === e[0]) b.setAttribute('aria-pressed', 'true'); p2.reihe.appendChild(b); });
    var p3 = gruppe(seite, 'Grund');
    GRUND.forEach(function (e) { var b = tupf(e[0], e[1], function () { stand.grund = e[0]; markiere(p3.reihe, b); zeichnen(); }); if (e[0] === 'none') b.classList.add('leer'); if (stand.grund === e[0]) b.setAttribute('aria-pressed', 'true'); p3.reihe.appendChild(b); });

    // Füllen: Harmonie wählen = zufällig daraus füllen (Startbild kommt beim Öffnen von selbst) – Kenny 21.11.2026
    var p4 = gruppe(seite, 'Füllen – Harmonie wählen');
    var L = window.CaelumLogo, harmName = document.createElement('div'); harmName.className = 'titel';
    function fuellen(f) { stand.felder = stand.felder.map(function () { return f[Math.floor(Math.random() * f.length)]; }); zeichnen(); }
    if (L && L.harmonien && L.vorschau) {
      L.harmonien.forEach(function (h) {
        var f = L.vorschau(h.art), n = f.length;
        var b = tupf('conic-gradient(' + f.map(function (c, i) { return c + ' ' + (i * 360 / n) + 'deg ' + ((i + 1) * 360 / n) + 'deg'; }).join(', ') + ')', h.name, function () { markiere(p4.reihe, b); harmName.textContent = h.name; fuellen(L.vorschau(h.art)); });
        p4.reihe.appendChild(b);
      });
    } else p4.reihe.appendChild(knopf('Zufällig aus der Harmonie', function () { fuellen(harmonie()); }));
    p4.reihe.appendChild(knopf('Alles in Pinselfarbe', function () { stand.felder = stand.felder.map(function () { return pinsel; }); zeichnen(); }));
    p4.reihe.parentNode.appendChild(harmName); harmName.style.margin = '6px 0 0';

    var p4b = gruppe(seite, 'Leeren');
    p4b.reihe.appendChild(knopf('Alle Felder leeren', function () { stand.felder = stand.felder.map(function () { return 'none'; }); zeichnen(); markiere(p4.reihe, null); harmName.textContent = ''; }));

    var p5 = gruppe(seite, 'Bewegung');
    var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Animation');
    [['einzeichnen', 'Einzeichnen – Bauteile nacheinander'], ['auseinander', 'Auseinander und zusammen'], ['atmen', 'Atmen'], ['keine', 'Stehend']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (stand.anim === o[0]) op.selected = true; sel.appendChild(op);
    });
    sel.onchange = function () { stand.anim = sel.value; abspielen(); };
    p5.reihe.appendChild(sel); p5.reihe.appendChild(knopf('Abspielen', abspielen));

    var p6 = gruppe(seite, 'Speichern');
    p6.reihe.appendChild(knopf('Als SVG speichern', function () { speichern(false); }, 'haupt'));
    p6.reihe.appendChild(knopf('Animierte SVG', function () { speichern(true); }));

    // Malen: antippen oder mit gedrückter Maus/Finger darüberziehen
    svg.addEventListener('pointerdown', function (e) { malt = true; try { svg.setPointerCapture(e.pointerId); } catch (f) {} male(e); });
    svg.addEventListener('pointermove', function (e) { if (malt && stand.modus !== 'tippen') male(e); });
    svg.addEventListener('pointerup', function () { malt = false; merk(stand); });
    svg.addEventListener('pointercancel', function () { malt = false; });
    huelle.addEventListener('pointerdown', function (e) { if (e.target === huelle) zu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !huelle.hidden) zu(); });
    document.body.appendChild(huelle);
  }
  function gruppe(wo, titel) { var d = document.createElement('div'), t = document.createElement('div'), r = document.createElement('div'); t.className = 'titel'; t.textContent = titel; r.className = 'reihe'; d.appendChild(t); d.appendChild(r); wo.appendChild(d); return { reihe: r }; }
  function tupf(c, name, tun) { var b = document.createElement('button'); b.type = 'button'; b.className = 'tupf'; b.title = name; b.setAttribute('aria-label', name); b.setAttribute('aria-pressed', 'false'); if (c !== 'none') b.style.background = c; b.onclick = tun; return b; }
  function knopf(t, tun, extra) { var b = document.createElement('button'); b.type = 'button'; b.className = 'k' + (extra ? ' ' + extra : ''); b.textContent = t; b.onclick = tun; return b; }
  function markiere(reihe, b) { Array.prototype.forEach.call(reihe.querySelectorAll('.tupf'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }
  function male(e) {
    var p = document.elementFromPoint(e.clientX, e.clientY);
    if (!p || !p.classList || !p.classList.contains('feld')) return;
    var k = +p.getAttribute('data-k'); if (stand.felder[k] === pinsel) return;
    stand.felder[k] = pinsel; p.setAttribute('fill', pinsel); p.setAttribute('stroke', pinsel === 'none' ? 'none' : pinsel);
  }

  // --- SVG-Inhalt: eine Quelle für Werkstatt und Datei ---
  function teilVon(id) { for (var i = 0; i < TEILE.length; i++) if (TEILE[i][1].indexOf(id) >= 0) return i; return 0; }
  function inhalt(mitIds) {
    var felder = document.querySelectorAll('.signet svg.felder path.cell'), linie = document.querySelector('.signet svg.lines path');
    var teile = [];
    if (stand.grund !== 'none') teile.push('<rect class="grund" x="56" y="56" width="912" height="912" fill="' + stand.grund + '"/>');
    Array.prototype.forEach.call(felder, function (p, k) {
      var id = 'f' + ('0' + k).slice(-2), c = stand.felder[k] || 'none', b = p.getBBox();
      var dx = Math.round((b.x + b.width / 2 - 512) * 0.35), dy = Math.round((b.y + b.height / 2 - 512) * 0.35);
      teile.push('<path class="feld t' + teilVon(id) + '"' + (mitIds ? ' data-k="' + k + '"' : '') + ' style="--dx:' + dx + 'px;--dy:' + dy + 'px;--n:' + k + '" fill="' + c + '" stroke="' + (c === 'none' ? 'none' : c) +
        '" stroke-width="4" stroke-linejoin="round" d="' + p.getAttribute('d') + '"/>');
    });
    teile.push('<path class="linie" fill="' + stand.linie + '" fill-rule="evenodd" d="' + (linie ? linie.getAttribute('d') : '') + '"/>');
    return teile.join('');
  }
  function zeichnen() {
    if (!stand.felder) stand.felder = startFarben();
    svg.innerHTML = inhalt(true);
    svg.setAttribute('class', 'anim-' + stand.anim);
    merk(stand);
  }
  function abspielen() { svg.setAttribute('class', ''); void svg.getBoundingClientRect(); svg.setAttribute('class', 'anim-' + stand.anim); merk(stand); }
  function speichern(animiert) {
    var kopf = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Copyright © 2026 Caelum GmbH. Caelum-Logo aus der Logo-Werkstatt' + (animiert ? ', Bewegung: ' + stand.anim : '') + ' -->\n';
    var stil = animiert && stand.anim !== 'keine' ? '<style>' + ANIM_CSS_TEXT.replace(/\.werkstatt \.bild svg/g, 'svg') + '</style>' : '';
    var datei = kopf + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="44 44 936 936" width="1024" height="1024"' + (animiert ? ' class="anim-' + stand.anim + '"' : '') + '>' + stil + inhalt(false) + '</svg>\n';
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([datei], { type: 'image/svg+xml' }));
    a.download = 'caelum-logo' + (animiert ? '-' + stand.anim : '') + '.svg';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  // Linienfarbe aus „Caelum Optionen“ übernehmen (Kenny 20.11.2026): beim Öffnen gilt die Farbe des Startsignets.
  function optionenLinie() { try { return localStorage.getItem('caelum-logo-linie') || '#262624'; } catch (e) { return '#262624'; } }
  function auf() {
    if (!huelle) bauen();
    stand.linie = optionenLinie();
    stand.felder = startFarben();   // beim Öffnen immer wie das Startbild (Kenny 21.11.2026)
    if (linienReihe) markiere(linienReihe, linienReihe.querySelector('[data-farbe="' + stand.linie + '"]'));
    zeichnen(); huelle.hidden = false; document.documentElement.style.overflow = 'hidden';
    huelle.querySelector('.x').focus({ preventScroll: true });
  }
  function zu() { if (!huelle || huelle.hidden) return; huelle.hidden = true; document.documentElement.style.overflow = ''; merk(stand); }
  window.CaelumWerkstatt = { oeffnen: auf, schliessen: zu };
})();
