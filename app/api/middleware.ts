import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;

/** Endpoints dostępne PRZED logowaniem (rejestracja, logowanie, wybór firmy). */
export const publicQuery = t.procedure;

/** Endpoints wymagające JWT logowania (cała aplikacja biznesowa). */
export const protectedQuery = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new Error("Unauthorized — JWT token required");
  return next();
});

/** Alias dla backward compatibility */
export const anonymousQuery = publicQuery;

