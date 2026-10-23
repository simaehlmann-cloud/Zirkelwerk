/* Zirkelwerk – Ablauftest im echten Browser (Chromium, als iPad).
 *
 *   node smoketest.js
 *
 * Spielt Bedienabläufe so durch, wie sie auf dem iPad passieren: Stift,
 * Finger und Maus als Pointer-Events. Kern ist eine vollständige
 * SSS-Konstruktion (c = 5 cm, b = 4 cm, a = 3 cm) mit Lineal, Zirkel und
 * Punktwerkzeug – am Ende muss C exakt im Schnittpunkt liegen.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { startServer, launch } = require('./testlib');

let passed = 0, failed = 0;
const fails = [];
function ok(cond, name, extra) {
  if (cond) { passed++; }
  else { failed++; fails.push(name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= (tol || 1e-6); }

/* Pointer-Events direkt auf die Zeichenfläche. Koordinaten in Weltmaß (mm),
   die Umrechnung macht die Seite selbst – so hängt der Test nicht an
   Bildschirmgröße und Zoom. */
async function installHelpers(page) {
  await page.evaluate(() => {
    const cv = document.getElementById('cvBase');
    window.__ptr = (type, id, phase, wx, wy) => {
      const z = window.__zw, s = z.w2s(wx, wy);
      const r = cv.getBoundingClientRect();
      const ev = new PointerEvent('pointer' + phase, {
        pointerId: id, pointerType: type, isPrimary: true, bubbles: true, cancelable: true,
        clientX: r.left + s.x, clientY: r.top + s.y, button: 0, buttons: phase === 'up' ? 0 : 1, pressure: 0.5
      });
      cv.dispatchEvent(ev);
    };
    window.__stroke = (type, pts, id) => {
      id = id || 7;
      window.__ptr(type, id, 'down', pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) window.__ptr(type, id, 'move', pts[i][0], pts[i][1]);
      const l = pts[pts.length - 1];
      window.__ptr(type, id, 'up', l[0], l[1]);
    };
  });
}
const stroke = (page, type, pts, id) => page.evaluate(([t, p, i]) => window.__stroke(t, p, i), [type, pts, id]);
const objs = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__zw.doc.objects)));
const inst = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__zw.doc.inst)));
function line(a, b, n) { const out = []; for (let i = 0; i <= n; i++) out.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); return out; }

async function main() {
  const { srv, url } = await startServer(__dirname);
  const { browser, context } = await launch({ locale: 'de-DE' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/404|cordova\.js/.test(m.text())) errors.push(m.text()); });

  try {
    await page.goto(url);
    await page.waitForFunction(() => window.__zw && window.__zw.ready);
    await installHelpers(page);

    /* ---------- Start ---------- */
    ok(await page.isVisible('#helpPanel'), 'Kurzanleitung beim ersten Start sichtbar');
    await page.click('#helpPanel header .tb');
    ok(!(await page.isVisible('#helpPanel')), 'Kurzanleitung schließt');
    ok(await page.textContent('#sheetTitle') === 'Blatt 1', 'Erstes Blatt heißt „Blatt 1"');
    ok(await page.textContent('[data-tool="pencil"] .lb') === 'Bleistift', 'Deutsch ist eingestellt');
    ok(await page.evaluate(() => Math.abs(window.__zw.sc() - 132 / 25.4) < 1e-9), 'iPad erkannt: 132 Punkte je Zoll bei 100 %');
    ok(!(await page.isVisible('#chipCompass')), 'Ausgeblendete Chips sind unsichtbar');

    /* ---------- Freihand mit Stift ---------- */
    await stroke(page, 'pen', line([-60, -40], [-20, -30], 20));
    let o = await objs(page);
    ok(o.length === 1 && o[0].type === 'stroke', 'Stiftstrich angelegt', o.map(x => x.type));
    ok(await page.evaluate(() => window.__zw.S.penSeen), 'Stift erkannt (Handballen-Schutz an)');
    await page.click('#btnUndo');
    ok((await objs(page)).length === 0, 'Rückgängig entfernt den Strich');
    await page.click('#btnRedo');
    ok((await objs(page)).length === 1, 'Wiederholen stellt ihn wieder her');
    await page.click('#btnUndo');

    /* ---------- Handballen: Finger während des Stiftstrichs ---------- */
    await page.evaluate(() => {
      window.__ptr('pen', 11, 'down', -50, 10); window.__ptr('pen', 11, 'move', -45, 12);
      window.__ptr('touch', 12, 'down', 30, 30); window.__ptr('touch', 12, 'move', 40, 40); window.__ptr('touch', 12, 'up', 40, 40);
      window.__ptr('pen', 11, 'move', -40, 14); window.__ptr('pen', 11, 'up', -40, 14);
    });
    o = await objs(page);
    ok(o.length === 1 && o[0].type === 'stroke', 'Finger während des Stiftstrichs wird ignoriert', o.length);
    await page.click('#btnUndo');

    /* ---------- Finger zeichnet nicht, sobald der Stift erkannt ist ---------- */
    const v0 = await page.evaluate(() => ({ ...window.__zw.view }));
    await stroke(page, 'touch', line([0, 0], [20, 10], 10), 21);
    const v1 = await page.evaluate(() => ({ ...window.__zw.view }));
    ok((await objs(page)).length === 0 && (v0.ox !== v1.ox || v0.oy !== v1.oy), 'Ein Finger verschiebt das Blatt statt zu zeichnen');

    /* ---------- Zwei Finger zoomen ---------- */
    const z0 = await page.evaluate(() => window.__zw.view.zoom);
    await page.evaluate(() => {
      window.__ptr('touch', 31, 'down', -10, 0); window.__ptr('touch', 32, 'down', 10, 0);
      window.__ptr('touch', 31, 'move', -15, 0); window.__ptr('touch', 32, 'move', 15, 0);
      window.__ptr('touch', 31, 'up', -15, 0); window.__ptr('touch', 32, 'up', 15, 0);
    });
    const z1 = await page.evaluate(() => window.__zw.view.zoom);
    ok(z1 > z0 * 1.2, 'Spreizen vergrößert', [z0, z1]);
    await page.click('#zoomLabel');
    ok(await page.evaluate(() => window.__zw.view.zoom) === 1, '„100 %" stellt echte Größe her');
    await page.evaluate(() => { const z = window.__zw; const c = z.s2w(0, 0); });

    /* ---------- Lineal: c = 5 cm ---------- */
    await page.click('[data-inst="ruler"]');
    let I = await inst(page);
    ok(I.ruler.on, 'Lineal eingeblendet');
    // Oberkante: lokal y = −20. Etwas oberhalb ansetzen (außerhalb), zeichnen bis knapp über 5 cm.
    const edge = await page.evaluate(() => { const e = rulerEdges(window.__zw.doc.inst.ruler).find(x => x.id === 'top'); return e; });
    const P = (t, off) => [edge.ax + (edge.bx - edge.ax) * t + edge.nx * off, edge.ay + (edge.by - edge.ay) * t + edge.ny * off];
    const L = Math.hypot(edge.bx - edge.ax, edge.by - edge.ay);
    const tA = 0.3, tB = 0.3 + 50.3 / L;
    await stroke(page, 'pen', [P(tA, 1.2), P((tA + tB) / 2, 1.5), P(tB, 0.8)]);
    o = await objs(page);
    const seg = o.find(x => x.type === 'segment');
    ok(!!seg, 'Strich am Lineal wird zur Strecke');
    const segLen = seg ? Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1) : 0;
    ok(near(segLen, 50, 1e-9), 'Länge rastet auf ganze Millimeter: genau 5,0 cm', segLen);
    ok(seg && near((seg.x1 - edge.ax) * edge.nx + (seg.y1 - edge.ay) * edge.ny, 0, 1e-9), 'Strecke liegt genau auf der Kante');
    await page.click('[data-inst="ruler"]');

    /* ---------- Punkte A und B ---------- */
    await page.click('[data-tool="point"]');
    await stroke(page, 'pen', [[seg.x1 + 1.2, seg.y1 - 0.8]]);
    await stroke(page, 'pen', [[seg.x2 - 1, seg.y2 + 1]]);
    o = await objs(page);
    const A = o.find(x => x.type === 'point' && x.label === 'A');
    const B = o.find(x => x.type === 'point' && x.label === 'B');
    ok(A && near(A.x, seg.x1) && near(A.y, seg.y1), 'A rastet am Endpunkt ein', A);
    ok(B && near(B.x, seg.x2) && near(B.y, seg.y2), 'B rastet am Endpunkt ein', B);
    // Erneutes Antippen öffnet den Dialog statt einen zweiten Punkt zu setzen
    await stroke(page, 'pen', [[A.x, A.y]]);
    ok(await page.isVisible('#dialog'), 'Antippen von A öffnet den Punkt-Dialog');
    await page.fill('#dialogInput', 'A');
    await page.keyboard.press('Escape');
    ok((await objs(page)).filter(x => x.type === 'point').length === 2, 'Kein doppelter Punkt');

    /* ---------- Zirkel: Bogen um A mit r = 4 cm ---------- */
    await page.click('[data-tool="pencil"]');
    await page.click('[data-inst="compass"]');
    await page.waitForTimeout(80);
    I = await inst(page);
    ok(I.compass.on && await page.isVisible('#chipCompass'), 'Zirkel und Radius-Anzeige sichtbar');
    // Spitze auf A ziehen (ungenau loslassen → rastet ein)
    await stroke(page, 'pen', line([I.compass.nx, I.compass.ny], [A.x + 1.1, A.y - 0.9], 12));
    I = await inst(page);
    ok(near(I.compass.nx, A.x) && near(I.compass.ny, A.y), 'Zirkelspitze rastet in A ein', I.compass);
    // Mine auf ~4 cm nach oben ziehen → mm-Rundung
    let leadX = I.compass.nx + I.compass.r * Math.cos(I.compass.ang), leadY = I.compass.ny + I.compass.r * Math.sin(I.compass.ang);
    await stroke(page, 'pen', line([leadX, leadY], [A.x + 30.2, A.y - 26.6], 12));
    I = await inst(page);
    ok(near(I.compass.r, 40, 1e-9), 'Radius rastet auf ganze Millimeter: 4,0 cm', I.compass.r);
    ok((await page.textContent('#chipCompass')).includes('4,0 cm'), 'Anzeige zeigt r = 4,0 cm');
    // Am Griff drehen: Bogen von ca. −30° bis −80° (oberhalb von AB)
    async function drawArc(page, fromDeg, toDeg) {
      const c = (await inst(page)).compass;
      const g = await page.evaluate(() => compassParts(window.__zw.doc.inst.compass));
      const R = Math.hypot(g.gx - c.nx, g.gy - c.ny), a0 = Math.atan2(g.gy - c.ny, g.gx - c.nx);
      const pts = [[g.gx, g.gy]];
      const steps = 24, d = (toDeg - fromDeg) * Math.PI / 180;
      for (let i = 1; i <= steps; i++) { const a = a0 + d * i / steps; pts.push([c.nx + R * Math.cos(a), c.ny + R * Math.sin(a)]); }
      await stroke(page, 'pen', pts);
    }
    // Mine zeigt gerade nach rechts oben; Griff steht senkrecht dazu. Erst Richtung
    // auf ca. −20° stellen (mit gesperrtem Radius), dann 70° gegen den Uhrzeigersinn drehen.
    await page.click('#chipCompass button:first-child');
    I = await inst(page);
    ok(I.compass.lock, 'Schloss sperrt den Radius');
    leadX = I.compass.nx + I.compass.r * Math.cos(I.compass.ang); leadY = I.compass.ny + I.compass.r * Math.sin(I.compass.ang);
    await stroke(page, 'pen', line([leadX, leadY], [A.x + 60, A.y - 12], 10));
    I = await inst(page);
    ok(near(I.compass.r, 40, 1e-9), 'Mine ziehen bei Schloss ändert den Radius nicht', I.compass.r);
    await drawArc(page, 0, -70);
    o = await objs(page);
    const arc1 = o.find(x => x.type === 'arc');
    ok(arc1 && near(arc1.r, 40, 1e-9) && near(arc1.cx, A.x) && arc1.sweep < 0, 'Bogen um A mit r = 4 cm', arc1 && { r: arc1.r, sweep: arc1.sweep });

    /* ---------- Bogen um B mit r = 3 cm: Radius per Eingabe ---------- */
    await page.click('#chipCompass button:nth-child(2)');
    await page.fill('#dialogInput', '3');
    await page.keyboard.press('Enter');
    I = await inst(page);
    ok(near(I.compass.r, 30, 1e-9) && I.compass.lock, 'Radius per Eingabe: 3 cm, gesperrt');
    await stroke(page, 'pen', line([I.compass.nx, I.compass.ny], [B.x - 0.8, B.y + 1.0], 12));
    I = await inst(page);
    ok(near(I.compass.nx, B.x) && near(I.compass.ny, B.y), 'Zirkelspitze rastet in B ein');
    leadX = I.compass.nx + I.compass.r * Math.cos(I.compass.ang); leadY = I.compass.ny + I.compass.r * Math.sin(I.compass.ang);
    await stroke(page, 'pen', line([leadX, leadY], [B.x - 10, B.y - 40], 10));
    // C liegt von B aus bei −127°: Mine auf ca. −104° stellen, dann 60° weiter gegen den Uhrzeigersinn
    await drawArc(page, 0, -60);
    o = await objs(page);
    const arcs = o.filter(x => x.type === 'arc');
    ok(arcs.length === 2, 'Zweiter Bogen gezeichnet', arcs.length);

    /* ---------- C im Schnittpunkt ---------- */
    await page.click('[data-inst="compass"]');
    await page.click('[data-tool="point"]');
    // Erwarteter Schnittpunkt oberhalb von AB
    const ex = await page.evaluate(([a, b]) => arcArc(a, b), [arcs[0], arcs[1]]);
    ok(ex.length >= 1, 'Bögen schneiden sich', ex.length);
    const target = ex.reduce((p, q) => (q.y < p.y ? q : p), ex[0]);
    await stroke(page, 'pen', [[target.x + 1.3, target.y + 1.1]]);
    o = await objs(page);
    const C = o.find(x => x.type === 'point' && x.label === 'C');
    ok(C && near(Math.hypot(C.x - A.x, C.y - A.y), 40, 1e-6) && near(Math.hypot(C.x - B.x, C.y - B.y), 30, 1e-6),
      'C rastet im Schnittpunkt: |AC| = 4 cm, |BC| = 3 cm', C && [Math.hypot(C.x - A.x, C.y - A.y), Math.hypot(C.x - B.x, C.y - B.y)]);

    /* ---------- Geodreieck: Nullpunkt rastet auf A ---------- */
    await page.click('[data-inst="geo"]');
    I = await inst(page);
    // im Körper anfassen (lokal 0/−30) und so ziehen, dass der Nullpunkt knapp neben A landet
    const grab = await page.evaluate(() => locToWorld(window.__zw.doc.inst.geo, 0, -30));
    const dx = A.x + 1.0 - I.geo.x, dy = A.y - 0.8 - I.geo.y;
    await stroke(page, 'touch', line([grab.x, grab.y], [grab.x + dx, grab.y + dy], 15), 41);
    I = await inst(page);
    ok(near(I.geo.x, A.x) && near(I.geo.y, A.y), 'Nullpunkt des Geodreiecks rastet auf A (mit dem Finger verschoben)', I.geo);
    await page.click('[data-inst="geo"]');

    /* ---------- Punkt auf der Linealskala (6 cm) ---------- */
    await page.click('[data-inst="ruler"]');
    await page.click('[data-tool="point"]');
    let R = (await inst(page)).ruler;
    const at6 = await page.evaluate(() => { const r = window.__zw.doc.inst.ruler; return locToWorld(r, RULER.zero + 60.4, -RULER.wid / 2 - 1); });
    await stroke(page, 'pen', [[at6.x, at6.y]]);
    o = await objs(page);
    const pScale = o.filter(x => x.type === 'point').pop();
    const loc6 = await page.evaluate(p => worldToLoc(window.__zw.doc.inst.ruler, p.x, p.y), pScale);
    ok(near(loc6.x - (-100), 60, 1e-9) && near(loc6.y, -20, 1e-9), 'Punkt am Lineal rastet genau bei 6 cm auf der Kante', loc6);
    await page.click('#btnUndo');

    /* ---------- Drehgriff: Drehung rastet auf ganze Grad ---------- */
    const h0 = await page.evaluate(() => locToWorld(window.__zw.doc.inst.ruler, RULER.len / 2 - 13, RULER.wid / 2 - 11));
    const rcx = R.x, rcy = R.y;
    const rr = Math.hypot(h0.x - rcx, h0.y - rcy), a0r = Math.atan2(h0.y - rcy, h0.x - rcx);
    const rotPts = []; for (let i = 0; i <= 20; i++) { const a = a0r - (31.37 * Math.PI / 180) * i / 20; rotPts.push([rcx + rr * Math.cos(a), rcy + rr * Math.sin(a)]); }
    await stroke(page, 'touch', rotPts, 51);
    await page.waitForTimeout(80);   // Anzeige folgt im nächsten Bildaufbau
    R = (await inst(page)).ruler;
    const deg = -R.rot * 180 / Math.PI;
    ok(near(deg, Math.round(deg), 1e-9) && Math.abs(deg - 31) <= 1, 'Drehgriff dreht das Lineal, Ergebnis ganze Grad (≈31°)', deg);
    ok(await page.isVisible('#chipRuler') && (await page.textContent('#chipRuler')).includes(Math.round(deg) + '°'), 'Winkelanzeige am Lineal');

    /* ---------- Zwei Finger drehen das Geodreieck ---------- */
    await page.click('[data-inst="geo"]');
    let Gd = (await inst(page)).geo;
    const g1 = await page.evaluate(() => locToWorld(window.__zw.doc.inst.geo, -30, -15));
    const g2 = await page.evaluate(() => locToWorld(window.__zw.doc.inst.geo, 30, -15));
    await page.evaluate(([a, b]) => {
      window.__ptr('touch', 61, 'down', a.x, a.y);
      window.__ptr('touch', 62, 'down', b.x, b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      for (let i = 1; i <= 10; i++) {
        const t = -(20 * Math.PI / 180) * i / 10, c = Math.cos(t), s = Math.sin(t);
        const rot = (p) => [cx + (p.x - cx) * c - (p.y - cy) * s, cy + (p.x - cx) * s + (p.y - cy) * c];
        const pa = rot(a), pb = rot(b);
        window.__ptr('touch', 61, 'move', pa[0], pa[1]); window.__ptr('touch', 62, 'move', pb[0], pb[1]);
      }
      window.__ptr('touch', 61, 'up', 0, 0); window.__ptr('touch', 62, 'up', 0, 0);
    }, [g1, g2]);
    Gd = (await inst(page)).geo;
    ok(near(-Gd.rot * 180 / Math.PI, 20, 1e-6), 'Zwei Finger drehen das Geodreieck um 20°', -Gd.rot * 180 / Math.PI);
    await page.click('[data-inst="geo"]');

    /* ---------- Lineal an zwei Punkte anlegen ---------- */
    await page.click('[data-tool="hand"]');
    // Lineal so verschieben, dass die Oberkante fast durch A und C läuft
    R = (await inst(page)).ruler;
    const dirAC = Math.atan2(C.y - A.y, C.x - A.x);
    // Rotation per Eingabe nahe an AC (1,5° daneben), dann verschieben
    await page.evaluate(([r]) => { window.__zw.doc.inst.ruler.rot = r; }, [dirAC + 1.5 * Math.PI / 180]);
    const target2 = await page.evaluate(([A, C]) => {
      const r = window.__zw.doc.inst.ruler;
      const mid = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };
      const n = { x: -Math.sin(r.rot), y: Math.cos(r.rot) };   // lokale +y-Richtung
      return { x: mid.x + n.x * (RULER.wid / 2 + 0.6), y: mid.y + n.y * (RULER.wid / 2 + 0.6) };
    }, [A, C]);
    R = (await inst(page)).ruler;
    const grabR = await page.evaluate(() => locToWorld(window.__zw.doc.inst.ruler, 0, 5));
    const offX = grabR.x - R.x, offY = grabR.y - R.y;
    await stroke(page, 'touch', line([grabR.x, grabR.y], [target2.x + offX, target2.y + offY], 12), 71);
    const edgeNow = await page.evaluate(() => rulerEdges(window.__zw.doc.inst.ruler)[0]);
    const sA = (A.x - edgeNow.ax) * edgeNow.nx + (A.y - edgeNow.ay) * edgeNow.ny;
    const sC = (C.x - edgeNow.ax) * edgeNow.nx + (C.y - edgeNow.ay) * edgeNow.ny;
    ok(near(sA, 0, 1e-6) && near(sC, 0, 1e-6), 'Linealkante legt sich genau an A und C', [sA, sC]);
    await page.click('[data-inst="ruler"]');

    /* ---------- Radierer und Rückgängig ---------- */
    await page.click('[data-tool="pencil"]');
    await stroke(page, 'pen', line([-80, 40], [-60, 45], 10));
    let n = (await objs(page)).length;
    await page.click('[data-tool="eraser"]');
    await stroke(page, 'pen', line([-75, 35], [-72, 50], 8));
    ok((await objs(page)).length === n - 1, 'Radierer entfernt den Strich');
    await page.click('#btnUndo');
    ok((await objs(page)).length === n, 'Rückgängig holt ihn zurück');

    /* ---------- Text ---------- */
    await page.click('[data-tool="text"]');
    await stroke(page, 'pen', [[-80, 60]]);
    ok(await page.isVisible('#dialog'), 'Textdialog öffnet');
    await page.fill('#dialogInput', 'c = 5 cm');
    await page.keyboard.press('Enter');
    o = await objs(page);
    ok(o.some(x => x.type === 'text' && x.text === 'c = 5 cm'), 'Text eingefügt');

    /* ================= Stufe 2: Beschreibung und Wiedergabe ================= */
    /* Abgreifen: Spitze auf A, Mine auf B (Radius = |AB|), sperren, Spitze auf C, Bogen */
    await page.click('[data-tool="pencil"]');
    await page.click('[data-inst="compass"]');
    I = await inst(page);
    if (I.compass.lock) await page.click('#chipCompass button:first-child');
    await stroke(page, 'pen', line([I.compass.nx, I.compass.ny], [A.x + 0.9, A.y + 0.7], 12));
    I = await inst(page);
    leadX = I.compass.nx + I.compass.r * Math.cos(I.compass.ang); leadY = I.compass.ny + I.compass.r * Math.sin(I.compass.ang);
    await stroke(page, 'pen', line([leadX, leadY], [B.x - 0.8, B.y + 0.6], 12));
    I = await inst(page);
    ok(near(I.compass.r, 50, 1e-9) && I.compass.rs && I.compass.rs.t === 'taken', 'Zirkel greift |AB| = 5 cm ab und merkt es sich', I.compass);
    await page.click('#chipCompass button:first-child');
    await stroke(page, 'pen', line([I.compass.nx, I.compass.ny], [C.x + 0.8, C.y - 0.9], 12));
    await drawArc(page, 0, 40);
    await page.click('[data-inst="compass"]');
    let steps = await page.evaluate(() => window.__zw.steps().map(s => s.text));
    ok(steps[0] === 'Zeichne die Strecke AB mit der Länge 5 cm.', 'Schritt 1: Strecke AB', steps[0]);
    ok(steps[1] === 'Zeichne einen Kreisbogen um A mit dem Radius r = 4 cm.', 'Schritt 2: Bogen um A', steps[1]);
    ok(steps[2] === 'Zeichne einen Kreisbogen um B mit dem Radius r = 3 cm.', 'Schritt 3: Bogen um B (Radius eingetippt)', steps[2]);
    ok(steps[3] === 'Der Schnittpunkt der beiden Kreisbögen ist C.', 'Schritt 4: Schnittpunkt C', steps[3]);
    ok(steps[steps.length - 1] === 'Greife mit dem Zirkel die Länge von AB ab und zeichne einen Kreisbogen um C.', 'Letzter Schritt: abgegriffen', steps[steps.length - 1]);
    const nSteps = steps.length;

    /* Leiste */
    await page.click('#btnProto');
    ok(await page.isVisible('#protoPanel'), 'Konstruktionsleiste öffnet');
    ok(await page.locator('#protoList li').count() === nSteps, 'Leiste zeigt alle Schritte', [await page.locator('#protoList li').count(), nSteps]);
    ok((await page.textContent('#protoList li:first-child')).includes('Strecke AB'), 'Erster Eintrag ist die Strecke AB');
    ok((await page.textContent('#pbStatus')) === nSteps + ' Schritte', 'Anzahl der Schritte', await page.textContent('#pbStatus'));

    /* Kopieren (Vollversion – in Stufe 1/2 noch frei) */
    await page.click('#btnDescCopy');
    await page.waitForTimeout(150);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    ok(clip.includes('1. Zeichne die Strecke AB mit der Länge 5 cm.') && clip.includes('4. Der Schnittpunkt der beiden Kreisbögen ist C.'), 'Beschreibung landet nummeriert in der Zwischenablage', clip.slice(0, 120));

    /* Wiedergabe: Schritt für Schritt */
    const zBefore = await page.evaluate(() => window.__zw.view.zoom);
    await page.click('#pbNext');
    let pb = await page.evaluate(() => ({ on: window.__zw.PB.on, anim: !!window.__zw.PB.anim, cur: window.__zw.PB.cur }));
    ok(pb.on && pb.anim && pb.cur === 0, 'Wiedergabe startet mit animiertem Schritt 1', pb);
    ok(await page.isVisible('#pbPill'), 'Schwebende Steuerung sichtbar');
    ok(await page.evaluate(() => getComputedStyle(document.getElementById('toolbar')).pointerEvents === 'none'), 'Werkzeuge während der Wiedergabe gesperrt');
    await page.waitForTimeout(250);
    ok(await page.evaluate(() => !!window.__zw.PB.inst.ruler), 'Lineal erscheint für die Strecke');
    await page.waitForFunction(() => !window.__zw.PB.anim, null, { timeout: 5000 });
    pb = await page.evaluate(() => ({ cur: window.__zw.PB.cur, cls: document.querySelector('#protoList li.current') && [...document.querySelectorAll('#protoList li')].indexOf(document.querySelector('#protoList li.current')) }));
    ok(pb.cur === 1 && pb.cls === 0, 'Nach Schritt 1: markiert, Zähler 1', pb);
    ok((await page.textContent('#pbStatus')) === 'Schritt 1 von ' + nSteps, 'Statuszeile', await page.textContent('#pbStatus'));
    // Schritt 2: Zirkel fährt zu A und schlägt den Bogen
    await page.click('#pbNext');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => !!window.__zw.PB.inst.compass && !window.__zw.PB.inst.ruler), 'Zirkel statt Lineal für den Bogen');
    await page.waitForFunction(() => !window.__zw.PB.anim, null, { timeout: 6000 });
    const cp = await page.evaluate(() => window.__zw.PB.inst.compass);
    ok(near(cp.nx, A.x, 1e-6) && near(cp.ny, A.y, 1e-6) && near(cp.r, 40, 1e-6), 'Zirkel steht nach dem Schritt in A mit r = 4 cm', cp);
    // Zweimal tippen: zweiter Tipp beendet den Schritt sofort
    await page.click('#pbNext');
    await page.click('#pbNext');
    pb = await page.evaluate(() => ({ cur: window.__zw.PB.cur, anim: !!window.__zw.PB.anim }));
    ok(pb.cur === 3 && !pb.anim, 'Erneutes Tippen beendet den laufenden Schritt sofort', pb);
    // Bearbeiten ist gesperrt, Verschieben geht
    const before2 = (await objs(page)).length;
    await stroke(page, 'pen', line([-60, 30], [-40, 35], 8));
    ok((await objs(page)).length === before2, 'Während der Wiedergabe entsteht kein Strich');
    await page.keyboard.press('Meta+z');
    ok((await objs(page)).length === before2, 'Rückgängig ist während der Wiedergabe gesperrt');
    // Zurück, Ende, Anfang, Antippen
    await page.click('#pbPrev');
    ok(await page.evaluate(() => window.__zw.PB.cur) === 2, 'Zurück: ein Schritt weniger');
    await page.click('#pbLast');
    ok(await page.evaluate(() => window.__zw.PB.cur) === nSteps, 'Zum Ende: alles sichtbar');
    await page.click('#pbFirst');
    ok(await page.evaluate(() => window.__zw.PB.cur) === 0, 'Zum Anfang: leeres Blatt');
    await page.locator('#protoList li').nth(3).click();
    ok(await page.evaluate(() => window.__zw.PB.cur) === 4, 'Antippen eines Schritts springt dorthin');
    // Abspielen in doppeltem Tempo bis zum Ende
    await page.click('#pbFirst');
    await page.click('#pbSpeed');
    ok((await page.textContent('#pbSpeed')) === '2×', 'Tempo 2×');
    await page.click('#pbPlay');
    ok(await page.evaluate(() => window.__zw.PB.playing), 'Abspielen läuft');
    await page.waitForFunction(n => !window.__zw.PB.playing && window.__zw.PB.cur === n, nSteps, { timeout: 30000 });
    ok(true, 'Abspielen läuft selbstständig bis zum letzten Schritt');
    // Leiste schließen: Steuerung bleibt
    await page.click('#protoPanel header .tb');
    ok(await page.isVisible('#pbPill') && await page.evaluate(() => window.__zw.PB.on), 'Ohne Leiste bleibt die schwebende Steuerung (Beamer)');
    await page.keyboard.press('ArrowLeft');
    ok(await page.evaluate(() => window.__zw.PB.cur) === nSteps - 1, 'Pfeiltaste ← geht zurück');
    await page.keyboard.press('Escape');
    ok(!(await page.evaluate(() => window.__zw.PB.on)) && !(await page.isVisible('#pbPill')), 'Escape beendet die Wiedergabe');
    ok(near(await page.evaluate(() => window.__zw.view.zoom), zBefore, 1e-9), 'Ansicht wie vorher');
    ok(await page.evaluate(() => getComputedStyle(document.getElementById('toolbar')).pointerEvents) !== 'none', 'Werkzeuge wieder frei');
    // Sprache bei offener Leiste
    await page.click('#btnProto');
    await page.click('[aria-label="Einstellungen"]');
    await page.click('#choiceLangEn');
    await page.click('#settingsPanel header .tb');
    ok((await page.textContent('#protoList li:first-child')).includes('Draw the line segment AB with length 5 cm.'), 'Leiste wechselt mit der Sprache');
    await page.click('[aria-label="Settings"]');
    await page.click('#choiceLangDe');
    await page.click('#settingsPanel header .tb');
    await page.click('#protoPanel header .tb');

    /* ---------- Sprache ---------- */
    await page.click('[aria-label="Einstellungen"]');
    await page.click('#choiceLangEn');
    ok(await page.textContent('[data-tool="pencil"] .lb') === 'Pencil', 'Englisch: Werkzeugnamen');
    ok(await page.title() === 'Compasswork', 'Englisch: App heißt Compasswork');
    await page.click('#choiceLangDe');
    ok(await page.title() === 'Zirkelwerk', 'Zurück auf Deutsch');
    await page.click('#toggleSnap');
    ok(!(await page.evaluate(() => window.__zw.S.snap)), 'Einrasten abschaltbar');
    await page.click('#toggleSnap');
    await page.click('#settingsPanel header .tb');

    /* ---------- Speichern und neu laden ---------- */
    const before = (await objs(page)).length;
    await page.evaluate(() => window.__zw.saveNow());
    await page.reload();
    await page.waitForFunction(() => window.__zw && window.__zw.ready);
    await installHelpers(page);
    ok((await objs(page)).length === before, 'Nach dem Neuladen ist alles da', [before, (await objs(page)).length]);
    ok(!(await page.isVisible('#helpPanel')), 'Kurzanleitung erscheint nur beim ersten Start');

    /* ---------- Blätter ---------- */
    await page.click('#btnSheets');
    await page.click('text=Neues Blatt');
    await page.waitForFunction(() => document.getElementById('sheetTitle').textContent === 'Blatt 2', null, { timeout: 3000 }).catch(() => {});
    ok(await page.textContent('#sheetTitle') === 'Blatt 2', 'Neues Blatt angelegt');
    ok((await objs(page)).length === 0, 'Neues Blatt ist leer');
    await page.click('#btnSheets');
    await page.waitForFunction(() => document.querySelectorAll('.sheet').length === 2, null, { timeout: 3000 }).catch(() => {});
    ok(await page.locator('.sheet').count() === 2, 'Liste zeigt zwei Blätter');
    await page.locator('.sheet:not(.current) button').first().click();
    await page.waitForFunction(() => document.getElementById('sheetTitle').textContent === 'Blatt 1', null, { timeout: 3000 }).catch(() => {});
    ok(await page.textContent('#sheetTitle') === 'Blatt 1' && (await objs(page)).length === before, 'Zurück zu Blatt 1 mit Inhalt');

    /* ---------- Import: kaputte und gute Datei ---------- */
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zw-'));
    const bad = path.join(tmp, 'kaputt.zirkelwerk');
    fs.writeFileSync(bad, '{"format":"etwas anderes"}');
    await page.click('#btnSheets');
    await page.setInputFiles('#importInput', bad);
    await page.waitForTimeout(150);
    ok((await page.textContent('#toast')).includes('kein Zirkelwerk-Blatt'), 'Fremde Datei wird abgelehnt');
    const good = path.join(tmp, 'Dreieck.zirkelwerk');
    fs.writeFileSync(good, JSON.stringify({
      format: 'zirkelwerk', v: 1, name: '', objects: [
        { type: 'segment', x1: 0, y1: 0, x2: 50, y2: 0, c: '#3b3f45', w: 0.5, al: 1 },
        { type: 'point', x: 0, y: 0, label: '<img src=x onerror=alert(1)>', ld: 7, c: '#3b3f45' },
        { type: 'segment', x1: 'x', y1: 0, x2: 1, y2: 1 },
        { type: 'evil', x: 1 }
      ]
    }));
    await page.setInputFiles('#importInput', good);
    await page.waitForFunction(() => document.getElementById('sheetTitle').textContent === 'Dreieck');
    o = await objs(page);
    ok(o.length === 2, 'Import übernimmt nur gültige Objekte', o.length);
    ok(o.find(x => x.type === 'point').label.length <= 12, 'Beschriftung beim Import gekürzt');
    ok(await page.locator('img[src="x"]').count() === 0, 'Kein eingeschleustes HTML');


    {
    /* ================= Stufe 3a: Kongruenzsätze-Labor ================= */
    await page.click('#btnLab');
    ok(await page.isVisible('#labPanel'), 'Labor öffnet');
    ok((await page.textContent('#labStatus')) === 'Eindeutig konstruierbar.', 'SWS-Vorgabe: eindeutig', await page.textContent('#labStatus'));
    await page.click('#labKind_ssw');
    await page.fill('#labIn_c', '6'); await page.fill('#labIn_a', '5'); await page.fill('#labIn_alpha', '40');
    ok((await page.textContent('#labStatus')).startsWith('Zwei Lösungen') && await page.evaluate(() => document.getElementById('labStatus').classList.contains('warn')), 'SsW mit a < c: Warnung zwei Lösungen');
    await page.fill('#labIn_a', '2');
    ok((await page.textContent('#labStatus')).includes('a ist zu kurz'), 'SsW: a zu kurz');
    await page.fill('#labIn_a', 'x');
    ok(await page.isDisabled('#btnLabDemo') && (await page.textContent('#labStatus')).startsWith('Bitte alle Werte'), 'Ungültige Eingabe sperrt die Knöpfe');
    await page.click('#labKind_sss');
    await page.click('text=Zufallswerte');
    ok((await page.textContent('#labStatus')) === 'Eindeutig konstruierbar.', 'Zufallswerte SSS sind eindeutig');
    /* Vorführen SWS */
    await page.click('#labKind_sws');
    await page.fill('#labIn_c', '6'); await page.fill('#labIn_b', '4,5'); await page.fill('#labIn_alpha', '50');
    await page.click('#btnLabDemo');
    await page.waitForFunction(() => window.__zw.PB.on, null, { timeout: 5000 });
    ok((await page.textContent('#sheetTitle')) === 'SWS: c = 6 cm, b = 4,5 cm und α = 50°', 'Vorführ-Blatt angelegt', await page.textContent('#sheetTitle'));
    ok(await page.evaluate(() => window.__zw.PB.playing), 'Vorführen spielt automatisch ab');
    await page.waitForTimeout(400);
    const demoSteps = await page.evaluate(() => window.__zw.PB.steps.map(s => s.text));
    ok(demoSteps[0] === 'Fertige eine Planfigur an und markiere die gegebenen Größen.' && demoSteps[2] === 'Trage in A an AB den Winkel α = 50° an.' && demoSteps[4].startsWith('Der Schnittpunkt von dem freien Schenkel'), 'Vorführung: Planfigur, Winkel antragen, Schnittpunkt', demoSteps);
    await page.waitForFunction(() => window.__zw.PB.anim && window.__zw.PB.anim.k === 2, null, { timeout: 15000 });
    await page.waitForTimeout(250);
    ok(await page.evaluate(() => !!window.__zw.PB.inst.geo), 'Winkel wird mit dem Geodreieck angetragen');
    await page.click('#pbLast');
    await page.keyboard.press('Escape');
    ok(!(await page.evaluate(() => window.__zw.PB.on)), 'Vorführung beendet');

    /* Selbst konstruieren: SSS c = 5, b = 4, a = 3 */
    await page.click('#btnLab');
    await page.click('#labKind_sss');
    await page.fill('#labIn_c', '5'); await page.fill('#labIn_b', '4'); await page.fill('#labIn_a', '3');
    await page.click('#btnLabSelf');
    await page.waitForFunction(() => window.__zw.doc.task, null, { timeout: 5000 });
    ok(await page.isVisible('#taskBar') && (await page.textContent('#taskText')).replace(/\u00a0/g, ' ') === 'Konstruiere das Dreieck ABC mit c = 5 cm, b = 4 cm und a = 3 cm.', 'Aufgabenleiste zeigt die Aufgabe', await page.textContent('#taskText'));
    ok((await objs(page)).every(o => o.m && o.m.plan), 'Aufgabenblatt enthält nur die Planfigur');
    await page.click('#taskBar .btn');
    ok((await page.textContent('#dialogTitle')) === 'Noch nicht ganz' && (await page.textContent('#dialogMessage')).includes('Beschrifte die Eckpunkte mit A, B und C.'), 'Prüfen ohne Konstruktion: Hinweis auf Beschriftung');
    await page.click('#dialogButtons .btn.primary');
    // Konstruktion rechts der Planfigur, mit den echten Werkzeugen
    const cx0 = await page.evaluate(() => { const z = window.__zw; return z.s2w(z.view && 0, 0); });
    const vc = await page.evaluate(() => { const z = window.__zw; const r = document.getElementById('cvBase').getBoundingClientRect(); return z.s2w(r.width * 0.55, r.height * 0.65); });
    const P0 = { x: Math.round(vc.x), y: Math.round(vc.y) };
    await page.click('[data-inst="ruler"]');
    await page.evaluate(([p]) => { const r = window.__zw.doc.inst.ruler; r.rot = 0; r.x = p.x + 100 - 10; r.y = p.y + 20; }, [P0]);
    const e2 = await page.evaluate(() => rulerEdges(window.__zw.doc.inst.ruler)[0]);
    await stroke(page, 'pen', [[P0.x + 0.3, e2.ay - 1], [P0.x + 25, e2.ay - 1.2], [P0.x + 50.2, e2.ay - 0.8]]);
    let so = (await objs(page)).filter(o => o.type === 'segment');
    const sA = { x: so[0].x1, y: so[0].y1 }, sB = { x: so[0].x2, y: so[0].y2 };
    ok(near(Math.hypot(sB.x - sA.x, sB.y - sA.y), 50, 1e-9), 'Schüler zeichnet c = 5 cm am Lineal');
    await page.click('[data-inst="ruler"]');
    await page.click('[data-tool="point"]');
    await stroke(page, 'pen', [[sA.x + 0.6, sA.y]]); await stroke(page, 'pen', [[sB.x - 0.6, sB.y]]);
    await page.click('[data-tool="pencil"]');
    await page.click('[data-inst="compass"]');
    let Ic = (await inst(page)).compass;
    if (Ic.lock) await page.click('#chipCompass button:first-child');
    await stroke(page, 'pen', line([Ic.nx, Ic.ny], [sA.x + 0.7, sA.y - 0.5], 10));
    Ic = (await inst(page)).compass;
    let lx = Ic.nx + Ic.r * Math.cos(Ic.ang), ly = Ic.ny + Ic.r * Math.sin(Ic.ang);
    await stroke(page, 'pen', line([lx, ly], [sA.x + 30.3, sA.y - 26.4], 10));
    await page.click('#chipCompass button:first-child');
    await drawArc(page, 0, 30);   // C liegt von A aus bei −37°, die Mine steht bei −41°
    await page.click('#chipCompass button:nth-child(2)');
    await page.fill('#dialogInput', '3'); await page.keyboard.press('Enter');
    Ic = (await inst(page)).compass;
    await stroke(page, 'pen', line([Ic.nx, Ic.ny], [sB.x - 0.6, sB.y + 0.6], 10));
    Ic = (await inst(page)).compass;
    lx = Ic.nx + Ic.r * Math.cos(Ic.ang); ly = Ic.ny + Ic.r * Math.sin(Ic.ang);
    await stroke(page, 'pen', line([lx, ly], [sB.x - 8, sB.y - 29], 10));
    await drawArc(page, 0, -60);
    await page.click('[data-inst="compass"]');
    const arcsS = (await objs(page)).filter(o => o.type === 'arc');
    const X = await page.evaluate(([a, b]) => arcArc(a, b), [arcsS[0], arcsS[1]]);
    ok(X.length >= 1, 'Schülerbögen schneiden sich', X.length);
    const Cs = X.reduce((p, q) => (q.y < p.y ? q : p), X[0]);
    await page.click('[data-tool="point"]');
    await stroke(page, 'pen', [[Cs.x + 1, Cs.y + 0.8]]);
    await page.click('#taskBar .btn');
    ok((await page.textContent('#dialogMessage')).includes('Zeichne noch die Seite(n) BC und AC.'), 'Prüfen: fehlende Seiten werden genannt', await page.textContent('#dialogMessage'));
    await page.click('#dialogButtons .btn.primary');
    // Seiten AC und BC am Lineal (Kante genau durch beide Punkte gelegt)
    await page.click('[data-tool="pencil"]');
    await page.click('[data-inst="ruler"]');
    for (const [P, Q] of [[sA, Cs], [sB, Cs]]) {
      await page.evaluate(([P, Q]) => {
        const r = window.__zw.doc.inst.ruler, rot = Math.atan2(Q.y - P.y, Q.x - P.x);
        const lx = -60, W = RULER.wid / 2, c = Math.cos(rot), s = Math.sin(rot);
        r.rot = rot; r.x = P.x - (lx * c + W * s); r.y = P.y - (lx * s - W * c);
      }, [P, Q]);
      const ed = await page.evaluate(() => rulerEdges(window.__zw.doc.inst.ruler)[0]);
      const out = (pt, d) => [pt.x + ed.nx * 1 + (Q.x - P.x) * d, pt.y + ed.ny * 1 + (Q.y - P.y) * d];
      await stroke(page, 'pen', [out(P, 0.01), out(P, 0.5), out(Q, 0.01)]);
    }
    await page.click('[data-inst="ruler"]');
    await page.click('#taskBar .btn');
    ok((await page.textContent('#dialogTitle')) === '✓ Richtig!', 'Richtige Schülerkonstruktion wird bestätigt', [await page.textContent('#dialogTitle'), await page.textContent('#dialogMessage')]);
    /* Lösung ansehen → eigenes Blatt mit Vorführung */
    await page.click('text=Lösung ansehen');
    await page.waitForFunction(() => window.__zw.PB.on, null, { timeout: 5000 });
    ok((await page.textContent('#sheetTitle')).startsWith('Lösung SSS: c = 5 cm'), 'Lösung als eigenes Blatt');
    ok(!(await page.isVisible('#taskBar')), 'Aufgabenleiste während der Wiedergabe verborgen');
    await page.keyboard.press('Escape');
    // zurück zur Aufgabe und Aufgabe entfernen
    await page.click('#btnSheets');
    await page.locator('.sheet', { hasText: 'Aufgabe SSS' }).locator('button').first().click();
    await page.waitForFunction(() => window.__zw.doc.task, null, { timeout: 3000 });
    /* PDF: Arbeitsblatt ohne Lösung, dann mit Lösung und Beschreibung */
    {
      const fsx = require('fs'), cp = require('child_process');
      const grab = async () => {
        const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#dialogButtons .btn.primary')]);
        const file = await dl.path();
        return { name: dl.suggestedFilename(), file, pdf: fsx.readFileSync(file).toString('latin1') };
      };
      await page.click('#btnPdf');
      ok((await page.textContent('#dialogTitle')) === 'Als PDF (A4)' && await page.isVisible('#pdfOpt_taskOnly'), 'PDF-Dialog mit Schalter „Nur die Aufgabe"');
      if ((await page.textContent('#pdfOpt_desc')) === 'Aus') await page.click('#pdfOpt_desc');
      await page.click('#pdfOpt_taskOnly');
      ok(await page.isDisabled('#pdfOpt_desc'), 'Nur Aufgabe: Beschreibung gesperrt (würde die Lösung verraten)');
      const w1 = await grab();
      ok(w1.name.endsWith(' Aufgabe.pdf') && w1.pdf.startsWith('%PDF-1.4') && w1.pdf.includes('(Konstruiere das Dreieck ABC mit c') && !w1.pdf.includes('(Konstruktionsbeschreibung)'), 'Arbeitsblatt-PDF ohne Lösung', w1.name);
      const nPts = (w1.pdf.match(/ Tj /g) || []).length;
      await page.click('#btnPdf');
      ok((await page.textContent('#pdfOpt_taskOnly')) === 'Ein', 'PDF-Dialog merkt sich die Wahl');
      await page.click('#pdfOpt_taskOnly');
      ok(!(await page.isDisabled('#pdfOpt_desc')) && (await page.textContent('#pdfOpt_desc')) === 'Ein', 'Beschreibung wieder wählbar');
      const w2 = await grab();
      ok(!w2.name.endsWith(' Aufgabe.pdf') && w2.pdf.includes('(Konstruktionsbeschreibung) Tj') && (w2.pdf.match(/ Tj /g) || []).length > nPts, 'PDF mit Konstruktion und Beschreibung', w2.name);
      if (cp.spawnSync('sh', ['-c', 'command -v qpdf']).status === 0) {
        const q = cp.spawnSync('qpdf', ['--check', w2.file], { encoding: 'utf8' });
        ok(q.status === 0 && !/WARNING/.test(q.stdout + q.stderr), 'App-PDF besteht qpdf --check', q.stdout + q.stderr);
      }
      /* Anderes Blatt über „⋯" in der Blattliste */
      await page.click('#btnSheets');
      await page.locator('.sheet:not(.current) .more').first().click();
      await page.click('#dialogButtons .btn >> text=Als PDF');
      await page.waitForFunction(() => document.getElementById('dialogTitle').textContent === 'Als PDF (A4)', null, { timeout: 3000 });
      const w3 = await grab();
      ok(w3.pdf.startsWith('%PDF') && w3.pdf.endsWith('%%EOF\n'), 'PDF aus der Blattliste', w3.name);
      await page.click('#sheetsPanel header .tb');
    }
    await page.click('#taskBar .tb');
    await page.click('#dialogButtons .btn.danger');
    ok(!(await page.isVisible('#taskBar')) && !(await page.evaluate(() => window.__zw.doc.task)), 'Aufgabe entfernt');
    /* ---------- Aufgaben per QR-Code ---------- */
    {
      const cnt = () => page.evaluate(() => new Promise(r => { const q = indexedDB.open('zirkelwerk'); q.onsuccess = () => { const tx = q.result.transaction('docs').objectStore('docs').count(); tx.onsuccess = () => r(tx.result); }; }));
      await page.click('#btnLab');
      await page.click('#labKind_sws');
      await page.fill('#labIn_c', '6'); await page.fill('#labIn_b', '4,5'); await page.fill('#labIn_alpha', '50');
      await page.click('#btnLabQr');
      ok(await page.isVisible('#qrPanel') && !(await page.isVisible('#labPanel')), 'QR-Code groß angezeigt, Labor geschlossen');
      const link = await page.getAttribute('#qrCanvas', 'data-link');
      ok(link === 'zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=50', 'QR enthält den Aufgaben-Link', link);
      ok((await page.textContent('#qrText')).replace(/ /g, ' ') === 'Konstruiere das Dreieck ABC mit c = 6 cm, b = 4,5 cm und α = 50°.', 'Aufgabe steht über dem Code');
      ok(await page.evaluate(() => { const c = document.getElementById('qrCanvas'); const d = c.getContext('2d').getImageData(0, 0, 4, 4).data; return c.width >= 200 && d[0] === 255; }), 'QR mit weißer Ruhezone gezeichnet');
      /* Für die Gegenprobe als Bild ablegen (lokal mit zxing lesbar) */
      require('fs').writeFileSync(require('path').join(require('os').tmpdir(), 'zw-qr.png'), Buffer.from((await page.evaluate(() => document.getElementById('qrCanvas').toDataURL('image/png'))).split(',')[1], 'base64'));
      await page.click('#qrPanel header .tb');
      // Schüler scannt: Cordova ruft handleOpenURL
      const n0 = await cnt();
      await page.evaluate(l => window.handleOpenURL(l), link);
      await page.waitForFunction(() => window.__zw.doc.task && window.__zw.doc.task.kind === 'sws' && window.__zw.doc.src, null, { timeout: 5000 });
      ok((await cnt()) === n0 + 1 && (await objs(page)).every(o => o.m && o.m.plan) && await page.isVisible('#taskBar'), 'Gescannte Aufgabe öffnet als neues Aufgabenblatt');
      const firstId = await page.evaluate(() => window.__zw.doc.id);
      await page.click('[data-tool="hand"]');
      await page.evaluate(l => window.handleOpenURL(l), link);
      await page.waitForTimeout(400);
      ok((await cnt()) === n0 + 1 && (await page.evaluate(() => window.__zw.doc.id)) === firstId && (await page.textContent('#toast')).includes('schon'), 'Zweites Scannen öffnet dasselbe Blatt statt eines neuen');
      await page.evaluate(() => window.handleOpenURL('zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=500'));
      await page.waitForTimeout(300);
      ok((await cnt()) === n0 + 1 && (await page.textContent('#toast')).includes('keine gültige'), 'Ungültiger Link: Hinweis, kein Blatt');
      await page.evaluate(() => window.handleOpenURL('zirkelwerk://a?v=9&k=sws&c=60&b=45&alpha=50'));
      await page.waitForTimeout(300);
      ok((await page.textContent('#toast')).includes('neueren'), 'Link aus neuerer Version: Hinweis zum Aktualisieren');
      /* Aufgabenmenü → QR */
      await page.click('#taskBar .tb');
      await page.click('#dialogButtons .btn >> text=QR-Code für die Klasse');
      ok(await page.isVisible('#qrPanel') && (await page.getAttribute('#qrCanvas', 'data-link')) === link, 'Aufgabenmenü zeigt denselben Code');
      await page.click('#qrPanel header .tb');
      /* Eigenes Blatt als QR (über die Blattliste) und wieder öffnen */
      await page.click('#btnSheets');
      const own = page.locator('.sheet', { hasText: 'Lösung SSS' }).first();
      await own.locator('.more').click();
      await page.click('#dialogButtons .btn >> text=Als QR-Code');
      let sheetLink = null;
      if (await page.isVisible('#qrPanel')) sheetLink = await page.getAttribute('#qrCanvas', 'data-link');
      else { ok((await page.textContent('#dialogTitle')) === 'Zu groß für einen QR-Code', 'Zu großes Blatt: verständlicher Hinweis'); await page.click('#dialogButtons .btn'); }
      if (sheetLink) {
        ok(sheetLink.startsWith('zirkelwerk://s?v=1&d='), 'Blatt-Link erzeugt', sheetLink.length);
        await page.click('#qrPanel header .tb');
      }
      // ein kleines, selbst gezeichnetes Blatt
      const small = await page.evaluate(() => linkForSheet({ name: 'Mittelsenkrechte', objects: [
        { id: 'a', type: 'point', x: 0, y: 0, label: 'A', ld: 5, c: '#3b3f45' }, { id: 'b', type: 'point', x: 50, y: 0, label: 'B', ld: 7, c: '#3b3f45' },
        { id: 's', type: 'segment', x1: 0, y1: 0, x2: 50, y2: 0, c: '#3b3f45', w: 0.5, al: 1, m: { via: 'ruler' } }] }));
      await page.evaluate(l => window.handleOpenURL(l), small);
      await page.waitForFunction(() => window.__zw.doc.name === 'Mittelsenkrechte', null, { timeout: 5000 });
      const so2 = await objs(page);
      ok(so2.length === 3 && so2.filter(o => o.type === 'point').map(o => o.label).join() === 'A,B' && !(await page.evaluate(() => window.__zw.doc.task)), 'Gescanntes Blatt mit Punkten und Strecke');
      const st3 = await page.evaluate(() => window.__zw.steps().map(s => s.text));
      ok(st3.join(' | ') === 'Zeichne einen Punkt A. | Zeichne einen Punkt B. | Verbinde A mit B.', 'Beschreibung des gescannten Blatts stimmt', st3);
    }
    /* Englische Satznamen */
    await page.click('[aria-label="Einstellungen"]'); await page.click('#choiceLangEn'); await page.click('#settingsPanel header .tb');
    await page.click('#btnLab');
    ok((await page.textContent('#labKind_sws')) === 'SAS' && (await page.textContent('#labKind_ssw')) === 'SSA', 'Englisch: SAS, SSA');
    await page.click('#labPanel header .tb');
    await page.click('[aria-label="Settings"]'); await page.click('#choiceLangDe'); await page.click('#settingsPanel header .tb');

    }
    /* ---------- Handy (iPhone hochkant) ---------- */
    {
      const ph = await launch({ locale: 'de-DE', viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
      const pp = await ph.context.newPage();
      const perr = []; pp.on('pageerror', e => perr.push(e.message));
      await pp.goto(url); await pp.waitForFunction(() => window.__zw && window.__zw.ready);
      ok(await pp.isVisible('#helpLangTop') && await pp.isVisible('#helpLangTopDe'), 'Handy: Sprachwahl beim ersten Start oben in der Hilfe');
      await pp.click('#helpLangTopEn');
      ok((await pp.textContent('#helpTitle')) === 'Help & about', 'Handy: Sprache aus der Hilfe umgestellt');
      await pp.click('#helpLangTopDe');
      await pp.click('#helpPanel header .tb');
      const lay = await pp.evaluate(() => {
        const bar = document.getElementById('topbar').getBoundingClientRect();
        const outside = [...document.querySelectorAll('#topbar > *')].filter(e => !e.hidden && e.offsetWidth && e.getBoundingClientRect().right > bar.right + 0.5).map(e => e.id);
        return { outside, more: !document.getElementById('btnMore').hidden, zoom: window.__zw.view.zoom, ppm: ppm * 25.4 };
      });
      ok(lay.more && lay.outside.length === 0, 'Handy: Kopfleiste passt, Rest im „⋯"-Menü', lay);
      ok(lay.zoom === 0.5 && Math.abs(lay.ppm - 153.33) < 0.01, 'Handy: Start mit 50 %, iPhone-Maß erkannt', lay);
      await pp.click('#btnMore');
      ok((await pp.textContent('#dialogTitle')) === 'Mehr' && (await pp.locator('#dialogButtons .btn').count()) === 6, 'Handy: Menü mit fünf Einträgen und Abbrechen');
      await pp.click('#dialogButtons .btn >> text=Einstellungen');
      ok(await pp.isVisible('#settingsPanel'), 'Handy: Einstellungen über das Menü erreichbar');
      await pp.click('#settingsPanel .btn >> text=Kurzanleitung');
      ok(await pp.isVisible('#helpPanel') && !(await pp.isVisible('#helpLangTop')) && (await pp.textContent('#helpAboutLine')).startsWith('Zirkelwerk 0.'), 'Handy: Kurzanleitung aus den Einstellungen, „Über" mit Version');
      await pp.click('#helpPanel header .tb');
      await pp.setViewportSize({ width: 844, height: 390 });
      await pp.waitForTimeout(200);
      ok(await pp.evaluate(() => document.getElementById('btnMore').hidden && !document.getElementById('btnSettings').hidden), 'Handy quer: alles in der Kopfleiste, kein Menü');
      ok(await pp.evaluate(() => { const tb = document.getElementById('toolbar'); return tb.scrollHeight <= tb.clientHeight + 1; }), 'Handy quer: Werkzeugleiste ohne Blättern');
      ok(perr.length === 0, 'Handy: keine Skriptfehler', perr);
      await ph.browser.close();
    }
    ok(errors.length === 0, 'Keine Skriptfehler im Browser', errors);
  } catch (e) { fails.push("ABBRUCH: " + e.message); failed++; } finally {
    await browser.close();
    srv.close();
  }

  console.log(`\nZirkelwerk-Ablauftest: ${passed} bestanden, ${failed} fehlgeschlagen`);
  if (failed) { console.log('\nFehlgeschlagen:\n  - ' + fails.join('\n  - ')); process.exit(1); }
}

main().catch(e => { console.error(e); process.exit(1); });
