# LobsterBoard — optional Docker image.
# The regular `npm install` / `node server.cjs` install is unaffected by this file.
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY . .

# App code lives in /app, everything the user creates lives in /data.
# The server already supports this split (it's how the npx install works):
# config/auth/secrets/todos/notes/data and custom pages are read from the
# working directory, the app itself from LOBSTERBOARD_PKG_DIR.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8080 \
    LOBSTERBOARD_PKG_DIR=/app \
    LOBSTERBOARD_TEMPLATES_DIR=/data/templates \
    PUID=1000 \
    PGID=1000

VOLUME /data
WORKDIR /data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/login" || exit 1

# Fixes /data permissions, drops root -> PUID:PGID, then runs server.cjs.
# server.cjs handles SIGTERM itself, so `docker stop` shuts down cleanly.
CMD ["node", "/app/docker/entrypoint.cjs"]
