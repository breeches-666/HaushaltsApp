# 📱 Android APK erstellen - Ohne Android Studio!

Diese Anleitung zeigt, wie du eine APK für deine HaushaltsApp erstellst, **ohne Android Studio** auf deinem PC installieren zu müssen. Der Build-Prozess läuft komplett auf GitHub-Servern.

## 🚀 Schnellstart - APK über GitHub Actions erstellen

### Methode 1: Automatischer Build bei Push (empfohlen)

Die APK wird automatisch gebaut, wenn du auf den Branch `claude/deploy-backend-server-0TRwy` oder `main` pushst.

**Schritt 1: Code pushen**
```bash
# Deine Änderungen committen und pushen
git add .
git commit -m "Update App"
git push origin claude/deploy-backend-server-0TRwy
```

**Schritt 2: Build überwachen**
1. Gehe zu GitHub: https://github.com/breeches-666/HaushaltsApp/actions
2. Klicke auf den neuesten "Build APK" Workflow
3. Warte bis der Build fertig ist (ca. 5-10 Minuten)

**Schritt 3: APK herunterladen**
1. Im fertigen Workflow, scrolle nach unten zu **Artifacts**
2. Klicke auf **haushaltsplaner-app-debug**
3. Eine ZIP-Datei wird heruntergeladen
4. Entpacke die ZIP → `app-debug.apk`

### Methode 2: Manueller Build on-demand

Du kannst den Build auch manuell triggern ohne zu pushen:

**Schritt 1: Workflow manuell starten**
1. Gehe zu: https://github.com/breeches-666/HaushaltsApp/actions
2. Klicke links auf **"Build APK"**
3. Klicke auf **"Run workflow"** (rechts oben)
4. Wähle Branch: `claude/deploy-backend-server-0TRwy`
5. Klicke **"Run workflow"** (grüner Button)

**Schritt 2: APK herunterladen**
1. Warte bis der Build fertig ist
2. Klicke auf den Workflow-Run
3. Scrolle zu **Artifacts** und lade **haushaltsplaner-app-debug** herunter
4. Entpacke → `app-debug.apk`

## 📲 APK auf Android installieren

### Vorbereitung (einmalig)

**Android-Smartphone einrichten:**
1. Öffne **Einstellungen**
2. Gehe zu **Sicherheit** oder **Apps**
3. Aktiviere **"Installation aus unbekannten Quellen"** oder **"Unbekannte Apps installieren"**
4. Erlaube deinem Browser/Dateimanager die Installation

### APK übertragen und installieren

**Option 1: Per USB-Kabel**
```bash
# APK auf Smartphone kopieren
# Verbinde Smartphone per USB
# Kopiere app-debug.apk in den Download-Ordner
```

**Option 2: Per Cloud/E-Mail**
1. Lade die APK auf Google Drive/Dropbox hoch
2. Öffne den Link auf dem Smartphone
3. Lade die APK herunter

**Installation:**
1. Öffne den **Dateimanager** auf dem Smartphone
2. Navigiere zu **Downloads**
3. Tippe auf **app-debug.apk**
4. Folge den Anweisungen
5. Tippe **"Installieren"**
6. Fertig! Die App ist jetzt installiert

## 🔧 Was macht der GitHub Actions Workflow?

Der Workflow in `.github/workflows/build-apk.yml` macht folgendes:

1. **Checkout Code** - Lädt den Repository-Code
2. **Setup Node.js 18** - Installiert Node.js
3. **Setup Java 17** - Installiert Java (für Android-Build)
4. **Install Dependencies** - `npm install` im frontend-Ordner
5. **Build Frontend** - `npm run build` erstellt dist-Ordner
6. **Initialize Capacitor** - Erstellt Android-Projekt (falls noch nicht vorhanden)
7. **Sync Capacitor** - Kopiert Web-App ins Android-Projekt
8. **Build APK** - Erstellt die APK mit Gradle
9. **Upload Artifact** - Stellt die APK zum Download bereit

## 🐛 Troubleshooting

### Build schlägt fehl

**Prüfe die Logs:**
1. Gehe zu GitHub Actions
2. Klicke auf den fehlgeschlagenen Workflow
3. Klicke auf die fehlgeschlagene Step
4. Lies die Error-Logs

**Häufige Probleme:**

**1. "npm install failed"**
- Prüfe ob `package.json` korrekt ist
- Lösche `package-lock.json` und committe erneut

**2. "Gradle build failed"**
- Meist ein Capacitor-Konfigurationsfehler
- Prüfe `capacitor.config.json`

**3. "Artifact not found"**
- Build war nicht erfolgreich
- Prüfe alle vorherigen Steps

### APK installiert nicht

**"App wurde nicht installiert"**
- Prüfe ob "Unbekannte Quellen" aktiviert ist
- Deinstalliere alte Version falls vorhanden
- Prüfe ob genug Speicherplatz vorhanden ist

**"Parse Error"**
- APK ist beschädigt
- Lade die APK erneut herunter
- Baue die APK neu

## 🎯 Erweiterte Optionen

### Signierte APK (Release) erstellen

Für eine veröffentlichungsfähige APK brauchst du einen Signing Key:

```bash
# Keystore erstellen (lokal auf PC)
keytool -genkey -v -keystore haushaltsplaner.keystore -alias haushaltsplaner -keyalg RSA -keysize 2048 -validity 10000

# In GitHub Secrets hochladen:
# KEYSTORE_BASE64 = base64 encoded keystore
# KEYSTORE_PASSWORD = Passwort
# KEY_ALIAS = haushaltsplaner
# KEY_PASSWORD = Key-Passwort
```

Dann Workflow anpassen für `assembleRelease` statt `assembleDebug`.

### App-Icon und Splash Screen anpassen

**Icons:**
1. Erstelle Icons in verschiedenen Größen
2. Platziere in `frontend/android/app/src/main/res/`
3. Ordner: `mipmap-hdpi`, `mipmap-mdpi`, `mipmap-xhdpi`, etc.

**Splash Screen:**
1. Bearbeite `frontend/android/app/src/main/res/drawable/splash.png`

## 📊 Zusammenfassung

**Vorteile:**
- ✅ Kein Android Studio nötig
- ✅ Läuft auf GitHub-Servern (kostenlos)
- ✅ Automatisch bei jedem Push
- ✅ Immer die neueste Version

**Workflow:**
1. Code ändern → Pushen
2. GitHub Actions baut APK automatisch
3. APK herunterladen
4. Auf Smartphone installieren
5. Fertig!

## 🔗 Nützliche Links

- **GitHub Actions:** https://github.com/breeches-666/HaushaltsApp/actions
- **Capacitor Docs:** https://capacitorjs.com/docs/android
- **Android App Signing:** https://developer.android.com/studio/publish/app-signing

## 🎉 Fertig!

Du hast jetzt eine vollständig funktionierende Android-App, die sich mit deinem Server-Backend verbindet!

**Teste die App:**
1. Öffne die App auf dem Smartphone
2. Registriere einen Benutzer
3. Erstelle Haushalte und Aufgaben
4. Alles wird auf dem Server gespeichert: `https://backend.app.mr-dk.de`

Viel Spaß mit deiner HaushaltsApp! 📱🏠
