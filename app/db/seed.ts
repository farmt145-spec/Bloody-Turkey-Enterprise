import { getDb } from "../api/queries/connection";
import * as s from "./schema";

async function seedDemo() {
  const db = getDb();

  // Demo Company 1
  const [demo1] = await db
    .insert(s.companies)
    .values({
      name: "Demo Farm 1 — Hodowla Kowalski",
      countryCode: "PL",
      baseCurrency: "PLN",
      isDemo: true,
      nip: "1234567890",
      address: "ul. Rolnicza 1, 30-000 Kraków",
      contact: "Kraków, Małopolskie",
    })
    .$returningId();

  // Demo Company 2
  const [demo2] = await db
    .insert(s.companies)
    .values({
      name: "Demo Farm 2 — Chów Nowak",
      countryCode: "PL",
      baseCurrency: "PLN",
      isDemo: true,
      nip: "0987654321",
      address: "ul. Wiejska 5, 80-000 Gdańsk",
      contact: "Gdańsk, Pomorskie",
    })
    .$returningId();

  console.log("✅ Demo companies created:", { demo1, demo2 });

  // Demo Farm 1 — Kraków
  const [farm1] = await db
    .insert(s.farms)
    .values({
      companyId: BigInt(demo1.id),
      name: "Farma Główna — Kraków",
      countryCode: "PL",
      city: "Kraków",
      lat: "50.049683" as any,
      lng: "19.944544" as any,
      capacity: 50000,
      isDemo: true,
    })
    .$returningId();

  // Demo Farm 2 — Gdańsk
  const [farm2] = await db
    .insert(s.farms)
    .values({
      companyId: BigInt(demo2.id),
      name: "Farma Rozrodu — Gdańsk",
      countryCode: "PL",
      city: "Gdańsk",
      lat: "54.352025" as any,
      lng: "18.646638" as any,
      capacity: 80000,
      isDemo: true,
    })
    .$returningId();

  console.log("✅ Demo farms created:", { farm1, farm2 });

  // Demo House 1
  const [house1] = await db
    .insert(s.houses)
    .values({
      farmId: BigInt(farm1.id),
      name: "Kurnik A — Brojlery",
      houseType: "finisher",
      areaM2: "2000.0" as any,
      maxDensityKgM2: "42.0" as any,
    })
    .$returningId();

  // Demo House 2
  const [house2] = await db
    .insert(s.houses)
    .values({
      farmId: BigInt(farm2.id),
      name: "Kurnik B — Rozpłód",
      houseType: "brooder",
      areaM2: "1500.0" as any,
      maxDensityKgM2: "30.0" as any,
    })
    .$returningId();

  console.log("✅ Demo houses created:", { house1, house2 });

  // Demo Batch 1 — Kraków
  const [batch1] = await db
    .insert(s.batches)
    .values({
      houseId: BigInt(house1.id),
      code: "DEMO-KRK-001",
      geneticLine: "Cobb 500",
      sex: "mixed",
      chickPrice: "2.50" as any,
      startDate: "2026-08-15",
      plannedEndDate: "2026-09-25",
      initialCount: 10000,
      currentCount: 9950,
      soldCount: 0,
      status: "active",
    })
    .$returningId();

  // Demo Batch 2 — Gdańsk
  const [batch2] = await db
    .insert(s.batches)
    .values({
      houseId: BigInt(house2.id),
      code: "DEMO-GDN-002",
      geneticLine: "Ross 308",
      sex: "mixed",
      chickPrice: "3.00" as any,
      startDate: "2026-08-10",
      plannedEndDate: "2026-09-20",
      initialCount: 8000,
      currentCount: 7920,
      soldCount: 0,
      status: "active",
    })
    .$returningId();

  console.log("✅ Demo batches created:", { batch1, batch2 });

  // Demo Daily Logs
  await db.insert(s.dailyLogs).values([
    {
      batchId: BigInt(batch1.id),
      day: "2026-09-12",
      mortality: 15,
      culls: 5,
      waterLiters: "50000.0" as any,
      feedKg: "8000.0" as any,
      tempC: "28.5" as any,
      humidityPct: "65.0" as any,
      ammoniaPpm: "5.2" as any,
      note: "Demo entry — wszystko w normie",
    },
    {
      batchId: BigInt(batch2.id),
      day: "2026-09-12",
      mortality: 8,
      culls: 2,
      waterLiters: "35000.0" as any,
      feedKg: "5500.0" as any,
      tempC: "27.0" as any,
      humidityPct: "60.0" as any,
      ammoniaPpm: "4.1" as any,
      note: "Demo entry — rozpłód normalne",
    },
  ]);

  console.log("✅ Demo daily logs created");
  console.log("\n🎉 SEED COMPLETE — 2 demo companies + farms + batches ready!");
}

seedDemo().catch(console.error);

