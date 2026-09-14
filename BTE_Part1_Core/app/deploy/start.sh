#!/bin/sh
set -e

echo "== Bloody Turkey Enterprise — start =="

echo ">> Migracje bazy danych..."
node dist/migrate-all.js

echo ">> Seed Indykpol (idempotentny — dane hodowlane + produkcyjne)..."
node dist/seed-indykpol.js || echo "Seed Indykpol: pominięto"

if [ "$SEED_DEMO" = "true" ]; then
  echo ">> Ładowanie pełnych danych demonstracyjnych..."
  node dist/seed.js || true
  node dist/seed-ingredients.js || true
  node dist/seed-daily.js || true
  node dist/seed-erp.js || true
  node dist/seed-gap.js || true
fi

echo ">> Start serwera na porcie ${PORT:-3000}"
exec node dist/boot.js
