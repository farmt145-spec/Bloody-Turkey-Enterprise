# BTE ENTERPRISE — DUAL PROJECT AUDIT
## Dokument główny — FAZA 0 (READ-ONLY)

Data audytu: 2026-08-09
Źródła:
- **SOURCE A (KIMI)**: `bloody-turkey-kimi` — commit `5807ede first commit`, 168 plików, ~2,5 MB
- **SOURCE B (FOUNDATION)**: `BLOODY-TURKEY-FOUNDATION` — commit `76bb682 Initialize BTE_FOUNDATION repository`, 359 plików, ~3,1 MB

> Żaden projekt nie został zmodyfikowany. Audyt wyłącznie odczytowy.

---

## 1. EXECUTIVE SUMMARY

| Wymiar | KIMI (A) | FOUNDATION (B) |
|---|---|---|
| Kształt | **Jedna spójna aplikacja full-stack** | **Zestaw 6 niezależnych modułów + pusty szkielet API** |
| Stack | Vite + React 19 + shadcn/ui + tRPC 11 + Hono + **Drizzle ORM + MySQL** | NestJS 10 + React 18 + Zustand + **Prisma + PostgreSQL** |
| Stan biznesowy | Spójny, uruchamialny produkt (60 tabel, ~60 endpointów, 21 stron UI) | Bogata logika domenowa, ale **rozproszona w 6 silosach** bez wspólnego runtime |
| Auth | Kimi OAuth (JWKS + sesja cookie), ale **39 z 42 endpointów publicznych** | JWT + Passport + RBAC guardy (warehouse, economics, health, IoT) |
| Testy | vitest skonfigurowany, **0 plików testowych** | 9 plików spec + katalogi testów integracyjnych |
| Migracje | 5 snapshotów Drizzle (0000–0004), spójne | **Brak katalogów migracji** — same schematy Prisma |
| Deployment | Railway/Render/Dockerfile + instrukcja WDROZENIE.md | Dockerfile (api), docker-compose (IoT: Grafana, Mosquitto) |

**Kluczowe ustalenie:** KIMI to działający, spójny szkielet produktu z pełnym pokryciem domen w jednej bazie. FOUNDATION to biblioteka głębokiej logiki domenowej (AI, eksperymenty, prognozy, integracje IoT, RBAC), która nigdy nie została zintegrowana w jeden system — jej główne `apps/api` to szkielet ze stubami (`getStatus()`), bez `schema.prisma`.

---

## 2. ARCHITECTURE MAP

### SOURCE A — KIMI (`bloody-turkey-kimi/app`)

| Warstwa | Implementacja | Lokalizacja |
|---|---|---|
| Frontend | React 19 + Vite 7, Tailwind + shadcn/ui (46 komponentów ui), react-router, TanStack Query | `src/` |
| Backend | Hono (Node) serwujący tRPC przez fetch adapter; build przez esbuild | `api/boot.ts` |
| API | **tRPC 11** — 13 routerów, superjson transformer | `api/router.ts`, `api/*-router.ts` |
| Database | MySQL 8 | `DATABASE_URL` |
| ORM | **Drizzle ORM** (`mysqlTable`, 60 tabel, serial/bigint PK) | `db/schema.ts` (842 linie) |
| Contracts | Re-eksport typów Drizzle + Errors + Session/Paths | `contracts/` (3 pliki, ~31 linii) |
| Services | Logika **bezpośrednio w routerach** (brak warstwy serwisów) | `api/*-router.ts` |
| Controllers | brak (paradygmat tRPC — procedury) | — |
| DTO | Zod input schemas inline w procedurach | `api/*.ts` |
| Routing (UI) | 21 tras react-router | `src/App.tsx` |
| Authentication | **Kimi OAuth 2.0**: authorization code → token exchange → JWKS verify → sesja JWT w cookie `kimi_sid` (365 dni) | `api/kimi/auth.ts`, `session.ts`, `platform.ts` |
| Authorization | Middleware `requireAuth`, `requireRole("admin")` — **zastosowane tylko w 3 procedurach** | `api/middleware.ts` |
| Roles | Enum: `user`, `admin` (kolumna `users.role`) | `db/schema.ts` |
| Permissions | Brak macierzy uprawnień per zasób | — |
| Workflows | Brak silnika workflow | — |
| Events | Brak event busa | — |
| Audit | Tabela `audit_log` + funkcja `audit()` (old/new values) | `api/audit.ts` |
| Reporting | Routery: `analytics` (compareBatches, consumptionSeries, energySummary), `command` (dailyReport, globalSignals), `gap` (benchmarks, forecastAccuracy) | `api/analytics-router.ts`, `command-router.ts`, `gap-router.ts` |
| AI | `ai.advise`, `nutrition.assist` (kalkulatory/reguły w kodzie — **bez zewnętrznego LLM**) | `api/analytics-router.ts`, `nutrition-router.ts` |
| Tests | vitest config, **0 testów** | `vitest.config.ts` |
| Deployment | Dockerfile, railway.toml, render.yaml, netlify.toml, `deploy/WDROZENIE.md`, `deploy/start.sh` | root + `deploy/` |

Routery tRPC (13): `auth`, `farm`, `org`, `daily`, `feedProgram`, `erp`, `notifications`, `analytics`, `ai`, `nutrition`, `command`, `gap`, `transfer`.

Strony UI (21): Dashboard, Structure, Production, BatchDetail, Transfers, Schedule, Feed, Warehouse, Health, Economics, Erd, Analytics, AiAdvisor, Erp, NutritionLab, CommandCenter, Editions, Coverage, Integrations, Login, NotFound.

### SOURCE B — FOUNDATION (`BLOODY-TURKEY-FOUNDATION`)

#### B.1 Główna aplikacja `apps/api` + `apps/web` — SZKIELET

| Warstwa | Implementacja | Status |
|---|---|---|
| Backend | NestJS 10, moduły: prisma, feed, health, audit, automation, event-bus, integration, notification, queue, workflow | **stuby** |
| Feed/Health service | `getStatus()` zwraca `{ ok: true, module: 'feed' }` | **STUB — brak logiki** |
| Prisma | `PrismaService` obecny, **brak `apps/api/prisma/schema.prisma`** (tylko `seed.ts`) | **KRYTYCZNY GAP** |
| Workflow/EventBus/Automation | Lekkie serwisy in-memory (65/46/28 linii) z testami spec | prototyp |
| Frontend `apps/web` | React 18 + Zustand + axios, 7 stron (Dashboard, WorkflowBuilder, ProcessMonitor, EventHistory, ScheduleManager, NotificationPanel, AISuggestions) | generyczny panel automatyzacji, **0 stron domenowych** |

#### B.2 Moduły domenowe (niezależne aplikacje NestJS + Prisma + własny frontend)

| Moduł | Backend | Modele Prisma | Endpointy | Frontend | Testy |
|---|---|---|---|---|---|
| `modules/feed-module` | NestJS, 9 serwisów (recipe, optimization, ai, alert, dashboard, experiment, expert, forecast, knowledge) | 21 | 24 (pełny CRUD receptur + generate/simulate/expert/forecast/comparison/knowledge) | Dashboard, ExperimentLab, ExpertCard, RecipeGenerator (CSS własne) | brak spec |
| `modules/health-intelligence-engine` | NestJS + JWT/Passport, 11 sub-modułów (health, vaccination, treatment, withdrawal, disease-library, ai-advisor, ai-detection, risk-score, dashboard, auth, audit) | 18 | 24 | brak | ai-advisor spec |
| `modules/production-engine` | **luźne pliki TS w root modułu** (batch/daily-log/transfer controller+service+dto) + 4 komponenty React | 14 | 15 | Dashboard, AIAnalysis, DigitalTwin, Timeline | brak |
| `modules/warehouse` | NestJS + **RBAC (jwt guard, roles guard, @Roles — 21 użyć)** + audit | 18 | 20 (products, lots, traceability, movements, transfers, inventory, AI analyze/substitutes, alerts, dashboard, recipes/reserve) | 6 widoków (Inventory, Traceability, Transfers, Alerts, AIForecast, Dashboard) | unit + integration |
| `modules/economics` | NestJS + RBAC (14 użyć) + audit | 13 | 13 (costs, predict, scenarios, advisors, benchmarks, sales, dashboard, executive-summary) | FinancialDashboard, BenchmarkView, SaleAnalysisView, ScenarioAnalyzer | unit + integration |
| `modules/iot` | Pełny stack: NestJS + **8 integracji sprzętowych** (MQTT, Modbus, OPC-UA, WebSocket, REST, Big Dutchman, Fancom, SKOV), telemetry gateway (WS), ai-engine, alarms | 19 | 20+ (devices 9, alarms 4, dashboard 4, ai-engine 2, auth 1) | 4 strony + komponenty (mapy, wykresy, digital-twin, powiadomienia) | devices, ai-engine spec |

#### B.3 Cechy wspólne FOUNDATION
- **ORM**: Prisma (6 niezależnych schematów, PostgreSQL), 103 modele łącznie (z duplikacją pojęć)
- **Migracje**: brak katalogów migrations w całym repo
- **Events**: `@nestjs/event-emitter` w apps/api i IoT
- **Audit**: `common/audit` w warehouse i economics; moduł audit w health
- **RBAC**: JWT + roles guard w warehouse/economics/health/IoT
- **Deployment**: `apps/api/Dockerfile`, IoT: docker + Grafana + Mosquitto
- **Dokumentacja**: `docs/` — 4 dokumenty (w tym wcześniejszy cleanup audit)

---

## 3. PORÓWNANIE STRATEGICZNE

### 3.1 Co KIMI ma, czego FOUNDATION nie ma
1. **Spójność runtime** — jedna baza, jeden serwer, jeden frontend; da się uruchomić i wdrożyć (WDROZENIE.md).
2. **Pełne pokrycie domen w jednym schemacie** — 60 tabel: od hatchery_batches po api_keys.
3. **Domeny ERP**: contractors/suppliers, purchase_orders, contracts, invoices, documents, tasks, messages.
4. **Model organizacyjny**: companies → farms → houses → sectors; transfers między halami.
5. **Warstwa licencji/edycji produktu** (TIERS: standard/advanced/professional/enterprise + route gating).
6. **Integracja Kimi OAuth** gotowa produkcyjnie.
7. **Command Center** (dailyReport, globalSignals, nutritionGenome, iotLive) — agregacja cross-domenowa.
8. **Struktura dynamicznych encji** (`dynamic_entities`) — rozszerzalność bez migracji.

### 3.2 Co FOUNDATION ma, czego KIMI nie ma
1. **Głęboka logika domenowa feed**: optymalizacja receptur, eksperymenty, prognozy zużycia, baza wiedzy o surowcach, porównania receptur, substytucje, profile ekspertów.
2. **Health Intelligence**: programy szczepień (VaccinationProgram/Step), risk scoring, AI detection, biblioteka chorób z referencjami.
3. **IoT production-grade**: 8 protokołów/integracji, telemetry WebSocket gateway, alarmy z ACK, digital twin, AI predictions/FCR/ADG.
4. **Warehouse**: loty z FEFO, pełna traceability, rezerwacje receptur, AI insights produktów.
5. **Economics**: scenariusze, benchmarki, executive summaries, predykcje kosztów.
6. **RBAC/permissions** realnie zaimplementowane (guardy, role).
7. **Warstwa serwisów** (separation of concerns), DTO z class-validator.
8. **Testy jednostkowe i integracyjne**.
9. **Swagger/OpenAPI**.

### 3.3 Największe konflikty architektoniczne
| Konflikt | KIMI | FOUNDATION | Skala |
|---|---|---|---|
| ORM | Drizzle (MySQL) | Prisma (PostgreSQL) | **fundamentalny** |
| API style | tRPC (typowane procedury) | REST + NestJS controllers + Swagger | wysoki |
| Backend runtime | Hono monolit | 7 oddzielnych aplikacji NestJS | wysoki |
| Auth | Kimi OAuth + sesja cookie | JWT Bearer + Passport | średni (do połączenia) |
| Authz | prawie brak (public endpoints) | RBAC guardy | średni |
| PK/ID | serial (int auto) | zależnie od modułu | niski |

---

## 4. FINAL DECISION

### 1. Czy lepszym fundamentem jest KIMI?
**Tak — jako szkielet produktu (runtime, DB, UI shell, deployment).** KIMI jest jedynym źródłem, które stanowi kompletny, uruchamialny system z jedną bazą danych, jednym API i pełnym UI. Jego słabości (brak enforcement auth, brak testów, logika w routerach) są naprawialne lokalnie.

### 2. Czy lepszym fundamentem jest FOUNDATION?
**Tak — jako źródło głębi domenowej i standardów inżynieryjnych.** Logika modułów (feed optimization, health intelligence, IoT integrations, warehouse traceability, economics scenarios), RBAC, warstwa serwisów, DTO i testy są znacząco dojrzalsze niż cokolwiek w KIMI. Ale FOUNDATION **nie jest uruchamialnym systemem** — to zbiór silosów.

### 3. Czy najlepszy jest HYBRID?
**Tak. HYBRID: KIMI jako Core/Shell + logika FOUNDATION przeniesiona modułami.** Decyzja szczegółowa w `BTE_TARGET_ARCHITECTURE.md`.

### 4. Co zachować z KIMI?
- Schemat Drizzle (60 tabel) jako docelowy model danych + 5 migracji
- Routery tRPC (jako cienka warstwa API po refaktorze do serwisów)
- Cały frontend shell (21 stron, shadcn/ui, edycje/licencje)
- Kimi OAuth, kontrakty, audit_log, deployment (Railway/Render/Docker)
- Modele ERP i organizacyjne (companies/farms/houses/sectors, contractors, invoices, documents, tasks)

### 5. Co zachować z FOUNDATION?
- Serwisy domenowe feed-module (recipe/optimization/experiment/forecast/knowledge/expert)
- Health-intelligence-engine (vaccination programs, risk score, AI detection, disease library)
- IoT całością (integracje, telemetry gateway, alarms, digital twin)
- Warehouse (lots/FEFO/traceability/reservations/AI insights) i Economics (scenarios/benchmarks/executive summary)
- Wzorzec RBAC (guards + roles), DTO + class-validator, Swagger, testy

### 6. Co połączyć?
- Modele danych: Batch, House, Recipe/Ingredient, HealthRecord/Treatment/Vaccination, Warehouse/Lot/StockMovement → scalenie w schemat KIMI (rozszerzenie o pola z FOUNDATION)
- RBAC FOUNDATION → middleware tRPC KIMI (zastąpienie `publicQuery` polityką uprawnień)
- Serwisy FOUNDATION → wywoływane z procedur tRPC KIMI (port NestJS→czyste serwisy TS)
- Frontendy modułów FOUNDATION → jako sekcje stron KIMI (po przepisaniu na shadcn/ui)

### 7. Czego nie łączyć?
- **Prisma + Drizzle w jednym systemie** — wybieramy Drizzle (spójność z migracjami KIMI); schematy Prisma służą jako specyfikacja domenowa do portu
- **NestJS apps/api FOUNDATION** (stuby) — nie przenosić; apps/web (generyczny panel) — porzucić
- Drugi system auth — JWT/Passport zastąpić rozszerzeniem Kimi OAuth o role
- Zduplikowane frontendowe klienty API (axios) — jeden klient tRPC

### 8. Jakie są największe konflikty?
1. ORM/baza: Drizzle+MySQL vs Prisma+PostgreSQL (wymaga portu modeli i mapowania typów)
2. API: tRPC vs REST/Swagger (zewnętrzne integracje oczekują REST → potrzebna fasada REST)
3. 103 modele FOUNDATION vs 60 tabel KIMI z nakładaniem pojęć (Batch, House, Recipe…) — konflikty pól i relacji
4. Autoryzacja: wszystko publiczne (KIMI) vs RBAC (FOUNDATION) — połączenie wymaga przemapowania uprawnień na każdym endpoincie

### 9. Jakie są największe ryzyka?
Pełny rejestr: `BTE_RISK_REGISTER.md`. Top 5:
1. **R1 (krytyczne)**: Port logiki FOUNDATION z Prisma/NestJS na Drizzle może utracić subtelne zachowania (transakcje, relacje, constraint'y) — brak migracji w FOUNDATION utrudnia rekonstrukcję.
2. **R2 (krytyczne)**: 39 publicznych endpointów KIMI — jeśli merge wyjdzie na produkcję przed wdrożeniem RBAC, system stoi otworem.
3. **R3 (wysokie)**: Brak testów w KIMI → brak siatki bezpieczeństwa przy wpinaniu serwisów FOUNDATION.
4. **R4 (wysokie)**: Rozjazd ID/kluczy (serial int vs modele FOUNDATION) przy mapowaniu relacji.
5. **R5 (średnie)**: IoT wymaga osobnego runtime (MQTT/Modbus gateways) — nie da się w pełni zmergować do monolitu Hono.

### 10. Jaki powinien być pierwszy krok implementacyjny?
**Krok 0+1 z planu integracji**: zamrożenie kontraktu danych — rozszerzenie `db/schema.ts` KIMI o brakujące pola/encje z FOUNDATION (bez usuwania niczego), wygenerowanie migracji Drizzle, a równolegle wdrożenie RBAC middleware na istniejących routerach KIMI (zamiana `publicQuery` → `authedQuery` + role). Oba zadania są odwracalne i nie wymagają jeszcze przenoszenia logiki.

---

## FINAL STATUS

# NOT READY FOR MERGE

**Uzasadnienie:** przed rozpoczęciem merge'a należy: (a) wybrać i zamrozić docelowy stos danych (rekomendacja: Drizzle+MySQL z KIMI), (b) naprawić lukę autoryzacyjną KIMI, (c) zbudować minimalną siatkę testów, (d) uzgodnić mapowanie 103 modeli Prisma → 60+ tabel Drizzle. Szczegóły: `BTE_INTEGRATION_PLAN.md`.

Nie rozpoczynano merge. Nie zmodyfikowano żadnego repozytorium.
