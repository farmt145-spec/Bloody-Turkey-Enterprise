# Bloody Turkey Enterprise

## Netlify deployment troubleshooting

- **Netlify hosts only the frontend.** To make login work, deploy the backend and database separately.
- **Branch to deploy:** `main`
- **Base directory:** `app`
- **Build command:** `npm ci && npm run build:client`
- **Publish directory:** `dist/public`
- **Required Netlify environment variables:**
  - `VITE_API_URL` — full backend TRPC URL, for example `https://your-backend.example.com/api/trpc`
  - `NODE_VERSION=20`
- **Required backend environment variables for split deploys:**
  - `CORS_ORIGIN` — exact Netlify origin allowed to call the backend with cookies, for example `https://your-site.netlify.app`
  - `JWT_SECRET` — secret used to sign login tokens
  - `DATABASE_URL` — database connection string for users and app data
- **Manual Netlify checks:**
  1. Confirm the site is connected to the `farmt145-spec/Bloody-Turkey-Enterprise` repository.
  2. Confirm the deploy branch is `main`.
  3. After changing build settings or env vars, run **Clear cache and deploy site**.
  4. Set the same Netlify site URL in the backend `CORS_ORIGIN` variable, then redeploy the backend.
  5. Login requests are now sent as POST mutations instead of query-string GET requests, so no password should appear in the URL.
  6. If a push still does not publish, open **Deploys** in Netlify and inspect the latest build log for a missing `VITE_API_URL` or install/build failure.
