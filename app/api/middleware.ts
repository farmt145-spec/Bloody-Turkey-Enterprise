import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
/** Endpoints available before logowanie (wyłącznie rejestracja i logowanie). */
export const anonymousQuery = t.procedure;

// Domyślna procedura API: cała aplikacja biznesowa wymaga JWT.
// Nazwa została zachowana, aby nie rozbijać istniejących routerów.
export const publicQuery = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new Error("Unauthorized");
  return next();
});

export const protectedQuery = publicQuery;
