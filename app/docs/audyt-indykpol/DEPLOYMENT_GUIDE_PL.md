# 🚀 INDYKPOL - DEPLOYMENT GUIDE PL
## Netlify + MySQL/Turso - Kompletne wdrożenie

---

## ✅ STATUS REPO

✅ **PR #1 Merged** → Wszystkie pliki w `main`  
✅ **Aplikacja gotowa** → Bez logowania, demo mode aktywny  
✅ **Netlify site** → `bright-basbousa-82e300`  

---

## 📋 KROK 1: Przygotuj DATABASE

### Opcja A: MySQL na Render (POLECANE)

1. Wejdź na https://render.com
2. Zaloguj się lub utwórz konto
3. **+ New** → **MySQL**
4. Wypełnij:
   - **Name:** `indykpol-db`
   - **Database Name:** `indykpol`
   - **User:** `indykpol_user`
5. Kliknij **Create Database**
6. Czekaj ~5 min na uruchomienie
7. **Kopiuj Connection String** (wygląda jak):
   ```
   mysql://indykpol_user:PASSWORD@HOST:3306/indykpol
   ```

### Opcja B: Turso (SQLite w chmurze)

1. Wejdź na https://turso.tech
2. Utwórz nową bazę danych
3. Kopiuj:
   - `TURSO_DB_URL`
   - `TURSO_AUTH_TOKEN`

---

## 🔐 KROK 2: Wygeneruj Sekrety

Uruchom w terminalu:

```bash
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('API_KEY_PEPPER=' + require('crypto').randomBytes(32).toString('hex'))"
```

**LUB** użyj online generatora: https://generate-random.org/

Potrzebujesz **2 losowe stringi po 32+ znaki** dla:
- `SESSION_SECRET`
- `API_KEY_PEPPER`

---

## 🌐 KROK 3: Wejdź na Netlify

👉 https://app.netlify.com/sites/bright-basbousa-82e300/configuration/environment

---

## ⚙️ KROK 4: Dodaj Environment Variables

Kliknij **+ Add a single variable** i wklej:

### Jeśli używasz MySQL:

```
KEY: DATABASE_TYPE
VALUE: mysql

KEY: DATABASE_URL
VALUE: mysql://indykpol_user:PASSWORD@HOST:3306/indykpol

KEY: SESSION_SECRET
VALUE: [WKLEJ_LOSOWY_SEKRET_32_ZNAKI]

KEY: API_KEY_PEPPER
VALUE: [WKLEJ_LOSOWY_SEKRET_2_32_ZNAKI]

KEY: DEMO_MODE
VALUE: true

KEY: DEMO_COMPANY_ID
VALUE: 1

KEY: VITE_DEMO_MODE
VALUE: true
```

### Jeśli używasz Turso:

```
KEY: TURSO_DB_URL
VALUE: libsql://your-db.turso.io

KEY: TURSO_AUTH_TOKEN
VALUE: [TOKEN_TURSO]

KEY: SESSION_SECRET
VALUE: [WKLEJ_LOSOWY_SEKRET_32_ZNAKI]

KEY: API_KEY_PEPPER
VALUE: [WKLEJ_LOSOWY_SEKRET_2_32_ZNAKI]

KEY: DEMO_MODE
VALUE: true

KEY: DEMO_COMPANY_ID
VALUE: 1

KEY: VITE_DEMO_MODE
VALUE: true
```

---

## 🔄 KROK 5: Wdróż

1. Wejdź na **Deployments**
2. Kliknij **Trigger deploy** → **Deploy site**
3. Czekaj 2-3 minuty na build

---

## ✨ KROK 6: TESTUJ!

Otwórz:
```
https://bright-basbousa-82e300.netlify.app
```

### Powinieneś zobaczyć:

✅ Aplikacja otwiera się **BEZ logowania**  
✅ Domyślnie **demo data** (przykładowa firma)  
✅ Widok **Struktura** - możliwość dodania własnej firmy  
✅ Nowa firma dostaje receptury, normy, surowce  

---

## 🛠️ TROUBLESHOOTING

### "Build failed"
→ Sprawdź czy wszystkie ENV variables są wpisane  
→ Kliknij **Trigger deploy** ponownie

### "Database connection error"
→ Sprawdź `DATABASE_URL` (MySQL) lub `TURSO_DB_URL` (Turso)  
→ Upewnij się, że baza jest uruchomiona

### "Page loads but no data"
→ Seeding danych jest automatyczny przy pierwszym uruchomieniu  
→ Czekaj 30-60 sekund i odśwież stronę

---

## 📞 GOTOWE!

Aplikacja działa! 🎉

**Teraz możesz:**
- ✅ Używać demo danych
- ✅ Dodawać własne firmy w `Struktura`
- ✅ Tworzyć receptury i normy
- ✅ Pracować z całą logiką aplikacji

---

## 📚 Pliki referencyjne

Wszystko w repo:
- `.env.netlify.production` - template zmiennych
- `DEPLOY_CHECKLIST.md` - szczegółowe instrukcje
- `README.md` - informacje ogólne

**Powodzenia! 🚀**
