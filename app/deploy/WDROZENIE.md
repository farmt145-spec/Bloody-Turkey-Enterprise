# Wdrożenie Bloody Turkey Enterprise — Railway / Render

Kompletna instrukcja publikacji pełnej wersji (frontend + API + MySQL).

---

## Wspólne wymagania wstępne

1. Konto na **GitHub** (repo z tym projektem) oraz na **railway.app** lub **render.com**.
2. Baza **MySQL 8**:
   - Railway: „New → Database → MySQL" — connection string dostaniesz automatycznie,
   - Render nie ma MySQL — użyj zewnętrznej bazy: **PlanetScale**, **Aiven** (darmowy plan) lub Railway tylko pod bazę.

## Zmienne środowiskowe

| Zmienna | Wymagana | Opis |
|---|---|---|
| `DATABASE_URL` | ✅ | np. `mysql://user:haslo@host:3306/bloody_turkey` |
| `JWT_SECRET` | ✅ | dowolny długi losowy ciąg (Render wygeneruje sam) |
| `SEED_DEMO` | — | `true` przy pierwszym starze = dane demonstracyjne; potem zmień na `false` |
| `UPLOAD_DIR` | — | domyślnie `/data/uploads` (Render) — katalog na wgrywane pliki |
| `PORT` | — | platforma ustawia sama |

Zmienne `APP_ID` / `KIMI_AUTH_URL` itd. są **opcjonalne** — bez nich działa cały system poza logowaniem Kimi OAuth.

---

## Opcja A — Railway (zalecana, najprostsza)

1. Wypchnij projekt na GitHub.
2. Na railway.app: **New Project → Deploy from GitHub repo**.
3. Dodaj usługę **MySQL** w tym samym projekcie.
4. W usłudze aplikacji → **Variables**:
   - `DATABASE_URL` → „Reference variable" wskazująca na `DATABASE_URL` z usługi MySQL (Railway poda też `MYSQL_URL`),
   - `JWT_SECRET` → losowy ciąg,
   - `SEED_DEMO=true`.
5. Plik `railway.toml` w repo zadba o build z Dockerfile, healthcheck i restart policy.
6. Po deployu Railway da Ci publiczny adres `https://xxx.up.railway.app` (Settings → Networking → Generate Domain).
7. **Po pierwszym udanym starcie** zmień `SEED_DEMO=false` i zrób redeploy — inaczej seed będzie próbował się ładować przy każdym restarcie (skrypty są odporne, ale start trwa dłużej).

## Opcja B — Render

1. Utwórz bazę MySQL poza Renderem (PlanetScale/Aiven) i skopiuj connection string.
2. Na render.com: **New → Blueprint** i wskaż repo — Render odczyta `render.yaml` i utworzy usługę z dyskiem na uploady.
3. W panelu usługi uzupełnij tylko `DATABASE_URL` (reszta jest w `render.yaml`).
4. Adres publiczny: `https://bloody-turkey.onrender.com`.
5. Uwaga: darmowy plan Render „usypia" po bezczynności — pierwsze wejście może potrwać ~30 s.

---

## Weryfikacja po wdrożeniu

```bash
curl https://TWOJ-ADRES/                                  # powinno zwrócić 200 (strona)
curl "https://TWOJ-ADRES/api/trpc/farm.feed.recipes?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D"
# powinno zwrócić JSON z recepturami (gdy SEED_DEMO=true)
```

## Aktualizacje

Każdy `git push` na główną gałąź = automatyczny rebuild i restart. Migracje bazy są **idempotentne** i uruchamiają się przy każdym starcie, więc nowe tabele pojawią się same.

## Backupy

- Railway MySQL: włącz automatyczne backupy w zakładce bazy, albo cron z `mysqldump`.
- Uploady: na Renderze są na dysku trwałym (`/data`); na Railway dodaj Volume i ustaw `UPLOAD_DIR` na jego ścieżkę.
