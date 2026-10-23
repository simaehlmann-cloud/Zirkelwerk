# Zirkelwerk – Projektwissen, Stand 0.1.0 (Stufe 1)

## Entscheidungen

- **Name:** Zirkelwerk (Deutsch), Compasswork (alle anderen Sprachen).
  Grundname in config.xml ist Compasswork; Deutsch kommt über
  `res/ios/de.lproj/InfoPlist.strings` und `res/android/values-de/strings.xml`.
  Entwicklungsregion iOS: `en` → Sprachen ohne eigene Datei fallen auf Englisch.
- **Paketkennung:** `de.zirkelwerk.app` (iOS und Android, unveränderlich nach dem ersten Upload).
- **iPad-only** (`target-device = tablet`). Umkehrbar zu „universal", aber nicht umgekehrt.
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
  iPad: 132 Punkte/Zoll, iPad mini: 163. Unbekannte Bildschirmmaße → Kalibrieren empfehlen.
- **Zwei Canvas:** unten Papier und Zeichnung (nur bei Änderung neu), oben Geräte und Vorschau.
- **Eingabe:** Pointer Events. Stift zeichnet; sobald ein Stift erkannt wurde, verschieben
  Finger nur noch (Einstellung „Apple Pencil": automatisch/nur Stift/Finger auch).
  Handballen: Finger während eines Stiftstrichs werden ignoriert.
- **Speicher:** IndexedDB (`zirkelwerk` / `docs`), Einstellungen in localStorage (`zw.settings`).
  Gespeicherte Blätter laufen beim Laden durch `sanitizeDoc`.
- **Objekte:** point, segment, arc (cx, cy, r, a0, sweep – Vorzeichen = Drehsinn), stroke, text.
  Freihandstriche erzeugen keine Schnittpunkte.
- **Rückgängig:** Einträge add / del (mit Index zum Zeitpunkt) / mod, rückwärts zurückgespielt.

## Geräte

- Lineal 20 cm (passt auf jedes iPad bei 100 %), Skala an der Oberkante.
- Geodreieck 16 cm Hypotenuse, mm-Skala ±7 cm, Gradskala an den Katheten (zwei Reihen).
- Zirkel: Spitze ziehen = einstechen (rastet ein), Mine ziehen = aufziehen/abgreifen,
  Griff drehen = Bogen. Schloss hält den Radius; Radius per Eingabe setzt das Schloss.
- Einrasten (abschaltbar): Punkte, Schnittpunkte, Endpunkte, Zirkel-Einstich,
  Länge auf ganze mm, Drehung auf ganze Grad / 45° / parallel-senkrecht zu nahen Strecken,
  Lineal-Kante an einen oder zwei Punkte, Geodreieck-Nullpunkt auf Punkte.

## Prüfkette

`node make-legal-pages.js`, `node validate.js`, `node coretest.js`, `node smoketest.js`.
CI: Node 22, Playwright 1.63.0 für den Ablauftest.

## Beim ersten CI-Lauf genau ansehen

- iOS: Schritt „Erzeugtes Projekt bestätigen" – Sprachdateien eingebunden?
  Gerätefamilie nur iPad? Falls cordova-ios die `.lproj`-Dateien nicht als
  Sprachvarianten einträgt, braucht es einen kleinen Hook.
- Android: deutscher App-Name in `values-de`.

## Offen

- In-App-Kauf aktivieren (siehe Kommentar in config.xml; `IAP_ENABLED`, `LIMITS_ACTIVE`).
- Store-Texte und Bildschirmfotos.
- Stufe 2: Konstruktionsprotokoll, Schritt-für-Schritt-Wiedergabe, automatische Beschreibung.
