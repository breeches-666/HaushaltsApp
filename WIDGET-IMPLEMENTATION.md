# Android Widget Implementation Guide

## Überblick
Dieses Dokument beschreibt die Implementierung eines Android Widgets für die Haushaltsplaner-App, das die heutigen Aufgaben anzeigt und das Abhaken ermöglicht.

## Voraussetzungen
1. Android Studio installiert
2. Android SDK Setup
3. Capacitor Android Plattform hinzugefügt (`npx cap add android`)

## Schritt 1: Android-Plattform hinzufügen (falls noch nicht geschehen)

```bash
cd frontend
npm install
npx cap add android
npx cap sync
```

## Schritt 2: Widget-Dateien erstellen

Nach der Android-Initialisierung werden folgende Dateien benötigt:

### 2.1 Widget Layout
Erstelle: `android/app/src/main/res/layout/widget_layout.xml`

### 2.2 Widget Provider
Erstelle: `android/app/src/main/java/de/mrdk/haushaltsplaner/TaskWidgetProvider.java`

### 2.3 Widget Info
Erstelle: `android/app/src/main/res/xml/task_widget_info.xml`

### 2.4 Widget Liste Item Layout
Erstelle: `android/app/src/main/res/layout/widget_task_item.xml`

## Schritt 3: Android Manifest aktualisieren

In `android/app/src/main/AndroidManifest.xml` den Widget Receiver hinzufügen.

## Schritt 4: Permissions hinzufügen

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

## Implementierungsdetails

### Widget-Funktionen:
1. **Anzeige der heutigen Aufgaben** - Filtert Aufgaben nach Deadline = heute
2. **Abhaken von Aufgaben** - Click-Handler zum Markieren als erledigt
3. **Auto-Refresh** - Aktualisiert sich regelmäßig
4. **Dark/Light Theme Support** - Passt sich dem System-Theme an

### API-Integration:
Das Widget kommuniziert mit dem Backend über:
- `GET /api/tasks?householdId={id}` - Lädt Aufgaben
- `PUT /api/tasks/{id}` - Markiert als erledigt

### Authentifizierung:
- Token wird in SharedPreferences gespeichert
- Widget lädt Token und macht authentifizierte API-Calls

## Schritt 5: Build und Test

```bash
cd android
./gradlew assembleDebug
```

## Schritt 6: Widget hinzufügen

1. App auf Android-Gerät installieren
2. Lange auf Homescreen drücken
3. "Widgets" auswählen
4. "Haushaltsplaner - Heutige Aufgaben" Widget finden
5. Auf Homescreen ziehen

## Hinweise

### Performance:
- Widget-Updates werden auf max. alle 15 Minuten begrenzt (Android-Restriction)
- Manuelle Aktualisierung durch Tippen auf Widget-Header

### Einschränkungen:
- Android Widgets können keine WebView nutzen
- Alle UI-Elemente müssen native Android Views sein
- RemoteViews API hat eingeschränkte View-Unterstützung

### Bekannte Probleme:
- Bei sehr vielen Aufgaben (>20) kann das Widget langsam werden
- Widget zeigt maximal 10 Aufgaben gleichzeitig

## Alternative: Einfachere Lösung

Falls die native Widget-Implementierung zu komplex ist, gibt es Alternativen:

1. **App Shortcuts** - Schneller Zugriff auf "Heutige Aufgaben" Screen
2. **Notification** - Tägliche Benachrichtigung mit heutigen Aufgaben
3. **Quick Tile** - Android Quick Settings Tile zum Öffnen der App

Diese sind deutlich einfacher zu implementieren und erfordern weniger nativen Code.

## Nächste Schritte

Wenn du die vollständige native Implementation möchtest, kann ich:
1. Die kompletten Java/Kotlin-Dateien für das Widget erstellen
2. Alle XML-Layout-Dateien bereitstellen
3. Eine Schritt-für-Schritt-Anleitung für die Integration geben

Bitte bestätige, ob du die vollständige native Widget-Lösung möchtest, oder ob eine der einfacheren Alternativen bevorzugt wird.
