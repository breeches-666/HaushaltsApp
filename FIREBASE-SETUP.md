# Firebase Push Notifications Setup

Diese Anleitung erklärt, wie du Firebase Cloud Messaging (FCM) für Push Notifications in der HaushaltsApp einrichtest.

## Übersicht

Die App sendet Push Notifications bei folgenden Ereignissen:
- ✉️ Neue Einladung zu einem Haushalt
- ➕ Neue Aufgabe wurde erstellt (außer du selbst hast sie erstellt)
- 👤 Dir wurde eine Aufgabe zugewiesen (außer Selbstzuweisung)
- ⏰ Aufgabe ist in 60 Minuten fällig
- ⚠️ Aufgabe ist überfällig

---

## Schritt 1: Firebase Projekt erstellen

1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Klicke auf **"Projekt hinzufügen"**
3. Gib einen Projektnamen ein (z.B. "HaushaltsApp")
4. Optional: Google Analytics aktivieren (empfohlen für später)
5. Klicke auf **"Projekt erstellen"**

---

## Schritt 2: Android App zum Firebase Projekt hinzufügen

1. In der Firebase Console, klicke auf das **Android-Symbol** (🤖)
2. **Android-Paketnamen** eingeben: `de.app.mrdk.haushaltsapp`
   - Dieser muss mit dem Package Name in `android/app/build.gradle` übereinstimmen
3. **App-Spitzname** (optional): "HaushaltsApp Android"
4. Klicke auf **"App registrieren"**

---

## Schritt 3: google-services.json herunterladen

1. Nach der Registrierung erhältst du die Datei `google-services.json`
2. **Lade diese Datei herunter**
3. Kopiere sie in dein Projekt:
   ```bash
   cp ~/Downloads/google-services.json android/app/google-services.json
   ```
4. Die Datei sollte sich hier befinden: `android/app/google-services.json`

⚠️ **WICHTIG**: Die `google-services.json` Datei enthält sensible Daten und sollte **NICHT** in Git committed werden!

Füge folgende Zeile zur `.gitignore` hinzu:
```
android/app/google-services.json
```

---

## Schritt 4: Android build.gradle konfigurieren

Die Konfiguration ist bereits in den Gradle-Dateien vorhanden, aber stelle sicher, dass diese Zeilen existieren:

### `android/build.gradle` (Project-Level)
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

### `android/app/build.gradle` (App-Level)
```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
}
```

---

## Schritt 5: Firebase Service Account Key erstellen (Backend)

1. In der Firebase Console, gehe zu **Projekteinstellungen** (⚙️ oben links)
2. Wähle den Tab **"Dienstkonten"**
3. Klicke auf **"Neuen privaten Schlüssel generieren"**
4. Klicke auf **"Schlüssel generieren"**
5. Eine JSON-Datei wird heruntergeladen (z.B. `haushaltsapp-firebase-adminsdk-xxxxx.json`)

---

## Schritt 6: Backend .env Konfiguration

1. Öffne die heruntergeladene Service Account JSON-Datei
2. Kopiere den **gesamten Inhalt** der Datei
3. Öffne `backend/.env` auf dem Server
4. Füge folgende Zeile hinzu (als eine Zeile, ohne Zeilenumbrüche):

```bash
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"...","private_key_id":"...","private_key":"...","client_email":"...","client_id":"...","auth_uri":"...","token_uri":"...","auth_provider_x509_cert_url":"...","client_x509_cert_url":"..."}'
```

⚠️ **WICHTIG**:
- Das JSON muss als **String** mit einfachen Anführungszeichen `'...'` eingefügt werden
- Der JSON-Inhalt muss in **einer Zeile** sein
- Achte darauf, dass keine Zeilenumbrüche im `private_key` Feld sind

### Beispiel .env Datei:
```bash
PORT=3000
MONGODB_URI=mongodb://mongo:27017/haushaltsplaner
JWT_SECRET=dein-super-geheimer-jwt-schluessel
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"haushaltsapp-xxxxx",...}'
```

---

## Schritt 7: Dependencies installieren & neu starten

### Backend:
```bash
cd backend
npm install
# Docker neu starten
docker compose down
docker compose up -d --build
```

### Frontend:
```bash
cd frontend
npm install
# APK neu bauen via GitHub Actions oder lokal:
npx cap sync
npx cap build android
```

---

## Schritt 8: Testen

1. Installiere die neue APK auf dem Android-Gerät
2. Melde dich an
3. Die App fragt nach Push Notification Permission → **Erlauben**
4. In der Browser-Konsole (Chrome DevTools via `chrome://inspect`) solltest du sehen:
   ```
   ✅ FCM Token erhalten: eLK3z...
   ✅ FCM Token an Backend gesendet
   ```
5. Auf dem Server (Backend-Logs) solltest du sehen:
   ```
   ✅ Firebase Admin SDK initialisiert
   ✅ FCM Token registriert für User 123abc...
   ```

### Test-Szenarien:
- **Einladung**: Lade einen anderen User zu einem Haushalt ein → Er sollte eine Notification erhalten
- **Neue Aufgabe**: Erstelle eine Aufgabe in einem gemeinsamen Haushalt → Andere Mitglieder erhalten eine Notification
- **Zuweisung**: Weise eine Aufgabe einem Mitglied zu → Diese Person erhält eine Notification
- **Deadline**: Erstelle eine Aufgabe mit Deadline in 30 Minuten → Nach 5 Min sollte eine "bald fällig"-Notification kommen

---

## Troubleshooting

### "Push Notification Permission verweigert"
- In Android-Einstellungen → Apps → HaushaltsApp → Berechtigungen → Benachrichtigungen aktivieren

### "FCM Token nicht empfangen"
- Prüfe ob `google-services.json` korrekt platziert ist
- Prüfe Android-Logs: `adb logcat | grep Firebase`

### "Backend sendet keine Notifications"
- Prüfe Backend-Logs: `docker compose logs backend`
- Prüfe ob `FIREBASE_SERVICE_ACCOUNT` korrekt in `.env` gesetzt ist
- Teste Firebase Admin SDK:
  ```bash
  docker compose exec backend node -e "const admin = require('firebase-admin'); console.log(admin.apps.length);"
  ```
  Sollte `1` ausgeben (eine App initialisiert)

### "Notification wird nicht angezeigt"
- Prüfe ob FCM Token im Backend gespeichert ist (MongoDB):
  ```javascript
  db.users.findOne({ email: "test@example.com" })
  // Sollte fcmToken Feld haben
  ```

---

## Notification-Typen

Die App sendet folgende Notification-Typen:

| Event | Titel | Body | Data Type |
|-------|-------|------|-----------|
| Einladung | "Neue Haushalt-Einladung" | "{Name} hat dich zu '{Haushalt}' eingeladen" | `invitation` |
| Neue Task | "Neue Aufgabe" | "{Name} hat '{Task}' erstellt ({Kategorie})" | `new_task` |
| Zuweisung | "Dir wurde eine Aufgabe zugewiesen" | "{Name} hat dir '{Task}' zugewiesen" | `task_assigned` |
| Deadline bald | "Aufgabe bald fällig" | "'{Task}' ist in {X} Minuten fällig" | `deadline_soon` |
| Überfällig | "Aufgabe überfällig!" | "'{Task}' ist überfällig" | `overdue` |

---

## Sicherheitshinweise

⚠️ **NIEMALS** diese Dateien in Git committen:
- `google-services.json` (Frontend)
- Firebase Service Account JSON (Backend)
- `.env` Datei mit FIREBASE_SERVICE_ACCOUNT

✅ Stelle sicher, dass `.gitignore` enthält:
```
android/app/google-services.json
backend/.env
backend/firebase-adminsdk-*.json
```

---

## Weiterführende Ressourcen

- [Firebase Cloud Messaging Dokumentation](https://firebase.google.com/docs/cloud-messaging)
- [Capacitor Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Admin SDK (Node.js)](https://firebase.google.com/docs/admin/setup)

---

## Zusammenfassung

Nach erfolgreicher Konfiguration:
1. ✅ Firebase Projekt erstellt
2. ✅ Android App registriert
3. ✅ `google-services.json` in `android/app/` platziert
4. ✅ Firebase Service Account Key in `backend/.env` gesetzt
5. ✅ Dependencies installiert
6. ✅ Backend & Frontend neu gebaut
7. ✅ APK installiert und getestet

**Fertig!** 🎉 Die App sendet nun Push Notifications bei allen relevanten Events.
