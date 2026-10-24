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
  textFlip, GEO_KINDS, GEO_TASKS, geoStart, geoSolution, geoSolutionSteps, checkGeoTask, sanitizeInst, normAng, diagnose, taskProgress, labSolutionSteps, mapObject, BODY_KINDS, BODY_DEFAULTS, bodyValid, bodyNet, foldNet, bodyFaces, bodyMeasures, netDrawing, obliqueDrawing, bodySheetObjects, clozeSteps, intersectionsAdded, linkForResult, resultCodes, summarizeResults, taskKey, encodeObjs, decodeObjs, qrEncode, qrPenalty, utf8Bytes, utf8Decode, b64uEncode, b64uDecode, linkForTask, linkForSheet, parseLink, linkKey,
  eraseTarget, cutObject, CUT_MIN, labelDirFor, pointMovable, pointMoveEntry,
  IMG, b64Bytes, jpegInfo, jpegFromDataUrl, imgRect, sanitizeObject, encodeObjs,
  hexominos, cubeNets, cubeNonNets, cubeFoldCheck, gridNet, unfoldFaces, bodySolid, BODY_INT,
  cleanFolder, folderList, sameFolder, makeBackup, isBackup, readBackup, planRestore, cleanResults, mergeResults,
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
ok(!d.sure && near(d.ppm, 163 / 25.4), 'iPhone SE (quer): Maß stimmt, aber unsicher (Anzeigezoom möglich)');
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

/* ---------- Fehlerdiagnose und gestufte Hilfen ---------- */
{
  const P = (x, y, label) => ({ id: 'p' + label, type: 'point', x, y, label, ld: 7, c: '#3b3f45' });
  const S = (a, b, extra) => Object.assign({ type: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, c: '#3b3f45', w: 0.5, al: 1 }, extra || {});
  const tri = (A, B, C, more) => [P(A.x, A.y, 'A'), P(B.x, B.y, 'B'), P(C.x, C.y, 'C'), S(A, B), S(B, C), S(A, C)].concat(more || []).map((o, i) => Object.assign({ id: 'o' + i }, o));
  const polar = (A, len, deg) => ({ x: A.x + len * Math.cos(-deg * DEGR), y: A.y + len * Math.sin(-deg * DEGR) });
  var DEGR = Math.PI / 180;
  const A0 = { x: 0, y: 0 }, B0 = { x: 60, y: 0 };
  /* SWS c = 6, b = 4,5, α = 50 – Schüler trägt 130° an (falsche Skala) */
  const t1 = { kind: 'sws', given: { c: 60, b: 45, alpha: 50 } };
  const r1 = K.checkTask(t1, tri(A0, B0, polar(A0, 45, 130)));
  ok(r1.issues.some(i => i.key === 'alpha' && i.why === 'scale'), 'Diagnose: falsche Gradskala erkannt', r1.issues);
  /* Winkel am falschen Eckpunkt (bei B statt bei A) */
  const Cb = polar(B0, 45, 130);
  const r2 = K.checkTask(t1, tri(A0, B0, Cb));
  ok(r2.issues.some(i => i.key === 'alpha' && i.why === 'vertex' && i.at === 'B'), 'Diagnose: Winkel am falschen Eckpunkt', r2.issues);
  /* SSS mit vertauschten Seiten a und b */
  const t3 = { kind: 'sss', given: { c: 60, b: 50, a: 40 } };
  const sol = K.solveTriangle('sss', { c: 60, b: 40, a: 50 }).sols[0];
  const r3 = K.checkTask(t3, tri(A0, B0, sol.C));
  ok(r3.issues.some(i => i.key === 'b' && i.why === 'swap' && i.other === 'a'), 'Diagnose: a und b vertauscht', r3.issues);
  /* Bogen um A mit richtigem Radius, aber C daneben gesetzt */
  const solOk = K.solveTriangle('sss', t3.given).sols[0];
  const arcA = { type: 'arc', cx: 0, cy: 0, r: 50, a0: -1.5, sweep: 1, c: '#1f5fbf', w: 0.5, al: 1 };
  const Coff = { x: solOk.C.x + 2.5, y: solOk.C.y - 1 };
  const r4 = K.checkTask(t3, tri(A0, B0, Coff, [arcA]));
  ok(r4.issues.some(i => i.key === 'b' && i.why === 'offarc' && i.at === 'A'), 'Diagnose: C liegt neben dem Kreisbogen', r4.issues);
  /* Zirkel falsch eingestellt (5,3 statt 5 cm), C sauber auf dem Bogen */
  const solR = K.solveTriangle('sss', { c: 60, b: 53, a: 40 }).sols[0];
  const r5 = K.checkTask(t3, tri(A0, B0, solR.C, [Object.assign({}, arcA, { r: 53 })]));
  ok(r5.issues.some(i => i.key === 'b' && i.why === 'radius' && Math.abs(i.r - 53) < 1e-9), 'Diagnose: Zirkel falsch eingestellt', r5.issues);
  /* Um 1 cm verzählt */
  const r6 = K.checkTask({ kind: 'sws', given: { c: 60, b: 45, alpha: 50 } }, tri(A0, { x: 70, y: 0 }, polar(A0, 45, 50)));
  ok(r6.issues.some(i => i.key === 'c' && i.why === 'cm'), 'Diagnose: um 1 cm verzählt', r6.issues);
  /* Knapp daneben */
  const r7 = K.checkTask(t1, tri(A0, B0, polar(A0, 47.5, 50)));
  ok(r7.issues.some(i => i.key === 'b' && i.why === 'close'), 'Diagnose: knapp daneben', r7.issues);
  ok(K.checkTask(t1, tri(A0, B0, polar(A0, 45, 50))).ok, 'Diagnose stört richtige Lösung nicht');

  /* Fortschritt: Musterlösung gedreht und gespiegelt, schrittweise */
  const T = I18N.de;
  for (const kind of ['sss', 'sws', 'wsw', 'ssw']) {
    const g = { sss: { c: 60, b: 50, a: 40 }, sws: { c: 60, b: 45, alpha: 50 }, wsw: { c: 60, alpha: 50, beta: 60 }, ssw: { c: 50, a: 60, alpha: 50 } }[kind];
    const ss = K.labSolutionSteps(kind, g, 'de', T);
    for (const [rot, flip] of [[0.7, 1], [2.9, -1]]) {
      const c = Math.cos(rot), s2 = Math.sin(rot), map = p => ({ x: 20 + p.x * c - p.y * flip * s2, y: -5 + p.x * s2 + p.y * flip * c });
      let allOk = true, lastNext = -1;
      for (let n = 0; n <= ss.steps.length; n++) {
        const ids = new Set(ss.steps.slice(0, n).flatMap(st => st.ids));
        const student = ss.objects.filter(o => ids.has(o.id)).map(o => K.mapObject(o, map, rot, flip)).filter(Boolean);
        const pr = K.taskProgress({ kind, given: g }, student, 'de', T);
        const want = n === ss.steps.length ? -1 : n;
        if (pr.next !== want) { allOk = false; lastNext = [n, pr.next]; break; }
        if (want >= 0 && !pr.ghost.length && n > 0) { allOk = false; lastNext = ['ghost', n]; break; }
      }
      ok(allOk, 'Hilfe: nächster Schritt richtig erkannt (' + kind + (flip < 0 ? ', gespiegelt' : '') + ')', lastNext);
    }
  }
  {
    /* Gespiegelter Bogen: Anfangs- und Endpunkt liegen dort, wo die Abbildung sie hinschickt */
    const arc = { type: 'arc', cx: 10, cy: 5, r: 20, a0: 0.4, sweep: 1.1 }, rot = 0.8, flip = -1;
    const c = Math.cos(rot), s2 = Math.sin(rot), map = p => ({ x: p.x * c - p.y * flip * s2, y: p.x * s2 + p.y * flip * c });
    const m = K.mapObject(arc, map, rot, flip), end = (o, a) => ({ x: o.cx + o.r * Math.cos(a), y: o.cy + o.r * Math.sin(a) });
    const e0 = map(end(arc, arc.a0)), e1 = map(end(arc, arc.a0 + arc.sweep)), f0 = end(m, m.a0), f1 = end(m, m.a0 + m.sweep);
    ok(near(e0.x, f0.x, 1e-9) && near(e0.y, f0.y, 1e-9) && near(e1.x, f1.x, 1e-9) && near(e1.y, f1.y, 1e-9), 'Hilfe: gespiegelter Bogen liegt richtig');
  }
  const pr0 = K.taskProgress(t1, [], 'de', T);
  ok(pr0.next === 0 && /Strecke AB/.test(pr0.steps[0].text), 'Hilfe: leeres Blatt → erster Schritt ist die Strecke AB', pr0.steps[0].text);
  /* Geisterbild liegt dort, wo der Schüler weiterzeichnen muss */
  const ssS = K.labSolutionSteps('sss', t3.given, 'de', T);
  const st1 = ssS.objects.filter(o => new Set(ssS.steps[0].ids).has(o.id)).map(o => K.mapObject(o, p => ({ x: p.x + 100, y: p.y + 50 }), 0, 1));
  const pg = K.taskProgress(t3, st1, 'de', T);
  ok(pg.next === 1 && pg.ghost.length === 1 && pg.ghost[0].type === 'arc' && near(pg.ghost[0].cx, 100) && near(pg.ghost[0].cy, 50) && near(pg.ghost[0].r, 50), 'Hilfe: Geisterbild des nächsten Schritts verschoben mit', pg.ghost);
}

/* ---------- Befunde der unabhängigen Durchsicht ---------- */
{
  const b64 = o => K.b64uEncode(K.utf8Bytes(JSON.stringify(o)));
  let threw = false, r;
  try { r = K.parseLink('zirkelwerk://s?v=1&d=' + b64({ n: 'x', o: [['length', 1, 2], ['constructor'], [1.5, 1], [-1, 2], [0, 1, 2]] })); } catch (e) { threw = true; }
  ok(!threw && r.ok && r.raw.objects.length === 1, 'Link: Typ als Text/Bruch/negativ wird verworfen, nicht abgestürzt', r);
  const circ = { name: 'k', objects: [{ id: 'a', type: 'point', x: 0, y: 0, label: 'M', ld: 7, c: '#3b3f45' }, { id: 'c', type: 'arc', cx: 0, cy: 0, r: 30, a0: 0, sweep: K.TAU, c: '#1f5fbf', w: 0.5, al: 1 }] };
  const rc = K.sanitizeDoc(K.parseLink(K.linkForSheet(circ)).raw, 'n', 1);
  ok(rc.objects[1].sweep === K.TAU && /Kreis um M/.test(K.describe(rc.objects, 'de', I18N.de)[1].text), 'Link: Vollkreis bleibt Vollkreis', rc.objects[1].sweep);
  const plain = 'zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=50';
  ok(K.parseLink('  ' + encodeURIComponent(plain) + ' ').url === plain && K.parseLink(plain).url === plain, 'Link: Kennung aus bereinigter Adresse (Doppel-Scan sicher)');
  const inj = K.describe([{ id: 'p', type: 'point', x: 0, y: 0, label: '{l}', ld: 7 }, { id: 's', type: 'segment', x1: 0, y1: 0, x2: 54, y2: 0, w: 0.5, al: 1 }], 'de', I18N.de);
  ok(inj.every(st => !/5,4 cm aus/.test(st.text)) && inj.some(st => st.text.includes('{l}')), 'Beschreibung: Punktname „{l}" löst keinen Platzhalter aus', inj.map(x => x.text));
  const ww = K.pdfWrap('W'.repeat(60) + ' und noch mehr Text', 50, 3.6);
  ok(ww.every(l => K.pdfTextWidth(l, 3.6) <= 50 + 1e-9), 'PDF: überlanges Wort mitten im Absatz wird getrennt', ww);
  const ins = K.sanitizeInst({ ruler: { on: true, x: 0, y: 0, rot: -1745.3 }, geo: {}, compass: { ang: 1e5 } });
  ok(near(Math.cos(ins.ruler.rot), Math.cos(-1745.3), 1e-9) && near(Math.sin(ins.ruler.rot), Math.sin(-1745.3), 1e-9) && Math.abs(ins.ruler.rot) <= Math.PI && Math.abs(ins.compass.ang) <= Math.PI, 'Gerätewinkel werden normalisiert statt abgeschnitten', ins.ruler.rot);
}

/* ---------- Grundkonstruktionen ---------- */
{
  let seed = 11; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const withIds = (l, p) => l.map((o, i) => Object.assign({ id: p + i }, o));
  for (const kind of K.GEO_KINDS) {
    for (let n = 0; n < 5; n++) {
      const g = K.GEO_TASKS[kind].random(rng);
      if (!K.sanitizeTask({ kind, given: g })) { ok(false, 'Grundkonstruktion: Zufallsfigur gültig (' + kind + ')', g); break; }
      const start = withIds(K.geoStart(kind, g), 'g'), sol = withIds(K.geoSolution(kind, g), 's');
      const all = start.concat(sol);
      const r = K.checkTask({ kind, given: g }, all);
      if (!r.ok) { ok(false, 'Grundkonstruktion: Musterlösung besteht (' + kind + ')', r.issues); break; }
      if (K.checkTask({ kind, given: g }, start).ok) { ok(false, 'Grundkonstruktion: leere Lösung fällt durch (' + kind + ')'); break; }
      /* Über Speichern und Link: Ausgangsfigur bleibt markiert, Aufgabe heil */
      const dd = K.sanitizeDoc({ format: 'zirkelwerk', v: 1, task: { kind, given: g }, objects: all }, 'q', 1);
      if (!dd.task || dd.objects.filter(o => o.m && o.m.giv).length !== start.length || !K.checkTask(dd.task, dd.objects).ok) { ok(false, 'Grundkonstruktion: Laden erhält Ausgangsfigur (' + kind + ')'); break; }
      const pl = K.parseLink(K.linkForTask({ kind, given: g }));
      if (!pl.ok || JSON.stringify(Object.keys(pl.task.given)) !== JSON.stringify(K.GEO_TASKS[kind].keys)) { ok(false, 'Grundkonstruktion: Link hin und zurück (' + kind + ')', pl); break; }
      /* Fortschritt: Schritt für Schritt */
      const ss = K.geoSolutionSteps(kind, g, 'de', I18N.de);
      let good = true;
      for (let k = 0; k <= ss.steps.length && good; k++) {
        const ids = new Set(ss.steps.slice(0, k).flatMap(st => st.ids));
        const pr = K.taskProgress({ kind, given: g }, start.concat(ss.objects.filter(o => ids.has(o.id))), 'de', I18N.de);
        if (pr.next !== (k === ss.steps.length ? -1 : k)) good = false;
      }
      if (!good) { ok(false, 'Grundkonstruktion: nächster Schritt richtig (' + kind + ')'); break; }
      if (n === 4) ok(true, 'Grundkonstruktion ' + kind + ': 5 Zufallsfiguren – Lösung, Prüfung, Laden, Link, Hilfen');
    }
  }
  /* Diagnosen */
  const g = { ax: -30, ay: 0, bx: 30, by: 0 }, start = withIds(K.geoStart('msk', g), 'g');
  const seg = (x1, y1, x2, y2, m) => ({ id: 'x' + Math.random(), type: 'segment', x1, y1, x2, y2, c: '#3b3f45', w: 0.5, al: 1, m });
  const arc = (cx, cy, r) => ({ id: 'a' + Math.random(), type: 'arc', cx, cy, r, a0: -2, sweep: 1.5, c: '#1f5fbf', w: 0.5, al: 1 });
  const ck = objs => K.checkTask({ kind: 'msk', given: g }, start.concat(objs));
  ok(ck([seg(0, -30, 0, 30)]).ok && ck([seg(0, -30, 0, 30)]).notes.includes('g_noCompass'), 'Mittelsenkrechte mit Geodreieck: richtig, Hinweis auf Zirkel');
  ok(ck([arc(-30, 0, 40), arc(30, 0, 40), seg(0, -30, 0, 30)]).notes.length === 0, 'Mittelsenkrechte mit Zirkel: kein Hinweis');
  const off = ck([arc(-30, 0, 40), arc(30, 0, 45), seg(3, -30, 3, 30)]);
  ok(!off.ok && off.issues[0].k === 'g_offset' && near(off.issues[0].d, 3, 1e-9) && off.issues[0].why === 'radii', 'Mittelsenkrechte daneben: verschiedene Radien erkannt', off.issues);
  const ang = ck([seg(-3, -30, 3, 30)]);
  ok(!ang.ok && ang.issues[0].k === 'g_angle' && ang.issues[0].dev > 5, 'Mittelsenkrechte schief: Winkelabweichung', ang.issues);
  const small = ck([arc(-30, 0, 25), arc(30, 0, 25)]);
  ok(small.issues[0].k === 'g_none' && small.issues[0].why === 'small', 'Mittelsenkrechte: zu kleine Bögen erkannt', small.issues);
  const gw = { sx: 0, sy: 0, d1: 0, d2: -60 }, sw = withIds(K.geoStart('wh', gw), 'g');
  const out = K.checkTask({ kind: 'wh', given: gw }, sw.concat([seg(0, 0, -40 * Math.cos(-30 * Math.PI / 180), -40 * Math.sin(-30 * Math.PI / 180))]));
  ok(out.issues.some(i => i.k === 'g_outside'), 'Winkelhalbierende nach außen erkannt', out.issues);
  const gl = { g1x: -60, g1y: 0, g2x: 60, g2y: 0, px: 10, py: -30 }, sl = withIds(K.geoStart('lot', gl), 'g');
  ok(K.checkTask({ kind: 'lot', given: gl }, sl.concat([seg(10, -30, 10, -10)])).issues.some(i => i.k === 'g_short'), 'Lot zu kurz erkannt');
  const gu = { ax: -40, ay: 30, bx: 50, by: 30, cx: -10, cy: -25 }, su = withIds(K.geoStart('umk', gu), 'g');
  const U = K.GEO_TASKS.umk.circle(gu);
  const cu = (dx, dr, sweep) => K.checkTask({ kind: 'umk', given: gu }, su.concat([{ id: 'k', type: 'arc', cx: U.c.x + dx, cy: U.c.y, r: U.r + dr, a0: 0, sweep, c: '#1e8a4c', w: 0.5, al: 1 }]));
  ok(cu(0, 0, K.TAU).ok && cu(0, 0, 3).issues[0].k === 'g_partial' && cu(5, 0, K.TAU).issues[0].why === 'umkCenter' && cu(0, 4, K.TAU).issues[0].k === 'g_radius', 'Umkreis: ganz, Teilbogen, Mittelpunkt, Radius');
  const gt = { ax: -30, ay: 20, bx: 30, by: 20, a: 30 }, st = withIds(K.geoStart('thal', gt), 'g');
  const Cw = { x: 0, y: -15 };
  const ct = K.checkTask({ kind: 'thal', given: gt }, st.concat([{ id: 'c', type: 'point', x: Cw.x, y: Cw.y, label: 'C' }, seg(-30, 20, 0, -15), seg(30, 20, 0, -15)]));
  ok(ct.issues.some(i => i.key === 'gamma' && i.why === 'thales'), 'Thales: C nicht auf dem Thaleskreis erkannt', ct.issues);
  ok(K.sanitizeTask({ kind: 'senk', given: { g1x: -60, g1y: 0, g2x: 60, g2y: 0, px: 0, py: 3 } }) === null, 'Senkrechte: P nicht auf g → ungültige Aufgabe');
}

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

/* ---------- Rückmeldung per QR ---------- */
{
  const task = { kind: 'sws', given: { c: 60, b: 45, alpha: 50 } };
  const objs = K.labConstruction('sws', task.given).objects.map((o, i) => Object.assign({ id: 'o' + i }, o));
  const res = K.checkTask(task, objs.slice(0, 3));
  const codes = K.resultCodes(res);
  ok(codes.length >= 1 && K.resultCodes(K.checkTask(task, objs)).length === 0, 'Rückmeldung: Befunde als Codes, richtige Lösung ohne', codes);
  {
    const A = { x: 0, y: 0 }, B = { x: 60, y: 0 }, C = { x: 45 * Math.cos(-130 * Math.PI / 180), y: 45 * Math.sin(-130 * Math.PI / 180) };
    const P = (p, l) => ({ id: l, type: 'point', x: p.x, y: p.y, label: l }), S = (a, b, id) => ({ id, type: 'segment', x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: 0.5, al: 1 });
    const cs = K.resultCodes(K.checkTask(task, [P(A, 'A'), P(B, 'B'), P(C, 'C'), S(A, B, 's1'), S(B, C, 's2'), S(A, C, 's3')]));
    ok(cs.includes('scale') && !cs.includes('angle'), 'Rückmeldung: Diagnose geht vor Befundart', cs);
  }
  const url = K.linkForResult({ task, name: 'Mia K.', ok: false, help: 2, codes, objects: objs }, true);
  const pr = K.parseLink(url);
  ok(pr.ok && pr.kind === 'result' && pr.res.name === 'Mia K.' && pr.res.help === 2 && !pr.res.ok && JSON.stringify(pr.res.codes) === JSON.stringify(codes) && pr.res.objects.length === objs.length, 'Rückmeldung: hin und zurück mit Zeichnung', pr.res);
  ok(K.taskKey(pr.res.task) === K.taskKey(task) && K.taskKey(task) !== K.taskKey({ kind: 'sws', given: { c: 60, b: 45, alpha: 51 } }), 'Rückmeldung: gleiche Aufgabe, gleicher Schlüssel');
  const noDraw = K.parseLink(K.linkForResult({ task, name: '', ok: true, help: 0, codes: [], objects: objs }, false));
  ok(noDraw.ok && noDraw.res.objects.length === 0 && noDraw.res.ok, 'Rückmeldung ohne Zeichnung (kleiner Code)');
  const b64 = o => K.b64uEncode(K.utf8Bytes(JSON.stringify(o)));
  const evil = K.parseLink('zirkelwerk://r?v=1&d=' + b64({ t: task, n: 'x'.repeat(200), ok: 'ja', h: 99, w: ['<img>', 'scale', 5], o: 'kaputt' }));
  ok(evil.ok && evil.res.name.length === 30 && evil.res.ok === false && evil.res.help === 4 && JSON.stringify(evil.res.codes) === '["scale"]' && evil.res.objects.length === 0, 'Rückmeldung: fremde Werte werden begrenzt und gefiltert', evil.res);
  ok(K.parseLink('zirkelwerk://r?v=1&d=' + b64({ t: { kind: 'evil' }, n: 'x' })).ok === false, 'Rückmeldung ohne gültige Aufgabe abgelehnt');
  const sum = K.summarizeResults([{ ok: true, help: 0, codes: [] }, { ok: false, help: 2, codes: ['scale', 'sides'] }, { ok: false, help: 3, codes: ['scale'] }]);
  ok(sum.n === 3 && sum.ok === 1 && sum.help[2] === 1 && sum.codes[0][0] === 'scale' && sum.codes[0][1] === 2, 'Auswertung: Anzahl, richtig, häufigster Befund', sum);
  const rows = K.encodeObjs(objs), back = K.decodeObjs(rows);
  ok(back.length === objs.length && back.every((o, i) => o.type === objs[i].type), 'Objekte kodieren und dekodieren');
}

/* ---------- Körper und Netze ---------- */
{
  /* Volumen aus den gefalteten Flächen (Divergenzsatz) = Formel */
  const volOf = F => {
    const all = [].concat(...F), C = all.reduce((s, p) => ({ x: s.x + p.x / all.length, y: s.y + p.y / all.length, z: s.z + p.z / all.length }), { x: 0, y: 0, z: 0 });
    let V = 0;
    for (const f of F) for (let i = 1; i + 1 < f.length; i++) {
      const a = f[0], b = f[i], c = f[i + 1];
      const ax = a.x - C.x, ay = a.y - C.y, az = a.z - C.z, bx = b.x - C.x, by = b.y - C.y, bz = b.z - C.z, cx = c.x - C.x, cy = c.y - C.y, cz = c.z - C.z;
      V += Math.abs(ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
    }
    return V;
  };
  /* Zwei konvexe Vielecke überlappen (mehr als an Kanten)? Trennende Achse */
  const overlap2 = (A, B) => {
    for (const P of [A, B]) for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], nx = -(b.y - a.y), ny = b.x - a.x, l = Math.hypot(nx, ny);
      if (l < 1e-12) continue;
      const pr = Q => Q.map(q => (q.x * nx + q.y * ny) / l);
      const pa = pr(A), pb = pr(B);
      if (Math.max(...pa) <= Math.min(...pb) + 1e-6 || Math.max(...pb) <= Math.min(...pa) + 1e-6) return false;
    }
    return true;
  };
  const netOverlaps = net => { const f = net.faces; for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) if (overlap2(f[i].pts, f[j].pts)) return [i, j]; return null; };
  const tabsWant = { cube: 7, cuboid: 7, prism3: 5, pyramid4: 4 };
  /* Angenäherte Körper: Facetten statt Rundung (Kegel 36, Kugel 12 Bänder) */
  const tolOf = { cylinder: 0.01, cone: 0.01, sphere: 0.1 };
  const sample2 = kind => {
    if (kind === 'prism3') return { a: 30, b: 45, c: 60, h: 25 };
    const ints = K.BODY_INT[kind] || {};
    return Object.fromEntries(Object.keys(K.BODY_DEFAULTS[kind]).map((k, i) => [k, ints[k] ? (kind === 'sphere' ? 10 : 5) : 23 + 9 * i]));
  };
  for (const kind of K.BODY_KINDS) {
    for (const g of [K.BODY_DEFAULTS[kind], sample2(kind)]) {
      ok(K.bodyValid(kind, g), 'Körper ' + kind + ': Testmaße gültig', g);
      const F = K.bodyFaces(kind, g), m = K.bodyMeasures(kind, g);
      const zmin = Math.min(...[].concat(...F).map(p => p.z));
      const tolV = tolOf[kind] || 1e-6;
      ok(Math.abs(volOf(F) - m.V) / m.V < tolV && Math.abs(zmin) < 1e-9, 'Körper ' + kind + ': gefaltet = Formel (V ' + Math.round(m.V) + ' mm³), steht auf z = 0', [volOf(F), m.V]);
      const net = K.bodyNet(kind, g);
      ok(net && K.foldNet(net, 0).every(f => f.every(p => Math.abs(p.z) < 1e-9)), 'Netz ' + kind + ': bei t = 0 flach');
      ok(!netOverlaps(net), 'Netz ' + kind + ': keine Fläche liegt auf einer anderen', netOverlaps(net));
      if (kind === 'cylinder' || kind === 'cone' || kind === 'sphere') continue;
      /* Polyeder: Laschen = Ecken − 1 (Euler), Faltkanten = Gelenke + Laschenkanten */
      const nd = K.netDrawing(kind, g);
      const verts = new Set([].concat(...F).map(p => [p.x, p.y, p.z].map(v => Math.round(v * 1000)).join(','))).size;
      const want = tabsWant[kind] != null ? tabsWant[kind] : verts - 1;
      const tabs = nd.tabs.length / 3, folds = nd.edges.filter(e => e.fold).length;
      ok(tabs === want && folds === (net.faces.length - 1) + want, 'Netz ' + kind + ': ' + tabs + ' Klebelaschen, Faltkanten gestrichelt', { tabs, folds, want });
    }
  }
  /* Neue Körper im Einzelnen */
  {
    const eq = K.bodyMeasures('prismn', { n: 3, a: 40, h: 30 }), p3 = K.bodyMeasures('prism3', { a: 40, b: 40, c: 40, h: 30 });
    ok(Math.abs(eq.V - p3.V) < 1e-6 && Math.abs(eq.O - p3.O) < 1e-6, 'Regelmäßiges Dreiecksprisma = Dreiecksprisma mit gleichen Seiten');
    const p4 = K.bodyMeasures('pyramidn', { n: 4, a: 40, h: 40 }), q4 = K.bodyMeasures('pyramid4', { a: 40, h: 40 }), r4 = K.bodyMeasures('pyramidrect', { a: 40, b: 40, h: 40 });
    ok(Math.abs(p4.V - q4.V) < 1e-6 && Math.abs(p4.O - q4.O) < 1e-6 && Math.abs(r4.O - q4.O) < 1e-6, 'Quadratische Pyramide dreifach gleich (n-Eck, Rechteck, bisherige)');
    ok(!K.bodyValid('prismn', { n: 9, a: 20, h: 20 }) && !K.bodyValid('prismn', { n: 4.5, a: 20, h: 20 }) && !K.bodyValid('sphere', { r: 30, n: 7 }) && K.bodyValid('sphere', { r: 30, n: 16 }), 'Eckenzahl 3–8, Kugelschalen 8–16, nur ganze Zahlen');
    const t = K.bodyFaces('tetra', { a: 50 });
    ok(t.length === 4 && t.every(f => f.every((p, i) => Math.abs(Math.hypot(p.x - f[(i + 1) % 3].x, p.y - f[(i + 1) % 3].y, p.z - f[(i + 1) % 3].z) - 50) < 1e-9)), 'Tetraeder: vier gleichseitige Dreiecke');
    const o = K.bodyFaces('octa', { a: 40 });
    ok(o.length === 8 && Math.abs(Math.max(...[].concat(...o).map(p => p.z)) - 40 * Math.sqrt(2 / 3)) < 1e-9, 'Oktaeder: acht Dreiecke, steht auf einer Fläche, Höhe a·√(2/3)', Math.max(...[].concat(...o).map(p => p.z)));
    const cn = K.netDrawing('cone', { r: 30, h: 40 });
    const s = 50, th = 2 * Math.PI * 30 / 50;
    ok(cn.arcs.length === 1 && Math.abs(cn.arcs[0].r - s) < 1e-9 && Math.abs(cn.arcs[0].sweep - th) < 1e-9 && cn.circles[0].r === 30, 'Kegelnetz: Kreisausschnitt mit s = 5 cm und Winkel 2πr/s, Grundkreis r', cn.arcs[0]);
    const cobj = K.bodySheetObjects('cone', { r: 30, h: 40 }, 'net');
    ok(cobj.filter(x => x.type === 'arc').length === 2 && cobj.every(x => x.type !== 'arc' || x.r > 0), 'Kegelnetz aufs Blatt: Bogen und Kreis als Kreisbögen');
    const sn = K.netDrawing('sphere', { r: 30, n: 12 });
    ok(sn.approx && sn.tabs.length === 0 && sn.edges.every(e => !e.fold) && sn.edges.length > 100, 'Kugel: nur Umrisse der Schalen, als angenähert markiert');
    const sb = K.boundsOf(K.bodySheetObjects('sphere', { r: 30, n: 12 }, 'net'));
    ok(Math.abs((sb.x1 - sb.x0) - 2 * Math.PI * 30) / (2 * Math.PI * 30) < 0.05 && Math.abs((sb.y1 - sb.y0) - Math.PI * 30) / (Math.PI * 30) < 0.05, 'Orangenschalen: Breite ≈ Umfang 2πr, Höhe ≈ halber Umfang πr', [sb.x1 - sb.x0, sb.y1 - sb.y0]);
    const obc = K.obliqueDrawing('cone', { r: 25, h: 50 }), obs = K.obliqueDrawing('sphere', { r: 30, n: 12 });
    ok(obc.length < 120 && obc.some(e => e.hidden) && obs.length < 200 && obs.length > 10, 'Schrägbild Kegel und Kugel: nur Umrisse, keine Facettenlinien', [obc.length, obs.length]);
  }
  /* Würfelnetze */
  {
    const H = K.hexominos(), nets = K.cubeNets();
    ok(H.length === 35 && nets.length === 11, 'Genau 35 Sechslinge, davon 11 Würfelnetze', [H.length, nets.length]);
    ok(nets[0].map(c => c.join()).join(';') === '1,0;0,1;1,1;2,1;1,2;1,3', 'Erstes Würfelnetz ist das Kreuz', nets[0]);
    ok(nets.every(c => K.cubeFoldCheck(c, 10).ok), 'Alle 11 Würfelnetze falten sich zum Würfel');
    ok(K.cubeNonNets().length === 24 && K.cubeNonNets().every(c => { const r = K.cubeFoldCheck(c, 10); return !r.ok && r.missing >= 1 && r.overlap.some(Boolean); }), 'Alle 24 anderen: Überlappung und offene Seite');
    nets.forEach((c, i) => { const F = K.foldNet(K.gridNet(c, 30, 0), 1); ok(Math.abs(volOf(F) - 27000) < 1e-6, 'Würfelnetz ' + (i + 1) + ': gefaltet Volumen a³'); });
    const bf = K.bodyFaces('cube', { a: 30 }, 5);
    ok(Math.abs(volOf(bf) - 27000) < 1e-6 && Math.abs(Math.min(...[].concat(...bf).map(p => p.z))) < 1e-9, 'Würfel mit anderem Netz: steht auf seiner Grundfläche');
    const nd5 = K.netDrawing('cube', { a: 30 }, 5);
    ok(nd5.tabs.length / 3 === 7, 'Jedes Würfelnetz bekommt 7 Klebelaschen');
  }
  /* Schrägbild eines Würfels: 12 Kanten, davon 3 verdeckt; Tiefe unter 45°, halbe Länge */
  const ob = K.obliqueDrawing('cube', { a: 40 });
  ok(ob.length === 12 && ob.filter(e => e.hidden).length === 3, 'Schrägbild Würfel: 3 verdeckte Kanten', ob.filter(e => e.hidden).length);
  const depth = ob.filter(e => Math.abs(Math.abs(e.b.x - e.a.x) - Math.abs(e.b.y - e.a.y)) < 1e-6 && Math.abs(e.b.x - e.a.x) > 1);
  ok(depth.length === 4 && depth.every(e => Math.abs(Math.hypot(e.b.x - e.a.x, e.b.y - e.a.y) - 20) < 1e-6), 'Schrägbild: Tiefenkanten 45°, halbe Länge');
  const cy = K.obliqueDrawing('cylinder', { r: 20, h: 50 });
  ok(cy.some(e => e.hidden) && cy.filter(e => !e.hidden && Math.abs(e.a.x - e.b.x) < 1e-6 && Math.abs(Math.abs(e.a.y - e.b.y) - 50) < 1e-6).length === 2, 'Schrägbild Zylinder: hintere Bodenkante verdeckt, zwei Umrisslinien');
  ok(!K.bodyValid('prism3', { a: 10, b: 10, c: 30, h: 20 }) && K.bodyValid('prism3', { a: 30, b: 40, c: 50, h: 20 }) && !K.bodyValid('cube', { a: 2 }), 'Körper: ungültige Maße abgelehnt');
  const cn = K.netDrawing('cylinder', { r: 20, h: 50 });
  ok(cn.circles.length === 2 && Math.abs(cn.edges[0].b.x - 2 * Math.PI * 20) < 1e-9, 'Netz Zylinder: Rechteck 2πr × h und zwei Kreise');
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

/* ---------- Körper aufs Blatt, gestrichelte Strecken ---------- */
{
  const net = K.bodySheetObjects('cube', { a: 40 }, 'net');
  const segs = net.filter(o => o.type === 'segment'), b = K.boundsOf(net);
  ok(near(b.x0, 0) && near(b.y0, 0), 'Netz aufs Blatt: beginnt oben links bei (0|0)', b);
  ok(segs.filter(o => o.d === 1).length === 12 && segs.filter(o => o.c === '#8a8f98' && !o.d).length === 7 * 3, 'Würfelnetz: 5 Falt- + 7 Laschenkanten gestrichelt, 7 Laschen grau', [segs.filter(o => o.d).length, segs.filter(o => o.c === '#8a8f98' && !o.d).length]);
  const cyl = K.bodySheetObjects('cylinder', { r: 20, h: 50 }, 'net');
  ok(cyl.filter(o => o.type === 'arc').length === 2 && cyl.every(o => o.type !== 'arc' || near(o.r, 20)), 'Zylindernetz: zwei Kreise mit r');
  const obl = K.bodySheetObjects('cuboid', { a: 50, b: 30, c: 20 }, 'obl');
  ok(obl.length === 12 && obl.filter(o => o.d).length === 3, 'Schrägbild Quader aufs Blatt: 12 Kanten, 3 gestrichelt');
  /* Strichelung übersteht Speichern, Link und PDF */
  const sd = K.sanitizeDoc({ format: 'zirkelwerk', v: 1, objects: obl.map((o, i) => Object.assign({ id: 'b' + i }, o)).concat([{ id: 'x', type: 'segment', x1: 0, y1: 0, x2: 1, y2: 1, d: 'ja' }]) }, 'z', 1);
  ok(sd.objects.filter(o => o.d === 1).length === 3 && sd.objects[sd.objects.length - 1].d === undefined, 'Gestrichelt bleibt beim Laden; ungültiger Wert fällt weg');
  const lk = K.parseLink(K.linkForSheet({ name: 'S', objects: sd.objects }));
  ok(lk.ok && K.sanitizeDoc(lk.raw, 'q', 1).objects.filter(o => o.d === 1).length === 3, 'Gestrichelt übersteht den QR-Link');
  const dsh = new K.PdfCanvas({ s: 1, ox: 0, oy: 0, px: 0, py: 0, H: 100 }, { gs: {} });
  ctx.drawObjects(dsh, [sd.objects.find(o => o.d === 1), sd.objects.find(o => !o.d)], 4, null);
  ok(/\[[\d. ]+\] 0 d /.test(dsh.out[0]) && !/ d /.test(dsh.out[1].replace(/ 0 d /, '')), 'PDF: gestrichelte Strecke mit Strichmuster, durchgezogene ohne', dsh.out);
}

/* ---------- Lückentext ---------- */
{
  const W = I18N.de.clozeWords.split(',');
  const c = K.clozeSteps(['Zeichne die Strecke AB mit der Länge 6 cm.', 'Die Mittelsenkrechte schneidet AB im Mittelpunkt M.', 'Zeichne einen Kreisbogen um A und einen Kreisbogen um B.', 'Streckenzug bleibt.'], W, 'de');
  ok(c.steps[0] === 'Zeichne die __________ AB mit der __________ 6 cm.', 'Lückentext: Fachwörter zu Lücken', c.steps[0]);
  ok(c.steps[1] === 'Die __________ schneidet AB im __________ M.', 'Lückentext: „Mittelsenkrechte" bleibt ein Wort (nicht …Senkrechte)', c.steps[1]);
  ok(c.steps[3] === 'Streckenzug bleibt.', 'Lückentext: nur ganze Wörter', c.steps[3]);
  ok(JSON.stringify(c.bank) === JSON.stringify(['Kreisbogen (2×)', 'Länge', 'Mittelpunkt', 'Mittelsenkrechte', 'Strecke']), 'Wortspeicher alphabetisch mit Anzahl', c.bank);
  const e = K.clozeSteps(['Draw the perpendicular bisector of AB.', 'Draw a circle with centre M.'], I18N.en.clozeWords.split(','), 'en');
  ok(e.steps[0] === 'Draw the __________ of AB.' && e.bank.includes('perpendicular bisector'), 'Lückentext Englisch: Mehrwort-Begriff', e);
  ok(K.clozeSteps(['Strecke (a+b)?'], ['Strecke', '(a+b)?'], 'de').steps[0] === '__________ __________', 'Lückentext: Sonderzeichen in Wörtern sicher');
  ok(K.clozeSteps(['x'], [], 'de').bank.length === 0, 'Lückentext ohne Wortliste');
  ok(K.clozeSteps(['Draw the perpendicular bisector.'], ['perpendicular', 'perpendicular bisector'], 'en').steps[0] === 'Draw the __________.', 'Lückentext: längster Begriff gewinnt, egal in welcher Reihenfolge die Liste steht');
  /* Rückmelde-Link mit kaputter Zeichnung: Objekte werden bereinigt */
  {
    const tk = { kind: 'sws', given: { c: 60, b: 45, alpha: 50 } };
    const evil = 'zirkelwerk://r?v=1&d=' + K.b64uEncode(K.utf8Bytes(JSON.stringify({ t: tk, n: 'X', ok: 1, h: 0, w: [], o: [[3], [0, 1, 2, 'A', 7, 'url(javascript:1)'], [1, 0, 0, 10, 10, '#123456']] })));
    const pr = K.parseLink(evil);
    ok(pr.ok && pr.kind === 'result' && pr.res.objects.length === 2 && pr.res.objects.every(o => /^#[0-9a-f]{6}$/.test(o.c)) && pr.res.objects.every(o => o.type !== 'stroke'), 'Rückmeldung: kaputte Objekte fallen weg, Farben geprüft', pr.res && pr.res.objects);
  }
}

/* ---------- Leistung und Grenzen (Befunde der Durchsicht) ---------- */
{
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const mk = n => Array.from({ length: n }, (_, i) => i % 3 ? { id: 'g' + i, type: 'segment', x1: rnd() * 300, y1: rnd() * 200, x2: rnd() * 300, y2: rnd() * 200 }
    : { id: 'g' + i, type: 'arc', cx: rnd() * 300, cy: rnd() * 200, r: 5 + rnd() * 50, a0: rnd() * 6, sweep: (rnd() - 0.3) * 6 });
  const objs = mk(400);
  const full = K.intersections(objs);
  const old = K.intersections(objs.slice(0, 395)), inc = K.intersectionsAdded(old, objs.slice(395), objs);
  const keyset = l => new Set(l.map(p => Math.round(p.x * 1000) + ',' + Math.round(p.y * 1000)));
  const A = keyset(full), B = keyset(inc);
  ok(full.length > 500 && A.size === B.size && [...A].every(k => B.has(k)), 'Schnittpunkte: schrittweise = vollständig neu gerechnet', [full.length, inc.length]);
  /* Vorauswahl findet dasselbe wie Jeder-mit-jedem */
  let brute = [];
  for (let i = 0; i < 120; i++) for (let j = i + 1; j < 120; j++) {
    const a = objs[i], b = objs[j];
    const pts = a.type === 'segment' && b.type === 'segment' ? [K.segSeg(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1, b.x2, b.y2)].filter(Boolean)
      : a.type === 'segment' ? K.segArc(a, b) : b.type === 'segment' ? K.segArc(b, a) : K.arcArc(a, b);
    brute.push(...pts);
  }
  ok(K.intersections(objs.slice(0, 120)).length === K.dedupePoints(brute, 1e-4).length, 'Schnittpunkte: Vorauswahl verliert nichts');
  ok(K.intersections(mk(1500)).length > 0, 'Schnittpunkte auch bei 1500 Linien (früher ab 800 gar keine)');
  /* Gespeicherte große Blätter laden, Importe bleiben streng */
  const huge = { format: 'zirkelwerk', v: 1, objects: Array.from({ length: 20010 }, (_, i) => ({ id: 'p' + i, type: 'point', x: i % 100, y: Math.floor(i / 100) })) };
  let threw = false; try { K.sanitizeDoc(huge, 'h', 1); } catch (e) { threw = e.message === 'toolarge'; }
  ok(threw && K.sanitizeDoc(huge, 'h', 1, { stored: true }).objects.length === 20000, 'Zu großes eigenes Blatt wird gekürzt geladen, Import abgelehnt');
  const longStroke = { format: 'zirkelwerk', v: 1, objects: [{ id: 's', type: 'stroke', pts: Array.from({ length: 40010 }, (_, i) => i % 7), c: '#000000', w: 0.5, al: 1 }] };
  ok(K.sanitizeDoc(longStroke, 's', 1).objects[0].pts.length === 40000, 'Überlanger Strich gekürzt statt verworfen');
  /* Beschreibung: zufällig senkrechte Linealstrecke ist keine Senkrechte */
  const A0 = { id: 'a', type: 'point', x: 0, y: 0, label: 'A' }, B0 = { id: 'b', type: 'point', x: 50, y: 0, label: 'B' }, C0 = { id: 'c', type: 'point', x: 200, y: -30, label: 'C' };
  const sAB = { id: 's1', type: 'segment', x1: 0, y1: 0, x2: 50, y2: 0, m: { via: 'ruler' } };
  const sCD = { id: 's2', type: 'segment', x1: 200, y1: -30, x2: 200, y2: 10, m: { via: 'ruler' } };
  const t1 = K.describe([A0, B0, sAB, C0, sCD], 'de', I18N.de).map(x => x.text);
  ok(!t1.some(x => /Senkrechte/.test(x)) && t1.some(x => /4 cm/.test(x)), 'Linealstrecke zufällig senkrecht: als Strecke mit Länge beschrieben', t1);
  const t2 = K.describe([A0, B0, sAB, C0, Object.assign({}, sCD, { m: { via: 'geo' } })], 'de', I18N.de).map(x => x.text);
  ok(t2.some(x => x === 'Zeichne die Senkrechte zu AB durch C.'), 'Am Geodreieck: Senkrechte erkannt', t2);
  /* Beschreibung großer Blätter in vertretbarer Zeit */
  const big = mk(4000).map((o, i) => Object.assign(o, { c: '#000000', w: 0.5, al: 1 }));
  for (let i = 0; i < 1000; i++) big.push({ id: 'q' + i, type: 'point', x: rnd() * 300, y: rnd() * 200, label: '' });
  const t0 = Date.now(); K.describe(big, 'de', I18N.de); const dt = Date.now() - t0;
  ok(dt < 3000, 'Beschreibung von 5000 Objekten unter 3 s (Node)', dt);
}


/* ---------- 0.10.1: Radieren in Stücken ---------- */
{
  const seg = { id: 's', type: 'segment', x1: 0, y1: 0, x2: 100, y2: 0, c: '#000000', w: 0.5, al: 1, m: { via: 'ruler' } };
  ok(K.cutObject(seg, 50, 20, 5) === null, 'Strecke: nicht berührt → null');
  const p = K.cutObject(seg, 50, 0, 5);
  ok(p.length === 2 && near(p[0].x1, 0) && near(p[0].x2, 50 - 5.25, 1e-9) && near(p[1].x1, 50 + 5.25, 1e-9) && near(p[1].x2, 100), 'Strecke: Mitte heraus, zwei Teile (Strichbreite zählt)', p);
  ok(p[0].m !== seg.m && p[0].m.via === 'ruler', 'Teile haben eigene Metadaten');
  ok(K.cutObject(seg, 0, 0, 5).length === 1 && near(K.cutObject(seg, 0, 0, 5)[0].x1, 5.25, 1e-9), 'Strecke: Ende gekürzt');
  ok(K.cutObject(seg, 50, 0, 60).length === 0, 'Strecke ganz überdeckt → weg');
  ok(K.cutObject(seg, 0.5, 0, 0.1).length === 1, 'Krümel am Ende fällt weg (kürzer als CUT_MIN)');

  const arc = { id: 'a', type: 'arc', cx: 0, cy: 0, r: 40, a0: 0, sweep: Math.PI, c: '#000000', w: 0.5, al: 1, m: { rs: { t: 'set' } } };
  ok(K.cutObject(arc, 0, -40, 3) === null, 'Bogen: Gegenseite nicht berührt');
  const ap = K.cutObject(arc, 0, 40, 4);
  const endAng = q => q.a0 + q.sweep;
  ok(ap.length === 2 && near(ap[0].a0, 0) && endAng(ap[0]) < Math.PI / 2 && ap[1].a0 > Math.PI / 2 && near(endAng(ap[1]), Math.PI, 1e-9), 'Bogen: Mitte heraus, zwei Teile in Zeichenrichtung', ap);
  const rev = Object.assign({}, arc, { a0: Math.PI, sweep: -Math.PI });
  const rp = K.cutObject(rev, 0, 40, 4);
  ok(rp.length === 2 && rp.every(q => q.sweep < 0) && near(rp[0].a0, Math.PI, 1e-9), 'Bogen gegen den Uhrzeigersinn: Drehsinn bleibt', rp);
  const circ = Object.assign({}, arc, { sweep: K.TAU });
  const cp = K.cutObject(circ, 40, 0, 4);
  ok(cp.length === 1 && Math.abs(cp[0].sweep) < K.TAU - 0.1 && Math.abs(cp[0].sweep) > K.TAU - 0.3, 'Vollkreis: ein Bogen bleibt, Lücke über 0°', cp);
  const cq = K.cutObject(circ, 0, 40, 4);
  ok(cq.length === 1 && K.distToArc(40, 0, cq[0]) < 1e-9 && K.distToArc(0, 40, cq[0]) > 3, 'Vollkreis: Lücke bei 90°, Rest zusammenhängend', cq);
  ok(K.cutObject(arc, 0, 0, 50).length === 0, 'Bogen ganz im Radierer → weg');

  const st = { id: 't', type: 'stroke', pts: [0, 0, 10, 0, 20, 0, 30, 0, 40, 0], c: '#000000', w: 0.5, al: 1 };
  const sp = K.cutObject(st, 20, 0, 3);
  ok(sp.length === 2 && sp[0].pts[0] === 0 && near(sp[0].pts[sp[0].pts.length - 2], 16.75, 1e-9) && near(sp[1].pts[0], 23.25, 1e-9) && sp[1].pts[sp[1].pts.length - 2] === 40, 'Freihand: Mitte heraus', sp.map(q => q.pts));
  ok(K.cutObject(st, 20, 10, 3) === null, 'Freihand: nicht berührt');
  ok(K.cutObject({ id: 'p', type: 'point', x: 1, y: 1 }, 0, 0, 2).length === 0, 'Punkt im Radierer: ganz weg');

  /* Antippen: Punkt vor Linie */
  const P1 = { id: 'p1', type: 'point', x: 50, y: 0.5, label: 'P' };
  ok(K.eraseTarget([seg, P1], 50, 0, 3) === P1, 'Antippen trifft den Punkt, nicht die Strecke darunter');
  ok(K.eraseTarget([seg, P1], 80, 0, 3) === seg, 'Antippen abseits des Punkts trifft die Strecke');
  ok(K.eraseTarget([seg, P1], 80, 30, 3) === null, 'Antippen ins Leere trifft nichts');

  /* Rückgängig: Teilstück einfügen und Gruppe */
  const L = [{ id: 'x' }, seg, { id: 'y' }];
  const [q0, q1] = p.map((q, i) => Object.assign(q, { id: i ? 'n1' : 's' }));
  const g = { t: 'grp', list: [{ t: 'mod', before: [seg], after: [q0] }, { t: 'ins', items: [{ obj: q1, index: 2 }] }] };
  K.applyEntry(L, g);
  ok(L.map(o => o.id).join() === 'x,s,n1,y' && L[1] === q0, 'Gruppe: Teil 1 ersetzt, Teil 2 direkt dahinter', L.map(o => o.id));
  K.revertEntry(L, g);
  ok(L.map(o => o.id).join() === 'x,s,y' && L[1] === seg, 'Gruppe rückgängig: Original an alter Stelle');
  /* Reihenfolge beim Zurückspielen: zwei Löschungen mit Index zum Zeitpunkt */
  const L2 = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const g2 = { t: 'grp', list: [{ t: 'del', items: [{ obj: L2[0], index: 0 }] }, { t: 'del', items: [{ obj: L2[2], index: 1 }] }] };
  K.applyEntry(L2, g2);
  ok(L2.map(o => o.id).join() === 'b', 'Gruppe: zwei Löschungen');
  K.revertEntry(L2, g2);
  ok(L2.map(o => o.id).join() === 'a,b,c', 'Gruppe rückgängig in umgekehrter Reihenfolge', L2.map(o => o.id));
  const hh = new K.History(5); hh.push({ t: 'grp', list: [] });
  ok(!hh.canUndo(), 'Leere Gruppe wird nicht gemerkt');

  /* Beschreibung: Teilstücke bleiben ein Schritt */
  const A = { id: 'A', type: 'point', x: 0, y: 0, label: 'A', ld: 7 }, B = { id: 'B', type: 'point', x: 100, y: 0, label: 'B', ld: 7 };
  const M = { id: 'M', type: 'point', x: 0, y: 0, label: 'M', ld: 7 };
  const full = [A, B, Object.assign({}, seg, { id: 's' })];
  const cut = [A, B, q0, q1];
  const D1 = K.describe(full, 'de', I18N.de).map(x => x.text), D2 = K.describe(cut, 'de', I18N.de);
  ok(D2.length === D1.length && D2[D2.length - 1].text === D1[D1.length - 1] && D2[D2.length - 1].ids.includes('n1'), 'Radierte Strecke: gleiche Beschreibung, beide Teile im Schritt', [D1, D2.map(x => [x.text, x.ids])]);
  const arcs = K.cutObject(Object.assign({}, arc, { id: 'a' }), 0, 40, 4).map((q, i) => Object.assign(q, { id: 'a' + i }));
  const D3 = K.describe([M].concat(arcs), 'de', I18N.de);
  ok(D3.length === 2 && D3[1].ids.length === 2 && D3[1].text === 'Zeichne einen Kreisbogen um M mit dem Radius r = 4 cm.', 'Radierter Bogen: ein Satz', D3.map(x => x.text));
  const C = { id: 'C', type: 'point', x: 200, y: 0, label: 'C', ld: 7 };
  const sBC = Object.assign({}, seg, { id: 'bc', x1: 100, x2: 200 });
  const D4 = K.describe([A, B, C, Object.assign({}, seg, { id: 'ab' }), sBC], 'de', I18N.de);
  ok(D4[3].text === 'Verbinde A mit B und B mit C.', 'AB und BC (benannter Stoß) werden nicht verschmolzen', D4.map(x => x.text));
  /* Strecke zuerst, Punkte danach, Mitte radiert: bleibt „Zeichne die Strecke AB" */
  {
    const sF = Object.assign({}, seg, { id: 'sf' }), pf = K.cutObject(sF, 50, 0, 5).map((q, i) => Object.assign(q, { id: 'sf' + i }));
    const Aa = Object.assign({}, A, { id: 'A2' }), Bb = Object.assign({}, B, { id: 'B2' });
    const T1 = K.describe([sF, Aa, Bb], 'de', I18N.de).map(x => x.text), T2 = K.describe(pf.concat([Aa, Bb]), 'de', I18N.de).map(x => x.text);
    ok(JSON.stringify(T1) === JSON.stringify(T2) && /Strecke AB/.test(T2[0]), 'Strecke vor ihren Punkten, Mitte radiert: Text unverändert', [T1, T2]);
  }
  /* Stoß an einem später benannten Punkt: zwei Strecken, keine Teilstücke */
  const sA1 = Object.assign({}, seg, { id: 'h1', x2: 50 }), sA2 = Object.assign({}, seg, { id: 'h2', x1: 50 });
  const Mp = { id: 'Mp', type: 'point', x: 50, y: 0, label: 'M', ld: 7 };
  const D7 = K.describe([A, sA1, sA2, Mp], 'de', I18N.de);
  ok(!D7.some(x => x.ids.includes('h1') && x.ids.includes('h2')), 'Strecken mit benanntem Stoßpunkt bleiben getrennt', D7.map(x => [x.text, x.ids]));
  /* Strecke von A aus, Mitte radiert: weiterhin „Strecke von A aus" mit voller Länge */
  const sA = Object.assign({}, seg, { id: 'sa' }), pa = K.cutObject(sA, 50, 0, 5).map((q, i) => Object.assign(q, { id: 'sa' + i }));
  const D5 = K.describe([A, sA], 'de', I18N.de).map(x => x.text), D6 = K.describe([A].concat(pa), 'de', I18N.de).map(x => x.text);
  ok(JSON.stringify(D5) === JSON.stringify(D6), 'Strecke von A aus, Mitte radiert: Text unverändert', [D5, D6]);
}

/* ---------- 0.10.1: Beschriftung ziehen, Punkte verschieben ---------- */
{
  ok(K.labelDirFor(1, 0) === 0 && K.labelDirFor(1, 1) === 1 && K.labelDirFor(0, 1) === 2 && K.labelDirFor(-1, 0) === 4 && K.labelDirFor(1, -1) === 7 && K.labelDirFor(0, -1) === 6, 'Richtung → Lage der Beschriftung');
  ok(K.labelDirFor(1, -0.3) === 0 && K.labelDirFor(1, -0.5) === 7, 'Zwischenrichtungen runden zur nächsten Lage');
  ok(K.labelDirFor(0, 0) === null, 'Ohne Richtung keine Lage');

  const P = { id: 'P', type: 'point', x: 10, y: 10, label: 'P' };
  const Q = { id: 'Q', type: 'point', x: 60, y: 10, label: 'Q' };
  const sPQ = { id: 'pq', type: 'segment', x1: 10, y1: 10, x2: 60, y2: 10, w: 0.5 };
  ok(K.pointMovable([P, Q, sPQ], P), 'Endpunkt einer Strecke ist verschiebbar');
  const mid = { id: 'S', type: 'point', x: 35, y: 10, label: 'S' };
  ok(!K.pointMovable([P, Q, sPQ, mid], mid), 'Punkt auf einer Strecke (konstruiert) liegt fest');
  const arcP = { id: 'k', type: 'arc', cx: 10, cy: 10, r: 20, a0: 0, sweep: 1 };
  ok(!K.pointMovable([P, arcP], P), 'Zirkeleinstich liegt fest');
  ok(!K.pointMovable([{ id: 'k2', type: 'arc', cx: 0, cy: 10, r: 10, a0: -1, sweep: 2 }, P], P), 'Punkt auf einem Bogen liegt fest');
  ok(!K.pointMovable([Object.assign({}, P, { m: { giv: 1 } })], Object.assign({}, P, { m: { giv: 1 } })), 'Ausgangsfigur liegt fest');
  ok(!K.pointMovable([P, Object.assign({}, sPQ, { m: { angle: { deg: 50, sym: 'α' } } })], P), 'Scheitel eines angetragenen Winkels liegt fest');
  const e = K.pointMoveEntry([P, Q, sPQ], P, 12, 15);
  ok(e.t === 'mod' && e.before.length === 2 && e.after[0].x === 12 && e.after[1].x1 === 12 && e.after[1].y1 === 15 && e.after[1].x2 === 60, 'Verschieben: Strecke zieht mit, anderes Ende bleibt', e.after);
}


/* ---------- 0.10.2: Ordner und Sicherung ---------- */
{
  ok(K.cleanFolder('  Klasse   7a \n') === 'Klasse 7a' && K.cleanFolder(42) === '' && K.cleanFolder('x'.repeat(99)).length === 40, 'Ordnername bereinigt');
  const docs = [{ folder: 'Klasse 7b' }, { folder: 'klasse 7a' }, { folder: 'Klasse 7a' }, { folder: '' }, { folder: 'Klasse 10' }];
  const fl = K.folderList(docs);
  ok(fl.length === 3 && fl[0] === 'Klasse 7a' && fl[2] === 'Klasse 10', 'Ordnerliste: einmalig, natürliche Reihenfolge', fl);
  ok(K.sameFolder('KLASSE 7A', 'klasse 7a') && !K.sameFolder('7a', '7b') && K.sameFolder('', undefined), 'Ordnervergleich ohne Groß/klein');
  const d0 = K.newDoc('abc', 'Blatt', 1000);
  ok(d0.folder === '', 'Neues Blatt ohne Ordner');
  const dz = K.sanitizeDoc(Object.assign({}, d0, { folder: '  Reihe Dreiecke ' }), 'abc', 5);
  ok(dz.folder === 'Reihe Dreiecke', 'Ordner übersteht das Laden');
  ok(K.sanitizeDoc(Object.assign({}, d0, { folder: { x: 1 } }), 'abc', 5).folder === '', 'Kaputter Ordner wird leer');

  const A = Object.assign(K.newDoc('aaa', 'Erstes', 100), { modified: 200, thumb: 'data:image/png;base64,xx', folder: 'Klasse 7a',
    objects: [{ id: 'o1', type: 'point', x: 1, y: 2, label: 'A', ld: 7, c: '#3b3f45' }], seq: 2 });
  const B = Object.assign(K.newDoc('bbb', 'Zweites', 100), { modified: 300 });
  const res = [{ key: 'sss|50|40|30', task: { kind: 'sss', given: { c: 50, b: 40, a: 30 } }, name: 'Lena', ok: true, help: 1, codes: [], o: [], at: 5 }];
  const bk = JSON.parse(JSON.stringify(K.makeBackup([A, B], res, { app: '0.10.2', created: 999 })));
  ok(K.isBackup(bk) && bk.docs.length === 2 && !('thumb' in bk.docs[0]) && bk.results.length === 1, 'Sicherung: alle Blätter ohne Vorschaubild, Abgaben dabei');
  ok(!K.isBackup(A) && !K.isBackup(null), 'Einzelblatt ist keine Sicherung');
  const rb = K.readBackup(bk);
  ok(rb.docs.length === 2 && rb.docs[0].id === 'aaa' && rb.docs[0].keepId && rb.docs[0].modified === 200 && rb.docs[0].folder === 'Klasse 7a' && rb.docs[0].objects.length === 1, 'Einlesen: Kennung, Stand, Ordner, Inhalt bleiben', rb.docs[0]);
  ok(rb.results.length === 1 && rb.results[0].name === 'Lena', 'Einlesen: Abgaben');
  const evil = JSON.parse(JSON.stringify(bk));
  evil.docs.push({ format: 'zirkelwerk', v: 1, objects: 'kaputt' }, null, Object.assign({}, bk.docs[1], { id: '../../x' }), Object.assign({}, bk.docs[1]));
  evil.results.push({ key: 5 }, { key: 'k', task: { kind: 'nix' } });
  const re = K.readBackup(evil);
  ok(re.bad === 2 && re.docs.length === 4 && !re.docs[2].keepId && !re.docs[3].keepId && re.results.length === 1, 'Kaputte Blätter gezählt, fremde/doppelte Kennungen neu vergeben, falsche Abgaben verworfen', [re.bad, re.docs.map(d => d.keepId)]);
  let threw = ''; try { K.readBackup(Object.assign({}, bk, { v: 99 })); } catch (e) { threw = e.message; }
  ok(threw === 'version', 'Sicherung aus neuerer Version wird erkannt');
  const plan = K.planRestore(new Map([['aaa', 200], ['bbb', 299]]), rb.docs);
  ok(plan.same === 1 && plan.copy.length === 1 && plan.copy[0].id === 'bbb' && plan.add.length === 0, 'Wiederherstellen: gleicher Stand übersprungen, geänderter als Kopie', plan);
  const plan2 = K.planRestore(new Map(), rb.docs);
  ok(plan2.add.length === 2 && plan2.same === 0, 'Leeres Gerät: alles dazu');
  const m = K.mergeResults(rb.results, rb.results.concat([Object.assign({}, rb.results[0], { at: 6 })]), 600);
  ok(m.added === 1 && m.list.length === 2, 'Abgaben: Doppelte erkannt, neue ergänzt');
  ok(K.mergeResults([], Array.from({ length: 10 }, (_, i) => Object.assign({}, rb.results[0], { at: i })), 4).list.length === 4, 'Abgaben: Obergrenze, älteste fallen weg');
}


/* ---------- 0.10.2: Bilder ---------- */
{
  const RGB = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDjbL/j6T8f5Vq0UU+Mf99h/gX5yPquBf8AkXz/AMb/APSYn//Z';
  const GRAY = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAHAAUBAREA/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/ACv/2Q==';
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAADElEQVR4nGNgIB0AAAA0AAF2Xq7DAAAAAElFTkSuQmCC';
  ok(K.jpegFromDataUrl(RGB).w === 12 && K.jpegFromDataUrl(RGB).h === 8 && K.jpegFromDataUrl(RGB).nc === 3, 'JPEG-Kopf: Breite, Höhe, drei Kanäle');
  ok(K.jpegFromDataUrl(GRAY).nc === 1 && K.jpegFromDataUrl(GRAY).w === 5, 'Graustufen-JPEG erkannt');
  ok(K.jpegFromDataUrl(PNG) === null && K.jpegFromDataUrl('data:image/jpeg;base64,AAAA') === null && K.jpegFromDataUrl('javascript:alert(1)') === null && K.jpegFromDataUrl(RGB + '<') === null, 'Kein JPEG / Fremdes → abgelehnt');
  ok(K.jpegFromDataUrl('data:image/jpeg;base64,' + 'A'.repeat(K.IMG.maxChars)) === null, 'Zu großes Bild abgelehnt');
  const bb = K.b64Bytes('SGFsbG8='); ok(bb.length === 5 && String.fromCharCode(...bb) === 'Hallo', 'Base64 mit Auffüllung');
  const base = { type: 'image', x: 10, y: 20, w: 60, h: 40, src: RGB, pw: 9999, ph: 1, cr: [0.1, 0, 0.9, 1], al: 0.5 };
  const im = K.sanitizeObject(base, 'i1');
  ok(im && im.pw === 12 && im.ph === 8 && im.al === 0.5 && im.cr[0] === 0.1, 'Bild: Maße aus dem JPEG, nicht aus der Datei', im);
  ok(K.sanitizeObject(Object.assign({}, base, { cr: [0.5, 0, 0.51, 1] }), 'i').cr.join() === '0,0,1,1', 'Zu schmaler Ausschnitt → ganzes Bild');
  ok(K.sanitizeObject(Object.assign({}, base, { cr: [0, 0, 2, 1] }), 'i').cr.join() === '0,0,1,1', 'Ausschnitt außerhalb → ganzes Bild');
  ok(!K.sanitizeObject(Object.assign({}, base, { w: 0 }), 'i') && !K.sanitizeObject(Object.assign({}, base, { src: PNG }), 'i') && !K.sanitizeObject(Object.assign({}, base, { x: 'a' }), 'i'), 'Ungültige Bilder verworfen');
  const r = K.imgRect(im);
  ok(near(r.x0, 16) && near(r.x1, 64) && near(r.y0, 20) && near(r.y1, 60), 'Sichtbares Rechteck aus dem Ausschnitt', r);
  ok(near(K.boundsOf([im]).x0, 16) && near(K.boundsOf([im]).x1, 64), 'Umriss folgt dem Ausschnitt');
  ok(near(K.objectDistance(im, 10, 30), 6) && K.objectDistance(im, 30, 30) === 0, 'Abstand zum sichtbaren Teil');
  ok(K.cutObject(im, 30, 30, 5) === null, 'Wischen radiert kein Bild');
  const P = { id: 'p', type: 'point', x: 30, y: 30, label: 'P' };
  const seg = { id: 's', type: 'segment', x1: 0, y1: 31, x2: 100, y2: 31, w: 0.5 };
  ok(K.eraseTarget([Object.assign({}, im, { id: 'i' }), seg], 30, 30, 3).id === 's' && K.eraseTarget([Object.assign({}, im, { id: 'i' })], 30, 30, 3).id === 'i', 'Antippen: Linien vor Bild, Bild nur allein', [K.eraseTarget([Object.assign({}, im, { id: 'i' }), seg], 30, 30, 3), K.eraseTarget([Object.assign({}, im, { id: 'i' })], 30, 30, 3)].map(x => x && x.id));
  const many = { format: 'zirkelwerk', v: 1, objects: Array.from({ length: K.IMG.maxPerDoc + 5 }, () => base) };
  ok(K.sanitizeDoc(many, 'x', 1).objects.length === K.IMG.maxPerDoc, 'Höchstens 30 Bilder je Blatt');
  const D = K.describe([Object.assign({}, im, { id: 'i' }), P], 'de', I18N.de);
  ok(D.length === 1 && !D.some(st => st.ids.includes('i')), 'Bilder sind kein Beschreibungsschritt', D);
  ok(K.encodeObjs([Object.assign({}, im, { id: 'i' }), P]).length === 1, 'QR-Link lässt Bilder weg');
  /* PDF mit Bild: Struktur, Längen, Ausschnitt */
  const ctxDraw = (c, objs) => { for (const o of objs) if (o.type === 'image') { c.globalAlpha = o.al; c.imageObj(o); c.globalAlpha = 1; } };
  const out = K.pdfCompose({ objects: [Object.assign({}, im, { id: 'i' }), Object.assign({}, im, { id: 'j', y: 80 })], draw: ctxDraw, grid: false, head: null, title: 'Bild', date: '20261024' });
  const pdf = out.pdf;
  const xobj = pdf.match(/\/Subtype \/Image \/Width 12 \/Height 8 \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \[\/ASCIIHexDecode \/DCTDecode\] \/Length (\d+) >>\nstream\n([0-9A-F\n]+>)\nendstream/);
  ok(xobj && +xobj[1] === xobj[2].length, 'PDF: Bildobjekt mit richtiger Länge', xobj && [xobj[1], xobj[2].length]);
  ok((pdf.match(/\/Subtype \/Image/g) || []).length === 1, 'PDF: gleiches Bild nur einmal eingebettet');
  ok((pdf.match(/\/Im1 Do/g) || []).length === 2 && / re W n [\d. ]+ 0 0 [\d. ]+ cm \/Im1 Do/.test(pdf) && /\/XObject << \/Im1 \d+ 0 R >>/.test(pdf), 'PDF: zweimal gezeichnet, mit Ausschnitt und Ressource');
  ok(/\/ca 0\.5/.test(pdf), 'PDF: Blasses Bild mit Deckkraft 50 %');
  ok([...pdf].every(ch => ch.charCodeAt(0) < 128), 'PDF mit Bild bleibt reines ASCII');
  const hexBytes = xobj[2].replace(/[\n>]/g, '').match(/../g).map(h => parseInt(h, 16));
  ok(hexBytes[0] === 0xFF && hexBytes[1] === 0xD8 && hexBytes.length === K.b64Bytes(RGB.slice(23)).length, 'PDF: JPEG unverändert enthalten');
  /* xref stimmt */
  const xr = +pdf.match(/startxref\n(\d+)/)[1];
  ok(pdf.slice(xr, xr + 4) === 'xref', 'PDF mit Bild: xref-Position stimmt');
  /* Gegenprobe mit echten Werkzeugen: Datei gültig, Bild wieder auslesbar */
  const cp = require('child_process'), os = require('os'), path = require('path');
  const has = cmd => cp.spawnSync('sh', ['-c', 'command -v ' + cmd]).status === 0;
  if (has('qpdf') && has('pdfimages')) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zw-img-')), f = path.join(dir, 'bild.pdf');
    fs.writeFileSync(f, Buffer.from(K.pdfBytes(pdf)));
    const q = cp.spawnSync('qpdf', ['--check', f], { encoding: 'utf8' });
    ok(q.status === 0 && /No syntax or stream encoding errors/.test(q.stdout) && !/WARNING/.test(q.stdout + q.stderr), 'PDF mit Bild: qpdf --check ohne Befund', q.stdout + q.stderr);
    const li = cp.spawnSync('pdfimages', ['-list', f], { encoding: 'utf8' }).stdout;
    ok(/\b12\s+8\s+rgb\s+3\s+8\s+jpeg\b/.test(li), 'PDF mit Bild: pdfimages liest 12 × 8 JPEG', li);
    fs.rmSync(dir, { recursive: true, force: true });
  } else console.log('  (qpdf/pdfimages nicht installiert – Bild-PDF-Gegenprobe übersprungen)');
}

/* ---------- Ausgabe ---------- */
console.log(`Zirkelwerk-Kerntest: ${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed) { console.log('\nFehlgeschlagen:\n  - ' + fails.join('\n  - ')); process.exit(1); }
