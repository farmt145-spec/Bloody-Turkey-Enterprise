#!/bin/sh
set -e

echo "== Bloody Turkey Enterprise — start =="
echo ">> Sprawdzam pliki migracji..."
ls -la db/migrations/

echo ">> Migracje bazy danych..."
node dist/migrate-all.js

if [ "$SEED_DEMO" = "true" ]; then
  echo ">> Ładowanie danych demonstracyjnych (w tle)..."
  (npx tsx db/seed.ts; npx tsx db/seed-ingredients.ts; npx tsx db/seed-daily.ts; npx tsx db/seed-erp.ts; npx tsx db/seed-gap.ts) &
  echo ">> Seed działa w tle, serwer startuje..."
fi

echo ">> Start serwera na porcie ${PORT:-3000}"
exec node dist/boot.js
