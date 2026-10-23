# Änderungen

## 0.6.0 – iPhone und Handy (Oktober 2026)

- **Universal:** iPad und iPhone (iOS), Tablet und Handy (Android); Hoch- und Querformat
- **Echte Größe auf dem iPhone:** Bildschirmmaße aller aktuellen Modelle hinterlegt
- Handy: neue Blätter und Aufgaben starten mit 50 % statt in Originalgröße
- **Kopfleiste in schmalen Fenstern** (Handy, iPad in Split View/Slide Over): was
  nicht passt, kommt ins „⋯"-Menü; vorher wurden Hilfe und Einstellungen abgeschnitten
- Handy quer: Werkzeugleiste zweispaltig, alles ohne Blättern erreichbar
- **Zahlen auf Lineal und Geodreieck immer lesbar**, auch wenn das Gerät gedreht ist
- **Hilfe & Über** in einem Fenster: Kurzanleitung, „Über Zirkelwerk", Version,
  Sprache (Flaggen), Impressum, Datenschutz; beim ersten Start Sprachwahl ganz oben
- Einstellungen: Knopf „Kurzanleitung"

## 0.5.0 – Stufe 3c (Oktober 2026)

- **Aufgaben per QR-Code** (Vollversion zum Erstellen, Öffnen für alle):
  im Labor („QR-Code"), im Aufgabenmenü „⋯" („QR-Code für die Klasse") und über
  „⋯" in der Blattliste („Als QR-Code")
- Großer Code für den Beamer, immer auf Weiß, mit der Aufgabe als Überschrift
- Schüler scannen mit der Kamera-App; ist Zirkelwerk installiert, öffnet sich die
  Aufgabe als neues Blatt – auch über die Grenze von 3 Blättern hinaus
- Zweimal gescannt → dasselbe Blatt wird wieder geöffnet, kein Doppel
- Laboraufgaben als kurzer Link (`zirkelwerk://a?…`), eigene Blätter als kompakter
  Link (`zirkelwerk://s?…`), solange sie in den Code passen; sonst Hinweis auf den
  Datei-Export
- Alles Ankommende wird geprüft wie eine importierte Datei; Links aus einer neueren
  Version melden „Bitte aktualisieren"
- Eigener QR-Erzeuger ohne Bibliothek (bitgenau wie die Referenz geprüft)
- Datenschutzerklärung: PDF-Export und QR-Codes ergänzt (keine Kamera, nichts übertragen)
- Android: ein Link aus der Kamera startet keine zweite App-Instanz (singleTask)

## 0.4.0 – Stufe 3b (Oktober 2026)

- **PDF-Export** (Blatt-Symbol mit Pfeil oben oder „⋯" in der Blattliste, Vollversion):
  A4, Vektorgrafik, ohne Internet erzeugt
- In **Originalgröße**, wenn die Zeichnung auf A4 passt; sonst auf ganze Prozent
  verkleinert, mit Hinweis „Verkleinert auf … %"
- Hoch- oder Querformat automatisch, je nachdem, wo die Zeichnung größer herauskommt
- Wählbar: Karopapier (im Raster der Zeichnung), Zeile für Name und Datum,
  Konstruktionsbeschreibung (unter der Zeichnung oder auf Folgeseiten)
- **Arbeitsblatt** bei Laboraufgaben: „Nur die Aufgabe" – Aufgabenzeile, Planfigur
  und Gegebenes, darunter Karo zum Konstruieren, ohne Lösung
- Griechische Buchstaben, Umlaute und C₁/C₂ werden im PDF richtig gesetzt
- Kopfleiste: Zoomanzeige bricht auf dem iPad mini nicht mehr um
- Dateinamen ohne doppelte Leerzeichen
- Android-CI: `cordova clean` entfernt (löschte den deutschen App-Namen vor der Prüfung)

## 0.3.0 – Stufe 3a (Oktober 2026)

- **Kongruenzsätze-Labor** (Dreieck-Symbol oben, Vollversion): SSS, SWS, WSW, SsW;
  Werte eingeben oder Zufallswerte; Anzeige „eindeutig / zwei Lösungen / nicht
  konstruierbar" mit Begründung
- **Vorführen**: neues Blatt mit Planfigur (Gegebenes rot) und Konstruktion, die sofort
  animiert abläuft; Winkel werden wie im Unterricht angetragen (Nullpunkt in den
  Scheitel, Markierung, anlegen, Schenkel zeichnen)
- Sonderfälle sichtbar: SsW mit zwei Lösungen (C₁, C₂), verletzte Dreiecksungleichung,
  α + β ≥ 180°, zu kurze Seite – jeweils mit Erklärung auf dem Blatt
- **Selbst konstruieren**: Blatt mit Planfigur und Aufgabenleiste; „Prüfen" vergleicht
  die gegebenen Größen (Toleranz 1,5 mm / 1,5°), meldet fehlende Beschriftung oder
  Seiten; Spiegelbild zählt als richtig; „Lösung ansehen" spielt die Lösung ab
- Beschreibung: „Trage in A an AB den Winkel α = 50° an.", „freier Schenkel",
  „Fertige eine Planfigur an …"
- Umriss von Kreisbögen genau berechnet (Ansicht, Vorschaubilder)
- Datenschutzerklärung: Blätter können eine gestellte Aufgabe enthalten

## 0.2.0 – Stufe 2 (Oktober 2026)

- **Konstruktionsleiste** (Symbol oben rechts): alle Schritte nummeriert, wird beim
  Zeichnen laufend aktualisiert
- **Animierte Wiedergabe**: Lineal, Geodreieck und Zirkel gleiten an ihren Platz und
  zeichnen die Konstruktion Schritt für Schritt nach; vor/zurück, Anfang/Ende,
  Abspielen, Tempo 0,5×/1×/2×, Schritt antippen springt dorthin
- Schwebende Steuerung für den Beamer (auch bei geschlossener Leiste),
  Tastatur: ←/→, Leertaste, Esc
- **Automatische Konstruktionsbeschreibung in Befehlsform** (DE/EN): erkennt Strecken,
  Kreisbögen und Kreise um benannte Punkte, abgegriffene Längen, Schnittpunkte
  (auch mehrere, z. B. Mittelsenkrechte), Senkrechte, Parallelen und Verbindungen;
  stimmt auch, wenn erst gezeichnet und später beschriftet wird
- Beschreibung kopieren und teilen (Vollversion, derzeit noch frei)
- Zirkel merkt sich, ob der Radius eingetippt, aufgezogen oder von einer Strecke
  abgegriffen wurde

## 0.1.0 – Stufe 1 (Oktober 2026)

Erste Fassung.

- Karopapier (5 mm) oder Blanko, Zoom und Verschieben, Anzeige in echter Größe
  (iPad-Erkennung, Kalibrierung mit Scheckkarte oder Lineal)
- Bleistift (6 Farben, 3 Stärken), Marker, Radierer, Punkte mit automatischer
  Beschriftung, Text
- Lineal, Geodreieck und Zirkel: verschieben, drehen (zwei Finger oder Drehgriff),
  an der Kante zeichnen, Zirkel einstechen, aufziehen, Strecke abgreifen, Bogen und Vollkreis
- Einrasten an Punkten, Schnittpunkten und Skalen, abschaltbar
- Apple-Pencil-Modus mit Handballen-Schutz
- Rückgängig/Wiederholen
- Mehrere Blätter, automatisch gespeichert, Export und Import als Datei
- Deutsch und Englisch, heller und dunkler Modus, Werkzeugleiste links oder rechts
- Impressum und Datenschutzerklärung (DE/EN), auch für GitHub Pages
- Kauflogik für die Vollversion vorbereitet, noch abgeschaltet
