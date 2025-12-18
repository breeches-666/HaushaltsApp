# 🏠 Haushaltsplaner App

Eine moderne Progressive Web App (PWA) zur Verwaltung von Haushaltsaufgaben mit Kategorien, Deadlines und Benachrichtigungen.

## ✨ Features

- 👤 Benutzer-Authentifizierung (Login/Register)
- ✅ Aufgaben mit Checkboxen
- 📁 Individuelle Kategorien mit Farben
- ⏰ Deadlines mit automatischen Benachrichtigungen
- 🔔 Push-Benachrichtigungen (1h vorher + bei Überschreitung)
- 📱 Als Android/iOS App installierbar (PWA)
- 🐳 Docker-Support für einfaches Deployment

## 🚀 Schnellstart

### Voraussetzungen

- Node.js 18+
- Docker & Docker Compose
- Git

### Installation

1. Repository klonen:
```bash
git clone https://github.com/dein-username/HaushaltsApp.git
cd HaushaltsApp
```

2. Backend starten:
```bash
docker compose up -d
```

3. Frontend entwickeln:
```bash
cd frontend
npm install
npm run dev
```

4. App öffnen: `http://localhost:5173`

## 📦 Produktion Deployment

### Backend deployen
```bash
# .env Datei erstellen
cp backend/.env.example backend/.env
# Dann JWT_SECRET anpassen!

# Container starten
docker compose up -d

# Logs prüfen
docker compose logs -f
```

### Frontend deployen

**Option 1: Netlify/Vercel**
- Repository verbinden
- Build Command: `npm run build`
- Publish Directory: `dist`

**Option 2: Eigener Server mit Nginx**
```bash
cd frontend
npm run build
# dist/ Ordner auf Server kopieren
```

## 🔒 Sicherheit

- Passwörter werden mit bcrypt gehasht
- JWT-basierte Authentifizierung
- CORS-Schutz
- Input-Validierung

## 🛠️ Technologie-Stack

**Frontend:**
- React 18
- Tailwind CSS
- Vite
- Lucide Icons

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- JWT Authentication
- bcrypt

**DevOps:**
- Docker & Docker Compose
- Nginx (optional)

## 📱 PWA Installation

### Android:
1. Chrome öffnen
2. Menü (⋮) → "App installieren"
3. Fertig!

### iOS:
1. Safari öffnen
2. Teilen-Button → "Zum Home-Bildschirm"
3. Fertig!

## 🔧 Entwicklung

### API Endpoints

POST   /api/register        - Registrierung
POST   /api/login           - Login
GET    /api/tasks           - Alle Aufgaben
POST   /api/tasks           - Aufgabe erstellen
PUT    /api/tasks/:id       - Aufgabe aktualisieren
DELETE /api/tasks/:id       - Aufgabe löschen
GET    /api/categories      - Alle Kategorien
POST   /api/categories      - Kategorie erstellen
DELETE /api/categories/:id  - Kategorie löschen

### Environment Variables

**Backend (.env):**
```env
JWT_SECRET=dein-geheimer-schluessel
MONGODB_URI=mongodb://mongo:27017/haushaltsplaner
FRONTEND_URL=https://deine-domain.de
PORT=3000
```

## 📝 TODO

- [ ] E-Mail Benachrichtigungen
- [ ] Aufgaben teilen zwischen Benutzern
- [ ] Wiederkehrende Aufgaben
- [ ] Dark Mode
- [ ] Export/Import Funktion

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei

## 🤝 Beitragen

Pull Requests sind willkommen! Für größere Änderungen bitte zuerst ein Issue öffnen.

## 👨‍💻 Autor
DK