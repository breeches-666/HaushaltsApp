# 🔒 Sicherheitsrichtlinien und -empfehlungen

## ⚠️ Kritische Sicherheitsprobleme in der aktuellen Konfiguration

### 🚨 SOFORT BEHEBEN

#### 1. MongoDB Port ist öffentlich exponiert
**Problem:** `docker-compose.yml` Zeile 21-22
```yaml
ports:
  - "27017:27017"  # ❌ Erlaubt weltweiten Zugriff!
```

**Risiko:**
- Datenbank ist direkt aus dem Internet erreichbar
- Keine Authentifizierung aktiviert
- Angreifer kann alle Daten lesen, ändern oder löschen

**Lösung:**
1. Entferne Port-Mapping (MongoDB nur intern im Docker-Netzwerk)
2. Aktiviere MongoDB-Authentifizierung
3. Verwende die sichere Konfiguration: `docker-compose.secure.yml`

#### 2. Mongo-Express mit schwachem Passwort
**Problem:** Hardcodiertes Passwort `admin123` im Repository

**Lösung:**
1. Verwende Umgebungsvariablen aus `.env`
2. Generiere starkes Passwort
3. Exponiere Port nur auf localhost für SSH-Tunnel

---

## 🛡️ Sichere Deployment-Anleitung

### Schritt 1: Sichere Docker-Konfiguration verwenden

```bash
# Verwende die sichere Konfiguration
mv docker-compose.yml docker-compose.old.yml
mv docker-compose.secure.yml docker-compose.yml

# Verwende sicheres Dockerfile
cd backend
mv Dockerfile Dockerfile.old
mv Dockerfile.secure Dockerfile
cd ..
```

### Schritt 2: MongoDB-Credentials konfigurieren

Füge zu `backend/.env` hinzu:
```env
# MongoDB Root-Credentials (für Admin-Zugriff)
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=$(openssl rand -base64 32)

# MongoDB App-Credentials (für Backend)
MONGO_APP_USER=haushaltsapp
MONGO_APP_PASSWORD=$(openssl rand -base64 32)

# Mongo-Express Credentials (nur für Development!)
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=$(openssl rand -base64 32)
```

### Schritt 3: MongoDB Connection String anpassen

In `backend/.env`:
```env
MONGODB_URI=mongodb://haushaltsapp:YOUR_APP_PASSWORD@mongo:27017/haushaltsplaner?authSource=admin
```

### Schritt 4: Firewall konfigurieren

```bash
# Erlaube nur notwendige Ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# ❌ MongoDB Port 27017 NICHT öffnen!
# ❌ Mongo-Express Port 8081 NICHT öffnen!
```

### Schritt 5: Mongo-Express nur per SSH-Tunnel

```bash
# Auf lokalem Computer:
ssh -L 8081:localhost:8081 user@your-server

# Dann im Browser:
# http://localhost:8081
```

---

## 🔐 Host-Server Sicherheit

### 1. Automatische Updates aktivieren

```bash
# Debian/Ubuntu
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 2. SSH absichern

`/etc/ssh/sshd_config`:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
Port 22222  # Custom Port (optional)
```

```bash
sudo systemctl restart sshd
```

### 3. Fail2ban installieren

```bash
sudo apt install fail2ban

# Konfiguration für SSH und Nginx
sudo nano /etc/fail2ban/jail.local
```

```ini
[sshd]
enabled = true
port = 22
maxretry = 3
bantime = 3600

[nginx-http-auth]
enabled = true
port = http,https
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Docker Daemon absichern

`/etc/docker/daemon.json`:
```json
{
  "live-restore": true,
  "userland-proxy": false,
  "no-new-privileges": true,
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
sudo systemctl restart docker
```

### 5. AppArmor/SELinux aktivieren

```bash
# Ubuntu/Debian (AppArmor)
sudo apt install apparmor apparmor-utils
sudo systemctl enable apparmor

# CentOS/RHEL (SELinux)
sudo setenforce 1
```

---

## 🔍 Container-Sicherheit Best Practices

### 1. Regelmäßige Image-Updates

```bash
# Prüfe auf veraltete Images
docker images

# Update Base-Images
docker compose pull
docker compose build --no-cache
docker compose up -d
```

### 2. Vulnerability-Scanning

```bash
# Installiere Trivy
wget -qO - https://aquasecurity.github.io/trivy-repo/deb/public.key | sudo apt-key add -
echo "deb https://aquasecurity.github.io/trivy-repo/deb $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/trivy.list
sudo apt update && sudo apt install trivy

# Scanne Images
trivy image haushaltsapp-backend
trivy image mongo:4.4
```

### 3. Container-Logs überwachen

```bash
# Echtzeit-Monitoring
docker compose logs -f backend

# Nach verdächtigen Aktivitäten suchen
docker compose logs backend | grep -i "error\|fail\|unauthorized"
```

### 4. Least Privilege Prinzip

- ✅ Container laufen als non-root user
- ✅ Nur notwendige Capabilities
- ✅ Read-only Filesystem wo möglich
- ✅ Keine privilegierten Container

---

## 🚨 Incident Response

### Bei Sicherheitsvorfall:

1. **Isoliere betroffene Container:**
   ```bash
   docker network disconnect haushaltsplaner-network container-name
   ```

2. **Stoppe Container:**
   ```bash
   docker compose stop
   ```

3. **Sichere Logs:**
   ```bash
   docker compose logs > incident-logs-$(date +%Y%m%d-%H%M%S).txt
   ```

4. **Analysiere Kompromittierung:**
   ```bash
   # Container-Dateisystem inspizieren
   docker export container-name > container-backup.tar

   # Nach Malware scannen
   trivy fs container-backup/
   ```

5. **Wiederherstellung:**
   ```bash
   # Volumes sichern
   docker run --rm -v haushaltsapp_mongo-data:/data -v $(pwd):/backup alpine tar czf /backup/mongo-backup.tar.gz /data

   # Neuaufbau aus sauberem State
   docker compose down -v
   docker compose build --no-cache
   docker compose up -d
   ```

---

## 📊 Sicherheits-Checkliste

### Vor Production-Deployment:

- [ ] MongoDB Port NICHT exponiert (nur intern)
- [ ] MongoDB-Authentifizierung aktiviert
- [ ] Starke Passwörter generiert (min. 32 Zeichen)
- [ ] JWT_SECRET gesetzt (min. 32 Zeichen)
- [ ] FIREBASE_SERVICE_ACCOUNT konfiguriert
- [ ] Container laufen als non-root
- [ ] Ressourcen-Limits gesetzt
- [ ] Security-Options aktiviert (no-new-privileges)
- [ ] Firewall konfiguriert (nur 22, 80, 443)
- [ ] SSL/TLS mit Let's Encrypt aktiviert
- [ ] Fail2ban installiert und konfiguriert
- [ ] Automatische Updates aktiviert
- [ ] SSH gehärtet (kein root, kein password)
- [ ] Mongo-Express NICHT öffentlich (nur SSH-Tunnel)
- [ ] Backup-Strategie implementiert
- [ ] Monitoring eingerichtet
- [ ] Incident-Response-Plan dokumentiert

### Regelmäßige Wartung:

- [ ] Wöchentlich: Logs überprüfen
- [ ] Monatlich: Security-Scans durchführen
- [ ] Monatlich: Dependencies aktualisieren
- [ ] Vierteljährlich: Penetration-Test
- [ ] Jährlich: Sicherheits-Audit

---

## 📚 Weitere Ressourcen

- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [MongoDB Security Checklist](https://www.mongodb.com/docs/manual/administration/security-checklist/)

---

## 🆘 Support

Bei Sicherheitsfragen oder -vorfällen:
1. Erstelle ein GitHub Issue mit Label `security`
2. Bei kritischen Vorfällen: security@your-domain.de
3. Keine Details öffentlich posten!
