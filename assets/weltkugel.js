// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Weltkugel der Sprachwahl (Plan WEBSEITE-WELTKUGEL-MOND-PLAN.md, Kapitel 1): Canvas 2D, orthografische Projektion, eigener Code.
// Ziehen dreht (mit Trägheit), Mausrad/Pinch zoomt (1×–6×), Tippen auf ein Land zeigt seine Sprachen, Doppeltippen zoomt hinein.
// Tastatur: Pfeile drehen, + / − zoomen, Enter wählt das Land in der Mitte. Eigendrehung nur ohne prefers-reduced-motion.
// Länder: assets/welt/laender.json (Natural Earth 1:110m, gemeinfrei; erzeugt von CAELUM/tools/welt/laender.mjs). Kein fremder Server.
// Die Mond-Ansicht (Kapitel 2) nutzt dieselbe Kugel mit anderen Daten (art: 'mond').
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  // Basis aus der eigenen Skript-Adresse (Basis-Umbau 21.11.2026, GB-35): auf caelum.one /assets/, auf einem Landeplatz https://www.caelum.one/assets/
  var BASIS_ASSETS = (function () { try { return new URL(".", document.currentScript.src).href; } catch (e) { return "/assets/"; } })();
  var GRAD = Math.PI / 180, daten = null;
  function laden() {
    if (!daten) daten = fetch(BASIS_ASSETS + 'welt/laender.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j.l.map(vorbereiten); }).catch(function (e) { daten = null; throw e; });
    return daten;
  }
  // Ring (Grad × 10, flach) → je Punkt a = cos(lat)·cos(lon), b = cos(lat)·sin(lon), s = sin(lat); dazu Grenzen für die Trefferprüfung
  function vorbereiten(l) {
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    var ringe = l.p.map(function (f) {
      var n = f.length / 2, r = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var lon = f[2 * i] / 10, lat = f[2 * i + 1] / 10, cl = Math.cos(lat * GRAD);
        r[3 * i] = cl * Math.cos(lon * GRAD); r[3 * i + 1] = cl * Math.sin(lon * GRAD); r[3 * i + 2] = Math.sin(lat * GRAD);
        if (lon < x0) x0 = lon; if (lon > x1) x1 = lon; if (lat < y0) y0 = lat; if (lat > y1) y1 = lat;
      }
      return r;
    });
    return { c: l.c, n: l.n, s: l.s, roh: l.p, ringe: ringe, box: [x0, y0, x1, y1] };
  }
  function imLand(l, lon, lat) {
    var b = l.box; if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) return false;
    var x = lon * 10, y = lat * 10, drin = false;
    l.roh.forEach(function (f) {
      for (var i = 0, j = f.length - 2; i < f.length; j = i, i += 2) {
        var xi = f[i], yi = f[i + 1], xj = f[j], yj = f[j + 1];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) drin = !drin;
      }
    });
    return drin;
  }

  var REGIONEN = [['eu', 12, 50, 3.2], ['am', -78, 12, 1.25], ['af', 20, 3, 1.7], ['as', 92, 32, 1.55], ['oz', 140, -24, 2]];
  var WORTE = {
    de: ['Europa', 'Amerika', 'Afrika', 'Asien', 'Ozeanien', 'Ziehen dreht · Land antippen · doppelt tippen zoomt', 'Noch keine Sprache dieses Landes', 'Weltkugel der Sprachen'],
    en: ['Europe', 'Americas', 'Africa', 'Asia', 'Oceania', 'Drag to turn · tap a country · double-tap to zoom', 'No language of this country yet', 'Globe of languages'],
    fr: ['Europe', 'Amériques', 'Afrique', 'Asie', 'Océanie', 'Glisser pour tourner · toucher un pays · toucher deux fois pour zoomer', 'Pas encore de langue de ce pays', 'Globe des langues'],
    it: ['Europa', 'Americhe', 'Africa', 'Asia', 'Oceania', 'Trascina per ruotare · tocca un paese · doppio tocco per ingrandire', 'Nessuna lingua di questo paese per ora', 'Globo delle lingue'],
    es: ['Europa', 'América', 'África', 'Asia', 'Oceanía', 'Arrastra para girar · toca un país · doble toque para ampliar', 'Aún no hay ningún idioma de este país', 'Globo de idiomas'],
    'pt-PT': ['Europa', 'Américas', 'África', 'Ásia', 'Oceânia', 'Arrastar para rodar · tocar num país · tocar duas vezes para ampliar', 'Ainda não há nenhuma língua deste país', 'Globo das línguas'],
    ru: ['Европа', 'Америка', 'Африка', 'Азия', 'Океания', 'Тяните, чтобы вращать · нажмите на страну · двойное касание — приблизить', 'Языка этой страны пока нет', 'Глобус языков'],
    zh: ['欧洲', '美洲', '非洲', '亚洲', '大洋洲', '拖动旋转 · 点击国家 · 双击放大', '暂无该国家的语言', '语言地球仪'],
    ja: ['ヨーロッパ', 'アメリカ', 'アフリカ', 'アジア', 'オセアニア', 'ドラッグで回転 · 国をタップ · ダブルタップで拡大', 'この国の言語はまだありません', '言語の地球儀']
  };

  // --- Mond (Kapitel 2): Segmente = Bereiche der Zeichen, Krater = Sprachen, in denen sich die Seite als Code zeigt ---
  var mondDaten = null;
  function einheit(lon, lat) { var cl = Math.cos(lat * GRAD); return [cl * Math.cos(lon * GRAD), cl * Math.sin(lon * GRAD), Math.sin(lat * GRAD)]; }
  function punkte(liste) { var r = new Float32Array(liste.length * 3); liste.forEach(function (p, i) { r[3 * i] = p[0]; r[3 * i + 1] = p[1]; r[3 * i + 2] = p[2]; }); return r; }
  function kreis(lon, lat, rad) { // Kleinkreis auf der Kugel (Mittelpunkt, Winkelradius in Grad)
    var c = einheit(lon, lat), sl = Math.sin(lon * GRAD), cl = Math.cos(lon * GRAD), sb = Math.sin(lat * GRAD), cb = Math.cos(lat * GRAD);
    var e = [-sl, cl, 0], n = [-sb * cl, -sb * sl, cb], cr = Math.cos(rad * GRAD), sr = Math.sin(rad * GRAD), liste = [];
    for (var t = 0; t < 360; t += 12) {
      var ct = Math.cos(t * GRAD), st = Math.sin(t * GRAD);
      liste.push([c[0] * cr + (e[0] * ct + n[0] * st) * sr, c[1] * cr + (e[1] * ct + n[1] * st) * sr, c[2] * cr + (e[2] * ct + n[2] * st) * sr]);
    }
    return punkte(liste);
  }
  function mondLaden() {
    if (!mondDaten) mondDaten = fetch(BASIS_ASSETS + 'mond/mond.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) {
      j.bereiche.forEach(function (b) {
        var liste = [], lat;
        for (lat = -88; lat <= 88; lat += 4) liste.push(einheit(b.von, lat));
        for (lat = 88; lat >= -88; lat -= 4) liste.push(einheit(b.bis, lat));
        b.ring = punkte(liste);
        b.krater.forEach(function (k) { k.ring = kreis(k.lon, k.lat, k.r); k.v = einheit(k.lon, k.lat); k.bereich = b; });
      });
      // Zierkrater: fest gesät, damit der Mond immer gleich aussieht
      var saat = 7, zufall = function () { saat = (saat * 16807) % 2147483647; return saat / 2147483647; };
      j.deko = [];
      for (var i = 0; i < 64; i++) {
        var lon = zufall() * 360 - 180, lat2 = Math.asin(zufall() * 1.9 - 0.95) / GRAD, r = 1.2 + Math.pow(zufall(), 2.2) * 8;
        var frei = j.bereiche.every(function (b) { return b.krater.every(function (k) { var v = einheit(lon, lat2); return v[0] * k.v[0] + v[1] * k.v[1] + v[2] * k.v[2] < Math.cos((k.r + r + 2) * GRAD); }); });
        if (frei) j.deko.push(kreis(lon, lat2, r));
      }
      return j;
    }).catch(function (e) { mondDaten = null; throw e; });
    return mondDaten;
  }
  // B 4 (21.11.2026): Segment antippen zeigt den Inhalt des Bereichs – dieselbe Quelle wie die Bereichsseiten (/bereiche/bereiche.json),
  // übersetzt über CaelumSprache.t (Schlüssel = deutscher Satz, Wörterbücher aus unterseiten.mjs).
  var bereichDaten = null;
  function bereicheLaden() {
    if (!bereichDaten) bereichDaten = fetch(BASIS_ASSETS + '../bereiche/bereiche.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { var m = {}; (j.bereiche || []).forEach(function (b) { m[b.id] = b; }); return m; })
      .catch(function (e) { bereichDaten = null; throw e; });
    return bereichDaten;
  }
  var MOND_WORTE = {
    de: ['Ziehen dreht · Krater zeigt die Seite als Code', 'Seite als Text', 'Bereich öffnen', 'Mond der Bereiche', 'Male das Zeichen im Fusslogo, dann öffnet sich der Bereich.'],
    en: ['Drag to turn · a crater shows the page as code', 'Page as text', 'Open area', 'Moon of areas', 'Paint the sign in the footer logo to open this area.'],
    fr: ['Glisser pour tourner · un cratère montre la page en code', 'Page en texte', 'Ouvrir le domaine', 'Lune des domaines', 'Peins le signe dans le logo du pied de page pour ouvrir ce domaine.'],
    it: ['Trascina per ruotare · un cratere mostra la pagina come codice', 'Pagina come testo', 'Apri l’area', 'Luna delle aree', 'Dipingi il segno nel logo a piè di pagina per aprire quest’area.'],
    es: ['Arrastra para girar · un cráter muestra la página como código', 'Página como texto', 'Abrir área', 'Luna de las áreas', 'Pinta el signo en el logo del pie de página para abrir esta área.'],
    'pt-PT': ['Arrastar para rodar · uma cratera mostra a página como código', 'Página como texto', 'Abrir área', 'Lua das áreas', 'Pinta o sinal no logótipo do rodapé para abrir esta área.'],
    ru: ['Тяните, чтобы вращать · кратер покажет страницу как код', 'Страница как текст', 'Открыть раздел', 'Луна разделов', 'Раскрасьте знак в логотипе внизу страницы, чтобы открыть раздел.'],
    zh: ['拖动旋转 · 陨石坑以代码显示页面', '以文本显示页面', '打开区域', '区域之月', '在页脚标志中涂出符号即可打开此区域。'],
    ja: ['ドラッグで回転 · クレーターでページをコード表示', 'テキストで表示', 'エリアを開く', 'エリアの月', 'フッターのロゴに印を塗ると、このエリアが開きます。']
  };

  function erstelle(ort, o) {
    var spr = o.aktuell(), w = WORTE[spr] || WORTE.en, mond = o.art === 'mond', mw = MOND_WORTE[spr] || MOND_WORTE.en, mondJ = null;
    var ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var wurzel = document.createElement('div'); wurzel.className = 'kugel';
    var lw = document.createElement('canvas'); lw.className = 'kugel-bild'; lw.tabIndex = 0;
    lw.setAttribute('role', 'img'); lw.setAttribute('aria-label', mond ? mw[3] + ' · ' + mw[0] : w[7] + ' · ' + w[5]);
    if (mond) wurzel.classList.add('mond');
    var hinweis = document.createElement('div'); hinweis.className = 'kugel-hinweis'; hinweis.textContent = mond ? mw[0] : w[5];
    var reg = document.createElement('div'); reg.className = 'kugel-regionen';
    if (!mond) REGIONEN.forEach(function (r, i) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = w[i];
      b.onclick = function () { fliege(r[1], r[2], r[3]); }; reg.appendChild(b);
    });
    var karte = document.createElement('div'); karte.className = 'kugel-karte'; karte.setAttribute('aria-live', 'polite');
    wurzel.appendChild(lw); wurzel.appendChild(reg); wurzel.appendChild(hinweis); wurzel.appendChild(karte);
    ort.appendChild(wurzel);

    var ctx = lw.getContext('2d'), breite = 0, hoehe = 0, dpr = 1;
    var lam = 8, phi = 28, zoom = 1, laender = [], gewaehlt = null, fehler = false;
    var vl = 0, vp = 0, letzteHand = 0, flug = null, lauf = 0, aus = false, schmutzig = true;
    // Meine Sprache leuchtet: Länder, deren Sprachen die aktuelle Wahl enthalten
    var namen = null; try { namen = new Intl.DisplayNames([spr === 'pt-PT' ? 'pt-PT' : spr], { type: 'region' }); } catch (e) {}
    function name(l) { try { return (namen && namen.of(l.c)) || l.n; } catch (e) { return l.n; } }
    var da = {}; o.liste.forEach(function (s) { da[s[0]] = s[4]; });

    function groesse() {
      var r = wurzel.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1);
      breite = Math.max(200, Math.round(r.width)); hoehe = Math.round(breite * 0.78);
      lw.style.height = hoehe + 'px'; lw.width = breite * dpr; lw.height = hoehe * dpr; schmutzig = true;
    }
    function farbe(n, rueck) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || rueck; }

    function zeichne() {
      var R = Math.min(breite, hoehe) / 2 * 0.9 * zoom, cx = breite / 2, cy = hoehe / 2;
      var cL = Math.cos(lam * GRAD), sL = Math.sin(lam * GRAD), cP = Math.cos(phi * GRAD), sP = Math.sin(phi * GRAD);
      var akzent = farbe('--accent', '#D97757'), linie = farbe('--line', '#3a3a37'), text = farbe('--text', '#eee'), tief = farbe('--bg-deep', '#1c1c1a'), flaeche = farbe('--surface', '#30302e');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, breite, hoehe);
      if (mond) { zeichneMond(); return; }
      // Meer
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fillStyle = tief; ctx.fill();
      ctx.save(); ctx.clip();
      // Gradnetz alle 30°
      ctx.globalAlpha = 0.35; ctx.strokeStyle = linie; ctx.lineWidth = 0.6; ctx.beginPath();
      for (var g = -150; g <= 180; g += 30) linieZ(function (t) { return [g, t]; }, -90, 90);
      for (var b = -60; b <= 60; b += 30) linieZ(function (t) { return [t, b]; }, -180, 180);
      ctx.stroke(); ctx.globalAlpha = 1;
      function linieZ(f, a, e) {
        var oben = false;
        for (var t = a; t <= e; t += 3) {
          var p = f(t), cl = Math.cos(p[1] * GRAD), A = cl * Math.cos(p[0] * GRAD), B = cl * Math.sin(p[0] * GRAD), S = Math.sin(p[1] * GRAD);
          var cc = A * cL + B * sL, Z = sP * S + cP * cc;
          if (Z <= 0) { oben = false; continue; }
          var X = cx + R * (B * cL - A * sL), Y = cy - R * (cP * S - sP * cc);
          if (oben) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); oben = true;
        }
      }
      // Länder
      laender.forEach(function (l) {
        var sichtbar = false; ctx.beginPath();
        l.ringe.forEach(function (r) { if (ring(r)) sichtbar = true; });
        if (!sichtbar) return;
        var angeboten = l.s.some(function (c) { return da[c]; }), meine = l.s.indexOf(spr) >= 0;
        ctx.fillStyle = l === gewaehlt || meine || angeboten ? akzent : text;
        ctx.globalAlpha = l === gewaehlt ? 1 : meine ? 0.82 : angeboten ? 0.45 : l.s.length ? 0.2 : 0.09;
        ctx.fill('evenodd'); ctx.globalAlpha = 1;
        ctx.strokeStyle = l === gewaehlt ? text : flaeche; ctx.lineWidth = l === gewaehlt ? 1.4 : 0.6; ctx.stroke();
      });
      ctx.restore();
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.strokeStyle = linie; ctx.lineWidth = 1; ctx.stroke();

      function zeichneMond() {
        var grau = farbe('--faint', '#6E6C66'), hell = farbe('--muted', '#9C9A94'), code = o.code ? o.code() : null, offen = o.offen ? o.offen() : null;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.fillStyle = grau; ctx.fill();
        ctx.save(); ctx.clip();
        if (mondJ) {
          mondJ.bereiche.forEach(function (b, i) { // Segmente = Bereiche
            ctx.beginPath(); if (!ring(b.ring)) return;
            var an = b === gewaehlt;
            ctx.fillStyle = an || b.id === offen ? akzent : hell; ctx.globalAlpha = an ? 0.42 : b.id === offen ? 0.24 : i % 2 ? 0.3 : 0.12;
            ctx.fill(); ctx.globalAlpha = 0.75; ctx.strokeStyle = tief; ctx.lineWidth = 1.2; ctx.stroke(); ctx.globalAlpha = 1;
          });
          ctx.beginPath(); mondJ.deko.forEach(function (r) { ring(r); });
          ctx.fillStyle = tief; ctx.globalAlpha = 0.26; ctx.fill(); ctx.globalAlpha = 0.12; ctx.strokeStyle = text; ctx.lineWidth = 0.8; ctx.stroke(); ctx.globalAlpha = 1;
          mondJ.bereiche.forEach(function (b) {
            b.krater.forEach(function (k) {
              ctx.beginPath(); if (!ring(k.ring)) return;
              ctx.fillStyle = k.code === code ? akzent : tief; ctx.globalAlpha = k.code === code ? 0.9 : 0.6; ctx.fill(); ctx.globalAlpha = 1;
              ctx.strokeStyle = akzent; ctx.lineWidth = b === gewaehlt || k.code === code ? 2 : 1.3; ctx.stroke();
            });
          });
        }
        // Licht von oben links
        var g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, R * 0.1, cx, cy, R * 1.05);
        g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
        ctx.fillStyle = g; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
        // Beschriftung: Bereich oben im Segment, Sprache im Krater
        if (mondJ) {
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 4;
          mondJ.bereiche.forEach(function (b) {
            var m = (b.von + b.bis) / 2, p = punkt(m, 46);
            if (p[2] > 0.4) { ctx.globalAlpha = Math.min(1, (p[2] - 0.4) * 4); ctx.fillStyle = text; ctx.font = '600 ' + Math.round(12 + zoom) + 'px system-ui,sans-serif'; ctx.fillText(b.titel, p[0], p[1]); }
            b.krater.forEach(function (k) {
              var q = punkt(k.lon, k.lat); if (q[2] < 0.4) return;
              ctx.globalAlpha = Math.min(1, (q[2] - 0.4) * 4); ctx.fillStyle = k.code === code ? tief : text; ctx.shadowBlur = k.code === code ? 0 : 4;
              ctx.font = '700 ' + Math.round(10 + zoom * 1.5) + 'px ui-monospace,monospace'; var nm = mondJ.sprachen[k.code].name; ctx.fillText(nm.length > 6 ? k.code.toUpperCase() : nm, q[0], q[1]); ctx.shadowBlur = 4;
            });
          });
          ctx.globalAlpha = 1; ctx.shadowBlur = 0;
        }
        ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.strokeStyle = linie; ctx.lineWidth = 1; ctx.stroke();
      }
      function punkt(lon, lat) { // → Bildschirm x, y und Tiefe Z (> 0 = vorne)
        var v = einheit(lon, lat), cc = v[0] * cL + v[1] * sL;
        return [cx + R * (v[1] * cL - v[0] * sL), cy - R * (cP * v[2] - sP * cc), sP * v[2] + cP * cc];
      }

      // Ring zeichnen: sichtbare Punkte direkt, verdeckte Strecken laufen als Bogen am Rand (Horizont)
      function ring(r) {
        var n = r.length / 3, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), erster = -1, i;
        for (i = 0; i < n; i++) {
          var A = r[3 * i], B = r[3 * i + 1], S = r[3 * i + 2], cc = A * cL + B * sL;
          X[i] = B * cL - A * sL; Y[i] = cP * S - sP * cc; Z[i] = sP * S + cP * cc;
          if (erster < 0 && Z[i] > 0) erster = i;
        }
        if (erster < 0) return false;
        var raus = null;
        ctx.moveTo(cx + R * X[erster], cy - R * Y[erster]);
        for (var k = 1; k <= n; k++) {
          var j = (erster + k) % n, h = (erster + k - 1) % n;
          if (Z[j] > 0) {
            if (raus !== null) { var ein = rand(h, j); bogen(raus, ein); raus = null; }
            ctx.lineTo(cx + R * X[j], cy - R * Y[j]);
          } else if (Z[h] > 0) { raus = rand(h, j); ctx.lineTo(cx + R * Math.cos(raus), cy + R * Math.sin(raus)); }
        }
        ctx.closePath();
        return true;
        function rand(p, q) { // Schnittpunkt mit dem Horizont (Z = 0) als Winkel auf dem Bildschirm
          var t = Z[p] / (Z[p] - Z[q]), x = X[p] + t * (X[q] - X[p]), y = Y[p] + t * (Y[q] - Y[p]);
          return Math.atan2(-y, x);
        }
        function bogen(a, e) { var d = e - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; ctx.arc(cx, cy, R, a, a + d, d < 0); }
      }
    }

    function unter(px, py) { // Bildschirmpunkt → Länge/Breite (oder null neben der Kugel)
      var R = Math.min(breite, hoehe) / 2 * 0.9 * zoom, x = (px - breite / 2) / R, y = -(py - hoehe / 2) / R, q = x * x + y * y;
      if (q > 1) return null;
      var z = Math.sqrt(1 - q), cP = Math.cos(phi * GRAD), sP = Math.sin(phi * GRAD);
      var lat = Math.asin(y * cP + z * sP) / GRAD, lon = lam + Math.atan2(x, z * cP - y * sP) / GRAD;
      lon = ((lon + 540) % 360) - 180;
      return [lon, lat];
    }
    function mondBei(px, py) { // → { b: Bereich, k: Krater oder null }
      var p = unter(px, py); if (!p || !mondJ) return null;
      var v = einheit(p[0], p[1]), treffer = null;
      mondJ.bereiche.forEach(function (b) { b.krater.forEach(function (k) { if (v[0] * k.v[0] + v[1] * k.v[1] + v[2] * k.v[2] > Math.cos((k.r + 1) * GRAD)) treffer = { b: b, k: k }; }); });
      return treffer || { b: mondJ.bereiche.filter(function (b) { return p[0] >= b.von && p[0] < b.bis; })[0] || mondJ.bereiche[0], k: null };
    }
    function waehleBei(px, py) {
      if (!mond) { zeigeLand(landBei(px, py)); return; }
      var t = mondBei(px, py); if (!t) { zeigeBereich(null); return; }
      if (t.k) { gewaehlt = t.b; codeWahl(t.k.code); } else zeigeBereich(t.b);
    }
    function codeWahl(c) { if (o.waehleCode) o.waehleCode(c); schmutzig = true; }
    function zeigeBereich(b) {
      gewaehlt = b; schmutzig = true; karte.textContent = '';
      if (!b) return;
      var info = function (x) { return x[spr] || (spr === 'de' ? x.de : x.en); };
      var k = document.createElement('div'); k.className = 'kugel-land'; k.textContent = b.titel; karte.appendChild(k);
      var p = document.createElement('div'); p.className = 'kugel-leer'; p.textContent = info(b.info); karte.appendChild(p);
      var inhalt = document.createElement('div'); inhalt.className = 'kugel-inhalt'; karte.appendChild(inhalt);
      bereicheLaden().then(function (m) { if (gewaehlt === b && inhalt.isConnected) zeigeInhalt(inhalt, m[b.id]); }).catch(function () {});
      var knoepfe = document.createElement('div'); knoepfe.className = 'treffer'; var jetzt = o.code ? o.code() : null;
      b.krater.forEach(function (kr) {
        var s = mondJ.sprachen[kr.code], bt = document.createElement('button'); bt.type = 'button'; bt.className = 'spr';
        bt.innerHTML = '<span></span><small></small>'; bt.firstChild.textContent = s.name; bt.lastChild.textContent = info(s.info);
        bt.setAttribute('aria-pressed', String(jetzt === kr.code)); bt.onclick = function () { codeWahl(kr.code); };
        knoepfe.appendChild(bt);
      });
      if (jetzt) {
        var t = document.createElement('button'); t.type = 'button'; t.className = 'spr';
        t.innerHTML = '<span></span><small>Aa</small>'; t.firstChild.textContent = mw[1]; t.onclick = function () { codeWahl(null); };
        knoepfe.appendChild(t);
      }
      var z = window.CaelumZeichen, zg = z && z.offen() === b.id && z.liste.filter(function (x) { return x.name === b.id && x.href; })[0];
      if (zg) { var a = document.createElement('a'); a.className = 'spr'; a.href = zg.href; a.innerHTML = '<span></span><small>→</small>'; a.firstChild.textContent = mw[2]; knoepfe.appendChild(a); }
      karte.appendChild(knoepfe);
      if (!zg && z && z.liste.some(function (x) { return x.name === b.id && x.href; })) {
        var zu = document.createElement('div'); zu.className = 'kugel-zu'; zu.textContent = mw[4]; karte.appendChild(zu);
      }
    }
    function zeigeInhalt(ort, d) { // Überschrift, Text und Karten des Bereichs (ohne Links – die Seite öffnet erst das Zeichen)
      if (!d || !d.h1) return;
      var t = window.CaelumSprache && window.CaelumSprache.t ? window.CaelumSprache.t : function (x) { return x; };
      var h = document.createElement('div'); h.className = 'kugel-titel'; h.textContent = t(d.h1); ort.appendChild(h);
      if (d.text) { var x = document.createElement('div'); x.className = 'kugel-text'; x.textContent = t(d.text); ort.appendChild(x); }
      var liste = (d.karten || []).map(function (k) { return [k.titel, k.status]; });
      if (!liste.length && d.chat && d.chat.raeume) liste = d.chat.raeume.map(function (r) { return [r[1], null]; });
      if (!liste.length) return;
      var ul = document.createElement('ul'); ul.className = 'kugel-karten';
      liste.forEach(function (k) {
        var li = document.createElement('li'), n = document.createElement('span'); n.textContent = t(k[0]); li.appendChild(n);
        if (k[1]) { var st = document.createElement('small'); st.textContent = t(k[1]); li.appendChild(st); }
        ul.appendChild(li);
      });
      ort.appendChild(ul);
    }
    function landBei(px, py) { var p = unter(px, py); if (!p) return null; for (var i = 0; i < laender.length; i++) if (imLand(laender[i], p[0], p[1])) return laender[i]; return null; }

    function zeigeLand(l) {
      gewaehlt = l; schmutzig = true; karte.textContent = '';
      if (!l) return;
      var k = document.createElement('div'); k.className = 'kugel-land'; k.textContent = name(l); karte.appendChild(k);
      if (!l.s.length) { var p = document.createElement('div'); p.className = 'kugel-leer'; p.textContent = w[6]; karte.appendChild(p); return; }
      var knoepfe = document.createElement('div'); knoepfe.className = 'treffer';
      l.s.forEach(function (c) { var e = o.liste.filter(function (s) { return s[0] === c; })[0]; if (e) knoepfe.appendChild(o.knopf(e)); });
      karte.appendChild(knoepfe);
    }
    function fliege(l2, p2, z2) {
      var l1 = lam, p1 = phi, z1 = zoom, d = ((l2 - l1 + 540) % 360) - 180, t0 = performance.now();
      letzteHand = t0; vl = vp = 0;
      flug = function (t) {
        var u = Math.min(1, (t - t0) / (ruhig ? 1 : 750)), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        lam = l1 + d * e; phi = p1 + (p2 - p1) * e; zoom = z1 + (z2 - z1) * e; schmutzig = true;
        if (u >= 1) flug = null;
      };
    }

    // --- Bedienung ---
    var zeiger = {}, start = null, letzterTipp = null, pinch = null;
    function pos(e) { var r = lw.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    lw.addEventListener('pointerdown', function (e) {
      var P = pos(e);
      try { lw.setPointerCapture(e.pointerId); } catch (x) {} zeiger[e.pointerId] = [P[0], P[1]];
      flug = null; vl = vp = 0; letzteHand = performance.now();
      var ids = Object.keys(zeiger);
      if (ids.length === 1) start = { x: P[0], y: P[1], t: performance.now(), weg: 0 };
      else if (ids.length === 2) { start = null; var a = zeiger[ids[0]], b = zeiger[ids[1]]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoom }; }
    });
    lw.addEventListener('pointermove', function (e) {
      var P = pos(e);
      if (!zeiger[e.pointerId]) return;
      var alt = zeiger[e.pointerId], dx = P[0] - alt[0], dy = P[1] - alt[1]; zeiger[e.pointerId] = [P[0], P[1]];
      var ids = Object.keys(zeiger);
      if (ids.length === 2 && pinch) {
        var a = zeiger[ids[0]], b = zeiger[ids[1]];
        zoom = Math.max(1, Math.min(6, pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / Math.max(1, pinch.d))); schmutzig = true; return;
      }
      if (!start) return;
      start.weg += Math.abs(dx) + Math.abs(dy);
      var R = Math.min(breite, hoehe) / 2 * 0.9 * zoom;
      var dl = -dx / R / GRAD, dp = dy / R / GRAD; // ziehen nach rechts dreht die Kugel nach rechts
      lam += dl; phi = Math.max(-80, Math.min(80, phi + dp));
      vl = dl * 0.9 + vl * 0.1; vp = dp * 0.9 + vp * 0.1; letzteHand = performance.now(); schmutzig = true;
    });
    function los(e) {
      var P = pos(e);
      if (!zeiger[e.pointerId]) return;
      delete zeiger[e.pointerId];
      if (Object.keys(zeiger).length < 2) pinch = null;
      if (!start || e.type === 'pointercancel') { start = null; return; }
      var jetzt = performance.now();
      if (start.weg < 8 && jetzt - start.t < 500) {
        vl = vp = 0;
        if (letzterTipp && jetzt - letzterTipp.t < 320 && Math.hypot(P[0] - letzterTipp.x, P[1] - letzterTipp.y) < 24) {
          var p = unter(P[0], P[1]); if (p) fliege(p[0], Math.max(-70, Math.min(70, p[1])), Math.min(6, zoom * 2));
          letzterTipp = null;
        } else { letzterTipp = { t: jetzt, x: P[0], y: P[1] }; waehleBei(P[0], P[1]); }
      }
      start = null;
    }
    lw.addEventListener('pointerup', los); lw.addEventListener('pointercancel', los);
    lw.addEventListener('wheel', function (e) {
      e.preventDefault(); flug = null; letzteHand = performance.now();
      zoom = Math.max(1, Math.min(6, zoom * Math.exp(-e.deltaY * 0.0015))); schmutzig = true;
    }, { passive: false });
    lw.addEventListener('keydown', function (e) {
      var k = e.key, s = 12 / zoom; letzteHand = performance.now(); flug = null;
      if (k === 'ArrowLeft') lam -= s; else if (k === 'ArrowRight') lam += s;
      else if (k === 'ArrowUp') phi = Math.min(80, phi + s); else if (k === 'ArrowDown') phi = Math.max(-80, phi - s);
      else if (k === '+' || k === '=') zoom = Math.min(6, zoom * 1.25); else if (k === '-') zoom = Math.max(1, zoom / 1.25);
      else if (k === 'Enter' || k === ' ') waehleBei(breite / 2, hoehe / 2);
      else return;
      e.preventDefault(); e.stopPropagation(); schmutzig = true;
    });

    var vorher = 0;
    function schritt(t) {
      if (aus) return;
      var dt = vorher ? Math.min(0.05, (t - vorher) / 1000) : 0; vorher = t;
      if (flug) flug(t);
      else if (!start && (Math.abs(vl) > 0.01 || Math.abs(vp) > 0.01)) {
        lam += vl; phi = Math.max(-80, Math.min(80, phi + vp)); vl *= 0.93; vp *= 0.93; schmutzig = true;
      } else if (!ruhig && !gewaehlt && !start && t - letzteHand > 5000 && (laender.length || mondJ)) { lam += 5 * dt; schmutzig = true; }
      lam = ((lam + 540) % 360) - 180;
      if (schmutzig && breite) { schmutzig = false; zeichne(); }
      lauf = requestAnimationFrame(schritt);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(groesse) : null;
    if (ro) ro.observe(wurzel); else addEventListener('resize', groesse);
    groesse();
    // Start: bei der eigenen Sprache (Europa für DE/FR/IT/PT, sonst grob die Heimat)
    var heim = { en: [-30, 40, 1], es: [-30, 20, 1], ru: [60, 50, 1], zh: [110, 30, 1.2], ja: [130, 35, 1.4] }[spr];
    if (heim) { lam = heim[0]; phi = heim[1]; zoom = heim[2]; }
    if (mond) { lam = -120; phi = 12; zoom = 1; }
    lauf = requestAnimationFrame(schritt);
    if (mond) mondLaden().then(function (j) {
      if (aus) return; mondJ = j; schmutzig = true;
      j.bereiche.forEach(function (b) { // Schnellwahl der Bereiche statt Regionen
        var bt = document.createElement('button'); bt.type = 'button'; bt.textContent = b.titel;
        bt.onclick = function () { fliege((b.von + b.bis) / 2, 10, 1.4); zeigeBereich(b); }; reg.appendChild(bt);
      });
      var jetzt = o.code && o.code(); // aktive Code-Sprache: dorthin drehen
      if (jetzt) j.bereiche.forEach(function (b) { b.krater.forEach(function (k) { if (k.code === jetzt) { lam = k.lon; phi = k.lat; zeigeBereich(b); } }); });
    }).catch(function () { fehler = true; hinweis.textContent = 'Mond nicht geladen · moon not loaded'; });
    else laden().then(function (l) { if (aus) return; laender = l; schmutzig = true; })
      .catch(function () { fehler = true; hinweis.textContent = 'Weltkarte nicht geladen · globe not loaded'; });

    return {
      zerstoere: function () { aus = true; cancelAnimationFrame(lauf); if (ro) ro.disconnect(); else removeEventListener('resize', groesse); wurzel.remove(); },
      fliege: fliege,
      bei: function (px, py) { var l = landBei(px, py); return { punkt: unter(px, py), land: l && l.c }; },
      land: function (c) { var l = laender.filter(function (x) { return x.c === c; })[0]; zeigeLand(l || null); return !!l; },
      bereich: function (id) { var b = mondJ && mondJ.bereiche.filter(function (x) { return x.id === id; })[0]; zeigeBereich(b || null); return !!b; },
      neu: function () { schmutzig = true; if (gewaehlt && mond) zeigeBereich(gewaehlt); },
      zustand: function () { return { mond: mond, bereiche: mondJ ? mondJ.bereiche.length : 0, lam: lam, phi: phi, zoom: zoom, laender: laender.length, gewaehlt: gewaehlt && (gewaehlt.c || gewaehlt.id), fehler: fehler }; }
    };
  }
  window.CaelumWeltkugel = { erstelle: erstelle, laden: laden };
})();
