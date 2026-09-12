import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq } from "drizzle-orm";

export async function ensureDemoData(companyId: bigint, farmId: bigint) {
  const db = getDb();
  
  // Sprawdź czy już jest demo batch
  const [existing] = await db.select().from(s.batches)
    .where(eq(s.batches.code, "DEMO-BATCH-001"))
    .limit(1);
  
  if (existing) return existing;
  
  // Stwórz demo batch
  const today = new Date().toISOString().split('T')[0];
  const [{ id }] = await db.insert(s.batches).values({
    code: "DEMO-BATCH-001",
    companyId,
    farmId,
    houseId: BigInt(1),
    geneticLine: "Ross 308",
    sex: "mixed",
    chickSupplier: "Hatchery Demo",
    chickPrice: "2.5",
    startDate: today,
    plannedEndDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    initialCount: 5000,
    currentCount: 5000,
    soldCount: 0,
    status: "active",
    updatedBy: "demo-system",
  }).$returningId();
  
  return { id, code: "DEMO-BATCH-001" };
}

