import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq } from "drizzle-orm";

export const adminRouter = createRouter({
  /* ------- aktualny użytkownik (zawsze zwraca coś) ------- */
  getCurrentUser: publicQuery.query(async ({ ctx }) => {
    const demo = { id: 1, email: "demo@localhost", name: "Demo Manager", userRole: "manager", role: "admin" };
    
    if (!ctx.companyId) return demo;
    
    try {
      const db = getDb();
      const [user] = await db.select().from(s.users)
        .where(eq(s.users.companyId, BigInt(ctx.companyId)))
        .limit(1);
      
      return user || demo;
    } catch (err) {
      console.error("Failed to fetch user:", err);
      return demo;
    }
  }),

  /* ------- lista użytkowników w firmie ------- */
  listUsers: publicQuery.query(async ({ ctx }) => {
    if (!ctx.companyId) return [];
    
    const db = getDb();
    return db.select().from(s.users).where(eq(s.users.companyId, BigInt(ctx.companyId)));
  }),

  /* ------- pobierz firmę ------- */
  getCompany: publicQuery.query(async ({ ctx }) => {
    if (!ctx.companyId) return null;
    
    const db = getDb();
    const [company] = await db.select().from(s.companies).where(eq(s.companies.id, BigInt(ctx.companyId)));
    return company || null;
  }),

  /* ------- zaktualizuj tier firmy ------- */
  updateCompanyTier: publicQuery
    .input(z.object({ tier: z.enum(["standard", "advanced", "professional", "enterprise"]) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.companyId) throw new Error("Brak companyId");
      
      const db = getDb();
      await db.update(s.companies).set({ tier: input.tier }).where(eq(s.companies.id, BigInt(ctx.companyId)));
      
      return { ok: true };
    }),

  /* ------- zaproś użytkownika ------- */
  inviteUser: publicQuery
    .input(z.object({ email: z.string().email(), role: z.enum(["worker", "manager", "admin"]) }))
    .mutation(async ({ input, ctx }) => {
      if (!ctx.companyId) throw new Error("Brak companyId");
      
      const db = getDb();
      
      const [{ id }] = await db.insert(s.users).values({
        email: input.email,
        companyId: BigInt(ctx.companyId),
        name: input.email.split("@")[0],
        userRole: input.role,
        role: input.role,
      }).$returningId();
      
      return { id, email: input.email };
    }),
});

