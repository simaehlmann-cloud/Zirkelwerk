/* Zirkelwerk – Test des Geometrie-Kerns ohne Browser.
 *
 *   node coretest.js
 *
 * Schneidet den Block zwischen ==CORE-BEGIN== und ==CORE-END== aus der
 * index.html und prüft ihn in einer leeren Umgebung. Dass das überhaupt
 * geht, ist selbst schon ein Test: der Kern darf weder DOM noch
 * Einstellungen kennen.
 */
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync('index.html', 'utf8');
const a = html.indexOf('/* ==CORE-BEGIN== */'), b = html.indexOf('/* ==CORE-END== */');
if (a < 0 || b < 0) { console.error('Kernblock nicht gefunden.'); process.exit(1); }
const ctx = { console, Math, JSON, Number, String, Array, Set, Object, Error, Infinity, NaN, Uint8Array };
vm.createContext(ctx);
vm.runInContext(html.slice(a, b) + `
this.K = { TAU, DEG, normAng, angDiff, onArc, segSeg, lineCircleT, segArc, circleCircle, arcArc,
  intersections, dedupePoints, snapCandidates, findSnap, snapToCurve, objectDistance, topObjectAt, nextLabel,
  bestLabelDir, fmtLen, fmtDeg, fmtNum, parseNum, History, applyEntry, revertEntry,
  rulerEdges, geoEdges, rulerContains, geoContains, edgeHit, snapOnScale, geoDegPoint, worldToLoc, locToWorld,
  compassParts, detectScale, sanitizeDoc, newDoc, boundsOf, RULER, GEO, distToArc, nearestOnArc, describe, fmtCm };`, ctx);
const K = ctx.K;
/* Sprachpakete für die Beschreibung */
{
  const si = html.indexOf('const i18n = {'), ei = html.indexOf('\n};', si) + 3;
  vm.runInContext(html.slice(si, ei) + '\nthis.I18N = i18n;', ctx);
}
const I18N = ctx.I18N;

let passed = 0, failed = 0;
const fails = [];
function ok(c, name, extra) { if (c) passed++; else { failed++; fails.push(name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } }
const near = (x, y, t) => Math.abs(x - y) <= (t || 1e-9);
const P = (x, y) => ({ x, y });

/* ---------- Winkel ---------- */
ok(near(K.normAng(-Math.PI / 2), 1.5 * Math.PI), 'normAng negativ');
ok(near(K.angDiff(0.1, K.TAU - 0.1), -0.2), 'angDiff über die Nullrichtung');
ok(near(K.angDiff(0, Math.PI), Math.PI), 'angDiff genau π');
ok(K.onArc(0, 0, 1), 'onArc: Anfangspunkt gehört dazu');
ok(K.onArc(-1e-12, 0, 1), 'onArc: Rundung knapp unter dem Anfang');
ok(K.onArc(1, 0, 1), 'onArc: Endpunkt gehört dazu');
ok(!K.onArc(1.1, 0, 1), 'onArc: dahinter nicht');
ok(K.onArc(-0.5, 0, -1), 'onArc: negativer Drehsinn');
ok(!K.onArc(0.5, 0, -1), 'onArc: negativer Drehsinn, falsche Seite');
ok(K.onArc(3, 1, K.TAU), 'onArc: Vollkreis');

/* ---------- Schnittpunkte ---------- */
let s = K.segSeg(0, 0, 10, 10, 0, 10, 10, 0);
ok(s && near(s.x, 5) && near(s.y, 5), 'Strecken kreuzen sich');
ok(K.segSeg(0, 0, 10, 0, 0, 1, 10, 1) === null, 'Parallele Strecken: kein Schnitt');
ok(K.segSeg(0, 0, 10, 0, 11, -1, 11, 1) === null, 'Schnitt außerhalb der Strecke');
s = K.segSeg(0, 0, 10, 0, 10, 0, 10, 5);
ok(s && near(s.x, 10) && near(s.y, 0), 'Gemeinsamer Endpunkt zählt');

let cc = K.circleCircle(0, 0, 40, 50, 0, 30);
ok(cc.length === 2, 'Kreise schneiden sich zweimal');
for (const p of cc) ok(near(Math.hypot(p.x, p.y), 40, 1e-9) && near(Math.hypot(p.x - 50, p.y), 30, 1e-9), 'SSS: Schnittpunkt hat 4 cm und 3 cm Abstand');
ok(near(Math.abs(cc[0].y), 24, 1e-9) && near(cc[0].x, 32, 1e-9), 'SSS 3-4-5: C = (32 | ±24)', cc[0]);
ok(K.circleCircle(0, 0, 10, 50, 0, 10).length === 0, 'Dreiecksungleichung verletzt: kein Schnitt');
ok(K.circleCircle(0, 0, 25, 50, 0, 25).length === 1, 'Kreise berühren sich: ein Punkt');
ok(K.circleCircle(0, 0, 10, 0, 0, 20).length === 0, 'Konzentrische Kreise');
ok(K.circleCircle(0, 0, 10, 0, 0, 10).length === 0, 'Gleiche Kreise: kein einzelner Schnittpunkt');

const arcUp = { cx: 0, cy: 0, r: 40, a0: -0.2, sweep: -1.2 };      // oberhalb (y negativ)
const arcB = { cx: 50, cy: 0, r: 30, a0: -1.8, sweep: -1.0 };
let aa = K.arcArc(arcUp, arcB);
ok(aa.length === 1 && aa[0].y < 0, 'Bögen: nur der Schnittpunkt auf beiden Bögen', aa);
ok(K.arcArc({ cx: 0, cy: 0, r: 40, a0: 0.1, sweep: 0.3 }, arcB).length === 0, 'Zu kurze Bögen schneiden sich nicht');

const t = K.lineCircleT(-10, 5, 10, 5, 0, 0, 5);
ok(t.length === 1 && near(t[0], 0.5), 'Tangente: genau eine Lösung');
/* Tangenten in beliebiger Lage: Ohne Toleranz liefert die Rechnung bei etwa
   jeder sechsten einen winzig negativen Diskriminanten – der Berührpunkt
   ginge verloren. */
let lostTangents = 0;
for (let i = 0; i < 2000; i++) {
  const phi = i * 0.0137, cx = 13.7, cy = -4.2, r = 4.6667;
  const nx = Math.cos(phi), ny = Math.sin(phi), px = cx + nx * r, py = cy + ny * r, tx = -ny, ty = nx;
  if (!K.lineCircleT(px - tx * 30, py - ty * 30, px + tx * 30, py + ty * 30, cx, cy, r).length) lostTangents++;
}
ok(lostTangents === 0, 'Tangenten in beliebiger Lage werden gefunden', lostTangents);
ok(K.segArc({ x1: -50, y1: 0, x2: 50, y2: 0 }, { cx: 0, cy: 0, r: 10, a0: 0, sweep: K.TAU }).length === 2, 'Strecke durch Kreis');
ok(K.segArc({ x1: -50, y1: 0, x2: 50, y2: 0 }, { cx: 0, cy: 0, r: 10, a0: -1, sweep: 2 }).length === 1, 'Strecke durch Bogen');

const objs = [
  { id: 'a', type: 'segment', x1: 0, y1: 0, x2: 50, y2: 0 },
  { id: 'b', type: 'arc', cx: 0, cy: 0, r: 40, a0: 0, sweep: -K.TAU },
  { id: 'c', type: 'arc', cx: 50, cy: 0, r: 30, a0: 0, sweep: K.TAU },
  { id: 'd', type: 'stroke', pts: [0, 0, 50, 50] },
  { id: 'p', type: 'point', x: 0, y: 0, label: 'A', ld: 7 }
];
const inters = K.intersections(objs);
ok(inters.length === 4, 'Schnittpunkte: Kreis∩Kreis (2) + Strecke∩Kreise (2), ohne Freihand', inters.length);
const cands = K.snapCandidates(objs, inters);
const sn = K.findSnap(1, 1, cands, 3);
ok(sn && sn.kind === 'point' && sn.id === 'p', 'Gesetzter Punkt hat Vorrang vor Endpunkt und Mittelpunkt', sn);
ok(K.findSnap(100, 100, cands, 3) === null, 'Außerhalb des Fangradius: nichts');
const cur = K.snapToCurve(10, 0.5, objs, 1);
ok(cur && near(cur.y, 0) && near(cur.x, 10), 'Punkt auf Strecke');

/* Doppelte über Rasterzellgrenzen hinweg erkennen */
const tol = 1e-4;
const dd = K.dedupePoints([P(0.99999 * tol, 0), P(1.00001 * tol, 0), P(-0.00001 * tol, 2.99999 * tol), P(0, 3.00001 * tol), P(5, 5), P(5 + 2 * tol, 5)], tol);
ok(dd.length === 4, 'Doppelte Punkte über Zellgrenzen erkannt, entfernte bleiben', dd.length);

/* ---------- Trefferprüfung ---------- */
ok(K.objectDistance({ type: 'segment', x1: 0, y1: 0, x2: 10, y2: 0, w: 0 }, 5, 3) === 3, 'Abstand zur Strecke');
ok(near(K.distToArc(0, -50, { cx: 0, cy: 0, r: 40, a0: -Math.PI / 2 - 0.1, sweep: 0.2 }), 10), 'Abstand zum Bogen innerhalb');
ok(near(K.distToArc(0, 0, { cx: 0, cy: 0, r: 40, a0: 0, sweep: 1 }), 40), 'Abstand vom Mittelpunkt (atan2(0,0))');
ok(K.topObjectAt(objs, 0.2, 0.2, 1, ['point']).id === 'p', 'topObjectAt mit Typfilter');

/* ---------- Beschriftung ---------- */
ok(K.nextLabel(new Set()) === 'A', 'Erster Punkt heißt A');
ok(K.nextLabel(new Set(['A', 'B'])) === 'C', 'Dann C');
ok(K.nextLabel(new Set(['A', 'C'])) === 'B', 'Lücken werden gefüllt');
ok(K.nextLabel(new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''))) === 'A1', 'Nach Z kommt A1');
const dir = K.bestLabelDir([{ id: 's', type: 'segment', x1: 0, y1: 0, x2: 50, y2: 0 }, { id: 't', type: 'segment', x1: 0, y1: 0, x2: 0, y2: -50 }], 0, 0, null);
ok([3, 4, 2].includes(dir), 'Beschriftung weicht Linien aus (Ecke rechts oben belegt)', dir);

/* ---------- Zahlen ---------- */
ok(K.fmtLen(43, 'de') === '4,3 cm' && K.fmtLen(43, 'en') === '4.3 cm', 'Längen deutsch und englisch');
ok(K.fmtLen(-0.01, 'de') === '0,0 cm', 'Keine „-0,0 cm"');
ok(K.fmtDeg(30, 'de') === '30°' && K.fmtDeg(30.25, 'de') === '30,3°', 'Winkel mit und ohne Nachkommastelle');
ok(K.parseNum('4,5') === 4.5 && K.parseNum(' 3 ') === 3 && Number.isNaN(K.parseNum('4,5,6')) && Number.isNaN(K.parseNum('')), 'Zahlen einlesen mit Komma');
ok(Number.isNaN(K.parseNum('1e3')), 'Keine Exponentenschreibweise');

/* ---------- Rückgängig ---------- */
const h = new K.History(3);
const list = [];
const o1 = { id: 'o1' }, o2 = { id: 'o2' }, o3 = { id: 'o3' };
const e1 = { t: 'add', items: [o1, o2, o3] }; K.applyEntry(list, e1); h.push(e1);
// Radierstrich: o1, dann o3 (Index jeweils zum Zeitpunkt)
const del = { t: 'del', items: [{ obj: o1, index: 0 }, { obj: o3, index: 1 }] };
list.splice(0, 1); list.splice(1, 1); h.push(del);
ok(list.map(x => x.id).join() === 'o2', 'Nach dem Radieren bleibt o2');
h.undo(list);
ok(list.map(x => x.id).join() === 'o1,o2,o3', 'Rückgängig stellt Reihenfolge wieder her', list.map(x => x.id));
h.redo(list);
ok(list.map(x => x.id).join() === 'o2', 'Wiederholen radiert erneut');
const mod = { t: 'mod', before: [o2], after: [{ id: 'o2', label: 'X' }] }; K.applyEntry(list, mod); h.push(mod);
ok(list[0].label === 'X', 'Ändern');
h.undo(list);
ok(list[0] === o2, 'Ändern rückgängig');
ok(!h.canRedo() === false, 'Wiederholen möglich');
h.push({ t: 'add', items: [{ id: 'z' }] });
ok(!h.canRedo(), 'Neue Aktion löscht Wiederholen');
for (let i = 0; i < 10; i++) h.push({ t: 'add', items: [{ id: 'q' + i }] });
ok(h.undoStack.length === 3, 'Begrenzte Tiefe');
h.push({ t: 'add', items: [] });
ok(h.undoStack.length === 3, 'Leere Einträge werden ignoriert');

/* ---------- Geräte ---------- */
const ruler = { x: 10, y: 20, rot: 0.3 };
const e = K.rulerEdges(ruler)[0];
ok(near(Math.hypot(e.bx - e.ax, e.by - e.ay), K.RULER.len), 'Linealkante hat volle Länge');
const mid = { x: (e.ax + e.bx) / 2 - e.nx * 5, y: (e.ay + e.by) / 2 - e.ny * 5 };
ok(K.rulerContains(ruler, mid.x, mid.y), 'Punkt knapp innen liegt im Lineal');
const out = { x: (e.ax + e.bx) / 2 + e.nx * 5, y: (e.ay + e.by) / 2 + e.ny * 5 };
ok(!K.rulerContains(ruler, out.x, out.y), 'Punkt knapp außen liegt nicht im Lineal');
const eh = K.edgeHit(K.rulerEdges(ruler), out.x, out.y, 8, 4);
ok(eh && eh.edge.id === 'top' && near(eh.s, 5), 'Kantentreffer von außen');
// Skala: Punkt bei 6 cm
const tAt = (60 - (K.RULER.zero + K.RULER.len / 2) + K.RULER.len / 2 + 0.3) / K.RULER.len; // lokal x = zero + 60.3
const sc = K.snapOnScale('ruler', ruler, e, (K.RULER.zero + 60.3 + K.RULER.len / 2) / K.RULER.len);
ok(sc.value === 60 && sc.unit === 'mm', 'Punkt am Lineal rastet auf 60 mm', sc);
const geo = { x: 0, y: 0, rot: 0 };
ok(K.geoContains(geo, 0, -10) && !K.geoContains(geo, 0, 10) && !K.geoContains(geo, 70, -20), 'Geodreieck: innen/außen');
const g60 = K.geoDegPoint(geo, 60, 0);
ok(near(Math.atan2(-g60.y, g60.x) * 180 / Math.PI, 60, 1e-9), 'Gradpunkt 60° liegt auf dem 60°-Strahl');
ok(near(g60.x - g60.y, 80, 1e-9), '… und genau auf der rechten Kathete');
const g135 = K.geoDegPoint(geo, 135, 0);
ok(near(-g135.x - g135.y, 80, 1e-9), '135° liegt auf der linken Kathete');
const leg = K.geoEdges(geo)[1];
const sd = K.snapOnScale('geo', geo, leg, 0.37);
ok(Number.isInteger(sd.value) && sd.unit === 'deg', 'Punkt an der Kathete rastet auf ganze Grad', sd);
const back = K.worldToLoc(ruler, ...Object.values(K.locToWorld(ruler, 12, -7)));
ok(near(back.x, 12) && near(back.y, -7), 'Lokal ↔ Welt umkehrbar');

/* ---------- Zirkel ---------- */
const cp = K.compassParts({ nx: 0, ny: 0, r: 40, ang: 0 });
ok(near(cp.lx, 40) && near(cp.ly, 0), 'Mine im Abstand r');
ok(cp.hy < 0 && near(cp.hx, 20), 'Gelenk über der Mitte (Zirkel nach rechts geöffnet)');
const legLen = Math.hypot(cp.hx, cp.hy);
ok(near(legLen, Math.hypot(cp.hx - 40, cp.hy)), 'Beide Schenkel gleich lang');
const cp0 = K.compassParts({ nx: 0, ny: 0, r: 0, ang: 1 });
ok(Number.isFinite(cp0.hx) && Number.isFinite(cp0.gy), 'Radius 0 ist erlaubt');

/* ---------- Echte Größe ---------- */
const ipadUA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
let d = K.detectScale({ ua: ipadUA, maxTouch: 5, sw: 820, sh: 1180 });
ok(d.device === 'ipad' && d.sure && near(d.ppm, 132 / 25.4), 'iPad Air/10. Gen. erkannt');
d = K.detectScale({ ua: ipadUA, maxTouch: 5, sw: 1133, sh: 744 });
ok(d.device === 'ipadmini' && near(d.ppm, 163 / 25.4), 'iPad mini (quer) erkannt');
d = K.detectScale({ ua: ipadUA, maxTouch: 0, sw: 1440, sh: 900 });
ok(d.device === 'desktop' && !d.sure, 'Mac ohne Touch ist kein iPad');
d = K.detectScale({ ua: ipadUA, maxTouch: 5, sw: 1192, sh: 1590 });
ok(d.device === 'ipad' && !d.sure, 'Anzeigezoom „Mehr Platz": unsicher → Kalibrieren empfehlen');

/* ---------- Blätter prüfen ---------- */
const nd = K.newDoc('x', 'Test', 1);
const san = K.sanitizeDoc(JSON.parse(JSON.stringify(nd)), 'y', 2);
ok(san.id === 'y' && san.name === 'Test' && san.objects.length === 0, 'Leeres Blatt übersteht die Prüfung');
let threw = '';
try { K.sanitizeDoc({ format: 'x' }, 'y', 1); } catch (er) { threw = er.message; }
ok(threw === 'format', 'Fremdes Format wird abgelehnt');
try { K.sanitizeDoc({ format: 'zirkelwerk', v: 99, objects: [] }, 'y', 1); } catch (er) { threw = er.message; }
ok(threw === 'version', 'Neuere Version wird erkannt');
const dirty = K.sanitizeDoc({
  format: 'zirkelwerk', v: 1, name: 'A\u0000B'.repeat(50),
  objects: [
    { type: 'segment', x1: 0, y1: 0, x2: Infinity, y2: 0 },
    { type: 'arc', cx: 0, cy: 0, r: -5, a0: 0, sweep: 1 },
    { type: 'arc', cx: 0, cy: 0, r: 5, a0: 0, sweep: 99 },
    { type: 'point', x: 1, y: 2, label: 'ABCDEFGHIJKLMNOP', c: 'red', ld: 42 },
    { type: 'text', x: 0, y: 0, text: '   ' },
    { type: 'stroke', pts: [0, 0, 'x', 1] },
    { type: 'stroke', pts: [0, 0, 1, 1], w: 999 },
    { __proto__: { type: 'segment' } }
  ],
  inst: { compass: { r: 9999, nx: 'a' }, order: ['ruler', 'ruler', 'geo'] }
}, 'z', 5);
ok(dirty.objects.length === 3, 'Ungültige Objekte fallen weg', dirty.objects.map(o => o.type));
ok(dirty.objects[0].type === 'arc' && near(dirty.objects[0].sweep, K.TAU), 'Überlanger Bogen wird auf Vollkreis begrenzt');
const pt = dirty.objects.find(o => o.type === 'point');
ok(pt.label.length === 12 && pt.c === '#3b3f45' && pt.ld === 7, 'Punkt: Name gekürzt, Farbe und Lage bereinigt', pt);
ok(dirty.objects.find(o => o.type === 'stroke').w === 20, 'Strichstärke begrenzt');
ok(dirty.name.length <= 80 && !dirty.name.includes('\u0000'), 'Name ohne Steuerzeichen und gekürzt');
ok(dirty.inst.compass.r === 200 && dirty.inst.compass.nx === -20, 'Zirkelwerte begrenzt bzw. ersetzt');
ok(dirty.inst.order.join() === 'ruler,geo,compass', 'Ungültige Reihenfolge ersetzt');
ok(new Set(dirty.objects.map(o => o.id)).size === dirty.objects.length && dirty.seq === 4, 'Neue, eindeutige IDs');


{
/* ---------- Konstruktionsbeschreibung ---------- */
ok(K.fmtCm(50, 'de') === '5 cm' && K.fmtCm(45, 'de') === '4,5 cm' && K.fmtCm(49.97, 'de') === '5 cm' && K.fmtCm(45, 'en') === '4.5 cm', 'Längen ohne „,0"');
const D = (objs, lang) => K.describe(objs, lang || 'de', I18N[lang || 'de']);
const pA = { x: 0, y: 0 }, pB = { x: 50, y: 0 }, pC = { x: 32, y: -24 };
let n = 0;
const id = () => 'x' + (++n);
const seg = (a, b, m) => ({ id: id(), type: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, c: '#3b3f45', w: 0.5, al: 1, m });
const pt = (p, label) => ({ id: id(), type: 'point', x: p.x, y: p.y, label, ld: 7, c: '#3b3f45' });
const arc = (c, r, a0, sw, rs) => ({ id: id(), type: 'arc', cx: c.x, cy: c.y, r, a0, sweep: sw, c: '#3b3f45', w: 0.5, al: 1, m: rs ? { rs } : undefined });
const sss = () => {
  const s0 = seg(pA, pB, { via: 'ruler' });
  const A = pt(pA, 'A'), B = pt(pB, 'B');
  return [s0, A, B, arc(pA, 40, -0.2, -1, { t: 'set' }), arc(pB, 30, -1.8, -1, { t: 'typed' }), pt(pC, 'C'), seg(pA, pC), seg(pB, pC)];
};
let st = D(sss());
ok(st.map(x => x.text).join('|') === [
  'Zeichne die Strecke AB mit der Länge 5 cm.',
  'Zeichne einen Kreisbogen um A mit dem Radius r = 4 cm.',
  'Zeichne einen Kreisbogen um B mit dem Radius r = 3 cm.',
  'Der Schnittpunkt der beiden Kreisbögen ist C.',
  'Verbinde A mit C und B mit C.'].join('|'), 'SSS-Beschreibung (Befehlsform)', st.map(x => x.text));
ok(st[0].ids.length === 3 && st[4].ids.length === 2, 'Endpunkte A, B gehören zum ersten Schritt, beide Verbindungen zum letzten');
ok(st.reduce((a, x) => a + x.ids.length, 0) === 8, 'Jedes Objekt steckt in genau einem Schritt');
ok(st[1].short === 'Kreisbogen um A · r = 4 cm' && st[0].short === 'Strecke AB · 5 cm', 'Kurzformen', [st[0].short, st[1].short]);
const en = D(sss(), 'en');
ok(en[0].text === 'Draw the line segment AB with length 5 cm.' && en[3].text === 'The intersection of the two arcs is C.' && en[4].text === 'Join A to C and B to C.', 'Englische Beschreibung', en.map(x => x.text));
// Umbenennen wirkt sofort
const ren = sss(); ren[1].label = 'M';
ok(D(ren)[1].text === 'Zeichne einen Kreisbogen um M mit dem Radius r = 4 cm.' && D(ren)[0].text.includes('Strecke MB'), 'Umbenennen ändert die Beschreibung');
// Strecke abgreifen
{
  const A = pt(pA, 'A'), B = pt(pB, 'B'), s0 = seg(pA, pB, { via: 'ruler' }), Cc = pt({ x: 0, y: 40 }, 'C');
  const objs = [A, B, s0, Cc, arc({ x: 0, y: 40 }, 50, 0, 1, { t: 'taken', p: [A.id, B.id] })];
  const t = D(objs);
  ok(t[t.length - 1].text === 'Greife mit dem Zirkel die Länge von AB ab und zeichne einen Kreisbogen um C.', 'Abgreifen wird als solches beschrieben', t.map(x => x.text));
  ok(t[2].text === 'Verbinde A mit B.', 'Strecke zwischen vorhandenen Punkten = Verbinden', t[2].text);
  // Abgegriffener Radius passt nicht mehr (Punkt verschoben) → Zahl
  B.x = 60;
  ok(D(objs).pop().text === 'Zeichne einen Kreisbogen um C mit dem Radius r = 5 cm.', 'Veralteter Abgriff fällt auf die Zahl zurück');
}
// Senkrechte und Parallele
{
  const A = pt(pA, 'A'), B = pt(pB, 'B'), s0 = seg(pA, pB), P = pt({ x: 20, y: -30 }, 'P');
  const perp = seg({ x: 20, y: -30 }, { x: 20, y: 10 }, { via: 'geo' });
  const par = seg({ x: -10, y: -30 }, { x: 60, y: -30 }, { via: 'geo' });
  const t = D([A, B, s0, P, perp, par]);
  ok(t[4].text === 'Zeichne die Senkrechte zu AB durch P.', 'Senkrechte erkannt', t[4] && t[4].text);
  ok(t[5].text === 'Zeichne die Parallele zu AB durch P.', 'Parallele zu AB statt Senkrechte zur Hilfslinie', t[5] && t[5].text);
}
// Schnittpunkt von Bogen und Strecke ohne Namen, Punkt auf Linie, freier Punkt
{
  const A = pt(pA, 'A'), B = pt(pB, 'B'), s0 = seg(pA, pB);
  const objs = [A, B, s0, arc(pA, 30, -1, 2), pt({ x: 30, y: 0 }, ''), pt({ x: 10, y: 0 }, 'Q'), pt({ x: 5, y: 40 }, 'R')];
  const t = D(objs).map(x => x.text);
  ok(t[4] === 'Markiere den Schnittpunkt von der Strecke AB und dem Kreisbogen um A.', 'Unbenannter Schnittpunkt mit Dativ', t[4]);
  ok(t[5] === 'Markiere auf der Strecke AB den Punkt Q.', 'Punkt auf Strecke', t[5]);
  ok(t[6] === 'Zeichne einen Punkt R.', 'Freier Punkt', t[6]);
}
// Freihand und Text vorweg, Marker zählt nicht als Strecke
{
  const objs = [{ id: id(), type: 'stroke', pts: [0, 0, 5, 5], c: '#3b3f45', w: 0.5, al: 1 },
    { id: id(), type: 'text', x: 0, y: 0, text: 'Planfigur', size: 5, c: '#3b3f45' },
    seg(pA, pB), { id: id(), type: 'segment', x1: 0, y1: 0, x2: 50, y2: 0, c: '#ffd400', w: 5, al: 0.38 }];
  const t = D(objs);
  ok(t.length === 1 && t[0].ids.length === 4 && t[0].text === 'Zeichne eine Strecke der Länge 5 cm.', 'Skizze und Marker hängen am Konstruktionsschritt', t.map(x => [x.text, x.ids.length]));
  ok(D([objs[0]])[0].text === 'Skizze und Beschriftung.', 'Nur Skizze: ein eigener Schritt');
}
ok(D([]).length === 0, 'Leeres Blatt: keine Schritte');
// Erst verbinden, dann beschriften (häufig im Unterricht)
{
  const s0 = seg(pA, pB, { via: 'ruler' }), a1 = arc(pA, 40, -0.2, -1, { t: 'set' }), a2 = arc(pB, 30, -1.8, -1, { t: 'typed' });
  const objs = [s0, a1, a2, seg(pA, pC), seg(pB, pC), pt(pA, 'A'), pt(pB, 'B'), pt(pC, 'C')];
  const t = D(objs).map(x => x.text);
  ok(t.join('|') === ['Zeichne die Strecke AB mit der Länge 5 cm.', 'Zeichne einen Kreisbogen um A mit dem Radius r = 4 cm.',
    'Zeichne einen Kreisbogen um B mit dem Radius r = 3 cm.', 'Der Schnittpunkt der beiden Kreisbögen ist C.', 'Verbinde A mit C und B mit C.'].join('|'),
    'Spät beschriftet: C bleibt konstruiert, nicht abgemessen', t);
  ok(D(objs).reduce((a, x) => a + x.ids.length, 0) === objs.length, 'Auch spät beschriftet: jedes Objekt genau einmal');
}
// Mittelsenkrechte: zwei Schnittpunkte derselben Bögen in einem Satz
{
  const S = { x: 25, y: -30 }, Tt = { x: 25, y: 30 }, r = Math.hypot(25, 30);
  const A = pt(pA, 'A'), B = pt(pB, 'B');
  const objs = [A, B, seg(pA, pB), arc(pA, r, -1.2, 2.4), arc(pB, r, Math.PI - 1.2, 2.4), seg(S, Tt, { via: 'ruler' }), pt(S, 'S'), pt(Tt, 'T')];
  const t = D(objs).map(x => x.text);
  ok(t[5] === 'Die Schnittpunkte der beiden Kreisbögen sind S und T.' && t[6] === 'Verbinde S mit T.', 'Mittelsenkrechte: Schnittpunkte zusammengefasst', t);
  ok(D(objs, 'en')[5].text === 'The intersections of the two arcs are S and T.', 'Mehrzahl auf Englisch');
}
// Vollkreis
ok(D([pt(pA, 'M'), arc(pA, 30, 0, K.TAU)])[1].text === 'Zeichne einen Kreis um M mit dem Radius r = 3 cm.', 'Vollkreis');

/* Verweise überleben das Neunummerieren beim Laden */
{
  const A = { id: 'alt7', type: 'point', x: 0, y: 0, label: 'A', ld: 7, c: '#3b3f45' };
  const B = { id: 'alt9', type: 'point', x: 50, y: 0, label: 'B', ld: 7, c: '#3b3f45' };
  const C = { id: 'zz', type: 'point', x: 0, y: 40, label: 'C', ld: 7, c: '#3b3f45' };
  const a1 = { id: 'q', type: 'arc', cx: 0, cy: 40, r: 50, a0: 0, sweep: 1, c: '#3b3f45', w: 0.5, al: 1, m: { rs: { t: 'taken', p: ['alt7', 'alt9'] } } };
  const a2 = { id: 'q2', type: 'arc', cx: 0, cy: 40, r: 50, a0: 0, sweep: 1, c: '#3b3f45', w: 0.5, al: 1, m: { rs: { t: 'taken', p: ['gibtsnicht', 'alt9'] } } };
  const raw = { format: 'zirkelwerk', v: 1, objects: [{ type: 'text' }, A, B, C, a1, a2], inst: { compass: { pid: 'alt7', rs: { t: 'taken', p: ['alt7', 'alt9'] } } } };
  const d2 = K.sanitizeDoc(JSON.parse(JSON.stringify(raw)), 'n', 1);
  const nA = d2.objects.find(o => o.label === 'A').id, nB = d2.objects.find(o => o.label === 'B').id;
  const arcs = d2.objects.filter(o => o.type === 'arc');
  ok(arcs[0].m.rs.t === 'taken' && arcs[0].m.rs.p[0] === nA && arcs[0].m.rs.p[1] === nB, 'Abgriff-Verweis auf neue Kennungen umgeschrieben', arcs[0].m);
  ok(arcs[1].m.rs.t === 'set', 'Verweis ins Leere wird verworfen');
  ok(d2.inst.compass.pid === nA && d2.inst.compass.rs.p[0] === nA, 'Zirkelzustand ebenfalls umgeschrieben', d2.inst.compass);
  ok(D(d2.objects).pop().text.startsWith('Zeichne einen Kreisbogen um C'), 'Nach dem Laden: verworfener Verweis → Zahl');
  ok(D(d2.objects)[D(d2.objects).length - 2].text.startsWith('Greife'), 'Nach dem Laden: gültiger Abgriff bleibt');
  const bad = K.sanitizeDoc({ format: 'zirkelwerk', v: 1, objects: [{ type: 'segment', x1: 0, y1: 0, x2: 1, y2: 1, m: { via: '<script>' } }, { type: 'arc', cx: 0, cy: 0, r: 1, a0: 0, sweep: 1, m: { rs: { t: 'taken', p: ['a', { x: 1 }] } } }] }, 'b', 1);
  ok(!bad.objects[0].m && !bad.objects[1].m, 'Ungültige Metadaten fallen weg');
}

}
/* ---------- Umriss ---------- */
const bb = K.boundsOf([{ type: 'arc', cx: 0, cy: 0, r: 10 }, { type: 'point', x: 30, y: 5 }]);
ok(bb.x0 === -10 && bb.x1 === 30 && bb.y0 === -10 && bb.y1 === 10, 'Umriss');
ok(K.boundsOf([]) === null, 'Leeres Blatt hat keinen Umriss');

/* ---------- Ausgabe ---------- */
console.log(`Zirkelwerk-Kerntest: ${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed) { console.log('\nFehlgeschlagen:\n  - ' + fails.join('\n  - ')); process.exit(1); }
