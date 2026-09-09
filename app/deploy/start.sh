#!/bin/sh
set -e

echo "== Bloody Turkey Enterprise — start =="
echo ">> Sprawdzam pliki migracji..."
ls -la db/migrations/

echo ">> Migracje bazy danych..."
npx tsx db/migrate-all.ts

if [ "$SEED_DEMO" = "true" ]; then
  echo ">> Ładowanie danych demonstracyjnych..."
  npx tsx db/seed.ts || true
  npx tsx db/seed-ingredients.ts || true
  npx tsx db/seed-daily.ts || true
  npx tsx db/seed-erp.ts || true
  npx tsx db/seed-gap.ts || true
fi

echo ">> Start serwera na porcie ${PORT:-3000}"
exec node dist/boot.js
