/* Erzeugt aus den Rechtstexten der App die Fassungen für GitHub Pages.
 *
 *   node make-legal-pages.js
 *
 * Die Dateien im Wurzelverzeichnis sind die einzige Quelle. Im Web gibt es
 * keine index.html der App – Pages liefert nur docs/, der Quelltext wird
 * nicht mit veröffentlicht. „Zurück zur App" zeigt dort deshalb auf die
 * Übersichtsseite. Kein Verweis in einen bestimmten Store: Diese Seite ist
 * auch die Datenschutz-Adresse im App Store, und Apples Richtlinie 2.3.10
 * untersagt Verweise auf andere Plattformen in den Metadaten.
 *
 * validate.js führt dieselbe Umformung im Speicher aus und vergleicht.
 * Wer einen Rechtstext ändert und dieses Skript vergisst, fällt durch.
 */
const fs = require('fs');
const path = require('path');

const ZIEL = 'docs';
const ORDNER = 'zirkelwerk';

function fuerWeb(html) {
  return html
    .replace(/href="index\.html">Zurück zur App</g, 'href="../">Zur Übersicht<')
    .replace(/href="index\.html">Back to the app</g, 'href="../">Overview<')
    .replace(/<title>([^<]*)<\/title>/, '<title>$1</title>\n<meta name="robots" content="index, follow">');
}

const START = `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Zirkelwerk – Rechtliches</title>
<meta name="theme-color" content="#234e8c">
<style>
  :root { --bg:#f1ede4; --card:#fff; --text:#1d2a3a; --border:#234e8c; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#16181d; --card:#23272f; --text:#e9ecf1; --border:#8db4f0; }
  }
  body { margin:0; padding:24px 16px; background:var(--bg); color:var(--text);
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; line-height:1.5; }
  main { max-width:640px; margin:0 auto; background:var(--card);
         border:2px solid var(--border); border-radius:14px; padding:24px; }
  h1 { font-size:24px; margin:0 0 8px; }
  h2 { font-size:18px; margin:24px 0 8px; }
  ul { margin:0; padding-left:20px; }
  li { margin:6px 0; }
  a { color:var(--border); }
</style>
</head>
<body>
<main>
  <h1>Zirkelwerk · Compasswork</h1>
  <p>Rechtliche Angaben zur App von Wisdompeak Apps – Simon Mählmann.</p>

  <h2>Deutsch</h2>
  <ul>
    <li><a href="${ORDNER}/datenschutz.html">Datenschutzerklärung</a></li>
    <li><a href="${ORDNER}/impressum.html">Impressum</a></li>
  </ul>

  <h2>English</h2>
  <ul>
    <li><a href="${ORDNER}/datenschutz-en.html">Privacy policy</a></li>
    <li><a href="${ORDNER}/impressum-en.html">Legal notice</a></li>
  </ul>

  <p>Kontakt / Contact: <a href="mailto:smaehlmann.appdev@gmail.com">smaehlmann.appdev@gmail.com</a></p>
</main>
</body>
</html>
`;

function erwarteteDateien() {
  const out = {
    [path.join(ZIEL, 'index.html')]: START,
    [path.join(ZIEL, '.nojekyll')]: ''
  };
  for (const f of ['datenschutz.html', 'impressum.html', 'datenschutz-en.html', 'impressum-en.html']) {
    out[path.join(ZIEL, ORDNER, f)] = fuerWeb(fs.readFileSync(f, 'utf8'));
  }
  return out;
}

module.exports = { erwarteteDateien, ZIEL };

if (require.main === module) {
  const dateien = erwarteteDateien();
  for (const [ziel, inhalt] of Object.entries(dateien)) {
    fs.mkdirSync(path.dirname(ziel), { recursive: true });
    fs.writeFileSync(ziel, inhalt);
    console.log('  ' + ziel);
  }
  console.log(Object.keys(dateien).length + ' Dateien geschrieben.');
  console.log('GitHub Pages: Settings → Pages → Branch main, Ordner /docs');
}
