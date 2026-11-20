// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Caelum Community – Chat für Entwickler. Eigener Dienst: Apps Script „Caelum Community“ (Webseite-Google/Community.gs).
// Lesen kann jeder, schreiben nach Anmeldung mit Google (ID-Token) oder GitHub (OAuth-Code → Server tauscht ihn).
// Der Dienst gibt danach ein eigenes Sitzungs-Token (signiert, 7 Tage). E-Mail-Adressen verlässt der Server nie.
// Alles wird mit textContent gezeigt (kein HTML aus dem Chat). KI-Beitrag (Claude, GB-7), 20.11.2026 – Freigabe GB-8 ausstehend.
(function () {
  'use strict';
  var SITZUNG = 'caelum-chat-sitzung', RAUM = 'caelum-chat-raum', MAX = 1000, TAKT = 6000;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function lies(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function schreib(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function zeit(ms) {
    var d = new Date(ms), heute = new Date();
    var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return d.toDateString() === heute.toDateString() ? hm : ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '. ' + hm;
  }

  function start(platz, cfg) {
    var url = cfg.url || '';
    var sitzung = lies(SITZUNG);
    if (sitzung && sitzung.bis && sitzung.bis < Date.now()) { sitzung = null; schreib(SITZUNG, null); }
    var raeume = cfg.raeume && cfg.raeume.length ? cfg.raeume : [['allgemein', 'Allgemein']];
    var raum = lies(RAUM) || raeume[0][0];
    if (!raeume.some(function (r) { return r[0] === raum; })) raum = raeume[0][0];
    var letzte = 0, gesehen = {}, timer = null;

    var box = el('div', 'chat');
    var leiste = el('div', 'raeume'); leiste.setAttribute('role', 'group'); leiste.setAttribute('aria-label', 'Räume');
    var verlauf = el('div', 'verlauf');
    var liste = el('div', 'liste'); liste.setAttribute('role', 'log'); liste.setAttribute('aria-live', 'polite');
    var eingabe = el('div', 'eingabe');
    verlauf.appendChild(liste); verlauf.appendChild(eingabe);
    box.appendChild(leiste); box.appendChild(verlauf);
    platz.textContent = ''; platz.appendChild(box);

    raeume.forEach(function (r) {
      var b = el('button', null, '# ' + r[1]); b.type = 'button'; b.dataset.raum = r[0];
      b.setAttribute('aria-pressed', String(r[0] === raum));
      b.onclick = function () { if (raum === r[0]) return; raum = r[0]; schreib(RAUM, raum); markieren(); neuLaden(); };
      leiste.appendChild(b);
    });
    function markieren() { Array.prototype.forEach.call(leiste.children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.raum === raum)); }); }

    function hinweis(t) { liste.textContent = ''; liste.appendChild(el('p', 'hinweis', t)); }

    function rufen(daten) {
      return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(daten) })
        .then(function (r) { return r.json(); });
    }

    function zeigen(n) {
      if (gesehen[n.id]) return;
      gesehen[n.id] = 1;
      var m = el('div', 'msg');
      var wer = el('div', 'wer');
      wer.appendChild(el('b', null, n.name || 'Gast'));
      if (n.quelle) wer.appendChild(el('i', null, n.quelle === 'github' ? 'GitHub' : 'Google'));
      wer.appendChild(el('span', null, zeit(n.zeit)));
      m.appendChild(wer); m.appendChild(el('p', null, n.text));
      var unten = liste.scrollHeight - liste.scrollTop - liste.clientHeight < 40;
      if (liste.firstChild && liste.firstChild.className === 'hinweis') liste.textContent = '';
      liste.appendChild(m);
      if (unten) liste.scrollTop = liste.scrollHeight;
      if (n.zeit > letzte) letzte = n.zeit;
    }

    function holen() {
      if (!url || document.hidden) return;
      var fuer = raum;
      rufen({ aktion: 'lesen', raum: raum, seit: letzte }).then(function (r) {
        if (fuer !== raum) return;
        if (!r.ok) { if (!letzte) hinweis(r.fehler || 'Der Chat antwortet gerade nicht.'); return; }
        if (!r.nachrichten.length && !letzte) hinweis('Noch keine Nachrichten in diesem Raum. Schreib die erste!');
        r.nachrichten.forEach(zeigen);
        liste.scrollTop = liste.scrollHeight;
      }).catch(function () { if (!letzte) hinweis('Der Chat ist gerade nicht erreichbar.'); });
    }
    function neuLaden() {
      letzte = 0; gesehen = {}; hinweis('Nachrichten werden geladen …');
      clearInterval(timer); holen(); timer = setInterval(holen, TAKT);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) holen(); });

    // --- Eingabe oder Anmeldung ---
    function eingabeBauen() {
      eingabe.textContent = '';
      if (!url) { eingabe.appendChild(el('p', 'hinweis', 'Der Chat wird gerade eingerichtet. Bald kannst du hier mit Google oder GitHub mitschreiben.')); return; }
      if (sitzung) {
        var ich = el('div', 'ich');
        ich.appendChild(el('span', null, 'Angemeldet als ' + sitzung.name + ' (' + (sitzung.quelle === 'github' ? 'GitHub' : 'Google') + ')'));
        var ab = el('a', null, 'Abmelden'); ab.href = '#'; ab.onclick = function (e) { e.preventDefault(); sitzung = null; schreib(SITZUNG, null); eingabeBauen(); };
        ich.appendChild(ab); eingabe.appendChild(ich);
        var t = el('textarea'); t.maxLength = MAX; t.rows = 2; t.placeholder = 'Nachricht an #' + raum; t.title = 'Enter sendet, Shift+Enter neue Zeile';
        t.setAttribute('aria-label', 'Nachricht');
        var s = el('button', 'k', 'Senden'); s.type = 'button';
        function senden() {
          var text = t.value.trim();
          if (!text) return;
          s.disabled = true;
          rufen({ aktion: 'senden', token: sitzung.token, raum: raum, text: text }).then(function (r) {
            s.disabled = false;
            if (r.ok) { t.value = ''; if (r.nachricht) zeigen(r.nachricht); liste.scrollTop = liste.scrollHeight; t.focus(); }
            else if (r.abgelaufen) { sitzung = null; schreib(SITZUNG, null); eingabeBauen(); }
            else alert(r.fehler || 'Senden ging nicht.');
          }).catch(function () { s.disabled = false; alert('Senden ging nicht – bitte später nochmals.'); });
        }
        s.onclick = senden;
        t.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); senden(); } });
        eingabe.appendChild(t); eingabe.appendChild(s);
        return;
      }
      var an = el('div', 'anmelden');
      an.appendChild(el('span', 'hinweis', 'Zum Schreiben anmelden:'));
      if (cfg.googleClientId) {
        var g = el('div'); g.id = 'chat-google'; an.appendChild(g);
        googleKnopf(g);
      }
      if (cfg.githubClientId) {
        var gh = el('button', 'k zweit', 'Mit GitHub anmelden'); gh.type = 'button';
        gh.onclick = function () {
          var st = Math.random().toString(36).slice(2) + Date.now().toString(36);
          try { sessionStorage.setItem('caelum-chat-state', st); } catch (e) {}
          location.href = 'https://github.com/login/oauth/authorize?client_id=' + encodeURIComponent(cfg.githubClientId) +
            '&redirect_uri=' + encodeURIComponent(location.origin + '/community/') + '&state=' + st + '&allow_signup=true';
        };
        an.appendChild(gh);
      }
      eingabe.appendChild(an);
    }

    function angemeldet(r) {
      if (!r.ok) { alert(r.fehler || 'Anmeldung ging nicht.'); return; }
      sitzung = { token: r.token, name: r.name, quelle: r.quelle, bis: r.bis };
      schreib(SITZUNG, sitzung); eingabeBauen();
    }

    function googleKnopf(ziel) {
      function los() {
        google.accounts.id.initialize({ client_id: cfg.googleClientId, ux_mode: 'popup', callback: function (c) {
          rufen({ aktion: 'google', idToken: c.credential }).then(angemeldet).catch(function () { alert('Anmeldung ging nicht.'); });
        } });
        google.accounts.id.renderButton(ziel, { theme: 'filled_black', size: 'medium', text: 'signin_with', shape: 'pill' });
      }
      if (window.google && google.accounts && google.accounts.id) return los();
      var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = los;
      s.onerror = function () { ziel.textContent = 'Google ist gerade nicht erreichbar.'; };
      document.head.appendChild(s);
    }

    // Rückkehr von GitHub: ?code=…&state=…
    var q = new URLSearchParams(location.search);
    if (url && q.get('code')) {
      var soll = ''; try { soll = sessionStorage.getItem('caelum-chat-state') || ''; sessionStorage.removeItem('caelum-chat-state'); } catch (e) {}
      var code = q.get('code'), st = q.get('state');
      history.replaceState(null, '', location.pathname + '#chat');
      if (soll && st === soll) rufen({ aktion: 'github', code: code }).then(angemeldet).catch(function () { alert('GitHub-Anmeldung ging nicht.'); });
      else alert('GitHub-Anmeldung abgebrochen (Prüfwert passt nicht).');
    }

    eingabeBauen();
    if (url) neuLaden();
    else hinweis('Vorschau: Hier erscheinen die Nachrichten, sobald der Chat-Dienst eingerichtet ist.');
  }

  window.CaelumChat = { start: start };
  document.dispatchEvent(new Event('caelum-chat-bereit'));
})();
