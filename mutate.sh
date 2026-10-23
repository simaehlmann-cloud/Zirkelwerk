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
pruefe "Version auseinander"        validate.js config.xml 'version="0.2.0"' 'version="0.2.1"'
pruefe "versionCode falsch"         validate.js config.xml 'android-versionCode="200"' 'android-versionCode="201"'
pruefe "Cache-Name veraltet"        validate.js sw.js "zirkelwerk-0.2.0" "zirkelwerk-0.1.0"
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
echo ""
echo "Gegenprobe: $erkannt von $gesamt Mutationen erkannt."
if [ ${#blind[@]} -gt 0 ]; then printf '  blind: %s\n' "${blind[@]}"; exit 1; fi
