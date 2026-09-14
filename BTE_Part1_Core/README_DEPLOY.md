# BTE — Wdrożenie na Railway

## Zmiany w tej wersji

### Nowe pliki:
- `app/db/seed-domain-data.ts` — centralne dane hodowlane (normy, receptury, programy, choroby, leki, dostawcy)
- `app/db/seed-indykpol.ts` — idempotentny seed Indykpol S.A. z pełnymi danymi produkcyjnymi
- `app/db/seed-starter-pack.ts` — starter pack dla nowych firm (dane domenowe + przykładowy rzut)

### Zmodyfikowane pliki:
- `app/api/workspace-router.ts` — auto-provisioning Indykpol + createCompany z withStarterData
- `app/src/pages/FarmSelect.tsx` — checkbox "Dodaj przykładowe dane startowe"
- `app/deploy/start.sh` — automatyczny seed Indykpol przy starcie
- `app/package.json` — build z nowymi plikami seed

## Co dostajesz

| Dane | Indykpol (demo) | Nowa firma (starter pack) |
|------|-----------------|---------------------------|
| Linie genetyczne | 5 linii z 7-fazowymi normami | 5 linii z 7-fazowymi normami |
| Normy żywieniowe | białko, energia, lizyna, metionina | identyczne |
| Surowce paszowe | 22 surowce z pełnymi kartami | 22 surowce |
| Receptury | 3 receptury (Starter, Grower, Finisher) | 3 receptury |
| Programy żywieniowe | 2 programy (indory + indyczki) | 2 programy |
| Biblioteka chorób | 10 chorób z protokołami | 10 chorób |
| Leki | 8 leków z karencjami | 8 leków |
| Dostawcy | 10 dostawców | 10 dostawców |
| Rzuty z historią | ✓ pełna historia | 1 rzut 35-dniowy |
| Szczepienia | ✓ | ✓ podstawowe |
| Leczenia | ✓ | — |

## Deploy na Railway

### 1. Zmienne środowiskowe

W Railway → Variables:
```
DATABASE_URL=mysql://user:password@host:port/database
SEED_DEMO=false
```

### 2. Deploy

```bash
git add .
git commit -m "Domain data + Indykpol demo + starter pack + auto-provisioning"
git push origin main
```

Railway auto-deploy z Dockerfile.

### 3. Weryfikacja

Po deploy sprawdź logi:
```
== Bloody Turkey Enterprise — start ==
>> Migracje bazy danych...
>> Seed Indykpol (idempotentny)...
Tworzę Indykpol S.A. (demo)...
Seeduję dane domenowe dla firmy 1...
  ✓ 5 linii genetycznych z normami
  ✓ 22 surowców paszowych
  ✓ 3 receptur
  ✓ 2 programów żywieniowych
  ✓ 10 chorób w bibliotece
  ✓ 8 leków
  ✓ 10 dostawców
Indykpol S.A. gotowe: 2 fermy, X rzutów
>> Start serwera na porcie 3000
```

### 4. Test

1. Otwórz stronę — widzisz **Indykpol S.A. (DEMO)**
2. Kliknij → wybierz fermę → wybierz kurnik → widzisz rzuty z danymi
3. Wróć → **Dodaj własną firmę** (z zaznaczonym checkbox "dane startowe")
4. Nowa firma ma: normy, receptury, programy, 1 rzut 35-dniowy z historią
5. Indykpol niezmieniony — dane izolowane per companyId

## Idempotentność

- `ensureIndykpolDemo()` — sprawdza czy Indykpol istnieje, jeśli tak → pomija
- `seedDomainData()` — sprawdza czy firma ma linie genetyczne, jeśli tak → pomija
- `seedStarterPack()` — wywoływany tylko raz przy tworzeniu firmy
- Restart kontenera nie duplikuje danych


---

## Autentykacja (NOWE)

### Pliki autentykacji

| Plik | Opis |
|------|------|
| `app/api/auth-router.ts` | register, login, logout, me, changePassword, reset |
| `app/api/middleware.ts` | protectedQuery, adminQuery z JWT |
| `app/api/context.ts` | Rozszerzony kontekst z userem |
| `app/src/pages/Login.tsx` | Strona logowania/rejestracji |
| `app/src/components/AuthGuard.tsx` | Ochrona tras |
| `app/src/components/UserMenu.tsx` | Menu usera w headerze |
| `app/db/migrations/XXXX_add_auth.sql` | Migracja bazy |

### Zmienne środowiskowe

```
JWT_SECRET=twoj-dlugi-losowy-sekret-min-32-znakow
```

### Użycie w kodzie

```typescript
// Publiczne — bez logowania
publicQuery.query(async () => { ... })

// Chronione — wymaga zalogowania
protectedQuery.query(async ({ ctx }) => { 
  console.log(ctx.user.email) // dostęp do usera
})

// Admin — wymaga roli owner/admin
adminQuery.mutation(async ({ ctx }) => { ... })
```

### Role

| Rola | Uprawnienia |
|------|-------------|
| `owner` | Pełny dostęp + zarządzanie firmą |
| `admin` | Pełny dostęp do danych |
| `user` | Odczyt + edycja danych produkcyjnych |
| `viewer` | Tylko odczyt |

### Migracja bazy

Przed pierwszym deploy z auth, uruchom migrację:

```bash
# Lokalnie lub na Railway
mysql -u user -p database < app/db/migrations/XXXX_add_auth.sql
```

Lub dodaj do `migrate-all.ts` automatyczne wykonanie.



---

## Moduł ubojni — pełny łańcuch kosztów (NOWE)

### Pliki

| Plik | Opis |
|------|------|
| `app/api/slaughter-calc.ts` | `computeFullCostChain()` — od pisklaka do kg tuszki |
| `app/api/slaughter-cost-chain.ts` | Endpointy: getCostChain, compareCostChains, getCompanyCostOverview |
| `app/api/slaughter-reports.ts` | Eksport CSV/JSON + trend kosztów |
| `app/src/pages/SlaughterCostChain.tsx` | Frontend z wykresami i eksportem |

### Co oblicza

```
PISKLĘTA + PASZA + WETERYNARIA + ENERGIA + ŚCIÓŁKA + ROBOCIZNA + TRANSPORT + UBÓJ
────────────────────────────────────────────────────────────────────────────────
                    = KOSZT CAŁKOWITY

KOSZT/KG ŻYWCA  = totalCost / liveWeightKg
KOSZT/KG TUSZKI = totalCost / carcassWeightKg
FCR             = feedKg / liveWeightKg
EPEF            = (liveKg × yield%) / (age × FCR) × 100
```

### Endpointy API

| Endpoint | Opis |
|----------|------|
| `slaughterCostChain.getCostChain` | Pełny łańcuch dla jednej partii |
| `slaughterCostChain.compareCostChains` | Porównanie wielu partii |
| `slaughterCostChain.getCompanyCostOverview` | Przegląd z filtrami (ferma, data, linia, płeć) |
| `slaughterReports.exportCsv` | Eksport CSV |
| `slaughterReports.exportJson` | Eksport JSON |
| `slaughterReports.getCostTrend` | Trend miesięczny (12 miesięcy) |

### Strona SlaughterCostChain

- Karty KPI (partie, koszt/kg żywca, koszt/kg tuszki, wydajność)
- Filtry (linia genetyczna, płeć)
- Tabela partii z sortowaniem
- Wykres rozbicia kosztów per kategoria
- **Trend kosztów** — wykres słupkowy 12 miesięcy
- **Eksport CSV/JSON** — przyciski do pobrania danych
- Szczegóły wybranej partii (FCR, EPEF, marża)



---

## Nowe moduły (v2)

### 1. IoT Monitoring
- **Pliki**: `schema-iot.ts`, `iot-router.ts`, `iot-mqtt.ts`, `IoTDashboard.tsx`, `SensorConfig.tsx`
- **Funkcje**: Czujniki temperatury/wilgotności/NH3/CO2, MQTT bridge, alerty, dashboard
- **Endpointy**: ingest, getCurrent, getHistory, getAlerts, CRUD czujników

### 2. Digital Twin
- **Pliki**: `digital-twin.ts`, `DigitalTwin.tsx`
- **Funkcje**: 3D wizualizacja kurnika, symulacja karmników/wentylacji, heatmap gęstości
- **Endpointy**: getModel, simulateFeeders, simulateVentilation

### 3. EDI Ubojnia
- **Pliki**: `slaughter-edi.ts`
- **Funkcje**: Integracja z systemami ubojni (JSON/EDIFACT/CSV), webhook odbioru wyników
- **Endpointy**: sendOrder, receiveResults, getIntegrationStatus

### 4. Prognoza Uboju AI
- **Pliki**: `slaughter-forecast.ts`
- **Funkcje**: Model Gompertza, prognoza wagi, optymalny termin uboju, marża marginalna
- **Endpointy**: forecastWeight, compareBatches, getFcrTrend

---

## Zmienne środowiskowe (dodatkowe)

```
MQTT_BROKER=mqtt://broker:1883
MQTT_USERNAME=...
MQTT_PASSWORD=...
```

---

## Routing frontend (do dodania w App.tsx)

```tsx
import IoTDashboard from "@/pages/IoTDashboard";
import DigitalTwin from "@/pages/DigitalTwin";
import SensorConfig from "@/pages/SensorConfig";

// W Routes dodaj:
<Route path="/iot" element={<IoTDashboard />} />
<Route path="/iot/config" element={<SensorConfig />} />
<Route path="/digital-twin" element={<DigitalTwin />} />
<Route path="/slaughter/costs" element={<SlaughterCostChain />} />
```

---

## Migracja bazy (IoT)

```sql
-- Uruchom na bazie przed deploy
CREATE TABLE IF NOT EXISTS sensors (
  id SERIAL PRIMARY KEY,
  houseId BIGINT UNSIGNED NOT NULL,
  farmId BIGINT UNSIGNED NOT NULL,
  companyId BIGINT UNSIGNED NOT NULL,
  type ENUM('temperature', 'humidity', 'nh3', 'co2', 'light', 'pressure', 'water_flow', 'feed_level') NOT NULL,
  name VARCHAR(255) NOT NULL,
  serialNumber VARCHAR(100) NOT NULL UNIQUE,
  manufacturer VARCHAR(100),
  model VARCHAR(100),
  positionX DECIMAL(5,2),
  positionY DECIMAL(5,2),
  heightM DECIMAL(3,2) DEFAULT 1.50,
  minThreshold DECIMAL(8,2),
  maxThreshold DECIMAL(8,2),
  alertEnabled BOOLEAN DEFAULT TRUE,
  alertCooldownMin INT DEFAULT 30,
  isActive BOOLEAN DEFAULT TRUE,
  batteryPct INT,
  lastSeenAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensorReadings (
  id SERIAL PRIMARY KEY,
  sensorId BIGINT UNSIGNED NOT NULL,
  houseId BIGINT UNSIGNED NOT NULL,
  batchId BIGINT UNSIGNED,
  value DECIMAL(10,3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  signalQuality INT,
  batteryPct INT,
  deviceTime TIMESTAMP NOT NULL,
  serverTime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  isAnomaly BOOLEAN DEFAULT FALSE,
  anomalyScore DECIMAL(5,4),
  INDEX idx_sensor_time (sensorId, deviceTime),
  INDEX idx_house_time (houseId, deviceTime)
);

CREATE TABLE IF NOT EXISTS sensorHourly (
  id SERIAL PRIMARY KEY,
  sensorId BIGINT UNSIGNED NOT NULL,
  houseId BIGINT UNSIGNED NOT NULL,
  hour TIMESTAMP NOT NULL,
  avg DECIMAL(10,3) NOT NULL,
  min DECIMAL(10,3) NOT NULL,
  max DECIMAL(10,3) NOT NULL,
  stdDev DECIMAL(10,3),
  count INT NOT NULL,
  anomalyCount INT DEFAULT 0,
  INDEX idx_sensor_hour (sensorId, hour)
);

CREATE TABLE IF NOT EXISTS environmentAlerts (
  id SERIAL PRIMARY KEY,
  companyId BIGINT UNSIGNED NOT NULL,
  farmId BIGINT UNSIGNED NOT NULL,
  houseId BIGINT UNSIGNED NOT NULL,
  sensorId BIGINT UNSIGNED NOT NULL,
  batchId BIGINT UNSIGNED,
  type ENUM('threshold_exceeded', 'threshold_below', 'sensor_offline', 'anomaly_detected', 'battery_low') NOT NULL,
  severity ENUM('info', 'warning', 'critical') DEFAULT 'warning',
  value DECIMAL(10,3) NOT NULL,
  threshold DECIMAL(10,3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  isResolved BOOLEAN DEFAULT FALSE,
  resolvedAt TIMESTAMP,
  resolvedBy BIGINT UNSIGNED,
  resolution TEXT,
  notificationSent BOOLEAN DEFAULT FALSE,
  notificationSentAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_company_resolved (companyId, isResolved)
);

CREATE TABLE IF NOT EXISTS environmentNorms (
  id SERIAL PRIMARY KEY,
  geneticLineId BIGINT UNSIGNED,
  dayFrom INT NOT NULL,
  dayTo INT NOT NULL,
  tempMin DECIMAL(4,1) NOT NULL,
  tempMax DECIMAL(4,1) NOT NULL,
  tempTarget DECIMAL(4,1) NOT NULL,
  humidityMin DECIMAL(4,1) NOT NULL,
  humidityMax DECIMAL(4,1) NOT NULL,
  humidityTarget DECIMAL(4,1) NOT NULL,
  nh3Max DECIMAL(6,1) NOT NULL,
  nh3Target DECIMAL(6,1) NOT NULL,
  co2Max DECIMAL(6,1) NOT NULL,
  co2Target DECIMAL(6,1) NOT NULL,
  lightHours DECIMAL(4,1) NOT NULL,
  lightIntensity DECIMAL(8,1),
  airExchangeMin DECIMAL(6,2),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```



---

## Moduł finansowy (NOWE)

### Pliki

| Plik | Opis |
|------|------|
| `schema-finance.ts` | Tabele: invoices, invoiceItems, payments, counterparties, fixedCosts, budgets, exchangeRates |
| `finance-router.ts` | Endpointy: faktury, płatności, kontrahenci, koszty stałe, budżety, raporty |
| `FinanceDashboard.tsx` | Frontend: KPI, P&L, cash flow, aging, budżet |
| `XXXX_add_finance.sql` | Migracja bazy |

### Funkcje

- **Faktury** — zakup/sprzedaż/koszty z pozycjami i VAT
- **Płatności** — wpływy/wydatki z potwierdzaniem
- **Kontrahenci** — dostawcy i odbiorcy z NIP
- **Koszty stałe** — czynsz, ubezpieczenie z auto-księgowaniem
- **Budżet** — planowanie vs rzeczywistość
- **Raporty** — P&L, cash flow, aging, koszty per rzut

### Endpointy API

| Endpoint | Opis |
|----------|------|
| `finance.listInvoices` | Lista faktur z filtrami |
| `finance.getInvoice` | Szczegóły faktury z pozycjami |
| `finance.createInvoice` | Utwórz fakturę (transakcja) |
| `finance.updateInvoicePayment` | Aktualizuj status płatności |
| `finance.listPayments` | Lista płatności |
| `finance.createPayment` | Utwórz płatność |
| `finance.listCounterparties` | Lista kontrahentów |
| `finance.getProfitLoss` | P&L |
| `finance.getCashFlow` | Cash flow |
| `finance.getAging` | Aging należności |
| `finance.getBudget` | Budżet vs rzeczywistość |
| `finance.getBatchCosts` | Koszty per rzut |

### Strona FinanceDashboard

- **KPI**: przychody, koszty, marża, cash flow
- **P&L**: rachunek zysków i strat per kategoria
- **Cash Flow**: wpływy/wydatki z kategoriami
- **Aging**: przeterminowane faktury (0/30/60/90+ dni)
- **Budżet**: planowane vs rzeczywiste z wskaźnikiem wykonania
- **Koszty rzutów**: integracja z produkcją

### Routing frontend

```tsx
import FinanceDashboard from "@/pages/FinanceDashboard";

<Route path="/finance" element={<FinanceDashboard />} />
```

