import { getDb } from "../api/queries/connection";
import * as s from "./schema";
import { hashPassword } from "../api/auth-utils";
import { eq } from "drizzle-orm";

export async function seedAuth() {
  const db = getDb();
  
  // Sprawdź czy demo konto już istnieje
  const [existing] = await db.select().from(s.companies)
    .where(eq(s.companies.name, "Demo Farm Inc"))
    .limit(1);
  
  if (existing) {
    console.log("✓ Demo konto już istnieje");
    return;
  }
  
  console.log("Tworzę demo konto...");
  
  // 1. Demo firma
  const [{ companyId }] = await db.insert(s.companies).values({
    name: "Demo Farm Inc",
    tier: "professional",
    status: "active",
  }).$returningId();
  
  // 2. Demo farma
  const [{ farmId }] = await db.insert(s.farms).values({
    companyId: BigInt(companyId),
    name: "Demo Farm - Drób",
    status: "active",
  }).$returningId();
  
  // 3. Demo dom
  const [{ houseId }] = await db.insert(s.houses).values({
    farmId: BigInt(farmId),
    name: "Kurnik #1",
    areaM2: 1000,
    status: "active",
  }).$returningId();
  
  // 4. Demo użytkownik
  const passwordHash = await hashPassword("demo123456");
  const [{ userId }] = await db.insert(s.users).values({
    companyId: BigInt(companyId),
    email: "admin@demo.pl",
    name: "Demo Admin",
    password: passwordHash,
    userRole: "admin",
    role: "admin",
  }).$returningId();
  
  console.log(`✓ Demo konto utworzone:`);
  console.log(`  Email: admin@demo.pl`);
  console.log(`  Hasło: demo123456`);
  console.log(`  Firma: Demo Farm Inc`);
  console.log(`  Farma: Demo Farm - Drób`);
}

