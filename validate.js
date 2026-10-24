/* Zirkelwerk – statische Prüfung.  node validate.js
 *
 * Findet, was keine Laufzeitprüfung sieht: fehlende Übersetzungen,
 * Tippfehler in IDs und Handlern, auseinanderlaufende Versionsnummern,
 * vergessene Rechtstexte für GitHub Pages, Icons in falscher Größe.
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const html = fs.readFileSync('index.html', 'utf8');
const errors = [], warns = [], oks = [];
const E = m => errors.push(m), W = m => warns.push(m), O = m => oks.push(m);
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;

/* ---------- 1. Skript ---------- */
const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) E(`Erwartet 1 Inline-Skript, gefunden: ${scripts.length}`);
const js = scripts.join('\n');
try { new vm.Script(js, { filename: 'inline.js' }); O('JavaScript-Syntax gültig'); }
catch (e) { E('Syntaxfehler: ' + e.message); }

/* ---------- 2. Sprachpakete ---------- */
let packs = null;
try {
  const ctx = {};
  vm.createContext(ctx);
  const s = js.indexOf('const i18n = {'), e = js.indexOf('\n};', s) + 3;
  vm.runInContext(js.slice(s, e) + '\nthis.P = i18n;', ctx);
  packs = ctx.P;
} catch (e) { E('Sprachpakete nicht lesbar: ' + e.message); }

if (packs) {
  const de = Object.keys(packs.de), en = Object.keys(packs.en);
  const mEn = de.filter(k => !en.includes(k)), mDe = en.filter(k => !de.includes(k));
  if (mEn.length) E('Fehlt in EN: ' + mEn.join(', '));
  if (mDe.length) E('Fehlt in DE: ' + mDe.join(', '));
  if (!mEn.length && !mDe.length) O(`Sprachpakete vollständig (${de.length} Schlüssel)`);
  for (const l of ['de', 'en']) {
    const empty = Object.keys(packs[l]).filter(k => !String(packs[l][k]).trim());
    if (empty.length) E(`Leere Texte (${l}): ${empty.join(', ')}`);
    /* Platzhalter müssen in beiden Sprachen gleich sein */
  }
  for (const k of de) {
    const ph = s => (String(s).match(/\{[a-z]+\}/g) || []).sort().join();
    if (packs.en[k] !== undefined && ph(packs.de[k]) !== ph(packs.en[k])) E(`Platzhalter unterschiedlich: ${k}`);
  }
  /* Doppelte Schlüssel innerhalb einer Sprache: In einem Objektliteral gewinnt
     still der spätere – so überschrieb „msgRestored" der Sicherung den Text
     für die wiederhergestellte Vollversion. */
  {
    const src = js.slice(js.indexOf('const i18n = {'), js.indexOf('\n};', js.indexOf('const i18n = {')));
    const parts = src.split(/\n  (?=(?:de|en): \{)/).slice(1);
    let dupFound = false;
    for (const part of parts) {
      const l = part.slice(0, 2), seen = new Map();
      /* Schlüssel am Zeilenanfang oder nach Komma/Klammer, gefolgt von einem String */
      for (const m of part.matchAll(/(?:^|[\n,{]\s*)([A-Za-z_][A-Za-z0-9_]*): ['"`]/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
      const dup = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
      if (dup.length) { E(`Doppelte Schlüssel (${l}): ${dup.join(', ')}`); dupFound = true; }
    }
    if (!dupFound) O('Keine doppelten Übersetzungsschlüssel');
  }
  const used = new Set();
  for (const a of ['data-i18n', 'data-i18n-aria']) for (const m of html.matchAll(new RegExp(a + '="([^"]+)"', 'g'))) used.add(m[1]);
  for (const m of js.matchAll(/\bt\('([A-Za-z0-9_]+)'\s*[,)]/g)) used.add(m[1]);
  /* Zusammengesetzte Schlüssel */
  for (const d of ['ipad', 'ipadmini', 'iphone', 'android', 'desktop']) used.add('device_' + d);
  used.add('paywall_sheets'); used.add('paywall_describe'); used.add('paywall_lab'); used.add('paywall_pdf'); used.add('paywall_qr'); used.add('msgQrNewer');
  /* Schalter im PDF-Dialog: Schlüssel stehen als Daten in rows */
  for (const k of ['pdf_grid', 'pdf_head', 'pdf_desc', 'pdf_descHint', 'pdf_taskOnly', 'pdf_taskOnlyHint']) used.add(k);
  for (const k of ['sss', 'sws', 'wsw', 'ssw']) { used.add('lab_desc_' + k); used.add('lab_kind_' + k); }
  /* Körper: Schlüssel aus BODY_KINDS gebildet */
  /* Körper: Schlüssel aus BODY_KINDS (weiter unten gelesen, listOf ist noch nicht definiert) */
  { const m = js.match(/const BODY_KINDS = \[([^\]]*)\]/); for (const k of m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []) { used.add('body_' + k); used.add('bodyDesc_' + k); } }
  for (let i = 0; i < 8; i++) used.add('dir' + i);   /* Lage der Beschriftung, aus der Richtungsnummer */
  for (const k of ['ineq', 'angles', 'short']) used.add('lab_none_' + k);
  for (const k of ['ineq', 'angles', 'short', 'two']) used.add('note_' + k);
  for (const k of ['lab_sheetTask', 'lab_sheetSolution', 'lab_sheetDemo']) used.add(k); used.add('pbCount1'); used.add('ariaPbPause'); used.add('ariaPbPlay');
  /* Schlüssel als Daten (z. B. in Tabellen) und Diagnosen (why: 'scale' → why_scale) */
  for (const m of js.matchAll(/'([A-Za-z][A-Za-z0-9_]*)'/g)) if (de.includes(m[1])) used.add(m[1]);
  for (const m of js.matchAll(/\bwhy: '([a-z]+)'/g)) used.add('why_' + m[1]);
  /* Grundkonstruktionen, Farben, feste Sätze: Schlüssel aus Listen im Code */
  const listOf = name => { const m = js.match(new RegExp('const ' + name + ' = \\[([^\\]]*)\\]')); return m ? [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]) : []; };
  for (const k of listOf('GEO_KINDS')) for (const p of ['geo_', 'task_', 'hint_']) used.add(p + k);
  for (const k of ['msk', 'wh', 'lot', 'senk', 'par']) used.add('chk_g_none_' + k);
  for (const m of js.matchAll(/\.why = '([A-Za-z]+)'/g)) used.add('why_' + m[1]);
  for (const k of listOf('SAY_KEYS')) { used.add('d_say_' + k); used.add('s_say_' + k); }
  for (const c of listOf('PENCIL_COLORS').concat(listOf('MARKER_COLORS'))) used.add('col_' + c.slice(1));
  for (const m of js.matchAll(/\bk: 'g_([A-Za-z]+)'/g)) used.add('chk_g_' + m[1]);
  for (const m of js.matchAll(/notes\.push\('([A-Za-z_]+)'\)/g)) used.add('note_' + m[1]);
  for (const k of ['angle_perp', 'angle_par', 'angle_wh']) used.add('chk_g_' + k);
  for (const k of ['umkCenter', 'inkCenter', 'inkRadius']) used.add('why_' + k);
  used.delete('chk_g_angle'); used.delete('chk_g_none');
  /* Satzbausteine der Konstruktionsbeschreibung (fill('d_…') usw.) */
  for (const m of js.matchAll(/'((?:d|dv|s)_[A-Za-z0-9]+)'/g)) used.add(m[1]);
  for (const k of ['d_perp', 'd_par']) used.add(k + 'U');
  /* Zugriff über das Sprachpaket im Kern: T.lab_planTitle usw. */
  for (const m of js.matchAll(/\bT\.([A-Za-z0-9_]+)/g)) used.add(m[1]);
  for (const k of ['sizeSmall', 'sizeMedium', 'sizeLarge', 'styleMarker', 'styleColor', 'ariaLock', 'ariaUnlock']) used.add(k);
  /* Kurzbezeichnungen der Befunde in den Abgaben: zu jeder Diagnose und jeder Befundart */
  used.add('paywall_results');
  for (const m of js.matchAll(/showPaywall\('([a-z]+)'\)/g)) used.add('paywall_' + m[1]);
  for (const k of [...used]) {
    if (k.startsWith('why_')) used.add('res_' + k.slice(4));
    if (k.startsWith('chk_g_') && !/^chk_g_(angle_|none_)/.test(k)) used.add('res_g_' + k.slice(6));
  }
  for (const k of ['g_angle', 'g_none', 'missing', 'degenerate', 'side', 'angle', 'sides', 'other']) used.add('res_' + k);
  used.delete('res_g_angle_perp');
  const missing = [...used].filter(k => !de.includes(k));
  if (missing.length) E('Benutzte, aber nicht definierte Schlüssel: ' + missing.join(', '));
  else O(`Alle ${used.size} benutzten Schlüssel definiert`);
  const unused = de.filter(k => !used.has(k));
  if (unused.length) W('Nicht benutzte Schlüssel: ' + unused.join(', '));
  if (packs.de.appName !== 'Zirkelwerk' || packs.en.appName !== 'Compasswork') E('appName muss Zirkelwerk / Compasswork sein');
}

/* ---------- 3. IDs, Handler, Symbole ---------- */
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
if (dup.length) E('Doppelte IDs: ' + [...new Set(dup)].join(', '));
const dynamicIds = new Set(['chipCompass', 'chipRuler', 'chipGeo', 'chipLive']);
const refIds = new Set([...js.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
const missIds = [...refIds].filter(x => !ids.includes(x) && !dynamicIds.has(x));
if (missIds.length) E('getElementById auf fehlende IDs: ' + missIds.join(', '));
else O(`${refIds.size} ID-Verweise gültig`);

const fnNames = new Set([...js.matchAll(/(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/g)].map(m => m[1]));
const handlers = [...html.matchAll(/\son(?:click|input|change)="([A-Za-z0-9_]+)\(/g)].map(m => m[1]);
const KEYWORDS = new Set(['if', 'return', 'switch', 'while', 'for']);
const missFn = [...new Set(handlers)].filter(f => !KEYWORDS.has(f) && !fnNames.has(f));
if (missFn.length) E('Handler ohne Funktion: ' + missFn.join(', '));
else O(`${new Set(handlers).size} Handler vorhanden`);

const iconBlock = js.slice(js.indexOf('const ICONS = {'), js.indexOf('};', js.indexOf('const ICONS = {')));
const iconNames = new Set([...iconBlock.matchAll(/^\s+([A-Za-z0-9]+):/gm)].map(m => m[1]));
const usedIcons = new Set([...html.matchAll(/data-icon="([^"]+)"/g)].map(m => m[1]));
for (const m of js.matchAll(/'icon:([a-z]+)'/g)) usedIcons.add(m[1]);
const missIcons = [...usedIcons].filter(n => !iconNames.has(n));
if (missIcons.length) E('Unbekannte Symbole: ' + missIcons.join(', '));
else O(`${usedIcons.size} Symbole vorhanden`);

/* Werkzeuge in HTML und ENUMS gleich */
const htmlTools = [...html.matchAll(/data-tool="([a-z]+)"/g)].map(m => m[1]).sort().join();
const enumTools = (js.match(/tool: \[([^\]]+)\]/) || ['', ''])[1].replace(/['\s]/g, '').split(',').sort().join();
if (htmlTools !== enumTools) E(`Werkzeuge in HTML (${htmlTools}) und ENUMS (${enumTools}) verschieden`);

/* Keine Fremdinhalte */
const ext = [...html.matchAll(/\s(?:src|href)="(https?:[^"]+)"/g)].map(m => m[1]);
if (ext.length) E('Externe Ressourcen in index.html: ' + ext.join(', '));
else O('Keine externen Ressourcen');
if (/innerHTML\s*=(?!\s*iconSvg)/.test(js)) W('innerHTML-Zuweisung gefunden – nur für feste Symbole erlaubt');

/* ---------- 4. Versionen und Kennung ---------- */
const version = (js.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const bundle = (js.match(/const BUNDLE_ID = '([^']+)'/) || [])[1];
const cfgRaw = read('config.xml') || '';
/* Kommentare zählen nicht – dort steht z. B. „Kein <access origin="*">". */
const cfg = cfgRaw.replace(/<!--[\s\S]*?-->/g, '');
const cv = (cfg.match(/<widget[^>]*\sversion="([^"]+)"/) || [])[1];
const vcode = (cfg.match(/android-versionCode="(\d+)"/) || [])[1];
const icode = (cfg.match(/ios-CFBundleVersion="(\d+)"/) || [])[1];
const cid = (cfg.match(/<widget id="([^"]+)"/) || [])[1];
if (!version || version !== cv) E(`APP_VERSION (${version}) ≠ config.xml version (${cv})`);
else {
  const [a, b, c] = version.split('.').map(Number);
  const expected = String(a * 10000 + b * 100 + c);
  if (vcode !== expected) E(`android-versionCode ${vcode}, erwartet ${expected}`);
  if (icode !== expected) E(`ios-CFBundleVersion ${icode}, erwartet ${expected}`);
  if (vcode === expected && icode === expected) O(`Version ${version} / Build ${expected} überall gleich`);
}
if (bundle !== cid) E(`BUNDLE_ID (${bundle}) ≠ config.xml id (${cid})`);
/* Doku auf demselben Stand: Überschrift im Projektwissen, oberster Eintrag der Änderungen */
const pw = ((read('PROJEKTWISSEN.md') || '').match(/^# .*Stand ([\d.]+)/) || [])[1];
const ch = ((read('AENDERUNGEN.md') || '').match(/^## ([\d.]+)/m) || [])[1];
if (pw !== version) E(`PROJEKTWISSEN.md nennt Stand ${pw}, App ist ${version}`);
if (ch !== version) E(`AENDERUNGEN.md beginnt mit ${ch}, App ist ${version}`);
if (pw === version && ch === version) O(`Doku auf Stand ${version}`);
const sw = read('sw.js') || '';
const cache = (sw.match(/const CACHE = '([^']+)'/) || [])[1];
if (cache !== 'zirkelwerk-' + version) E(`Service-Worker-Cache ${cache}, erwartet zirkelwerk-${version}`);
const swAssets = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
const missAssets = swAssets.filter(f => !fs.existsSync(f));
if (missAssets.length) E('sw.js nennt fehlende Dateien: ' + missAssets.join(', '));

/* ---------- 5. config.xml ---------- */
if (/<access\s+origin="\*"/.test(cfg)) E('config.xml erlaubt <access origin="*">');
for (const key of ['ITSAppUsesNonExemptEncryption', 'NSPhotoLibraryAddUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSCameraUsageDescription', 'CFBundleDevelopmentRegion']) {
  if (!cfg.includes(key)) E('config.xml: ' + key + ' fehlt');
}
/* Bilder einfügen (0.10.2): Der Dateidialog bietet die Kamera an. Ohne Begründung
   beendet iOS die App beim Antippen von „Foto aufnehmen" – in jeder Sprache. */
if (/accept="image\//.test(html)) {
  for (const l of ['de', 'en']) {
    const st = read('res/ios/' + l + '.lproj/InfoPlist.strings') || '';
    for (const key of ['NSCameraUsageDescription', 'NSPhotoLibraryUsageDescription']) if (!new RegExp('"' + key + '" = "[^"]{20,}";').test(st)) E(l + '.lproj: ' + key + ' fehlt (Bilder einfügen)');
  }
}
const resFiles = [...cfg.matchAll(/<(?:icon|splash|resource-file)[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
const missRes = resFiles.filter(f => !fs.existsSync(f));
if (missRes.length) E('config.xml nennt fehlende Dateien: ' + missRes.join(', '));
else O(`${resFiles.length} Ressourcen aus config.xml vorhanden`);
if (!/<name>Compasswork<\/name>/.test(cfg)) E('config.xml: <name> muss Compasswork sein (englischer Grundname)');
const deStrings = read('res/android/values-de/strings.xml') || '';
if ((deStrings.match(/>Zirkelwerk</g) || []).length !== 3) E('values-de/strings.xml: app_name, launcher_name, activity_name müssen Zirkelwerk sein');
if (!(read('res/ios/de.lproj/InfoPlist.strings') || '').includes('"CFBundleDisplayName" = "Zirkelwerk"')) E('de.lproj: Anzeigename fehlt');
if (!(read('res/ios/en.lproj/InfoPlist.strings') || '').includes('"CFBundleDisplayName" = "Compasswork"')) E('en.lproj: Anzeigename fehlt');
if (!(read('res/ios/PrivacyInfo.xcprivacy') || '').includes('CA92.1')) E('PrivacyInfo.xcprivacy ohne Grund CA92.1');

/* Kauf: Schalter und Plugin müssen zusammenpassen */
const iapOn = /const IAP_ENABLED = true/.test(js), limitsOn = /const LIMITS_ACTIVE = true/.test(js);
const pluginOn = /<plugin name="cordova-plugin-purchase"/.test(cfg);
if (iapOn !== pluginOn) E(`IAP_ENABLED (${iapOn}) passt nicht zum Kauf-Plugin in config.xml (${pluginOn})`);
if (limitsOn && !iapOn) E('LIMITS_ACTIVE ohne IAP_ENABLED: Nutzer könnten gesperrt werden, ohne kaufen zu können');
if (!iapOn) W('In-App-Kauf noch abgeschaltet (vorbereitet)');

/* ---------- 6. Bilder ---------- */
function pngSize(f) {
  const b = fs.readFileSync(f);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), alpha: b[25] === 6 || b[25] === 4 };
}
let manifest = null;
try { manifest = JSON.parse(read('manifest.json')); } catch (e) { E('manifest.json ungültig: ' + e.message); }
if (manifest) {
  for (const ic of manifest.icons) {
    if (!fs.existsSync(ic.src)) { E('Manifest-Icon fehlt: ' + ic.src); continue; }
    const s = pngSize(ic.src), [w, h] = ic.sizes.split('x').map(Number);
    if (!s || s.w !== w || s.h !== h) E(`${ic.src}: ${s && s.w}x${s && s.h}, Manifest sagt ${ic.sizes}`);
  }
}
const iosIcons = fs.existsSync('res/ios') ? fs.readdirSync('res/ios').filter(f => /^icon-\d+\.png$/.test(f)) : [];
const alphaIcons = iosIcons.filter(f => { const s = pngSize(path.join('res/ios', f)); return !s || s.alpha; });
if (alphaIcons.length) E('iOS-Icons mit Alphakanal: ' + alphaIcons.join(', '));
else if (iosIcons.length) O(`${iosIcons.length} iOS-Icons ohne Alphakanal`);

/* ---------- 7. Rechtstexte ---------- */
try {
  const { erwarteteDateien } = require('./make-legal-pages.js');
  const diff = Object.entries(erwarteteDateien()).filter(([f, c]) => read(f) !== c).map(([f]) => f);
  if (diff.length) E('docs/ veraltet – bitte „node make-legal-pages.js" ausführen: ' + diff.join(', '));
  else O('Rechtstexte für GitHub Pages aktuell');
} catch (e) { E('make-legal-pages.js: ' + e.message); }
for (const f of ['impressum.html', 'datenschutz.html', 'impressum-en.html', 'datenschutz-en.html']) {
  const c = read(f);
  if (!c) { E(f + ' fehlt'); continue; }
  if (!c.includes('href="index.html"')) E(f + ': Knopf zurück zur App fehlt (iOS hat keine Zurück-Taste)');
  if (/FairMix/.test(c)) E(f + ': enthält noch „FairMix"');
}

/* ---------- Ausgabe ---------- */
for (const m of oks) console.log('  ✓ ' + m);
for (const m of warns) console.log('  ! ' + m);
for (const m of errors) console.log('  ✗ ' + m);
console.log(`\nValidator: ${oks.length} ok, ${warns.length} Hinweise, ${errors.length} Fehler`);
if (errors.length) process.exit(1);
