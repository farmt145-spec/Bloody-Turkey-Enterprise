# Bloody Turkey Enterprise

## Netlify deployment troubleshooting

- **Branch to deploy:** `main`
- **Base directory:** `app`
- **Build command:** `npm ci && npm run build:client`
- **Publish directory:** `dist/public`
- **Required Netlify environment variables:**
  - `VITE_API_URL` — full backend TRPC URL, for example `https://your-backend.example.com/api/trpc`
  - `NODE_VERSION=20`
- **Manual Netlify checks:**
  1. Confirm the site is connected to the `farmt145-spec/Bloody-Turkey-Enterprise` repository.
  2. Confirm the deploy branch is `main`.
  3. After changing build settings or env vars, run **Clear cache and deploy site**.
  4. If a push still does not publish, open **Deploys** in Netlify and inspect the latest build log for a missing `VITE_API_URL` or install/build failure.
