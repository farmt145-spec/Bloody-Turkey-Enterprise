import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "./auth-utils";

/* Template firma — struktura do klonowania dla nowych klientów */
const TEMPLATE_COMPANY_ID = 2; // Sulimy

export const authRouter = createRouter({
  signup: publicQuery
    .input(
      z.object({
        companyName: z.string().min(3),
        email: z.string().email(),
        password: z.string().min(8),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      // 1. Sprawdź czy email już istnieje
      const [existing] = await db
        .select()
        .from(s.users)
        .where(eq(s.users.email, input.email))
        .limit(1);
      if (existing) throw new Error("Email już zarejestrowany");

      // 2. Utwórz nową firmę dla klienta (nie-demo)
      const [newCompanyId] = await db
        .insert(s.companies)
        .values({
          name: input.companyName,
          countryCode: "PL",
          baseCurrency: "PLN",
          isDemo: false,
        })
        .$returningId();

      if (!newCompanyId.id) throw new Error("Błąd tworzenia firmy");
      const companyId = newCompanyId.id;

      // 3. Klonuj strukturę z template firmy (Sulimy) do nowej firmy
      // Kopiuj farmy, kurniki, sektory (bez danych produkcyjnych)
      await cloneCompanyStructure(
        db,
        TEMPLATE_COMPANY_ID,
        Number(companyId)
      );

      // 4. Utwórz użytkownika
      const passwordHash = await hashPassword(input.password);

      const [newUserId] = await db
        .insert(s.users)
        .values({
          companyId: BigInt(companyId),
          email: input.email,
          name: input.email.split("@")[0],
          userRole: "admin",
          role: "admin",
          password: passwordHash,
          unionId: `user_${Date.now()}_${Math.random()}`,
        })
        .$returningId();

      if (!newUserId.id) throw new Error("Błąd tworzenia użytkownika");
      const userId = newUserId.id;

      // 5. Generuj token
      const token = generateToken(Number(userId), Number(companyId));

      return {
        companyId: Number(companyId),
        userId: Number(userId),
        email: input.email,
        token,
        message: "✓ Konto założone — masz dostęp do demo i swoich danych",
      };
    }),

  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db
        .select()
        .from(s.users)
        .where(eq(s.users.email, input.email))
        .limit(1);
      if (!user) throw new Error("Użytkownik nie znaleziony");

      const passwordValid = await verifyPassword(
        input.password,
        user.password || ""
      );
      if (!passwordValid) throw new Error("Hasło niepoprawne");

      const token = generateToken(Number(user.id), Number(user.companyId));
      const [farm] = await db
        .select()
        .from(s.farms)
        .where(eq(s.farms.companyId, user.companyId))
        .limit(1);

      return {
        userId: user.id,
        companyId: user.companyId,
        farmId: farm?.id || null,
        email: user.email,
        name: user.name,
        userRole: user.userRole,
        token,
      };
    }),

  checkEmail: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db
        .select()
        .from(s.users)
        .where(eq(s.users.email, input.email))
        .limit(1);
      return { exists: !!user };
    }),
});

/**
 * Klonuj strukturę firmy — farmy, kurniki, sektory
 * Nie kopiujemy: partie, daily_logs, costs, sales (to produkcja)
 */
async function cloneCompanyStructure(
  db: any,
  sourceCompanyId: number,
  targetCompanyId: number
) {
  try {
    // Mapuj stare ID na nowe ID (sourceFarmId → targetFarmId)
    const farmMap = new Map<number, number>();

    // Klonuj farmy
    const sourceFarms = await db
      .select()
      .from(s.farms)
      .where(eq(s.farms.companyId, BigInt(sourceCompanyId)));

    for (const farm of sourceFarms) {
      const [newFarmId] = await db
        .insert(s.farms)
        .values({
          companyId: BigInt(targetCompanyId),
          name: farm.name,
          countryCode: farm.countryCode,
          city: farm.city,
          lat: farm.lat,
          lng: farm.lng,
          capacity: farm.capacity,
          isDemo: false, // Nowa farma użytkownika — nie demo
        })
        .$returningId();

      farmMap.set(Number(farm.id), Number(newFarmId.id));
    }

    // Klonuj kurniki i sektory
    for (const [oldFarmId, newFarmId] of farmMap) {
      // Kurniki
      const sourceHouses = await db
        .select()
        .from(s.houses)
        .where(eq(s.houses.farmId, BigInt(oldFarmId)));

      const houseMap = new Map<number, number>();

      for (const house of sourceHouses) {
        const [newHouseId] = await db
          .insert(s.houses)
          .values({
            farmId: BigInt(newFarmId),
            name: house.name,
            houseType: house.houseType,
            areaM2: house.areaM2,
            maxDensityKgM2: house.maxDensityKgM2,
          })
          .$returningId();

        houseMap.set(Number(house.id), Number(newHouseId.id));
      }

      // Sektory
      for (const [oldHouseId, newHouseId] of houseMap) {
        const sourceSectors = await db
          .select()
          .from(s.sectors)
          .where(eq(s.sectors.houseId, BigInt(oldHouseId)));

        for (const sector of sourceSectors) {
          await db.insert(s.sectors).values({
            houseId: BigInt(newHouseId),
            name: sector.name,
            areaM2: sector.areaM2,
          });
        }
      }

      // Magazyny
      const sourceWarehouses = await db
        .select()
        .from(s.warehouses)
        .where(eq(s.warehouses.farmId, BigInt(oldFarmId)));

      for (const wh of sourceWarehouses) {
        await db.insert(s.warehouses).values({
          farmId: BigInt(newFarmId),
          name: wh.name,
          capacityTons: wh.capacityTons,
        });
      }

      // Silosy
      const sourceSilos = await db
        .select()
        .from(s.silos)
        .where(eq(s.silos.farmId, BigInt(oldFarmId)));

      for (const silo of sourceSilos) {
        await db.insert(s.silos).values({
          farmId: BigInt(newFarmId),
          name: silo.name,
          capacityTons: silo.capacityTons,
          currentTons: silo.currentTons,
          recipeId: silo.recipeId,
        });
      }
    }

    console.log(
      `✅ Struktura firmy ${sourceCompanyId} skopiowana do ${targetCompanyId}`
    );
  } catch (err) {
    console.error("❌ Błąd klonowania struktury:", err);
    throw new Error(
      `Błąd klonowania struktury: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

