# ── Etap 1: build ─────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN rm -f package-lock.json && NODE_ENV=development NPM_CONFIG_LEGACY_PEER_DEPS=true npm install
COPY . .
RUN npm run build && ls -la dist/ && echo "=== PLIKI W DIST ===" && ls dist/*.js 2>/dev/null || echo "BRAK PLIKOW JS W DIST!"


# ── Etap 2: runtime ───────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
RUN mkdir -p /data/uploads
EXPOSE 3000
# Migracje (idempotentne) -> opcjonalny seed demo -> start serwera
CMD ["sh", "deploy/start.sh"]
