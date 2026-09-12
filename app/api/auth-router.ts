import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "./auth-utils";

export const authRouter = createRouter({
  signup: publicQuery
    .input(z.object({ 
      companyName: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(8),
      farmName: z.string().min(2),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      
      const [existing] = await db.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);
      if (existing) throw new Error("Email już zarejestrowany");
      
      // 1. Insert company
      await db.insert(s.companies).values({
        name: input.companyName,
        countryCode: "PL",
      });
      const [company] = await db.select().from(s.companies)
        .where(eq(s.companies.name, input.companyName))
        .limit(1);
      if (!company) throw new Error("Nie udało się utworzyć firmy");
      const companyId = company.id;
      
      // 2. Insert farm with default coords (Poland center)
      await db.insert(s.farms).values({
        companyId: company.id,
        name: input.farmName,
        countryCode: "PL",
        city: "Warszawa",
        lat: "52.2297",
        lng: "21.0122",
      });
      const [farm] = await db.select().from(s.farms)
        .where(eq(s.farms.companyId, company.id))
        .limit(1);
      if (!farm) throw new Error("Nie udało się utworzyć farmy");
      const farmId = farm.id;
      
      // 3. Hash password
      const passwordHash = await hashPassword(input.password);
      
      // 4. Insert user
      await db.insert(s.users).values({
        companyId: company.id,
        email: input.email,
        name: input.email.split("@")[0],
        userRole: "admin",
        role: "admin",
        password: passwordHash,
      });
      const [user] = await db.select().from(s.users)
        .where(eq(s.users.email, input.email))
        .limit(1);
      if (!user) throw new Error("Nie udało się utworzyć użytkownika");
      
      // 5. Generate token
      const token = generateToken(Number(user.id), Number(companyId));
      
      return { 
        companyId, 
        farmId, 
        userId: user.id, 
        email: input.email, 
        token, 
        message: "✓ Konto założone! Zalogowany." 
      };
    }),

  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users)
        .where(eq(s.users.email, input.email))
        .limit(1);
      if (!user) throw new Error("Użytkownik nie znaleziony");
      const passwordValid = await verifyPassword(input.password, user.password || "");
      if (!passwordValid) throw new Error("Hasło niepoprawne");
      const token = generateToken(Number(user.id), Number(user.companyId));
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
        token 
      };
    }),

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

