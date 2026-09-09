# ── Etap 1: build ─────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps include=dev
COPY . .
RUN npm run build

# ── Etap 2: runtime ───────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
RUN mkdir -p /data/uploads
EXPOSE 3000
# Migracje (idempotentne) -> opcjonalny seed demo -> start serwera
CMD ["sh", "deploy/start.sh"]
