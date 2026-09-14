/**
 * MIDDLEWARE — tRPC procedures z autentykacją.
 * publicQuery = bez auth (login, register, ping)
 * protectedQuery = wymaga zalogowanego usera
 * adminQuery = wymaga roli owner/admin
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

/** Wyciąga usera z cookie JWT i dodaje do kontekstu */
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const token = ctx.req.headers.get("cookie")?.match(/auth_token=([^;]+)/)?.[1];

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Wymagane zalogowanie" });
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.userId as number;

    const db = getDb();
    const [user] = await db.select().from(s.users).where(eq(s.users.id, userId));

    if (!user || !user.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Konto nieaktywne" });
    }

    // Sprawdź czy user ma dostęp do wybranej firmy
    if (ctx.companyId && user.companyId !== ctx.companyId && user.role !== "admin") {
      throw new TRPCError({ 
        code: "FORBIDDEN", 
        message: "Brak dostępu do tej firmy" 
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          companyId: user.companyId,
        },
      },
    });
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Nieprawidłowy token" });
  }
});

/** Wymaga zalogowania */
export const protectedQuery = t.procedure.use(authMiddleware);

/** Wymaga roli owner lub admin */
export const adminQuery = t.procedure.use(authMiddleware).use(({ ctx, next }) => {
  if (ctx.user.role !== "owner" && ctx.user.role !== "admin") {
    throw new TRPCError({ 
      code: "FORBIDDEN", 
      message: "Wymagane uprawnienia administratora" 
    });
  }
  return next({ ctx });
});
