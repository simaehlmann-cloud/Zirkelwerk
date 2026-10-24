# Änderungen

## 0.10.2 – Bilder, Sicherung, Ordner, mehr Körper (Oktober 2026)

**Neu:**
- **Bilder auf dem Blatt:** Foto oder Bilddatei einfügen (iOS bietet Fotos, Kamera, Dateien
  an), z. B. eine Aufgabe aus dem Schulbuch. Ecken ziehen = Größe, Kanten ziehen = zuschneiden,
  „Blass" macht es durchscheinend, „Fertig" heftet es fest (mit der Hand antippen = wieder
  bearbeiten). Liegt immer unter der Zeichnung, kommt mit ins PDF; QR-Codes enthalten es nicht
  (Hinweis). Gespeichert verkleinert als JPEG (höchstens 1600 px, 30 Bilder je Blatt)
- **Sicherung aller Blätter** samt Ordnern, Bildern und Abgaben in einer Datei; Wiederherstellen
  ergänzt fehlende Blätter, überschreibt nichts (geänderte als „(Sicherung)"-Kopie); Hinweis in
  „Meine Blätter", wann zuletzt gesichert wurde (rot, wenn nie oder vor über 30 Tagen)
- **Ordner** in „Meine Blätter": Blatt über „⋯" in einen Ordner legen, Ordner filtern,
  umbenennen, auflösen; neue Blätter landen im gewählten Ordner
- **Texte verschieben** mit dem Text-Werkzeug (greifen und ziehen; Antippen bearbeitet)
- **Weitere Körper:** Prisma und Pyramide mit regelmäßigem 3- bis 8-Eck, Pyramide mit
  Rechteck, Tetraeder, Oktaeder, Kegel, Kugel (Orangenschalen-Netz, ausdrücklich angenähert);
  Zylinder und Kegel lassen sich jetzt falten
- **Alle 11 Würfelnetze** zur Auswahl, je mit Faltanimation, und das Quiz **„Ist das ein
  Würfelnetz?"** – bei Nicht-Netzen zeigt die Faltung doppelt belegte Flächen rot und offene
  Seiten gestrichelt
- **Großansicht** der Körper: bildschirmfüllend, drehen, zoomen (zwei Finger/Mausrad), falten;
  **Farben**: Gegenseiten gleich gefärbt
- Kurzanleitung und Datenschutzerklärung ergänzt (Bilder, Kamera, Sicherung)

**Bei der Prüfung gefunden und behoben:**
- Neue Übersetzungen überschrieben still die Texte zum Kauf („wiederhergestellt") – der Validator
  meldet doppelte Schlüssel jetzt
- Beschreibung: Eine Strecke, die vor ihren Punkten gezeichnet und dann durchradiert wurde, hieß
  plötzlich „Verbinde A mit B"
- Quiz: Bewertung und gestrichelte Seiten konnten bei Sechslingen mit 2 × 2-Block voneinander
  abweichen
- Falten setzt sofort auf den Anfang zurück (kein kurzer Ruck)
- iOS: Kamera-Begründung ergänzt (sonst beendet iOS die App bei „Foto aufnehmen"); Texte zur
  Fotomediathek angepasst; Validator und iOS-Build prüfen das

## 0.10.1 – Bedienung nach dem ersten TestFlight-Test (Oktober 2026)

- **Tastatur verdeckt nichts mehr:** Fenster mit Eingabefeld (Punktname, Text, Radius,
  Labor, Rückmeldung an die Lehrkraft) rücken über die Bildschirmtastatur und lassen
  sich dort scrollen
- **Beschriftung ziehen:** Mit dem Punkt-Werkzeug die Beschriftung greifen und um den
  Punkt ziehen – sie rastet in acht Richtungen ein; Antippen öffnet weiterhin den Punkt
- **Punkte verschieben:** Lange drücken auf einen frei gesetzten Punkt und ziehen;
  Strecken, die dort enden, ziehen mit. Schnittpunkte, Mittelpunkte und Punkte auf
  Linien sind konstruiert und bleiben fest
- **Lupe** beim Setzen und Verschieben mit dem Finger: zeigt die Stelle unter dem Finger
  vergrößert mit Fadenkreuz
- **Radierer:** Antippen löscht genau ein Objekt (rot markiert, Punkte vor Linien) –
  ein Punkt im Schnitt zweier Bögen lässt sich allein entfernen. Wischen radiert nur
  das berührte Stück aus Strecken, Kreisbögen und Freihandstrichen, z. B. zu lange
  Hilfsbögen; Konstruktionsbeschreibung und Prüfung behandeln die Teile als Ganzes
- **Stift-Modus:** Ein kurzer Fingertipp öffnet Punkte und Texte, ohne zum Stift zu
  greifen; ein Tipp ins Leere erklärt einmalig, dass der Finger das Blatt verschiebt
- Kurzanleitung: Radierer, Beschriftung ziehen und Punkte verschieben ergänzt

## 0.10.0 – Körper & Netze, Sprachförderung, zweite Prüfung (Oktober 2026)

**Neu:**
- **Körper & Netze** im Labor (Vollversion): Würfel, Quader, Dreiecksprisma, Pyramide,
  Zylinder; Maße in cm; 3D-Vorschau zum Drehen mit dem Finger; Falten per Regler oder
  Animation; Volumen und Oberfläche zum Aufklappen
- **Netz aufs Blatt** mit Klebelaschen (Faltlinien gestrichelt) und **Netz als PDF** in
  Originalgröße zum Basteln; **Schrägbild aufs Blatt** mit gestrichelten verdeckten Kanten
- **Vorlesen**: ganze Konstruktionsbeschreibung oder jeder Schritt beim Abspielen (wo das
  Gerät Sprachausgabe hat; die Wiedergabe wartet, bis ausgesprochen ist)
- **Lückentext**: Beschreibung im PDF mit Lücken für die Fachwörter und Wortspeicher

**Unabhängige Durchsicht – behoben:**
- Speichern spätestens 5 s nach der ersten Änderung, auch beim Weiterzeichnen; im
  Hintergrund schneller (Vorschaubild später), keine Mehrfachspeicherung
- Langsam startender Speicher wird nachträglich übernommen statt die Sitzung zu verlieren
- Sehr große Blätter: Grenze schon beim Zeichnen; gespeicherte Blätter werden notfalls
  gekürzt geladen statt verworfen; Start weicht auf das nächste lesbare Blatt aus
- Löschen des offenen Blatts kann es nicht mehr wiederbeleben
- Große Blätter deutlich schneller (Laden 6×, Beschreibung 2,5×, Zeichnen nur sichtbarer
  Teil); Schnittpunkte jetzt bis 5000 Linien und schrittweise
- Beschreibung: zufällig senkrechte Linealstrecken werden nicht mehr als „Senkrechte"
  beschrieben – nur, was am Geodreieck entstand
- Abgaben: kaputte Zeichnungen in Rückmeldungen abgefangen; gleicher Name → Rückfrage
  „Ersetzen" oder „Beide behalten"; Hinweis, dass Name und Ergebnis selbst gemeldet sind
- iOS: Import zeigt .zirkelwerk-Dateien wieder an; ältere Android-WebViews: Import und Layout
- Android 16: Zurück-Taste bleibt in der App (Opt-out vom neuen Zurück-System)
- Stift mit Radierende radiert; dritter Finger stört das Zoomen nicht mehr; verlorene
  Zeiger blockieren keine Gesten mehr
- VoiceOver: Fokus wandert in Fenster und zurück, Zustände der Umschalter werden angesagt
- Build: Prüfungen in eigenem Job, Signierdaten sicher als JSON, Privacy-Manifeste von
  Plugins bleiben erhalten
- Datenschutzerklärung: Vorlesen ergänzt

## 0.9.0 – Wiedergabe als Video (Oktober 2026)

- **Als Video** (Konstruktionsleiste, Vollversion): Die animierte Wiedergabe wird mit
  den Schritten als Untertitel aufgenommen – MP4 (H.264), wo das Gerät es kann, sonst
  WebM; normales oder doppeltes Tempo; Schlussbild ohne Geräte; Abbrechen jederzeit
- Dateinamen nur noch aus ASCII (ä → ae, α → alpha): sonst speicherten manche Systeme
  die Datei als „download"
- Datenschutzerklärung: Video-Export ergänzt

## 0.8.0 – Rückmeldung per QR und Abgaben (Oktober 2026)

- **Rückmeldung (QR)** für Schülerinnen und Schüler: nach dem Prüfen oder im
  Aufgabenmenü; enthält Aufgabe, Ergebnis, erkannte Fehler, genutzte Hilfestufe,
  Vorname/Kürzel und – wenn der Code es zulässt – die eigene Zeichnung. Für alle frei.
- **Abgaben** für die Lehrkraft (Vollversion, unter „Meine Blätter"): scannen mit der
  Kamera-App; je Aufgabe Anzahl, richtig, Hilfestufen, häufigste Fehler und eine
  Liste aller Abgaben; „Ansehen" öffnet die Zeichnung samt Aufgabe zum Nachprüfen;
  erneutes Scannen derselben Person ersetzt die frühere Abgabe; Löschen je Aufgabe
  oder alles
- Kein Server, kein Konto: Abgaben liegen nur auf dem Gerät der Lehrkraft
- Datenschutzerklärung: Rückmeldungen, Name/Kürzel und Abgaben beschrieben
- Übersetzungen: Platzhalter in einem Durchgang (ein Blattname wie „{name}" bleibt Text)
- Prüfkette: veraltete Gegenproben gelten als Fehler

## 0.7.0 – Prüfung, Fehlerdiagnose, Hilfen, Grundkonstruktionen (Oktober 2026)

**Unabhängige Code-Durchsicht – behoben:**
- Speichern: verlorene Datenbankverbindung (iOS im Hintergrund) wird neu aufgebaut;
  Schreibvorgänge laufen in einer echten Warteschlange; bleibender Warnhinweis
  „Nicht gespeichert" in der Kopfleiste statt einmaliger Meldung; Speichern auch
  beim Wechsel in den Hintergrund; dauerhafter Speicher wird angefragt
- Langsam startende Datenbank: kein Mischbetrieb mehr aus Arbeitsspeicher und Datenbank
- Manipulierte QR-Links lassen die App nicht mehr abstürzen; Vollkreise bleiben
  Vollkreise; doppeltes Scannen auch bei umkodierten Links erkannt
- Android: Start-Link wird nach dem Öffnen vergessen; Import zeigt wieder alle Dateien
- Impressum und Datenschutz im App-Fenster (kein Seitenwechsel mehr)
- Automatische Beschreibung bei großen Blättern bis zu 25-mal schneller
- Punktnamen wie „{l}" verfälschen die Beschreibung nicht mehr
- Gerätewinkel bleiben nach dem Neuladen erhalten; PDF-Umbruch langer Wörter
- iPhone mit Anzeigezoom: Kalibrierung wird empfohlen
- Offenes Blatt in der Liste antippen löscht nicht mehr den Rückgängig-Verlauf
- VoiceOver: Werkzeuge, Farben und Strichstärken haben Namen
- CI: parallele Läufe werden abgebrochen

**Neu:**
- **Fehlerdiagnose** beim Prüfen: falsche Gradskala, Winkel am falschen Eckpunkt,
  vertauschte Seiten, C neben dem Kreisbogen, falsch eingestellter Zirkel, um 1 cm
  verzählt, knapp daneben – jeweils mit Erklärung
- **Gestufte Hilfen** (Glühbirne in der Aufgabenleiste): Denkanstoß → nächster
  Schritt in Worten → nächster Schritt gestrichelt eingezeichnet → Lösung;
  die höchste genutzte Stufe wird im Blatt vermerkt
- **Grundkonstruktionen** im Labor: Mittelsenkrechte, Winkelhalbierende, Lot,
  Senkrechte, Parallele, Umkreis, Inkreis, Thaleskreis – mit Zufallsfigur, Vorschau,
  Vorführen, Selbst konstruieren, Prüfen mit Diagnose, Hilfen und QR-Code

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
