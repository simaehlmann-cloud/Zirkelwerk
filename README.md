# Zirkelwerk · Compasswork

Geometrische Konstruktionen mit Zirkel, Geodreieck und Lineal auf Karopapier –
für den Mathematikunterricht, gebaut fürs iPad mit Apple Pencil – läuft auch auf iPhone und Android (Tablet und Handy).
Läuft als iOS- und Android-App (Cordova) und als installierbare Web-App (PWA):
vollständig offline, ohne Konto, ohne Tracking, ohne externe Bibliotheken.

Auf deutschen Geräten heißt die App **Zirkelwerk**, in allen anderen Sprachen **Compasswork**.

## Dateien

```
index.html                     komplette App (HTML, CSS, Logik)
manifest.json, sw.js           Web-App (Offline-Cache)
datenschutz(-en).html          Datenschutzerklärung DE/EN
impressum(-en).html            Impressum DE/EN
docs/                          dieselben Rechtstexte für GitHub Pages (erzeugt)
config.xml                     Cordova-Konfiguration
res/ios/                       Icons, Startbild, Sprachdateien (App-Name), Privacy-Manifest
res/android/                   Icons, Icon-Farbe, deutscher App-Name (values-de)
make-icons.py                  zeichnet das Icon, erzeugt alle Größen
make-legal-pages.js            erzeugt docs/ aus den Rechtstexten
validate.js                    statische Prüfung
coretest.js                    Test des Geometrie-Kerns (ohne Browser)
smoketest.js, testlib.js       Ablauftest im echten Browser (inkl. SSS-Konstruktion)
.github/workflows/             Builds für Android und iOS
```

## Prüfen

```bash
node make-legal-pages.js   # nach jeder Änderung an einem Rechtstext
node validate.js           # Übersetzungen, IDs, Versionen, Icons, Rechtstexte
node coretest.js           # Schnittpunkte, Fangen, Rückgängig, Import-Prüfung
node smoketest.js          # Bedienabläufe mit Stift, Finger und Maus, Wiedergabe
./mutate.sh                # Gegenprobe: eingebaute Fehler müssen erkannt werden
```

Für den Ablauftest einmalig: `npm install --no-save playwright@1.63.0 && npx playwright install chromium`.

## Bauen

Beide Workflows laufen bei jedem Push auf `main`, zuerst mit der Prüfkette.

**Android** erzeugt immer ein Debug-APK. Mit vier Repository-Secrets kommt ein
signiertes APK (zum Testen) und das AAB für die Play Console dazu:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
Zirkelwerk braucht einen **eigenen** Keystore – nicht den von FairMix:

```bash
keytool -genkey -v -keystore zirkelwerk.keystore -alias zirkelwerk \
        -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 zirkelwerk.keystore      # Inhalt → ANDROID_KEYSTORE_BASE64
```

**iOS** baut immer unsigniert (Kompilierbarkeit). Signiert und hochgeladen wird
mit denselben Secret-Namen wie bei FairMix (`IOS_CERTIFICATE_P12_BASE64`,
`IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE`, `IOS_TEAM_ID`,
`IOS_SIGNING_IDENTITY`, für den Upload `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`).
Zertifikat und Team bleiben gleich; das **Provisioning-Profil muss neu** für
`de.zirkelwerk.app` angelegt werden. Hochgeladen wird nur beim manuellen Start
des Workflows.

## Rechtstexte im Web

`docs/` wird von GitHub Pages ausgeliefert (Settings → Pages → Branch `main`, Ordner `/docs`).
Datenschutz-Adresse für die Stores danach:
`https://simaehlmann-cloud.github.io/<Repo-Name>/zirkelwerk/datenschutz.html`
