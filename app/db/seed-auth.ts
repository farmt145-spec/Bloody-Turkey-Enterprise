import { getDb } from "../api/queries/connection";
import * as s from "./schema";
import { hashPassword } from "../api/auth-utils";
import { eq } from "drizzle-orm";

export async function seedAuth() {
  const db = getDb();
  
  // Sprawdź czy indykpol już istnieje
  const [existing] = await db.select().from(s.companies)
    .where(eq(s.companies.name, "indykpol"))
    .limit(1);
  
  if (existing) {
    console.log("✓ Demo konto indykpol już istnieje");
    return;
  }
  
  console.log("Tworzę demo firmy...");
  
  // 1. INDYKPOL — DEMO FIRMA (isDemo: true)
  const [{ companyId: indykpolId }] = await db.insert(s.companies).values({
    name: "indykpol",
    tier: "professional",
    status: "active",
    countryCode: "PL",
    baseCurrency: "PLN",
    isDemo: true,
  }).$returningId();
  
  // 2. BOREK — TWOJA FIRMA (isDemo: false)
  const [{ companyId: borekId }] = await db.insert(s.companies).values({
    name: "borek",
    tier: "professional",
    status: "active",
    countryCode: "PL",
    baseCurrency: "PLN",
    isDemo: false,
  }).$returningId();
  
  // --- INDYKPOL FARMA ---
  const [{ farmId: indykpolFarmId }] = await db.insert(s.farms).values({
    companyId: BigInt(indykpolId),
    name: "Hodowla Kraków",
    countryCode: "PL",
    city: "Kraków",
    capacity: 50000,
    status: "active",
    isDemo: true,
  }).$returningId();
  
  // Kurnik broiler (indykpol)
  const [{ houseId: indykpolHouse1 }] = await db.insert(s.houses).values({
    farmId: BigInt(indykpolFarmId),
    name: "Kurnik Broiler #1",
    houseType: "broiler",
    areaM2: 1000,
    maxDensityKgM2: 40,
    status: "active",
  }).$returningId();
  
  // Sektor w kurnika (indykpol)
  await db.insert(s.sectors).values({
    houseId: BigInt(indykpolHouse1),
    name: "Sektor A",
    areaM2: 500,
  });
  
  // Magazyn (indykpol)
  await db.insert(s.warehouses).values({
    farmId: BigInt(indykpolFarmId),
    name: "Magazyn Pasz",
    capacityTons: 100,
  });
  
  // Silo (indykpol)
  await db.insert(s.silos).values({
    farmId: BigInt(indykpolFarmId),
    name: "Silo #1",
    capacityTons: 50,
    currentTons: 30,
  });
  
  // Demo user (indykpol)
  const passwordHashIndykpol = await hashPassword("demo123456");
  const [{ userId: indykpolUserId }] = await db.insert(s.users).values({
    companyId: BigInt(indykpolId),
    email: "demo@indykpol.pl",
    name: "Demo User",
    password: passwordHashIndykpol,
    userRole: "viewer",
    role: "viewer",
    unionId: "demo_indykpol_001",
  }).$returningId();
  
  // --- BOREK FARMA ---
  const [{ farmId: borekFarmId }] = await db.insert(s.farms).values({
    companyId: BigInt(borekId),
    name: "Farma Borek",
    countryCode: "PL",
    city: "Gdańsk",
    capacity: 30000,
    status: "active",
    isDemo: false,
  }).$returningId();
  
  // Kurnik finisher (borek)
  const [{ houseId: borekHouse1 }] = await db.insert(s.houses).values({
    farmId: BigInt(borekFarmId),
    name: "Kurnik Finisher #1",
    houseType: "finisher",
    areaM2: 800,
    maxDensityKgM2: 35,
    status: "active",
  }).$returningId();
  
  // Sektor w kurnika (borek)
  await db.insert(s.sectors).values({
    houseId: BigInt(borekHouse1),
    name: "Sektor B",
    areaM2: 400,
  });
  
  // Magazyn (borek)
  await db.insert(s.warehouses).values({
    farmId: BigInt(borekFarmId),
    name: "Magazyn Główny",
    capacityTons: 80,
  });
  
  // Silo (borek)
  await db.insert(s.silos).values({
    farmId: BigInt(borekFarmId),
    name: "Silo Główny",
    capacityTons: 40,
    currentTons: 25,
  });
  
  // Admin user (borek) — TY
  const passwordHashBorek = await hashPassword("borek123456");
  const [{ userId: borekUserId }] = await db.insert(s.users).values({
    companyId: BigInt(borekId),
    email: "admin@borek.pl",
    name: "Borek Admin",
    password: passwordHashBorek,
    userRole: "admin",
    role: "admin",
    unionId: "borek_admin_001",
  }).$returningId();
  
  console.log(`✓ Demo firmy utworzone:`);
  console.log(`\n📍 INDYKPOL (DEMO):`);
  console.log(`  Email: demo@indykpol.pl`);
  console.log(`  Hasło: demo123456`);
  console.log(`  Rola: viewer`);
  console.log(`  Farma: Hodowla Kraków`);
  
  console.log(`\n📍 BOREK (TWOJA FIRMA):`);
  console.log(`  Email: admin@borek.pl`);
  console.log(`  Hasło: borek123456`);
  console.log(`  Rola: admin`);
  console.log(`  Farma: Farma Borek`);
}

