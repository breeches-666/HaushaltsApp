#!/bin/bash

# HaushaltsApp Backend Deployment Script
# Dieses Script hilft beim schnellen Deployment auf einem Server

set -e  # Exit bei Fehler

echo "🚀 HaushaltsApp Backend Deployment"
echo "=================================="
echo ""

# Farben für Output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Prüfe ob Docker installiert ist
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker ist nicht installiert!${NC}"
    echo "Installiere Docker mit: curl -fsSL https://get.docker.com -o get-docker.sh && sudo sh get-docker.sh"
    exit 1
fi

# Prüfe ob Docker Compose installiert ist
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose ist nicht installiert!${NC}"
    echo "Installiere Docker Compose mit: sudo apt install docker-compose -y"
    exit 1
fi

# Prüfe ob .env Datei existiert
if [ ! -f "backend/.env" ]; then
    echo -e "${YELLOW}⚠️  Keine .env Datei gefunden!${NC}"
    echo "Erstelle .env Datei aus .env.example..."
    cp backend/.env.example backend/.env

    # Generiere sicheres JWT_SECRET
    JWT_SECRET=$(openssl rand -hex 32)

    # Ersetze JWT_SECRET in .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/CHANGE_THIS_TO_RANDOM_STRING_IN_PRODUCTION/${JWT_SECRET}/" backend/.env
    else
        sed -i "s/CHANGE_THIS_TO_RANDOM_STRING_IN_PRODUCTION/${JWT_SECRET}/" backend/.env
    fi

    echo -e "${GREEN}✅ .env Datei erstellt mit sicherem JWT_SECRET${NC}"
    echo -e "${YELLOW}⚠️  Bitte überprüfe backend/.env und passe die Werte an!${NC}"
    echo ""
fi

# Frage welche docker-compose Datei verwendet werden soll
echo "Welche Konfiguration möchtest du verwenden?"
echo "1) docker-compose.yml (Development - mit Mongo Express)"
echo "2) docker-compose.prod.yml (Production - ohne Mongo Express)"
read -p "Wähle (1 oder 2): " choice

COMPOSE_FILE="docker-compose.yml"
if [ "$choice" == "2" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo -e "${GREEN}✅ Verwende Production-Konfiguration${NC}"
else
    echo -e "${GREEN}✅ Verwende Development-Konfiguration${NC}"
fi
echo ""

# Stoppe alte Container
echo "🛑 Stoppe alte Container..."
docker-compose -f $COMPOSE_FILE down
echo ""

# Build neue Images
echo "🔨 Baue neue Docker Images..."
docker-compose -f $COMPOSE_FILE build --no-cache
echo ""

# Starte Container
echo "🚀 Starte Container..."
docker-compose -f $COMPOSE_FILE up -d
echo ""

# Warte auf Health Check
echo "⏳ Warte auf Backend..."
sleep 5

# Prüfe Health Endpoint
MAX_RETRIES=12
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend ist bereit!${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT+1))
    echo "Warte noch $((MAX_RETRIES - RETRY_COUNT)) Sekunden..."
    sleep 5
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Backend antwortet nicht!${NC}"
    echo "Prüfe die Logs mit: docker-compose -f $COMPOSE_FILE logs"
    exit 1
fi

echo ""
echo "=================================="
echo -e "${GREEN}🎉 Deployment erfolgreich!${NC}"
echo "=================================="
echo ""
echo "Backend läuft auf: http://localhost:3000"
echo "Health Check: http://localhost:3000/health"

if [ "$choice" == "1" ]; then
    echo "Mongo Express: http://localhost:8081"
fi

echo ""
echo "📋 Nützliche Befehle:"
echo "  docker-compose -f $COMPOSE_FILE logs -f        # Logs anzeigen"
echo "  docker-compose -f $COMPOSE_FILE ps             # Status prüfen"
echo "  docker-compose -f $COMPOSE_FILE restart        # Neustarten"
echo "  docker-compose -f $COMPOSE_FILE down           # Stoppen"
echo ""
echo "📖 Vollständige Anleitung: siehe SERVER-DEPLOYMENT.md"
echo ""
