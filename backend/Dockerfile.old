FROM node:18-alpine

WORKDIR /app

# Kopiere package files
COPY package*.json ./

# Installiere dependencies
RUN npm install --production

# Kopiere Source Code
COPY . .

# Exponiere Port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Starte Server
CMD ["node", "server.js"]