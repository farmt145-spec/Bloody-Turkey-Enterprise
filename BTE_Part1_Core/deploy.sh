#!/bin/bash
# ═════════════════════════════════════════════════════════════════
# BTE — Deploy na GitHub + Railway
# Użycie: ./deploy.sh [opcje]
# ═════════════════════════════════════════════════════════════════

set -e

# Kolory
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funkcje pomocnicze
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Sprawdź czy jesteśmy w repo
if [ ! -d ".git" ]; then
    log_error "To nie jest repozytorium git. Uruchom w folderze repo."
    exit 1
fi

# Sprawdź czy zip istnieje
ZIP_FILE="BTE_Indykpol_StarterPack_Railway.zip"
if [ ! -f "$ZIP_FILE" ]; then
    log_error "Nie znaleziono $ZIP_FILE"
    log_info "Umieść paczkę w folderze repo lub podaj ścieżkę:"
    log_info "  ./deploy.sh /ścieżka/do/paczki.zip"
    exit 1
fi

log_info "Rozpoczynam deploy BTE..."

# ═════════════════════════════════════════════════════════════════
# KROK 1: Rozpakuj paczkę
# ═════════════════════════════════════════════════════════════════
log_info "Krok 1/5: Rozpakowywanie paczki..."
unzip -o "$ZIP_FILE" -d . > /dev/null 2>&1
log_ok "Paczka rozpakowana"

# ═════════════════════════════════════════════════════════════════
# KROK 2: Sprawdź zmiany
# ═════════════════════════════════════════════════════════════════
log_info "Krok 2/5: Sprawdzanie zmian..."
git status --short

NEW_FILES=$(git status --short | grep "^??" | wc -l)
MODIFIED_FILES=$(git status --short | grep "^ M" | wc -l)

log_info "Nowe pliki: $NEW_FILES, zmodyfikowane: $MODIFIED_FILES"

if [ "$NEW_FILES" -eq 0 ] && [ "$MODIFIED_FILES" -eq 0 ]; then
    log_warn "Brak zmian — może paczka już była rozpakowana?"
fi

# ═════════════════════════════════════════════════════════════════
# KROK 3: Commit
# ═════════════════════════════════════════════════════════════════
log_info "Krok 3/5: Commit..."
git add .

COMMIT_MSG="Domain data: norms, recipes, programs, diseases + Indykpol demo + starter pack + auto-provisioning

- seed-domain-data.ts: 5 linii genetycznych z normami (7 faz), 22 surowce, 3 receptury, 2 programy żywieniowe, 10 chorób, 8 leków, 10 dostawców
- seed-indykpol.ts: idempotentny seed Indykpol S.A. z 2 fermami i pełną historią produkcyjną
- seed-starter-pack.ts: starter pack dla nowych firm (dane domenowe + 1 rzut 35-dniowy)
- workspace-router.ts: auto-provisioning Indykpol + withStarterData w createCompany
- FarmSelect.tsx: checkbox 'Dodaj przykładowe dane startowe'
- start.sh: automatyczny seed Indykpol przy starcie
- package.json: build z nowymi plikami seed"

git commit -m "$COMMIT_MSG" || log_warn "Nic do commitowania (może już było zrobione?)"
log_ok "Commit utworzony"

# ═════════════════════════════════════════════════════════════════
# KROK 4: Push
# ═════════════════════════════════════════════════════════════════
log_info "Krok 4/5: Push do GitHub..."
CURRENT_BRANCH=$(git branch --show-current)
log_info "Branch: $CURRENT_BRANCH"

git push origin "$CURRENT_BRANCH"
log_ok "Wypchnięto na GitHub"

# ═════════════════════════════════════════════════════════════════
# KROK 5: Podsumowanie
# ═════════════════════════════════════════════════════════════════
log_info "Krok 5/5: Podsumowanie..."

echo ""
echo "═══════════════════════════════════════════════════════════════"
log_ok "Deploy zakończony!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Co się stało:"
echo "  ✓ Paczka rozpakowana"
echo "  ✓ Zmiany wypchnięte na GitHub"
echo "  ✓ Railway powinien zacząć auto-deploy"
echo ""
echo "Następne kroki:"
echo "  1. Sprawdź Railway — czy build się rozpoczął"
echo "  2. Sprawdź logi — szukaj 'Seed Indykpol'"
echo "  3. Otwórz stronę — powinien być Indykpol S.A. (DEMO)"
echo ""
echo "Zmienne w Railway (jeśli nie ustawione):"
echo "  DATABASE_URL=mysql://user:pass@host:port/db"
echo "  SEED_DEMO=false"
echo ""
echo "Test po deploy:"
echo "  1. Strona główna → Indykpol S.A. (DEMO)"
echo "  2. Indykpol → Ferma → Kurnik → Rzuty z danymi"
echo "  3. Wróć → Dodaj własną firmę (z checkbox 'dane startowe')"
echo "  4. Nowa firma ma normy, receptury, 1 rzut demo"
echo ""

# ═════════════════════════════════════════════════════════════════
# GITHUB ACTIONS (opcjonalnie)
# ═════════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  GITHUB ACTIONS AUTO-DEPLOY"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Aby włączyć auto-deploy na Railway:"
echo ""
echo "  1. Utwórz Railway Token:"
echo "     railway.app/dashboard → Settings → Tokens → New Token"
echo ""
echo "  2. Dodaj sekrety do GitHub:"
echo "     github.com/YOUR_REPO → Settings → Secrets → Actions"
echo ""
echo "     RAILWAY_TOKEN = twój_token"
echo "     DATABASE_URL = mysql://..."
echo "     JWT_SECRET = losowy_ciąg_32_znaków"
echo ""
echo "  3. Gotowe! Każdy push do main = auto-deploy"
echo ""
echo "  Więcej info: RAILWAY_SETUP.md"
echo ""
