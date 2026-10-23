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
  python3 - "$ARBEIT/k/$datei" "$alt" "$neu" <<'PY' || { echo "  ? $1: Ersetzung nicht anwendbar"; return; }
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
pruefe "Version auseinander"        validate.js config.xml 'version="0.6.0"' 'version="0.6.1"'
pruefe "versionCode falsch"         validate.js config.xml 'android-versionCode="600"' 'android-versionCode="601"'
pruefe "Cache-Name veraltet"        validate.js sw.js "zirkelwerk-0.6.0" "zirkelwerk-0.5.0"
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
pruefe "Link: Freihand zerstört"     coretest.js index.html "abs.push(i < 2 ? n : abs[i - 2] + n)" "abs.push(n)"
pruefe "Link: Abgriff verloren"      coretest.js index.html "mm.rs = { t: 'taken', p: mm.rs.p.map(n => 'q' + n) };" ""
pruefe "Link: Android-Kodierung"     coretest.js index.html "if (!/^zirkelwerk:/i.test(u) && /^zirkelwerk%3A/i.test(u))" "if (false)"
pruefe "Herkunft ungeprüft"          coretest.js index.html "/^[0-9a-z]{1,13}$/.test(raw.src)" "true"
pruefe "Zahlen stehen kopf"          coretest.js index.html "function textFlip(rot) { return Math.cos(rot) < -1e-9; }" "function textFlip(rot) { return false; }"
pruefe "iPhone-Maß falsch"           coretest.js index.html "'390x844': 460 / 3, '393x852': 460 / 3," "'390x844': 460 / 3, '393x852': 326 / 2,"
pruefe "XR und XS Max verwechselt"   coretest.js index.html "dpr >= 3 ? 458 / 3 : 326 / 2" "458 / 3"
echo ""
echo "Gegenprobe: $erkannt von $gesamt Mutationen erkannt."
if [ ${#blind[@]} -gt 0 ]; then printf '  blind: %s\n' "${blind[@]}"; exit 1; fi
