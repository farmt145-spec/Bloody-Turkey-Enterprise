# BTE FUNCTION MATRIX
## Macierz funkcjonalności

Legenda KIMI / FOUNDATION: ✅ pełne · 🟡 częściowe · 🔴 brak · ⭐ wybitne

| FUNCTION | KIMI | FOUNDATION | BEST IMPLEMENTATION | ACTION |
|---|---|---|---|---|
| Kalkulator pasz (symulacja mieszanki) | ✅ nutrition.simulate | ✅ recipes/simulate | FOUNDATION (optymalizacja) | MERGE: logika B → router A |
| Receptury CRUD | ✅ | ✅⭐ (generate, economics) | FOUNDATION | MERGE |
| Surowce / składniki | 🟡 jedna tabela z normami | ✅⭐ (material knowledge, substitutions, interactions) | FOUNDATION | PORT knowledge → A |
| Grupy wiekowe / etapy | ✅ feed_program_stages | 🔴 | KIMI | KEEP A |
| Normy żywieniowe | 🟡 (pola w feed_ingredients) | ✅ NutritionalStandard | FOUNDATION | PORT |
| Magazyn — stany i ruchy | 🟡 lots + movements | ✅⭐ StockItem/LotItem/FEFO | FOUNDATION | PORT |
| Magazyn — silosy | ✅ silos | 🟡 FeedSilo (IoT) | KIMI (tabela) + B (monitoring) | MERGE |
| Magazyn — traceability | 🟡 gap.traceability | ✅⭐ pełna | FOUNDATION | PORT |
| Magazyn — rezerwacje pod receptury | 🔴 | ✅ recipes/reserve | FOUNDATION | PORT |
| Produkcja — stada | ✅ | ✅ | KIMI (jedna tabela + hatchery) | KEEP A + pola AI z B |
| Produkcja — dzienne logi | ✅ daily.* | ✅ daily-log | KIMI (spójność z UI) | KEEP A |
| Produkcja — KPI/P&L stada | ✅ kpis, batchPnl | ✅ dashboard, sales/analysis | KIMI (UI) / B (głębia) | MERGE |
| Produkcja — harmonogram | ✅ schedule_events | 🔴 | KIMI | KEEP A |
| Produkcja — wylęgarnia | ✅ hatchery_batches | 🟡 Nursery | KIMI | KEEP A |
| Zdrowie — leczenia/karencje | ✅ | ✅⭐ | FOUNDATION | MERGE |
| Zdrowie — programy szczepień | 🔴 (tylko rejestr szczepień) | ✅⭐ VaccinationProgram/Step | FOUNDATION | PORT |
| Zdrowie — biblioteka chorób | 🟡 diseases | ✅⭐ + obrazy/referencje | FOUNDATION | PORT |
| Zdrowie — risk scoring | 🔴 | ✅ RiskScore | FOUNDATION | PORT |
| Zdrowie — biosecurity | ✅ biosecurity_checks | 🔴 | KIMI | KEEP A |
| Zdrowie — leki (rejestr) | ✅ medicines | 🔴 | KIMI | KEEP A |
| Ekonomia — koszty dzienne | 🟡 costs | ✅ DailyCost | FOUNDATION | PORT |
| Ekonomia — scenariusze | 🟡 scenarios (globalne) | ✅⭐ ScenarioResult per batch | FOUNDATION | MERGE (konflikt zakresu!) |
| Ekonomia — benchmarki | ✅ | ✅ | równe | MERGE |
| Ekonomia — executive summary | 🔴 | ✅ ExecutiveSummary | FOUNDATION | PORT |
| Ekonomia — ERP (kontrahenci, faktury, zamówienia, kontrakty) | ✅ erp.* | 🟡 Contractor, Supplier | KIMI | KEEP A + mapowanie Contractor→suppliers |
| IoT — urządzenia/telemetria | 🔴 (tylko logi klimatu/energii) | ✅⭐ pełny stack + 8 integracji | FOUNDATION | PORT jako osobny serwis |
| IoT — alarmy z ACK | 🔴 | ✅⭐ | FOUNDATION | PORT |
| IoT — digital twin | 🔴 | ✅⭐ | FOUNDATION | PORT |
| IoT — predykcje FCR/ADG | 🔴 | ✅ | FOUNDATION | PORT |
| Raporty — porównania stad | ✅ compareBatches | 🟡 ranking hal (docs) | KIMI | KEEP A |
| Raporty — dzienny raport / globalne sygnały | ✅ command.* | 🔴 | KIMI | KEEP A |
| Raporty — forecast accuracy | ✅ gap.* | ✅ forecasts/:id/analyze-accuracy | równe | MERGE |
| AI — wskazówki/advisor | 🟡 ai.advise (reguły) | ✅⭐ AIAdvisor (health, economics, warehouse, IoT) | FOUNDATION | PORT |
| AI — detekcja z obrazów | 🔴 | ✅ ai-detection | FOUNDATION | PORT |
| AI — nutrition assist | ✅ nutrition.assist | ✅ feed ai.service | równe (oba regułowe) | MERGE |
| Alerty | 🟡 farm.alerts (odczyt) | ✅⭐ FeedAlert/WarehouseAlert/Alarm z cyklem życia (ACK/resolve/scan) | FOUNDATION | MERGE (ujednolicić cykl) |
| Zadania | ✅ tasks | 🔴 | KIMI | KEEP A |
| Powiadomienia | ✅ notifications | ✅ (IoT) | KIMI (spójne) | KEEP A + źródło IoT |
| Wiadomości | ✅ messages | 🔴 | KIMI | KEEP A |
| Dokumenty | ✅ documents | 🟡 HealthDocument, production Document | KIMI | KEEP A |
| Użytkownicy | ✅ users + OAuth | 🟡 auth JWT bez centralnej tabeli | KIMI | KEEP A |
| Role / uprawnienia | 🟡 user/admin, nieegzekwowane | ✅⭐ RBAC guards + @Roles | FOUNDATION | PORT wzorzec → middleware tRPC |
| Licencje / edycje | ✅ TIERS (4 plany, route gating) | 🔴 | KIMI | KEEP A + rozszerzyć (patrz BTE_TARGET_ARCHITECTURE) |
| Audit | ✅ audit_log globalny | ✅ common/audit (per moduł) | KIMI (jedna tabela) | KEEP A + wywołania z serwisów B |
| Workflow/automation | 🔴 | 🟡 apps/api (prototyp, stuby) | żadne | DECIDE: porzucić lub rozwijać po merge |
| Event bus | 🔴 | 🟡 event-emitter (apps/api, IoT) | FOUNDATION | PORT lekki event bus |
| API keys / eksport | ✅ transfer.* | 🔴 | KIMI | KEEP A |
| Dynamic entities (EAV) | ✅ dynamic_entities | 🔴 | KIMI | KEEP A (kontrowersyjne — patrz ryzyka) |
| Mapa / geo | ✅ farm.mapData + lib/geo | 🟡 IoT maps | KIMI | KEEP A |
| Swagger/OpenAPI | 🔴 | ✅ | FOUNDATION | Dodać fasadę REST w docelowym |
| Testy | 🔴 0 testów | ✅ 9 spec + integracyjne | FOUNDATION | PORT podejście + napisać dla A |

---

## Podsumowanie punktowe
- KIMI wygrywa: **12** funkcji (głównie: spójność, ERP, org model, licencje, command center)
- FOUNDATION wygrywa: **18** funkcji (cała głębia AI/IoT/warehouse/health/economics)
- MERGE: **14** funkcji
