# Zirkelwerk – Projektwissen, Stand 0.5.0 (Stufe 3c)

## Entscheidungen

- **Name:** Zirkelwerk (Deutsch), Compasswork (alle anderen Sprachen).
  Grundname in config.xml ist Compasswork; Deutsch kommt über
  `res/ios/de.lproj/InfoPlist.strings` und `res/android/values-de/strings.xml`.
  Entwicklungsregion iOS: `en` → Sprachen ohne eigene Datei fallen auf Englisch.
- **Paketkennung:** `de.zirkelwerk.app` (iOS und Android, unveränderlich nach dem ersten Upload).
- **Universal** (`target-device = universal`, seit 0.6.0): iPad und iPhone; Android Tablet und Handy.
  Nicht mehr auf iPad zurückstellbar, sobald hochgeladen. Store braucht iPhone-Bildschirmfotos (6,9").
- **Preis:** kostenlos + Einmalkauf „Vollversion" für 2,99 €, kein Abo, Familienfreigabe an.
  Produkt-ID: `de.zirkelwerk.app.vollversion` (nicht verbrauchbar).
- **Kostenlos:** alle Werkzeuge, bis 3 gespeicherte Blätter.
  **Vollversion (geplant):** unbegrenzte Blätter, automatische Konstruktionsbeschreibung,
  Kongruenzsätze-Labor, Aufgaben per QR-Code, Körper/Netze/Schrägbild, PDF-Export.
- **Keine Kids-Kategorie** (sonst Elternschranke vor jedem Kauf/Link), Kategorie Bildung, 4+.

## Technik

- Alles in `index.html`, ein Inline-Skript. Abschnitte: Sprachpakete → Kern → App.
- **Kern** (zwischen `==CORE-BEGIN==` und `==CORE-END==`): reine Geometrie ohne DOM –
  Schnittpunkte, Fangen, Rückgängig, Geräte-Geometrie, Prüfung importierter Dateien.
  `coretest.js` testet genau diesen Block in Node.
- **Weltmaß in Millimetern.** Karo 5 mm. Bildschirm: `ppm` (Punkte je mm) × Zoom.
  iPad: 132 Punkte/Zoll, iPad mini: 163, iPhones meist 153,3 (Tabelle in `detectScale`, mit dpr).
  Unbekannte Bildschirmmaße → Kalibrieren empfehlen. Handy (kurze Seite < 600 pt): Startzoom 50 %.
- **Zwei Canvas:** unten Papier und Zeichnung (nur bei Änderung neu), oben Geräte und Vorschau.
- **Eingabe:** Pointer Events. Stift zeichnet; sobald ein Stift erkannt wurde, verschieben
  Finger nur noch (Einstellung „Apple Pencil": automatisch/nur Stift/Finger auch).
  Handballen: Finger während eines Stiftstrichs werden ignoriert.
- **Speicher:** IndexedDB (`zirkelwerk` / `docs`), Einstellungen in localStorage (`zw.settings`).
  Gespeicherte Blätter laufen beim Laden durch `sanitizeDoc`.
- **Objekte:** point, segment, arc (cx, cy, r, a0, sweep – Vorzeichen = Drehsinn), stroke, text.
  Freihandstriche erzeugen keine Schnittpunkte.
- **Rückgängig:** Einträge add / del (mit Index zum Zeitpunkt) / mod, rückwärts zurückgespielt.

## Konstruktionsbeschreibung und Wiedergabe (Stufe 2)

- `describe(objects, lang, i18n[lang])` im Kern erzeugt Schritte `{ids, text, short}`.
  Befehlsform („Zeichne …", „Verbinde …", „Der Schnittpunkt … ist C.").
- Fast alles wird **aus der Geometrie erschlossen** (Mittelpunkt = benannter Punkt,
  Schnittpunkt = Punkt auf zwei früheren Linien, Senkrechte/Parallele über Winkel).
  Ein später beschrifteter Punkt in einem Schnittpunkt gilt als konstruiert.
- **Mitgeschrieben** wird nur: Strecke `m.via` (ruler/geo, für die Animation) und
  Bogen `m.rs` = `{t:'set'|'typed'|'taken', p:[idA,idB]}`. `sanitizeDoc` schreibt
  die Kennungen beim Laden um (Objekte werden neu nummeriert).
- Satzbausteine in i18n: `d_*` Sätze, `dv_*` Dativ-Satzteile, `s_*` Kurzformen.
- **Kostenlos:** Leiste (Kurzformen) und Wiedergabe. **Vollversion:** ausformulierte
  Beschreibung in der Leiste, Kopieren, Teilen (`canDescribe()`).
- Wiedergabe (`PB`): nur Verschieben/Zoomen, Werkzeuge gesperrt. Jede Animation hat
  eine Kennung, ein veralteter Lauf beendet sich selbst. Ansicht wird beim Start
  eingepasst (nur verkleinern, knapp unter 100 % → 100 %) und beim Ende wiederhergestellt.

## Kongruenzsätze-Labor (Stufe 3a)

- Konvention: c = AB unten, A links, B rechts, C oben; a = BC, b = AC, α bei A, β bei B.
- Grundvarianten: SSS (c, b, a), SWS (c, b, α), WSW (c, α, β), SsW (c, a, α).
- Kern: `solveTriangle` (Gründe ohne Lösung: ineq/angles/short), `labRandom(kind, rng)`,
  `labConstruction` (Objekte zum Vorführen), `labPlan` (Planfigur, `m.plan`),
  `checkTask` (Toleranz 1,5 mm / 1,5°, Spiegelbild ok), `sanitizeTask`.
- Neue Metadaten: Strecke `m.angle = {deg, sym}` (freier Schenkel), Strich/Text `m.plan`,
  Blatt `task = {kind, given}` (mm, Grad).
- Blätter aus dem Labor: Planfigur links, Konstruktion bei (0|0).
- Vollversion: Labor (`canUseLab()`). Prüfen einer Aufgabe ist kostenlos (für QR-Aufgaben in 3c).
- Entscheidungen 3b/3c: PDF mit Karo und Beschreibung nur auf Wunsch (Vollversion);
  QR-Aufgaben nur bei installierter App, ohne Webseite; öffnen kostenlos, erstellen Vollversion.

## PDF-Export (Stufe 3b)

- Eigener PDF-Schreiber im Kern (`pdfCompose`, `pdfLayout`, `PdfCanvas`, `pdfBuild`),
  keine Bibliothek. `PdfCanvas` bildet die Canvas-Befehle nach, die `drawObjects()`
  nutzt – PDF und Bildschirm teilen dieselbe Zeichenroutine.
- Schriften: Standard-14 (Helvetica, Helvetica-Bold, Symbol), nicht eingebettet.
  Breiten aus den Adobe-AFM (über reportlab erzeugt). Griechisch und Mathezeichen
  über Symbol, tiefgestellte Ziffern als kleine Helvetica-Ziffern, Rest „?".
- Datei ist reines ASCII (Oktal-Escapes) → xref-Positionen = Stringlänge;
  ausgegeben über `pdfBytes()`.
- Seite: A4, Rand 12 mm, Kopf 12 mm (Name/Datum), Aufgabenzeile 9 mm, Abstand um die
  Zeichnung 8 mm. Format automatisch (größerer Maßstab, Gleichstand → hoch).
  Maßstab 1 oder auf ganze Prozent abgerundet; Karo im Raster der Zeichnung.
- „Nur die Aufgabe": nur Objekte mit `m.plan`, immer hoch, 1 : 1, oben links;
  Beschreibung dann gesperrt (verriete die Lösung).
- Wahl im Dialog gilt für die Sitzung (`pdfOpts`), Karo startet mit der Papier-Einstellung.
- Prüfung: coretest (Struktur, xref, Stream-Längen, Bögen, Layout; qpdf/pdftotext,
  falls installiert), smoketest (Dialog, Download, qpdf).

## Aufgaben per QR-Code (Stufe 3c)

- Entscheidungen: Laboraufgaben + kleine Blätter; Scannen mit der Kamera-App (kein
  Kamerazugriff in Zirkelwerk); Anzeige groß auf dem Bildschirm; QR-Blätter zählen
  nicht zur Grenze der kostenlosen Fassung. Erstellen: Vollversion (`canCreateQr()`).
- Links: `zirkelwerk://a?v=1&k=sws&c=60&b=45&alpha=50` (mm, Grad) und
  `zirkelwerk://s?v=1&d=<base64url>` mit kompaktem JSON `{n, t?, o:[[typ, felder…, m]]}`.
  Lagen auf 1/10000 mm (Schnittpunkte bleiben für `describe` erkennbar), Winkel 6
  Stellen, Freihand in Zehntel-mm als Differenzen, Standardwerte als null/weggelassen,
  Abgriff-Verweise als Listenposition. `LINK_V` erhöhen, wenn sich das Format ändert.
- `parseLink` → `sanitizeTask` bzw. `sanitizeDoc`; Grenze 4000 Zeichen.
  Android-Plugin liefert teils prozentkodiert → wird erkannt.
- Doppeltes Scannen: `doc.src = linkKey(url)` (FNV-1a), `sanitizeDoc` behält `src`.
- QR: `qrEncode(bytes, level, maxVer)` Byte-Modus; App nutzt M bis Version 22,
  sonst L bis 27, sonst „zu groß". Bitgleich mit Python-`qrcode` geprüft, Bekannte-
  Antwort-Tests in coretest (Hash der Matrix).
- Einstieg: `window.handleOpenURL` (iOS: Cordova selbst, CDVHandleOpenURL;
  Android: cordova-plugin-customurlscheme 5.0.2). Kaltstart: Link wird gemerkt und
  am Ende von `init()` verarbeitet. Android `AndroidLaunchMode = singleTask`.
- CI prüft: iOS `CFBundleURLTypes` = zirkelwerk; Android intent-filter, singleTask,
  kein Filter mit Schema " ".
- Auf echten Geräten noch zu bestätigen: Kamera-App bietet „In Zirkelwerk öffnen" an
  (iOS); Android-Kamera/Google Lens öffnen eigene Schemata nicht immer.

## Geräte

- Lineal 20 cm (passt auf jedes iPad bei 100 %), Skala an der Oberkante.
- Zahlen auf Lineal und Geodreieck stehen nie kopf: ab 90° Drehung wird jede Zahl um
  ihre Mitte gedreht (`textFlip`, `uprightText`).
- Kopfleiste: Was nicht passt, wandert ins „⋯"-Menü (`layoutTopbar`, gemessen;
  Reihenfolge Hilfe, Einstellungen, PDF, Zoom ±, Konstruktion, Labor).
- Hilfe & Über in einem Fenster: Kurzanleitung, Über, Sprache, Impressum, Datenschutz;
  Sprachwahl zusätzlich oben beim ersten Start.
- Geodreieck 16 cm Hypotenuse, mm-Skala ±7 cm, Gradskala an den Katheten (zwei Reihen).
- Zirkel: Spitze ziehen = einstechen (rastet ein), Mine ziehen = aufziehen/abgreifen,
  Griff drehen = Bogen. Schloss hält den Radius; Radius per Eingabe setzt das Schloss.
- Einrasten (abschaltbar): Punkte, Schnittpunkte, Endpunkte, Zirkel-Einstich,
  Länge auf ganze mm, Drehung auf ganze Grad / 45° / parallel-senkrecht zu nahen Strecken,
  Lineal-Kante an einen oder zwei Punkte, Geodreieck-Nullpunkt auf Punkte.

## Prüfkette

`node make-legal-pages.js`, `node validate.js`, `node coretest.js`, `node smoketest.js`, `./mutate.sh`.
CI: Node 22, Playwright 1.63.0 für den Ablauftest.

## Beim ersten CI-Lauf genau ansehen

- iOS: Schritt „Erzeugtes Projekt bestätigen" – Sprachdateien eingebunden?
  Gerätefamilie 1,2 (iPhone und iPad)? Falls cordova-ios die `.lproj`-Dateien nicht als
  Sprachvarianten einträgt, braucht es einen kleinen Hook.
- Android: deutscher App-Name in `values-de`. **Nie `cordova clean android` vor einer
  Prüfung:** es löscht alle `<resource-file>`-Kopien (cleanFileResources). Englischer
  Grundname steht bei cordova-android 15 in `values/cdv_strings.xml`.

## Offen

- In-App-Kauf aktivieren (siehe Kommentar in config.xml; `IAP_ENABLED`, `LIMITS_ACTIVE`).
- Store-Texte und Bildschirmfotos.
