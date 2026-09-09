# BTE API COMPARISON
## Inwentarz i klasyfikacja endpointów

Klasyfikacja: **COMMON** (oba) · **KIMI ONLY** · **FOUNDATION ONLY** · **CONFLICT**

Styl API:
- **KIMI**: tRPC 11 (procedury `query`/`mutation`, walidacja Zod inline, transformer superjson). Autoryzacja: `publicQuery` (39), `authedQuery` (2), `adminQuery` (0 realnych), 1× authedQuery z input (org.auditLog).
- **FOUNDATION**: REST + NestJS (Swagger, DTO class-validator). RBAC: JWT guard + `@Roles` (warehouse 21, economics 14 użyć).

---

## 1. KIMI — inwentarz tRPC (13 routerów, ~42 procedury)

| Router | Procedura | Typ | Auth | Klasyfikacja |
|---|---|---|---|---|
| (root) | ping | query | public | KIMI ONLY (healthcheck) |
| auth | me / logout | query / mutation | authed | COMMON (oba mają auth) |
| farm | placeholder | query | public | KIMI ONLY (martwy) |
| farm | batches (+3 mutacje CRUD) | query/mutation | public | COMMON (production-engine batch) |
| farm | ingredients | query | public | COMMON (feed material) |
| farm | recipes (+mutacja) | query/mutation | public | COMMON (feed recipes) |
| farm | treatments (+mutacja) | query/mutation | public | COMMON (health treatment) |
| farm | vaccinations (+mutacja) | query/mutation | public | COMMON (health vaccination) |
| farm | batchPnl | query | public | COMMON (economics sales/analysis) |
| farm | kpis | query | public | COMMON (dashboards) |
| farm | mapData | query | public | KIMI ONLY (geo) |
| farm | alerts | query | public | COMMON (feed/production/warehouse alerts) |
| org | companies (+CRUD mutacje ×kilkanaście: farms/houses/sectors) | query/mutation | public | KIMI ONLY (model organizacyjny) |
| org | upcomingSchedule | query | public | COMMON (schedule) |
| org | transfers | query | public | COMMON (production/warehouse transfers) |
| org | warehouseOverview | query | public | COMMON (warehouse dashboard) |
| org | auditLog | query | **authed** | COMMON (audit) |
| daily | (logi dzienne: 4 mutacje + queries) | mutation | public | COMMON (production daily-log) |
| feedProgram | programs | query | public | KIMI ONLY (programy żywieniowe) |
| erp | list (kontrahenci/zamówienia/kontrakty/faktury) | query | public | KIMI ONLY (ERP) |
| notifications | list / markRead / markAllRead | query/mutation | public | COMMON (IoT notifications) |
| analytics | compareBatches | query | public | FOUNDATION ma ranking hal w planach → COMMON |
| analytics | consumptionSeries | query | public | COMMON (forecast/consumption) |
| analytics | energySummary | query | public | KIMI ONLY (energia) |
| ai | advise | query | public | COMMON (AI advisors) |
| nutrition | simulate | query | public | COMMON (feed recipes/simulate) |
| nutrition | expertReport | query | public | COMMON (feed expert) |
| nutrition | ingredients | query | public | COMMON |
| nutrition | assist | query | public | COMMON (feed expert/analyze) |
| nutrition | deleteRecipe | mutation | public | COMMON (feed DELETE recipes/:id) |
| nutrition | exportData | query | public | KIMI ONLY |
| command | dailyReport / globalSignals / nutritionGenome / iotLive | query | public | KIMI ONLY (agregacja cross-domenowa) |
| gap | diseases | query | public | COMMON (health disease-library) |
| gap | necropsyList | query | public | COMMON (health necropsy) |
| gap | withdrawals | query | public | COMMON (health withdrawal) |
| gap | lots / traceability / scanAlerts | query/mutation | public | COMMON (warehouse lots/trace/alerts) |
| gap | scenarios / recalculateBenchmarks / benchmarks | query/mutation | public | COMMON (economics) |
| gap | recipeHistory / analyzeAccuracy / forecastAccuracy | query/mutation | public | COMMON (feed forecast) |
| gap | integrations (list) | query | public | COMMON (IoT integrations) |
| gap | dynamicEntities list/remove | query/mutation | public | KIMI ONLY (EAV) |
| transfer | exportAll / apiKeys / integrations | query | public | KIMI ONLY (eksport + klucze API) |

**Znalezisko krytyczne:** wszystkie mutacje biznesowe KIMI (tworzenie stad, receptur, leczeń, kasowanie receptur, skan alertów) są `publicQuery` — brak enforcement auth poza `auth.me`, `auth.logout`, `org.auditLog`.

---

## 2. FOUNDATION — inwentarz REST

### 2.1 apps/api (szkielet) — wszystkie FOUNDATION ONLY, ale STUB
| Kontroler | Endpointy | Stan |
|---|---|---|
| feed.controller | `GET /feed` | stub getStatus |
| health.controller | `GET /health` | stub getStatus |
| integration.controller | `POST /integration`, `GET /integration` | szyna integracji eventów (51 linii service) |
| (brak kontrolerów workflow/automation w src — serwisy + spec istnieją, nie podpięte) | — | prototyp |

### 2.2 feed-module (`@Controller`, prefix feed) — 24 endpointy
POST/GET/PUT/DELETE recipes, POST recipes/generate, POST recipes/simulate, POST expert/analyze-decision, POST expert/explain-why, GET expert/ingredient-card/:materialId, POST expert/profiles, POST experiments, GET experiments/:id, POST forecasts, POST forecasts/:id/analyze-accuracy, POST comparisons, GET knowledge/search, GET knowledge/material/:materialId, POST knowledge/entries, GET alerts, POST alerts/:id/acknowledge, GET dashboard, POST batches/:batchId/analyze, GET recipes/:id/economics.
→ Pokrycie w KIMI: ~40% (simulate, expertReport, recipeHistory/accuracy). **FOUNDATION ONLY**: generate, experiments, explain-why, knowledge, comparisons, alerts ACK, economics receptury.

### 2.3 health-intelligence-engine — 24 endpointy w 10 kontrolerach
health (5), treatment (4), vaccination (3), disease-library (3), withdrawal (2), auth (2: login/register), ai-advisor (1), ai-detection (1), dashboard (1), risk-score (1).
→ **FOUNDATION ONLY**: vaccination programs, risk-score, ai-detection, ai-advisor, dashboard zdrowia, własny login/register JWT.

### 2.4 warehouse — 20 endpointów (RBAC na wszystkich)
products (POST/GET/GET:id), lots (POST/GET), lots/traceability (POST), movements (POST), transfers (POST/POST execute/GET), inventory (GET/GET by-lot), ai/analyze/:productId (POST), ai/substitutes/:productId (GET), alerts (POST/POST resolve/GET/POST scan/:organizationId), dashboard/:organizationId (GET), recipes/reserve (POST).
→ **CONFLICT**: `transfers` w KIMI = przeniesienia stad między halami; w warehouse = przeniesienia zapasów. Różne pojęcia, ta sama nazwa.
→ **FOUNDATION ONLY**: products, inventory/by-lot, AI substitutes, reservations, alerts resolve.

### 2.5 economics — 13 endpointów (RBAC)
costs (POST/GET :batchId), predict (POST), scenarios (POST/GET :batchId), advisors/generate (POST), advisors/:batchId (GET), benchmarks (GET), benchmarks/recalculate/:farmId (POST), sales (POST), sales/analysis/:batchId (GET), dashboard (GET), executive-summary (POST).
→ **FOUNDATION ONLY**: predict, executive-summary, advisors per batch.
→ **CONFLICT**: scenarios w KIMI są globalne (limit 25), w economics per-batch.

### 2.6 production-engine — 15 endpointów
batch.controller (9), daily-log.controller (3), transfer.controller (3).
→ Większość COMMON z KIMI farm/daily. **FOUNDATION ONLY**: analizy AI per batch (AIForecast).

### 2.7 iot — 20+ endpointów + WebSocket
devices (9), alarms (4 + ACK), dashboard (4), ai-engine (2), auth (1), telemetry.gateway (WS, bez HTTP).
→ **FOUNDATION ONLY** niemal w całości (KIMI ma tylko odczyt climate/energy/integrations).

---

## 3. ZESTAWIENIE KLASYFIKACJI

| Kategoria | Liczba (szac.) | Uwagi |
|---|---|---|
| COMMON | ~45% pojemności funkcjonalnej | głównie odczyty rejestrów (batches, recipes, treatments, vaccinations, lots, scenarios, benchmarks, forecasts) |
| KIMI ONLY | ~20 procedur | ERP, org model, feedProgram, command center, mapData, energySummary, exportAll, apiKeys, dynamicEntities |
| FOUNDATION ONLY | ~70 endpointów | cała głębia AI/ekspertowa, IoT, RBAC-owane operacje warehouse/economics, health intelligence |
| CONFLICT | 4 | (1) transfers: stada vs zapasy; (2) scenarios: globalne vs per-batch; (3) auth: OAuth cookie vs JWT bearer; (4) alerts: feed/production/warehouse mają różne cykle życia (ACK vs resolve vs scan) |

## 4. VALIDATION / AUTH — PORÓWNANIE

| Cecha | KIMI | FOUNDATION |
|---|---|---|
| Walidacja request | Zod inline w procedurach | class-validator DTO (deklaratywne) |
| Response typing | infer z implementacji (tRPC → frontend typowany end-to-end) | Swagger schemas |
| Authentication | Kimi OAuth (cookie `kimi_sid`, JWKS) — opcjonalne w kontekście | JWT Bearer wymagany (guards) |
| Authorization | 2 role (user/admin), nieegzekwowane na biznesie | `@Roles` per endpoint, egzekwowane |
| Werdykt | tRPC lepsze DX front-back | FOUNDATION lepsze bezpieczeństwo — **wzorzec RBAC do przeniesienia** |
