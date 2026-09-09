#!/bin/sh
set -e

echo "== Bloody Turkey Enterprise — start =="
echo ">> Sprawdzam pliki migracji..."
ls -la db/migrations/ || echo "BRAK KATALOGU db/migrations!"
ls -la db/migrations/*.sql || echo "BRAK PLIKOW SQL!"

echo ">> Migracje bazy danych..."
node dist/migrate-all.js

if [ "$SEED_DEMO" = "true" ]; then
  echo ">> Ładowanie danych demonstracyjnych..."
  node dist/seed.js || true
  node dist/seed-ingredients.js || true
  node dist/seed-daily.js || true
  node dist/seed-erp.js || true
  node dist/seed-gap.js || true
fi

echo ">> Start serwera na porcie ${PORT:-3000}"
exec node dist/boot.js
