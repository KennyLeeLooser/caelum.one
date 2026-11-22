// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Logo-Werkstatt (Kenny 20.11.2026): hinter dem Zeichen „Partner“ (Viereck = alle Felder in einer Farbe im Fusslogo).
// Das Caelum-Logo Feld für Feld einfärben, Linien- und Grundfarbe wählen, animieren und als SVG speichern – statisch oder animiert.
// Animationen wie in Caelum Start-Up (LogoView/LogoKit): die fünf Bauteile Viereck, Kreis, Dreieck, Mond, Tropfen erscheinen
// nacheinander; „Auseinander“ trennt die Felder und setzt sie wieder zusammen; „Atmen“ = ruhiges Pulsieren.
// Felder und Linien kommen aus dem Startsignet der Seite (eine Quelle). Gemerkt wird der Stand im localStorage dieses Browsers.
// v4 (B 5, 22.11.2026): Umschalter „Felder | Bauteile – Stupa“. Bauteile = die echten Formen aus LogoKit.cs (Caelum Start-Up),
// Ansicht Logo (von oben) oder Stupa (von der Seite), Aufbauen wie in Start-Up, SVG-Export beider Ansichten; unter der Seite
// baut sich ein kleiner Stupa auf und schiebt sich zum Logo (antippen wechselt, ◇ öffnet die Werkstatt).
// v5 (22.11.2026, Befund Kenny): Stupa ist ein eigenes Logo – keine Caelum-Aussenlinien mehr darüber, Knöpfe „Elementfarben“ und
// „Original-Linien“ entfernt; die Teile zeichnen ihre eigenen Umrisse. Neu: Ansicht „3D – drehen“ (assets/stupa-3d.js) und GLB speichern.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  if (window.CaelumWerkstatt) return;
  var NS = 'http://www.w3.org/2000/svg';
  var SKRIPT = (document.currentScript && document.currentScript.src) || location.href;   // v5: stupa-3d.js liegt daneben
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
  // --- B 5 (22.11.2026): die fünf Bauteile als echte Formen wie im LogoKit von Caelum Start-Up (eine Quelle: LogoKit.cs) ---
  // Das Logo ist der Stupa von oben: Viereck (Erde), Kreis (Wasser), Dreieck (Feuer), Mond (Luft), Tropfen (Raum) im 1000er-Quadrat.
  var BAU = [
    { form: 'Viereck', element: 'Erde', farbe: '#F2B05A', r: [0, 0, 1000, 1000], d: 'M0,0 H1000 V1000 H0 Z' },
    { form: 'Kreis', element: 'Wasser', farbe: '#E8E6E1', r: [0, 0, 1000, 1000], d: 'M0,500 A500,500 0 1 1 1000,500 A500,500 0 1 1 0,500 Z' },
    { form: 'Dreieck', element: 'Feuer', farbe: '#D97757', r: [0, 0, 1000, 1000], d: 'M500,0 L1000,1000 L0,1000 Z' },
    { form: 'Mond', element: 'Luft', farbe: '#6BAF73', r: [0, 500, 1000, 500], d: 'M0,500 A500,500 0 0 0 1000,500 A500,360 0 0 1 0,500 Z' },
    { form: 'Tropfen', element: 'Raum', farbe: '#7FA3D6', r: [260, 180, 480, 680], d: 'M500,180 C420,260 260,420 260,620 A240,240 0 0 0 740,620 C740,420 580,260 500,180 Z' }
  ];
  // Lage im Stupa wie LogoKit.Layout (Breite des Fundaments = 1, y nach oben): Mond ruht auf der Dreieckspitze, Tropfen in der Mondschale
  var STUPA = (function () {
    var breiten = [1, 0.86, 0.96, 0.86, 0.44], l = [], y = 0;
    for (var i = 0; i < 5; i++) {
      var k = breiten[i] / BAU[i].r[2], h = BAU[i].r[3] * k;
      var unten = i === 3 ? y - 0.02 : i === 4 ? l[3].unten + 140 * l[3].k : y;
      l.push({ k: k, unten: unten, h: h }); y = unten + h + 0.01;
    }
    return l;
  })();
  var STUPA_TOP = STUPA[4].unten + STUPA[4].h;
  var STUPA_CSS = [
    '.cs-teil{transform-box:view-box;transform-origin:0 0;transition:transform 1.1s cubic-bezier(.6,.05,.3,1),opacity .4s}',
    '.cs-teil.cs-fall{transition:transform .9s cubic-bezier(.3,1.35,.55,1),opacity .25s}',
    '.cs-teil path{transition:fill .4s,stroke .4s,stroke-opacity .6s}',
    '.cs-grund{transition:opacity .8s}',
    '.cs-sofort .cs-teil,.cs-sofort .cs-grund{transition:none!important}',
    '@media (prefers-reduced-motion:reduce){.cs-teil,.cs-grund{transition:none!important}}'
  ].join('');
  function ruhig() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  // Ansicht „logo“ = von oben (alle Teile im selben Quadrat), „stupa“ = von der Seite (Teile übereinander), drop = Höhe über dem Platz
  function pose(i, ansicht, W, H, drop) {
    if (ansicht === 'logo') { var L = Math.min(W, H) * 0.8; return { x: (W - L) / 2, y: (H - L) / 2, k: L / 1000 }; }
    var s = Math.min(W * 0.8, (H - 24) / (STUPA_TOP + 0.08)), K = STUPA[i].k * s, r = BAU[i].r;
    return { x: W / 2 - 500 * K, y: H - 10 - (STUPA[i].unten + (drop || 0)) * s - (r[1] + r[3]) * K, k: K };
  }
  function Buehne(svgEl, W, H, o) {
    o = o || {};
    var st = { ansicht: o.ansicht || 'logo', farben: BAU.map(function (b) { return b.farbe; }), an: [1, 1, 1, 1, 1], linie: o.linie || '#262624', grund: o.grund || 'none', strich: o.strich || 25 };
    var uhr = [];
    svgEl.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svgEl.innerHTML = '';
    var lp = pose(0, 'logo', W, H);
    var grund = el('rect', { 'class': 'cs-grund', x: lp.x - 20 * lp.k, y: lp.y - 20 * lp.k, width: 1040 * lp.k, height: 1040 * lp.k, rx: 6 });
    svgEl.appendChild(grund);
    var teile = BAU.map(function (b, i) {
      var g = el('g', { 'class': 'cs-teil', 'data-i': i });
      var p = el('path', { 'class': 'cs-form', d: b.d, 'stroke-linejoin': 'round', 'stroke-width': st.strich });
      var t = el('title', {}); t.textContent = b.form + ' · ' + b.element; p.appendChild(t);
      g.appendChild(p); svgEl.appendChild(g); return g;
    });
    function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
    function tf(p) { return 'translate(' + p.x.toFixed(2) + 'px,' + p.y.toFixed(2) + 'px) scale(' + p.k.toFixed(5) + ')'; }
    function farbe() {
      var logo = st.ansicht === 'logo';
      teile.forEach(function (g, i) {
        var p = g.firstChild, f = st.farben[i];
        p.setAttribute('fill', f);
        p.setAttribute('fill-opacity', logo ? '1' : '.85');
        // Stupa: Linie heller als die Fläche (wie Start-Up); Logo von oben: eigene Umrisse in der Linienfarbe (keine Caelum-Linien)
        p.style.stroke = !logo && f !== 'none' ? 'color-mix(in srgb,' + f + ' 62%, #fff)' : st.linie;
        g.style.opacity = st.an[i] ? '' : '0';
        g.style.pointerEvents = st.an[i] ? '' : 'none';
      });
      grund.setAttribute('fill', st.grund === 'none' ? 'transparent' : st.grund);
      grund.style.opacity = logo ? '1' : '0';
    }
    function setze(drop) { teile.forEach(function (g, i) { g.style.transform = tf(pose(i, st.ansicht, W, H, drop)); }); farbe(); }
    function sofort(f) { svgEl.classList.add('cs-sofort'); f(); void svgEl.getBoundingClientRect(); svgEl.classList.remove('cs-sofort'); }
    function stopp() { uhr.forEach(clearTimeout); uhr = []; teile.forEach(function (g) { g.classList.remove('cs-fall'); }); }
    var api = {
      stand: st,
      ansicht: function (a) { stopp(); st.ansicht = a; setze(0); },
      wechseln: function () { api.ansicht(st.ansicht === 'logo' ? 'stupa' : 'logo'); },
      neu: function () { stopp(); sofort(function () { setze(0); }); },
      farbe: farbe,
      // Aufbauen wie in Start-Up: Teile fallen von unten nach oben auf ihren Platz, der Stupa steht, dann schieben sie sich zum Logo
      aufbauen: function (zumLogo) {
        stopp();
        if (ruhig()) { st.ansicht = zumLogo === false ? 'stupa' : 'logo'; sofort(function () { setze(0); }); return; }
        st.ansicht = 'stupa';
        sofort(function () { setze(0); teile.forEach(function (g, i) { g.style.transform = tf(pose(i, 'stupa', W, H, 1.6)); g.style.opacity = '0'; }); });
        teile.forEach(function (g, i) {
          uhr.push(setTimeout(function () { g.classList.add('cs-fall'); g.style.transform = tf(pose(i, 'stupa', W, H, 0)); g.style.opacity = st.an[i] ? '' : '0'; }, 150 + i * 450));
        });
        if (zumLogo !== false) uhr.push(setTimeout(function () { teile.forEach(function (g) { g.classList.remove('cs-fall'); }); st.ansicht = 'logo'; setze(0); if (o.fertig) o.fertig(); }, 150 + 5 * 450 + 1400));
      },
      // Für die Datei: aktuelle Ansicht als SVG-Inhalt (Transform als Attribut statt CSS)
      inhalt: function (animiert) {
        var logo = st.ansicht === 'logo', out = [];
        if (logo && st.grund !== 'none') out.push('<rect x="' + grund.getAttribute('x') + '" y="' + grund.getAttribute('y') + '" width="' + grund.getAttribute('width') + '" height="' + grund.getAttribute('height') + '" rx="6" fill="' + st.grund + '"/>');
        BAU.forEach(function (b, i) {
          if (!st.an[i]) return;
          var p = pose(i, st.ansicht, W, H, 0), f = st.farben[i], strich = teile[i].firstChild.style.stroke;
          out.push('<g transform="translate(' + p.x.toFixed(2) + ' ' + p.y.toFixed(2) + ') scale(' + p.k.toFixed(5) + ')">' +
            (animiert ? '<path class="f" style="animation-delay:' + (i * 0.56).toFixed(2) + 's" d="' + b.d + '" fill="' + f + '" fill-opacity="' + (logo ? 1 : 0.85) + '"/>' : '') +
            '<path' + (animiert ? ' class="t" pathLength="1" style="--d:1.1s;animation-delay:' + (i * 0.56).toFixed(2) + 's"' : '') + ' d="' + b.d + '" fill="' + (animiert ? 'none' : f) + '"' + (logo ? '' : ' fill-opacity=".85"') +
            ' stroke="' + strich + '" stroke-width="' + st.strich + '" stroke-linejoin="round"><title>' + b.form + ' · ' + b.element + '</title></path></g>');
        });
        return out.join('');
      }
    };
    api.neu();
    return api;
  }
  // Animation der Datei wie LogoKit.Svg: Teile zeichnen sich ein, Flächen erscheinen (eigene Umrisse bleiben stehen)
  var BAU_DATEI_CSS = '.t{stroke-dasharray:1;stroke-dashoffset:1;animation:zeichnen var(--d) cubic-bezier(.6,.05,.3,1) forwards}' +
    '.f{opacity:0;animation:fuellen .8s ease-out forwards}@keyframes zeichnen{to{stroke-dashoffset:0}}@keyframes fuellen{to{opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){.t,.f{animation:none}.t{stroke-dashoffset:0}}';

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
    ANIM_CSS,
    // B 5: Felder | Bauteile, Bühne mit den echten Formen, Logo unter der Seite
    '.werkstatt .links{display:flex;flex-direction:column;gap:10px;min-width:0}',
    '.werkstatt .modi{display:flex;gap:6px;flex-wrap:wrap}',
    '.werkstatt .bild[hidden],.werkstatt [data-werk][hidden]{display:none}',
    '.werkstatt .bau path.cs-form{cursor:crosshair}',
    '.werkstatt .hinweis{color:var(--muted,#8A8780);font-size:13px;margin:0}',
    STUPA_CSS,
    '.stupa-fuss{display:flex;justify-content:center;align-items:flex-end;gap:6px;padding:18px 0 6px}',
    '.stupa-fuss svg{width:150px;height:150px;cursor:pointer;display:block;-webkit-tap-highlight-color:transparent}',
    '.stupa-fuss svg:focus-visible{outline:2px solid var(--accent,#D97757);outline-offset:4px;border-radius:8px}',
    '.stupa-fuss svg .cs-teil:hover path{filter:brightness(1.15)}',
    '.stupa-fuss button{all:unset;cursor:pointer;color:var(--faint,#6E6C66);font-size:16px;padding:4px 6px;border-radius:8px}',
    '.stupa-fuss button:hover,.stupa-fuss button:focus-visible{color:var(--text,#E8E6E1);box-shadow:inset 0 0 0 1px var(--accent,#D97757)}'
  ].join('');

  var ANIM_CSS_TEXT = ANIM_CSS;
  document.head.appendChild(css);

  var stand = merk() || { felder: null, linie: '#262624', grund: '#262624', anim: 'einzeichnen' };
  if (!stand.bau || !stand.bau.farben || stand.bau.farben.length !== 5) stand.bau = { ansicht: 'logo', farben: BAU.map(function (b) { return b.farbe; }), an: [1, 1, 1, 1, 1] };
  delete stand.bau.original;   // v5: keine Original-Linien mehr
  var pinsel = null, malt = false, svg = null, huelle = null, linienReihe = null, buehne = null;
  var werk = function () {}, bauFarben = function () {}, zeige3d = function () {}, starte3d = function () {}, dreiModul = null;

  function bauen() {
    huelle = document.createElement('div'); huelle.className = 'werkstatt'; huelle.hidden = true;
    huelle.setAttribute('role', 'dialog'); huelle.setAttribute('aria-modal', 'true'); huelle.setAttribute('aria-label', 'Logo-Werkstatt');
    var r = document.createElement('div'); r.className = 'rahmen'; huelle.appendChild(r);
    var h = document.createElement('h2'); h.innerHTML = '<span>Logo-Werkstatt<small>Partner</small></span>';
    var x = document.createElement('button'); x.className = 'x'; x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Schliessen'); x.onclick = zu; h.appendChild(x); r.appendChild(h);

    // Links: Umschalter Felder | Bauteile, darunter das Bild (Felder) oder die Bühne (Bauteile, B 5)
    var links = document.createElement('div'); links.className = 'links'; r.appendChild(links);
    var modi = document.createElement('div'); modi.className = 'modi'; links.appendChild(modi);
    var bild = document.createElement('div'); bild.className = 'bild'; links.appendChild(bild);
    svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 1024 1024'); bild.appendChild(svg);
    var bild2 = document.createElement('div'); bild2.className = 'bild bau'; links.appendChild(bild2);
    var svg2 = document.createElementNS(NS, 'svg'); svg2.setAttribute('role', 'img'); svg2.setAttribute('aria-label', 'Bauteile des Stupa-Logos'); bild2.appendChild(svg2);
    var bild3 = document.createElement('div'); bild3.className = 'bild drei'; bild3.hidden = true; links.appendChild(bild3);
    var seite = document.createElement('div'); seite.className = 'seite'; r.appendChild(seite);
    var mFelder = knopf('Felder', function () { werk('felder'); }), mBau = knopf('Bauteile – Stupa', function () { werk('bauteile'); });
    modi.appendChild(mFelder); modi.appendChild(mBau);
    werk = function (m) {
      stand.werk = m;
      mFelder.setAttribute('aria-pressed', String(m === 'felder')); mBau.setAttribute('aria-pressed', String(m === 'bauteile'));
      bild.hidden = m !== 'felder'; bild2.hidden = m !== 'bauteile' || stand.bau.ansicht === '3d'; bild3.hidden = m !== 'bauteile' || stand.bau.ansicht !== '3d';
      Array.prototype.forEach.call(seite.querySelectorAll('[data-werk]'), function (g) { g.hidden = g.getAttribute('data-werk') !== m; });
      Array.prototype.forEach.call(seite.querySelectorAll('[data-glb]'), function (g) { g.hidden = m !== 'bauteile'; });
      if (m === 'bauteile' && buehne) bauFarben();
      merk(stand);
    };

    // Pinsel: Farben des Startbilds (Harmonie), Grundtöne, eigene Farbe, Radierer
    // Zeichnen: Pinsel (darüberziehen) oder Tippen (genau ein Feld) – Kenny 21.11.2026
    var p0 = gruppe(seite, 'Zeichnen', 'felder');
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

    // Bauteile (B 5): Ansicht (Logo · Stupa · 3D), Teile ein/aus, Aufbauen
    var b1 = gruppe(seite, 'Ansicht', 'bauteile');
    var vLogo = knopf('Logo – von oben', function () { bauAnsicht('logo'); }), vStupa = knopf('Stupa – von der Seite', function () { bauAnsicht('stupa'); });
    var v3d = knopf('3D – drehen', function () { bauAnsicht('3d'); });
    b1.reihe.appendChild(vLogo); b1.reihe.appendChild(vStupa); b1.reihe.appendChild(v3d);
    b1.reihe.appendChild(knopf('Aufbauen', function () { bauAnsicht('logo', true); buehne.aufbauen(true); }));
    function bauAnsichtKnoepfe(a) { vLogo.setAttribute('aria-pressed', String(a === 'logo')); vStupa.setAttribute('aria-pressed', String(a === 'stupa')); v3d.setAttribute('aria-pressed', String(a === '3d')); }
    function bauAnsicht(a, still) {
      stand.bau.ansicht = a; bauAnsichtKnoepfe(a); werk('bauteile');
      if (a === '3d') drei3d(); else if (!still) buehne.ansicht(a);
      merk(stand);
    }
    // 3D: Modul erst laden, wenn jemand es will (Renderer des Caelum 3D-Viewers, keine fremde Bibliothek)
    var dreiMod = null, drei = null;
    function drei3d() {
      dreiModul().then(function (m) {
        if (!drei) { drei = m.buehne3d(bild3); if (!drei) { bild3.textContent = 'Dieser Browser kann kein WebGL2 – die 3D-Ansicht braucht einen aktuellen Browser.'; return; } }
        drei.zeigen(stand.bau.farben, stand.bau.an); drei.drehen();
      }).catch(function (e) { bild3.textContent = '3D liess sich nicht laden: ' + e; });
    }
    dreiModul = function () { return dreiMod || (dreiMod = import(new URL('stupa-3d.js?v=2', SKRIPT).href)); };
    zeige3d = function () { if (drei && stand.bau.ansicht === '3d') drei.zeigen(stand.bau.farben, stand.bau.an); };
    starte3d = drei3d;
    var b2 = gruppe(seite, 'Bauteile – antippen färbt mit der Pinselfarbe', 'bauteile');
    var teilKnoepfe = BAU.map(function (b, i) {
      var k = knopf(b.form + ' · ' + b.element, function () { stand.bau.an[i] = stand.bau.an[i] ? 0 : 1; bauFarben(); merk(stand); });
      k.style.borderLeft = '4px solid ' + b.farbe; b2.reihe.appendChild(k); return k;
    });
    var hw = document.createElement('p'); hw.className = 'hinweis';
    hw.textContent = 'Der Stupa ist ein eigenes Logo: dieselben fünf Formen wie Caelum, ohne die Caelum-Linien – von oben, von der Seite oder in 3D zum Drehen.';
    b2.reihe.parentNode.appendChild(hw);
    bauFarben = function () {
      var s = buehne.stand;
      s.farben = stand.bau.farben.slice(); s.an = stand.bau.an.slice();
      s.linie = stand.linie; s.grund = stand.grund === 'none' ? 'none' : stand.grund;
      teilKnoepfe.forEach(function (k, i) { k.setAttribute('aria-pressed', String(!!stand.bau.an[i])); });
      buehne.farbe();
      zeige3d();
    };
    buehne = Buehne(svg2, 1000, 1000, { ansicht: stand.bau.ansicht === '3d' ? 'logo' : stand.bau.ansicht });
    bauAnsichtKnoepfe(stand.bau.ansicht);
    svg2.addEventListener('click', function (e) {
      var g = e.target.closest && e.target.closest('.cs-teil'); if (!g) return;
      stand.bau.farben[+g.getAttribute('data-i')] = pinsel; bauFarben(); merk(stand);
    });

    var p2 = gruppe(seite, 'Linien');
    linienReihe = p2.reihe;
    LINIEN.forEach(function (e) { var b = tupf(e[0], e[1], function () { stand.linie = e[0]; markiere(p2.reihe, b); zeichnen(); bauFarben(); }); b.dataset.farbe = e[0]; if (stand.linie === e[0]) b.setAttribute('aria-pressed', 'true'); p2.reihe.appendChild(b); });
    var p3 = gruppe(seite, 'Grund');
    GRUND.forEach(function (e) { var b = tupf(e[0], e[1], function () { stand.grund = e[0]; markiere(p3.reihe, b); zeichnen(); bauFarben(); }); if (e[0] === 'none') b.classList.add('leer'); if (stand.grund === e[0]) b.setAttribute('aria-pressed', 'true'); p3.reihe.appendChild(b); });

    // Füllen: Harmonie wählen = zufällig daraus füllen (Startbild kommt beim Öffnen von selbst) – Kenny 21.11.2026
    var p4 = gruppe(seite, 'Füllen – Harmonie wählen', 'felder');
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

    var p4b = gruppe(seite, 'Leeren', 'felder');
    p4b.reihe.appendChild(knopf('Alle Felder leeren', function () { stand.felder = stand.felder.map(function () { return 'none'; }); zeichnen(); markiere(p4.reihe, null); harmName.textContent = ''; }));

    var p5 = gruppe(seite, 'Bewegung', 'felder');
    var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Animation');
    [['einzeichnen', 'Einzeichnen – Bauteile nacheinander'], ['auseinander', 'Auseinander und zusammen'], ['atmen', 'Atmen'], ['keine', 'Stehend']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1]; if (stand.anim === o[0]) op.selected = true; sel.appendChild(op);
    });
    sel.onchange = function () { stand.anim = sel.value; abspielen(); };
    p5.reihe.appendChild(sel); p5.reihe.appendChild(knopf('Abspielen', abspielen));

    var p6 = gruppe(seite, 'Speichern');
    p6.reihe.appendChild(knopf('Als SVG speichern', function () { speichern(false); }, 'haupt'));
    p6.reihe.appendChild(knopf('Animierte SVG', function () { speichern(true); }));
    var glbK = knopf('3D als GLB', function () { dreiModul().then(function (m) { laden(m.glb(stand.bau.farben, stand.bau.an), 'caelum-stupa.glb', 'model/gltf-binary'); }); });
    glbK.setAttribute('data-glb', ''); p6.reihe.appendChild(glbK);

    // Malen: antippen oder mit gedrückter Maus/Finger darüberziehen
    svg.addEventListener('pointerdown', function (e) { malt = true; try { svg.setPointerCapture(e.pointerId); } catch (f) {} male(e); });
    svg.addEventListener('pointermove', function (e) { if (malt && stand.modus !== 'tippen') male(e); });
    svg.addEventListener('pointerup', function () { malt = false; merk(stand); });
    svg.addEventListener('pointercancel', function () { malt = false; });
    huelle.addEventListener('pointerdown', function (e) { if (e.target === huelle) zu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !huelle.hidden) zu(); });
    document.body.appendChild(huelle);
    werk(stand.werk === 'bauteile' ? 'bauteile' : 'felder');
  }
  function gruppe(wo, titel, nurWerk) { var d = document.createElement('div'), t = document.createElement('div'), r = document.createElement('div'); if (nurWerk) d.setAttribute('data-werk', nurWerk); t.className = 'titel'; t.textContent = titel; r.className = 'reihe'; d.appendChild(t); d.appendChild(r); wo.appendChild(d); return { reihe: r }; }
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
    if (stand.werk === 'bauteile' && buehne) {
      if (buehne.stand.ansicht !== 'logo' && buehne.stand.ansicht !== 'stupa') buehne.ansicht('logo');
      var datei2 = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Copyright © 2026 Caelum GmbH. Caelum-Logo aus der Logo-Werkstatt – Bauteile (LogoKit), Ansicht: ' + buehne.stand.ansicht + ' -->\n' +
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1024" height="1024">' + (animiert ? '<style>' + BAU_DATEI_CSS + '</style>' : '') + buehne.inhalt(animiert) + '</svg>\n';
      return laden(datei2, 'caelum-' + buehne.stand.ansicht + (animiert ? '-animiert' : '') + '.svg');
    }
    var kopf = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- Copyright © 2026 Caelum GmbH. Caelum-Logo aus der Logo-Werkstatt' + (animiert ? ', Bewegung: ' + stand.anim : '') + ' -->\n';
    var stil = animiert && stand.anim !== 'keine' ? '<style>' + ANIM_CSS_TEXT.replace(/\.werkstatt \.bild svg/g, 'svg') + '</style>' : '';
    var datei = kopf + '<svg xmlns="http://www.w3.org/2000/svg" viewBox="44 44 936 936" width="1024" height="1024"' + (animiert ? ' class="anim-' + stand.anim + '"' : '') + '>' + stil + inhalt(false) + '</svg>\n';
    laden(datei, 'caelum-logo' + (animiert ? '-' + stand.anim : '') + '.svg');
  }
  function laden(datei, name, typ) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([datei], { type: typ || 'image/svg+xml' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  // Linienfarbe aus „Caelum Optionen“ übernehmen (Kenny 20.11.2026): beim Öffnen gilt die Farbe des Startsignets.
  function optionenLinie() { try { return localStorage.getItem('caelum-logo-linie') || '#262624'; } catch (e) { return '#262624'; } }
  function auf(modus) {
    if (!huelle) bauen();
    stand.linie = optionenLinie();
    stand.felder = startFarben();   // beim Öffnen immer wie das Startbild (Kenny 21.11.2026)
    if (linienReihe) markiere(linienReihe, linienReihe.querySelector('[data-farbe="' + stand.linie + '"]'));
    zeichnen(); huelle.hidden = false; document.documentElement.style.overflow = 'hidden';
    werk(modus === 'bauteile' || modus === 'felder' ? modus : stand.werk === 'bauteile' ? 'bauteile' : 'felder');
    if (stand.werk === 'bauteile') { if (stand.bau.ansicht === '3d') { bauFarben(); starte3d(); } else buehne.aufbauen(stand.bau.ansicht !== 'stupa'); }
    huelle.querySelector('.x').focus({ preventScroll: true });
  }
  function zu() { if (!huelle || huelle.hidden) return; huelle.hidden = true; document.documentElement.style.overflow = ''; merk(stand); }
  window.CaelumWerkstatt = { oeffnen: auf, schliessen: zu };

  // --- Logo spielerisch unter der Seite (B 5): der Stupa baut sich auf, sobald man unten ankommt, und schiebt sich zum Logo.
  // Antippen wechselt Stupa ↔ Logo, ◇ öffnet die Werkstatt bei den Bauteilen.
  (function fuss() {
    var footer = document.querySelector('footer');
    if (!footer) return;
    var box = document.createElement('div'); box.className = 'stupa-fuss';
    var s = document.createElementNS(NS, 'svg'); s.setAttribute('role', 'button'); s.setAttribute('tabindex', '0');
    s.setAttribute('aria-label', 'Stupa und Logo: antippen wechselt');
    var t = document.createElementNS(NS, 'title'); t.textContent = 'Das Caelum-Logo ist der Stupa von oben – antippen wechselt';
    box.appendChild(s);
    var w = document.createElement('button'); w.type = 'button'; w.textContent = '◇'; w.title = 'Logo-Werkstatt'; w.setAttribute('aria-label', 'Logo-Werkstatt');
    w.onclick = function () { auf('bauteile'); };
    box.appendChild(w); footer.appendChild(box);
    var b = Buehne(s, 300, 300, { ansicht: 'stupa', grund: 'none', linie: '#E8E6E1', strich: 30 });
    s.insertBefore(t, s.firstChild);
    b.stand.an = [0, 0, 0, 0, 0]; b.farbe();
    function wechsel() { b.wechseln(); }
    s.addEventListener('click', wechsel);
    s.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wechsel(); } });
    function los() { b.stand.an = [1, 1, 1, 1, 1]; b.aufbauen(true); }
    if (!('IntersectionObserver' in window)) return los();
    var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); los(); } }, { threshold: 0.6 });
    io.observe(s);
  })();
})();
