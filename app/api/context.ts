import { verifyToken } from "./auth-utils";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  userId: number | null;
  /** Aktywna firma wybrana na ekranie „Wybierz gospodarstwo" (nagłówek x-company-id). */
  companyId: number | null;
  /** Aktywne gospodarstwo (nagłówek x-farm-id). */
  farmId: number | null;
};

const numHeader = (headers: Headers, name: string): number | null => {
  const raw = headers.get(name);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  // Wyciągnij userId z JWT tokena
  let userId: number | null = null;
  const authHeader = opts.req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) userId = decoded.userId;
  }
  
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    userId,
    companyId: userId ? numHeader(opts.req.headers, "x-company-id") : null,
    farmId: userId ? numHeader(opts.req.headers, "x-farm-id") : null,
  };
}
