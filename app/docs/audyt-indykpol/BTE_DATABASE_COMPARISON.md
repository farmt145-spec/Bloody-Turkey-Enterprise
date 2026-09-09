# BTE DATABASE COMPARISON
## Porównanie warstw danych — READ-ONLY, bez migracji

- **KIMI**: Drizzle ORM, MySQL, `db/schema.ts` — 60 tabel, 5 snapshotów migracji (0000–0004), PK `serial` (int), relacje przez kolumny FK (plik `db/relations.ts` pusty — placeholder)
- **FOUNDATION**: Prisma, PostgreSQL, **6 niezależnych schematów** — 103 modele łącznie, **0 katalogów migrations**, `apps/api` w ogóle bez schema.prisma

### Inwentarz schematów FOUNDATION
| Schemat | Modeli | Fokus |
|---|---|---|
| modules/feed-module/prisma/schema.prisma | 21 | feed/nutrition |
| modules/health-intelligence-engine/backend/prisma/schema.prisma | 18 | health |
| modules/warehouse/schema.prisma | 18 | warehouse |
| modules/economics/schema.prisma | 13 | economics |
| modules/production-engine/schema.prisma | 14 | production |
| modules/iot/apps/api/src/prisma/schema.prisma | 19 | iot |

Uwaga: `docs/BTE_DATABASE_INVENTORY.md` w FOUNDATION wspomina o archiwalnych schematach scalonych (bloody_turkey_schema, candidate_shared, eval_merged, merged_shared) — **nie ma ich w tym repo**; istnieją tylko schematy modułów.

---

## 1. MACIERZ ENCJI KLUCZOWYCH

Legenda: DUPLICATE · CONFLICT · KIMI BETTER · FOUNDATION BETTER · MERGE REQUIRED · MISSING

### Farm
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `farms` (companyId FK, nazwa, lokalizacja) | IoT: `UserFarm`; warehouse/economics: `Organization`; production: `Nursery` |
| Werdykt | **MERGE REQUIRED** | KIMI ma właściwą encję Farm; FOUNDATION rozbiło pojęcie na Organization/UserFarm/Nursery zależnie od modułu |

### Organization
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `companies` (wierzchołek hierarchii) | warehouse: `Organization`; brak w innych |
| Werdykt | **MERGE REQUIRED** — `companies` (KIMI) jako kanoniczna; `Organization` z warehouse zmapować 1:1 | |

### Building / House
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `houses` + `sectors` (podział hali) | IoT: `Building` + `Zone`; health/economics/warehouse/production: `House` (4 duplikaty) |
| Werdykt | **DUPLICATE ×4 w FOUNDATION** · **MERGE REQUIRED** — kanoniczne: `houses`/`sectors` (KIMI); `Building`/`Zone` (IoT) zmapować na houses/sectors | |

### Batch (stado)
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `batches` (houseId, geneticLineId, liczebność, daty, status) + `hatchery_batches` | production: `Batch`; economics: `Batch`; warehouse: `Batch` (3 duplikaty) |
| Werdykt | **DUPLICATE ×3 w FOUNDATION** · **KIMI BETTER** (jedna tabela, relacja do linii genetycznych i wylęgarni) · MERGE REQUIRED dla pól AI z production | |

### ProductionCycle
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | brak dedykowanej encji (cykl = okres życia `batches` + `schedule_events`) | dokumentacja wspomina ProductionCycle w schematach archiwalnych; w aktywnych schematach brak |
| Werdykt | **MISSING (oba)** — rozważyć jawny cykl produkcyjny lub udokumentować konwencję KIMI | |

### Recipe
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `recipes` + `recipe_items` + `recipe_history` | feed: `Recipe`, `RecipeIngredient`, `RecipeHistory`; warehouse: `Recipe`, `RecipeIngredient` (duplikat) |
| Werdykt | **DUPLICATE w FOUNDATION (feed vs warehouse)** · **MERGE REQUIRED** — kanoniczne z KIMI rozszerzone o pola optymalizacji z feed-module | |

### Ingredient / surowce
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `feed_ingredients` (wartości odżywcze w jednej tabeli) | feed: `MaterialBatch`, `RawMaterialSubstitution`, `NutritionalStandard`, `MaterialExpertProfile`, `MaterialKnowledgeEntry`, `MaterialInteraction`, `Supplier` |
| Werdykt | **FOUNDATION BETTER** (głębia wiedzy o surowcach) · MERGE REQUIRED — tabele wiedzy/knowledge portować jako rozszerzenie `feed_ingredients` | |

### Feed (zużycie/program)
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `feed_usages`, `feed_deliveries`, `feed_programs`, `feed_program_stages` | feed: `FeedInventory`, `FeedAlert`, `ProductionBatch`, `BatchRecipeAssignment`, `ProductionResult`, `BatchForecast`, `ExperimentScenario`, `ForecastAccuracy`, `RecipeComparison`; economics: `FeedRecord` |
| Werdykt | **FOUNDATION BETTER** (prognozy/eksperymenty) · KIMI BETTER (programy żywieniowe — brak w FOUNDATION) · MERGE REQUIRED | |

### HealthRecord
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | rozbita na `treatments`, `vaccinations`, `necropsy`, `lab_results`, `diseases`, `withdrawal_periods`, `medicines` | health: `HealthRecord` + `HealthImage` + `HealthDocument` + Vaccination(+Program/Step), Treatment, WithdrawalPeriod, Necropsy, LabResult, Disease(+Image/Reference), DailyMetric, EnvironmentData, RiskScore, AIAdvisorLog; economics: `HealthRecord` (duplikat) |
| Werdykt | **FOUNDATION BETTER** (programy szczepień, risk score, multimedia, AI) · KIMI BETTER (tabela `medicines` — brak w FOUNDATION) · MERGE REQUIRED | |

### Warehouse
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `warehouses`, `silos`, `warehouse_lots`, `stock_movements` | warehouse: `Warehouse` implikowana przez Organization/House + `Zone`, `Rack`, `Location`, `Product`, `ProductAIInsight`, `Lot`, `LotItem`, `StockItem`, `StockMovement`, `TransferItem`, `WarehouseAIAnalysis`, `WarehouseAlert`, `Supplier` |
| Werdykt | **FOUNDATION BETTER** (struktura lokacji, FEFO, AI) · KIMI BETTER (silosy — unikalne) · MERGE REQUIRED | |

### User
| | KIMI | FOUNDATION |
|---|---|---|
| Reprezentacja | `users` (unionId z OAuth, name, email, avatar, role enum user/admin, companyId) | IoT: `UserFarm` (przypisanie); feed: `UserExpertProfile`; health: auth module (User implikowany); brak wspólnego modelu User w Prisma modułów |
| Werdykt | **KIMI BETTER** (realny model użytkownika) · CONFLICT: FOUNDATION zakłada JWT users bez tabeli centralnej · MERGE REQUIRED (role rozszerzyć) | |

---

## 2. ENUMY

| | KIMI | FOUNDATION |
|---|---|---|
| Stan | 1 enum: `users.role` (`user`, `admin`) | Prisma enumy rozproszone per moduł (statusy alarmów, urządzeń, ruchów itd. — w schematach modułów) |
| Werdykt | **FOUNDATION BETTER** (bogactwo enumów domenowych) · CONFLICT: rola KIMI zbyt płaska vs role FOUNDATION | |

## 3. INDEKSY I CONSTRAINTS

| | KIMI | FOUNDATION |
|---|---|---|
| Indeksy | brak jawnie zdefiniowanych indeksów poza PK/unique (`unionId` unique) | Prisma — zależnie od modułu (relacje + unique constraints) |
| Constraints | FK jako zwykłe kolumny bigint — **brak `references()`** w Drizzle | relacje Prisma z FK |
| Werdykt | **FOUNDATION BETTER** — w KIMI należy dodać indeksy i FK constraints podczas merge'a | |

## 4. MIGRACJE

| | KIMI | FOUNDATION |
|---|---|---|
| Stan | ✅ 5 snapshotów Drizzle (0000_amusing_deadpool … 0004_faithful_emma_frost), journal kompletny | 🔴 brak katalogów migrations we wszystkich 6 schematach |
| Werdykt | **KIMI BETTER** — jedyny źródło prawdy o ewolucji bazy | |

## 5. REPOSITORIES / DTO

| | KIMI | FOUNDATION |
|---|---|---|
| Repositories | `api/queries/connection.ts` (singleton Drizzle), `queries/users.ts`; reszta zapytań inline w routerach | brak repozytoriów; serwisy NestJS z wstrzykiwanym PrismaService |
| DTO | Zod schemas inline (np. `mixInput`, `listInput`) | class-validator DTO per kontroler (feed: 7 plików DTO + 4 podkatalogi; production: batch/daily-log/transfer.dto) |
| Werdykt | **FOUNDATION BETTER** (jawne DTO, walidacja deklaratywna) — w docelowej architekturze: Zod jako kontrakt (tRPC) generujący typy | |

## 6. WYKRYTE ANOMALIE

1. `apps/api` FOUNDATION: `PrismaService` bez schema.prisma — aplikacja **niezdatna do build** w tej formie.
2. `db/relations.ts` KIMI: pusty placeholder — relacje Drizzle niezadeklarowane.
3. FOUNDATION: 4 niezależne definicje `House`, 3× `Batch`, 2× `Recipe`, 2× `HealthRecord` — sprzeczne źródła prawdy.
4. KIMI: FK bez constraints — ryzyko sierot w danych.
5. FOUNDATION: schematy archiwalne z inwentarza nieobecne w repo (dokumentacja ≠ stan repo).

## 7. REKOMENDACJA (bez wykonywania migracji)

Kanoniczny schemat docelowy: **Drizzle schema KIMI rozszerzony o encje/pola FOUNDATION** (VaccinationProgram/Step, RiskScore, AIAdvisorLog, Zone/Rack/Location, Lot/LotItem/StockItem, DailyCost/ScenarioResult/ExecutiveSummary, Device/Telemetry/Alarm/DigitalTwinState, knowledge/expert/forecast z feed-module), z dodanymi `references()` i indeksami. Szczegóły mapowania: `BTE_DUPLICATE_REGISTER.md` i `BTE_TARGET_ARCHITECTURE.md`.
