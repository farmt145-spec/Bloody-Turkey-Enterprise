import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "./auth-utils";

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

      // 2. Utwórz nową firmę (EMPTY — bez klonowania)
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

      // 3. Utwórz użytkownika (isAdmin = false dla zwykłych klientów)
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
          isAdmin: false,
          unionId: `user_${Date.now()}_${Math.random()}`,
        })
        .$returningId();

      if (!newUserId.id) throw new Error("Błąd tworzenia użytkownika");
      const userId = newUserId.id;

      // 4. Generuj token
      const token = generateToken(Number(userId), Number(companyId));

      return {
        companyId: Number(companyId),
        userId: Number(userId),
        email: input.email,
        token,
        message: "✓ Konto założone — masz dostęp do demo i możesz dodać swoją firmę",
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
        isAdmin: user.isAdmin || false,
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

