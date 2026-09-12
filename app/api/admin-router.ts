import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import { audit } from "./audit";

export const adminRouter = createRouter({
  /* ------- użytkownicy w firmie ------- */
  users: publicQuery
    .input(z.object({ companyId: z.number() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId ?? input?.companyId;
      if (!cid) return [];
      const rows = await db.select().from(s.users).where(eq(s.users.companyId, cid));
      return rows;
    }),

  /* ------- zaproszenia ------- */
  userInvites: publicQuery
    .input(z.object({ companyId: z.number() }).optional())
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId ?? input?.companyId;
      if (!cid) return [];
      return db.select().from(s.userInvites)
        .where(eq(s.userInvites.companyId, cid))
        .orderBy(desc(s.userInvites.createdAt));
    }),

  /* ------- wysłanie zaproszenia ------- */
  sendInvite: publicQuery
    .input(z.object({
      companyId: z.number(),
      email: z.string().email(),
      role: z.enum(["worker", "manager", "admin"]),
      message: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cid = input.companyId;

      // Sprawdzenie czy użytkownik już istnieje
      const [existing] = await db.select().from(s.users)
        .where(and(eq(s.users.email, input.email), eq(s.users.companyId, cid)));
      if (existing) throw new Error(`Użytkownik ${input.email} już istnieje w firmie`);

      // Sprawdzenie czy zaproszenie już wysłane
      const [existingInvite] = await db.select().from(s.userInvites)
        .where(and(eq(s.userInvites.email, input.email), eq(s.userInvites.companyId, cid), eq(s.userInvites.status, "pending")));
      if (existingInvite) throw new Error(`Zaproszenie dla ${input.email} już wysłane`);

      // Generowanie kodu zaproszenia
      const token = Buffer.from(JSON.stringify({
        email: input.email,
        companyId: cid,
        ts: Date.now(),
      })).toString("base64").slice(0, 32);

      const [{ id }] = await db.insert(s.userInvites).values({
        companyId: cid,
        email: input.email,
        role: input.role,
        token,
        status: "pending",
        message: input.message,
        sentAt: new Date(),
      }).$returningId();

      await audit("user_invites", id, "create", {
        newValues: { email: input.email, role: input.role, companyId: cid },
      });

      return { id, token, email: input.email };
    }),

  /* ------- akceptowanie zaproszenia ------- */
  acceptInvite: publicQuery
    .input(z.object({
      token: z.string(),
      email: z.string().email(),
      name: z.string().min(2),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const [invite] = await db.select().from(s.userInvites)
        .where(and(eq(s.userInvites.token, input.token), eq(s.userInvites.status, "pending")));

      if (!invite) throw new Error("Zaproszenie nie istnieje lub wygasło");
      if (invite.email !== input.email) throw new Error("Email nie zgadza się");

      // Aktualizacja zaproszenia
      await db.update(s.userInvites)
        .set({ status: "accepted", acceptedAt: new Date() })
        .where(eq(s.userInvites.id, invite.id));

      // Tworzenie użytkownika
      const [{ id: userId }] = await db.insert(s.users).values({
        unionId: `invite_${invite.id}_${Date.now()}`,
        email: input.email,
        name: input.name,
        companyId: invite.companyId,
        role: invite.role === "admin" ? "admin" : "user",
        userRole: invite.role,
      }).$returningId();

      await audit("users", userId, "create", {
        newValues: { email: input.email, role: invite.role, companyId: invite.companyId },
      });

      return { userId, companyId: invite.companyId };
    }),

  /* ------- zmiana roli użytkownika ------- */
  updateUserRole: publicQuery
    .input(z.object({
      userId: z.number(),
      role: z.enum(["worker", "manager", "admin"]),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const dbRole = input.role === "admin" ? "admin" : "user";

      const [old] = await db.select().from(s.users).where(eq(s.users.id, input.userId));
      if (!old) throw new Error("Użytkownik nie istnieje");

      await db.update(s.users)
        .set({ role: dbRole, userRole: input.role })
        .where(eq(s.users.id, input.userId));

      await audit("users", input.userId, "update", {
        oldValues: { role: old.role },
        newValues: { role: dbRole },
      });

      return { ok: true };
    }),

  /* ------- usunięcie zaproszenia ------- */
  cancelInvite: publicQuery
    .input(z.object({ inviteId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.userInvites).where(eq(s.userInvites.id, input.inviteId));
      if (!old) throw new Error("Zaproszenie nie istnieje");

      await db.update(s.userInvites)
        .set({ status: "cancelled" })
        .where(eq(s.userInvites.id, input.inviteId));

      await audit("user_invites", input.inviteId, "update", {
        oldValues: { status: old.status },
        newValues: { status: "cancelled" },
      });

      return { ok: true };
    }),

  /* ------- usunięcie użytkownika z firmy ------- */
  removeUser: publicQuery
    .input(z.object({ userId: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [old] = await db.select().from(s.users).where(eq(s.users.id, input.userId));
      if (!old) throw new Error("Użytkownik nie istnieje");

      // Zamiast harddeleta, archiwizujemy
      await db.update(s.users)
        .set({ role: "user", companyId: null })
        .where(eq(s.users.id, input.userId));

      await audit("users", input.userId, "update", {
        oldValues: { companyId: old.companyId },
        newValues: { companyId: null },
      });

      return { ok: true };
    }),

  /* ------- aktualny użytkownik (z workspacU w localStorage) ------- */
  getCurrentUser: publicQuery.query(async ({ ctx }) => {
    if (!ctx.companyId) {
      // Demo mode — zwróć usera z highest role
      return { id: 1, email: "demo@localhost", name: "Demo User", userRole: "manager", role: "admin" };
    }
    const db = getDb();
    // Production: pobierz usera z najwyższą rolą z firmy (do pokazania Panel Admina)
    const [user] = await db.select().from(s.users)
      .where(eq(s.users.companyId, BigInt(ctx.companyId)))
      .orderBy(sql`CASE WHEN role = 'admin' THEN 1 ELSE 2 END`)
      .limit(1);
    return user || { id: 1, email: "demo@localhost", name: "Demo User", userRole: "manager", role: "admin" };
  }),

});

