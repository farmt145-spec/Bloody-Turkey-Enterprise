@echo off
REM ═════════════════════════════════════════════════════════════════
REM BTE — Deploy na GitHub + Railway (Windows)
REM Użycie: deploy.bat
REM ═════════════════════════════════════════════════════════════════

setlocal enabledelayedexpansion

echo [INFO] Rozpoczynam deploy BTE...

REM Sprawdź czy jesteśmy w repo
if not exist ".git" (
    echo [ERROR] To nie jest repozytorium git.
    exit /b 1
)

REM Sprawdź czy zip istnieje
set ZIP_FILE=BTE_Indykpol_StarterPack_Railway.zip
if not exist "%ZIP_FILE%" (
    echo [ERROR] Nie znaleziono %ZIP_FILE%
    echo [INFO] Umieść paczkę w folderze repo
    exit /b 1
)

echo [INFO] Krok 1/5: Rozpakowywanie paczki...
powershell -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '.' -Force"
echo [OK] Paczka rozpakowana

echo [INFO] Krok 2/5: Sprawdzanie zmian...
git status --short

echo [INFO] Krok 3/5: Commit...
git add .
git commit -m "Domain data: norms, recipes, programs, diseases + Indykpol demo + starter pack + auto-provisioning"

echo [INFO] Krok 4/5: Push do GitHub...
for /f "tokens=*" %%a in ('git branch --show-current') do set CURRENT_BRANCH=%%a
echo [INFO] Branch: %CURRENT_BRANCH%
git push origin %CURRENT_BRANCH%

echo [OK] Deploy zakończony!
echo.
echo Następne kroki:
echo   1. Sprawdź Railway — czy build się rozpoczął
echo   2. Sprawdź logi — szukaj 'Seed Indykpol'
echo   3. Otwórz stronę — powinien być Indykpol S.A. (DEMO)
echo.

pause
