import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "./auth-utils";

export const authRouter = createRouter({
  /* ------- rejestracja firmy + użytkownika ------- */
  signup: publicQuery
    .input(z.object({ 
      companyName: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(8),
      farmName: z.string().min(2),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Sprawdź czy email już istnieje
      const [existing] = await db.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);
      if (existing) throw new Error("Email już zarejestrowany");
      
      // 1. Stwórz firmę
      const [{ companyId }] = await db.insert(s.companies).values({
        name: input.companyName,
        countryCode: "PL",
        baseCurrency: "EUR",
        isDemo: false,
        declaredHouses: 1,
        status: "active",
      }).$returningId();
      
      // 2. Stwórz farmę
      const [{ farmId }] = await db.insert(s.farms).values({
        companyId: BigInt(companyId),
        name: input.farmName,
        status: "active",
      }).$returningId();
      
      // 3. Hash hasła
      const passwordHash = await hashPassword(input.password);
      
      // 4. Stwórz użytkownika (admin)
      const [{ userId }] = await db.insert(s.users).values({
        companyId: BigInt(companyId),
        email: input.email,
        name: input.email.split("@")[0],
        userRole: "admin",
        role: "admin",
        password: passwordHash,
      }).$returningId();
      
      // 5. Wygeneruj token
      const token = generateToken(userId, companyId);
      
      return { 
        companyId, 
        farmId, 
        userId, 
        email: input.email,
        token,
        message: "Konto założone! Zalogowany." 
      };
    }),

  /* ------- logowanie ------- */
  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      
      const [user] = await db.select().from(s.users)
        .where(eq(s.users.email, input.email))
        .limit(1);
      
      if (!user) throw new Error("Użytkownik nie znaleziony");
      
      // Sprawdź hasło
      const passwordValid = await verifyPassword(input.password, user.password || "");
      if (!passwordValid) throw new Error("Hasło niepoprawne");
      
      // Wygeneruj token
      const token = generateToken(Number(user.id), Number(user.companyId));
      
      // Znajdź farmę dla tej firmy
      const [farm] = await db.select().from(s.farms)
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

  /* ------- sprawdź czy email istnieje ------- */
  checkEmail: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users)
        .where(eq(s.users.email, input.email))
        .limit(1);
      return { exists: !!user };
    }),
});


