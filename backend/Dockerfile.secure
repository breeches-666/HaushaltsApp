FROM node:18-alpine

# Installiere dumb-init für sauberes Signal-Handling
RUN apk add --no-cache dumb-init

# Erstelle non-root Benutzer
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Arbeitsverzeichnis
WORKDIR /app

# Kopiere package files als root
COPY package*.json ./

# Installiere Dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Kopiere Source Code und setze Ownership
COPY --chown=nodejs:nodejs . .

# Wechsel zu non-root user
USER nodejs

# Exponiere Port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Starte mit dumb-init für sauberes Signal-Handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
