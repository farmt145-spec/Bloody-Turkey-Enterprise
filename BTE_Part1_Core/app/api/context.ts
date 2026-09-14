/**
 * CONTEXT — rozszerzony kontekst tRPC z danymi usera.
 */
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export type UserRole = "owner" | "admin" | "user" | "viewer";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  /** Aktywna firma wybrana na ekranie „Wybierz gospodarstwo" (nagłówek x-company-id). */
  companyId: number | null;
  /** Aktywne gospodarstwo (nagłówek x-farm-id). */
  farmId: number | null;
  /** Zalogowany user (dostępny w protectedQuery i adminQuery). */
  user?: {
    id: number;
    email: string;
    name: string | null;
    role: UserRole;
    companyId: number | null;
  };
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
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    companyId: numHeader(opts.req.headers, "x-company-id"),
    farmId: numHeader(opts.req.headers, "x-farm-id"),
  };
}
