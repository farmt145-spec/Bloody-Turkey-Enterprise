# BTE MODULE MATRIX
## Porównanie modułów biznesowych — SOURCE A (KIMI) vs SOURCE B (FOUNDATION)

Legenda statusu: ✅ pełne · 🟡 częściowe · 🔴 brak/stub · ⭐ wybitna implementacja

---

## 1. FEED / NUTRITION

| Aspekt | SOURCE A (KIMI) | SOURCE B (FOUNDATION) |
|---|---|---|
| Funkcje | Receptury (CRUD + usuwanie), składniki z parametrami żywieniowymi, programy żywieniowe (feed_programs + stages), symulacja mieszanki (`nutrition.simulate`), asystent żywienia (`nutrition.assist`), raport eksperta receptury, historia receptur, analiza dokładności prognoz, zużycie paszy (feed_usages), dostawy (feed_deliveries) | ⭐ Generator receptur z optymalizacją, symulacje, **experiment lab** (scenariusze A/B), **expert system** (analiza decyzji, explain-why, karty surowców, profile ekspertów), **baza wiedzy o surowcach** (search/entries/interactions), prognozy zużycia z analizą dokładności, porównania receptur, alerty paszowe z ACK, ekonomika receptury |
| Modele | recipes, recipe_items, feed_ingredients, feed_programs, feed_program_stages, feed_usages, feed_deliveries, recipe_history, forecast_accuracy (9 tabel) | Recipe, RecipeIngredient, RecipeHistory, MaterialBatch, RawMaterialSubstitution, Supplier, NutritionalStandard, ProductionBatch, BatchRecipeAssignment, ProductionResult, FeedAlert, FeedInventory, MaterialExpertProfile, MaterialKnowledgeEntry, ExpertDecisionLog, ExperimentScenario, BatchForecast, ForecastAccuracy, RecipeComparison, UserExpertProfile, MaterialInteraction (21 modeli) |
| API | tRPC: farm.ingredients/recipes, nutrition.simulate/expertReport/ingredients/assist/deleteRecipe/exportData, feedProgram.programs, gap.recipeHistory/analyzeAccuracy/forecastAccuracy | REST 24 endpointy: CRUD recipes, generate, simulate, expert/*, experiments, forecasts, comparisons, knowledge, alerts, dashboard, batch analyze, economics |
| Services | Brak warstwy (logika w routerach) | 9 serwisów: recipe, optimization, ai, alert, dashboard, experiment, expert, forecast, knowledge |
| UI | Strony Feed + NutritionLab (shadcn/ui) | Dashboard, ExperimentLab, ExpertCard, RecipeGenerator (własne CSS) |
| Testy | 🔴 brak | 🔴 brak (moduł bez spec) |
| Status | 🟡 solidne podstawy CRUD + kalkulatory | ✅⭐ zaawansowana logika domenowa |

**Werdykt:** FOUNDATION dostarcza głębię (port serwisów), KIMI dostarcza UI i spójny model w jednej bazie.

---

## 2. HEALTH

| Aspekt | SOURCE A (KIMI) | SOURCE B (FOUNDATION) |
|---|---|---|
| Funkcje | Leczenia (treatments CRUD), szczepienia (vaccinations CRUD), biblioteka chorób (diseases), nekropsja (necropsyList), okresy karencji (withdrawals), wyniki badań (lab_results), leki (medicines), kontrole biosecurity (biosecurity_checks) | ⭐ Pełny Health Intelligence: health records z obrazami i dokumentami, **programy szczepień wieloetapowe** (VaccinationProgram/Step), zabiegi, karencje, nekropsja, lab results, **risk scoring**, **AI detection** (obrazy), **AI advisor**, biblioteka chorób z referencjami (DiseaseImage/DiseaseReference), dashboard zdrowia |
| Modele | treatments, vaccinations, diseases, necropsy, withdrawal_periods, lab_results, medicines, biosecurity_checks (8 tabel) | House, HealthRecord, HealthImage, HealthDocument, Vaccination, VaccinationProgram, VaccinationStep, Treatment, WithdrawalPeriod, Necropsy, LabResult, DailyMetric, EnvironmentData, Disease, DiseaseImage, DiseaseReference, RiskScore, AIAdvisorLog (18 modeli) |
| API | tRPC: farm.treatments/vaccinations, gap.diseases/necropsyList/withdrawals | REST 24 endpointy w 10 kontrolerach (health 5, treatment 4, vaccination 3, disease-library 3, withdrawal 2, auth 2, ai-advisor 1, ai-detection 1, dashboard 1, risk-score 1) |
| Services | Brak | Serwisy per sub-moduł + auth (JWT/Passport) |
| UI | Strona Health (shadcn/ui) | 🔴 brak frontendu |
| Testy | 🔴 brak | 🟡 ai-advisor.service.spec |
| Status | 🟡 rejestry podstawowe | ✅⭐ zaawansowany silnik |

**Werdykt:** logika FOUNDATION jednoznacznie lepsza; KIMI ma UI i tabele rejestrowe.

---

## 3. PRODUCTION

| Aspekt | SOURCE A (KIMI) | SOURCE B (FOUNDATION) |
|---|---|---|
| Funkcje | Stada (batches CRUD + detail), ważenia, selekcje (selects), śmiertelność, dzienne logi (daily_logs), podłoże (litter), KPI stad (`farm.kpis`, `farm.batchPnl`), wylęgarnia (hatchery_batches), harmonogram produkcji (schedule_events), porównanie stad (analytics.compareBatches) | DailyLog engine (batch CRUD, daily logs, transfery między halami), AIAnalysis, AIForecast, alerty produkcyjne, ProductionEvent, multimedia (Photo/Video/Document), DemoState |
| Modele | batches, weighings, selects, mortalities, litter, daily_logs, hatchery_batches, schedule_events, transfers (9 tabel) | Nursery, House, Batch, DailyLog, AIAnalysis, AIForecast, Alert, ProductionEvent, Vaccination, Treatment, Photo, Video, Document, DemoState (14 modeli) |
| API | tRPC: farm.batches + mutacje, daily.* (logi, programy), org.upcomingSchedule, transfer (częściowo) | REST 15 endpointów (batch 9, daily-log 3, transfer 3) — **luźna struktura plików, nie standardowy moduł NestJS** |
| Services | Brak | batch/daily-log/transfer service (plaski układ) |
| UI | Production, BatchDetail, Schedule, Transfers (shadcn/ui) | Dashboard, AIAnalysis, DigitalTwin, Timeline (React, luźne) |
| Testy | 🔴 brak | 🔴 brak |
| Status | ✅ spójny rejestr produkcji | 🟡 logika OK, struktura kodu słaba (pliki w root modułu) |

**Werdykt:** KIMI lepszy jako rejestr produkcji; z FOUNDATION portować tylko AIAnalysis/AIForecast/ProductionEvent/DigitalTwin koncepty.

---

## 4. WAREHOUSE

| Aspekt | SOURCE A (KIMI) | SOURCE B (FOUNDATION) |
|---|---|---|
| Funkcje | Magazyny + silosy, loty (warehouse_lots), ruchy magazynowe (stock_movements), traceability po numerze lotu (`gap.traceability`), skan alertów (`gap.scanAlerts`), przegląd magazynu (`org.warehouseOverview`) | ⭐ Produkty z AI insights, loty z pozycjami (Lot/LotItem), stany (StockItem), ruchy, transfery z wykonaniem (execute), **FIFO/FEFO**, pełna traceability, **rezerwacje pod receptury**, alerty magazynowe ze skanowaniem per organizacja, strefy/regały/lokalizacje (Zone/Rack/Location), dashboard |
| Modele | warehouses, silos, warehouse_lots, stock_movements (4 tabele) | Organization, House, Zone, Rack, Location, Product, ProductAIInsight, Lot, LotItem, StockItem, StockMovement, TransferItem, Supplier, Recipe, RecipeIngredient, WarehouseAIAnalysis, WarehouseAlert, Batch (18 modeli) |
| API | tRPC: gap.lots/traceability/scanAlerts, org.warehouseOverview | REST 20 endpointów, **RBAC @Roles na każdym (21 użyć guardów)** |
| Services | Brak | warehouse.service + common/audit + common/rbac |
| UI | Strona Warehouse (shadcn/ui) | 6 widoków: Inventory, Traceability, Transfer, Alerts, AIForecast, Dashboard |
| Testy | 🔴 brak | ✅ unit + integration |
| Status | 🟡 podstawowy | ✅⭐ zaawansowany z RBAC i testami |

**Werdykt:** FOUNDATION lepsze funkcjonalnie i inżynieryjnie; KIMI ma silosy (unikalne).

---

## 5. ECONOMICS

| Aspekt | SOURCE A (KIMI) | SOURCE B (FOUNDATION) |
|---|---|---|
| Funkcje | Koszty, sprzedaże, P&L stada (`farm.batchPnl`), KPI, podsumowanie energii (`analytics.energySummary`), scenariusze (scenarios), benchmarki z przeliczaniem (`gap.recalculateBenchmarks/benchmarks`), ERP: kontrahenci, zamówienia, kontrakty, faktury | ⭐ Dzienne koszty (DailyCost), predykcja kosztów (`predict`), scenariusze (ScenarioResult), AI advisor, benchmarki per ferma, analiza sprzedaży (SaleRecord + analysis), FinancialDashboard, **ExecutiveSummary** |
| Modele | costs, sales, suppliers, purchase_orders, contracts, invoices, scenarios, benchmarks, energy_logs (9 tabel) | House, Batch, DailyCost, FeedRecord, HealthRecord, TransferRecord, SaleRecord, Contractor, ScenarioResult, AIAdvisor, ExecutiveSummary, BenchmarkEntry, FinancialDashboard (13 modeli) |
| API | tRPC: farm.batchPnl/kpis, analytics.energySummary, gap.scenarios/benchmarks/recalculateBenchmarks, erp.list | REST 13 endpointów, RBAC (14 guardów) |
| Services | Brak | economics.service + audit + rbac |
| UI | Economics + Erp (shadcn/ui) | FinancialDashboard, BenchmarkView, SaleAnalysisView, ScenarioAnalyzer |
| Testy | 🔴 brak | ✅ unit + integration |
| Status | 🟡 P&L + pełny ERP (unikalny) | ✅⭐ analityka finansowa głębsza |

**Werdykt:** połączyć — ERP z KIMI + analityka/scenariusze/executive summary z FOUNDATION.

---

## 6. IOT

| Aspekt | SOURCE A (KIMI) | SOURCE B (FOUNDATION) |
|---|---|---|
| Funkcje | Logi klimatu (climate_logs), energia (energy_logs), tickety utrzymaniowe (maintenance_tickets), `command.iotLive` (podgląd na żywo — odczyt tabel), lista integracji (`gap.integrations`) | ⭐ **Produkcyjny silnik IoT**: urządzenia (Device/DeviceType, 9 endpointów CRUD), telemetria z WebSocket gateway, ClimateData, FeedSilo monitoring, alarmy z potwierdzaniem (AlarmAcknowledgement), powiadomienia, **AIPrediction/AIModel**, rejestry Mortality/FCR/ADG, MaintenanceRecord, **DigitalTwinState**, mapy budynków (Building/Zone), **8 integracji**: MQTT, Modbus, OPC-UA, WebSocket, REST API, Big Dutchman, Fancom, SKOV |
| Modele | climate_logs, energy_logs, maintenance_tickets, integrations (4 tabele) | Building, Zone, UserFarm, DeviceType, Device, Integration, Telemetry, ClimateData, FeedSilo, Alarm, AlarmAcknowledgement, Notification, AIPrediction, AIModel, MortalityRecord, FCRRecord, ADGRecord, MaintenanceRecord, DigitalTwinState (19 modeli) |
| API | tRPC: command.iotLive, gap.integrations (odczyt) | REST 20+ endpointów + telemetry.gateway (WS) + integracje |
| Services | Brak | devices, alarms, ai-engine, dashboard, telemetry + 8 adapterów integracji |
| UI | Integrations (lista), sekcje w CommandCenter | 4 strony + mapy, wykresy, digital-twin, AI, powiadomienia |
| Testy | 🔴 brak | ✅ devices + ai-engine spec |
| Infra | 🔴 brak | docker: Mosquitto (MQTT broker), Grafana |
| Status | 🟡 tylko rejestry odczytowe | ✅⭐ pełny stack |

**Werdykt:** IoT FOUNDATION przenieść niemal w całości (jako osobny serwis obok monolitu); KIMI zachowuje tylko tabele climate/energy jako warstwę raportową.

---

## PODSUMOWANIE MACIERZY

| Moduł | Lepsza implementacja | Akcja integracyjna |
|---|---|---|
| FEED/NUTRITION | **FOUNDATION** (logika) + KIMI (UI/model) | Port serwisów feed-module → wywołania z nutrition-router |
| HEALTH | **FOUNDATION** | Port health-intelligence-engine jako serwis domenowy |
| PRODUCTION | **KIMI** (rejestr) + FOUNDATION (AI) | KIMI zostaje; port AIAnalysis/AIForecast |
| WAREHOUSE | **FOUNDATION** | Port pełny + zachować silosy z KIMI |
| ECONOMICS | **HYBRID** | ERP z KIMI + analityka z FOUNDATION |
| IOT | **FOUNDATION** (bezdyskusyjnie) | Osobny serwis, wspólna baza raportowa |
