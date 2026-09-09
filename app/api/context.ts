import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
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
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    companyId: numHeader(opts.req.headers, "x-company-id"),
    farmId: numHeader(opts.req.headers, "x-farm-id"),
  };
}
