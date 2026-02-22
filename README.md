# Haushaltsplaner App

Eine Android-App zur Verwaltung von Haushaltsaufgaben mit Mehrbenutzer-Haushalten, Kategorien, Deadlines, wiederkehrenden Aufgaben und Push-Benachrichtigungen. Designed fuer Self-Hosting: das Backend wird per Docker gehostet, die Server-URL wird direkt in der App konfiguriert.

**Android-App verfuegbar:** Die aktuelle APK wird bei jedem Push automatisch gebaut und kann unter [Actions](../../actions) heruntergeladen werden.

**Home Assistant Integration:** Ueberfaellige, heute faellige und offene Aufgaben als Sensoren in Home Assistant. Siehe [Home Assistant Integration](#home-assistant-integration) fuer Setup-Anleitung.

## Features

- Benutzer-Authentifizierung (Login/Registrierung) mit Input-Validierung
- Mehrere Haushalte pro Benutzer, Einladungssystem per E-Mail
- Aufgaben mit Kategorien, Deadlines, Prioritaeten und Beschreibungen
- Wiederkehrende Aufgaben (taeglich, woechentlich, monatlich)
- Mehrfachzuweisung von Aufgaben an Haushaltsmitglieder
- Push-Benachrichtigungen (Firebase Cloud Messaging) fuer Deadlines und Zuweisungen
- Terminal-Modus: Geteiltes Dashboard per QR-Code (z.B. fuer ein Tablet in der Kueche)
- Dark Mode
- Aufgaben-Archiv und Statistiken
- Rate Limiting und Security Hardening
- Docker-Support fuer einfaches Self-Hosting
- Android-App via Capacitor (APK)
- Home Assistant Integration (Custom Component mit HACS-Support)

## Schnellstart

### Voraussetzungen

- Docker & Docker Compose

### Installation

```bash
git clone https://github.com/breeches-666/HaushaltsApp.git
cd HaushaltsApp

# .env konfigurieren
cp backend/.env.example backend/.env
nano backend/.env  # JWT_SECRET aendern!

# Container starten
docker compose -f docker-compose.prod.yml up -d
```

Das Backend laeuft dann auf `http://localhost:3000`. In der Android-App wird die Server-URL beim Login eingegeben.

## Environment-Variablen

Alle Konfiguration erfolgt ueber die Datei `backend/.env`. Eine Vorlage liegt in `backend/.env.example`.

| Variable | Pflicht | Standard | Beschreibung |
|---|---|---|---|
| `JWT_SECRET` | Ja | - | Geheimer Schluessel fuer JWT-Token-Signierung. Muss ein langer, zufaelliger String sein. Generieren mit: `openssl rand -hex 64` |
| `MONGODB_URI` | Nein | `mongodb://mongo:27017/haushaltsplaner` | MongoDB-Verbindungsstring. Bei Docker Compose auf `mongo` als Hostname belassen. |
| `PORT` | Nein | `3000` | Port, auf dem das Backend lauscht. |
| `NODE_ENV` | Nein | `production` | Node.js Environment. `production` fuer Deployment, `development` fuer lokale Entwicklung. |
| `FRONTEND_URL` | Nein | `*` | Erlaubte CORS-Origins. `*` erlaubt alle Origins (da JWT-basiert, nicht Cookie-basiert). Kann auf eine spezifische Domain eingeschraenkt werden. |
| `FIREBASE_SERVICE_ACCOUNT` | Nein | - | Firebase Service Account JSON als einzeiliger String fuer Push-Benachrichtigungen. Ohne diese Variable sind Push-Notifications deaktiviert. Siehe [FIREBASE-SETUP.md](FIREBASE-SETUP.md). |

### JWT_SECRET generieren

```bash
openssl rand -hex 64
```

Diesen Wert in `backend/.env` als `JWT_SECRET` eintragen. **Niemals den Beispielwert aus `.env.example` in Produktion verwenden.**

## Produktion Deployment

### Schnell-Deployment mit Script

```bash
./deploy-server.sh
```

Das Script erstellt automatisch eine `.env` mit sicherem JWT_SECRET, baut Docker Images, startet Container und prueft den Health Status.

### Manuelles Deployment

Vollstaendige Anleitung: Siehe [SERVER-DEPLOYMENT.md](SERVER-DEPLOYMENT.md)

**Kurzversion:**

```bash
# 1. Auf den Server
ssh user@dein-server

# 2. Repository klonen
git clone https://github.com/breeches-666/HaushaltsApp.git
cd HaushaltsApp

# 3. .env konfigurieren
cp backend/.env.example backend/.env
nano backend/.env  # JWT_SECRET aendern!

# 4. Container starten (Produktion)
docker compose -f docker-compose.prod.yml up -d

# 5. Nginx als Reverse Proxy (optional aber empfohlen)
sudo cp nginx/haushaltsapp-backend.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/haushaltsapp-backend.conf /etc/nginx/sites-enabled/
# Domain in der Nginx-Config anpassen!
sudo nginx -t
sudo systemctl restart nginx

# 6. SSL mit Let's Encrypt
sudo certbot --nginx -d your-domain.example.com
```

### Docker Compose Varianten

| Datei | Verwendung |
|---|---|
| `docker-compose.yml` | Entwicklung: MongoDB-Port offen, Mongo Express auf Port 8081 |
| `docker-compose.prod.yml` | Produktion: MongoDB nur intern, Health Check, ohne Mongo Express |
| `docker-compose.secure.yml` | Produktion mit MongoDB-Authentifizierung |

## Sicherheit

- Passwoerter mit bcrypt gehasht (Salt Rounds: 10)
- JWT-basierte Authentifizierung
- Rate Limiting: Login (10/15min), Registrierung (5/1h), API (100/min)
- Input-Validierung bei Registrierung (E-Mail-Format, Passwort min. 8 Zeichen)
- Mass-Assignment-Schutz durch Field-Whitelisting
- JSON Body-Limit (1 MB)
- Terminal-Modus mit separatem Token-System

## Technologie-Stack

**Frontend:**
- React 18
- Tailwind CSS
- Vite
- Capacitor (Android-App)
- Lucide Icons

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- bcrypt
- Firebase Admin SDK (Push-Benachrichtigungen)
- express-rate-limit
- node-cron (Deadline-Benachrichtigungen)

**DevOps:**
- Docker & Docker Compose
- Nginx (Reverse Proxy)

## API Endpoints

### Authentifizierung
```
POST   /api/register                          Registrierung (rate limited)
POST   /api/login                             Login (rate limited)
```

### Benutzer
```
POST   /api/user/fcm-token                    FCM-Token registrieren
GET    /api/user/notification-preferences      Benachrichtigungseinstellungen laden
PUT    /api/user/notification-preferences      Benachrichtigungseinstellungen aendern
```

### Haushalte
```
GET    /api/households                         Alle Haushalte des Benutzers
POST   /api/households                         Haushalt erstellen
DELETE /api/households/:id                     Haushalt loeschen
POST   /api/households/:id/invite              Mitglied einladen
GET    /api/households/invites                 Einladungen anzeigen
POST   /api/households/:id/accept              Einladung annehmen
POST   /api/households/:id/decline             Einladung ablehnen
DELETE /api/households/:hId/members/:uId       Mitglied entfernen
POST   /api/households/:id/terminal-token      Terminal-Token generieren
DELETE /api/households/:id/terminal-token      Terminal-Token loeschen
```

### Aufgaben
```
GET    /api/tasks?householdId=...              Aufgaben laden
POST   /api/tasks                              Aufgabe erstellen
PUT    /api/tasks/:id                          Aufgabe aktualisieren
DELETE /api/tasks/:id                          Aufgabe loeschen
GET    /api/tasks/calendar?householdId=...     Kalenderansicht
GET    /api/tasks/archived?householdId=...     Archivierte Aufgaben
GET    /api/tasks/statistics?householdId=...   Statistiken
```

### Kategorien
```
GET    /api/categories?householdId=...         Kategorien laden
POST   /api/categories                         Kategorie erstellen
PUT    /api/categories/:id                     Kategorie aktualisieren
DELETE /api/categories/:id                     Kategorie loeschen
```

### Terminal-Modus
```
GET    /api/terminal/auth                      Terminal authentifizieren
GET    /api/terminal/ha-dashboard              Home Assistant Dashboard-Daten
```

### System
```
GET    /health                                 Health Check
```

## Home Assistant Integration

Die HaushaltsApp laesst sich als Custom Integration in Home Assistant einbinden. Ueberfaellige, heute faellige und offene Aufgaben werden als Sensoren bereitgestellt und koennen in Lovelace-Dashboards angezeigt werden.

### Installation

1. Den Ordner `homeassistant/custom_components/haushaltsapp/` nach `config/custom_components/haushaltsapp/` in der Home Assistant Installation kopieren
2. Home Assistant neu starten
3. Unter **Einstellungen → Geraete & Dienste → Integration hinzufuegen** nach "HaushaltsApp" suchen
4. Server-URL und Terminal-Token eingeben (Token wird in der App unter Haushalt-Einstellungen generiert)

Alternativ kann die Integration ueber [HACS](https://hacs.xyz/) als Custom Repository hinzugefuegt werden.

### Sensoren

| Sensor | State | Beschreibung |
|---|---|---|
| `sensor.haushaltsapp_offene_aufgaben` | Gesamtanzahl | Alle offenen Aufgaben mit vollstaendiger Summary in den Attributen |
| `sensor.haushaltsapp_uberfallige_aufgaben` | Anzahl | Aufgaben deren Deadline ueberschritten ist |
| `sensor.haushaltsapp_heutige_aufgaben` | Anzahl | Heute faellige Aufgaben |

Die Sensoren werden alle 5 Minuten aktualisiert. Detaillierte Aufgabenlisten, Kategorie-Statistiken und Personen-Zuordnungen sind als Attribute verfuegbar.

### Lovelace

Ein Beispiel-Dashboard mit Markdown Card, Entities Card und Conditional Card liegt in [`homeassistant/lovelace-example.yaml`](homeassistant/lovelace-example.yaml).

## Android APK

### Download

Bei jedem Push auf `main` wird automatisch eine Android-APK via GitHub Actions gebaut. Die aktuelle Version kann direkt unter [Actions](../../actions) als Artefakt heruntergeladen werden.

### Manuell bauen

Siehe [APK-BUILD.md](APK-BUILD.md) fuer die vollstaendige Anleitung zum Erstellen der Android-App mit Capacitor.

## Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei
