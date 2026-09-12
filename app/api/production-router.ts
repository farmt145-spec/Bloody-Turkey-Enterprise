import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, and, desc } from "drizzle-orm";

export const productionRouter = createRouter({
  // Firmy
  myCompanies: publicQuery.query(async ({ ctx }) => {
    if (!ctx.userId) throw new Error("Nie zalogowany");
    const db = getDb();
    // TODO: pobierz firmy użytkownika (tabela users_companies)
    return [];
  }),

  createCompany: publicQuery
    .input(z.object({ name: z.string(), countryCode: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.userId) throw new Error("Nie zalogowany");
      const db = getDb();
      const [{ id }] = await db.insert(s.companies).values({
        name: input.name,
        countryCode: input.countryCode || "PL",
      }).$returningId();
      return { id, name: input.name };
    }),

  // Farmy
  myFarms: publicQuery.query(async ({ ctx }) => {
    if (!ctx.companyId) throw new Error("Brak firmy");
    const db = getDb();
    return db.select().from(s.farms)
      .where(eq(s.farms.companyId, BigInt(ctx.companyId)))
      .orderBy(desc(s.farms.createdAt));
  }),

  createFarm: publicQuery
    .input(z.object({ name: z.string(), countryCode: z.string().optional(), city: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.companyId) throw new Error("Brak firmy");
      const db = getDb();
      const [{ id }] = await db.insert(s.farms).values({
        companyId: BigInt(ctx.companyId),
        name: input.name,
        countryCode: input.countryCode || "PL",
        city: input.city || "Unknown",
        latitude: 0,
        longitude: 0,
      }).$returningId();
      return { id, name: input.name };
    }),

  // Gospodarstwa (houses)
  housesInFarm: publicQuery
    .input(z.object({ farmId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.companyId) throw new Error("Brak firmy");
      const db = getDb();
      return db.select().from(s.houses)
        .where(eq(s.houses.farmId, BigInt(input.farmId)))
        .orderBy(desc(s.houses.createdAt || new Date()));
    }),

  createHouse: publicQuery
    .input(z.object({ farmId: z.number(), name: z.string(), houseType: z.enum(["brooder", "finisher"]) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.companyId) throw new Error("Brak firmy");
      const db = getDb();
      const [{ id }] = await db.insert(s.houses).values({
        farmId: BigInt(input.farmId),
        name: input.name,
        houseType: input.houseType,
        areaM2: 1000,
        maxDensityKgM2: 42,
      }).$returningId();
      return { id, name: input.name };
    }),

  // Partie (batches)
  batchesInFarm: publicQuery
    .input(z.object({ farmId: z.number() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.companyId) throw new Error("Brak firmy");
      const db = getDb();
      return db.select().from(s.batches)
        .where(eq(s.batches.farmId || 0, BigInt(input.farmId)))
        .orderBy(desc(s.batches.createdAt));
    }),

  createBatch: publicQuery
    .input(z.object({
      houseId: z.number(),
      code: z.string(),
      geneticLine: z.string(),
      startDate: z.string(),
      initialCount: z.number(),
      chicksPrice: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.companyId) throw new Error("Brak firmy");
      const db = getDb();
      const [{ id }] = await db.insert(s.batches).values({
        houseId: BigInt(input.houseId),
        code: input.code,
        geneticLine: input.geneticLine,
        sex: "mixed",
        chicksPrice: (input.chicksPrice || 2.5).toString(),
        startDate: input.startDate,
        plannedEndDate: new Date(new Date(input.startDate).getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        initialCount: input.initialCount,
        currentCount: input.initialCount,
        soldCount: 0,
        status: "active",
        updatedBy: "api",
      }).$returningId();
      return { id, code: input.code };
    }),

  // Dashboard
  dashboard: publicQuery.query(async ({ ctx }) => {
    if (!ctx.companyId || !ctx.farmId) throw new Error("Brak danych");
    const db = getDb();
    const farms = await db.select().from(s.farms).where(eq(s.farms.companyId, BigInt(ctx.companyId)));
    const batches = await db.select().from(s.batches).where(eq(s.batches.farmId || 0, BigInt(ctx.farmId)));
    const houses = await db.select().from(s.houses).where(eq(s.houses.farmId, BigInt(ctx.farmId)));
    
    return {
      companyId: ctx.companyId,
      farmId: ctx.farmId,
      totalFarms: farms.length,
      totalHouses: houses.length,
      totalBatches: batches.length,
      activeBatches: batches.filter(b => b.status === "active").length,
    };
  }),
});
