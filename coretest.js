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
  compassParts, detectScale, sanitizeDoc, newDoc, boundsOf, RULER, GEO, distToArc, nearestOnArc, describe, fmtCm, solveTriangle, labRandom, labConstruction, labPlan, checkTask, sanitizeTask, labGivenText, labValid, LAB_GIVEN,
  textFlip, qrEncode, qrPenalty, utf8Bytes, utf8Decode, b64uEncode, b64uDecode, linkForTask, linkForSheet, parseLink, linkKey,
  PdfCanvas, pdfRuns, pdfTextWidth, pdfWrap, pdfLayout, pdfCompose, pdfColor, pdfEsc, pdfBytes, PDF_PT, PDF_M, PDF_PAD };`, ctx);
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
const phoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
d = K.detectScale({ ua: phoneUA, maxTouch: 5, sw: 393, sh: 852, dpr: 3 });
ok(d.device === 'iphone' && d.sure && near(d.ppm, 460 / 3 / 25.4), 'iPhone 15 erkannt (460 ppi, 3×)');
d = K.detectScale({ ua: phoneUA, maxTouch: 5, sw: 667, sh: 375, dpr: 2 });
ok(d.sure && near(d.ppm, 163 / 25.4), 'iPhone SE (quer) erkannt');
ok(near(K.detectScale({ ua: phoneUA, sw: 414, sh: 896, dpr: 2 }).ppm, 163 / 25.4) && near(K.detectScale({ ua: phoneUA, sw: 414, sh: 896, dpr: 3 }).ppm, 458 / 3 / 25.4), 'iPhone XR und XS Max am dpr unterschieden');
ok(near(K.detectScale({ ua: phoneUA, sw: 360, sh: 780, dpr: 3 }).ppm, 476 / 3 / 25.4), 'iPhone mini erkannt');
d = K.detectScale({ ua: phoneUA, sw: 500, sh: 1000, dpr: 3 });
ok(d.device === 'iphone' && !d.sure, 'Unbekanntes iPhone: unsicher → Kalibrieren empfehlen');
/* Zahlen auf gedrehten Geräten */
ok(!K.textFlip(0) && !K.textFlip(Math.PI / 2) && !K.textFlip(-1.5) && K.textFlip(Math.PI) && K.textFlip(1.7) && K.textFlip(-2) && !K.textFlip(4.8), 'Zahlen werden ab mehr als 90° Drehung umgedreht');

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

/* ---------- Kongruenzsätze-Labor ---------- */
{
  const D = (objs, lang) => K.describe(objs, lang || 'de', I18N[lang || 'de']);
  const S = (k, g) => K.solveTriangle(k, g);
  let r = S('sss', { c: 50, b: 40, a: 30 });
  ok(r.sols.length === 1 && near(r.sols[0].C.x, 32, 1e-9) && near(r.sols[0].C.y, -24, 1e-9), 'SSS 3-4-5: C = (32 | −24), oberhalb von AB', r.sols[0] && r.sols[0].C);
  ok(near(r.sols[0].gamma, 90, 1e-9), 'SSS 3-4-5: rechter Winkel bei C');
  ok(S('sss', { c: 80, b: 40, a: 30 }).reason === 'ineq', 'SSS: Dreiecksungleichung verletzt');
  ok(S('sss', { c: 70, b: 40, a: 30 }).reason === 'ineq', 'SSS: Grenzfall a + b = c ist kein Dreieck');
  r = S('sws', { c: 60, b: 45, alpha: 50 });
  ok(r.sols.length === 1 && near(r.sols[0].b, 45, 1e-9) && near(r.sols[0].alpha, 50, 1e-9), 'SWS: b und α wie gegeben');
  r = S('wsw', { c: 60, alpha: 50, beta: 60 });
  ok(r.sols.length === 1 && near(r.sols[0].alpha, 50, 1e-9) && near(r.sols[0].beta, 60, 1e-9) && near(r.sols[0].gamma, 70, 1e-9), 'WSW: Winkel stimmen, γ = 70°');
  ok(S('wsw', { c: 60, alpha: 100, beta: 80 }).reason === 'angles', 'WSW: α + β = 180° geht nicht');
  r = S('ssw', { c: 50, a: 60, alpha: 50 });
  ok(r.sols.length === 1 && near(r.sols[0].a, 60, 1e-9), 'SsW mit a > c: eindeutig');
  r = S('ssw', { c: 60, a: 50, alpha: 40 });
  ok(r.sols.length === 2 && r.sols.every(t => near(t.a, 50, 1e-9) && near(t.alpha, 40, 1e-9)), 'SsW mit a < c: zwei Lösungen', r.sols.length);
  ok(S('ssw', { c: 60, a: 30, alpha: 40 }).reason === 'short', 'SsW: a zu kurz');
  const tan = S('ssw', { c: 60, a: 60 * Math.sin(40 * K.DEG), alpha: 40 });
  ok(tan.sols.length === 1 && near(tan.sols[0].gamma, 90, 1e-6), 'SsW Grenzfall: genau ein rechtwinkliges Dreieck');
  ok(S('sws', { c: 60, b: 45 }).reason === 'invalid' && S('xyz', {}).reason === 'invalid', 'Fehlende Werte erkannt');

  /* Zufallswerte: immer eindeutig und passend für das iPad */
  let seed = 7; const rng = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  let bad = 0;
  for (const k of ['sss', 'sws', 'wsw', 'ssw']) for (let n = 0; n < 150; n++) {
    const g = K.labRandom(k, rng), sol = S(k, g);
    if (sol.sols.length !== 1 || -sol.sols[0].C.y > 85 || !K.labValid(k, g)) bad++;
    if (Object.values(g).some(v => v % 5 !== 0)) bad++;   // glatte Werte: halbe cm bzw. 5°
  }
  ok(bad === 0, '600 Zufallsaufgaben: alle eindeutig, glatt und passend', bad);
  let monotone = 0;
  for (const k of ['sss', 'sws', 'wsw', 'ssw']) {
    const seen = new Set();
    for (let n = 0; n < 60; n++) seen.add(JSON.stringify(K.labRandom(k, rng)));
    if (seen.size < 15) monotone++;
  }
  ok(monotone === 0, 'Zufallswerte wechseln wirklich ab (kein ständiger Ersatzwert)', monotone);
  const gtx = K.labGivenText('sws', { c: 60, b: 45, alpha: 50 }, 'de', I18N.de);
  ok(gtx.replace(/\u00a0/g, ' ') === 'c = 6 cm, b = 4,5 cm und α = 50°', 'Gegebene Größen als Text', gtx);
  ok(gtx.includes('b\u00a0=\u00a04,5\u00a0cm'), 'Angaben mit geschützten Leerzeichen (kein Umbruch in „b = 4,5 cm“)');

  /* Vorführen: Objekte + Beschreibung je Satz */
  const ids = list => list.map((o, i) => Object.assign({ id: 'L' + i }, o));
  const text = (k, g) => { const c = K.labConstruction(k, g); return { st: D(ids(c.objects)), c }; };
  let t = text('sss', { c: 60, b: 50, a: 40 });
  ok(t.st.map(x => x.text).join('|') === ['Zeichne die Strecke AB mit der Länge 6 cm.', 'Zeichne einen Kreisbogen um A mit dem Radius r = 5 cm.',
    'Zeichne einen Kreisbogen um B mit dem Radius r = 4 cm.', 'Der Schnittpunkt der beiden Kreisbögen ist C.', 'Verbinde A mit C und B mit C.'].join('|'), 'Labor SSS: Beschreibung', t.st.map(x => x.text));
  t = text('sws', { c: 60, b: 45, alpha: 50 });
  ok(t.st.map(x => x.text).join('|') === ['Zeichne die Strecke AB mit der Länge 6 cm.', 'Trage in A an AB den Winkel α = 50° an.',
    'Zeichne einen Kreisbogen um A mit dem Radius r = 4,5 cm.', 'Der Schnittpunkt von dem freien Schenkel und dem Kreisbogen um A ist C.', 'Verbinde B mit C.'].join('|'), 'Labor SWS: Beschreibung', t.st.map(x => x.text));
  t = text('wsw', { c: 60, alpha: 50, beta: 60 });
  ok(t.st.map(x => x.text).join('|') === ['Zeichne die Strecke AB mit der Länge 6 cm.', 'Trage in A an AB den Winkel α = 50° an.',
    'Trage in B an AB den Winkel β = 60° an.', 'Der Schnittpunkt der beiden freien Schenkel ist C.'].join('|'), 'Labor WSW: Beschreibung', t.st.map(x => x.text));
  t = text('ssw', { c: 60, a: 50, alpha: 40 });
  ok(t.c.note === 'note_two' && t.st[3].text === 'Die Schnittpunkte von dem freien Schenkel und dem Kreisbogen um B sind C₁ und C₂.' && t.st[4].text === 'Verbinde B mit C₁ und B mit C₂.', 'Labor SsW: zwei Lösungen beschrieben', t.st.map(x => x.text));
  ok(K.labConstruction('sss', { c: 80, b: 40, a: 30 }).note === 'note_ineq' && K.labConstruction('wsw', { c: 60, alpha: 100, beta: 90 }).note === 'note_angles' && K.labConstruction('ssw', { c: 60, a: 20, alpha: 40 }).note === 'note_short', 'Nicht konstruierbar: passender Hinweis');
  const en2 = D(ids(K.labConstruction('wsw', { c: 60, alpha: 50, beta: 60 }).objects), 'en');
  ok(en2[1].text === 'At A, construct the angle α = 50° on AB.' && en2[3].text === 'The intersection of the two free arms is C.', 'Labor auf Englisch', en2.map(x => x.text));
  /* Jede Konstruktion: jedes Objekt genau einmal, C exakt dort, wo die Lösung liegt */
  let lost = 0;
  for (const [k, g] of [['sss', { c: 60, b: 50, a: 40 }], ['sws', { c: 60, b: 45, alpha: 50 }], ['wsw', { c: 60, alpha: 50, beta: 60 }], ['ssw', { c: 50, a: 60, alpha: 50 }], ['ssw', { c: 60, a: 50, alpha: 40 }]]) {
    const c = K.labConstruction(k, g), objs = ids(c.objects);
    if (D(objs).reduce((a, x) => a + x.ids.length, 0) !== objs.length) lost++;
    const chk = K.checkTask({ kind: k, given: g }, objs);
    if (!chk.ok) lost += 100;
  }
  ok(lost === 0, 'Vorgeführte Konstruktionen bestehen die eigene Prüfung', lost);

  /* Planfigur: eigener erster Schritt */
  const g1 = { c: 60, b: 45, alpha: 50 }, c1 = K.labConstruction('sws', g1);
  const planObjs = K.labPlan('sws', g1, c1.sols, { x: -90, y: -10 }, 'de', I18N.de);
  ok(planObjs.every(o => o.m && o.m.plan) && ['Gegeben:', 'c = 6 cm', 'b = 4,5 cm', 'α = 50°'].every(x => planObjs.some(o => o.type === 'text' && o.text.replace(/\u00a0/g, ' ') === x)), 'Planfigur mit gegebenen Größen');
  const withPlan = D(ids(planObjs.concat(c1.objects)));
  ok(withPlan[0].text === 'Fertige eine Planfigur an und markiere die gegebenen Größen.' && withPlan[0].ids.length === planObjs.length && withPlan[1].text.startsWith('Zeichne die Strecke AB'), 'Planfigur ist Schritt 1', withPlan.slice(0, 2).map(x => x.text));
  ok(planObjs.filter(o => o.type === 'stroke' && o.c === '#d0342c').length === 3, 'Gegebenes rot: b, c und Winkelbogen α');

  /* Prüfen einer Schülerkonstruktion */
  const task = { kind: 'sws', given: g1 };
  const student = ids(c1.objects);
  ok(K.checkTask(task, student).ok, 'Richtige Konstruktion besteht');
  const mirrored = student.map(o => o.type === 'point' ? Object.assign({}, o, { y: -o.y }) : o.type === 'segment' ? Object.assign({}, o, { y1: -o.y1, y2: -o.y2 }) : o);
  ok(K.checkTask(task, mirrored).ok, 'Gespiegeltes Dreieck ist auch richtig (Kongruenz)');
  const off = student.map(o => o.label === 'C' ? Object.assign({}, o, { x: o.x + 3 }) : o);
  const r2 = K.checkTask(task, off);
  ok(!r2.ok && r2.issues.some(i => i.k === 'side' && i.key === 'b') && r2.issues.some(i => i.k === 'angle' && i.key === 'alpha'), 'Verschobenes C: b und α werden bemängelt', r2.issues);
  ok(K.checkTask(task, student.filter(o => o.label !== 'B'))  .issues[0].k === 'missing', 'Fehlende Beschriftung erkannt');
  const noBC = student.filter(o => !(o.type === 'segment' && o.m && o.m.via === 'ruler' && o.x1 !== 0));
  ok(K.checkTask(task, noBC).issues.some(i => i.k === 'sides' && i.list.includes('BC')), 'Fehlende Seite BC erkannt');
  ok(K.checkTask({ kind: 'sss', given: { c: 80, b: 40, a: 30 } }, []).impossible === 'ineq', 'Unlösbare Aufgabe wird erkannt');
  ok(K.checkTask({ kind: 'ssw', given: { c: 60, a: 50, alpha: 40 } }, ids(K.labConstruction('ssw', { c: 60, a: 50, alpha: 40 }).objects)).second === true, 'SsW: Hinweis auf zweite Lösung');

  /* Aufgabe und Metadaten überstehen Speichern und Laden */
  ok(K.sanitizeTask({ kind: 'sws', given: { c: 60, b: 45, alpha: 50, x: 1 } }).given.x === undefined, 'Aufgabe: fremde Felder fallen weg');
  ok(K.sanitizeTask({ kind: 'sws', given: { c: 60, b: 45, alpha: 500 } }) === null && K.sanitizeTask({ kind: 'evil' }) === null, 'Aufgabe: ungültige Werte abgelehnt');
  const dd = K.sanitizeDoc({ format: 'zirkelwerk', v: 1, task: task, objects: c1.objects.concat(planObjs) }, 'q', 1);
  ok(dd.task && dd.task.kind === 'sws' && dd.objects.some(o => o.m && o.m.angle && o.m.angle.sym === 'α') && dd.objects.some(o => o.m && o.m.plan), 'Aufgabe, Winkel- und Planfigur-Angaben bleiben erhalten');
  ok(D(dd.objects.slice(0, c1.objects.length)).map(x => x.text)[1] === 'Trage in A an AB den Winkel α = 50° an.', 'Nach dem Laden: Winkel antragen erkannt');
}

/* ---------- Umriss ---------- */
const bb = K.boundsOf([{ type: 'arc', cx: 0, cy: 0, r: 10 }, { type: 'point', x: 30, y: 5 }]);
ok(bb.x0 === -10 && bb.x1 === 30 && bb.y0 === -10 && bb.y1 === 10, 'Umriss');
ok(K.boundsOf([]) === null, 'Leeres Blatt hat keinen Umriss');
const ba = K.boundsOf([{ type: 'arc', cx: 0, cy: 0, r: 10, a0: -0.3, sweep: 0.6 }]);
ok(near(ba.x1, 10) && ba.x0 > 9 && Math.abs(ba.y0) < 3.1 && Math.abs(ba.y1) < 3.1, 'Kurzer Bogen: Umriss nur um den gezeichneten Teil', ba);
const bb2 = K.boundsOf([{ type: 'arc', cx: 0, cy: 0, r: 10, a0: -Math.PI * 0.75, sweep: Math.PI * 0.5 }]);
ok(near(bb2.y0, -10) && bb2.x0 > -7.2 && bb2.x1 < 7.2, 'Bogen über die Spitze: höchster Punkt erfasst', bb2);

/* ---------- QR-Code und Aufgaben-Links ---------- */
{
  const mat = q => q.modules.map(r => r.map(c => (c ? 1 : 0)).join('')).join('\n');
  /* Bekannte Antworten: mit der Python-Bibliothek „qrcode" (gleiche Version,
     Stufe, Maske) Bit für Bit verglichen und mit zxing gelesen. */
  const q1 = K.qrEncode(K.utf8Bytes('zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=50'), 'M', 40);
  ok(q1.version === 4 && q1.level === 'Q' && q1.mask === 2 && K.linkKey(mat(q1)) === 'aqdf22', 'QR: Aufgaben-Link wie Referenz (v4, Stufe Q, Maske 2)', [q1.version, q1.level, q1.mask, K.linkKey(mat(q1))]);
  const q2 = K.qrEncode(K.utf8Bytes('x'.repeat(300)), 'L', 40);
  ok(q2.version === 11 && q2.mask === 0 && K.linkKey(mat(q2)) === 'pkjr5v', 'QR: Version 11 mit Versionsinfo wie Referenz', [q2.version, q2.mask, K.linkKey(mat(q2))]);
  const fin = (q, x0, y0) => [0, 1, 2, 3, 4, 5, 6].every(i => q.modules[y0][x0 + i] && q.modules[y0 + 6][x0 + i] && q.modules[y0 + i][x0] && q.modules[y0 + i][x0 + 6]) && q.modules[y0 + 3][x0 + 3];
  ok(fin(q1, 0, 0) && fin(q1, q1.size - 7, 0) && fin(q1, 0, q1.size - 7), 'QR: Suchmuster in drei Ecken');
  ok(K.qrEncode(K.utf8Bytes('y'.repeat(2000)), 'M', 22) === null, 'QR: Zu viel für die Grenze → null');
  ok(K.qrEncode(K.utf8Bytes('ä€😀'), 'M', 40) && K.utf8Decode(K.utf8Bytes('ä€😀 x')) === 'ä€😀 x', 'QR: UTF-8 hin und zurück');
  const masks = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(m => K.qrPenalty(K.qrEncode(K.utf8Bytes('Maskenwahl'), 'M', 40, m).modules)));
  ok(masks.size > 1 && K.qrPenalty(K.qrEncode(K.utf8Bytes('Maskenwahl'), 'M', 40).modules) === Math.min(...masks), 'QR: Maske mit den wenigsten Strafpunkten');
  for (const bytes of [[], [1], [1, 2], [255, 254, 253], [0, 0, 0, 0]]) ok(JSON.stringify(K.b64uDecode(K.b64uEncode(bytes))) === JSON.stringify(bytes), 'Base64url hin und zurück ' + bytes.length);

  /* Laboraufgabe */
  const task = { kind: 'ssw', given: { c: 50, a: 60, alpha: 50 } };
  const lt = K.linkForTask(task);
  ok(lt === 'zirkelwerk://a?v=1&k=ssw&c=50&a=60&alpha=50', 'Link: Laboraufgabe lesbar und kurz', lt);
  const pt = K.parseLink(lt);
  ok(pt.ok && pt.kind === 'task' && JSON.stringify(pt.task) === JSON.stringify(task), 'Link: Aufgabe hin und zurück', pt);
  ok(K.parseLink(encodeURIComponent(lt)).ok, 'Link: prozentkodiert (Android-Plugin) wird verstanden');
  ok(K.parseLink(lt.replace('v=1', 'v=2')).err === 'newer', 'Link: neuere Version erkannt');
  for (const bad of ['https://evil.example/a?v=1&k=sws', 'zirkelwerk://a?v=1&k=evil&c=1', 'zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=500',
    'zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=1e3', 'zirkelwerk://a?k=sws&c=60&b=45&alpha=50', 'zirkelwerk://s?v=1&d=%%%', 'zirkelwerk://s?v=1&d=e30',
    'zirkelwerk://s?v=1&d=' + K.b64uEncode(K.utf8Bytes('[1,2]')), 'zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=50&x=' + 'a'.repeat(5000)]) {
    ok(K.parseLink(bad).ok === false, 'Link: abgelehnt ' + bad.slice(0, 60));
  }

  /* Blatt: Beschreibung und Abgriff-Verweise überstehen den Weg durch den Code */
  const g = { c: 60, b: 45, alpha: 50 }, con = K.labConstruction('sws', g);
  const A = { id: 'pA', type: 'point', x: 0, y: 0, label: 'A', ld: 5, c: '#3b3f45' }, B = { id: 'pB', type: 'point', x: 37.3, y: 0, label: 'B', ld: 7, c: '#3b3f45' };
  const own = [A, B,
    { id: 's1', type: 'segment', x1: 0, y1: 0, x2: 37.3, y2: 0, c: '#3b3f45', w: 0.5, al: 1, m: { via: 'ruler' } },
    { id: 'k1', type: 'arc', cx: 0, cy: 0, r: 37.3, a0: -1.2, sweep: -0.9, c: '#1f5fbf', w: 0.5, al: 1, m: { rs: { t: 'taken', p: ['pA', 'pB'] } } },
    { id: 'm1', type: 'stroke', pts: [1, 2, 3.04, 4.06, 5, 1], c: '#e0b400', w: 4, al: 0.4 },
    { id: 't1', type: 'text', x: 5, y: -20, text: 'Mittelsenkrechte „ä“', size: 4, c: '#d0342c' }];
  const sheet = { name: 'Übung', objects: con.objects.map((o, i) => Object.assign({ id: 'L' + i }, o)).concat(own) };
  const ls = K.linkForSheet(sheet), ps = K.parseLink(ls);
  ok(ps.ok && ps.kind === 'sheet', 'Link: Blatt lesbar', ls.length);
  const dd2 = K.sanitizeDoc(ps.raw, 'n', 1);
  ok(dd2.name === 'Übung' && dd2.objects.length === sheet.objects.length, 'Link: Name und alle Objekte da');
  ok(JSON.stringify(K.describe(dd2.objects, 'de', I18N.de).map(x => x.text)) === JSON.stringify(K.describe(sheet.objects, 'de', I18N.de).map(x => x.text)), 'Link: Beschreibung identisch nach dem Scannen', K.describe(dd2.objects, 'de', I18N.de).map(x => x.text));
  const arc2 = dd2.objects.find(o => o.type === 'arc' && o.r === 37.3);
  ok(arc2.m && arc2.m.rs.t === 'taken' && dd2.objects.find(o => o.id === arc2.m.rs.p[0]).label === 'A', 'Link: Abgriff-Verweis zeigt wieder auf A');
  const st2 = dd2.objects.find(o => o.type === 'stroke');
  ok(st2 && st2.al === 0.4 && near(st2.pts[2], 3, 1e-9) && near(st2.pts[3], 4.1, 1e-9) && st2.pts.length === 6, 'Link: Freihand auf 0,1 mm, durchscheinend', st2 && st2.pts);
  ok(dd2.objects.find(o => o.type === 'text').text === 'Mittelsenkrechte „ä“', 'Link: Text mit Umlauten');
  ok(K.linkKey(ls) === K.linkKey(ls) && K.linkKey(ls) !== K.linkKey(lt), 'Link: Kennung stabil und unterscheidbar');
  ok(K.sanitizeDoc({ format: 'zirkelwerk', v: 1, objects: [], src: 'abc123' }, 'x', 1).src === 'abc123' && K.sanitizeDoc({ format: 'zirkelwerk', v: 1, objects: [], src: '<script>' }, 'x', 1).src === null, 'Herkunft des Blatts wird gespeichert und geprüft');
  /* Untergeschobene Felder werden beim Laden verworfen */
  const evil = 'zirkelwerk://s?v=1&d=' + K.b64uEncode(K.utf8Bytes(JSON.stringify({ n: 'x', o: [[0, 1, 2, 'A', 7, 'javascript:alert(1)'], [3, ['a', 1]], [9, 1]] })));
  const pe = K.parseLink(evil), de2 = K.sanitizeDoc(pe.raw, 'e', 1);
  ok(pe.ok && de2.objects.length === 1 && de2.objects[0].c === '#3b3f45', 'Link: falsche Farbe, kaputte Striche und unbekannte Typen fallen weg', de2.objects);
}

/* ---------- PDF ---------- */
{
  /* Die echte Zeichenroutine der App, damit das PDF genau das zeigt, was
     auch auf dem Bildschirm steht. */
  const ds = html.indexOf('/* k = Pixel je Millimeter'), de = html.indexOf('/* ---------- Deckschicht');
  vm.runInContext('var S = { pointStyle: "cross" };\n' + html.slice(ds, de) + '\nthis.drawObjects = drawObjects;', ctx);
  const draw = (c, objs, k) => ctx.drawObjects(c, objs, k, null);
  const R = K.pdfRuns('Ä–α C₁ 😀', false);
  ok(R[0].f === 'F1' && R[0].codes[0] === 0xC4 && R[0].codes[1] === 0x96, 'PDF: Umlaut und Gedankenstrich in WinAnsi', R[0].codes);
  ok(R[1].f === 'F3' && R[1].codes[0] === 0x61, 'PDF: α über die Symbol-Schrift', R[1]);
  ok(R.some(r => r.sub && r.codes[0] === 49), 'PDF: tiefgestellte 1 als kleine Ziffer');
  ok(R[R.length - 1].codes.slice(-1)[0] === 63, 'PDF: Unbekanntes Zeichen wird „?"');
  ok(near(K.pdfTextWidth('Hallo', 10), 22.78, 1e-9), 'PDF: Textbreite nach Helvetica-Maßen', K.pdfTextWidth('Hallo', 10));
  ok(near(K.pdfTextWidth('Hallo', 10, true), 24.45, 1e-9), 'PDF: Textbreite fett', K.pdfTextWidth('Hallo', 10, true));
  ok(K.pdfEsc([40, 41, 92, 65, 228]) === '\\(\\)\\\\A\\344', 'PDF: Klammern, Backslash, Umlaut maskiert', K.pdfEsc([40, 41, 92, 65, 228]));
  ok(JSON.stringify(K.pdfColor('#d0342c').map(v => Math.round(v * 255))) === '[208,52,44]' && K.pdfColor('rgba(0, 255, 0, .5)')[1] === 1, 'PDF: Farben');
  const wr = K.pdfWrap('eins zwei drei vier fünf sechs b = 4,5 cm', 30, 3.6);
  ok(wr.length > 1 && wr.every(l => K.pdfTextWidth(l, 3.6) <= 30 + 1e-9) && wr.some(l => l.includes('b = 4,5 cm')), 'PDF: Umbruch, geschützte Leerzeichen halten', wr);

  /* Seitenwahl */
  const L1 = K.pdfLayout({ x0: 0, y0: 0, x1: 100, y1: 80 }, { head: true });
  ok(L1.orient === 'portrait' && L1.s === 1, 'PDF: Kleine Zeichnung hochkant in Originalgröße', L1);
  const L2 = K.pdfLayout({ x0: 0, y0: 0, x1: 240, y1: 90 }, { head: true });
  ok(L2.orient === 'landscape' && L2.s === 1, 'PDF: Breite Zeichnung quer in Originalgröße', L2);
  const L3 = K.pdfLayout({ x0: -50, y0: 0, x1: 450, y1: 100 }, { head: true });
  ok(L3.orient === 'landscape' && L3.s < 1 && L3.s === Math.floor(L3.s * 100) / 100 && (500 + 2 * K.PDF_PAD) * L3.s <= L3.area.w + 1e-9, 'PDF: Zu große Zeichnung auf ganze Prozent verkleinert', L3);
  const L4 = K.pdfLayout({ x0: 0, y0: 0, x1: 240, y1: 40 }, { taskOnly: true });
  ok(L4.orient === 'portrait' && L4.px === K.PDF_M, 'PDF: Arbeitsblatt immer hochkant, oben links', L4);
  ok(K.pdfLayout(null, {}).s === 1, 'PDF: Leeres Blatt geht');

  /* Bögen: Bézierstücke liegen auf dem Kreis */
  const pc = new K.PdfCanvas({ s: 1, ox: 0, oy: 0, px: 100, py: 100, H: 297 }, { gs: {} });
  pc.lineWidth = 0.5; pc.beginPath(); pc.arc(0, 0, 20, 0, K.TAU); pc.stroke();
  ok((pc.out[0].match(/ c /g) || []).length === 4, 'PDF: Vollkreis aus vier Bézierstücken', pc.out[0]);
  {
    const bz = new K.PdfCanvas({ s: 1, ox: 0, oy: 0, px: 0, py: 0, H: 0 }, { gs: {} });
    /* H = 0: Y = -y·PT, also einfach zurückrechnen */
    bz.beginPath(); bz.arc(0, 0, 50, 0.3, 0.3 + 2.5, false); bz.stroke();
    const n = bz.out[0].match(/-?[\d.]+/g).map(Number);
    let maxErr = 0;
    const cmd = bz.out[0].split(' S ')[0];
    const pts = []; const re = /(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) c/g; let mm;
    const st = /(-?[\d.]+) (-?[\d.]+) m/.exec(cmd);
    let px0 = +st[1], py0 = +st[2];
    while ((mm = re.exec(cmd))) {
      const q = mm.slice(1).map(Number);
      for (let tt = 0; tt <= 1; tt += 0.125) {
        const u = 1 - tt;
        const x = u * u * u * px0 + 3 * u * u * tt * q[0] + 3 * u * tt * tt * q[2] + tt * tt * tt * q[4];
        const y = u * u * u * py0 + 3 * u * u * tt * q[1] + 3 * u * tt * tt * q[3] + tt * tt * tt * q[5];
        maxErr = Math.max(maxErr, Math.abs(Math.hypot(x, y) / K.PDF_PT - 50));
      }
      pts.push(q); px0 = q[4]; py0 = q[5];
    }
    const end = Math.atan2(-py0, px0);
    ok(pts.length === 2 && maxErr < 0.05 && near(end, 2.8, 2e-3), 'PDF: Bogen genau und endet am richtigen Winkel', { maxErr, end, n: pts.length });
    const bc = new K.PdfCanvas({ s: 1, ox: 0, oy: 0, px: 0, py: 0, H: 0 }, { gs: {} });
    bc.beginPath(); bc.arc(0, 0, 50, 1, 0.5, true); bc.stroke();
    const ends = bc.out[0].match(/(-?[\d.]+) (-?[\d.]+) c S/);
    ok(near(Math.atan2(-ends[2], +ends[1]), 0.5, 2e-3) && (bc.out[0].match(/ c /g) || []).length === 1, 'PDF: Bogen gegen den Uhrzeigersinn (kurzer Weg)', bc.out[0]);
  }

  /* Ganze Datei */
  const lab = K.labConstruction('sws', { c: 60, b: 45, alpha: 50 });
  const plan = K.labPlan('sws', { c: 60, b: 45, alpha: 50 }, K.solveTriangle('sws', { c: 60, b: 45, alpha: 50 }).sols, { x: -70, y: -20 }, 'de', I18N.de);
  const withIds = list => list.map((o, i) => Object.assign({ id: 'P' + i }, o));
  const objs = withIds(plan.concat(lab.objects).concat([{ type: 'stroke', pts: [0, 10, 5, 12, 10, 10], c: '#e0b400', w: 4, al: 0.4 }]));
  const steps = K.describe(objs, 'de', I18N.de).map(s => s.text);
  ok(steps.length >= 5, 'PDF: Beschreibung des Laborblatts vollständig', steps);
  const make = o => K.pdfCompose(Object.assign({ objects: objs, draw, grid: true, head: { name: 'Name:', date: 'Datum:' }, title: 'Aufgabe SWS – Ä', date: '20261023120000' }, o));
  const checkFile = (pdf, label) => {
    ok(/^[\x00-\x7f]*$/.test(pdf), label + ': nur ASCII');
    const sx = +/startxref\n(\d+)\n%%EOF\n$/.exec(pdf)[1];
    ok(pdf.slice(sx, sx + 4) === 'xref', label + ': startxref zeigt auf xref', sx);
    const rows = pdf.slice(sx).split('\n').filter(l => / 00000 n $/.test(l)).map(l => +l.slice(0, 10));
    ok(rows.length > 5 && rows.every((off, i) => pdf.startsWith((i + 1) + ' 0 obj', off)), label + ': Verzeichnis stimmt für jedes Objekt');
    const lens = [...pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)];
    ok(lens.length > 0 && lens.every(m => pdf.slice(m.index + m[0].length + +m[1], m.index + m[0].length + +m[1] + 10) === '\nendstream'), label + ': Stream-Längen stimmen');
  };
  const r1 = make({ desc: { title: 'Konstruktionsbeschreibung', steps } });
  checkFile(r1.pdf, 'PDF');
  ok(r1.layout.s === 1 && r1.pages === 1, 'PDF: Lab-Blatt mit Beschreibung auf einer Seite, 1 : 1', { s: r1.layout.s, pages: r1.pages });
  ok(r1.pdf.includes('/BM /Multiply') && r1.pdf.includes('/F3 '), 'PDF: Marker durchscheinend, Griechisch über Symbol');
  ok(r1.pdf.includes('(Name:) Tj') && r1.pdf.includes('/Title <FEFF'), 'PDF: Kopfzeile und Titel');
  ok(!K.pdfCompose({ objects: objs, draw, title: '' }).pdf.includes('(Name:)'), 'PDF: Kopfzeile abschaltbar');
  const long = make({ desc: { title: 'K', steps: Array.from({ length: 70 }, (_, i) => 'Schritt ' + i + ' mit etwas längerem Text, der sicher umbrochen werden muss, weil er so lang ist.') } });
  checkFile(long.pdf, 'PDF lang');
  ok(long.pages >= 3 && (long.pdf.match(/\/Type \/Page /g) || []).length === long.pages, 'PDF: Lange Beschreibung auf Folgeseiten', long.pages);
  const big = make({ objects: objs.concat([{ type: 'segment', x1: -300, y1: 0, x2: 300, y2: 0, c: '#000000', w: 0.3, al: 1 }]) });
  ok(big.layout.s < 1 && big.pdf.includes('(Verkleinert') === false && make({ objects: objs.concat([{ type: 'segment', x1: -300, y1: 0, x2: 300, y2: 0, c: '#000000', w: 0.3, al: 1 }]), scaledNote: p => 'Verkleinert auf ' + p + ' %' }).pdf.includes('(Verkleinert auf ' + Math.round(big.layout.s * 100) + ' %) Tj'), 'PDF: Verkleinerung mit Hinweis', big.layout.s);
  const task = make({ taskOnly: true, objects: objs.filter(o => o.m && o.m.plan), taskLine: 'Konstruiere das Dreieck ABC mit c = 6 cm.' });
  ok(task.layout.orient === 'portrait' && task.layout.s === 1 && task.pdf.includes('Konstruiere'), 'PDF: Arbeitsblatt mit Aufgabenzeile');

  /* Wenn vorhanden: echte PDF-Werkzeuge als Gegenprobe (lokal; in der CI optional) */
  const cp = require('child_process'), os = require('os'), path = require('path');
  const has = cmd => cp.spawnSync('sh', ['-c', 'command -v ' + cmd]).status === 0;
  if (has('qpdf') && has('pdftotext')) {
    const f = path.join(os.tmpdir(), 'zw-test-' + process.pid + '.pdf');
    fs.writeFileSync(f, Buffer.from(K.pdfBytes(r1.pdf)));
    const q = cp.spawnSync('qpdf', ['--check', f], { encoding: 'utf8' });
    ok(q.status === 0 && /No syntax or stream encoding errors/.test(q.stdout) && !/WARNING/.test(q.stdout + q.stderr), 'PDF: qpdf --check ohne Befund', q.stdout + q.stderr);
    const txt = cp.spawnSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }).stdout;
    ok(txt.includes('Trage in A an AB den Winkel α = 50° an.') && txt.includes('Planfigur') && txt.includes('Name:'), 'PDF: Text lesbar (auch α und °)', txt);
    fs.unlinkSync(f);
  } else console.log('  (qpdf/pdftotext nicht installiert – PDF-Gegenprobe übersprungen)');
}

/* ---------- Ausgabe ---------- */
console.log(`Zirkelwerk-Kerntest: ${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed) { console.log('\nFehlgeschlagen:\n  - ' + fails.join('\n  - ')); process.exit(1); }
