# Zirkelwerk – Projektwissen, Stand 0.10.3 (Bilder, Sicherung, Ordner, Körper & Würfelnetze)

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

## Fehlerdiagnose und gestufte Hilfen (0.7.0)

- `checkTask` ergänzt Befunde um `why` (aus `diagnose`): scale (180° − α), vertex,
  swap, offarc, radius, cm, close; Texte `why_*`.
- `taskProgress(task, objects)`: Musterlösung (`labSolutionSteps`) wird über A, B
  (Drehung, Spiegelung nach bester Übereinstimmung) auf die Schülerzeichnung gelegt;
  `stepDone` prüft je Lösungsschritt Strecken/Bögen/Punkte (Toleranz 2 mm, 3°).
  Ergebnis: `next` (Schrittindex) und `ghost` (Objekte in Schülerkoordinaten).
- Hilfe-Stufen: 1 Denkanstoß (`hint_<art>`), 2 nächster Schritt, 3 Geisterbild
  (orange gestrichelt, bis zur nächsten Änderung), 4 Lösung. `doc.help` = höchste Stufe.

## Grundkonstruktionen (0.7.0)

- `GEO_KINDS` msk, wh, lot, senk, par, umk, ink, thal; `GEO_TASKS[kind]` mit keys,
  valid, random, start (Ausgangsfigur, `m.giv`), solution (mit `m.say`), target bzw.
  circle (Prüfziel). `checkGeoTask` → Befunde `g_*` mit Diagnose (radii, small, …),
  Hinweis `g_noCompass` bei Geodreieck statt Zirkel.
- `m.giv`: Ausgangsfigur – in der Beschreibung ein Schritt „Gegeben …", zählt nicht
  als Schülerobjekt. `m.say`: fester Satz (`SAY_KEYS`), gleiche aufeinanderfolgende
  Sätze bilden einen Schritt. Gerade g: `m.name`.
- Aufgaben-Links: Koordinaten mit Vorzeichen (`zirkelwerk://a?…&k=msk&ax=…`).

## Rückmeldung und Abgaben (0.8.0)

- Link `zirkelwerk://r?v=1&d=<base64url>` mit `{t: Aufgabe, n: Name, ok, h: Hilfestufe,
  w: Codes, o?: Zeichnung}`; `linkForResult(r, mitZeichnung)`, Zeichnung ohne
  Plan-/Ausgangsfigur; passt sie nicht in den Code (M ≤ 22 / L ≤ 27), ohne Zeichnung.
- Codes = `resultCodes(check)`: Diagnose (`why`) vor Befundart (`k`); Kurztexte `res_*`.
- `parseLink` → kind 'result': Aufgabe per `sanitizeTask`, Name ≤ 30 Zeichen, Codes
  gefiltert, Zeichnung per `decodeObjs` (später `sanitizeDoc` beim Ansehen).
- Lehrkraft: Vollversion (`canCreateQr`). Ablage `localStorage['zw.results']`, höchstens
  600 Einträge; Schlüssel je Aufgabe `taskKey(task)`; gleicher Name → ersetzt.
  Auswertung `summarizeResults`. Schülername in `S.studentName`.
- Einstieg: Prüfdialog und Aufgabenmenü („Rückmeldung (QR)"), Lehrkraft unter
  „Meine Blätter → Abgaben"; eingehende Rückmeldung öffnet die Abgaben der Aufgabe.

## Video (0.9.0)

- `exportVideo`: Wiedergabe von vorn (`pbFirst`), Aufnahme-Leinwand = Zeichenflächen
  (höchstens 1920 breit) + Untertitelband; `captureStream(30)` + `MediaRecorder`
  (`videoMime`: mp4/avc1 bevorzugt, sonst webm). Bedienung gesperrt (`#recOverlay`,
  Zurück-Taste/Esc = Abbrechen). Ende: Geräte weg, 1,8 s Schlussbild.
- Auf echten Geräten prüfen: MediaRecorder/captureStream im WKWebView (iOS) bzw.
  Android-WebView; sonst Meldung „nicht verfügbar". Große Videos gehen als Data-URL
  ans Teilen-Plugin (Speicherbedarf beobachten).
- `safeFileBase`: ASCII-Dateinamen (Umlaute/Griechisch umschreiben).

## Robustheit (Durchsicht 0.7.0)

- IndexedDB: `dbRun` mit einem Wiederholversuch nach verlorener Verbindung,
  `onclose`; später Start (> 4 s) → Sitzung bleibt im Arbeitsspeicher.
- `saveNow` ist eine Warteschlange (`saveQueue`); `setSaveProblem` zeigt ⚠ in der
  Kopfleiste. Speichern auch bei visibilitychange/pagehide.
- Rechtstexte: `openLegal` lädt die Seite per fetch in `#legalPanel`
  (Rückfall: Seitenwechsel). Panels: zuletzt geöffnet liegt oben.
- `describe`: Punktsuche über Raster, `segName` gemerkt (identische Ausgabe).
- Build-Nummern bleiben aus der Version abgeleitet (Validator prüft); ein zweiter
  Upload derselben Version braucht eine neue Versionsnummer.

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

## Körper und Netze (0.10.0)

- Kern: `bodyNet` (Netz mit Faltbaum), `foldNet(net, t)` (3D bei Faltgrad t), `bodyFaces`,
  `bodyMeasures` (V, O), `netDrawing` (Kanten, Faltlinien, Klebelaschen aus Kantenpaaren),
  `obliqueDrawing` (Kavalierperspektive 45°, ½, verdeckte Kanten), `bodySheetObjects`.
- Körper: Würfel, Quader, Dreiecksprisma (Seiten a, b, c, Höhe h), quadratische Pyramide,
  Zylinder (nicht faltbar; Netz = Rechteck 2πr × h + zwei Kreise).
- Labor-Bereich „Körper & Netze": Eingabe in cm, 3D-Vorschau (Maler-Algorithmus,
  Drehen mit dem Finger), Falt-Regler/Animation, V und O zum Aufklappen.
- Strecken können gestrichelt sein (`d: 1`): Zeichnen, Speichern, QR-Link (Feld am Ende),
  PDF (`setLineDash` → `d`-Operator).

## Sprachförderung (0.10.0)

- Vorlesen (Web Speech API, nur wo vorhanden – im Android-WebView meist nicht): ganze
  Beschreibung („Vorlesen" in der Konstruktionsleiste) oder Schritt für Schritt beim
  Abspielen (Lautsprecher-Knopf, `S.speakSteps`); die Wiedergabe wartet, bis ausgesprochen
  ist; Punktnamen buchstabiert (`speechText`).
- Lückentext im PDF: `clozeSteps(steps, words)`, Fachwörter je Sprache in `clozeWords`,
  längste zuerst, nur ganze Wörter (ohne Lookbehind – iOS 15), Wortspeicher alphabetisch
  mit Anzahl.

## Prüfung 0.10.0 (zweite unabhängige Durchsicht)

- Speichern: höchstens 5 s Verzug; Hintergrund ohne Vorschaubild, Läufe zusammengefasst;
  Listener einmal; Löschen lässt das Blatt vorher los; spät startende Datenbank wird
  übernommen (`dbLateRecover`); Start weicht auf das nächste lesbare Blatt aus.
- Grenzen: beim Zeichnen (20 000 Objekte, lange Striche geteilt); gespeicherte Blätter
  werden gekürzt geladen (`sanitizeDoc(..., { stored: true })`), Importe bleiben streng.
- Leistung: Beschreibung mit Raster (`geoBefore`), Schnittpunkte mit Vorauswahl
  (bis 5000 Linien) und schrittweise beim Hinzufügen (`intersectionsAdded`),
  Zeichnen nur des sichtbaren Ausschnitts, Radierer mit Umriss-Vorfilter.
- Beschreibung: Senkrechte/Parallele nur, wenn am Geodreieck gezeichnet.
- Abgaben: Objekte aus Rückmelde-Links bereinigt; gleicher Name → Rückfrage.
- iOS-Import ohne Dateifilter; `file.text()`-Ersatz; kein `inset`.
- Android: `enableOnBackInvokedCallback="false"` (Zurück-Taste ab Android 16),
  `AndroidEdgeToEdge` aus; CI prüft beides.
- CI: Prüfkette in eigenem Job (Android), `persist-credentials: false`, `build.json` per jq,
  Privacy-Manifest nur der App ersetzen.
- Barrierefreiheit: Fokus in Fenster und zurück, `aria-pressed`, Richtungsnamen.
- CSP: `object-src 'none'; base-uri 'none'`.
- Offen/auf Gerät prüfen: Zurück-Taste Android 16, Ränder Android 15/16, iOS-Dateiauswahl,
  Vorlesen-Stimmen, `target=_blank` in den Rechtstexten.

## Bedienung nach dem ersten TestFlight (0.10.1)

- **Radierer:** Antippen = genau ein Objekt (`eraseTarget`: Punkte/Texte vor Linien),
  rot markiert bis zum Abheben. Wischen schneidet (`cutObject` → `cutSegment`, `cutArc`,
  `cutStroke`; Teile < `CUT_MIN` 0,8 mm fallen weg). Erstes Teil behält Kennung und
  Platz (`mod`), weitere direkt dahinter (`ins`); ein Wisch = ein `grp`-Eintrag.
- **Rückgängig:** neue Einträge `{t:'ins', items:[{obj,index}]}` und `{t:'grp', list}`.
- **Beschreibung:** Teilstücke einer Strecke (kollinear, gleiche Herkunft, Stoßenden
  unbenannt) und direkt folgende Bögen mit gleichem Mittelpunkt, Radius und `m.rs`
  bilden einen Schritt; Strecke wird als Ganzes beschrieben (`segUnion`), von bekanntem
  zu bekanntem Punkt als „Verbinde". Prüfung: `segCovered` akzeptiert Teilstücke.
- **Beschriftung ziehen:** Punkt-Werkzeug, Beschriftung greifen (`hitLabel`, gleiche
  Maße wie `drawPoint` über `labelBox`), Lage nach `labelDirFor` (8 Richtungen, erst ab
  10 Bildschirmpunkten Abstand); Antippen öffnet den Punkt.
- **Punkt verschieben:** langes Drücken (450 ms) auf einen Punkt mit `pointMovable`
  (frei gesetzt: kein Mittelpunkt, nicht auf Bogen/Strecke, kein `giv`/`plan`, kein
  Winkelscheitel); `pointMoveEntry` zieht Streckenenden mit; kein Einrasten beim Ziehen.
- **Lupe** (`drawLoupe`): beim Setzen mit dem Finger (nach Bewegung) und beim Verschieben,
  2×, über dem Finger bzw. seitlich am oberen Rand.
- **Stift-Modus:** Fingertipp ohne Bewegung öffnet Punkt/Text bzw. Beschriftung;
  ins Leere einmal Hinweis `msgFingerPans` (`S.fingerHint`).
- **Tastatur:** `fitToKeyboard` über `visualViewport`; bei offener Tastatur (> 80 pt
  verdeckt, Eingabefeld fokussiert) `body.kb` → Panels nur im sichtbaren Teil,
  `#dialogBody` scrollt. Android verkleinert selbst.
- Auf Gerät prüfen: Lupe/Verschieben mit dem Finger auf dem iPhone, Tastatur iPhone
  quer, Radierer-Markierung mit dem Pencil.

## Bilder, Sicherung, Ordner (0.10.2)

- **Bild-Objekt** `{type:'image', x, y, w, h, cr:[l,o,r,u], src, pw, ph, al}`: x/y/w/h = ganzes
  Bild in mm, `cr` = sichtbarer Ausschnitt in Anteilen (`imgRect`). Nur JPEG-Data-URL
  (`jpegFromDataUrl` liest Maße aus dem SOF, höchstens `IMG.maxChars` 6 MB, `IMG.maxPerDoc` 30).
  Einfügen: `shrinkImage` (Canvas, ≤ 1600 px, weißer Grund, JPEG 0,85 → kleiner bis 0,4).
- Gezeichnet zuerst (unter allem), Wiedergabe zeigt Bilder immer; `describe` überspringt sie,
  `encodeObjs` lässt sie weg (QR-Hinweis `msgQrNoImages`), Radierer: nur Antippen (Priorität
  nach Linien), nie Wischen.
- Bearbeiten (`imgSel`): Hand antippen wählt; Ecken = Größe (Gegenecke fest, Verhältnis bleibt),
  Kanten = `cr`, innen = schieben (`imgEditResult`), Leiste `#imgBar` (Blass/Löschen/Fertig).
- PDF: `PdfCanvas.imageObj` + `pdfImage` (Hex-verpacktes JPEG, `/ASCIIHexDecode /DCTDecode`,
  gleiche Bilder einmal) – Datei bleibt ASCII; coretest prüft mit qpdf und pdfimages.
- iOS: `NSCameraUsageDescription` (config.xml + beide `InfoPlist.strings`), CI-Schritt prüft.
- **Sicherung** `{format:'zirkelwerk-backup', v:1, docs, results}` (`makeBackup`, `readBackup`,
  `planRestore`: gleiche Kennung + Stand → übersprungen, anderer Stand → Kopie „(Sicherung)").
  Import erkennt Sicherungen (bis 150 MB). `S.lastBackup` für den Hinweis (`BACKUP_DUE_DAYS` 30).
  Hinweis: Wiederherstellen prüft die Grenze der kostenlosen Fassung nicht (Datenrettung).
- **Ordner** = Feld `folder` am Blatt (`cleanFolder`, `folderList`, `sameFolder` ohne Groß/klein);
  Filter `sheetFolder`, neue/importierte Blätter landen im gewählten Ordner.
- **Text verschieben**: Text-Werkzeug auf vorhandenem Text → `tmove` (ein `mod`).
- Validator: doppelte Übersetzungsschlüssel, Körperschlüssel aus `BODY_KINDS`, Kamera-Texte.

## Körper und Würfelnetze (0.10.2)

- **Abwickler** `unfoldFaces(F, parent)`: konvexe 3D-Flächen + Faltbaum → Netz (Kantenabstände
  bleiben, Faltwinkel aus den Normalen). `foldNet` faltet jetzt Eltern vor Kindern, unabhängig
  von der Listenreihenfolge.
- `bodySolid`: Prisma/Pyramide über beliebigem Polygon (Mantel als Streifen bzw. Stern, Kegel als
  Fächer), Oktaeder (Fächer + untere Dreiecke), Kugel als Globus (`SPHERE_BANDS` = 13, ungerade:
  Äquator mitten im Rechteckband → gerade Linie), `BODY_SEG` = 36 für Zylinder/Kegel.
  `bodySmooth`: Gruppen gekrümmter Flächen (keine Facettenkanten in 3D und Schrägbild).
- `BODY_INT`: ganzzahlige Angaben (n: Prisma/Pyramide 3–8, Kugelschalen 8–16), nicht in mm.
- Netze aufs Blatt: Polyeder allgemein (Laschen = Ecken − 1), Kegel exakt (Kreisausschnitt
  `arcs`, Laschen am Bogen), Kugel nur Schalenumrisse (`approx`).
- **Würfelnetze**: `hexominos()` erzeugt die 35 Sechslinge, `cubeRolls` prüft durch Abrollen
  → genau 11 (`cubeNets`, Kreuz zuerst). `gridNet(cells, a, root)`, Wurzel `gridRoot` (meiste
  Nachbarn) – für Prüfung (`cubeFoldCheck`) und Darstellung gleich, sonst weichen sie bei
  2 × 2-Blöcken ab. Kästchennetze falten nach −z.
- Quiz (`bodyState.quiz`): halb Netze, halb nicht, zufällig gedreht/gespiegelt; nach der Antwort
  Faltung, doppelt belegte Flächen rot, offene Seiten gestrichelt (Würfelraum aus allen Flächen).
- **3D-Ansicht (0.10.3):** `foldNet` faltet zur Unterseite der Netzebene (−z). Die Ansicht
  spiegelt dann (`bodyFlip`, im Szenen-Cache), damit Körper aufrecht stehen; Blattzeichnungen
  nutzen weiter `bodyFaces` (eigene Ausrichtung). Drehung als Matrix `bodyState.view`
  (Welt → x rechts, y Tiefe, z oben), Wischen = `m3RotZ(dx)`/`m3RotX(dy)` von links, `m3Ortho`
  gegen Drift, Doppeltippen → `bodyViewReset` (`bodyViewHome`).
- Großansicht `#bodyFull` (Panel, Escape/Zurück schließt), Zoom `bodyState.zoom`, Farben
  `bodyState.colors` (Gegenseiten gleich, gekrümmte Flächen einfarbig, `BODY_PALETTE`).
- Auf Gerät prüfen: Kamera beim Bild einfügen (iOS/Android), Großansicht iPhone, Faltleistung
  der Kugel mit 16 Schalen auf älteren iPads.

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
