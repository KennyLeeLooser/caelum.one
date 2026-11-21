// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// „Die Seite als Code“ (Plan WEBSEITE-WELTKUGEL-MOND-PLAN.md, Kapitel 2): jeder Abschnitt der Startseite erscheint statt als Text
// in einer Sprache – HTML, CSS, JavaScript, JSON, C#, Python, Markdown, C++ (VST3) oder MIDI (midicsv, Bereich Sound Design 21.11.2026). Alles wird im Browser aus der Seite selbst erzeugt
// (gerade sichtbare Sprache), nie aus privaten Repos. Syntaxfarben folgen dem Logo (CaelumLogo), Schrift ui-monospace.
// API window.CaelumCode: zeige(code) · aus() · aktuell() · sprachen. Ereignis „caelum-code“ { code }.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser offen (GB-8).
(function () {
  'use strict';
  // Basis aus der eigenen Skript-Adresse (Basis-Umbau 21.11.2026, GB-35): auf caelum.one /assets/, auf einem Landeplatz https://www.caelum.one/assets/
  var BASIS_ASSETS = (function () { try { return new URL(".", document.currentScript.src).href; } catch (e) { return "/assets/"; } })();
  var SPRACHEN = [['html', 'HTML', 'html'], ['css', 'CSS', 'css'], ['js', 'JavaScript', 'js'], ['json', 'JSON', 'json'], ['cs', 'C#', 'cs'], ['py', 'Python', 'py'], ['md', 'Markdown', 'md'], ['cpp', 'C++', 'cpp'], ['midi', 'MIDI', 'mid.csv']];
  var root = document.documentElement, aktuell = null, leiste = null;
  // Stile in assets/als-code.css (eigene Datei wegen der strengen CSP der Unterseiten: style-src 'self', S46)
  if (!document.querySelector('link[data-caelum="assets/als-code.css"]')) {
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = BASIS_ASSETS + 'als-code.css?v=1'; css.setAttribute('data-caelum', 'assets/als-code.css');
    document.head.appendChild(css);
  }

  // --- Farben aus dem Logo (Harmonie), sonst Programmfarben der Seite ---
  function farben() {
    var f = [];
    try { var i = window.CaelumLogo && window.CaelumLogo.spektrum && window.CaelumLogo.spektrum(); if (i) f = (i.akzente || []).concat(i.farben || []); } catch (e) {}
    var namen = ['k', 's', 'n', 't', 'a'];
    namen.forEach(function (n, k) { if (f[k]) root.style.setProperty('--code-' + n, f[k]); else root.style.removeProperty('--code-' + n); });
  }
  document.addEventListener('caelum-spektrum', function () { if (aktuell) farben(); });

  // --- Abschnitte der Seite ---
  function bloecke() { return Array.prototype.slice.call(document.querySelectorAll('main > .hero, main > section, main > .wrap, body > footer')); }
  function kennung(el, i) { return el.id || (el.matches('.hero') ? 'start' : el.matches('main > .wrap') ? (document.querySelector('h1') ? document.querySelector('h1').textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'seite') : el.tagName === 'FOOTER' ? 'fusszeile' : 'abschnitt' + i); }
  function rein(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
  function sichtbar(el) { return !el.closest('[hidden],[aria-hidden="true"],.code-fassung,script,style,svg'); }
  // Inhalt eines Abschnitts als Daten: Titel, Texte, Punkte, Karten, Links
  function daten(el, i) {
    var d = { id: kennung(el, i), titel: '', texte: [], punkte: [], karten: [], links: [] };
    var h = el.querySelector('h1,h2'); if (h) d.titel = rein(h.textContent);
    Array.prototype.forEach.call(el.querySelectorAll('p'), function (p) { if (sichtbar(p) && !p.closest('.card,li')) { var t = rein(p.textContent); if (t) d.texte.push(t); } });
    Array.prototype.forEach.call(el.querySelectorAll('li'), function (li) { if (sichtbar(li) && !li.closest('.card')) { var t = rein(li.textContent); if (t && t.length < 220) d.punkte.push(t); } });
    Array.prototype.forEach.call(el.querySelectorAll('.card'), function (c) {
      if (!sichtbar(c)) return;
      var t = c.querySelector('h3,h4,b,strong'), p = c.querySelector('p');
      d.karten.push({ titel: rein(t && t.textContent), text: rein(p && p.textContent) });
    });
    Array.prototype.forEach.call(el.querySelectorAll('a[href]'), function (a) {
      if (!sichtbar(a) || a.closest('.card') && d.karten.length) return;
      var t = rein(a.textContent || a.getAttribute('aria-label')); if (t && d.links.length < 12) d.links.push({ text: t, href: a.getAttribute('href') });
    });
    d.texte = d.texte.slice(0, 12); d.punkte = d.punkte.slice(0, 20); d.karten = d.karten.slice(0, 16);
    return d;
  }

  // --- Erzeuger je Sprache ---
  function q(s) { return JSON.stringify(s); }
  var ERZEUGER = {
    html: function (el) {
      var aus = [];
      (function geh(n, tiefe) {
        if (aus.length > 500) return;
        var ein = new Array(tiefe + 1).join('  ');
        if (n.nodeType === 3) { var t = rein(n.nodeValue); if (t) aus.push(ein + t); return; }
        if (n.nodeType === 8) return;
        if (n.nodeType !== 1 || n.matches('script,style,.code-fassung')) return;
        var name = n.tagName.toLowerCase(), attr = Array.prototype.map.call(n.attributes, function (a) {
          var v = a.value; if (a.name === 'd' || a.name === 'points') v = v.slice(0, 28) + '…'; else if (v.length > 80) v = v.slice(0, 77) + '…';
          return ' ' + a.name + '="' + v + '"';
        }).join('');
        var kinder = Array.prototype.filter.call(n.childNodes, function (k) { return k.nodeType === 1 || (k.nodeType === 3 && rein(k.nodeValue)); });
        if (name === 'svg' && n.querySelectorAll('path').length > 3) { aus.push(ein + '<svg' + attr + '> <!-- ' + n.querySelectorAll('path').length + ' Pfade --> </svg>'); return; }
        if (!kinder.length) { aus.push(ein + '<' + name + attr + (/^(img|br|hr|input|meta|link|path|circle|rect|line|use)$/.test(name) ? ' />' : '></' + name + '>')); return; }
        if (kinder.length === 1 && kinder[0].nodeType === 3 && (name.length + attr.length + kinder[0].nodeValue.length) < 110) { aus.push(ein + '<' + name + attr + '>' + rein(kinder[0].nodeValue) + '</' + name + '>'); return; }
        aus.push(ein + '<' + name + attr + '>');
        kinder.forEach(function (k) { geh(k, tiefe + 1); });
        aus.push(ein + '</' + name + '>');
      })(el, 0);
      if (aus.length > 500) aus.push('<!-- … gekürzt -->');
      return aus.join('\n');
    },
    css: function (el) {
      var aus = [], gesehen = {};
      function passt(sel) {
        return sel.split(',').some(function (s) {
          s = s.replace(/::?[a-z-]+(\([^)]*\))?/gi, '').trim(); if (!s) return false;
          try { return el.matches(s) || !!el.querySelector(s); } catch (e) { return false; }
        });
      }
      function regel(r, ein) {
        if (aus.length > 400) return;
        if (r.selectorText) {
          if (gesehen[r.cssText] || !passt(r.selectorText)) return; gesehen[r.cssText] = 1;
          var teile = r.style.cssText.split(/;\s*/).filter(Boolean);
          aus.push(ein + r.selectorText.replace(/,\s*/g, ', ') + ' {'); teile.forEach(function (t) { aus.push(ein + '  ' + t + ';'); }); aus.push(ein + '}');
        } else if (r.cssRules && r.media) {
          var vorher = aus.length; aus.push(ein + '@media ' + r.media.mediaText + ' {');
          Array.prototype.forEach.call(r.cssRules, function (k) { regel(k, ein + '  '); });
          if (aus.length === vorher + 1) aus.pop(); else aus.push(ein + '}');
        }
      }
      Array.prototype.forEach.call(document.styleSheets, function (s) {
        var liste; try { liste = s.cssRules; } catch (e) { return; }
        Array.prototype.forEach.call(liste, function (r) { regel(r, ''); });
      });
      return '/* Regeln, die auf #' + kennung(el, 0) + ' wirken */\n' + (aus.join('\n') || '/* keine eigenen Regeln */');
    },
    json: function (el, i) { return JSON.stringify(daten(el, i), null, 2); },
    js: function (el, i) {
      var d = daten(el, i), n = d.id.replace(/-(\w)/g, function (m, c) { return c.toUpperCase(); });
      return '// Abschnitt „' + (d.titel || d.id) + '“ als Objekt\nexport const ' + n + ' = ' + objekt(d, '') + ';\n\n' +
        'document.getElementById(' + q(d.id) + ')?.scrollIntoView({ behavior: \'smooth\' });';
      function objekt(v, ein) {
        if (Array.isArray(v)) return v.length ? '[\n' + v.map(function (x) { return ein + '  ' + objekt(x, ein + '  '); }).join(',\n') + '\n' + ein + ']' : '[]';
        if (v && typeof v === 'object') return '{\n' + Object.keys(v).map(function (k) { return ein + '  ' + k + ': ' + objekt(v[k], ein + '  '); }).join(',\n') + '\n' + ein + '}';
        return typeof v === 'string' ? '\'' + v.replace(/\\/g, '\\\\').replace(/'/g, '\\\'') + '\'' : String(v);
      }
    },
    cs: function (el, i) {
      var d = daten(el, i), z = [];
      z.push('// Abschnitt „' + (d.titel || d.id) + '“ – so würde Pandora ihn halten');
      z.push('public record Karte(string Titel, string Text);');
      z.push('public record Link(string Text, string Href);');
      z.push('public record Abschnitt(string Id, string Titel, string[] Texte, string[] Punkte, Karte[] Karten, Link[] Links);');
      z.push('');
      z.push('var ' + d.id.replace(/-/g, '_') + ' = new Abschnitt(');
      z.push('    Id: ' + q(d.id) + ',');
      z.push('    Titel: ' + q(d.titel) + ',');
      z.push('    Texte: [' + liste(d.texte, function (t) { return q(t); }) + '],');
      z.push('    Punkte: [' + liste(d.punkte, function (t) { return q(t); }) + '],');
      z.push('    Karten: [' + liste(d.karten, function (k) { return 'new(' + q(k.titel) + ', ' + q(k.text) + ')'; }) + '],');
      z.push('    Links: [' + liste(d.links, function (l) { return 'new(' + q(l.text) + ', ' + q(l.href) + ')'; }) + ']);');
      return z.join('\n');
      function liste(l, f) { return l.length ? '\n        ' + l.map(f).join(',\n        ') + '\n    ' : ''; }
    },
    py: function (el, i) {
      var d = daten(el, i), z = [];
      z.push('# Abschnitt „' + (d.titel || d.id) + '“ – so würde ein Blender-Skript ihn halten');
      z.push('from dataclasses import dataclass, field');
      z.push('');
      z.push('@dataclass');
      z.push('class Abschnitt:');
      z.push('    id: str');
      z.push('    titel: str = ""');
      ['texte', 'punkte', 'karten', 'links'].forEach(function (k) { z.push('    ' + k + ': list = field(default_factory=list)'); });
      z.push('');
      z.push(d.id.replace(/-/g, '_') + ' = Abschnitt(');
      z.push('    id=' + q(d.id) + ',');
      z.push('    titel=' + q(d.titel) + ',');
      z.push('    texte=[' + liste(d.texte, q) + '],');
      z.push('    punkte=[' + liste(d.punkte, q) + '],');
      z.push('    karten=[' + liste(d.karten, function (k) { return '{"titel": ' + q(k.titel) + ', "text": ' + q(k.text) + '}'; }) + '],');
      z.push('    links=[' + liste(d.links, function (l) { return '(' + q(l.text) + ', ' + q(l.href) + ')'; }) + '],');
      z.push(')');
      return z.join('\n');
      function liste(l, f) { return l.length ? '\n        ' + l.map(f).join(',\n        ') + ',\n    ' : ''; }
    },
    cpp: function (el, i) {
      var d = daten(el, i), z = [], ns = d.id.replace(/-/g, '_');
      z.push('// Abschnitt „' + (d.titel || d.id) + '“ – so würde ein VST3-Plugin (Caelum Motion) ihn halten');
      z.push('#include <array>');
      z.push('#include <string_view>');
      z.push('');
      z.push('struct Karte { std::string_view titel, text; };');
      z.push('struct Link  { std::string_view text, href; };');
      z.push('');
      z.push('namespace caelum::' + ns + ' {');
      z.push('    constexpr std::string_view id    = ' + q(d.id) + ';');
      z.push('    constexpr std::string_view titel = ' + q(d.titel) + ';');
      feld('std::string_view', 'texte', d.texte, q);
      feld('std::string_view', 'punkte', d.punkte, q);
      feld('Karte', 'karten', d.karten, function (k) { return '{ ' + q(k.titel) + ', ' + q(k.text) + ' }'; });
      feld('Link', 'links', d.links, function (l) { return '{ ' + q(l.text) + ', ' + q(l.href) + ' }'; });
      z.push('    // je Karte ein Parameter, 0.0 … 1.0 wie in der DAW');
      z.push('    constexpr int parameterAnzahl = ' + d.karten.length + ';');
      z.push('}');
      return z.join('\n');
      function feld(typ, name, l, f) {
        if (!l.length) return;
        z.push('    constexpr std::array<' + typ + ', ' + l.length + '> ' + name + ' {{');
        l.forEach(function (x, k) { z.push('        ' + f(x) + (k < l.length - 1 ? ',' : '')); });
        z.push('    }};');
      }
    },
    midi: function (el, i) {
      // midicsv-Format (Text-Fassung einer .mid-Datei): Titel = Spurname, Texte = Text-Ereignisse, jede Karte = Marker + Note.
      var d = daten(el, i), z = [], t = 0, schritt = 480;
      function s(x) { return '"' + String(x).replace(/"/g, '""') + '"'; }
      function ton(x) { var h = 0; for (var k = 0; k < x.length; k++) h = (h * 31 + x.charCodeAt(k)) % 997; return [60, 62, 64, 67, 69, 72, 74, 76][h % 8]; } // C-Dur pentatonisch
      z.push('0, 0, Header, 1, 1, ' + schritt);
      z.push('1, 0, Start_track');
      z.push('1, 0, Title_t, ' + s(d.titel || d.id));
      z.push('1, 0, Tempo, 500000');
      z.push('1, 0, Time_signature, 4, 2, 24, 8');
      d.texte.forEach(function (x) { z.push('1, ' + t + ', Text_t, ' + s(x)); });
      var noten = d.karten.length ? d.karten.map(function (k) { return k.titel; }) : d.punkte.length ? d.punkte : d.links.map(function (l) { return l.text; });
      noten.forEach(function (n) {
        var p = ton(n), lang = n.length > 24 ? schritt * 2 : schritt;
        z.push('1, ' + t + ', Marker_t, ' + s(n));
        z.push('1, ' + t + ', Note_on_c, 0, ' + p + ', ' + (70 + n.length % 40));
        t += lang; z.push('1, ' + t + ', Note_off_c, 0, ' + p + ', 0');
      });
      z.push('1, ' + t + ', End_track');
      z.push('0, 0, End_of_file');
      return z.join('\n');
    },
    md: function (el, i) {
      var d = daten(el, i), z = [];
      z.push((el.matches('.hero') ? '# ' : '## ') + (d.titel || d.id)); z.push('');
      d.texte.forEach(function (t) { z.push(t); z.push(''); });
      d.punkte.forEach(function (t) { z.push('- ' + t); }); if (d.punkte.length) z.push('');
      d.karten.forEach(function (k) { z.push('### ' + k.titel); if (k.text) z.push(k.text); z.push(''); });
      d.links.forEach(function (l) { z.push('- [' + l.text + '](' + l.href + ')'); });
      return z.join('\n').replace(/\n+$/, '');
    }
  };

  // --- Syntaxfarben: kleiner Tokenizer je Sprache (kein fremdes Paket) ---
  var KW = {
    js: 'export|const|let|var|function|return|new|document|true|false|null',
    cs: 'public|record|string|var|new|class|true|false|null',
    py: 'from|import|class|def|return|True|False|None|field|dataclass|str|list',
    cpp: 'include|struct|namespace|constexpr|int|std|array|string_view|return'
  };
  var MUSTER = {
    html: [[/<!--[\s\S]*?-->/, 'c'], [/<\/?[a-zA-Z][\w-]*|\/?>/, 't'], [/[\w-:]+(?==")/, 'a'], [/"[^"]*"/, 's']],
    css: [[/\/\*[\s\S]*?\*\//, 'c'], [/@[\w-]+/, 'k'], [/^\s*[^{};\n]+(?=\s*\{)/m, 't'], [/[\w-]+(?=\s*:)/, 'a'], [/#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(px|em|rem|%|s|ms|vh|vw|deg|fr)?\b/, 'n'], [/"[^"]*"|'[^']*'/, 's'], [/[{}();]/, 'p']],
    json: [[/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'a'], [/"(?:[^"\\]|\\.)*"/, 's'], [/-?\d+(\.\d+)?/, 'n'], [/\b(true|false|null)\b/, 'k'], [/[{}\[\],:]/, 'p']],
    md: [[/^#{1,6} .*$/m, 't'], [/^- /m, 'k'], [/\[[^\]]*\]/, 's'], [/\([^)]*\)/, 'a']],
    midi: [[/"(?:[^"]|"")*"/, 's'], [/\b(Header|Start_track|End_track|End_of_file)\b/, 'k'], [/\b[A-Z][a-z]+(?:_[a-z]+)*_[a-z]\b|\bTempo\b|\bTime_signature\b/, 't'], [/\b\d+\b/, 'n'], [/,/, 'p']]
  };
  ['js', 'cs', 'py', 'cpp'].forEach(function (s) {
    MUSTER[s] = [[s === 'py' ? /#.*$/m : /\/\/.*$/m, 'c'], [/^#include\b.*$/m, 'k'], [/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/, 's'], [new RegExp('\\b(' + KW[s] + ')\\b'), 'k'],
      [/@\w+/, 'k'], [/\b[A-Z][A-Za-z]+\b/, 't'], [/\b\w+(?=\s*[:=](?!=))/, 'a'], [/\b\d+(\.\d+)?\b/, 'n'], [/[{}\[\]();,]/, 'p']];
  });
  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function farbig(text, s) {
    var m = MUSTER[s], gross = new RegExp(m.map(function (x) { return '(' + x[0].source + ')'; }).join('|'), 'gm'), aus = '', bis = 0, r;
    while ((r = gross.exec(text))) {
      if (!r[0]) { gross.lastIndex++; continue; }
      var k = 1; while (r[k] === undefined) k++;
      // Gruppen in den Mustern selbst verschieben die Zählung: Klasse über die Reihenfolge der äusseren Gruppen bestimmen
      var nr = 0, zaehl = 1; for (var j = 0; j < m.length; j++) { if (zaehl === k) { nr = j; break; } zaehl += 1 + gruppen(m[j][0]); }
      aus += esc(text.slice(bis, r.index)) + '<span class="t-' + m[nr][1] + '">' + esc(r[0]) + '</span>'; bis = r.index + r[0].length;
    }
    return aus + esc(text.slice(bis));
  }
  function gruppen(re) { return (new RegExp(re.source + '|')).exec('').length - 1; }

  // --- Umschalten ---
  function name(c) { return (SPRACHEN.filter(function (s) { return s[0] === c; })[0] || [c, c])[1]; }
  function aufbauen() {
    weg();
    bloecke().forEach(function (el, i) {
      var text; try { text = ERZEUGER[aktuell](el, i); } catch (e) { text = '/* ' + e.message + ' */'; }
      var f = document.createElement('figure'); f.className = 'code-fassung'; f.setAttribute('translate', 'no');
      var kopf = document.createElement('div'); kopf.className = 'kopf';
      var datei = kennung(el, i) + '.' + (SPRACHEN.filter(function (s) { return s[0] === aktuell; })[0] || ['', '', 'txt'])[2];
      kopf.innerHTML = '<b></b><span></span><button type="button" title="Kopieren · Copy" aria-label="Kopieren · Copy">⧉</button>';
      kopf.firstChild.textContent = datei; kopf.children[1].textContent = name(aktuell);
      kopf.lastChild.onclick = function () {
        var b = this; try { navigator.clipboard.writeText(text).then(function () { b.textContent = '✓'; setTimeout(function () { b.textContent = '⧉'; }, 1400); }); } catch (e) {}
      };
      var pre = document.createElement('pre'), code = document.createElement('code'); pre.tabIndex = 0;
      pre.setAttribute('aria-label', name(aktuell) + ': ' + datei); code.className = 'language-' + aktuell; code.innerHTML = farbig(text, aktuell);
      pre.appendChild(code); f.appendChild(kopf); f.appendChild(pre);
      el.parentNode.insertBefore(f, el); el.classList.add('code-versteckt');
    });
  }
  function weg() {
    Array.prototype.forEach.call(document.querySelectorAll('.code-fassung'), function (f) { f.remove(); });
    Array.prototype.forEach.call(document.querySelectorAll('.code-versteckt'), function (e) { e.classList.remove('code-versteckt'); });
  }
  function leisteBauen() {
    if (leiste) leiste.remove();
    leiste = document.createElement('div'); leiste.className = 'code-leiste'; leiste.setAttribute('role', 'toolbar'); leiste.setAttribute('aria-label', 'Seite als Code');
    leiste.setAttribute('translate', 'no');
    SPRACHEN.forEach(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = s[0] === 'js' ? 'JS' : s[1] === 'Markdown' ? 'MD' : s[1] === 'Python' ? 'PY' : s[1];   // C++ und MIDI bleiben ausgeschrieben
      b.title = s[1]; b.setAttribute('aria-pressed', String(s[0] === aktuell)); b.onclick = function () { zeige(s[0]); }; leiste.appendChild(b);
    });
    var t = document.createElement('button'); t.type = 'button'; t.className = 'text'; t.textContent = 'Aa Text'; t.title = 'Seite als Text'; t.onclick = aus;
    leiste.appendChild(t); document.body.appendChild(leiste);
  }
  function zeige(c) {
    if (!c) { aus(); return; }
    if (!ERZEUGER[c]) return;
    var oben = scrollY;
    aktuell = c; root.setAttribute('data-code', c); farben(); aufbauen(); leisteBauen(); scrollTo(0, Math.min(oben, document.body.scrollHeight));
    document.dispatchEvent(new CustomEvent('caelum-code', { detail: { code: c } }));
  }
  function aus() {
    if (!aktuell) return;
    aktuell = null; root.removeAttribute('data-code'); weg(); if (leiste) { leiste.remove(); leiste = null; }
    document.dispatchEvent(new CustomEvent('caelum-code', { detail: { code: null } }));
  }
  // andere Sprache gewählt → Code aus dem neuen Text neu erzeugen
  document.addEventListener('caelum-sprache', function () { if (aktuell) setTimeout(function () { var c = aktuell; aktuell = null; weg(); zeige(c); }, 50); });
  window.CaelumCode = { zeige: zeige, aus: aus, aktuell: function () { return aktuell; }, sprachen: SPRACHEN };
})();
