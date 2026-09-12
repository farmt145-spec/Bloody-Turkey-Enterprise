import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;
export const publicMutation = t.procedure;

// Protected: wymaga JWT tokena
export const protectedQuery = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new Error("Unauthorized");
  return next();
});

