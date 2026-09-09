/**
 * TENANT — izolacja danych per firma / gospodarstwo.
 * Kontekst pochodzi z nagłówków x-company-id / x-farm-id ustawianych
 * po wyborze gospodarstwa na ekranie startowym (bez logowania).
 * Dane biznesowe są zawsze filtrowane po stronie bazy (nie po stronie Reacta).
 */
import { and, eq, inArray, ne } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as schema from "@db/schema";
import type { TrpcContext } from "./context";
import { getDb } from "./queries/connection";

/** Wymaga wybranego gospodarstwa — zwraca farmId z kontekstu. */
export function requireFarmId(ctx: TrpcContext): number {
  if (!ctx.farmId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Wybierz gospodarstwo na ekranie startowym." });
  }
  return ctx.farmId;
}

/** ID wszystkich ferm aktywnej firmy. */
export async function scopedFarmIds(ctx: TrpcContext): Promise<number[]> {
  const cid = requireCompanyId(ctx);
  if (ctx.farmId) return [ctx.farmId]; // wybrane konkretne gospodarstwo
  const rows = await getDb().select({ id: schema.farms.id }).from(schema.farms)
    .where(and(eq(schema.farms.companyId, cid), ne(schema.farms.status, "archived")));
  return rows.map((r) => r.id); // tryb „cała firma" (np. DEMO)
}

/** Wymaga wybranej firmy — zwraca companyId z kontekstu. */
export function requireCompanyId(ctx: TrpcContext): number {
  if (!ctx.companyId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Wybierz firmę na ekranie startowym." });
  }
  return ctx.companyId;
}

/** Sprawdza, czy gospodarstwo należy do aktywnej firmy; zwraca rekord farmy. */
export async function assertFarmAccess(ctx: TrpcContext, farmId?: number) {
  const fid = farmId ?? requireFarmId(ctx);
  const cid = requireCompanyId(ctx);
  const [farm] = await getDb().select().from(schema.farms)
    .where(and(eq(schema.farms.id, fid), eq(schema.farms.companyId, cid))).limit(1);
  if (!farm) throw new TRPCError({ code: "FORBIDDEN", message: "Gospodarstwo nie należy do wybranej firmy." });
  return farm;
}

/** ID kurników aktywnego gospodarstwa (lub całej firmy w trybie DEMO). */
export async function scopedHouseIds(ctx: TrpcContext): Promise<number[]> {
  const farmIds = await scopedFarmIds(ctx);
  if (farmIds.length === 0) return [];
  const rows = await getDb().select({ id: schema.houses.id }).from(schema.houses)
    .where(and(inArray(schema.houses.farmId, farmIds), ne(schema.houses.status, "archived")));
  return rows.map((r) => r.id);
}

/** ID stad (batches) aktywnego gospodarstwa. */
export async function scopedBatchIds(ctx: TrpcContext): Promise<number[]> {
  const houseIds = await scopedHouseIds(ctx);
  if (houseIds.length === 0) return [];
  const rows = await getDb().select({ id: schema.batches.id }).from(schema.batches)
    .where(and(inArray(schema.batches.houseId, houseIds), ne(schema.batches.status, "archived")));
  return rows.map((r) => r.id);
}

/** Sprawdza, czy stado należy do aktywnego gospodarstwa; zwraca rekord stada. */
export async function assertBatchAccess(ctx: TrpcContext, batchId: number) {
  const houseIds = await scopedHouseIds(ctx);
  if (houseIds.length === 0) throw new TRPCError({ code: "FORBIDDEN", message: "Brak kurników w wybranym gospodarstwie." });
  const [batch] = await getDb().select().from(schema.batches)
    .where(and(eq(schema.batches.id, batchId), inArray(schema.batches.houseId, houseIds))).limit(1);
  if (!batch) throw new TRPCError({ code: "FORBIDDEN", message: "Stado nie należy do wybranego gospodarstwa." });
  return batch;
}

/** Sprawdza przynależność kurnika do aktywnego gospodarstwa. */
export async function assertHouseAccess(ctx: TrpcContext, houseId: number) {
  const fid = requireFarmId(ctx);
  const [house] = await getDb().select().from(schema.houses)
    .where(and(eq(schema.houses.id, houseId), eq(schema.houses.farmId, fid))).limit(1);
  if (!house) throw new TRPCError({ code: "FORBIDDEN", message: "Kurnik nie należy do wybranego gospodarstwa." });
  return house;
}
