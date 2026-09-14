# Bloody Turkey Enterprise

## Railway + Netlify (krok po kroku)

Netlify hostuje tylko frontend. Backend (API + baza) uruchom na Railway i połącz go z frontendem przez `VITE_API_URL`.

### 1) Railway — backend + MySQL

1. Zaloguj się na https://railway.app i kliknij **New Project**.
2. Wybierz **Deploy from GitHub repo** i wskaż repo `farmt145-spec/Bloody-Turkey-Enterprise`.
3. Dodaj bazę: **New → Database → MySQL**.
4. Otwórz usługę aplikacji (web service) i w zakładce **Variables** ustaw:
   - `DATABASE_URL` = reference do `DATABASE_URL`/`MYSQL_URL` z usługi MySQL,
   - `JWT_SECRET` = długi losowy sekret,
   - `SEED_DEMO` = `true` (tylko pierwszy start),
   - `CORS_ORIGIN` = `https://TWÓJ-SITE.netlify.app` (dokładny adres frontendu).
5. Railway użyje konfiguracji z `app/railway.toml`.
6. Po deployu wygeneruj publiczną domenę usługi i skopiuj URL backendu, np. `https://xxx.up.railway.app`.
7. Po pierwszym poprawnym uruchomieniu ustaw `SEED_DEMO=false` i zrób redeploy.

### 2) Netlify — frontend

1. Zaloguj się na https://app.netlify.com i kliknij **Add new site → Import an existing project**.
2. Wybierz repo `farmt145-spec/Bloody-Turkey-Enterprise` i branch `main`.
3. W ustawieniach build ustaw dokładnie:
   - **Base directory:** `app`
   - **Build command:** `npm ci && npm run build:client`
   - **Publish directory:** `dist/public`
4. W **Environment variables** ustaw:
   - `VITE_API_URL=https://xxx.up.railway.app/api/trpc`
   - `NODE_VERSION=20`
5. Uruchom deploy, a po każdej zmianie build/env wykonaj **Clear cache and deploy site**.

### 3) Spięcie Railway z Netlify

1. `VITE_API_URL` musi wskazywać dokładnie na backend Railway zakończony `/api/trpc`.
2. `CORS_ORIGIN` na Railway musi być dokładnie adresem Netlify (`https://...netlify.app`, 1:1).
3. Przetestuj logowanie — używa TRPC mutation (POST), więc hasło nie pojawia się w URL.
4. Jeśli deploy Netlify nie przechodzi, sprawdź **Deploys → build log** (najczęściej brak `VITE_API_URL` albo błąd build/install).
