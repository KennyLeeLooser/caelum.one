// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Spielt eine Unity-WebGL-Demo aus /developer/<ordner>/Build/<name>.* ab (Eintrag in /developer/demos.json, Feld webgl).
// Lädt nur Dateien von der eigenen Adresse; der Unity-Lader kommt aus dem Build selbst.
// KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe durch Kenny Looser ausstehend (GB-8).
(function () {
  'use strict';
  var id = new URLSearchParams(location.search).get('id') || '';
  var meldung = document.getElementById('meldung'), balken = document.getElementById('balken'), laden = document.getElementById('laden');
  var canvas = document.getElementById('unity-canvas'), vollbild = document.getElementById('vollbild');
  function fehler(text) { meldung.textContent = text; balken.parentNode.hidden = true; }
  if (!/^[a-z0-9-]{1,40}$/.test(id)) { fehler('Diese Demo gibt es nicht.'); return; }

  fetch('/developer/demos.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (j) {
      var d = (j.demos || []).filter(function (x) { return x.id === id; })[0];
      if (!d) return fehler('Diese Demo gibt es nicht.');
      document.title = d.titel + ' · Developer · Caelum GmbH';
      document.getElementById('titel').textContent = d.titel;
      var w = d.webgl;
      if (!w || !/^[a-z0-9-]{1,40}$/.test(w.ordner || '') || !/^[A-Za-z0-9_.-]{1,60}$/.test(w.name || ''))
        return fehler('Für ' + d.titel + ' gibt es noch keine Web-Fassung.');
      if (!window.WebAssembly) return fehler('Dieser Browser kann keine WebGL-Spiele abspielen (WebAssembly fehlt).');
      var basis = '/developer/' + w.ordner + '/Build/' + w.name, endung = w.endung || '';   // endung z. B. '.unityweb' oder ''
      var s = document.createElement('script');
      s.src = basis + '.loader.js';
      s.onerror = function () { fehler('Die Demo konnte nicht geladen werden.'); };
      s.onload = function () {
        if (typeof window.createUnityInstance !== 'function') return fehler('Die Demo konnte nicht gestartet werden.');
        window.createUnityInstance(canvas, {
          dataUrl: basis + '.data' + endung,
          frameworkUrl: basis + '.framework.js' + endung,
          codeUrl: basis + '.wasm' + endung,
          companyName: 'Caelum GmbH', productName: d.titel, productVersion: w.version || '1',
          devicePixelRatio: Math.min(2, window.devicePixelRatio || 1)
        }, function (p) { balken.style.width = Math.round(p * 100) + '%'; })
          .then(function (inst) {
            laden.hidden = true; canvas.focus();
            vollbild.hidden = false;
            vollbild.addEventListener('click', function () { inst.SetFullscreen(1); });
          })
          .catch(function () { fehler('Die Demo konnte nicht gestartet werden.'); });
      };
      document.body.appendChild(s);
    })
    .catch(function () { fehler('Die Demo-Liste konnte nicht geladen werden.'); });
})();
