# BTE RISK REGISTER
## Rejestr ryzyk integracji

Skala: prawdopodobieństwo × wpływ (L/M/H) → priorytet. Stan na dzień audytu, bez implementacji.

| ID | Ryzyko | P | W | Priorytet | Opis / dowód z kodu | Mitigacja |
|---|---|---|---|---|---|---|
| R1 | Utrata logiki przy porcie Prisma/NestJS → Drizzle/czyste serwisy | H | H | **KRYTYCZNE** | 103 modele Prisma bez katalogów migrations; transakcje, kaskady, unikalne constraint'y nieudokumentowane poza schematem; serwisy (feed optimization, warehouse FEFO, economics predict) mają nietrywialną logikę | Testy charakteryzacyjne przed portem; port modułami (FEED→WAREHOUSE→HEALTH→ECONOMICS→PRODUCTION); code review mapowań tabela po tabeli |
| R2 | Otwarte endpointy biznesowe KIMI trafią na produkcję | H | H | **KRYTYCZNE** | 39/42 procedur to `publicQuery` — w tym mutacje: tworzenie stad, kasowanie receptur (`nutrition.deleteRecipe`), mutacje org (companies/farms/houses), `gap.scanAlerts`, `dynamicEntities.remove` | Krok 8 planu przed produkcją; feature flag ENFORCE_AUTH; konto demo |
| R3 | Brak siatki testów w KIMI | H | H | **WYSOKIE** | 0 plików testowych przy 60 tabelach i ~60 procedurach; vitest skonfigurowany ale pusty | Testy parity (przed/po) w Kroku 4–5; minimalne pokrycie krytycznych ścieżek przed M4 |
| R4 | Rozjazd kluczy/ID i relacji między schematami | M | H | **WYSOKIE** | KIMI: serial int PK, FK jako gołe kolumny bigint bez `references()`; FOUNDATION: relacje Prisma; merge wymaga spójnego modelu FK | Krok 2: jawne `references()` + indeksy; migracja na czystej bazie + seed jako weryfikacja |
| R5 | IoT nie mieści się w monolicie Hono | M | H | **WYSOKIE** | IoT FOUNDATION: MQTT/Modbus/OPC-UA/WebSocket gateway, Mosquitto, Grafana — wymaga własnych procesów i portów | IoT jako serwis satelitarny ze wspólną bazą; tylko warstwa raportowa w monolicie |
| R6 | Konflikty pojęciowe (D3) w kodzie i UI | M | M | ŚREDNIE | `transfers` (stada vs zapasy), `scenarios` (globalne vs per-batch), `alerts` (3 cykle życia), `House`×5 definicji | Rename wg BTE_DUPLICATE_REGISTER przed portem; glosariusz domenowy |
| R7 | Rozjazd wersji frontendowych | M | M | ŚREDNIE | React 19 (KIMI) vs 18 (FOUNDATION), zustand vs TanStack Query, własne CSS vs shadcn/ui | Nie przenosić frontendów B 1:1 — przepisywać widoki na shell KIMI |
| R8 | Audit rozjechany na 5 implementacji | M | M | ŚREDNIE | DUP-26: KIMI audit_log + 4 implementacje w FOUNDATION; różne schematy wpisów | Jedna funkcja `audit()` + tabela kanoniczna; mapowanie historycznych formatów (jeśli dane istnieją) |
| R9 | Schema bez indeksów po merge | M | M | ŚREDNIE | KIMI schema: zero jawnie zdefiniowanych indeksów poza PK/unique; po dodaniu ~30 tabel zapytania raportowe (command.*) zwolnią | Indeksy w Kroku 2 wg wzorców zapytań routerów |
| R10 | Dynamic entities (EAV) — dług techniczny | L | M | ŚREDNIE | `dynamic_entities` + gap.dynamicEntities (public) — obejście schematu, ryzyko rozproszenia logiki | Ograniczyć do tier PROFESSIONAL; dokumentacja granic użycia |
| R11 | Kimi OAuth jako jedyny mechanizm logowania | L | H | ŚREDNIE | Cały auth zależny od zewnętrznego IdP (`kimiAuthUrl`, JWKS); moduły B miały własny JWT login/register | Tryb dev-auth (lokalny JWT) dla środowisk bez IdP; dokumentacja failover |
| R12 | Dokumentacja FOUNDATION niezgodna z repo | L | M | NISKIE | BTE_DATABASE_INVENTORY wymienia schematy (bloody_turkey_schema, merged…) nieobecne w repo; README wspomina `zbuduj/` którego nie ma | Traktować docs B jako źródło historyczne; audyt (ten) jako aktualne źródło prawdy |
| R13 | Seed data niekompatybilny po rozszerzeniu schematu | M | L | NISKIE | 6 plików seed KIMI (1862 linie) zakłada obecny schema | Aktualizacja seedów w Kroku 2; SEED_DEMO jako test weryfikacyjny |
| R14 | Workflow/automation — martwy kod lub scope creep | M | L | NISKIE | FOUNDATION apps/api: workflow/automation/queue — prototypy bez kontrolerów; apps/web ma do nich UI | Decyzja świadoma: nie przenosić w M1–M5; ewentualnie na event busie po merge |
| R15 | Licencjonowanie zaimplementowane tylko w UI | L | M | ŚREDNIE | KIMI editions.ts: route gating wyłącznie po stronie klienta — obejście przez bezpośrednie wywołanie procedury | `requireTier` w middleware tRPC (Krok 9) jako jedyny enforcement |

---

## Macierz priorytetów

```
wpływ ↑
H │ R11        R4·R5        R1·R2·R3
M │ R15        R6·R7·R8·R9  
L │            R10·R12·R14 
  └──────────────────────────→ prawdopodobieństwo
       L          M            H
```

**Blokery przed STARTEM merge:** R1 (plan testów charakteryzacyjnych), R2 (decyzja o kolejności Kroku 8).
**Blokery przed PRODUKCJĄ:** R2, R3, R4, R5, R9, R15.
