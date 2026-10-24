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
  /* Der Hauptablauf prüft alle Funktionen – also als Besitzer der Vollversion.
     Die kostenlose Fassung prüft ein eigener Abschnitt weiter unten. */
  await context.addInitScript(() => { try { localStorage.setItem('zw.full', '1'); } catch (e) { /* egal */ } });
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

    /* ---------- 0.10.1: Beschriftung um den Punkt ziehen ---------- */
    {
      const pA = (await objs(page)).find(x => x.label === 'A');
      const box = await page.evaluate(id => { const o = window.__zw.doc.objects.find(x => x.id === id); return labelBox(o, window.__zw.sc()); }, pA.id);
      const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
      const ldVor = pA.ld == null ? 7 : pA.ld;
      // Gegenüberliegende Seite: Richtung umkehren
      const vx = pA.x - (cx - pA.x) * 4, vy = pA.y - (cy - pA.y) * 4;
      await stroke(page, 'pen', line([cx, cy], [vx, vy], 10));
      const ldNach = (await objs(page)).find(x => x.label === 'A').ld;
      ok(ldNach === (ldVor + 4) % 8, 'Beschriftung auf die Gegenseite gezogen', [ldVor, ldNach]);
      ok(!(await page.isVisible('#dialog')), 'Ziehen öffnet keinen Dialog');
      ok((await objs(page)).filter(x => x.type === 'point').length === 2, 'Ziehen der Beschriftung setzt keinen Punkt');
      await page.click('#btnUndo');
      ok(((await objs(page)).find(x => x.label === 'A').ld) === pA.ld, 'Rückgängig: Beschriftung wieder an alter Stelle');
      await stroke(page, 'pen', [[cx, cy]]);
      ok(await page.isVisible('#dialog') && (await page.textContent('#dialogTitle')) === 'Punkt', 'Antippen der Beschriftung öffnet den Punkt');
      await page.keyboard.press('Escape');
      // Finger im Stift-Modus: Tipp auf den Punkt öffnet ihn, Ziehen verschiebt nur
      await stroke(page, 'touch', [[pA.x, pA.y]], 31);
      ok(await page.isVisible('#dialog'), 'Stift-Modus: Fingertipp auf A öffnet den Punkt-Dialog');
      await page.keyboard.press('Escape');
      const ox = await page.evaluate(() => window.__zw.view.ox);
      await stroke(page, 'touch', line([pA.x, pA.y], [pA.x + 20, pA.y], 6), 32);
      ok(!(await page.isVisible('#dialog')) && (await page.evaluate(() => window.__zw.view.ox)) !== ox, 'Stift-Modus: Finger auf A ziehen verschiebt das Blatt');
      await page.evaluate(x => { window.__zw.view.ox = x; viewChanged(); }, ox);
      await stroke(page, 'touch', [[pA.x + 60, pA.y + 60]], 33);
      ok(await page.evaluate(() => window.__zw.S.fingerHint) && (await page.textContent('#toast')).includes('Finger'), 'Stift-Modus: Fingertipp ins Leere erklärt einmal das Verhalten');
      ok((await objs(page)).filter(x => x.type === 'point').length === 2, 'Fingertipp setzt keinen Punkt');

      /* Langes Drücken auf B: freier Punkt wird verschoben, die Strecke zieht mit */
      const pB = (await objs(page)).find(x => x.label === 'B');
      await page.evaluate(([x, y]) => window.__ptr('pen', 41, 'down', x, y), [pB.x, pB.y]);
      await page.waitForTimeout(600);
      ok(await page.evaluate(() => window.__zw.G && window.__zw.G.kind === 'pmove'), 'Langes Drücken auf B: Verschiebemodus');
      for (let i = 1; i <= 5; i++) await page.evaluate(([x, y]) => window.__ptr('pen', 41, 'move', x, y), [pB.x + i, pB.y + i * 0.6]);
      await page.evaluate(([x, y]) => window.__ptr('pen', 41, 'up', x, y), [pB.x + 5, pB.y + 3]);
      let mv = await objs(page);
      const nB = mv.find(x => x.label === 'B'), sAB = mv.find(x => x.type === 'segment' && near(x.x1, pA.x) && near(x.y1, pA.y));
      ok(nB && near(nB.x, pB.x + 5, 1e-6) && near(nB.y, pB.y + 3, 1e-6), 'B ist verschoben', nB);
      ok(sAB && near(sAB.x2, nB.x, 1e-9) && near(sAB.y2, nB.y, 1e-9), 'Strecke AB endet am neuen B', sAB);
      ok(mv.filter(x => x.type === 'point').length === 2 && !(await page.isVisible('#dialog')), 'Verschieben: kein neuer Punkt, kein Dialog');
      await page.click('#btnUndo');
      mv = await objs(page);
      ok(near(mv.find(x => x.label === 'B').x, pB.x) && mv.some(x => x.type === 'segment' && near(x.x2, pB.x) && near(x.y2, pB.y)), 'Rückgängig: B und Strecke wieder wie vorher');

      /* Lange drücken ohne Ziehen: öffnet den Punkt wie Antippen */
      await page.evaluate(([x, y]) => window.__ptr('pen', 42, 'down', x, y), [pB.x, pB.y]);
      await page.waitForTimeout(600);
      await page.evaluate(([x, y]) => window.__ptr('pen', 42, 'up', x, y), [pB.x, pB.y]);
      ok(await page.isVisible('#dialog') && near((await objs(page)).find(x => x.label === 'B').x, pB.x), 'Lange drücken ohne Ziehen öffnet B, ohne es zu verschieben');
      await page.keyboard.press('Escape');

      /* Lupe beim Setzen mit dem Finger (Finger zeichnet) */
      await page.evaluate(() => { window.__zw.S.penOnly = 'off'; });
      const nP = mv.filter(x => x.type === 'point').length;
      /* Freie Stelle suchen: kein Gerät, kein Objekt in der Nähe */
      const frei = await page.evaluate(() => {
        for (const [fx, fy] of [[0.25, 0.7], [0.75, 0.7], [0.5, 0.75], [0.3, 0.5], [0.7, 0.5]]) {
          const w = window.__zw.s2w(stageW * fx, stageH * fy);
          if (!hitInstBody(w, 'touch') && !hitCompass(w, 'touch') && !topObjectAt(window.__zw.doc.objects, w.x, w.y, 15)) return w;
        }
        return null;
      });
      await page.evaluate(w => window.__ptr('touch', 51, 'down', w.x, w.y), frei);
      for (let i = 1; i <= 4; i++) await page.evaluate(([w, i]) => window.__ptr('touch', 51, 'move', w.x + i, w.y + i), [frei, i]);
      await page.waitForTimeout(80);
      const lupe = await page.evaluate(w => {
        const s = window.__zw.w2s(w.x + 4, w.y + 4), cv = document.getElementById('cvOver'), d = Math.min(window.devicePixelRatio || 1, 3);
        const px = cv.getContext('2d').getImageData(Math.round(s.x * d), Math.round((s.y - 92 - 40) * d), 1, 1).data;
        return { a: px[3], kind: window.__zw.G && window.__zw.G.kind };
      }, frei);
      ok(frei && lupe.kind === 'point' && lupe.a > 0, 'Lupe erscheint über dem Finger', lupe);
      await page.evaluate(w => window.__ptr('touch', 51, 'up', w.x + 4, w.y + 4), frei);
      ok((await objs(page)).filter(x => x.type === 'point').length === nP + 1, 'Finger setzt den Punkt dort, wo er losgelassen wird');
      await page.click('#btnUndo');
      await page.evaluate(() => { window.__zw.S.penOnly = 'auto'; });
    }

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
    const strich = (await objs(page))[n - 1];
    await page.click('[data-tool="eraser"]');
    await stroke(page, 'pen', line([-75, 35], [-72, 50], 8));
    let er = await objs(page);
    ok(er.length === n + 1 && er[n - 1].id === strich.id && er[n].type === 'stroke', 'Radierer wischt ein Stück aus dem Strich: zwei Teile', er.slice(n - 1).map(x => x.type));
    await page.click('#btnUndo');
    er = await objs(page);
    ok(er.length === n && JSON.stringify(er[n - 1].pts) === JSON.stringify(strich.pts), 'Rückgängig setzt den Strich wieder zusammen');
    /* Antippen: nur der Punkt, nicht die Linien durch ihn */
    const vorTipp = await objs(page);
    const linien = vorTipp.filter(x => x.type === 'segment' || x.type === 'arc').length;
    await page.waitForTimeout(120);   // ausstehendes Neuzeichnen abwarten – sonst färbt es die Markierung zufällig mit ein
    await page.evaluate(([x, y]) => { window.__ptr('pen', 9, 'down', x, y); }, [A.x, A.y]);
    ok(await page.evaluate(() => { const g = window.__zw.G; return !!(g && g.kind === 'erase' && g.target && g.target.label === 'A'); }), 'Radierer: Antippen markiert den Punkt vor den Linien');
    await page.waitForTimeout(80);
    const rot = await page.evaluate(([x, y]) => {
      const s = window.__zw.w2s(x, y), d = Math.min(window.devicePixelRatio || 1, 3), cv = document.getElementById('cvOver');
      const k = window.__zw.sc(), r = 9;   // Ring um den Punkt, 9 Bildschirmpunkte
      const px = cv.getContext('2d').getImageData(Math.round((s.x + r) * d), Math.round(s.y * d), 1, 1).data;
      return Array.from(px);
    }, [A.x, A.y]);
    ok(rot[3] > 0 && rot[0] > 150 && rot[1] < 120, 'Rote Markierung sofort sichtbar, ohne Bewegung', rot);
    await page.evaluate(([x, y]) => { window.__ptr('pen', 9, 'up', x, y); }, [A.x, A.y]);
    er = await objs(page);
    ok(!er.some(x => x.label === 'A') && er.filter(x => x.type === 'segment' || x.type === 'arc').length === linien && er.length === vorTipp.length - 1, 'Antippen löscht genau den Punkt A');
    await page.click('#btnUndo');
    ok((await objs(page)).some(x => x.label === 'A'), 'Rückgängig holt A zurück');
    /* Bogen teilweise radieren: Beschreibung bleibt ein Schritt */
    await page.evaluate(() => addObjects([{ type: 'point', x: 150, y: 150, label: 'Z', ld: 7, c: '#3b3f45' },
      { type: 'arc', cx: 150, cy: 150, r: 30, a0: 0, sweep: Math.PI, c: '#3b3f45', w: 0.5, al: 1, m: { rs: { t: 'set' } } }]));
    const stepsVor = (await page.evaluate(() => window.__zw.steps())).length;
    n = (await objs(page)).length;
    await stroke(page, 'pen', line([150, 175], [150, 186], 6));
    er = await objs(page);
    const bogen = er.filter(x => x.type === 'arc' && x.cx === 150 && x.cy === 150);
    ok(er.length === n + 1 && bogen.length === 2, 'Bogen: Mitte herausradiert, zwei Teile', bogen);
    ok((await page.evaluate(() => window.__zw.steps())).length === stepsVor, 'Bogen-Teile bleiben ein Beschreibungsschritt');
    await page.click('#btnUndo'); await page.click('#btnUndo');
    ok((await objs(page)).length === n - 2, 'Rückgängig: Bogen ganz, dann Probeobjekte weg');

    /* ---------- Text ---------- */
    await page.click('[data-tool="text"]');
    await stroke(page, 'pen', [[-80, 60]]);
    ok(await page.isVisible('#dialog'), 'Textdialog öffnet');
    /* 0.10.1: Bildschirmtastatur (wie iOS: nur der sichtbare Ausschnitt schrumpft) */
    const kb = await page.evaluate(() => {
      const free = innerHeight - 420;
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => ({ height: free, offsetTop: 0, addEventListener() {} }) });
      fitToKeyboard();
      const card = document.querySelector('#dialog .card').getBoundingClientRect();
      const inp = document.getElementById('dialogInput').getBoundingClientRect();
      const r = { kb: document.body.classList.contains('kb'), cardBottom: card.bottom, inpBottom: inp.bottom, free };
      Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => ({ height: innerHeight, offsetTop: 0, addEventListener() {} }) });
      fitToKeyboard();
      r.after = document.body.classList.contains('kb');
      return r;
    });
    ok(kb.kb && kb.cardBottom <= kb.free + 1 && kb.inpBottom <= kb.free, 'Tastatur offen: Dialog samt Eingabefeld liegt darüber', kb);
    ok(!kb.after, 'Tastatur zu: Dialog wieder normal');
    await page.fill('#dialogInput', 'c = 5 cm');
    await page.keyboard.press('Enter');
    o = await objs(page);
    ok(o.some(x => x.type === 'text' && x.text === 'c = 5 cm'), 'Text eingefügt');
    /* 0.10.2: Text mit dem Text-Werkzeug verschieben */
    {
      const tx = o.find(x => x.type === 'text' && x.text === 'c = 5 cm');
      const nVor = o.length;
      await stroke(page, 'pen', line([tx.x + 3, tx.y - 2], [tx.x + 33, tx.y + 18], 8));
      let t2 = (await objs(page)).find(x => x.id === tx.id);
      ok(near(t2.x, tx.x + 30, 1e-6) && near(t2.y, tx.y + 20, 1e-6) && (await objs(page)).length === nVor, 'Text gezogen: neue Lage, kein neuer Text', t2);
      ok(!(await page.isVisible('#dialog')), 'Ziehen öffnet keinen Textdialog');
      await page.click('#btnUndo');
      t2 = (await objs(page)).find(x => x.id === tx.id);
      ok(near(t2.x, tx.x) && near(t2.y, tx.y), 'Rückgängig: Text wieder an alter Stelle');
      await stroke(page, 'pen', [[tx.x + 3, tx.y - 2]]);
      ok(await page.isVisible('#dialog') && (await page.inputValue('#dialogInput')) === 'c = 5 cm', 'Antippen öffnet den Text zum Bearbeiten');
      await page.keyboard.press('Escape');
    }

    /* ---------- 0.10.2: Bilder ---------- */
    {
      /* Testbilder im Browser malen: großes Foto (4000 × 3000) und PNG mit Transparenz */
      const mkImg = (w, h, type) => page.evaluate(([w, h, type]) => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d');
        if (type === 'image/jpeg') { x.fillStyle = '#f4f1e8'; x.fillRect(0, 0, w, h); }
        x.fillStyle = '#1f5fbf'; x.fillRect(w * 0.1, h * 0.1, w * 0.4, h * 0.8);
        x.fillStyle = '#c0392b'; x.beginPath(); x.arc(w * 0.75, h * 0.5, h * 0.3, 0, 7); x.fill();
        return c.toDataURL(type, 0.9).split(',')[1];
      }, [w, h, type]);
      const foto = Buffer.from(await mkImg(4000, 3000, 'image/jpeg'), 'base64');
      const nVor = (await objs(page)).length;
      await page.setInputFiles('#imageInput', { name: 'aufgabe.jpg', mimeType: 'image/jpeg', buffer: foto });
      await page.waitForFunction(n => window.__zw.doc.objects.length === n + 1, nVor, { timeout: 8000 }).catch(() => {});
      let im = (await objs(page)).find(x => x.type === 'image');
      ok(im && im.src.startsWith('data:image/jpeg;base64,') && im.pw === 1600 && im.ph === 1200, 'Foto eingefügt, auf 1600 px verkleinert', im && [im.pw, im.ph, im.src.length]);
      ok(im && Math.abs(im.w / im.h - 4 / 3) < 1e-6 && im.cr.join() === '0,0,1,1', 'Seitenverhältnis bleibt, ganzer Ausschnitt');
      ok(await page.isVisible('#imgBar') && (await page.textContent('#toast')).includes('Ecken ziehen'), 'Nach dem Einfügen: Bearbeitungsleiste und Hinweis');
      // Verschieben (innen)
      await page.waitForTimeout(150);
      const cx = im.x + im.w / 2, cy = im.y + im.h / 2;
      await stroke(page, 'pen', line([cx, cy], [cx + 10, cy + 5], 6));
      let im2 = (await objs(page)).find(x => x.id === im.id);
      ok(near(im2.x, im.x + 10, 1e-6) && near(im2.y, im.y + 5, 1e-6) && (await objs(page)).length === nVor + 1, 'Bild innen ziehen: verschoben, nichts gezeichnet');
      // Ecke unten rechts: größer, Verhältnis bleibt, Ecke oben links fest
      await stroke(page, 'pen', line([im2.x + im2.w, im2.y + im2.h], [im2.x + im2.w * 1.5, im2.y + im2.h * 1.2], 8));
      let im3 = (await objs(page)).find(x => x.id === im.id);
      ok(near(im3.x, im2.x, 1e-6) && near(im3.y, im2.y, 1e-6) && near(im3.w, im2.w * 1.5, 1e-6) && near(im3.h, im2.h * 1.5, 1e-6), 'Ecke ziehen: größer, Seitenverhältnis und gegenüberliegende Ecke bleiben', [im2.w, im3.w, im3.h / im2.h]);
      // Kante rechts nach links: zuschneiden
      await stroke(page, 'pen', line([im3.x + im3.w, im3.y + im3.h / 2], [im3.x + im3.w * 0.6, im3.y + im3.h / 2], 6));
      let im4 = (await objs(page)).find(x => x.id === im.id);
      ok(near(im4.cr[2], 0.6, 1e-6) && near(im4.w, im3.w, 1e-9) && im4.cr[0] === 0, 'Kante ziehen: rechts auf 60 % zugeschnitten', im4.cr);
      await page.click('#btnUndo');
      ok((await objs(page)).find(x => x.id === im.id).cr[2] === 1, 'Rückgängig: Zuschnitt zurück');
      await page.click('#btnRedo');
      // Blass
      await page.click('#imgFade');
      ok((await objs(page)).find(x => x.id === im.id).al === 0.45 && await page.evaluate(() => document.getElementById('imgFade').classList.contains('on')), '„Blass" macht das Bild durchscheinend');
      // Fertig, dann darüber zeichnen
      await page.click('#imgBar >> text=Fertig');
      ok(!(await page.isVisible('#imgBar')), '„Fertig" heftet das Bild fest');
      await page.click('[data-tool="pencil"]');
      const nStr = (await objs(page)).length;
      await stroke(page, 'pen', line([cx - 5, cy - 5], [cx + 5, cy - 3], 6));
      let after = await objs(page);
      ok(after.length === nStr + 1 && after.find(x => x.id === im.id).x === im4.x, 'Auf dem festgehefteten Bild wird gezeichnet, das Bild bleibt liegen');
      ok(await page.evaluate(() => { const id = window.__zw.doc.objects.find(o => o.type === 'image').id; return !window.__zw.steps().some(st => st.ids.includes(id)); }), 'Bild ist kein Konstruktionsschritt');
      await page.click('#btnUndo');
      // Radierer: Wischen lässt das Bild liegen, Antippen (ohne Linie in der Nähe) löscht es.
      // Der Wisch radiert absichtlich auch durch die Konstruktion darunter – alle späteren
      // Beschreibungsprüfungen müssen trotzdem bestehen (Teilstücke = ein Schritt).
      await page.click('[data-tool="eraser"]');
      const r4 = { x0: im4.x, y0: im4.y, x1: im4.x + im4.w * 0.6, y1: im4.y + im4.h };
      await stroke(page, 'pen', line([r4.x0 + 2, r4.y0 + 2], [r4.x1 - 2, r4.y1 - 2], 12));
      ok((await objs(page)).some(x => x.id === im.id) && (await objs(page)).find(x => x.id === im.id).al === 0.45, 'Radierer wischt über das Bild: Bild bleibt unverändert');
      // Hand: Antippen wählt das Bild wieder aus
      await page.click('[data-tool="hand"]');
      const free = await page.evaluate(([a, b]) => { for (let y = a.y0 + 3; y < a.y1; y += 3) for (let x = a.x0 + 3; x < a.x1; x += 3) { if (!topObjectAt(window.__zw.doc.objects.filter(o => o.type !== 'image'), x, y, 12)) return { x, y }; } return null; }, [r4, null]);
      await stroke(page, 'touch', [[free.x, free.y]], 61);
      ok(await page.isVisible('#imgBar'), 'Hand antippen: Bild wieder in Bearbeitung');
      await stroke(page, 'touch', [[r4.x1 + 40, r4.y1 + 40]], 62);
      ok(!(await page.isVisible('#imgBar')), 'Tipp daneben beendet die Bearbeitung');
      await page.click('[data-tool="eraser"]');
      await stroke(page, 'pen', [[free.x, free.y]]);
      ok(!(await objs(page)).some(x => x.id === im.id), 'Radierer antippen: Bild gelöscht');
      await page.click('#btnUndo');
      ok((await objs(page)).some(x => x.id === im.id), 'Rückgängig: Bild wieder da');
      // PNG mit Transparenz → JPEG mit weißem Grund
      const png = Buffer.from(await mkImg(300, 200, 'image/png'), 'base64');
      await page.setInputFiles('#imageInput', { name: 'logo.png', mimeType: 'image/png', buffer: png });
      await page.waitForFunction(() => window.__zw.doc.objects.filter(o => o.type === 'image').length === 2, null, { timeout: 8000 }).catch(() => {});
      const pngObj = (await objs(page)).filter(x => x.type === 'image')[1];
      ok(pngObj && pngObj.src.startsWith('data:image/jpeg') && pngObj.pw === 300, 'PNG als JPEG gespeichert (Originalgröße, da klein)');
      const corner = await page.evaluate(src => new Promise(res => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = 4; c.height = 4; const x = c.getContext('2d'); x.drawImage(i, 0, 0); res(Array.from(x.getImageData(0, 0, 1, 1).data)); }; i.src = src; }), pngObj.src);
      ok(corner[0] > 240 && corner[1] > 240 && corner[2] > 240, 'Transparenz wird weiß wie Papier', corner);
      await page.click('#imgBar >> text=Löschen');
      ok((await objs(page)).filter(x => x.type === 'image').length === 1 && !(await page.isVisible('#imgBar')), '„Löschen" in der Leiste entfernt das Bild');
      // Kaputte Datei
      await page.setInputFiles('#imageInput', { name: 'kaputt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('kein Bild') });
      await page.waitForTimeout(300);
      ok((await page.textContent('#toast')).includes('nicht öffnen'), 'Kaputtes Bild: verständliche Meldung');
      await page.click('[data-tool="pencil"]');
    }

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

    /* ---------- 0.10.2: Ordner ---------- */
    const sheetCount = async n => { await page.waitForFunction(n => document.querySelectorAll('.sheet').length === n, n, { timeout: 3000 }).catch(() => {}); return page.locator('.sheet').count(); };
    {
      await page.click('#btnSheets');
      ok(!(await page.isVisible('#folderBar')), 'Ohne Ordner keine Ordnerleiste');
      await page.locator('.sheet', { hasText: 'Blatt 2' }).locator('.more').click();
      await page.click('#dialogButtons .btn >> text=In Ordner');
      await page.click('#dialogButtons .btn >> text=Neuer Ordner');
      await page.fill('#dialogInput', '  Klasse 7a ');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => !document.getElementById('folderBar').hidden, null, { timeout: 3000 }).catch(() => {});
      ok((await page.textContent('#folderBar')).includes('Klasse 7a'), 'Ordner angelegt, Leiste erscheint');
      ok((await page.locator('.sheet', { hasText: 'Blatt 2' }).textContent()).includes('Klasse 7a'), 'Blatt zeigt seinen Ordner');
      await page.click('#folderBar .btn >> text=Klasse 7a');
      ok(await sheetCount(1) === 1, 'Filter: nur das Blatt im Ordner', await page.locator('.sheet .name').allTextContents());
      await page.click('text=Neues Blatt');
      await page.waitForTimeout(150);
      ok(await page.evaluate(() => window.__zw.doc.folder) === 'Klasse 7a', 'Neues Blatt landet im gewählten Ordner');
      await page.click('#btnSheets');
      ok(await sheetCount(2) === 2, 'Ordnerfilter bleibt beim Wiederöffnen');
      await page.click('#folderBar .btn >> text=⋯');
      await page.click('#dialogButtons .btn >> text=Ordner umbenennen');
      await page.fill('#dialogInput', '7a Geometrie');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      ok((await page.textContent('#folderBar')).includes('7a Geometrie') && !(await page.textContent('#folderBar')).includes('Klasse 7a') && await page.locator('.sheet').count() === 2, 'Ordner umbenannt, Filter folgt');
      ok(await page.evaluate(() => window.__zw.doc.folder) === '7a Geometrie', 'Offenes Blatt kennt den neuen Ordnernamen');
      await page.click('#folderBar .btn >> text=Alle');
      ok(await sheetCount(4) === 4, '„Alle" zeigt wieder alle Blätter');
    }

    /* ---------- 0.10.2: Sicherung und Wiederherstellen ---------- */
    {
      ok((await page.textContent('#backupInfo')).includes('Noch keine Sicherung') && await page.evaluate(() => document.getElementById('backupInfo').classList.contains('due')), 'Hinweis: noch nie gesichert (rot)');
      await page.click('#btnBackup');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#dialogButtons .btn >> text=Alle Blätter sichern')]);
      ok(/^Zirkelwerk-Sicherung-\d{4}-\d{2}-\d{2}\.zirkelwerk$/.test(dl.suggestedFilename()), 'Sicherungsdatei mit Datum im Namen', dl.suggestedFilename());
      const bpath = path.join(tmp, 'sicherung.zirkelwerk');
      await dl.saveAs(bpath);
      const bj = JSON.parse(fs.readFileSync(bpath, 'utf8'));
      ok(bj.format === 'zirkelwerk-backup' && bj.docs.length === 4 && bj.docs.filter(d => d.folder === '7a Geometrie').length === 2 && bj.docs.every(d => !d.thumb), 'Sicherung enthält alle Blätter mit Ordnern, ohne Vorschaubilder', bj.docs.length);
      await page.waitForTimeout(100);
      ok((await page.textContent('#backupInfo')).startsWith('Letzte Sicherung') && !(await page.evaluate(() => document.getElementById('backupInfo').classList.contains('due'))), 'Datum der letzten Sicherung angezeigt');
      // Blatt 2 löschen, dann wiederherstellen
      await page.locator('.sheet', { hasText: 'Blatt 2' }).locator('.more').click();
      await page.click('#dialogButtons .btn >> text=Löschen');
      await page.click('#dialogButtons .btn.danger >> text=Löschen');
      await page.waitForTimeout(150);
      ok(await sheetCount(3) === 3, 'Blatt 2 gelöscht');
      await page.setInputFiles('#importInput', bpath);
      await page.waitForFunction(() => document.getElementById('dialogTitle').textContent === 'Sicherung wiederherstellen', null, { timeout: 3000 }).catch(() => {});
      ok((await page.textContent('#dialogMessage')).startsWith('Neu dazu – Blätter: 1') && (await page.textContent('#dialogMessage')).includes('Schon vorhanden: 3'), 'Rückfrage nennt, was dazukommt', await page.textContent('#dialogMessage'));
      await page.click('#dialogButtons .btn >> text=Wiederherstellen');
      await page.waitForTimeout(200);
      ok(await sheetCount(4) === 4 && (await page.locator('.sheet', { hasText: 'Blatt 2' }).textContent()).includes('7a Geometrie'), 'Blatt 2 samt Ordner wiederhergestellt');
      await page.evaluate(() => { document.getElementById('importInput').value = ''; });   // wie importSheet()
      await page.setInputFiles('#importInput', bpath);
      await page.waitForTimeout(200);
      ok((await page.textContent('#toast')).includes('schon da') && await page.locator('.sheet').count() === 4, 'Zweites Wiederherstellen: nichts doppelt', [await page.textContent('#toast'), await page.locator('.sheet .name').allTextContents(), await page.isVisible('#dialog') && await page.textContent('#dialogMessage')]);
      await page.click('#sheetsPanel header .tb');
    }


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
    {
      /* Leiste einzeilig auf dem iPad und mittig im Zeichenbereich (früher halbe Breite, Umbruch) */
      /* Neben der offenen Konstruktionsleiste: mittig im freien Bereich, Text nicht gequetscht */
      const tb = await page.evaluate(() => { const bar = document.getElementById('taskBar'), b = bar.getBoundingClientRect(), t = document.getElementById('taskText'), p = bar.offsetParent.getBoundingClientRect();
        const pw = protoOpen() ? document.getElementById('protoPanel').offsetWidth : 0, right = S.toolbarSide === 'right';
        return { text: t.getBoundingClientRect().width, l: b.left - p.left - (right ? pw : 0), r: p.right - b.right - (right ? 0 : pw) }; });
      ok(tb.text > 300 && Math.abs(tb.l - tb.r) < 2, 'Aufgabenleiste breit genug und mittig im freien Bereich', tb);
    }
    ok((await objs(page)).every(o => o.m && o.m.plan), 'Aufgabenblatt enthält nur die Planfigur');
    await page.click('#taskBar .btn');
    ok((await page.textContent('#dialogTitle')) === 'Noch nicht ganz' && (await page.textContent('#dialogMessage')).includes('Beschrifte die Eckpunkte mit A, B und C.'), 'Prüfen ohne Konstruktion: Hinweis auf Beschriftung');
    await page.click('#dialogButtons .btn.primary');
    /* Gestufte Hilfe auf leerem Blatt */
    await page.click('#btnHint');
    ok((await page.textContent('#dialogTitle')) === 'Hilfe – Stufe 1 von 4' && (await page.textContent('#dialogMessage')).startsWith('Zeichne zuerst die Seite c.'), 'Hilfe Stufe 1: Denkanstoß');
    await page.click('#dialogButtons .btn.primary');
    ok((await page.textContent('#dialogTitle')) === 'Hilfe – Stufe 2 von 4' && /^Dein nächster Schritt: Zeichne die Strecke AB/.test(await page.textContent('#dialogMessage')), 'Hilfe Stufe 2: nächster Schritt in Worten', await page.textContent('#dialogMessage'));
    await page.click('#dialogButtons .btn.primary');
    ok((await page.textContent('#dialogTitle')) === 'Hilfe – Stufe 4 von 4', 'Ohne A und B nichts einzuzeichnen → gleich Stufe 4');
    await page.click('#dialogButtons .btn:not(.primary)');
    ok(await page.evaluate(() => window.__zw.doc.help === 4), 'Genutzte Hilfestufe im Blatt vermerkt');
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
    /* Nach AB: Hilfe beginnt wieder bei Stufe 1, Stufe 3 zeichnet den Bogen um A gestrichelt ein */
    await page.click('#btnHint');
    ok((await page.textContent('#dialogTitle')) === 'Hilfe – Stufe 1 von 4', 'Hilfe: neuer Schritt → wieder Stufe 1');
    await page.click('#dialogButtons .btn.primary');
    ok(/Kreisbogen um A mit dem Radius r = 4 cm/.test(await page.textContent('#dialogMessage')), 'Hilfe Stufe 2 nennt den Bogen um A', await page.textContent('#dialogMessage'));
    await page.click('#dialogButtons .btn.primary');
    const gh = await page.evaluate(() => hintGhost && hintGhost.objs.map(o => [o.type, Math.round(o.r || 0)]));
    ok(gh && gh.length === 1 && gh[0][0] === 'arc' && gh[0][1] === 40, 'Hilfe Stufe 3: Bogen um A gestrichelt eingezeichnet', gh);
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
    ok(await page.evaluate(() => hintGhost === null), 'Geisterbild verschwindet beim Weiterzeichnen');
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
      /* 0.10.2: Blatt 1 mit Bild → Bild im PDF, von echten Werkzeugen lesbar */
      await page.locator('.sheet', { hasText: 'Blatt 1' }).locator('.more').click();
      await page.click('#dialogButtons .btn >> text=Als PDF');
      await page.waitForFunction(() => document.getElementById('dialogTitle').textContent === 'Als PDF (A4)', null, { timeout: 3000 });
      const w4 = await grab();
      ok((w4.pdf.match(/\/Subtype \/Image \/Width 1600 \/Height 1200/g) || []).length === 1 && / re W n [\d. ]+ 0 0 [\d. ]+ cm \/Im1 Do Q/.test(w4.pdf), 'PDF von Blatt 1 enthält das Bild (zugeschnitten)');
      if (cp.spawnSync('sh', ['-c', 'command -v pdfimages']).status === 0) {
        const q = cp.spawnSync('qpdf', ['--check', w4.file], { encoding: 'utf8' });
        ok(q.status === 0 && !/WARNING/.test(q.stdout + q.stderr), 'PDF mit Bild besteht qpdf --check', q.stdout + q.stderr);
        const li = cp.spawnSync('pdfimages', ['-list', w4.file], { encoding: 'utf8' }).stdout;
        ok(/\b1600\s+1200\s+rgb\s+3\s+8\s+jpeg\b/.test(li), 'pdfimages liest das Foto aus dem App-PDF', li);
      }
      await page.click('#sheetsPanel header .tb');
    }
    await page.click('#taskBar [data-icon="more"]');
    await page.click('#dialogButtons .btn.danger');
    ok(!(await page.isVisible('#taskBar')) && !(await page.evaluate(() => window.__zw.doc.task)), 'Aufgabe entfernt');
    /* ---------- Grundkonstruktionen im Labor ---------- */
    {
      await page.click('#btnLab');
      await page.click('#labMode_geo');
      ok(await page.isVisible('#labGeo') && !(await page.isVisible('#labTri')) && (await page.locator('#labGeoKinds .btn').count()) === 8, 'Labor: acht Grundkonstruktionen');
      await page.click('#labGeo_msk');
      ok((await page.textContent('#labGeoTask')) === 'Konstruiere die Mittelsenkrechte der Strecke AB.', 'Labor: Aufgabe Mittelsenkrechte');
      ok(await page.evaluate(() => { const c = document.getElementById('labPreview'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 120) dark++; return c.width > 100 && dark > 20; }), 'Labor: Vorschau zeigt die Ausgangsfigur');
      await page.click('#btnLabSelf');
      await page.waitForFunction(() => window.__zw.doc.task && window.__zw.doc.task.kind === 'msk', null, { timeout: 5000 });
      ok((await page.textContent('#taskText')) === 'Konstruiere die Mittelsenkrechte der Strecke AB.' && (await objs(page)).every(o => o.m && o.m.giv), 'Aufgabenblatt Mittelsenkrechte mit Ausgangsfigur');
      await page.click('#taskBar .btn.primary');
      ok((await page.textContent('#dialogMessage')).includes('Es fehlt noch die Mittelsenkrechte.'), 'Prüfen: Mittelsenkrechte fehlt');
      await page.click('#dialogButtons .btn.primary');
      await page.click('#btnHint'); await page.click('#dialogButtons .btn.primary');
      ok(/Kreisbogen um A/.test(await page.textContent('#dialogMessage')), 'Hilfe Stufe 2: Bogen um A', await page.textContent('#dialogMessage'));
      await page.click('#dialogButtons .btn.primary');
      ok(await page.evaluate(() => hintGhost && hintGhost.objs[0].type === 'arc'), 'Hilfe Stufe 3: Bogen um A eingezeichnet');
      /* Schüler zeichnet die Musterlösung (direkt eingefügt) */
      await page.evaluate(() => {
        const t = window.__zw.doc.task, sol = geoSolution(t.kind, t.given);
        sol.forEach((o, i) => window.__zw.doc.objects.push(Object.assign({ id: 'z' + i }, o, { m: Object.assign({}, o.m, { say: undefined }) })));
        contentChanged();
      });
      await page.click('#taskBar .btn.primary');
      ok((await page.textContent('#dialogTitle')) === '✓ Richtig!' && (await page.textContent('#dialogMessage')).includes('Deine Konstruktion ist richtig.'), 'Mittelsenkrechte als richtig erkannt', await page.textContent('#dialogMessage'));
      /* Rückmeldung an die Lehrkraft */
      await page.click('#dialogButtons .btn >> text=Rückmeldung (QR)');
      ok((await page.textContent('#dialogTitle')) === 'Rückmeldung an die Lehrkraft', 'Rückmeldung fragt nach Name oder Kürzel');
      await page.fill('#dialogInput', 'Mia'); await page.click('#dialogButtons .btn.primary');
      await page.waitForSelector('#qrPanel:not([hidden])');
      const rlink = await page.getAttribute('#qrCanvas', 'data-link');
      ok((await page.textContent('#qrTitle')) === 'Rückmeldung' && rlink.startsWith('zirkelwerk://r?v=1&d=') && (await page.textContent('#qrText')).startsWith('Mia · ✓'), 'Rückmeldungs-Code mit Name und Ergebnis', rlink.length);
      await page.click('#qrPanel header .tb');
      /* Lehrkraft scannt zwei Abgaben */
      await page.evaluate(l => window.handleOpenURL(l), rlink);
      await page.waitForSelector('#resultsPanel:not([hidden])', { timeout: 5000 });
      ok((await page.textContent('.res-sum')) === '1 Abgabe · 1 richtig', 'Abgaben: erste Rückmeldung gesammelt', await page.textContent('.res-sum'));
      const bad = await page.evaluate(() => { const t = window.__zw.doc.task; return linkForResult({ task: t, name: 'Ben', ok: false, help: 3, codes: ['radii', 'g_offset'], objects: [] }, false); });
      await page.evaluate(l => window.handleOpenURL(l), bad);
      await page.waitForTimeout(300);
      ok((await page.textContent('.res-sum')) === '2 Abgaben · 1 richtig' && (await page.textContent('.res-top')).includes('Bögen ungleich') && (await page.locator('.res-row').count()) === 2, 'Abgaben: Auswertung mit häufigstem Fehler', await page.textContent('#resultsBody'));
      await page.evaluate(l => window.handleOpenURL(l), bad);
      await page.waitForFunction(() => document.getElementById('dialogTitle').textContent === 'Abgabe schon vorhanden' && !document.getElementById('dialog').hidden, null, { timeout: 5000 });
      ok((await page.textContent('#dialogMessage')).includes('„Ben“'), 'Abgaben: gleicher Name – Rückfrage statt still ersetzen');
      await page.click('#dialogButtons .btn >> text=Ersetzen');
      await page.waitForTimeout(300);
      ok((await page.locator('.res-row').count()) === 2 && (await page.textContent('#toast')).includes('aktualisiert'), 'Abgaben: zweites Scannen derselben Person ersetzt');
      await page.evaluate(l => window.handleOpenURL(l), bad);
      await page.waitForFunction(() => !document.getElementById('dialog').hidden, null, { timeout: 5000 });
      await page.click('#dialogButtons .btn >> text=Beide behalten');
      await page.waitForTimeout(300);
      ok((await page.locator('.res-row').count()) === 3, 'Abgaben: „Beide behalten“ legt eine weitere Abgabe an');
      await page.click('.res-row:has-text("Mia") .btn');
      await page.waitForFunction(() => window.__zw.doc.name === 'Abgabe: Mia', null, { timeout: 5000 });
      ok(await page.evaluate(() => checkTask(window.__zw.doc.task, window.__zw.doc.objects).ok), 'Abgabe ansehen: Zeichnung samt Aufgabe, nachprüfbar');
      await page.click('#btnSheets'); await page.click('#btnResults');
      ok(await page.isVisible('#resultsPanel') && (await page.locator('.res-group').count()) === 1, 'Abgaben über „Meine Blätter“ erreichbar');
      await page.click('#resultsPanel header .tb');
      /* Vorführen: Umkreis */
      await page.click('#btnLab'); await page.click('#labGeo_umk');
      await page.click('#btnLabDemo');
      await page.waitForFunction(() => window.__zw.PB.on, null, { timeout: 5000 });
      const st = await page.evaluate(() => window.__zw.PB.steps.map(s => s.text));
      ok(st[0] === 'Gegeben ist die Ausgangsfigur.' && st.some(x => x.startsWith('Konstruiere die Mittelsenkrechte von AB')) && /Kreis um M/.test(st[st.length - 1]), 'Vorführen Umkreis: Schritte in Schulsprache', st);
      await page.keyboard.press('Escape');
      await page.click('#btnLab'); await page.click('#labMode_tri'); await page.click('#labPanel header .tb');
    }
    /* ---------- Rechtstexte im App-Fenster, Blattliste ---------- */
    {
      await page.click('[aria-label="Hilfe und Über"]');
      const before = page.url();
      await page.click('#helpPanel .help-about .btn >> text=Datenschutz');
      await page.waitForSelector('#legalPanel:not([hidden])', { timeout: 5000 });
      ok(page.url() === before && (await page.textContent('#legalTitle')) === 'Datenschutz' && (await page.textContent('#legalBody')).includes('QR-Code') && !(await page.textContent('#legalBody')).includes('Zurück zur App'), 'Datenschutz im App-Fenster, ohne Seitenwechsel');
      await page.click('#legalPanel header .tb');
      if (await page.isVisible('#helpPanel')) await page.click('#helpPanel header .tb');
      ok(!(await page.isVisible('#saveWarn')), 'Kein Speicher-Warnhinweis im Normalbetrieb');
      /* Aktuelles Blatt in der Liste antippen: Rückgängig bleibt möglich */
      await page.click('[data-tool="pencil"]');
      await stroke(page, 'pen', [[10, 10], [30, 12], [50, 10]]);
      await page.click('#btnSheets');
      await page.click('.sheet.current button:not(.more)');
      ok(!(await page.isVisible('#sheetsPanel')) && !(await page.isDisabled('#btnUndo')), 'Aktuelles Blatt antippen lädt nicht neu (Rückgängig bleibt)');
      await page.click('#btnUndo');
    }
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
      await page.click('#taskBar [data-icon="more"]');
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
    /* ---------- Wiedergabe als Video ---------- */
    {
      await page.evaluate(() => createLabSheet('sws', { c: 50, b: 40, alpha: 60 }, 'demo'));
      await page.waitForFunction(() => window.__zw.doc.name.startsWith('SWS'), null, { timeout: 5000 });
      if (!(await page.isVisible('#protoPanel'))) await page.click('#btnProto');
      await page.click('#btnVideo');
      ok((await page.textContent('#dialogTitle')) === 'Konstruktion als Video', 'Video: Dialog mit Tempowahl');
      const t0 = Date.now();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#dialogButtons .btn.primary')]);
      const buf = require('fs').readFileSync(await dl.path());
      ok(/\.(webm|mp4)$/.test(dl.suggestedFilename()) && buf.length > 20000 && (buf.slice(0, 4).toString('hex') === '1a45dfa3' || buf.slice(4, 8).toString() === 'ftyp'), 'Video aufgenommen (' + dl.suggestedFilename() + ', ' + Math.round(buf.length / 1024) + ' KB, ' + Math.round((Date.now() - t0) / 1000) + ' s)');
      ok(!(await page.evaluate(() => window.__zw.PB.on)) && await page.isHidden('#recOverlay') && await page.isVisible('#protoPanel'), 'Nach der Aufnahme: Wiedergabe beendet, Leiste wieder da');
      /* Abbrechen */
      await page.click('#btnVideo'); await page.click('#dialogButtons .btn.primary');
      await page.waitForSelector('#recOverlay:not([hidden])');
      let got = false; page.once('download', () => { got = true; });
      await page.click('#recOverlay .btn');
      await page.waitForTimeout(1200);
      ok(!got && await page.isHidden('#recOverlay') && !(await page.evaluate(() => window.__zw.PB.on)), 'Aufnahme abbrechen: keine Datei, alles zurück');
    }
    /* ---------- Körper und Netze ---------- */
    {
      await page.click('#btnLab');
      await page.click('#labMode_body');
      ok(await page.isVisible('#labBody') && !(await page.isVisible('#btnLabDemo')) && await page.isVisible('#btnBodyNet'), 'Labor: Bereich Körper & Netze');
      await page.click('#bodyKind_cuboid');
      ok((await page.inputValue('#bodyIn_a')) === '5' && (await page.inputValue('#bodyIn_b')) === '3', 'Körper: Vorgaben in cm');
      await page.fill('#bodyIn_a', '4,5');
      await page.click('.body-vo summary');
      ok((await page.textContent('#bodyVO')) === 'V ≈ 27,0 cm³ · O ≈ 57,0 cm²', 'Quader 4,5 × 3 × 2: V und O', await page.textContent('#bodyVO'));
      const ink = await page.evaluate(() => { const c = document.getElementById('bodyView'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200) n++; return n; });
      ok(ink > 500, 'Körper-Vorschau gezeichnet', ink);
      await page.fill('#bodyIn_a', '0');
      ok(await page.isDisabled('#btnBodyNet') && (await page.textContent('#bodyStatus')).includes('0,5 bis 20'), 'Körper: ungültige Maße gesperrt');
      await page.fill('#bodyIn_a', '4,5');
      await page.click('#btnBodyNet');
      await page.waitForFunction(() => window.__zw.doc.name.startsWith('Netz Quader'), null, { timeout: 5000 });
      const no = await objs(page);
      ok(no.filter(o => o.type === 'segment' && o.d === 1).length >= 5 && no.some(o => o.type === 'text'), 'Netz aufs Blatt mit Faltlinien und Hinweis', no.length);
      ok(await page.evaluate(() => { const o = window.__zw.doc.objects; const bt = boundsOf(o.filter(x => x.type === 'text')), bn = boundsOf(o.filter(x => x.type !== 'text')); return bt.x1 <= bn.x1 + 1; }), 'Netz: Hinweis nicht breiter als das Netz (sonst würde das PDF verkleinert)');
      await page.click('#btnLab');
      await page.click('#bodyKind_cylinder');
      ok(!(await page.isDisabled('#bodyFold')) && !(await page.isVisible('#bodyStatus')), 'Zylinder lässt sich jetzt falten (Mantel in Streifen)');
      await page.click('#btnBodyPdf');
      await page.waitForSelector('#pdfOpt_grid', { timeout: 5000 });
      ok(await page.isVisible('#pdfOpt_grid') && (await page.evaluate(() => window.__zw.doc.objects.filter(o => o.type === 'arc').length)) === 2, 'Netz als PDF: Blatt angelegt, PDF-Dialog offen');
      await page.click('#dialogButtons .btn >> text=Abbrechen');
      /* ---------- 0.10.2: weitere Körper, Würfelnetze, Quiz, Großansicht ---------- */
      await page.click('#btnLab');
      const inkOf = id => page.evaluate(id => { const c = document.getElementById(id); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 2] < 200) n++; return n; }, id);
      for (const k of ['prismn', 'pyramidrect', 'pyramidn', 'tetra', 'octa', 'cone', 'sphere']) {
        await page.click('#bodyKind_' + k);
        await page.evaluate(() => { bodyState.fold = 0.5; bodyDraw(); });
        const vo = await page.textContent('#bodyVO');
        ok((await inkOf('bodyView')) > 300 && /^V ≈ [\d,]+ cm³ · O ≈ [\d,]+ cm²$/.test(vo) && !(await page.isDisabled('#btnBodyNet')), 'Körper ' + k + ': halb gefaltet gezeichnet, V und O', vo);
      }
      ok((await page.textContent('#bodyStatus')).includes('nicht abwickeln') && await page.isVisible('#bodyStatus'), 'Kugel: Hinweis, dass das Netz angenähert ist');
      await page.click('#bodyKind_prismn');
      ok((await page.inputValue('#bodyIn_n')) === '6' && (await page.getAttribute('#bodyIn_n', 'inputmode')) === 'numeric', 'Eckenzahl n als ganze Zahl, Vorgabe 6');
      await page.fill('#bodyIn_n', '9');
      ok(await page.isDisabled('#btnBodyNet') && (await page.textContent('#bodyStatus')).includes('3–8'), 'n = 9 abgelehnt');
      await page.fill('#bodyIn_n', '5');
      await page.click('#btnBodyNet');
      await page.waitForFunction(() => window.__zw.doc.name.startsWith('Netz Prisma (n-Eck)'), null, { timeout: 5000 });
      ok((await page.evaluate(() => window.__zw.doc.name)).includes('n = 5') && (await objs(page)).filter(o => o.type === 'segment' && o.d === 1).length >= 6, 'Fünfeckprisma als Netz aufs Blatt', await page.evaluate(() => window.__zw.doc.name));
      await page.click('#btnLab');
      await page.click('#bodyKind_cone');
      await page.click('#btnBodyNet');
      await page.waitForFunction(() => window.__zw.doc.name.startsWith('Netz Kegel'), null, { timeout: 5000 });
      ok((await objs(page)).filter(o => o.type === 'arc').length === 2, 'Kegelnetz: Kreisausschnitt und Grundkreis');
      await page.click('#btnLab');
      await page.click('#bodyKind_sphere');
      await page.click('#btnBodyNet');
      await page.waitForFunction(() => window.__zw.doc.name.startsWith('Netz Kugel'), null, { timeout: 5000 });
      ok((await objs(page)).some(o => o.type === 'text' && o.text.startsWith('Angenähert')), 'Kugelnetz: Hinweis „Angenähert" auf dem Blatt');
      // Würfelnetze
      await page.click('#btnLab');
      await page.click('#bodyKind_cube');
      ok(await page.isVisible('#bodyNetPick') && (await page.locator('#bodyNetBtns .btn').count()) === 11, 'Würfel: elf Netze zur Auswahl');
      await page.click('#bodyNet_4');
      await page.waitForFunction(() => bodyState.fold > 0.999, null, { timeout: 6000 });
      ok(await page.evaluate(() => bodyState.variant === 4 && document.getElementById('bodyNet_4').classList.contains('sel')), 'Netz 5 gewählt und zum Würfel gefaltet');
      await page.click('#btnBodyNet');
      await page.waitForFunction(() => window.__zw.doc.name.startsWith('Netz Würfel'), null, { timeout: 5000 });
      ok((await page.evaluate(() => window.__zw.doc.name)).includes('Würfelnetz 5') && (await objs(page)).filter(o => o.type === 'segment' && o.d === 1).length === 5 + 7, 'Netz 5 aufs Blatt: 5 Faltkanten + 7 Laschenkanten', (await objs(page)).filter(o => o.type === 'segment' && o.d === 1).length);
      // Quiz
      await page.click('#btnLab');
      await page.click('#btnCubeQuiz');
      ok(await page.isVisible('#bodyQuiz') && !(await page.isVisible('#bodyNetPick')) && (await page.textContent('#bodyQuizText')) === 'Ist das ein Würfelnetz?', 'Quiz: Frage gestellt, Netzauswahl ausgeblendet');
      ok(await page.evaluate(() => bodyState.fold === 0), 'Quiz: Netz liegt flach');
      for (let round = 0; round < 6; round++) {
        const isNet = await page.evaluate(() => bodyState.quiz.isNet);
        const right = round % 3 !== 2;   /* jede dritte Antwort absichtlich falsch */
        await page.click('#bodyQuizBtns .btn >> text=' + ((isNet === right) ? 'Ja' : 'Nein'));
        const txt = await page.textContent('#bodyQuizText');
        ok(txt.startsWith(right ? 'Richtig!' : 'Nicht ganz.') && txt.includes(isNet ? 'Es ist ein Würfelnetz' : 'Kein Würfelnetz'), 'Quiz Runde ' + (round + 1) + ': Bewertung und Erklärung', txt);
        await page.waitForFunction(() => bodyState.fold > 0.999, null, { timeout: 6000 });
        const sc = await page.evaluate(() => { const s = bodyScene(); return { ghosts: s.info.ghosts.length, red: s.info.overlap.filter(Boolean).length }; });
        ok(isNet ? sc.ghosts === 0 && sc.red === 0 : sc.ghosts >= 1 && sc.red >= 2, 'Quiz Runde ' + (round + 1) + ': ' + (isNet ? 'geschlossen' : 'Doppelte rot, offene Seiten gestrichelt'), sc);
        await page.click('#bodyQuizBtns .btn >> text=Nächstes');
      }
      ok((await page.evaluate(() => bodyState.quiz.ok + '/' + bodyState.quiz.n)) === '4/6', 'Quiz zählt richtig (4 von 6)');
      /* Alle 24 Nicht-Netze: gestrichelte Seiten = Zahl im Text, Würfelraum a × a × a */
      const allNon = await page.evaluate(() => cubeNonNets().every(cells => {
        const net = gridNet(cells, 40, gridRoot(cells)), info = bodyFaceInfo(net, 'cube', cells, { a: 40 });
        const all = [].concat(...foldNet(net, 1)), span = ['x', 'y', 'z'].map(k => Math.max(...all.map(p => p[k])) - Math.min(...all.map(p => p[k])));
        return info.ghosts.length === cubeFoldCheck(cells, 40).missing && span.every(v => Math.abs(v - 40) < 1e-6);
      }));
      ok(allNon, 'Alle 24 Nicht-Netze: Text und Zeichnung nennen dieselben offenen Seiten');
      await page.click('#bodyQuizBtns .btn >> text=Beenden');
      ok(!(await page.isVisible('#bodyQuiz')) && await page.isVisible('#bodyNetPick') && await page.evaluate(() => bodyState.fold === 1), 'Quiz beendet: zurück zum Würfel');
      // Großansicht
      const small = await page.evaluate(() => document.getElementById('bodyView').width);
      await page.click('#btnBodyBig');
      await page.waitForTimeout(150);
      const big = await page.evaluate(() => ({ w: document.getElementById('bodyBig').width, h: document.getElementById('bodyBig').height, vis: !document.getElementById('bodyFull').hidden }));
      ok(big.vis && big.w > small * 1.5 && big.h > 400, 'Großansicht: Vollbild, deutlich größer', [small, big]);
      ok((await inkOf('bodyBig')) > 20000, 'Großansicht gezeichnet');
      await page.mouse.move(600, 400);
      await page.mouse.wheel(0, -400);
      /* 0.10.3: Körper stehen aufrecht, freies Drehen, Doppeltippen */
      {
        const upright = await page.evaluate(() => BODY_KINDS.map(k => {
          const g = BODY_DEFAULTS[k], net = bodyNet(k, g), flip = bodyFlip(net);
          const F = foldNet(net, 1).map(f => f.map(p => flip ? v3(p.x, p.y, -p.z) : p)), all = [].concat(...F);
          const zs = all.map(p => p.z), top = Math.max(...zs), cz = zs.reduce((a, b) => a + b, 0) / zs.length;
          return { k, ok: Math.min(...zs) > -1e-6 && cz > 0, apex: (k === 'pyramid4' || k === 'pyramidn' || k === 'pyramidrect' || k === 'cone') ? Math.abs(top - g.h) < 1e-6 && all.filter(p => Math.abs(p.z - top) < 1e-6).length === all.filter(p => Math.abs(p.z - top) < 1e-6 && Math.hypot(p.x - all.find(q => Math.abs(q.z - top) < 1e-6).x, p.y - all.find(q => Math.abs(q.z - top) < 1e-6).y) < 1e-6).length : true };
        }));
        ok(upright.every(u => u.ok && u.apex), 'Alle Körper falten nach oben, Spitzen von Pyramiden und Kegel oben', upright.filter(u => !u.ok || !u.apex));
        const drag = (id, x0, y0, x1, y1, pid) => page.evaluate(([id, x0, y0, x1, y1, pid]) => {
          const cv = document.getElementById(id), r = cv.getBoundingClientRect(), ev = (t, x, y) => cv.dispatchEvent(new PointerEvent('pointer' + t, { pointerId: pid, pointerType: 'touch', isPrimary: true, bubbles: true, clientX: r.left + x, clientY: r.top + y, buttons: t === 'up' ? 0 : 1 }));
          ev('down', x0, y0); for (let i = 1; i <= 20; i++) ev('move', x0 + (x1 - x0) * i / 20, y0 + (y1 - y0) * i / 20); ev('up', x1, y1);
        }, [id, x0, y0, x1, y1, pid]);
        await drag('bodyBig', 300, 100, 300, 400, 81);   /* 300 Punkte senkrecht ≈ 206° */
        ok(await page.evaluate(() => bodyState.view[2][2] < -0.5), 'Freies Drehen: Körper lässt sich kopfüber drehen', await page.evaluate(() => bodyState.view[2][2]));
        ok(await page.evaluate(() => { const M = bodyState.view; const d = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; return Math.abs(d(M[0], M[0]) - 1) < 1e-9 && Math.abs(d(M[0], M[1])) < 1e-9; }), 'Drehmatrix bleibt orthonormal');
        await drag('bodyBig', 200, 200, 200, 200, 82); await drag('bodyBig', 201, 200, 201, 200, 83);
        ok(await page.evaluate(() => JSON.stringify(bodyState.view) === JSON.stringify(bodyViewHome()) && bodyState.zoom === 1), 'Doppeltippen: zurück zur Ausgangsansicht');
        await page.mouse.move(600, 400); await page.mouse.wheel(0, -400);
      }
      ok(await page.evaluate(() => bodyState.zoom > 1.2), 'Großansicht: zoomen', await page.evaluate(() => bodyState.zoom));
      await page.click('#bodyColorsBtn');
      const colors = await page.evaluate(() => { const c = document.getElementById('bodyBig'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const set = new Set(); for (let i = 0; i < d.length; i += 4 * 37) if (d[i] + d[i + 1] + d[i + 2] < 700) set.add((d[i] >> 5) + ',' + (d[i + 1] >> 5) + ',' + (d[i + 2] >> 5)); return set.size; });
      ok(await page.evaluate(() => bodyState.colors) && colors >= 6, 'Farben: Flächen farbig (Gegenseiten gleich)', colors);
      await page.click('#bodyPlayBig');
      ok(await page.evaluate(() => bodyState.fold < 0.5), 'Großansicht: Falten startet von vorn');
      await page.waitForFunction(() => bodyState.fold > 0.999, null, { timeout: 6000 });
      ok((await page.inputValue('#bodyFoldBig')) === '100' && (await page.inputValue('#bodyFold')) === '100', 'Beide Regler folgen der Animation');
      await page.keyboard.press('Escape');
      ok(!(await page.isVisible('#bodyFull')) && await page.isVisible('#labBody'), 'Escape schließt die Großansicht, Labor bleibt');
      await page.click('#bodyColorsSmall');
      await page.click('#btnLab').catch(() => {});
      await page.click('#labMode_tri');
      ok(await page.isVisible('#btnLabDemo') && !(await page.isVisible('#labBody')), 'Zurück zu den Kongruenzsätzen');
      await page.click('#labPanel header .tb');
    }
    /* ---------- Sprachförderung: Vorlesen und Lückentext ---------- */
    {
      await page.click('#btnLab'); await page.click('#labMode_tri'); await page.click('#labKind_sws');
      await page.click('#btnLabDemo');
      await page.waitForFunction(() => window.__zw.PB.on, null, { timeout: 5000 });
      await page.click('#pbLast');
      const sp = await page.evaluate(() => ({ can: canSpeak(), vis: !document.getElementById('pbSpeak').hidden, txt: speechText('Verbinde AB mit C. Schnittpunkte S₁ und S₂, Dreieck ABC.') }));
      ok(sp.txt === 'Verbinde A B mit C. Schnittpunkte S1 und S2, Dreieck A B C.', 'Vorlesen: Punktnamen buchstabiert, Indizes gelesen', sp.txt);
      if (sp.can) {
        ok(sp.vis && await page.isVisible('#btnSpeakAll'), 'Vorlesen: Knöpfe sichtbar, wo der Browser sprechen kann');
        await page.click('#pbSpeak');
        ok(await page.evaluate(() => S.speakSteps && document.getElementById('pbSpeak').classList.contains('sel')), 'Schritte vorlesen: eingeschaltet');
        await page.click('#pbSpeak');
        ok(await page.evaluate(() => !S.speakSteps), 'Schritte vorlesen: ausgeschaltet');
      }
      await page.keyboard.press('Escape');
      const fsx = require('fs');
      await page.click('#btnPdf');
      if ((await page.textContent('#pdfOpt_desc')) === 'Aus') await page.click('#pdfOpt_desc');
      if ((await page.textContent('#pdfOpt_cloze')) === 'Aus') await page.click('#pdfOpt_cloze');
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }), page.click('#dialogButtons .btn.primary')]);
      const pdf = fsx.readFileSync(await dl.path()).toString('latin1');
      ok(pdf.includes('(Wortspeicher:) Tj') && pdf.includes('__________') && !pdf.includes('(Zeichne die Strecke AB'), 'PDF mit Lückentext und Wortspeicher');
      await page.click('#btnPdf');
      await page.click('#pdfOpt_desc');
      ok(await page.isDisabled('#pdfOpt_cloze'), 'Lückentext nur zusammen mit der Beschreibung');
      await page.click('#pdfOpt_desc');
      await page.click('#pdfOpt_cloze');
      await page.click('#dialogButtons .btn >> text=Abbrechen');
    }
    /* Fokus: in Fenster hinein und wieder zurück (VoiceOver, Tastatur) */
    await page.click('#btnHelp');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'helpTitle'), 'Fokus springt ins geöffnete Fenster');
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'btnHelp'), 'Fokus kehrt nach dem Schließen zurück');
    ok(await page.evaluate(() => document.getElementById('labMode_tri').getAttribute('aria-pressed') !== null), 'Umschalter melden ihren Zustand (aria-pressed)');
    /* Großansicht im dunklen Modus: Knöpfe lesbar (früher dunkle Schrift auf dunklem Grund) */
    {
      const ct = await page.evaluate(() => {
        const old = document.documentElement.dataset.theme;
        document.documentElement.dataset.theme = 'dark';
        openLab(); labSetMode('body'); bodySelect('cube'); bodyUpdate(); bodyFullOpen();
        const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
        const out = ['bodyPlayBig', 'bodyColorsBtn'].map(id => { const cs = getComputedStyle(document.getElementById(id)); const a = lum(cs.color), b = lum(cs.backgroundColor); return Math.round((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) * 10) / 10; });
        bodyFullClose(); closePanel('labPanel'); document.documentElement.dataset.theme = old;
        return out;
      });
      ok(ct.every(c => c >= 4.5), 'Großansicht dunkel: Falten/Farben gut lesbar (Kontrast ≥ 4,5)', ct);
    }
    /* ---------- Kostenlose Fassung (ohne Kauf) ---------- */
    {
      const fr = await launch({ locale: 'de-DE' });
      const fp = await fr.context.newPage();
      const ferr = []; fp.on('pageerror', e => ferr.push(e.message));
      await fp.goto(url); await fp.waitForFunction(() => window.__zw && window.__zw.ready);
      await fp.click('#helpPanel header .tb');
      const dlg = async () => ({ title: await fp.textContent('#dialogTitle'), msg: await fp.textContent('#dialogMessage') });
      const later = () => fp.click('#dialogButtons .btn >> text=Später');
      /* Gesperrte Bereiche zeigen den Hinweis auf die Vollversion */
      await fp.click('#btnLab');
      let d = await dlg();
      ok(await fp.isVisible('#dialog') && d.title === 'Vollversion' && /Labor/.test(d.msg) && !(await fp.isVisible('#labPanel')), 'Kostenlos: Labor zeigt den Hinweis auf die Vollversion', d);
      await later();
      await fp.click('#btnPdf');
      d = await dlg();
      ok(d.title === 'Vollversion' && /PDF/.test(d.msg), 'Kostenlos: PDF-Export gesperrt', d);
      await later();
      for (const [fn, re, name] of [['exportVideo()', /Video/, 'Video-Export'], ["showQr('zirkelwerk://a?v=1', 'x')", /QR/, 'QR-Aufgabe erstellen'], ['openResults()', /Abgaben/, 'Abgaben']]) {
        await fp.evaluate(f => { (0, eval)(f); }, fn);
        await fp.waitForSelector('#dialog:not([hidden])');
        d = await dlg();
        ok(d.title === 'Vollversion' && re.test(d.msg), 'Kostenlos: ' + name + ' gesperrt', d);
        await later();
      }
      /* Drei Blätter frei, das vierte nicht */
      const count = () => fp.evaluate(() => new Promise(r => { const q = indexedDB.open('zirkelwerk'); q.onsuccess = () => { const c = q.result.transaction('docs').objectStore('docs').count(); c.onsuccess = () => r(c.result); }; }));
      await fp.evaluate(() => newSheet()); await fp.evaluate(() => newSheet());
      ok(await count() === 3 && !(await fp.isVisible('#dialog')), 'Kostenlos: drei Blätter ohne Hinweis');
      await fp.evaluate(() => { newSheet(); });
      await fp.waitForSelector('#dialog:not([hidden])');
      d = await dlg();
      ok(d.title === 'Vollversion' && /3 Blätter/.test(d.msg) && await count() === 3, 'Kostenlos: viertes Blatt verweist auf die Vollversion', d);
      /* „Ansehen" führt zum Kaufbereich */
      await fp.click('#dialogButtons .btn >> text=Ansehen');
      ok(await fp.isVisible('#settingsPanel') && await fp.isVisible('#purchaseSection') && await fp.isVisible('#btnBuy'), 'Kostenlos: „Ansehen" öffnet den Kaufbereich');
      ok((await fp.textContent('#btnBuy')) === 'Vollversion freischalten' && /Labor/.test(await fp.textContent('#purchaseState')), 'Kostenlos: Kaufknopf und Inhalt der Vollversion beschrieben');
      ok(await fp.isVisible('#purchaseSection .btn >> text=Käufe wiederherstellen'), 'Kostenlos: „Käufe wiederherstellen" sichtbar (Apple verlangt ihn)');
      /* Ohne Store (Browser): klare Meldung statt stiller Fehler */
      await fp.click('#btnBuy');
      ok(/nicht erreichbar/.test(await fp.textContent('#toast')), 'Kostenlos: ohne Store verständliche Meldung');
      /* Gekauft (gemerkt) → alles offen, Kaufknopf weg */
      await fp.evaluate(() => localStorage.setItem('zw.full', '1'));
      await fp.reload(); await fp.waitForFunction(() => window.__zw && window.__zw.ready);
      await fp.evaluate(() => openLab());
      ok(await fp.isVisible('#labPanel') && !(await fp.isVisible('#dialog')), 'Gekauft: Labor öffnet');
      await fp.evaluate(() => { closePanel('labPanel'); openSettings(); });
      ok(!(await fp.isVisible('#btnBuy')) && /freigeschaltet/.test(await fp.textContent('#purchaseState')), 'Gekauft: Kaufknopf verschwindet, Dank angezeigt');
      ok(ferr.length === 0, 'Kostenlos: keine Skriptfehler', ferr);
      await fr.browser.close();
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
      ok((await pp.textContent('#dialogTitle')) === 'Mehr' && (await pp.locator('#dialogButtons .btn').count()) === 7, 'Handy: Menü mit sechs Einträgen (mit „Bild einfügen") und Abbrechen');
      await pp.click('#dialogButtons .btn >> text=Einstellungen');
      ok(await pp.isVisible('#settingsPanel'), 'Handy: Einstellungen über das Menü erreichbar');
      await pp.click('#settingsPanel .btn >> text=Kurzanleitung');
      ok(await pp.isVisible('#helpPanel') && !(await pp.isVisible('#helpLangTop')) && (await pp.textContent('#helpAboutLine')).match(/^Zirkelwerk \d+\.\d+\.\d+/) !== null, 'Handy: Kurzanleitung aus den Einstellungen, „Über" mit Version');
      await pp.click('#helpPanel header .tb');
      await pp.setViewportSize({ width: 844, height: 390 });
      await pp.waitForTimeout(200);
      ok(await pp.evaluate(() => document.getElementById('btnMore').hidden && !document.getElementById('btnSettings').hidden), 'Handy quer: alles in der Kopfleiste, kein Menü');
      ok(await pp.evaluate(() => { const tb = document.getElementById('toolbar'); return tb.scrollHeight <= tb.clientHeight + 1; }), 'Handy quer: Werkzeugleiste ohne Blättern');
      await pp.setViewportSize({ width: 390, height: 844 });
      await pp.evaluate(() => createLabSheet('sws', { c: 60, b: 45, alpha: 50 }, 'task'));
      await pp.waitForTimeout(200);
      const tw = await pp.evaluate(() => { const t = document.getElementById('taskText'); return { w: t.getBoundingClientRect().width, lines: Math.round(t.getBoundingClientRect().height / parseFloat(getComputedStyle(t).lineHeight)) }; });
      ok(tw.w > 150 && tw.lines <= 4, 'Handy hochkant: Aufgabentext nutzt die Breite (kein Umbruch Wort für Wort)', tw);
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
