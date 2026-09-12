import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, and, ne, desc, inArray } from "drizzle-orm";
import { audit } from "./audit";
import { scopedFarmIds } from "./tenant";

/* Harmonogram domyślny — Workflow Engine */
export async function generateSchedule(batchId: number, startDate: string, sex: "toms" | "hens" | "mixed") {
  const db = getDb();
  const start = new Date(startDate);
  const growDays = sex === "toms" ? 140 : sex === "hens" ? 112 : 126;
  const add = (d: Date) => d.toISOString().slice(0, 10);
  const plan: Array<{ offset: number; type: s.ScheduleEvent["eventType"]; title: string }> = [
    { offset: -2, type: "washing", title: "Mycie kurnika" },
    { offset: -1, type: "disinfection", title: "Dezynfekcja kurnika" },
    { offset: -1, type: "housePrep", title: "Przygotowanie kurnika: nagrzanie, ściółka, sprawdzenie pojen" },
    { offset: 0, type: "placement", title: "Przyjęcie piskląt" },
    { offset: 7, type: "weighing", title: "Ważenie kontrolne (7. dzień)" },
    { offset: 14, type: "vaccination", title: "Szczepienie ND (Newcastle) — La Sota" },
    { offset: 14, type: "weighing", title: "Ważenie kontrolne (14. dzień)" },
    { offset: 21, type: "vaccination", title: "Szczepienie TRT / aMPV" },
    { offset: 21, type: "weighing", title: "Ważenie kontrolne (21. dzień)" },
    { offset: 28, type: "feedChange", title: "Zmiana paszy: Starter → Grower I" },
    { offset: 35, type: "vaccination", title: "Szczepienie HE (choroba krwotoczna)" },
    { offset: 42, type: "weighing", title: "Ważenie kontrolne (42. dzień)" },
    { offset: 49, type: "sampling", title: "Pobieranie prób (laboratorium)" },
    { offset: 56, type: "feedChange", title: "Zmiana paszy: Grower I → Grower II" },
    { offset: 56, type: "weighing", title: "Ważenie kontrolne (56. dzień)" },
    { offset: 63, type: "litter", title: "Ścielenie — dosypanie ściółki" },
    { offset: 70, type: "weighing", title: "Ważenie kontrolne (70. dzień)" },
    { offset: 77, type: "feedChange", title: "Zmiana paszy: Grower II → Finisher I" },
    { offset: 84, type: "weighing", title: "Ważenie kontrolne (84. dzień)" },
    { offset: 98, type: "weighing", title: "Ważenie kontrolne (98. dzień)" },
    { offset: Math.min(105, growDays - 14), type: "feedChange", title: "Zmiana paszy: Finisher I → Finisher II" },
    { offset: growDays - 7, type: "weighing", title: "Ważenie przed ubojem" },
    { offset: growDays, type: "sale", title: "Sprzedaż / ubój — raport końcowy" },
  ];
  for (const p of plan) {
    const d = new Date(start);
    d.setDate(d.getDate() + p.offset);
    await db.insert(s.scheduleEvents).values({ batchId, day: add(d), eventType: p.type, title: p.title });
  }
}

export const orgRouter = createRouter({
  /* ------- firmy / tryb ------- */
  companies: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(s.companies).where(ne(s.companies.status, "archived"));
    return rows;
  }),

  createCompany: publicQuery
    .input(z.object({ name: z.string().min(2), countryCode: z.string().length(2), baseCurrency: z.string().length(3).default("EUR") }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.companies).values(input).$returningId();
      await audit("companies", id, "create", { newValues: input });
      return { id };
    }),

  /* ------- linie genetyczne ------- */
  geneticLines: publicQuery
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return getDb().select().from(s.geneticLines)
        .where(and(eq(s.geneticLines.companyId, input.companyId), ne(s.geneticLines.status, "archived")));
    }),

  createGeneticLine: publicQuery
    .input(z.object({ companyId: z.number(), name: z.string().min(2), supplier: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.geneticLines).values(input).$returningId();
      await audit("genetic_lines", id, "create", { newValues: input });
      return { id };
    }),

  /* ------- struktura ------- */
  structure: publicQuery
    .input(z.object({ companyId: z.number() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId ?? input?.companyId;
      const companies = cid
        ? await db.select().from(s.companies).where(eq(s.companies.id, cid))
        : await db.select().from(s.companies).where(ne(s.companies.status, "archived"));
      const farmRows = await db.select().from(s.farms).where(ne(s.farms.status, "archived"));
      const houseRows = await db.select().from(s.houses).where(ne(s.houses.status, "archived"));
      const sectorRows = await db.select().from(s.sectors).where(ne(s.sectors.status, "archived"));
      const batchRows = await db.select().from(s.batches).where(ne(s.batches.status, "archived"));
      return {
        companies: companies.map((c) => ({
          ...c,
          farms: farmRows.filter((f) => f.companyId === c.id).map((f) => ({
            ...f,
            houses: houseRows.filter((h) => h.farmId === f.id).map((h) => ({
              ...h,
              sectors: sectorRows.filter((sec) => sec.houseId === h.id),
              batches: batchRows.filter((b) => b.houseId === h.id),
            })),
          })),
        })),
      };
    }),

  createFarm: publicQuery
    .input(z.object({
      companyId: z.number(), name: z.string().min(2), countryCode: z.string().length(2),
      city: z.string().min(2), lat: z.number(), lng: z.number(), capacity: z.number().int().min(0),
    }))
    .mutation(async ({ input }) => {
      const [{ id }] = await getDb().insert(s.farms).values({
        ...input, countryCode: input.countryCode.toUpperCase(),
        lat: input.lat.toFixed(5), lng: input.lng.toFixed(5),
      }).$returningId();
      await audit("farms", id, "create", { newValues: input });
      return { id };
    }),

  updateFarm: publicQuery
    .input(z.object({
      id: z.number(), name: z.string().min(2).optional(), city: z.string().optional(),
      capacity: z.number().int().optional(), lat: z.number().optional(), lng: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.farms).where(eq(s.farms.id, input.id));
      const { id, ...rest } = input;
      const data: Record<string, string | number> = {};
      if (rest.name) data.name = rest.name;
      if (rest.city) data.city = rest.city;
      if (rest.capacity !== undefined) data.capacity = rest.capacity;
      if (rest.lat !== undefined) data.lat = rest.lat.toFixed(5);
      if (rest.lng !== undefined) data.lng = rest.lng.toFixed(5);
      await db.update(s.farms).set({ ...data, updatedBy: "panel" }).where(eq(s.farms.id, id));
      await audit("farms", id, "update", { oldValues: old, newValues: data });
      return { ok: true };
    }),

  archiveFarm: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.farms).where(eq(s.farms.id, input.id));
      await db.update(s.farms).set({ status: "archived", updatedBy: "panel" }).where(eq(s.farms.id, input.id));
      await audit("farms", input.id, "delete", { oldValues: old });
      return { ok: true };
    }),

  createHouse: publicQuery
    .input(z.object({
      farmId: z.number(), name: z.string().min(1),
      houseType: z.enum(["brooder", "finisher"]), areaM2: z.number().min(10),
      sectorCount: z.number().int().min(0).max(8).default(0),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id }] = await db.insert(s.houses).values({
        farmId: input.farmId, name: input.name, houseType: input.houseType,
        areaM2: input.areaM2.toFixed(1), maxDensityKgM2: input.houseType === "brooder" ? "25.0" : "42.0",
      }).$returningId();
      await audit("houses", id, "create", { newValues: input });
      for (let i = 0; i < input.sectorCount; i++) {
        const [{ id: sid }] = await db.insert(s.sectors).values({
          houseId: id, name: `Sektor ${String.fromCharCode(65 + i)}`,
          areaM2: (input.areaM2 / input.sectorCount).toFixed(1),
        }).$returningId();
        await audit("sectors", sid, "create", { newValues: { houseId: id, index: i } });
      }
      return { id };
    }),

  updateHouse: publicQuery
    .input(z.object({
      id: z.number(), name: z.string().min(1).optional(),
      areaM2: z.number().optional(), maxDensityKgM2: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.houses).where(eq(s.houses.id, input.id));
      const data: Record<string, string> = {};
      if (input.name) data.name = input.name;
      if (input.areaM2) data.areaM2 = input.areaM2.toFixed(1);
      if (input.maxDensityKgM2) data.maxDensityKgM2 = input.maxDensityKgM2.toFixed(1);
      await db.update(s.houses).set({ ...data, updatedBy: "panel" }).where(eq(s.houses.id, input.id));
      await audit("houses", input.id, "update", { oldValues: old, newValues: data });
      return { ok: true };
    }),

  archiveHouse: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.houses).where(eq(s.houses.id, input.id));
      await db.update(s.houses).set({ status: "archived", updatedBy: "panel" }).where(eq(s.houses.id, input.id));
      await audit("houses", input.id, "delete", { oldValues: old });
      return { ok: true };
    }),

  createBatch: publicQuery
    .input(z.object({
      houseId: z.number(), sectorId: z.number().optional(), code: z.string().min(3),
      geneticLine: z.string(), geneticLineId: z.number().optional(),
      sex: z.enum(["toms", "hens", "mixed"]), initialCount: z.number().int().min(1),
      startDate: z.string(), chickSupplier: z.string().optional(), chickPrice: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      // Chów mieszany: na jednym kurniku można prowadzić indory i indyczki jako osobne stada.
      const activeInHouse = await db.select({ sex: s.batches.sex, code: s.batches.code }).from(s.batches)
        .where(and(eq(s.batches.houseId, input.houseId), eq(s.batches.status, "active")));
      const sexes = new Set(activeInHouse.map((a) => a.sex));
      if (input.sex === "mixed" && activeInHouse.length > 0)
        throw new Error(`Kurnik jest zajęty (${activeInHouse.map((a) => a.code).join(", ")}) — stado mieszane wymaga pustego kurnika.`);
      if (sexes.has("mixed"))
        throw new Error(`W kurniku jest już stado mieszane (${activeInHouse[0].code}) — nie można dołożyć osobnej płci.`);
      if (sexes.has(input.sex))
        throw new Error(`W tym kurniku jest już aktywne stado tej samej płci (${activeInHouse.map((a) => a.code).join(", ")}). Dozwolony chów mieszany: indory + indyczki.`);
      const growDays = input.sex === "toms" ? 140 : input.sex === "hens" ? 112 : 126;
      const end = new Date(input.startDate); end.setDate(end.getDate() + growDays);
      const [{ id }] = await db.insert(s.batches).values({
        houseId: input.houseId, sectorId: input.sectorId, geneticLineId: input.geneticLineId,
        code: input.code, geneticLine: input.geneticLine, sex: input.sex,
        initialCount: input.initialCount, currentCount: input.initialCount,
        startDate: input.startDate, plannedEndDate: end.toISOString().slice(0, 10),
        chickSupplier: input.chickSupplier, chickPrice: (input.chickPrice ?? 1.6).toFixed(3),
      }).$returningId();
      await audit("batches", id, "create", { newValues: input });
      await generateSchedule(id, input.startDate, input.sex);

      /* Automatyczny program żywieniowy wg norm linii genetycznej —
         wartości odżywcze całego chowu są spójne z wybraną rasą. */
      if (input.geneticLineId) {
        const norms = await db.select().from(s.geneticLineNorms)
          .where(eq(s.geneticLineNorms.geneticLineId, input.geneticLineId));
        if (norms.length > 0) {
          const [existing] = await db.select().from(s.feedPrograms)
            .where(and(eq(s.feedPrograms.companyId, ctx.companyId ?? 0), eq(s.feedPrograms.name, `Program — ${input.geneticLine}`))).limit(1);
          let programId = existing?.id;
          if (!programId) {
            const [{ id: pid }] = await db.insert(s.feedPrograms).values({
              companyId: ctx.companyId ?? 0, name: `Program — ${input.geneticLine}`, sex: input.sex,
            }).$returningId();
            programId = pid;
            const phaseName: Record<string, string> = {
              prestarter: "Prestarter", starter: "Starter 2", starter1: "Starter 1", starter2: "Starter 2",
              grower1: "Grower I", grower2: "Grower II", finisher1: "Finisher I", finisher2: "Finisher II",
            };
            for (const n of norms) {
              await db.insert(s.feedProgramStages).values({
                programId, name: phaseName[n.phaseKey] ?? n.phaseKey,
                dayFrom: n.dayFrom, dayTo: n.dayTo,
                proteinTargetPct: n.proteinPct, energyTargetKcal: n.energyKcal, feedPerBirdG: n.feedPerBirdG,
              });
            }
          }
        }
      }
      return { id };
    }),

  closeBatch: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.batches).where(eq(s.batches.id, input.id));
      await db.update(s.batches).set({ status: "closed", currentCount: 0, soldCount: old.currentCount + old.soldCount, updatedBy: "panel" }).where(eq(s.batches.id, input.id));
      await audit("batches", input.id, "update", { oldValues: old, newValues: { status: "closed" } });
      return { ok: true };
    }),

  /* ------- harmonogram ------- */
  schedule: publicQuery
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input }) => {
      return getDb().select().from(s.scheduleEvents)
        .where(eq(s.scheduleEvents.batchId, input.batchId))
        .orderBy(s.scheduleEvents.day);
    }),

  toggleScheduleEvent: publicQuery
    .input(z.object({ id: z.number(), done: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb().update(s.scheduleEvents)
        .set({ done: input.done, doneAt: input.done ? new Date() : null })
        .where(eq(s.scheduleEvents.id, input.id));
      await audit("schedule_events", input.id, "update", { newValues: { done: input.done } });
      return { ok: true };
    }),

  upcomingSchedule: publicQuery.query(async () => {
    const db = getDb();
    const [rows, batchRows] = await Promise.all([
      db.select().from(s.scheduleEvents).where(eq(s.scheduleEvents.done, false)).orderBy(s.scheduleEvents.day),
      db.select().from(s.batches),
    ]);
    const codeOf = (id: number) => batchRows.find((b) => b.id === id)?.code ?? "?";
    return rows.map((r) => ({ ...r, batchCode: codeOf(r.batchId) }));
  }),

  /* ------- transfery ------- */
  transfers: publicQuery.query(async () => {
    const db = getDb();
    const [rows, batchRows, houseRows, farmRows] = await Promise.all([
      db.select().from(s.transfers).orderBy(desc(s.transfers.transferDate)),
      db.select().from(s.batches),
      db.select().from(s.houses),
      db.select().from(s.farms),
    ]);
    const loc = (batchId: number) => {
      const b = batchRows.find((x) => x.id === batchId);
      const h = b && houseRows.find((x) => x.id === b.houseId);
      const f = h && farmRows.find((x) => x.id === h.farmId);
      return b ? `${b.code} · ${h?.name ?? "?"} · ${f?.city ?? "?"}` : "?";
    };
    return rows.map((t) => ({ ...t, source: loc(t.sourceBatchId), target: loc(t.targetBatchId) }));
  }),

  executeTransfer: publicQuery
    .input(z.object({
      sourceBatchId: z.number(), targetHouseId: z.number(), birdCount: z.number().int().min(1),
      driver: z.string().optional(), vehicle: z.string().optional(),
      durationMin: z.number().int().optional(), transportMortality: z.number().int().min(0).default(0),
      signatureFrom: z.string().optional(), signatureTo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [src] = await db.select().from(s.batches).where(eq(s.batches.id, input.sourceBatchId));
      if (!src) throw new Error("Rzut źródłowy nie istnieje");
      if (input.birdCount + input.transportMortality > src.currentCount)
        throw new Error(`Za mało ptaków: dostępne ${src.currentCount}, żądane ${input.birdCount + input.transportMortality}`);
      const [tgtHouse] = await db.select().from(s.houses).where(eq(s.houses.id, input.targetHouseId));
      if (!tgtHouse) throw new Error("Kurnik docelowy nie istnieje");
      // walidacja obsady — ostatnie ważenie źródła
      const lastW = await db.select().from(s.weighings)
        .where(eq(s.weighings.batchId, input.sourceBatchId))
        .orderBy(desc(s.weighings.dayAge)).limit(1);
      const avgG = lastW[0]?.avgWeightG ?? 45;
      const densityAfter = (input.birdCount * avgG / 1000) / Number(tgtHouse.areaM2);
      if (densityAfter > Number(tgtHouse.maxDensityKgM2))
        throw new Error(`Przekroczenie obsady: ${densityAfter.toFixed(1)} kg/m² > max ${tgtHouse.maxDensityKgM2} kg/m²`);

      // Calculation Engine: atomowa zmiana liczby ptaków
      await db.transaction(async (tx) => {
        await tx.update(s.batches)
          .set({ currentCount: src.currentCount - input.birdCount - input.transportMortality, updatedBy: "transfer" })
          .where(eq(s.batches.id, src.id));
        const [existing] = await tx.select().from(s.batches)
          .where(and(eq(s.batches.houseId, input.targetHouseId), eq(s.batches.status, "active")));
        let targetId: number;
        if (existing) {
          await tx.update(s.batches)
            .set({ currentCount: existing.currentCount + input.birdCount, updatedBy: "transfer" })
            .where(eq(s.batches.id, existing.id));
          targetId = existing.id;
        } else {
          const [{ id }] = await tx.insert(s.batches).values({
            houseId: input.targetHouseId, code: `${src.code}/T`, geneticLine: src.geneticLine,
            geneticLineId: src.geneticLineId, sex: src.sex, chickSupplier: src.chickSupplier,
            chickPrice: src.chickPrice, startDate: src.startDate, plannedEndDate: src.plannedEndDate,
            initialCount: input.birdCount, currentCount: input.birdCount,
          }).$returningId();
          targetId = id;
        }
        const docNo = `TR/${new Date().getFullYear()}/${String(Date.now() % 100000).padStart(5, "0")}`;
        await tx.insert(s.transfers).values({
          sourceBatchId: src.id, targetBatchId: targetId, birdCount: input.birdCount,
          avgWeightG: avgG, transportMortality: input.transportMortality,
          transferDate: new Date(), durationMin: input.durationMin,
          driver: input.driver, vehicle: input.vehicle,
          signatureFrom: input.signatureFrom, signatureTo: input.signatureTo, documentNo: docNo,
        });
      });
      await audit("batches", src.id, "update", { oldValues: { currentCount: src.currentCount }, newValues: { currentCount: src.currentCount - input.birdCount }, author: "TransferManager" });
      return { ok: true };
    }),

  /* ------- magazyn / silosy ------- */
  warehouseOverview: publicQuery.query(async ({ ctx }) => {
    const db = getDb();
    const fids = await scopedFarmIds(ctx);
    if (fids.length === 0) return { silos: [], warehouses: [] };
    const [silos, wh, farmRows, recipes] = await Promise.all([
      db.select().from(s.silos).where(and(ne(s.silos.status, "archived"), inArray(s.silos.farmId, fids))),
      db.select().from(s.warehouses).where(and(ne(s.warehouses.status, "archived"), inArray(s.warehouses.farmId, fids))),
      db.select().from(s.farms).where(inArray(s.farms.id, fids)),
      db.select().from(s.recipes),
    ]);
    const farmOf = (id: number) => farmRows.find((f) => f.id === id);
    return {
      silos: silos.map((x) => ({ ...x, farm: farmOf(x.farmId), recipe: recipes.find((r) => r.id === x.recipeId) ?? null })),
      warehouses: wh.map((x) => ({ ...x, farm: farmOf(x.farmId) })),
    };
  }),

  /* ------- audit log ------- */
  auditLog: publicQuery
    .input(z.object({ limit: z.number().int().min(1).max(200).default(50) }).optional())
    .query(async ({ input }) => {
      return getDb().select().from(s.auditLog).orderBy(desc(s.auditLog.id)).limit(input?.limit ?? 50);
    }),

  /* ------- company profile ------- */
  getById: publicQuery
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      const [company] = await getDb().select().from(s.companies).where(eq(s.companies.id, input.companyId));
      return company || null;
    }),

  updateTier: publicQuery
    .input(z.object({ companyId: z.number(), tier: z.enum(["standard", "advanced", "professional", "enterprise"]) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.companies).where(eq(s.companies.id, input.companyId));
      await db.update(s.companies)
        .set({ tier: input.tier, updatedBy: "panel" })
        .where(eq(s.companies.id, input.companyId));
      await audit("companies", input.companyId, "update", { oldValues: { tier: old.tier }, newValues: { tier: input.tier } });
      return { ok: true };
    }),

});
