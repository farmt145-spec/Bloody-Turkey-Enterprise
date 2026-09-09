/* Seed uzupełniający — dane dla modułów z dokumentacji (idempotentny) */
import { getDb } from "../api/queries/connection";
import * as s from "./schema";

const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5);
const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(a: T[]) => a[ri(0, a.length - 1)];

async function main() {
  const db = getDb();

  // choroby — biblioteka
  if (!(await db.select().from(s.diseases)).length) {
    const D = [
      ["Newcastle Disease (ND)", "Pseudoavian pest", "viral", "Apatia, zielonkawe odchody, objawy nerwowe, spadek nieśności/przyrostów", "Serologia HI, PCR z krtani", "Szczepienia profilaktyczne; brak leczenia przyczynowego — terapia wspomagająca", "Program szczepień ND, bioasekuracja, kontrola kontaktu z ptactwem dzikim", "critical"],
      ["Ornithobacteriosis (ORT)", "Ornithobacterium rhinotracheale", "bacterial", "Kichanie, obrzęk zatok, spadek pobrania paszy, pogorszenie FCR", "Wymaz z krtani PCR, posiew", "Doksycyklina lub amoksycylina wg antybiogramu", "Wentylacja, niski NH3, kontrola gęstości", "high"],
      ["Kokcydioza", "Eimeria spp.", "parasitic", "Wodniste odchody, śluz, krew w odchodach, spadek przyrostów", "Badanie kału na oocysty, sekcja jelit", "Toltrazuril w wodzie 2 dni", "Sucha ściółka, kokcydiostatyki w paszy, rotacja", "high"],
      ["Aspergillosis", "Aspergillus fumigatus", "fungal", "Duszność, wzrost śmiertelności w odchowie", "Sekcja — grudki w pęcherzach powietrznych, posiew", "Usunięcie źródła pleśni; itrakonazol wspomagająco", "Jakość ściółki i paszy, kontrola wilgotności", "medium"],
      ["Zespół dyspepsji / dysbakterioza", "—", "metabolic", "Niestrawiona pasza w odchodach, mokra ściółka, nierównomierność stada", "Ocena kału, analiza receptury", "Probiotyki, kwasy organiczne, korekta paszy", "Jakość tłuszczu i włókna, higiena pojenia", "medium"],
      ["Grypa ptaków (HPAI)", "Influenza A H5/H7", "viral", "Nagłe upadki, sinica, krwotoczki, objawy nerwowe", "RT-PCR w PIWet — choroba obowiązkowa", "Brak — utylizacja stada wg procedur PIW", "Strefa ochronna, monitoring dzikiego ptactwa", "critical"],
    ] as const;
    for (const [name, latinName, category, symptoms, diagnosis, treatmentProtocol, prevention, severity] of D) {
      await db.insert(s.diseases).values({ name, latinName, category, symptoms, diagnosis, treatmentProtocol, prevention, severity });
    }
  }

  const batches = await db.select().from(s.batches);
  const treatments = await db.select().from(s.treatments);
  const warehouses = await db.select().from(s.warehouses);
  const suppliers = await db.select().from(s.suppliers);
  const diseases = await db.select().from(s.diseases);

  // nekropsje
  if (!(await db.select().from(s.necropsy)).length && batches.length) {
    const ort = diseases.find((d) => d.name.includes("ORT"));
    for (let i = 0; i < 6; i++) {
      await db.insert(s.necropsy).values({
        batchId: pick(batches).id, day: dayStr(daysAgo(ri(2, 30))), birdCount: ri(2, 6),
        findings: pick([
          "Zapalenie pęcherzy powietrznych, włóknik na osierdziu, powiększona wątroba",
          "Zmiany krwotoczno-zapalne w jelitach, rozcięcie dwubrzuścia",
          "Zapalenie zatok, wydzielina śluzowa w tchawicy",
          "Brak zmian makroskopowych — podejrzenie przyczyn środowiskowych",
        ]),
        suspectedDiseaseId: Math.random() > 0.4 ? ort?.id ?? pick(diseases).id : null,
        vet: "dr.piotrowska", verdict: pick(["zakażenie bakteryjne", "kokcydioza", "przyczyny środowiskowe", "wymaga badań dodatkowych"]),
      });
    }
  }

  // karencje
  if (!(await db.select().from(s.withdrawalPeriods)).length && treatments.length) {
    for (const t of treatments.slice(0, 5)) {
      const start = String(t.startedAt).slice(0, 10);
      const safe = dayStr(new Date(new Date(start).getTime() + t.withdrawalDays * 864e5));
      await db.insert(s.withdrawalPeriods).values({
        treatmentId: t.id, batchId: t.batchId, medicine: t.product,
        startDay: start, withdrawalDays: t.withdrawalDays, safeFrom: safe,
      });
    }
  }

  // partie magazynowe + ruchy
  if (!(await db.select().from(s.warehouseLots)).length && warehouses.length) {
    const products = ["Pasza finisher", "Pasza grower", "Witamina AD3E", "Sól jodowana", "Ściółka słomiana", "Amoksycylina 50%"];
    for (let i = 0; i < 14; i++) {
      const p = pick(products);
      const qty = ri(200, 8000);
      const received = dayStr(daysAgo(ri(5, 60)));
      const expiry = dayStr(daysAhead(ri(-10, 120)));
      const [{ id }] = await db.insert(s.warehouseLots).values({
        warehouseId: pick(warehouses).id, product: p,
        lotNumber: `LOT/${received.slice(2, 4)}${received.slice(5, 7)}/${String(i + 1).padStart(3, "0")}`,
        qty: String(qty), unit: p.includes("Witamina") || p.includes("Amoksycylina") ? "l" : "kg",
        receivedDate: received, expiryDate: expiry,
        supplierId: suppliers.length ? pick(suppliers).id : null,
      }).$returningId();
      await db.insert(s.stockMovements).values({ lotId: id, kind: "in", qty: String(qty), reference: "przyjęcie partii", day: received });
      if (Math.random() > 0.5) {
        const out = Math.round(qty * 0.3);
        await db.update(s.warehouseLots).set({ qty: String(qty - out) }).where(eq_(id));
        await db.insert(s.stockMovements).values({ lotId: id, kind: "out", qty: String(out), reference: "wydanie FEFO", day: dayStr(daysAgo(ri(0, 4))), batchId: pick(batches).id });
      }
    }
  }

  // benchmarki
  if (!(await db.select().from(s.benchmarks)).length) {
    for (const [metric, value] of [["fcr", "2.31"], ["adgG", "118"], ["mortalityPct", "2.9"], ["epef", "542"]] as const) {
      await db.insert(s.benchmarks).values({ metric, value, period: "bieżący chów", source: "internal" });
    }
  }

  // integracje między modułami
  if (!(await db.select().from(s.integrations)).length) {
    const I = [
      ["iot", "production", "device", "Telemetria klimatu → dzienniki produkcji"],
      ["health", "production", "api", "Karencje blokują planowanie sprzedaży"],
      ["warehouse", "feed", "api", "Rezerwacja surowców pod receptury"],
      ["production", "economics", "api", "Koszty dzienne i prognoza zysku"],
      ["accounting", "erp", "webhook", "Eksport faktur do systemu księgowego"],
    ] as const;
    for (const [sourceModule, targetModule, kind, note] of I) {
      await db.insert(s.integrations).values({ sourceModule, targetModule, kind, config: { note } });
    }
  }

  console.log("Seed gap gotowy: choroby, nekropsje, karencje, partie, benchmarki, integracje.");
}
import { eq as eqOp } from "drizzle-orm";
const eq_ = (id: number) => eqOp(s.warehouseLots.id, id);
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
