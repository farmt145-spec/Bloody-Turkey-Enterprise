/* ============================================================
   TRANSFER DANYCH — pełny eksport/import danych chowu (JSON).
   Kopia zapasowa, przeniesienie między instalacjami, archiwum.
   Eksport: wszystkie kluczowe tabele domenowe.
   Import: tryb merge (pomija istniejące id) — bezpieczny.
   ============================================================ */
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import crypto from "crypto";
import { desc, eq } from "drizzle-orm";

/* tabele objęte pełnym transferem — kolejność ma znaczenie przy imporcie (rodzice przed dziećmi) */
const TABLES: { key: string; table: any; label: string }[] = [
  { key: "companies", table: s.companies, label: "Firmy" },
  { key: "geneticLines", table: s.geneticLines, label: "Linie genetyczne" },
  { key: "geneticLineNorms", table: s.geneticLineNorms, label: "Normy linii genetycznych" },
  { key: "farms", table: s.farms, label: "Fermy" },
  { key: "houses", table: s.houses, label: "Kurniki" },
  { key: "sectors", table: s.sectors, label: "Sektory" },
  { key: "batches", table: s.batches, label: "Rzuty" },
  { key: "weighings", table: s.weighings, label: "Ważenia" },
  { key: "selects", table: s.selects, label: "Selekcje" },
  { key: "mortalities", table: s.mortalities, label: "Padnięcia" },
  { key: "feedUsages", table: s.feedUsages, label: "Zużycia paszy" },
  { key: "litter", table: s.litter, label: "Ściółka" },
  { key: "transfers", table: s.transfers, label: "Transfery" },
  { key: "scheduleEvents", table: s.scheduleEvents, label: "Harmonogram" },
  { key: "treatments", table: s.treatments, label: "Zabiegi" },
  { key: "vaccinations", table: s.vaccinations, label: "Szczepienia" },
  { key: "costs", table: s.costs, label: "Koszty" },
  { key: "sales", table: s.sales, label: "Sprzedaże" },
  { key: "dailyLogs", table: s.dailyLogs, label: "Dziennik chowu" },
  { key: "feedIngredients", table: s.feedIngredients, label: "Surowce" },
  { key: "recipes", table: s.recipes, label: "Receptury" },
  { key: "recipeItems", table: s.recipeItems, label: "Składy receptur" },
  { key: "recipeHistory", table: s.recipeHistory, label: "Historia receptur" },
  { key: "feedPrograms", table: s.feedPrograms, label: "Programy żywienia" },
  { key: "feedProgramStages", table: s.feedProgramStages, label: "Fazy programów" },
  { key: "warehouses", table: s.warehouses, label: "Magazyny" },
  { key: "silos", table: s.silos, label: "Silosy" },
  { key: "feedDeliveries", table: s.feedDeliveries, label: "Wydania paszy" },
  { key: "suppliers", table: s.suppliers, label: "Dostawcy" },
  { key: "purchaseOrders", table: s.purchaseOrders, label: "Zamówienia" },
  { key: "contracts", table: s.contracts, label: "Kontrakty" },
  { key: "invoices", table: s.invoices, label: "Faktury" },
  { key: "medicines", table: s.medicines, label: "Leki" },
  { key: "labResults", table: s.labResults, label: "Wyniki badań" },
  { key: "climateLogs", table: s.climateLogs, label: "Klimat" },
  { key: "energyLogs", table: s.energyLogs, label: "Energia" },
  { key: "maintenanceTickets", table: s.maintenanceTickets, label: "Utrzymanie ruchu" },
  { key: "biosecurityChecks", table: s.biosecurityChecks, label: "Biosecurity" },
  { key: "documents", table: s.documents, label: "Dokumenty" },
  { key: "tasks", table: s.tasks, label: "Zadania" },
  { key: "messages", table: s.messages, label: "Wiadomości" },
  { key: "hatcheryBatches", table: s.hatcheryBatches, label: "Wylęgarnia" },
  { key: "diseases", table: s.diseases, label: "Choroby" },
  { key: "warehouseLots", table: s.warehouseLots, label: "Partie magazynowe" },
  { key: "stockMovements", table: s.stockMovements, label: "Ruchy magazynowe" },
  { key: "scenarios", table: s.scenarios, label: "Scenariusze" },
  { key: "slaughterPlans", table: s.slaughterPlans, label: "Plany uboju" },
  { key: "slaughterBatches", table: s.slaughterBatches, label: "Partie ubojowe" },
  { key: "transports", table: s.transports, label: "Transporty" },
  { key: "slaughterReceptions", table: s.slaughterReceptions, label: "Przyjęcia ubojowe" },
  { key: "slaughterResults", table: s.slaughterResults, label: "Wyniki uboju" },
  { key: "carcassClassDict", table: s.carcassClassDict, label: "Słownik klas" },
  { key: "carcassClassifications", table: s.carcassClassifications, label: "Klasyfikacja tuszek" },
  { key: "slaughterSettlements", table: s.slaughterSettlements, label: "Rozliczenia uboju" },
  { key: "slaughterEvents", table: s.slaughterEvents, label: "Zdarzenia ubojowe" },
  { key: "benchmarks", table: s.benchmarks, label: "Benchmarki" },
];

export const transferRouter = createRouter({
  /* Pełny eksport wszystkich danych chowu */
  exportAll: publicQuery.query(async () => {
    const db = getDb();
    const out: Record<string, any[]> = {};
    let rows = 0;
    for (const t of TABLES) {
      const data = await db.select().from(t.table);
      out[t.key] = data;
      rows += data.length;
    }
    return {
      format: "bloody-turkey-full-v1",
      exportedAt: new Date().toISOString(),
      tables: TABLES.map((t) => ({ key: t.key, label: t.label, rows: out[t.key].length })),
      totalRows: rows,
      data: out,
    };
  }),

  /* Import — merge: wstawia tylko rekordy o id, których nie ma w bazie */
  importAll: publicQuery
    .input(z.object({
      data: z.object({ format: z.string(), data: z.record(z.string(), z.array(z.any())) }).passthrough(),
    }))
    .mutation(async ({ input }) => {
      if (!String(input.data.format).startsWith("bloody-turkey-full")) {
        throw new Error("Nieprawidłowy format — oczekiwano pełnego eksportu Bloody Turkey (bloody-turkey-full-v1)");
      }
      const db = getDb();
      const report: { table: string; label: string; inserted: number; skipped: number }[] = [];
      for (const t of TABLES) {
        const rows = input.data.data[t.key];
        if (!Array.isArray(rows) || rows.length === 0) { report.push({ table: t.key, label: t.label, inserted: 0, skipped: 0 }); continue; }
        const existing = await db.select({ id: t.table.id }).from(t.table);
        const existingIds = new Set(existing.map((r: any) => Number(r.id)));
        let inserted = 0, skipped = 0;
        for (const row of rows) {
          if (row.id != null && existingIds.has(Number(row.id))) { skipped++; continue; }
          try {
            // konwersja pól czasowych z ISO string na Date
            const clean: Record<string, any> = {};
            for (const [k, v] of Object.entries(row)) {
              if (v == null) { clean[k] = v; continue; }
              if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) clean[k] = new Date(v);
              else clean[k] = v;
            }
            await db.insert(t.table).values(clean);
            if (row.id != null) existingIds.add(Number(row.id));
            inserted++;
          } catch (e: any) {
            if (/Duplicate/i.test(e.message)) skipped++;
            else throw new Error(`${t.label} (id ${row.id}): ${e.message.slice(0, 120)}`);
          }
        }
        report.push({ table: t.key, label: t.label, inserted, skipped });
      }
      return { ok: true, report };
    }),

  /* ============ KLUCZE API — wpinanie komputerów / czujników / systemów ============ */
  apiKeys: publicQuery.query(async () => {
    return getDb().select().from(s.apiKeys).orderBy(desc(s.apiKeys.id));
  }),

  createApiKey: publicQuery
    .input(z.object({ label: z.string().min(2).max(128) }))
    .mutation(async ({ input }) => {
      const raw = `btk_${crypto.randomBytes(24).toString("hex")}`;
      const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
      const keyPrefix = raw.slice(0, 12);
      const [{ id }] = await getDb().insert(s.apiKeys).values({ label: input.label, keyHash, keyPrefix }).$returningId();
      // pełny klucz zwracamy RAZ — potem przechowujemy tylko hash
      return { id, label: input.label, apiKey: raw, keyPrefix };
    }),

  revokeApiKey: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb().update(s.apiKeys).set({ active: false }).where(eq(s.apiKeys.id, input.id));
      return { ok: true };
    }),

  integrations: publicQuery.query(async () => {
    return getDb().select().from(s.integrations).orderBy(desc(s.integrations.id));
  }),
});

/* Weryfikacja klucza API (używana przez /api/v1/ingest w boot.ts) */
export async function verifyApiKey(raw: string) {
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");
  const [k] = await getDb().select().from(s.apiKeys).where(eq(s.apiKeys.keyHash, keyHash));
  if (!k || !k.active) return null;
  await getDb().update(s.apiKeys).set({ lastUsedAt: new Date() }).where(eq(s.apiKeys.id, k.id));
  return k;
}
