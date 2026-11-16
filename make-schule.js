/* Zirkelwerk – Schul-Edition erzeugen.  node make-schule.js
 *
 * Wird NUR im iOS-Workflow aufgerufen (Edition "schule"), auf der frischen
 * Arbeitskopie des Läufers. Im Repo bleibt immer die normale App stehen.
 *
 * Die Schul-Edition ist eine eigene App (de.zirkelwerk.schule) mit festem
 * Kaufpreis und allen Funktionen, ohne In-App-Kauf. Grund: Apple School
 * Manager kann keine In-App-Käufe – Schulen könnten die Vollversion der
 * Hauptapp auf verwalteten iPads nicht freischalten.
 *
 * Jede Ersetzung muss genau einmal greifen. Ändert sich eine der Zeilen in
 * index.html oder config.xml, bricht das Skript ab, statt still eine halbe
 * Schul-Edition zu bauen (z. B. mit Kaufknopf, aber ohne Kauf-Plugin).
 */
const fs = require('fs');

const SCHUL_ID = 'de.zirkelwerk.schule';

function ersetzen(datei, schritte) {
  let text = fs.readFileSync(datei, 'utf8');
  for (const [alt, neu, was] of schritte) {
    const n = text.split(alt).length - 1;
    if (n !== 1) {
      console.error(`::error::${datei}: „${was}“ ${n}-mal gefunden, erwartet genau 1-mal. Gesucht: ${alt}`);
      process.exit(1);
    }
    text = text.replace(alt, () => neu);
    console.log(`${datei}: ${was}`);
  }
  fs.writeFileSync(datei, text);
}

ersetzen('index.html', [
  ["const BUNDLE_ID = 'de.zirkelwerk.app';", `const BUNDLE_ID = '${SCHUL_ID}';`, 'Bundle-ID'],
  ['const LIMITS_ACTIVE = true;', 'const LIMITS_ACTIVE = false;', 'alle Funktionen frei'],
  ['const IAP_ENABLED = true;', 'const IAP_ENABLED = false;', 'Kaufbereich aus'],
  // In „Über“ und in der Hilfe erkennbar, welche Edition läuft (Support-Mails).
  ["aboutLine: 'Zirkelwerk {version} · ", "aboutLine: 'Zirkelwerk Schule {version} · ", 'Über-Zeile DE'],
  ["aboutLine: 'Compasswork {version} · ", "aboutLine: 'Compasswork School {version} · ", 'Über-Zeile EN'],
]);

ersetzen('config.xml', [
  ['<widget id="de.zirkelwerk.app"', `<widget id="${SCHUL_ID}"`, 'Bundle-ID'],
  // Ohne Plugin kein StoreKit im Projekt: Die App-Prüfung findet dann auch
  // keinen Kaufcode, der in einer App ohne In-App-Käufe nichts zu suchen hat.
  ['<plugin name="cordova-plugin-purchase" spec="13.19.1" />', '', 'Kauf-Plugin entfernt'],
]);

/* Gegenprobe auf dem Ergebnis */
const html = fs.readFileSync('index.html', 'utf8');
const cfg = fs.readFileSync('config.xml', 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const fehler = [];
if (/const IAP_ENABLED = true/.test(html)) fehler.push('IAP_ENABLED ist noch true');
if (/const LIMITS_ACTIVE = true/.test(html)) fehler.push('LIMITS_ACTIVE ist noch true');
if (/cordova-plugin-purchase/.test(cfg)) fehler.push('Kauf-Plugin steht noch in config.xml');
if (!cfg.includes(`<widget id="${SCHUL_ID}"`)) fehler.push('Bundle-ID in config.xml nicht gesetzt');
if (fehler.length) {
  fehler.forEach(f => console.error('::error::' + f));
  process.exit(1);
}
console.log(`Schul-Edition vorbereitet: ${SCHUL_ID}, alle Funktionen frei, ohne In-App-Kauf.`);
