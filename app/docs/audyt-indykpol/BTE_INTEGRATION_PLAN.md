# BTE INTEGRATION PLAN
## Plan integracji — propozycja (bez wykonywania)

Porządek zgodny z zadanym: Core → Database → Contracts → API → Backend → Modules → Frontend → Permissions → Licensing → Tests → Deployment.

---

### Krok 1. Core
- **INPUT**: repo KIMI (app/) jako baza monorepo; wzorzec pakietów z FOUNDATION
- **OUTPUT**: struktura `apps/web`, `apps/api`, `packages/core` (env, errors, logging, utils); tsconfig paths; jeden package manager workspace
- **DEPENDENCIES**: brak
- **RISKS**: konflikt wersji React (19 KIMI vs 18 FOUNDATION) — moduły frontendowe B przepisywane, więc niski
- **ROLLBACK**: praca na gałęzi `integration/core`; oba repo źródłowe nietknięte
- **VERIFICATION**: `npm run build` web + api przechodzi; `npm test` (puste) przechodzi

### Krok 2. Database
- **INPUT**: `db/schema.ts` KIMI (60 tabel) + 6 schematów Prisma FOUNDATION (103 modele) + BTE_DATABASE_COMPARISON + BTE_DUPLICATE_REGISTER
- **OUTPUT**: rozszerzony Drizzle schema (~85–90 tabel): + VaccinationProgram/Step, RiskScore, AIAdvisorLog, Zone/Rack/Location, Product, Lot/LotItem/StockItem/TransferItem, DailyCost/ScenarioResult/ExecutiveSummary/BenchmarkEntry, Device/DeviceType/Telemetry/Alarm(+ACK)/DigitalTwinState/AIPrediction/FCRRecord/ADGRecord, knowledge/expert/forecast/experiment z feed-module, user_farms; FK `references()` + indeksy + enumy; migracja Drizzle 0005
- **DEPENDENCIES**: Krok 1
- **RISKS**: **R1/R4** — błędy mapowania typów Prisma→Drizzle i relacji; konflikt pojęć D3 (transfers, scenarios) → obowiązkowe rename wg rejestru
- **ROLLBACK**: `drizzle-kit drop` migracji 0005; schema w git revert
- **VERIFICATION**: `drizzle-kit generate` bez błędów; migracja na pustej bazie MySQL 8 przechodzi; seed demo (KIMI) działa; ręczny przegląd mapowań D1–D3

### Krok 3. Contracts
- **INPUT**: inline Zod z routerów KIMI, DTO class-validator z FOUNDATION, typy `$inferSelect`
- **OUTPUT**: `packages/contracts` — Zod schemas per domena + eksport typów; kontrakty dla wszystkich procedur KIMI i planowanych endpointów B
- **DEPENDENCIES**: Krok 2 (typy encji)
- **RISKS**: rozjazd walidacji (np. wymagalność pól w DTO B vs Zod A) — średnie
- **ROLLBACK**: pakiet niezależny; usunięcie importów
- **VERIFICATION**: `tsc -b` bez błędów; routery KIMI przełączone na importy z contracts bez zmiany zachowania (test dymny API)

### Krok 4. API
- **INPUT**: routery KIMI (13), inwentarz BTE_API_COMPARISON
- **OUTPUT**: routery przełączone na contracts; nowe routery-szkielety: `iot`, `warehouse`, `health`, `feedExpert`; fasada REST/OpenAPI (read-only na start) dla integracji zewnętrznych; rozwiązane konflikty nazw (flock_transfers/stock_transfers)
- **DEPENDENCIES**: Kroki 1–3
- **RISKS**: złamanie kompatybilności frontendu KIMI przy zmianie sygnatur — **wysokie**; mitigacja: najpierw dodawać, nie zmieniać
- **ROLLBACK**: revert routerów; fasada REST jako osobny moduł do odłączenia
- **VERIFICATION**: wszystkie 21 stron KIMI działa bez zmian; `ping` + pełny smoke test procedur

### Krok 5. Backend
- **INPUT**: serwisy FOUNDATION (feed 9, health 11 sub-modułów, warehouse, economics, production 3), warstwa `api/queries` KIMI
- **OUTPUT**: `packages/domain/*` — serwisy przepisane z NestJS/Prisma na czyste klasy/funkcje TS + Drizzle; routery tRPC wołają serwisy (thin controllers); jedna funkcja `audit()`; lekki event bus
- **DEPENDENCIES**: Kroki 2–4
- **RISKS**: **R1 (krytyczne)** — utrata zachowań transakcyjnych Prisma; brak migracji FOUNDATION utrudnia weryfikację danych; mitigacja: port moduł po module z testami charakteryzacyjnymi (najpierw test na zachowanie z Prisma, potem port)
- **ROLLBACK**: serwisy jako nowe pakiety — stare routery KIMI mogą działać równolegle do przełączenia
- **VERIFICATION**: testy jednostkowe serwisów (port spec z FOUNDATION + nowe); parity-testy odpowiedzi przed/po dla procedur KIMI

### Krok 6. Modules
- **INPUT**: pakiety domenowe z Kroku 5, moduł IoT FOUNDATION (jako satelita)
- **OUTPUT**: FEED (nutrition + expert + experiments + forecasts), HEALTH (programy szczepień, risk, ai-detection), PRODUCTION (KIMI + AIAnalysis/AIForecast), WAREHOUSE (pełny + silosy), ECONOMICS (ERP KIMI + analityka B), IOT (serwis satelitarny + tabele raportowe)
- **DEPENDENCIES**: Krok 5
- **RISKS**: IoT wymaga infrastruktury (Mosquitto, Grafana) — średnie; nakładanie alertów (DUP-18) — średnie
- **ROLLBACK**: moduły za feature flagami (editions/tier gate)
- **VERIFICATION**: checklist funkcji z BTE_FUNCTION_MATRIX — każda pozycja KEEP/PORT/MERGE odhaczona z dowodem (test lub demo)

### Krok 7. Frontend
- **INPUT**: UI KIMI (21 stron, shadcn/ui), widoki modułów FOUNDATION (17 komponentów domenowych)
- **OUTPUT**: nowe sekcje stron KIMI: Warehouse (inventory/traceability/alerts/AI), Health (programy, risk), Feed (experiment lab, expert, knowledge), Economics (scenarios, executive), IoT (devices, telemetry live, digital twin); jeden klient tRPC (axios klienci B porzuceni)
- **DEPENDENCIES**: Kroki 4–6
- **RISKS**: różnice stylistyczne (własne CSS modułów B vs shadcn) — kosmetyczne; stan (zustand vs TanStack Query) — średnie
- **ROLLBACK**: strony jako nowe trasy; stare trasy nietknięte
- **VERIFICATION**: przegląd wizualny 21+nowych stron; zero błędów konsoli; build Vite

### Krok 8. Permissions
- **INPUT**: RBAC FOUNDATION (guards/@Roles), middleware KIMI, docelowy model ról (BTE_TARGET_ARCHITECTURE §2)
- **OUTPUT**: `requirePermission("zasób:akcja")` na wszystkich procedurach; **wszystkie `publicQuery` biznesowe → `authedQuery`**; tabela permissions/roles w DB; UI ukrywa niedostępne akcje
- **DEPENDENCIES**: Kroki 4–5 (stabilne procedury)
- **RISKS**: **R2 (krytyczne jeśli pominięte)** — zmiana public→authed złamie anonimowe użycie demo; mitigacja: konto demo z pełnymi rolami + SEED_DEMO
- **ROLLBACK**: feature flag `ENFORCE_AUTH=false` na czas przejścia
- **VERIFICATION**: macierz ról × procedur przetestowana automatycznie (test integracyjny 401/403/200)

### Krok 9. Licensing
- **INPUT**: `editions.ts` KIMI + macierz z BTE_TARGET_ARCHITECTURE §3
- **OUTPUT**: `companies.tier`, middleware `requireTier`, gate'y na procedurach i trasach UI zgodnie z macierzą STANDARD/ADVANCED/PROFESSIONAL
- **DEPENDENCIES**: Krok 8
- **RISKS**: niskie (additive)
- **ROLLBACK**: domyślny tier=professional dla wszystkich
- **VERIFICATION**: testy: standard user dostaje 403 na /analityka i procedurach AI; UI nie renderuje tras spoza tieru

### Krok 10. Tests
- **INPUT**: spec z FOUNDATION (9 plików + integration), vitest config KIMI
- **OUTPUT**: port testów jednostkowych na pakiety domenowe; nowe testy integracyjne API (procedury × role × tier); minimum: pokrycie krytycznych ścieżek (receptury, stada, magazyn, leczenie, auth)
- **DEPENDENCIES**: Kroki 5–9
- **RISKS**: **R3** — testy pisane po fakcie mogą utrwalić błędy; mitigacja: testy charakteryzacyjne już w Kroku 5
- **ROLLBACK**: n/d (testy nie wpływają na runtime)
- **VERIFICATION**: `vitest run` zielony w CI; raport pokrycia na krytycznych pakietach

### Krok 11. Deployment
- **INPUT**: Dockerfile/railway/render KIMI, docker IoT (Mosquitto, Grafana), WDROZENIE.md
- **OUTPUT**: jeden pipeline: build web+api+iot, migracje Drizzle przy starcie, SEED_DEMO flag, healthcheck; compose lokalny (mysql + api + web + iot + mosquitto + grafana)
- **DEPENDENCIES**: wszystkie powyższe
- **RISKS**: IoT satelita komplikuje topologię na Railway/Render — średnie; sekrety OAuth Kimi — niskie
- **ROLLBACK**: poprzedni obraz kontenera; migracje z down-script
- **VERIFICATION**: świeży deploy z pustą bazą → seed → login → przepływ: utworzenie stada → receptura → symulacja → raport dzienny

---

## Kamienie milowe (propozycja kolejności wydań)
1. **M1 Foundation**: Kroki 1–4 (system KIMI na nowej strukturze, schema rozszerzony, nic nie zniknęło)
2. **M2 Domain**: Kroki 5–6 (FEED + WAREHOUSE jako pierwsze — największa wartość, najlepsze testy źródłowe)
3. **M3 Intelligence**: Krok 6 (HEALTH + ECONOMICS) + Krok 7
4. **M4 Security**: Kroki 8–9 — **nie później niż przed jakimkolwiek wdrożeniem produkcyjnym**
5. **M5 Hardening**: Kroki 10–11

Uwaga: Kroki 8–9 można (i należy rozważyć) przesunąć przed M2, jeśli system ma być wystawiony komukolwiek poza zespołem — patrz R2.
