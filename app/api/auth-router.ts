import { z } from "zod";
import { createRouter, anonymousQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "./auth-utils";

export const authRouter = createRouter({
  signup: anonymousQuery
    .input(z.object({ 
      companyName: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(8),
      farmName: z.string().min(2),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      
      const [existing] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
      if (existing) throw new Error("Email już zarejestrowany");
      
      const companyResult = await db.insert(s.companies).values({
        name: input.companyName,
        countryCode: "PL",
      });
      const companyId = companyResult.insertId;
      
      const farmResult = await db.insert(s.farms).values({
        companyId: BigInt(companyId),
        name: input.farmName,
        countryCode: "PL",
        city: "",
        lat: "52.00000",
        lng: "19.00000",
        capacity: 0,
      });
      const farmId = farmResult.insertId;
      
      const passwordHash = await hashPassword(input.password);
      
      const userResult = await db.insert(s.users).values({
        companyId: BigInt(companyId),
        unionId: email,
        email,
        name: email.split("@")[0],
        userRole: "admin",
        role: "admin",
        password: passwordHash,
      });
      const userId = userResult.insertId;

      // Kopiujemy tylko konfigurację startową z Indykpolu. Nowa firma nie
      // dziedziczy żadnych stad, kurników, dzienników ani danych handlowych.
      const [template] = await db.select({ id: s.companies.id }).from(s.companies)
        .where(sql`LOWER(${s.companies.name}) LIKE '%indykpol%'`).limit(1);
      if (template) {
        const sourceCompanyId = template.id;
        const ingredients = await db.select().from(s.feedIngredients)
          .where(eq(s.feedIngredients.companyId, sourceCompanyId));
        const ingredientIds = new Map<number, number>();
        for (const ingredient of ingredients) {
          const { id, companyId: _companyId, createdAt, updatedAt, ...values } = ingredient;
          const [{ id: newId }] = await db.insert(s.feedIngredients)
            .values({ ...values, companyId }).$returningId();
          ingredientIds.set(id, newId);
        }

        const recipes = await db.select().from(s.recipes).where(eq(s.recipes.companyId, sourceCompanyId));
        const recipeItems = await db.select().from(s.recipeItems);
        const recipeIds = new Map<number, number>();
        for (const recipe of recipes) {
          const { id, companyId: _companyId, createdAt, ...values } = recipe;
          const [{ id: newId }] = await db.insert(s.recipes).values({ ...values, companyId }).$returningId();
          recipeIds.set(id, newId);
          for (const item of recipeItems.filter((x) => x.recipeId === id)) {
            const ingredientId = ingredientIds.get(item.ingredientId);
            if (ingredientId) await db.insert(s.recipeItems).values({ recipeId: newId, ingredientId, percent: item.percent });
          }
        }

        const lines = await db.select().from(s.geneticLines).where(eq(s.geneticLines.companyId, sourceCompanyId));
        const norms = await db.select().from(s.geneticLineNorms);
        for (const line of lines) {
          const { id, companyId: _companyId, createdAt, updatedAt, ...values } = line;
          const [{ id: newLineId }] = await db.insert(s.geneticLines).values({ ...values, companyId }).$returningId();
          for (const norm of norms.filter((x) => x.geneticLineId === id)) {
            const { id: _id, geneticLineId: _lineId, createdAt: _createdAt, updatedAt: _updatedAt, ...normValues } = norm;
            await db.insert(s.geneticLineNorms).values({ ...normValues, geneticLineId: newLineId });
          }
        }

        const programs = await db.select().from(s.feedPrograms).where(eq(s.feedPrograms.companyId, sourceCompanyId));
        const stages = await db.select().from(s.feedProgramStages);
        for (const program of programs) {
          const { id, companyId: _companyId, createdAt, updatedAt, ...values } = program;
          const [{ id: newProgramId }] = await db.insert(s.feedPrograms).values({ ...values, companyId }).$returningId();
          for (const stage of stages.filter((x) => x.programId === id)) {
            const { id: _id, programId: _programId, recipeId, ...stageValues } = stage;
            await db.insert(s.feedProgramStages).values({
              ...stageValues, programId: newProgramId, recipeId: recipeId ? recipeIds.get(recipeId) ?? null : null,
            });
          }
        }
      }
      
      const token = generateToken(Number(userId), Number(companyId));
      
      return {
        companyId: Number(companyId),
        farmId: Number(farmId),
        userId: Number(userId),
        email,
        name: email.split("@")[0],
        userRole: "admin" as const,
        token,
        message: "✓ Konto założone",
      };
    }),

  login: anonymousQuery
    .input(z.object({ email: z.string().email(), password: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const email = input.email.trim().toLowerCase();
      const [user] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
      if (!user) throw new Error("Użytkownik nie znaleziony");
      const passwordValid = await verifyPassword(input.password, user.password || "");
      if (!passwordValid) throw new Error("Hasło niepoprawne");
      const token = generateToken(Number(user.id), Number(user.companyId));
      const [farm] = await db.select().from(s.farms).where(eq(s.farms.companyId, user.companyId)).limit(1);
      await db.update(s.users).set({ lastSignInAt: new Date() }).where(eq(s.users.id, user.id));
      return {
        userId: Number(user.id),
        companyId: Number(user.companyId),
        farmId: farm?.id ? Number(farm.id) : null,
        email: user.email ?? email,
        name: user.name ?? email.split("@")[0],
        userRole: user.userRole,
        token,
      };
    }),

  checkEmail: anonymousQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users).where(eq(s.users.email, input.email.trim().toLowerCase())).limit(1);
      return { exists: !!user };
    }),
});
