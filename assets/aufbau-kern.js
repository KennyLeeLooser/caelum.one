// Copyright © 2026 Caelum GmbH, Kenny Looser. Alle Rechte vorbehalten.
// KI-Beitrag (Claude, GB-7), 22.11.2026 – Freigabe durch einen Menschen ausstehend (GB-8).
//
// Caelum Aufbau-Kern – das Aufräum-Spiel ohne Bild (Wunsch Kenny 22.11.2026: „einmal bauen, aber gut, und immer im Browser
// verwenden“). Teile liegen verstreut, man zieht sie mit Maus oder Finger; sie fallen, rollen, kippen und pendeln am Griff.
// Liegt ein Teil nahe genug an seinem Platz UND ist das Teil darunter schon eingerastet, rastet es ein (federt kurz).
// Sind alle Teile eingerastet, ist das Spiel fertig. Das Ziel dreht sich nie.
//
// Kein DOM, keine Bibliothek: dieselbe Logik zeichnet die 2D-Werkstatt (SVG) und die 3D-Bühne (WebGL, Teile in der Ebene z = 0).
// Welt: x nach rechts, y nach oben, Boden y = 0, Wände bei ±breite/2, Decke bei hoehe. Einheit frei (Stupa: Fundament = 1).
//
// Ein Teil = starrer Körper aus Kreisen (Kreisketten entlang des Umrisses). Darum rollt eine Kugel (ein Kreis) von selbst,
// ein Viereck kippt über die Kante, eine Sichel schaukelt. Masse und Trägheit kommen aus dem Umriss (Dichte 1).
//
//   const spiel = new Aufbau({ breite: 6.4, hoehe: 6, teile: [{ name, umriss: [[x,y],…], ziel: { x, y, a }, symmetrie }],
//                              onEinrasten(i) {}, onFertig() {}, onStoss(i, staerke) {} });
//   spiel.verstreuen();                 // Teile verstreut hinlegen (fallen kurz)
//   spiel.schritt(dt);                  // je Bild, dt in Sekunden
//   spiel.greifen(x, y) → i | -1;  spiel.ziehen(x, y);  spiel.loslassen();
//   spiel.posen() → [{ i, x, y, a, an, eingerastet, gegriffen, nah }]   (x, y, a = Lage des Ursprungs, den der Aufrufer gewählt hat)
//   spiel.naechstes() → Index des Teils, das als Nächstes dran ist (oder -1);  spiel.ruht → nichts bewegt sich (Bildschleife darf schlafen)
//
// Teil: umriss = geschlossenes Vieleck in eigenen Koordinaten (Ursprung frei, z. B. Mitte unten); ziel = Lage dieses Ursprungs
// im fertigen Bau. Statt der Kreiskette ab dem Umriss geht auch kreis: [x, y, r] (rund, rollt) oder kreise: [[x, y, r], …] (eigene
// Kette, z. B. dünne Sichel). symmetrie: 0 = rund (jeder Winkel passt), n = n-fach (Viereck 4), 1 = nur aufrecht (Standard).

const TAU = Math.PI * 2;
export const winkelDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const kreuz = (ax, ay, bx, by) => ax * by - ay * bx;

/** Fläche, Schwerpunkt und Trägheit (um den Schwerpunkt, Dichte 1) eines einfachen Vielecks. */
export function vieleck(P) {
  let A = 0, cx = 0, cy = 0, I = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], c = x0 * y1 - x1 * y0;
    A += c; cx += (x0 + x1) * c; cy += (y0 + y1) * c;
    I += c * (x0 * x0 + x0 * x1 + x1 * x1 + y0 * y0 + y0 * y1 + y1 * y1);
  }
  A /= 2; cx /= 6 * A; cy /= 6 * A; I /= 12;
  const a = Math.abs(A);
  return { A: a, cx, cy, I: Math.max(1e-6, Math.abs(I) - a * (cx * cx + cy * cy)), ccw: A > 0 };
}

/** Kreiskette knapp innerhalb des Umrisses (Radius r, Abstand ≤ r): Teile berühren sich sichtbar Kante an Kante. */
export function kreiseAusUmriss(P, r = 0.045) {
  const ccw = vieleck(P).ccw, out = [];
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length], dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
    if (l < 1e-9) continue;
    const nx = (ccw ? -dy : dy) / l, ny = (ccw ? dx : -dx) / l, n = Math.max(1, Math.ceil(l / r));   // Normale nach innen
    for (let s = 0; s < n; s++) { const t = (s + 0.5) / n; out.push([ax + dx * t + nx * r, ay + dy * t + ny * r, r]); }
  }
  return out;
}

function imVieleck(P, x, y) {
  let drin = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

const federRaus = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

export class Aufbau {
  constructor(o) {
    this.B = o.breite / 2; this.H = o.hoehe || o.breite; this.g = o.g ?? 14;
    this.toleranz = o.toleranz ?? 0.24; this.winkelTol = (o.winkelToleranz ?? 38) * Math.PI / 180;
    this.frei = o.frei ?? 0.72;            // Bauplatz in der Mitte bleibt beim Verstreuen frei (halbe Breite)
    this.reibung = o.reibung ?? 0.55; this.stoss = o.stossZahl ?? 0.18;
    this.on = { einrasten: o.onEinrasten || (() => {}), fertig: o.onFertig || (() => {}), stoss: o.onStoss || (() => {}) };
    this.k = o.teile.map((t, i) => this.koerper(t, i));
    this.griff = null; this.fertig = false;
  }

  koerper(t, i) {
    const P = t.umriss || null;
    let K = t.kreise || (t.kreis ? [t.kreis] : kreiseAusUmriss(P, t.radius));
    let A, cx, cy, I;
    if (P) ({ A, cx, cy, I } = vieleck(P));
    else if (K.length === 1) { const [x, y, r] = K[0]; A = Math.PI * r * r; cx = x; cy = y; I = A * r * r / 2; }
    else {
      A = 0; cx = 0; cy = 0; for (const [x, y, r] of K) { const a = Math.PI * r * r; A += a; cx += x * a; cy += y * a; } cx /= A; cy /= A;
      I = 0; for (const [x, y, r] of K) { const a = Math.PI * r * r; I += a * (r * r / 2 + (x - cx) ** 2 + (y - cy) ** 2); }
    }
    const m = A * (t.dichte || 1);
    K = K.map(([x, y, r]) => [x - cx, y - cy, r]);
    const PL = P ? P.map(([x, y]) => [x - cx, y - cy]) : null;
    const R = Math.max(...K.map(([x, y, r]) => Math.hypot(x, y) + r), ...(PL || []).map(([x, y]) => Math.hypot(x, y)));
    const z = t.ziel || { x: 0, y: 0, a: 0 }, za = z.a || 0, zc = Math.cos(za), zs = Math.sin(za);
    return {
      i, name: t.name || "Teil " + (i + 1), an: t.an !== false, com: [cx, cy], K, W: [], P: PL, R, m, im: 1 / m, ii: 1 / (I * (t.dichte || 1)),
      sym: t.symmetrie ?? 1, ziel: { x: z.x + zc * cx - zs * cy, y: z.y + zs * cx + zc * cy, a: za },
      x: 0, y: -10, a: 0, vx: 0, vy: 0, w: 0, statisch: false, eingerastet: false, rastet: null, schlaf: 0, schlaeft: false, nah: false
    };
  }

  /** Teile ein/aus (z. B. Knöpfe der Werkstatt). Aus = verschwindet, zählt nicht. */
  setzeAn(an) { this.k.forEach((b, i) => { b.an = !!an[i]; }); this.pruefeFertig(); }

  verstreuen(rnd = Math.random) {
    const aktiv = this.k.filter(b => b.an).sort(() => rnd() - 0.5), gelegt = [];
    const zonen = [[-this.B + 0.05, -this.frei], [this.frei, this.B - 0.05]];
    aktiv.forEach((b, n) => {
      const [x0, x1] = zonen[n % 2], lo = x0 + b.R * 0.8, hi = x1 - b.R * 0.8;
      b.x = hi > lo ? lo + rnd() * (hi - lo) : (x0 + x1) / 2;
      b.a = b.sym === 0 ? rnd() * TAU : (rnd() < 0.5 ? (rnd() - 0.5) * 1.2 : (rnd() < 0.5 ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 0.4);
      b.y = b.R + 0.15 + rnd() * 0.9;
      for (const c of gelegt) { const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < b.R + c.R) b.y = Math.max(b.y, c.y + b.R + c.R + 0.05); }
      b.y = Math.min(b.y, this.H - b.R - 0.05);
      b.vx = (rnd() - 0.5) * 0.6; b.vy = 0; b.w = (rnd() - 0.5) * 2;
      b.statisch = false; b.eingerastet = false; b.rastet = null; b.schlaf = 0; b.schlaeft = false; b.nah = false;
      b.zaun = true;                                                  // bis zum ersten Anfassen bleibt es ausserhalb des Bauplatzes
      gelegt.push(b);
    });
    this.griff = null; this.fertig = false;
  }

  /** Alles auf seinen Platz (Lösung, „ruhige Bewegung“). */
  fertigStellen() {
    for (const b of this.k) { Object.assign(b, { x: b.ziel.x, y: b.ziel.y, a: b.ziel.a, vx: 0, vy: 0, w: 0, statisch: true, eingerastet: true, rastet: null, schlaeft: false }); }
    this.griff = null; this.pruefeFertig();
  }

  naechstes() { for (const b of this.k) if (b.an && !b.eingerastet && !b.rastet) return b.i; return -1; }
  unterBereit(i) { for (const b of this.k) if (b.i < i && b.an && !b.eingerastet && !b.rastet) return false; return true; }
  zielWinkel(b) {
    if (b.sym === 0) return b.a;                                   // rund: bleibt, wie es liegt
    const st = TAU / Math.max(1, b.sym);
    return b.ziel.a + Math.round(winkelDiff(b.a, b.ziel.a) / st) * st;
  }
  nahAmZiel(b) {
    if (Math.hypot(b.x - b.ziel.x, b.y - b.ziel.y) > this.toleranz) return false;
    return b.sym === 0 || Math.abs(winkelDiff(b.a, this.zielWinkel(b))) < this.winkelTol;
  }
  einrasten(b) {
    b.rastet = { t: 0, x: b.x, y: b.y, a: b.a, za: this.zielWinkel(b) };
    b.statisch = true; b.vx = b.vy = b.w = 0; b.nah = false;
  }

  get ruht() { return !this.griff && this.k.every(b => !b.an || (b.statisch && !b.rastet) || b.schlaeft); }

  greifen(x, y, rand = 0.12) {
    let wahl = null, best = rand;
    for (let n = this.k.length - 1; n >= 0; n--) {                  // oben gezeichnete zuerst
      const b = this.k[n]; if (!b.an) continue;
      const c = Math.cos(-b.a), s = Math.sin(-b.a), lx = c * (x - b.x) - s * (y - b.y), ly = s * (x - b.x) + c * (y - b.y);
      if (b.P && imVieleck(b.P, lx, ly)) { wahl = b; best = -1; break; }
      for (const [kx, ky, r] of b.K) { const d = Math.hypot(lx - kx, ly - ky) - r; if (d < best) { best = d; wahl = b; } }
    }
    if (!wahl) return -1;
    if (wahl.eingerastet || wahl.rastet) {                          // vom Turm nehmen: alles darüber fällt mit
      for (const b of this.k) if (b.i >= wahl.i && (b.eingerastet || b.rastet)) { b.eingerastet = false; b.rastet = null; b.statisch = false; b.schlaeft = false; b.schlaf = 0; }
      this.fertig = false;
    }
    for (const b of this.k) if (b.schlaeft) { b.schlaeft = false; b.schlaf = 0; }   // alles darf wieder reagieren
    wahl.zaun = false;
    const c = Math.cos(-wahl.a), s = Math.sin(-wahl.a);
    this.griff = { b: wahl, lx: c * (x - wahl.x) - s * (y - wahl.y), ly: s * (x - wahl.x) + c * (y - wahl.y), tx: x, ty: y };
    return wahl.i;
  }
  ziehen(x, y) { if (this.griff) { this.griff.tx = Math.max(-this.B, Math.min(this.B, x)); this.griff.ty = Math.max(0, Math.min(this.H, y)); } }
  loslassen() {
    const g = this.griff; if (!g) return; this.griff = null;
    const b = g.b; b.nah = false;
    if (this.unterBereit(b.i) && this.nahAmZiel(b)) this.einrasten(b);
  }

  posen() {
    return this.k.map(b => {
      const c = Math.cos(b.a), s = Math.sin(b.a), [cx, cy] = b.com;
      return { i: b.i, x: b.x - (c * cx - s * cy), y: b.y - (s * cx + c * cy), a: b.a, an: b.an, eingerastet: b.eingerastet || !!b.rastet,
        gegriffen: !!(this.griff && this.griff.b === b), nah: b.nah };
    });
  }

  pruefeFertig() {
    const war = this.fertig;
    this.fertig = this.k.some(b => b.an) && this.k.every(b => !b.an || b.eingerastet);
    if (this.fertig && !war) this.on.fertig();
  }

  schritt(dt) {
    dt = Math.max(0, Math.min(1 / 30, dt || 0));
    const N = 6, h = dt / N;
    for (let n = 0; n < N; n++) this.teilschritt(h);
    // Einrasten: kurz federnd auf den Platz
    for (const b of this.k) {
      if (!b.rastet) continue;
      const r = b.rastet; r.t = Math.min(1, r.t + dt / 0.3);
      const e = federRaus(r.t);
      b.x = r.x + (b.ziel.x - r.x) * e; b.y = r.y + (b.ziel.y - r.y) * e; b.a = r.a + winkelDiff(r.za, r.a) * e;
      if (r.t >= 1) { b.rastet = null; b.eingerastet = true; b.x = b.ziel.x; b.y = b.ziel.y; b.a = r.za; this.on.einrasten(b.i); this.pruefeFertig(); }
    }
    // Von selbst einrasten (fällt oder rollt nah genug hin), beim Ziehen nur anzeigen
    for (const b of this.k) {
      if (!b.an || b.eingerastet || b.rastet) { b.nah = false; continue; }
      const ok = this.unterBereit(b.i) && this.nahAmZiel(b);
      if (this.griff && this.griff.b === b) b.nah = ok;
      else if (ok) this.einrasten(b);
    }
  }

  beweglich(b) { return b && b.an && !b.statisch && !b.schlaeft; }

  teilschritt(h) {
    const g = this.griff, aktiv = this.k.filter(b => this.beweglich(b));
    for (const b of this.k) b.magnet = false;
    for (const b of aktiv) b.vy -= this.g * h;
    if (g && this.beweglich(g.b)) {                                   // Feder am Griffpunkt: Teil hängt und pendelt
      const b = g.b, c = Math.cos(b.a), s = Math.sin(b.a), rx = c * g.lx - s * g.ly, ry = s * g.lx + c * g.ly;
      const px = b.x + rx, py = b.y + ry, vx = b.vx - b.w * ry, vy = b.vy + b.w * rx;
      const om = 20, ze = 0.85, k = om * om, d = 2 * ze * om;
      let jx = b.m * (k * (g.tx - px) - d * vx) * h, jy = b.m * (k * (g.ty - py) - d * vy + this.g) * h;
      const jm = Math.hypot(jx, jy), max = b.m * 90 * h; if (jm > max) { jx *= max / jm; jy *= max / jm; }
      b.vx += jx * b.im; b.vy += jy * b.im; b.w += b.ii * kreuz(rx, ry, jx, jy);
      b.w *= 1 - 3 * h;
      // Magnet: nah am Platz (und das Teil darunter steht) dreht es sich sanft gerade – wie Einrasten in der Hand
      const weit = Math.hypot(b.x - b.ziel.x, b.y - b.ziel.y) / (this.toleranz * 4.5);
      b.magnet = weit < 1 && this.unterBereit(b.i);
      if (b.sym !== 0 && b.magnet) { const f = 1 - weit * weit; b.w += (winkelDiff(this.zielWinkel(b), b.a) * 80 * f - b.w * 10 * f) * h; }
    }
    for (const b of this.k) {
      if (!b.an) continue;
      const c = Math.cos(b.a), s = Math.sin(b.a);
      b.W = b.K.map(([x, y, r]) => [b.x + c * x - s * y, b.y + s * x + c * y, r]);
    }
    const K = this.kontakte(aktiv, h);
    this.loesen(K, h);
    for (const b of aktiv) {
      const v = Math.hypot(b.vx, b.vy); if (v > 14) { b.vx *= 14 / v; b.vy *= 14 / v; }
      b.w = Math.max(-25, Math.min(25, b.w));
      b.x += b.vx * h; b.y += b.vy * h; b.a += b.w * h;
      b.vx *= 1 - 0.05 * h; b.vy *= 1 - 0.05 * h; b.w *= 1 - (b.boden ? 1.2 : 0.25) * h;
      if (!(g && g.b === b) && b.vx * b.vx + b.vy * b.vy < 0.004 && Math.abs(b.w) < 0.1) {
        b.schlaf += h; if (b.schlaf > 0.6) { b.schlaeft = true; b.vx = b.vy = b.w = 0; }
      } else b.schlaf = 0;
    }
  }

  kontakte(aktiv, h) {
    const K = [], B = this.B, H = this.H;
    for (const b of aktiv) {
      b.boden = false;
      for (const [x, y, r] of b.W) {
        if (y - r < 0) { K.push(this.kontakt(null, b, 0, 1, x, y - r, r - y)); b.boden = true; }
        if (x - r < -B) K.push(this.kontakt(null, b, 1, 0, -B, y, -B - (x - r), 0.05));
        if (x + r > B) K.push(this.kontakt(null, b, -1, 0, B, y, x + r - B, 0.05));
        if (y + r > H) K.push(this.kontakt(null, b, 0, -1, x, H, y + r - H, 0.05));
        if (b.zaun) {                                                // Verstreuen: nichts rollt von selbst in den Bauplatz
          const F = this.frei;
          if (b.x < 0 && x + r > -F) K.push(this.kontakt(null, b, -1, 0, -F, y, x + r + F, 0));
          if (b.x >= 0 && x - r < F) K.push(this.kontakt(null, b, 1, 0, F, y, F - (x - r), 0));
        }
      }
    }
    const alle = this.k.filter(b => b.an);
    for (let p = 0; p < alle.length; p++) for (let q = p + 1; q < alle.length; q++) {
      const a = alle[p], b = alle[q];
      if (!this.beweglich(a) && !this.beweglich(b)) continue;
      // in der Magnetzone gleitet das gehaltene Teil ohne Anstossen auf seinen Platz (eingerastete Teile sind dann „durchlässig“)
      if ((a.magnet && b.statisch) || (b.magnet && a.statisch)) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) > a.R + b.R) continue;
      let neu = 0;
      for (const [ax, ay, ar] of a.W) {
        if (Math.abs(ax - b.x) > b.R + ar || Math.abs(ay - b.y) > b.R + ar) continue;
        for (const [bx, by, br] of b.W) {
          const dx = bx - ax, dy = by - ay, rr = ar + br, dd = dx * dx + dy * dy;
          if (dd >= rr * rr || dd < 1e-12) continue;
          const d = Math.sqrt(dd), nx = dx / d, ny = dy / d;
          K.push(this.kontakt(a, b, nx, ny, ax + nx * ar, ay + ny * ar, rr - d)); neu++;
        }
      }
      // ein schlafendes Teil wacht auf, wenn ein bewegtes kräftig dagegen stösst
      if (neu) for (const [s, w] of [[a, b], [b, a]]) if (s.schlaeft && this.beweglich(w) && Math.hypot(w.vx, w.vy) + Math.abs(w.w) * w.R > 0.6) { s.schlaeft = false; s.schlaf = 0; }
    }
    return K;
  }

  kontakt(A, B, nx, ny, px, py, tiefe, mu = this.reibung) {   // Wände, Decke, Zaun: fast ohne Reibung (nichts klemmt)
    const ra = A ? [px - A.x, py - A.y] : [0, 0], rb = [px - B.x, py - B.y];
    const imA = this.beweglich(A) ? A.im : 0, iiA = this.beweglich(A) ? A.ii : 0, imB = this.beweglich(B) ? B.im : 0, iiB = this.beweglich(B) ? B.ii : 0;
    const tx = -ny, ty = nx;
    const kn = imA + imB + iiA * kreuz(ra[0], ra[1], nx, ny) ** 2 + iiB * kreuz(rb[0], rb[1], nx, ny) ** 2;
    const kt = imA + imB + iiA * kreuz(ra[0], ra[1], tx, ty) ** 2 + iiB * kreuz(rb[0], rb[1], tx, ty) ** 2;
    return { A, B, nx, ny, tx, ty, ra, rb, imA, iiA, imB, iiB, kn, kt, tiefe, mu, Pn: 0, Pt: 0, ziel: 0 };
  }

  relativ(c) {
    const A = c.A, B = c.B;
    const vax = A ? A.vx - A.w * c.ra[1] : 0, vay = A ? A.vy + A.w * c.ra[0] : 0;
    return [B.vx - B.w * c.rb[1] - vax, B.vy + B.w * c.rb[0] - vay];
  }
  stoss_(c, jx, jy) {
    if (c.imA) { const A = c.A; A.vx -= jx * c.imA; A.vy -= jy * c.imA; A.w -= c.iiA * kreuz(c.ra[0], c.ra[1], jx, jy); }
    if (c.imB) { const B = c.B; B.vx += jx * c.imB; B.vy += jy * c.imB; B.w += c.iiB * kreuz(c.rb[0], c.rb[1], jx, jy); }
  }

  loesen(K, h) {
    for (const c of K) {
      if (c.kn <= 0) continue;
      const [vx, vy] = this.relativ(c), vn = vx * c.nx + vy * c.ny;
      const korrektur = Math.min(2, 0.2 / h * Math.max(0, c.tiefe - 0.004));
      c.ziel = Math.max(vn < -1 ? -this.stoss * vn : 0, korrektur);
      if (vn < -2.5) this.on.stoss(c.B.i, -vn);
    }
    for (let it = 0; it < 8; it++) for (const c of K) {
      if (c.kn <= 0) continue;
      let [vx, vy] = this.relativ(c);
      const vn = vx * c.nx + vy * c.ny, alt = c.Pn;
      c.Pn = Math.max(0, alt + (c.ziel - vn) / c.kn);
      const dn = c.Pn - alt; this.stoss_(c, c.nx * dn, c.ny * dn);
      [vx, vy] = this.relativ(c);
      const vt = vx * c.tx + vy * c.ty, max = c.mu * c.Pn, altT = c.Pt;
      c.Pt = Math.max(-max, Math.min(max, altT - vt / c.kt));
      const dt = c.Pt - altT; this.stoss_(c, c.tx * dt, c.ty * dt);
    }
  }
}
