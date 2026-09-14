/**
 * WORKSPACE — wybór gospodarstwa bez logowania.
 * Ekran startowy: Indykpol DEMO + tworzenie własnej firmy.
 * Wszystkie dane trwale w bazie (MySQL), izolowane per companyId/farmId.
 */
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { audit } from "./audit";
import { ensureIndykpolDemo } from "../db/seed-indykpol";
import { seedStarterPack } from "../db/seed-starter-pack";

export const workspaceRouter = createRouter({
  /** Lista firm — tworzy Indykpol demo przy pierwszym wejściu. */
  companies: publicQuery.query(async () => {
    await ensureIndykpolDemo();
    const db = getDb();
    const comps = await db.select().from(s.companies).where(ne(s.companies.status, "archived"));
    const farmRows = await db.select().from(s.farms).where(ne(s.farms.status, "archived"));
    const houseRows = await db.select({ farmId: s.houses.farmId, cnt: sql<number>`COUNT(*)` })
      .from(s.houses).where(ne(s.houses.status, "archived")).groupBy(s.houses.farmId);
    const housesByFarm = new Map(houseRows.map((h) => [h.farmId, Number(h.cnt)]));
    return comps
      .map((c) => ({
        ...c,
        farms: farmRows.filter((f) => f.companyId === c.id)
          .map((f) => ({ ...f, housesCount: housesByFarm.get(f.id) ?? 0 })),
      }))
      .sort((a, b) => Number(a.isDemo) - Number(b.isDemo) || a.id - b.id);
  }),

  /** Własna firma — czyste środowisko albo ze starter packiem. */
  createCompany: publicQuery
    .input(z.object({
      name: z.string().min(2),
      address: z.string().max(255).optional(),
      nip: z.string().max(16).optional(),
      contact: z.string().max(255).optional(),
      declaredHouses: z.number().int().min(0).max(500).default(0),
      useDemoTemplate: z.boolean().default(false),
      withStarterData: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [{ id: companyId }] = await db.insert(s.companies).values({
        name: input.name, countryCode: "PL", baseCurrency: "PLN", isDemo: false,
        address: input.address ?? null, nip: input.nip ?? null, contact: input.contact ?? null,
        declaredHouses: input.declaredHouses,
      }).$returningId();

      const [{ id: farmId }] = await db.insert(s.farms).values({
        companyId, name: "Gospodarstwo 1", countryCode: "PL", city: "",
        lat: "52.00000", lng: "19.00000", capacity: 0, isDemo: false,
      }).$returningId();

      // Kurniki
      const count = input.useDemoTemplate ? 2 : Math.max(input.declaredHouses, 1);
      for (let h = 1; h <= count; h++) {
        await db.insert(s.houses).values({
          farmId, name: `Kurnik ${h}`, houseType: h % 2 === 1 ? "brooder" : "finisher",
          areaM2: "1500.0", maxDensityKgM2: "42.0",
        });
      }

      // Silosy + magazyn
      const houseRows = await db.select().from(s.houses).where(eq(s.houses.farmId, farmId));
      for (const h of houseRows) {
        await db.insert(s.silos).values({ farmId, name: `Silos A — ${h.name}`, capacityTons: "25.0", currentTons: "0" });
        await db.insert(s.silos).values({ farmId, name: `Silos B — ${h.name}`, capacityTons: "25.0", currentTons: "0" });
      }
      await db.insert(s.warehouses).values({ farmId, name: "Magazyn główny", capacityTons: "100.0" });

      // Starter pack — pełne dane hodowlane + przykładowy rzut
      if (input.withStarterData) {
        await seedStarterPack(companyId, farmId);
      }

      await audit("companies", companyId, "create", { newValues: { ...input, farmId } });
      return { companyId, farmId };
    }),

  /** Walidacja wyboru — sprawdza spójność companyId/farmId przed ustawieniem kontekstu. */
  validateSelection: publicQuery
    .input(z.object({ companyId: z.number(), farmId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [farm] = await db.select().from(s.farms)
        .where(and(eq(s.farms.id, input.farmId), eq(s.farms.companyId, input.companyId), ne(s.farms.status, "archived")))
        .limit(1);
      if (!farm) return { ok: false as const };
      const [company] = await db.select().from(s.companies).where(eq(s.companies.id, input.companyId)).limit(1);
      return { ok: true as const, farm, company };
    }),
});
