// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// Hörprobe: lädt erst beim Aufklappen der Karte (aus webseite.html von Strang G ausgelagert, CSP ohne Inline-Skripte).
  for (const platz of document.querySelectorAll('[data-klangprobe]')) {
    const karte = platz.closest('details');
    const laden = async () => {
      if (platz.dataset.geladen) return;
      platz.dataset.geladen = '1';
      const basis = new URL(platz.dataset.klangprobe, location.href);
      try {
        const stil = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('klangprobe.css', basis).href });
        document.head.append(stil);
        const { mount } = await import(new URL('klangprobe.js', basis).href);
        platz.textContent = '';
        await mount(platz, { probe: new URL(platz.dataset.probe, basis).href });
      } catch (e) {
        platz.textContent = 'Hörprobe gerade nicht erreichbar.';
        console.warn('klangprobe:', e.message);
      }
    };
    if (karte.open) laden(); else karte.addEventListener('toggle', () => { if (karte.open) laden(); });
  }
