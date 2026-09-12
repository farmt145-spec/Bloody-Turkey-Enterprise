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
      
      const companyResult = await db.insert(s.companies).values({
        name: input.companyName,
        countryCode: "PL",
      });
      const companyId = companyResult.insertId;
      
      const farmResult = await db.insert(s.farms).values({
        companyId: BigInt(companyId),
        name: input.farmName,
      });
      const farmId = farmResult.insertId;
      
      const passwordHash = await hashPassword(input.password);
      
      const userResult = await db.insert(s.users).values({
        companyId: BigInt(companyId),
        email: input.email,
        name: input.email.split("@")[0],
        userRole: "admin",
        role: "admin",
        password: passwordHash,
      });
      const userId = userResult.insertId;
      
      const token = generateToken(Number(userId), Number(companyId));
      
      return { companyId, farmId, userId, email: input.email, token, message: "✓ Konto założone" };
    }),

  login: publicQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);
      if (!user) throw new Error("Użytkownik nie znaleziony");
      const passwordValid = await verifyPassword(input.password, user.password || "");
      if (!passwordValid) throw new Error("Hasło niepoprawne");
      const token = generateToken(Number(user.id), Number(user.companyId));
      const [farm] = await db.select().from(s.farms).where(eq(s.farms.companyId, user.companyId)).limit(1);
      return { userId: user.id, companyId: user.companyId, farmId: farm?.id || null, email: user.email, name: user.name, userRole: user.userRole, token };
    }),

  checkEmail: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users).where(eq(s.users.email, input.email)).limit(1);
      return { exists: !!user };
    }),
});

