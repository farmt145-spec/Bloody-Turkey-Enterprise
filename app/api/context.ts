import { verifyToken } from "./auth-utils";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import { and, eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { companies } from "@db/schema";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  userId: number | null;
  /** Firma właściciela konta z podpisanego JWT — nigdy z nagłówka klienta. */
  accountCompanyId: number | null;
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
  let accountCompanyId: number | null = null;
  const authHeader = opts.req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const decoded = verifyToken(token);
    if (decoded) {
      userId = decoded.userId;
      accountCompanyId = decoded.companyId;
    }
  }

  // Użytkownik może przełączać tylko swoją firmę lub firmę demonstracyjną.
  // Nie ufamy samemu x-company-id, bo można go zmienić w DevTools.
  const requestedCompanyId = numHeader(opts.req.headers, "x-company-id");
  let companyId = accountCompanyId;
  if (userId && requestedCompanyId && requestedCompanyId !== accountCompanyId) {
    const [demo] = await getDb().select({ id: companies.id }).from(companies)
      .where(and(eq(companies.id, requestedCompanyId), eq(companies.isDemo, true))).limit(1);
    if (demo) companyId = demo.id;
  }
  
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    userId,
    accountCompanyId,
    companyId,
    farmId: userId ? numHeader(opts.req.headers, "x-farm-id") : null,
  };
}
