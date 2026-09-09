# BTE DUPLICATE REGISTER
## Rejestr duplikatów — TYLKO OZNACZENIE, bez usuwania

Klasy: **D1** duplikat wewnątrz FOUNDATION · **D2** duplikat KIMI ↔ FOUNDATION · **D3** konflikt pojęciowy (ta sama nazwa, inne znaczenie)

---

## 1. MODELE / ENCJE

| ID | Encja | Wystąpienia | Klasa | Rekomendowany kanon |
|---|---|---|---|---|
| DUP-01 | House | KIMI `houses` · FOUNDATION: health `House`, economics `House`, warehouse `House`, production `House` (IoT `Building`≈House) | D1×4 + D2 | KIMI `houses` (+ `sectors` za Zone) |
| DUP-02 | Batch | KIMI `batches` · FOUNDATION: production `Batch`, economics `Batch`, warehouse `Batch` | D1×3 + D2 | KIMI `batches` |
| DUP-03 | Recipe | KIMI `recipes` · FOUNDATION: feed `Recipe`, warehouse `Recipe` | D1 + D2 | KIMI `recipes` rozszerzone o pola feed-module |
| DUP-04 | RecipeIngredient | KIMI `recipe_items` · FOUNDATION: feed `RecipeIngredient`, warehouse `RecipeIngredient` | D1 + D2 | KIMI `recipe_items` |
| DUP-05 | RecipeHistory | KIMI `recipe_history` · FOUNDATION feed `RecipeHistory` | D2 | KIMI (identyczna funkcja) |
| DUP-06 | HealthRecord | FOUNDATION: health `HealthRecord`, economics `HealthRecord` · KIMI: rozbita na treatments/vaccinations/necropsy/lab_results | D1 + D3 | health `HealthRecord` jako nadrzędna rejestrowa + tabele KIMI |
| DUP-07 | Vaccination | KIMI `vaccinations` · FOUNDATION: health `Vaccination`, production `Vaccination` | D1 + D2 | health `Vaccination` (z Program/Step) |
| DUP-08 | Treatment | KIMI `treatments` · FOUNDATION: health `Treatment`, production `Treatment` | D1 + D2 | health `Treatment` |
| DUP-09 | WithdrawalPeriod | KIMI `withdrawal_periods` · FOUNDATION health `WithdrawalPeriod` | D2 | scalone (pola prawie identyczne) |
| DUP-10 | Necropsy | KIMI `necropsy` · FOUNDATION health `Necropsy` | D2 | scalone |
| DUP-11 | LabResult | KIMI `lab_results` · FOUNDATION health `LabResult` | D2 | scalone |
| DUP-12 | Disease | KIMI `diseases` · FOUNDATION health `Disease` (+Image/Reference) | D2 | FOUNDATION (bogatsza) |
| DUP-13 | Supplier/Contractor | KIMI `suppliers` · FOUNDATION: feed `Supplier`, warehouse `Supplier`, economics `Contractor` | D1×3 + D2 | KIMI `suppliers` (ERP) |
| DUP-14 | StockMovement | KIMI `stock_movements` · FOUNDATION warehouse `StockMovement` | D2 | FOUNDATION (powiązanie z Lot/StockItem) |
| DUP-15 | ForecastAccuracy | KIMI `forecast_accuracy` · FOUNDATION feed `ForecastAccuracy` | D2 | scalone (identyczna funkcja) |
| DUP-16 | Scenarios | KIMI `scenarios` (globalne) · FOUNDATION economics `ScenarioResult` (per batch) | D3 | rozdzielić nazwy: `batch_scenarios` vs `what_if_scenarios` |
| DUP-17 | Benchmarks | KIMI `benchmarks` · FOUNDATION economics `BenchmarkEntry` | D2 | scalone |
| DUP-18 | Alert (różne cykle życia) | KIMI `farm.alerts` (view) · FOUNDATION: feed `FeedAlert` (ACK), warehouse `WarehouseAlert` (resolve/scan), production `Alert`, IoT `Alarm` (ACK) | D3 | wspólny silnik alertów z typem źródła |
| DUP-19 | DailyLog | KIMI `daily_logs` · FOUNDATION production `DailyLog` | D2 | KIMI (spójny z UI) |
| DUP-20 | Transfer | KIMI `transfers` (stada między halami) · FOUNDATION: production `transfer` (stada), warehouse `TransferItem` (zapasy) | D3 | `flock_transfers` vs `stock_transfers` |
| DUP-21 | ClimateData | KIMI `climate_logs` · FOUNDATION IoT `ClimateData`, health `EnvironmentData` | D1 + D2 | IoT `ClimateData` → raportowanie do `climate_logs` |
| DUP-22 | Notification | KIMI `notifications` · FOUNDATION IoT `Notification`, apps/api notification.service | D1 + D2 | KIMI `notifications` |
| DUP-23 | Document | KIMI `documents` · FOUNDATION: health `HealthDocument`, production `Document` | D1 + D2 | KIMI `documents` z kolumną `domain` |
| DUP-24 | User/Farm assignment | KIMI `users.companyId` · FOUNDATION IoT `UserFarm` | D2 | KIMI users + join table user_farms |
| DUP-25 | Integration | KIMI `integrations` (rejestr) · FOUNDATION IoT `Integration` (konfiguracja adaptera) | D2 | scalone: konfiguracja IoT jako źródło, KIMI jako katalog |

## 2. SERVICES

| ID | Serwis | Wystąpienia | Klasa | Uwagi |
|---|---|---|---|---|
| DUP-26 | Audit | KIMI `api/audit.ts` · FOUNDATION: warehouse `common/audit`, economics `common/audit`, health `modules/audit`, apps/api `audit.service` | D1×4 + D2 | 5 implementacji! Kanon: KIMI `audit_log` + jedna funkcja `audit()` |
| DUP-27 | AI advisor | FOUNDATION: health ai-advisor, economics AIAdvisor/advisors, warehouse ProductAIInsight/WarehouseAIAnalysis, IoT ai-engine, production AIAnalysis, feed ai.service · KIMI `ai.advise` | D1×6 + D2 | wspólna fasada AI, 6 silników domenowych |
| DUP-28 | Dashboard | KIMI farm.kpis/command.dailyReport · FOUNDATION: feed dashboard, health dashboard, warehouse dashboard, economics dashboard, IoT dashboard, apps/web Dashboard | D1×5 + D2 | jeden Command Center + widżety domenowe |
| DUP-29 | Forecast/accuracy | KIMI gap.analyzeAccuracy · FOUNDATION feed forecast.service | D2 | kanon: feed-module |
| DUP-30 | RBAC guard | FOUNDATION: warehouse `common/rbac`, economics `common/rbac`, health auth guards, IoT auth | D1×4 | jeden pakiet @bte/auth |

## 3. CONTROLLERS / API

| ID | Zasób | Wystąpienia | Klasa |
|---|---|---|---|
| DUP-31 | recipes CRUD | KIMI farm.recipes + nutrition.* · FOUNDATION feed.controller recipes/* | D2 |
| DUP-32 | treatments CRUD | KIMI farm.treatments · FOUNDATION treatment.controller | D2 |
| DUP-33 | vaccinations CRUD | KIMI farm.vaccinations · FOUNDATION vaccination.controller | D2 |
| DUP-34 | lots/traceability | KIMI gap.lots/traceability · FOUNDATION warehouse lots/traceability | D2 |
| DUP-35 | scenarios | KIMI gap.scenarios · FOUNDATION economics scenarios | D3 |
| DUP-36 | benchmarks | KIMI gap.benchmarks · FOUNDATION economics benchmarks | D2 |
| DUP-37 | batches | KIMI farm.batches · FOUNDATION production batch.controller | D2 |
| DUP-38 | daily logs | KIMI daily.* · FOUNDATION daily-log.controller | D2 |
| DUP-39 | alerts | KIMI farm.alerts · FOUNDATION feed/warehouse/iot alerts+alarms | D3 |

## 4. KOMPONENTY UI

| ID | Komponent | Wystąpienia | Klasa |
|---|---|---|---|
| DUP-40 | Dashboard | KIMI src/pages/Dashboard · FOUNDATION apps/web Dashboard, feed Dashboard, warehouse WarehouseDashboard, economics FinancialDashboard, production Dashboard, IoT DashboardPage | D1×5 + D2 |
| DUP-41 | Alerts view | FOUNDATION warehouse AlertsView, feed alerts UI, IoT notifications · KIMI powiadomienia | D1 |
| DUP-42 | Scenario UI | KIMI (w Analytics) · FOUNDATION economics ScenarioAnalyzer | D2 |
| DUP-43 | DigitalTwin | FOUNDATION production DigitalTwin.tsx, IoT DigitalTwinPage | D1 |
| DUP-44 | AI views | KIMI AiAdvisor · FOUNDATION warehouse AIForecastView, production AIAnalysis, IoT ai components | D1 + D2 |

## 5. HOOKS / KLIENCI API / SCHEMATY

| ID | Element | Wystąpienia | Klasa |
|---|---|---|---|
| DUP-45 | API client | KIMI trpc provider · FOUNDATION axios client (apps/web), feed.api.ts, production api.client.ts, IoT api | D1×3 + D2 |
| DUP-46 | Store | FOUNDATION apps/web: zustand (3 store'y) · KIMI: TanStack Query cache | D3 (inne paradygmaty) |
| DUP-47 | Schema bazy | 6 schematów Prisma (FOUNDATION) vs 1 schema Drizzle (KIMI) | D1 |
| DUP-48 | Seed | KIMI 6 plików seed · FOUNDATION apps/api/prisma/seed.ts | D2 |

## 6. MODUŁY (poziom systemu)

| ID | Moduł | Wystąpienia | Klasa |
|---|---|---|---|
| DUP-49 | FEED | KIMI (farm+nutrition+daily routery) vs FOUNDATION feed-module | D2 (komplementarne, nie identyczne) |
| DUP-50 | HEALTH | KIMI (farm/gap) vs FOUNDATION health-intelligence-engine | D2 |
| DUP-51 | WAREHOUSE | KIMI (org/gap) vs FOUNDATION warehouse | D2 |
| DUP-52 | ECONOMICS | KIMI (farm.batchPnl/gap/erp) vs FOUNDATION economics | D2 |
| DUP-53 | PRODUCTION | KIMI (farm/daily/org) vs FOUNDATION production-engine | D2 |
| DUP-54 | IOT | KIMI (tylko rejestry) vs FOUNDATION iot | D2 (KIMI ⊂ FOUNDATION) |

**Podsumowanie:** 54 zarejestrowane duplikaty/konflikty: 24× D1 (wewnątrz FOUNDATION), 21× D2 (między projektami), 9× D3 (konflikty pojęciowe — najgroźniejsze przy merge). Nic nie usunięto.
