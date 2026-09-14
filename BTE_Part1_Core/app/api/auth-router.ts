/**
 * AUTH ROUTER — rejestracja, logowanie, wylogowanie, profil.
 * Używa JWT w httpOnly cookie + bcrypt do hashowania haseł.
 */
import { z } from "zod";
import { eq, and, gt } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { hash, compare } from "bcryptjs";
import { nanoid } from "nanoid";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);
const JWT_EXPIRES = "7d";

async function createToken(userId: number, companyId: number | null): Promise<string> {
  return new SignJWT({ userId, companyId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(JWT_EXPIRES)
    .setJti(nanoid())
    .sign(JWT_SECRET);
}

async function verifyToken(token: string): Promise<{ userId: number; companyId: number | null } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return { userId: payload.userId as number, companyId: (payload.companyId as number) ?? null };
  } catch {
    return null;
  }
}

export const authRouter = createRouter({
  /** Rejestracja — tworzy usera i opcjonalnie nową firmę */
  register: publicQuery
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8).max(100),
      name: z.string().min(2).max(255),
      companyName: z.string().min(2).max(255).optional(),
      createCompany: z.boolean().default(false),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Sprawdź czy email już istnieje
      const [existing] = await db.select().from(s.users).where(eq(s.users.email, input.email));
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "Email już zarejestrowany" });
      }

      // Hash hasła
      const passwordHash = await hash(input.password, 12);

      let companyId: number | null = null;

      // Opcjonalnie utwórz firmę
      if (input.createCompany && input.companyName) {
        const [{ id }] = await db.insert(s.companies).values({
          name: input.companyName, countryCode: "PL", baseCurrency: "PLN", isDemo: false,
        }).$returningId();
        companyId = id;
      }

      // Utwórz usera
      const [{ id: userId }] = await db.insert(s.users).values({
        unionId: nanoid(),
        email: input.email,
        passwordHash,
        name: input.name,
        role: companyId ? "owner" : "user",
        companyId,
      }).$returningId();

      // Utwórz token
      const token = await createToken(userId, companyId);

      // Ustaw cookie
      ctx.resHeaders.set("Set-Cookie", 
        `auth_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
      );

      return { userId, companyId, email: input.email, name: input.name };
    }),

  /** Logowanie */
  login: publicQuery
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      const [user] = await db.select().from(s.users).where(eq(s.users.email, input.email));
      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Nieprawidłowy email lub hasło" });
      }

      if (!user.isActive) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Konto nieaktywne" });
      }

      const valid = await compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Nieprawidłowy email lub hasło" });
      }

      // Aktualizuj lastSignInAt
      await db.update(s.users).set({ lastSignInAt: new Date() }).where(eq(s.users.id, user.id));

      const token = await createToken(user.id, user.companyId);
      ctx.resHeaders.set("Set-Cookie",
        `auth_token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
      );

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
      };
    }),

  /** Wylogowanie */
  logout: publicQuery.mutation(async ({ ctx }) => {
    ctx.resHeaders.set("Set-Cookie",
      "auth_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
    );
    return { ok: true };
  }),

  /** Aktualny user z tokena */
  me: publicQuery.query(async ({ ctx }) => {
    const token = ctx.req.headers.get("cookie")?.match(/auth_token=([^;]+)/)?.[1];
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    const db = getDb();
    const [user] = await db.select({
      id: s.users.id,
      email: s.users.email,
      name: s.users.name,
      role: s.users.role,
      companyId: s.users.companyId,
      avatar: s.users.avatar,
    }).from(s.users).where(eq(s.users.id, payload.userId));

    return user ?? null;
  }),

  /** Zmiana hasła */
  changePassword: publicQuery
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(100),
    }))
    .mutation(async ({ input, ctx }) => {
      const token = ctx.req.headers.get("cookie")?.match(/auth_token=([^;]+)/)?.[1];
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED" });

      const payload = await verifyToken(token);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED" });

      const db = getDb();
      const [user] = await db.select().from(s.users).where(eq(s.users.id, payload.userId));
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });

      const valid = await compare(input.currentPassword, user.passwordHash!);
      if (!valid) throw new TRPCError({ code: "FORBIDDEN", message: "Nieprawidłowe obecne hasło" });

      const newHash = await hash(input.newPassword, 12);
      await db.update(s.users).set({ passwordHash: newHash }).where(eq(s.users.id, user.id));

      return { ok: true };
    }),

  /** Reset hasła — wysłanie linku */
  requestReset: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users).where(eq(s.users.email, input.email));

      // Zawsze zwracamy ok — nie zdradzamy czy email istnieje
      if (!user) return { ok: true };

      const resetToken = nanoid(32);
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 godzina

      await db.update(s.users).set({
        resetToken,
        resetTokenExpiry: expiry,
      }).where(eq(s.users.id, user.id));

      // TODO: wysłać email z linkiem
      console.log(`Reset token dla ${input.email}: ${resetToken}`);

      return { ok: true };
    }),

  /** Reset hasła — ustawienie nowego */
  resetPassword: publicQuery
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8).max(100),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [user] = await db.select().from(s.users)
        .where(and(
          eq(s.users.resetToken, input.token),
          gt(s.users.resetTokenExpiry, new Date())
        ));

      if (!user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nieprawidłowy lub wygasły token" });
      }

      const newHash = await hash(input.newPassword, 12);
      await db.update(s.users).set({
        passwordHash: newHash,
        resetToken: null,
        resetTokenExpiry: null,
      }).where(eq(s.users.id, user.id));

      return { ok: true };
    }),
});
