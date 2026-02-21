# 🚀 Server Deployment Anleitung - HaushaltsApp Backend

Diese Anleitung zeigt dir, wie du das Backend der HaushaltsApp auf einem Server deployen kannst.

## 📋 Voraussetzungen

Dein Server sollte haben:
- Ubuntu 20.04+ (oder ähnliche Linux-Distribution)
- Docker & Docker Compose installiert
- Domain oder Subdomain (z.B. `your-domain.example.com`)
- Mindestens 1 GB RAM
- Offene Ports: 80, 443, 3000 (optional)

## 🔧 Schritt 1: Server vorbereiten

### Docker installieren (falls noch nicht vorhanden)

```bash
# System aktualisieren
sudo apt update && sudo apt upgrade -y

# Docker installieren
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Docker Compose installieren
sudo apt install docker-compose -y

# Aktuellen Benutzer zur docker-Gruppe hinzufügen
sudo usermod -aG docker $USER

# Logout und Login erforderlich für Gruppenänderung
```

### Firewall konfigurieren

```bash
# UFW Firewall aktivieren (falls nicht aktiv)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 3000/tcp  # Backend (optional, nur für Tests)
sudo ufw enable
```

## 📦 Schritt 2: Code auf den Server bringen

### Option A: Git Clone (empfohlen)

```bash
# Repository klonen
cd ~
git clone https://github.com/breeches-666/HaushaltsApp.git
cd HaushaltsApp
git checkout claude/deploy-backend-server-0TRwy
```

### Option B: Dateien hochladen

```bash
# Auf deinem lokalen PC (in einem neuen Terminal):
scp -r /pfad/zur/HaushaltsApp user@dein-server-ip:~/
```

## 🔒 Schritt 3: Umgebungsvariablen konfigurieren

```bash
cd ~/HaushaltsApp/backend

# .env Datei bearbeiten
nano .env
```

**Wichtig! Ändere folgende Werte:**

```env
# SEHR WICHTIG: Ändere diesen Wert zu einem sicheren, zufälligen String!
JWT_SECRET=DEIN_SUPER_GEHEIMER_SCHLUESSEL_MINDESTENS_32_ZEICHEN_LANG

# MongoDB Verbindung (bleibt so für Docker Compose)
MONGODB_URI=mongodb://mongo:27017/haushaltsplaner

# Frontend URL - erlaubt alle Origins (oder spezifische Domain)
FRONTEND_URL=*

# Port
PORT=3000

# Environment
NODE_ENV=production
```

**JWT_SECRET generieren:**
```bash
# Sicheren zufälligen String generieren
openssl rand -hex 32
# Diesen Wert als JWT_SECRET verwenden!
```

Speichern mit `Ctrl+O`, `Enter`, beenden mit `Ctrl+X`.

## 🐳 Schritt 4: Docker Container starten

```bash
cd ~/HaushaltsApp

# Container im Hintergrund starten
docker compose up -d

# Logs überprüfen
docker compose logs -f

# Warten bis du siehst:
# ✅ MongoDB verbunden
# 🚀 Server läuft auf Port 3000
```

**Container-Status prüfen:**
```bash
docker compose ps
```

**Backend testen:**
```bash
curl http://localhost:3000/health
# Sollte zurückgeben: {"status":"ok","timestamp":"..."}
```

## 🌐 Schritt 5: Nginx Reverse Proxy einrichten (empfohlen)

Nginx macht dein Backend sicherer und ermöglicht SSL/HTTPS.

### Nginx installieren

```bash
sudo apt install nginx -y
```

### Nginx Konfiguration erstellen

```bash
sudo nano /etc/nginx/sites-available/haushaltsapp-backend
```

Füge folgende Konfiguration ein:

```nginx
server {
    listen 80;
    server_name your-domain.example.com;  # ÄNDERE DIES ZU DEINER DOMAIN!

    # Größere Request-Größe erlauben
    client_max_body_size 10M;

    # Proxy zu Docker Container
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Konfiguration aktivieren:**

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/haushaltsapp-backend /etc/nginx/sites-enabled/

# Nginx Konfiguration testen
sudo nginx -t

# Nginx neu starten
sudo systemctl restart nginx
```

## 🔐 Schritt 6: SSL-Zertifikat einrichten (Let's Encrypt)

```bash
# Certbot installieren
sudo apt install certbot python3-certbot-nginx -y

# SSL-Zertifikat erstellen und automatisch Nginx konfigurieren
sudo certbot --nginx -d your-domain.example.com

# Folge den Anweisungen:
# - E-Mail eingeben
# - Terms akzeptieren
# - Redirect auf HTTPS wählen (empfohlen)
```

**Automatische Erneuerung testen:**
```bash
sudo certbot renew --dry-run
```

## ✅ Schritt 7: Testen

### Backend von außen testen

```bash
# HTTP (sollte zu HTTPS umleiten)
curl http://your-domain.example.com/health

# HTTPS
curl https://your-domain.example.com/health
```

**Im Browser öffnen:**
- https://your-domain.example.com/health

Du solltest sehen: `{"status":"ok","timestamp":"..."}`

### Frontend mit Backend verbinden

Die Server-URL wird im Frontend beim Login konfiguriert (z.B. `https://your-domain.example.com`).

Starte das Frontend lokal:
```bash
cd ~/HaushaltsApp/frontend
npm install
npm run dev
```

Oder von einem anderen Gerät: Baue und deploye das Frontend separat.

## 🔄 Container-Management

### Logs anschauen
```bash
cd ~/HaushaltsApp
docker compose logs -f backend
docker compose logs -f mongo
```

### Container neustarten
```bash
docker compose restart
```

### Container stoppen
```bash
docker compose down
```

### Container stoppen und Daten löschen
```bash
docker compose down -v  # ACHTUNG: Löscht MongoDB Daten!
```

### Container mit neuem Code aktualisieren
```bash
cd ~/HaushaltsApp
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 🗄️ MongoDB Backup

### Backup erstellen
```bash
docker compose exec mongo mongodump --out=/data/backup
docker compose cp mongo:/data/backup ./mongodb-backup-$(date +%Y%m%d)
```

### Backup wiederherstellen
```bash
docker compose cp ./mongodb-backup-DATUM mongo:/data/restore
docker compose exec mongo mongorestore /data/restore
```

## 🔍 Problemlösung

### Container startet nicht
```bash
docker compose logs backend
```

### MongoDB Verbindungsfehler
```bash
# Prüfe ob MongoDB läuft
docker compose ps

# MongoDB Logs
docker compose logs mongo
```

### Nginx Fehler
```bash
sudo nginx -t                    # Konfiguration testen
sudo systemctl status nginx      # Status prüfen
sudo tail -f /var/log/nginx/error.log  # Error-Log
```

### Port bereits belegt
```bash
# Prüfe welcher Prozess Port 3000 nutzt
sudo lsof -i :3000

# Oder Port 80/443
sudo lsof -i :80
```

### Firewall blockiert Zugriff
```bash
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

## 🔒 Sicherheits-Checkliste

- [ ] JWT_SECRET in .env auf sicheren, zufälligen Wert geändert
- [ ] Firewall aktiviert (nur Ports 22, 80, 443 offen)
- [ ] SSL-Zertifikat installiert (HTTPS)
- [ ] MongoDB ist nicht direkt von außen erreichbar
- [ ] Mongo Express ist deaktiviert oder passwortgeschützt
- [ ] Regelmäßige Backups eingerichtet
- [ ] Server-Updates regelmäßig einspielen (`sudo apt update && sudo apt upgrade`)

## 🚀 Optionale Verbesserungen

### Mongo Express deaktivieren (Produktion)

In `docker-compose.yml` die mongo-express Sektion auskommentieren:

```yaml
# mongo-express:
#   image: mongo-express:latest
#   ...
```

Dann:
```bash
docker compose down
docker compose up -d
```

### Auto-Start bei Server-Neustart

```bash
# Nginx
sudo systemctl enable nginx

# Docker Container starten automatisch durch "restart: unless-stopped" in docker-compose.yml
```

### Monitoring einrichten

```bash
# Uptime Kuma oder ähnliches Tool installieren
# Oder externe Services wie UptimeRobot nutzen
```

## 📞 Support

Bei Problemen:
1. Logs überprüfen: `docker compose logs -f`
2. GitHub Issues: https://github.com/breeches-666/HaushaltsApp/issues

## 🎉 Fertig!

Dein Backend läuft jetzt auf:
- **HTTP**: http://your-domain.example.com (leitet um zu HTTPS)
- **HTTPS**: https://your-domain.example.com
- **Health Check**: https://your-domain.example.com/health

Das Frontend kann jetzt von jedem Gerät aus auf das Backend zugreifen!
