# BTE TARGET ARCHITECTURE
## Propozycja architektury docelowej BTE ENTERPRISE (bez implementacji)

Zasada nadrzędna: **KIMI = Core/Shell (baza, API, UI, auth, deploy) · FOUNDATION = Domain Engines (logika, RBAC, testy)**.

---

## 1. KSZTAŁT SYSTEMU

```
┌─────────────────────────────────────────────────────────────┐
│                    BTE ENTERPRISE (monorepo)                │
│                                                             │
│  apps/web          React 19 + shadcn/ui (z KIMI)            │
│  apps/api          Hono + tRPC (z KIMI)                     │
│  services/iot      NestJS + integracje (z FOUNDATION) ◄── osobny runtime (MQTT/Modbus/OPC-UA) │
│  packages/                                                  │
│    core            auth, rbac, audit, events, errors        │
│    contracts       Zod schemas + typy (single source)       │
│    database        Drizzle schema + migracje                │
│    domain/feed     serwisy feed-module (port)               │
│    domain/health   serwisy health-intelligence (port)       │
│    domain/warehouse serwisy warehouse (port)                │
│    domain/economics serwisy economics (port)                │
│    domain/production rejestry produkcji (KIMI) + AI (port)  │
└─────────────────────────────────────────────────────────────┘
         │ Drizzle ORM                    │ MQTT/WS/REST
         ▼                                ▼
   ┌───────────┐                  ┌────────────────┐
   │  MySQL 8  │ ◄── telemetria ─│  serwis IoT    │
   └───────────┘   raportowa     └────────────────┘
```

Decyzje:
- **Jeden ORM**: Drizzle + MySQL (KIMI ma migracje; Prisma pozostaje specyfikacją domenową do portu — nie runtime).
- **Jedno API biznesowe**: tRPC. Dodatkowo **fasada REST/OpenAPI** (dla integracji zewnętrznych i Swagger — wzorzec z FOUNDATION).
- **IoT jako satelita**: protokoły przemysłowe (MQTT/Modbus/OPC-UA/WebSocket) wymagają własnego procesu — nie wchodzi do monolitu; pisze telemetrię do wspólnej bazy.
- **Warstwa serwisów**: logika wyciągnięta z routerów KIMI i modułów FOUNDATION do `packages/domain/*` — routery tRPC stają się cienką warstwą (thin controllers, wzorzec FOUNDATION).

---

## 2. BLOKI ARCHITEKTURY

### CORE
- Pakiety współdzielone: env, logging, errors (z KIMI `contracts/errors.ts`), utils.
- Runtime: Hono + tRPC (istniejący `api/boot.ts`).

### AUTH
- Kimi OAuth (KIMI) jako jedyny mechanizm logowania.
- Model użytkownika: `users` (KIMI) + **tabela `user_farms`** (z FOUNDATION IoT `UserFarm`) + rozszerzone role.
- JWT/Passport z modułów FOUNDATION — wycofane po porcie serwisów.

### AUTHORIZATION / ROLES / PERMISSIONS
- Wzorzec RBAC z FOUNDATION (guards + @Roles) → **middleware tRPC**: `requirePermission("warehouse:write")`.
- Macierz: role × zasoby × akcje (propozycja ról: `admin`, `manager`, `zootechnik`, `magazynier`, `weterynarz`, `viewer` — finalna lista do zatwierdzenia).
- **Wszystkie obecne `publicQuery` → `authedQuery` + permission** (naprawa luki KIMI).

### ORGANIZATION
- Kanon: `companies → farms → houses → sectors` (KIMI) + `user_farms`.
- Mapowanie: warehouse `Organization`→`companies`; IoT `Building`→`houses`, `Zone`→`sectors`.

### DATABASE
- Drizzle schema (KIMI) rozszerzona o ~40 encji z FOUNDATION (lista w BTE_DATABASE_COMPARISON §7).
- Dodane: `references()` (FK), indeksy, enumy domenowe.
- Migracje: kontynuacja journal Drizzle (0005+).

### API
- 13 routerów KIMI zachowanych; nowe: `iotRouter` (odczyt telemetrii/alarmów), `warehouseRouter` (pełny), `healthRouter` (programy szczepień, risk), `feedExpertRouter` (knowledge/experiments/forecasts).
- Konflikty nazw rozwiązane wg BTE_DUPLICATE_REGISTER (flock_transfers vs stock_transfers itd.).

### CONTRACTS
- `packages/contracts`: Zod schemas jako single source → typy TS dla frontu i DTO dla fasady REST. Zastępuje: inline Zod (KIMI) + class-validator DTO (FOUNDATION).

### EVENTS
- Lekki event bus in-process (wzorzec: FOUNDATION event-emitter, 28 linii) rozszerzony o persistencję kluczowych zdarzeń do tabeli `events` → podstawa pod audit i automatyzacje.

### AUDIT
- Jedna tabela `audit_log` (KIMI) + jedna funkcja `audit()` wywoływana ze wszystkich serwisów domenowych (zastępuje 5 implementacji — DUP-26).

### WORKFLOW / AUTOMATION
- Faza 1: **nie przenosić** prototypu z FOUNDATION apps/api (stuby). Ewentualny rozwój po merge, na event busie.

### AI
- Fasada `aiRouter` (KIMI) + silniki domenowe z FOUNDATION: feed ai/expert, health ai-advisor/ai-detection/risk-score, warehouse AI insights, economics AIAdvisor, IoT AIPrediction.
- Zasada: silniki regułowe najpierw; integracja LLM opcjonalna, za feature flagą.

### Moduły domenowe (FEED / HEALTH / PRODUCTION / WAREHOUSE / ECONOMICS / IOT)
- Zgodnie z werdyktami w BTE_MODULE_MATRIX: port serwisów FOUNDATION → `packages/domain/*`, UI → sekcje stron KIMI (przepisanie widoków modułów na shadcn/ui).

---

## 3. LICENSING — macierz edycji (kontrola dostępu, NIE usuwanie kodu)

Bazuje na istniejącym rejestrze TIERS z KIMI (`src/lib/editions.ts`), zsynchronizowanym z faktycznymi funkcjami obu projektów. Licencja = flaga na `companies.tier` + enforcement w middleware tRPC i route gating UI.

| Funkcja | STANDARD | ADVANCED | PROFESSIONAL |
|---|---|---|---|
| Dashboard, stada, dzienne logi, harmonogram | ✅ | ✅ | ✅ |
| Struktura organizacji (companies/farms/houses/sectors) | ✅ (1 ferma) | ✅ (multi-farm) | ✅ |
| Żywienie: receptury CRUD, składniki, programy żywieniowe | ✅ | ✅ | ✅ |
| Kalkulator pasz (simulate) | ✅ | ✅ | ✅ |
| Leczenie: treatments, vaccinations, karencje, nekropsja | ✅ | ✅ | ✅ |
| Magazyn: stany, loty, ruchy, traceability | ✅ podstawa | ✅ FIFO/FEFO + rezerwacje | ✅ + AI insights |
| ERP: kontrahenci, zamówienia, kontrakty, faktury | ✅ | ✅ | ✅ |
| Dokumenty, zadania, wiadomości, powiadomienia | ✅ | ✅ | ✅ |
| Użytkownicy: liczba | do 5 | do 25 | bez limitu |
| Role i uprawnienia (RBAC) | role stałe | ✅ macierz | ✅ macierz |
| Audit log | podgląd 30 dni | ✅ pełny | ✅ pełny + eksport |
| Analityka: porównania stad, ranking hal, FCR/ADG/śmiertelność | 🔒 | ✅ | ✅ |
| AI Nutrition / Feed Advisor / Expert / Knowledge | 🔒 | ✅ | ✅ |
| AI Health (risk score, ai-detection) | 🔒 | ✅ | ✅ |
| Ekonomia: ROI, marża, scenariusze, benchmarki | 🔒 | ✅ | ✅ + Executive Summary |
| Eksperymenty paszowe, prognozy zużycia + accuracy | 🔒 | ✅ | ✅ |
| Programy szczepień wieloetapowe | 🔒 | ✅ | ✅ |
| Command Center (dailyReport, globalSignals, nutritionGenome) | 🔒 | 🔒 | ✅ |
| IoT: urządzenia, telemetria live, alarmy | 🔒 | 🔒 | ✅ |
| Integracje sprzętowe (Big Dutchman, Fancom, SKOV, Modbus, OPC-UA, MQTT) | 🔒 | 🔒 | ✅ |
| Digital Twin | 🔒 | 🔒 | ✅ |
| API keys + eksport danych (transfer.*) | 🔒 | 🔒 | ✅ |
| Dynamic entities (EAV) | 🔒 | 🔒 | ✅ |
| Wskazówka cenowa (z KIMI editions, PLN/mies.) | 299 | 899 | do ustalenia (KIMI sugeruje enterprise jako 4. poziom — tu scalono w PROFESSIONAL) |

Implementacja: `requireTier("advanced")` jako middleware obok `requirePermission`; UI zachowuje istniejący route gating z `editions.ts`. Żadna funkcja nie jest usuwana z kodu — licencja kontroluje wyłącznie dostęp.
