// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Montageverzeichnis (Kundenportal Caelum Gravur): Haken „montiert“ bleiben nach dem Neuladen erhalten
// (Wunsch Kenny 21.11.2026). Gespeichert im Browser (localStorage) je Baustelle (body data-montage) und Schild-Nr.
// Läuft als Datei von www.caelum.one/gravur (Vorschau aus dem Portal) und eingebettet in der heruntergeladenen Datei.
(function () {
  if (window.__caelumMontage) return;
  window.__caelumMontage = 1;
  function init() {
    var key = "caelum-montage:" + (document.body.getAttribute("data-montage") || "x"), st = {};
    try { st = JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch (e) { st = {}; }
    var boxes = document.querySelectorAll("input[data-m]");
    function upd() {
      var n = 0;
      boxes.forEach(function (c) { if (c.checked) n++; c.closest(".c") && c.closest(".c").classList.toggle("done", c.checked); });
      var el = document.getElementById("mCount");
      if (el) el.textContent = n + " von " + boxes.length + " montiert";
    }
    boxes.forEach(function (cb) {
      var k = cb.getAttribute("data-m");
      if (st[k]) cb.checked = true;
      cb.addEventListener("change", function () {
        if (cb.checked) st[k] = new Date().toISOString(); else delete st[k];
        try { localStorage.setItem(key, JSON.stringify(st)); } catch (e) { }
        upd();
      });
    });
    upd();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
