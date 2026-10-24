#!/usr/bin/env bash
# Gegenprobe für die Prüfkette: baut in einer Kopie gezielt Fehler ein und
# erwartet, dass validate.js bzw. coretest.js jeden davon meldet.
#
#   ./mutate.sh
#
# Schlägt eine Mutation NICHT fehl, ist die Prüfung an dieser Stelle blind.
set -u
QUELLE="$(cd "$(dirname "$0")" && pwd)"
ARBEIT="$(mktemp -d)"
trap 'rm -rf "$ARBEIT"' EXIT

gesamt=0; erkannt=0; blind=()

pruefe() {   # $1 Beschreibung, $2 Prüfskript, $3 Python-Ersetzung (Datei, alt, neu)
  local name="$1" skript="$2" datei="$3" alt="$4" neu="$5"
  rm -rf "$ARBEIT/k"; mkdir "$ARBEIT/k"
  cp -R "$QUELLE"/. "$ARBEIT/k/"
  rm -rf "$ARBEIT/k/node_modules" "$ARBEIT/k/.git"
  python3 - "$ARBEIT/k/$datei" "$alt" "$neu" <<'PY' || { echo "  ✗ VERALTET: $1 (Textstelle nicht mehr vorhanden)"; gesamt=$((gesamt + 1)); blind+=("$name (veraltet)"); return; }
import sys
p, a, b = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
if a not in s: sys.exit(1)
open(p, 'w', encoding='utf-8').write(s.replace(a, b, 1))
PY
  gesamt=$((gesamt + 1))
  if (cd "$ARBEIT/k" && node "$skript" > /dev/null 2>&1); then
    blind+=("$name"); echo "  ✗ NICHT erkannt: $name"
  else
    erkannt=$((erkannt + 1)); echo "  ✓ erkannt: $name"
  fi
}

pruefe "Übersetzung fehlt"          validate.js index.html "toolEraser: 'Eraser'," ""
pruefe "Platzhalter verschieden"    validate.js index.html "defaultSheetName: 'Sheet {n}'" "defaultSheetName: 'Sheet'"
pruefe "Version auseinander"        validate.js config.xml 'version="0.10.2"' 'version="0.10.3"'
pruefe "versionCode falsch"         validate.js config.xml 'android-versionCode="1002"' 'android-versionCode="1003"'
pruefe "Cache-Name veraltet"        validate.js sw.js "zirkelwerk-0.10.2" "zirkelwerk-0.10.1"
pruefe "Rechtstext ohne docs/"      validate.js datenschutz.html "Stand: Oktober 2026" "Stand: November 2026"
pruefe "Unbekanntes Symbol"         validate.js index.html 'data-icon="ruler"' 'data-icon="lineal"'
pruefe "Handler fehlt"              validate.js index.html "onclick=\"openHelp()\"" "onclick=\"openHilfe()\""
pruefe "ID-Tippfehler"              validate.js index.html "getElementById('zoomLabel').textContent = Math.round(view.zoom * 100)" "getElementById('zoomLable').textContent = Math.round(view.zoom * 100)"
pruefe "Kauf ohne Plugin"           validate.js index.html "const IAP_ENABLED = false;" "const IAP_ENABLED = true;"
pruefe "Sperre ohne Kauf"           validate.js index.html "const LIMITS_ACTIVE = false;" "const LIMITS_ACTIVE = true;"
pruefe "Fremdinhalt geladen"        validate.js index.html '<link rel="icon" href="icon-192.png">' '<link rel="icon" href="https://example.com/x.png">'
pruefe "Deutscher Name fehlt"       validate.js res/android/values-de/strings.xml '<string name="app_name">Zirkelwerk</string>' '<string name="app_name">Compasswork</string>'
pruefe "Zugriff auf alles"          validate.js config.xml '<allow-intent href="mailto:*" />' '<access origin="*" /><allow-intent href="mailto:*" />'
pruefe "Bogen-Anfang fällt raus"    coretest.js index.html "if (d > TAU - 1e-7) d = 0;" ""
pruefe "Tangente verloren"          coretest.js index.html "if (disc > -1e-9 * Math.max(1, b * b, Math.abs(4 * a * c))) disc = 0;" "if (false) disc = 0;"
pruefe "Rückgängig falsche Reihenf." coretest.js index.html "for (let k = e.items.length - 1; k >= 0; k--) {
      const it = e.items[k];" "for (let k = 0; k < e.items.length; k++) {
      const it = e.items[k];"
pruefe "Import ohne Farbprüfung"    coretest.js index.html "/^#[0-9a-fA-F]{6}\$/.test(c)" "true"
pruefe "Fangen ohne Vorrang"        coretest.js index.html "point: 0.75," "point: 1.2,"
pruefe "iPad mini falsch"           coretest.js index.html "if (key === '744x1133') return { ppm: 163 / 25.4" "if (key === '744x1134') return { ppm: 163 / 25.4"

pruefe "Satzbaustein fehlt (EN)"    validate.js index.html "    d_crossArcs2: 'The intersections of the two arcs are {list}.', " "    "
pruefe "Spät beschriftet = gemessen" coretest.js index.html "if (on.length >= 2) addCross(p, on);
  };" "if (false) addCross(p, on);
  };"
pruefe "Bezug ohne Namensvorrang"   coretest.js index.html "if (segName(s1)) rel = r; else if (!relAny) relAny = r;" "if (!relAny) relAny = r;"
pruefe "Verweise nicht umgeschrieben" coretest.js index.html "o.m.rs = (a && b) ? { t: 'taken', p: [a, b] } : { t: 'set' };" ""
pruefe "Abgriff ohne Längenprüfung" coretest.js index.html "Math.abs(dist(pa.x, pa.y, pb.x, pb.y) - o.r) < DESC_EPS" "true"
pruefe "Schnittpunkte nicht zusammengefasst" coretest.js index.html "last.on[0].id === on[0].id && last.on[1].id === on[1].id && last.ps.length < 4" "false"
pruefe "SsW: zweite Lösung verloren" coretest.js index.html "let ts = [m + s, m - s].filter(t => t > 1e-6);" "let ts = [m + s].filter(t => t > 1e-6);"
pruefe "Grenzfall a + b = c erlaubt" coretest.js index.html "if (a + b <= c + e || a + c <= b + e || b + c <= a + e)" "if (a + b < c - e || a + c < b - e || b + c < a - e)"
pruefe "Prüfung ohne Toleranz"       coretest.js index.html "const LAB_TOL = { side: 1.5, angle: 1.5 };" "const LAB_TOL = { side: 40, angle: 40 };"
pruefe "Fehlende Seite unbemerkt"   coretest.js index.html "if (missingSides.length) issues.push({ k: 'sides', list: missingSides });" ""
pruefe "Winkel antragen unerkannt"  coretest.js index.html "if (isRay(o) && (a0 || b0)) {" "if (false) {"
pruefe "Planfigur zerfällt"         coretest.js index.html "if (last && last.kind === 'plan' && !pending.length) assign(last, o.id);" ""
pruefe "Bogen-Umriss = Vollkreis"   coretest.js index.html "if (!(Math.abs(o.sweep) < TAU - 1e-7)) { add(o.cx - o.r, o.cy - o.r); add(o.cx + o.r, o.cy + o.r); }" "{ add(o.cx - o.r, o.cy - o.r); add(o.cx + o.r, o.cy + o.r); } if (false) {}"
pruefe "Zufall SsW mehrdeutig"      coretest.js index.html "a: c + pick(5, 25, 5) };" "a: c - pick(5, 15, 5) };"
pruefe "Aufgabe ungeprüft geladen"  coretest.js index.html "return labValid(t.kind, given) ? { kind: t.kind, given } : null;" "return { kind: t.kind, given };"
pruefe "PDF: Bogen falsch herum"    coretest.js index.html "else sw = sw <= -TAU ? -TAU : -((((-sw) % TAU) + TAU) % TAU);" "else sw = -(((sw % TAU) + TAU) % TAU);"
pruefe "PDF: Bézier ungenau"         coretest.js index.html "kk = 4 / 3 * Math.tan(d / 4);" "kk = 0.5;"
pruefe "PDF: Verzeichnis verschoben" coretest.js index.html "offs.push(out.length);" "offs.push(out.length + 1);"
pruefe "PDF: Stream-Länge falsch"    coretest.js index.html "'<< /Length ' + p.content.length" "'<< /Length ' + (p.content.length + 1)"
pruefe "PDF: Klammern unmaskiert"    coretest.js index.html "if (c === 40 || c === 41 || c === 92)" "if (c === 92)"
pruefe "PDF: Griechisch fehlt"       coretest.js index.html "else if (PDF_SYMBOL[c]) put('F3'" "else if (false) put('F3'"
pruefe "PDF: krumme Prozente"        coretest.js index.html "if (s < 1) s = Math.max(0.01, Math.floor(s * 100 + 1e-9) / 100);" ""
pruefe "PDF: nie Querformat"         coretest.js index.html "c.s > best.s + 1e-9 ? c : best" "best"
pruefe "PDF: Beschreibung verschluckt" coretest.js index.html "if (o.desc && o.desc.steps.length) {" "if (false) {"
pruefe "PDF-Texte fehlen (EN)"       validate.js index.html "    pdf_name: 'Name:', pdf_date: 'Date:', pdf_descTitle: 'Construction description'," "    pdf_name: 'Name:', pdf_date: 'Date:',"
pruefe "QR: Formatinfo falsch"       coretest.js index.html "^ 0x5412" "^ 0x5413"
pruefe "QR: Reed-Solomon falsch"     coretest.js index.html "root = qrMul(root, 2);" "root = qrMul(root, 3);"
pruefe "QR: Blöcke falsch verschränkt" coretest.js index.html "if (i !== shortLen - eccLen || j >= nShort) cw.push(b[i]);" "cw.push(b[i]);"
pruefe "QR: Maske nicht gewählt"     coretest.js index.html "if (p < bestP) { bestP = p; best = m; }" "if (m === 0) { bestP = p; best = m; }"
pruefe "Link: neuere Version egal"   coretest.js index.html "if (v > LINK_V) return { ok: false, err: 'newer' };" ""
pruefe "Link: Aufgabe ungeprüft"     coretest.js index.html "const task = sanitizeTask({ kind: q.k, given });" "const task = { kind: q.k, given };"
pruefe "Link: Freihand zerstört"     coretest.js index.html "abs.push(k < 2 ? n : abs[k - 2] + n)" "abs.push(n)"
pruefe "Link: Abgriff verloren"      coretest.js index.html "mm.rs = { t: 'taken', p: mm.rs.p.map(n => 'q' + n) };" ""
pruefe "Link: Android-Kodierung"     coretest.js index.html "if (!/^zirkelwerk:/i.test(u) && /^zirkelwerk%3A/i.test(u))" "if (false)"
pruefe "Herkunft ungeprüft"          coretest.js index.html "/^[0-9a-z]{1,13}$/.test(raw.src)" "true"
pruefe "Zahlen stehen kopf"          coretest.js index.html "function textFlip(rot) { return Math.cos(rot) < -1e-9; }" "function textFlip(rot) { return false; }"
pruefe "iPhone-Maß falsch"           coretest.js index.html "'390x844': 460 / 3, '393x852': 460 / 3," "'390x844': 460 / 3, '393x852': 326 / 2,"
pruefe "XR und XS Max verwechselt"   coretest.js index.html "dpr >= 3 ? 458 / 3 : 326 / 2" "458 / 3"
pruefe "Projektwissen veraltet"     validate.js PROJEKTWISSEN.md "Stand 0.10.2" "Stand 0.10.1"
pruefe "Diagnose: Skala übersehen"  coretest.js index.html "if (near(got, 180 - want, T) && Math.abs(want - 90) > 4) return { why: 'scale' };" ""
pruefe "Diagnose: Tausch übersehen"  coretest.js index.html "if (near(got, g[o], T) && near(meas[o], want, T)) return { why: 'swap', other: o };" ""
pruefe "Hilfe: Spiegelung ignoriert" coretest.js index.html "for (const flip of [1, -1])" "for (const flip of [1])"
pruefe "Hilfe: Schenkelrichtung egal" coretest.js index.html "Math.abs(angDiff(dir, Math.atan2(e.y - s.y, e.x - s.x))) < 3 * DEG" "true"
pruefe "Hilfe: Bogen falsch gespiegelt" coretest.js index.html "const a0 = flip > 0 ? o.a0 + rot : rot - o.a0;" "const a0 = o.a0 + rot;"
pruefe "Link: Typindex ungeprüft"    coretest.js index.html "if (!Array.isArray(row) || !Number.isInteger(row[0]) || row[0] < 0 || row[0] >= QS_TYPES.length) return;" "if (!Array.isArray(row) || !QS_TYPES[row[0]]) return;"
pruefe "Link: Vollkreis zerfällt"    coretest.js index.html "if (type === 'arc' && typeof o.sweep === 'number' && Math.abs(Math.abs(o.sweep) - TAU) < 1e-5) o.sweep = Math.sign(o.sweep) * TAU;" ""
pruefe "Platzhalter mehrfach ersetzt" coretest.js index.html "return v ? s.replace(/\\{(\\w+)\\}/g, (m, n) => (n in v ? String(v[n]) : m)) : s;" "let r = s; if (v) for (const n of Object.keys(v)) r = r.split('{' + n + '}').join(v[n]); return r;"
pruefe "PDF: Umbruch nur am Ende"    coretest.js index.html "lines.push(flush(line)); line = word;" "lines.push(line); line = word;"
pruefe "Gerätewinkel abgeschnitten"  coretest.js index.html "d[k].rot = isNum(s.rot) && Math.abs(s.rot) < 1e6 ? angDiff(0, s.rot) : 0;" "d[k].rot = cleanNum(s.rot, -1e3, 1e3, 0);"
pruefe "Geo: Toleranz zu weit"       coretest.js index.html "const good = cand.find(c => c.dAng <= GEO_TOL.angle && c.off <= GEO_TOL.off);" "const good = cand.find(c => c.dAng <= 10 && c.off <= 5);"
pruefe "Geo: Halbgerade nach außen"  coretest.js index.html "if (Math.abs(angDiff(tg.ang, gdir(tg.p, far))) > Math.PI / 2) issues.push({ k: 'g_outside' });" ""
pruefe "Geo: Lot zu kurz egal"       coretest.js index.html "if (tg.reach && distToSeg(tg.reach.x, tg.reach.y, good.o.x1, good.o.y1, good.o.x2, good.o.y2) > GEO_TOL.off) issues.push({ k: 'g_short' });" ""
pruefe "Geo: Teilbogen als Kreis"    coretest.js index.html "if (Math.abs(good.a.sweep) < TAU - 0.35) issues.push({ k: 'g_partial' });" ""
pruefe "Geo: Ausgangsfigur vergessen" coretest.js index.html "if (o.m && o.m.giv === true) clean.m = Object.assign(clean.m || {}, { giv: true });" ""
pruefe "Geo: Senkrechte ohne P auf g" coretest.js index.html "lineDist(gp(g, 'p'), gp(g, 'g1'), gdir(gp(g, 'g1'), gp(g, 'g2'))) < 0.05," "true,"
pruefe "Rückmeldung ohne Diagnose"   coretest.js index.html "return [...new Set(res.issues.map(i => i.why || i.k))].slice(0, RESULT_MAX_CODES);" "return [...new Set(res.issues.map(i => i.k))].slice(0, RESULT_MAX_CODES);"
pruefe "Rückmeldung: Name unbegrenzt" coretest.js index.html "name: cleanStr(typeof p.n === 'string' ? p.n : '', 30).trim()" "name: cleanStr(typeof p.n === 'string' ? p.n : '', 300).trim()"
pruefe "Auswertung falsch sortiert"  coretest.js index.html "codes: [...codes.entries()].sort((a, b) => b[1] - a[1] ||" "codes: [...codes.entries()].sort((a, b) => a[1] - b[1] ||"
pruefe "Rückmeldung: Hilfe unbegrenzt" coretest.js index.html "help: Math.round(cleanNum(p.h, 0, 4, 0)), codes, objects } };" "help: p.h, codes, objects } };"
pruefe "PDF: Strichelung fehlt"      coretest.js index.html "const dash = this.dash.length && this.dash.some(v => v > 0)" "const dash = false && this.dash.length"
pruefe "Netz: Faltlinien durchgezogen" coretest.js index.html "nd.edges.forEach(e => seg(e.a, e.b, e.fold ? { d: 1, c: SOFT, w: 0.3 } : null));" "nd.edges.forEach(e => seg(e.a, e.b, null));"
pruefe "Gestrichelt geht verloren"   coretest.js index.html "if (o.d === 1 || o.d === true) seg.d = 1;" ""
pruefe "Lückentext: kurze Wörter zuerst" coretest.js index.html ".filter(Boolean))].sort((a, b) => b.length - a.length);" ".filter(Boolean))];"
pruefe "Wortspeicher ohne Anzahl"    coretest.js index.html "e.n > 1 ? e.w + ' (' + e.n + '×)' : e.w" "e.w"
pruefe "Zufällig senkrecht = Senkrechte" coretest.js index.html "if (through && o.m && o.m.via === 'geo') {" "if (through) {"
pruefe "Vorauswahl verliert Paare"   coretest.js index.html "if (B.y0 > A.y1 || B.y1 < A.y0) continue;" "if (B.y0 > A.y0) continue;"
pruefe "Schrittweise unvollständig"  coretest.js index.html "      if (B.x0 > A.x1 + E || B.x1 < A.x0 - E || B.y0 > A.y1 + E || B.y1 < A.y0 - E) continue;" "      if (B.x0 > A.x0) continue;"
pruefe "Großes Blatt nicht ladbar"   coretest.js index.html "if (raw.objects.length > LIMITS.objects && !stored) throw new Error('toolarge');" "if (raw.objects.length > LIMITS.objects) throw new Error('toolarge');"
pruefe "Langer Strich verworfen"     coretest.js index.html "const pts = [], nIn = Math.min(o.pts.length, LIMITS.strokePts);" "if (o.pts.length > LIMITS.strokePts) return null; const pts = [], nIn = o.pts.length;"
pruefe "Beschreibung sieht spätere Linien" coretest.js index.html "      if (k >= i) continue;" ""
pruefe "Abgabe ungeprüft übernommen" coretest.js index.html ".map((o, i) => { try { return sanitizeObject(o, 'r' + i); } catch (e) { return null; } }).filter(Boolean);" ";"
# 0.10.1: Radierer, Beschriftung, Punkte verschieben
pruefe "Teilbogen falscher Drehsinn"  coretest.js index.html "sweep: dir * Math.min(v - u, TAU - 1e-6)" "sweep: Math.min(v - u, TAU - 1e-6)"
pruefe "Vollkreis-Lücke nicht vereint" coretest.js index.html "if (full && keep.length === 2" "if (false && keep.length === 2"
pruefe "Antippen: Linie vor Punkt"    coretest.js index.html "const pr = o.type === 'point' || o.type === 'text' ? 0 : o.type === 'image' ? 2 : 1;" "const pr = o.type === 'image' ? 2 : 1;"
pruefe "Antippen: Bild vor Linie"     coretest.js index.html "const pr = o.type === 'point' || o.type === 'text' ? 0 : o.type === 'image' ? 2 : 1;" "const pr = o.type === 'point' || o.type === 'text' ? 0 : 1;"
pruefe "Gruppe falsch rückgängig"     coretest.js index.html "for (let k = e.list.length - 1; k >= 0; k--) revertEntry(objs, e.list[k]);" "for (let k = 0; k < e.list.length; k++) revertEntry(objs, e.list[k]);"
pruefe "Einstich verschiebbar"        coretest.js index.html "if (dist(o.cx, o.cy, p.x, p.y) < DESC_EPS || distToArc(p.x, p.y, o) < DESC_EPS) return false;" "if (distToArc(p.x, p.y, o) < DESC_EPS) return false;"
pruefe "Teilstücke getrennt beschrieben" coretest.js index.html "if (prev && prev.kind === 'seg' && !pending.length && piecesOfOneSeg(prev.o, o))" "if (false)"
pruefe "Stoß an benanntem Punkt verschmolzen" coretest.js index.html "return !pointAt(best.pa[0], best.pa[1]) && !pointAt(best.pb[0], best.pb[1]);" "return true;"
# 0.10.2
pruefe "Doppelter Übersetzungsschlüssel"  validate.js index.html "restoredCopy: '{name} (Sicherung)', msgBackupRestored:" "restoredCopy: '{name} (Sicherung)', msgRestored:"
pruefe "Ordner geht beim Laden verloren"  coretest.js index.html "    folder: cleanFolder(raw.folder)," ""
pruefe "Sicherung überschreibt geänderte" coretest.js index.html "    else copy.push(d);" "    else add.push(d);"
pruefe "Abgaben doppelt beim Zusammenführen" coretest.js index.html "if (!have.has(k(r))) { have.add(k(r)); out.push(r); added++; }" "{ out.push(r); added++; }"
pruefe "Verbinden ohne Vorbedingung"      coretest.js index.html "if (ka && kb && !prev.ids.includes(ka.id) && !prev.ids.includes(kb.id))" "if (ka && kb)"
pruefe "Bild ohne JPEG-Prüfung"           coretest.js index.html "      const info = jpegFromDataUrl(o.src);
      if (!info) return null;" "      const info = { w: 1, h: 1 };"
pruefe "Bild wird weggewischt"            coretest.js index.html "    case 'image': return null;   /* Bilder nur" "    case 'imageX': return null;   /* Bilder nur"
pruefe "PDF-Bild falsche Länge"           coretest.js index.html "/Length ' + im.hex.length + ' >>" "/Length ' + (im.hex.length + 1) + ' >>"
pruefe "Bilder unbegrenzt je Blatt"       coretest.js index.html "if (o && o.type === 'image' && ++nImg > IMG.maxPerDoc) continue;" ""
pruefe "Würfelnetz-Abrollen falsch"       coretest.js index.html "if (dx === 1) t = { d: s.px, u: s.nx, px: s.u, nx: s.d, py: s.py, ny: s.ny };" "if (dx === 1) t = { d: s.px, u: s.nx, px: s.d, nx: s.u, py: s.py, ny: s.ny };"
pruefe "Falten nur in Listenreihenfolge"  coretest.js index.html "  net.faces.forEach((f, i) => visit(i));" "  net.faces.forEach((f, i) => { done.add(i); order.push(i); });"
pruefe "Abwickeln falsche Seite"          coretest.js index.html "if ((pc.x - A.x) * wx + (pc.y - A.y) * wy > 0) { wx = -wx; wy = -wy; }" ""
pruefe "Kugel mit geradem Bandzahl"       coretest.js index.html "const BODY_SEG = 36, SPHERE_BANDS = 13;" "const BODY_SEG = 36, SPHERE_BANDS = 12;"
pruefe "Kegel-Formel falsch"              coretest.js index.html "case 'cone': return { V: Math.PI * g.r * g.r * g.h / 3," "case 'cone': return { V: Math.PI * g.r * g.r * g.h / 2,"
pruefe "Eckenzahl ohne Grenze"            coretest.js index.html "if (!Number.isInteger(g[k]) || g[k] < ints[k][0] || g[k] > ints[k][1]) return false;" ""
pruefe "Kamera-Begründung fehlt"          validate.js res/ios/de.lproj/InfoPlist.strings '"NSCameraUsageDescription"' '"NSCameraUsageDescriptionX"' 
echo ""
echo "Gegenprobe: $erkannt von $gesamt Mutationen erkannt."
if [ ${#blind[@]} -gt 0 ]; then printf '  blind: %s\n' "${blind[@]}"; exit 1; fi
