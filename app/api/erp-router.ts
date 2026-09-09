/* ============================================================
   ERP ROUTER — generyczny CRUD z paginacją, filtrowaniem,
   sortowaniem i audytem dla modułów rejestrowych systemu.
   Jeden wzorzec (Repository/Service w jednej warstwie tRPC),
   zero duplikacji — każdy moduł to konfiguracja w rejestrze.
   ============================================================ */
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import { audit } from "./audit";
import { z } from "zod";
import { and, desc, asc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { getTableColumns, type Table } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { requireCompanyId, scopedFarmIds, scopedBatchIds } from "./tenant";

/* Rejestr modułów ERP: tabela + kolumny tekstowe do wyszukiwania */
const MODULES = {
  suppliers: { table: s.suppliers, search: ["name", "nip", "email"] },
  purchaseOrders: { table: s.purchaseOrders, search: ["number", "item"] },
  contracts: { table: s.contracts, search: ["number", "party"] },
  invoices: { table: s.invoices, search: ["number", "counterparty"] },
  medicines: { table: s.medicines, search: ["name", "substance"] },
  labResults: { table: s.labResults, search: ["testName", "resultValue", "labName"] },
  energyLogs: { table: s.energyLogs, search: ["unit"] },
  maintenanceTickets: { table: s.maintenanceTickets, search: ["title", "description"] },
  biosecurityChecks: { table: s.biosecurityChecks, search: ["area", "checkName", "inspector"] },
  documents: { table: s.documents, search: ["title", "reference"] },
  tasks: { table: s.tasks, search: ["title", "description", "assignee"] },
  messages: { table: s.messages, search: ["body", "author", "channel"] },
  hatcheryBatches: { table: s.hatcheryBatches, search: ["code"] },
} as const;

type ModuleKey = keyof typeof MODULES;

/* Jak każdy moduł jest izolowany per firma/ferma */
const SCOPE: Record<string, "companyId" | "farmId" | "batchId"> = {
  suppliers: "companyId", purchaseOrders: "companyId", contracts: "companyId",
  invoices: "companyId", medicines: "companyId", documents: "companyId",
  tasks: "companyId", messages: "companyId", hatcheryBatches: "companyId",
  labResults: "farmId", energyLogs: "farmId", maintenanceTickets: "farmId",
  biosecurityChecks: "farmId",
};

const listInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  includeArchived: z.boolean().default(false),
});

function buildModule(modKey: ModuleKey) {
  const mod = MODULES[modKey];
  const table = mod.table as unknown as Table & { id: any };
  const cols = getTableColumns(table);
  const hasStatus = "status" in cols;
  const hasUpdatedBy = "updatedBy" in cols;
  const scopeCol = SCOPE[modKey];

  /** Warunek izolacji tenanta + auto-uzupełnienie companyId/farmId przy create. */
  async function scopeConds(ctx: any): Promise<SQL[]> {
    if (!scopeCol) return [];
    const cid = requireCompanyId(ctx);
    if (scopeCol === "companyId") return [eq((cols as any).companyId, cid)];
    if (scopeCol === "farmId") {
      const fids = await scopedFarmIds(ctx);
      if (fids.length === 0) return [eq((cols as any).farmId, -1)];
      return [inArray((cols as any).farmId, fids)];
    }
    const bids = await scopedBatchIds(ctx);
    if (bids.length === 0) return [eq((cols as any).batchId, -1)];
    return [inArray((cols as any).batchId, bids)];
  }

  async function assertRowAccess(ctx: any, id: number) {
    if (!scopeCol) return;
    const conds = await scopeConds(ctx);
    const [row] = await getDb().select({ id: (cols as any).id }).from(table as any)
      .where(and(eq((cols as any).id, id), ...conds)).limit(1);
    if (!row) throw new TRPCError({ code: "FORBIDDEN", message: "Rekord nie należy do wybranej firmy/gospodarstwa." });
  }

  return {
    list: publicQuery.input(listInput).query(async ({ input, ctx }) => {
      const db = getDb();
      const conds: SQL[] = await scopeConds(ctx);
      if (hasStatus && !input.includeArchived) conds.push(eq((cols as any).status, "active"));
      if (input.filters) {
        for (const [k, v] of Object.entries(input.filters)) {
          if ((cols as any)[k] !== undefined && v !== "" && v !== undefined) conds.push(eq((cols as any)[k], v as any));
        }
      }
      if (input.search) {
        const parts = mod.search
          .filter((c) => (cols as any)[c])
          .map((c) => like((cols as any)[c], `%${input.search}%`));
        if (parts.length) conds.push(or(...parts)!);
      }
      const where = conds.length ? and(...conds) : undefined;
      const sortCol = (cols as any)[input.sortBy ?? "id"] ?? (cols as any).id;
      const order = input.sortDir === "asc" ? asc(sortCol) : desc(sortCol);
      const [rows, [{ cnt }]] = await Promise.all([
        db.select().from(table as any).where(where).orderBy(order)
          .limit(input.pageSize).offset((input.page - 1) * input.pageSize),
        db.select({ cnt: sql<number>`count(*)` }).from(table as any).where(where),
      ]);
      return { rows, total: Number(cnt), page: input.page, pageSize: input.pageSize };
    }),

    create: publicQuery
      .input(z.object({ data: z.record(z.string(), z.unknown()), author: z.string().default("panel") }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(input.data)) {
          if ((cols as any)[k] !== undefined && k !== "id" && v !== undefined) data[k] = v;
        }
        if (scopeCol === "companyId" && data.companyId == null) data.companyId = requireCompanyId(ctx);
        if (scopeCol === "farmId" && data.farmId == null) {
          const fids = await scopedFarmIds(ctx);
          if (fids.length === 1) data.farmId = fids[0];
        }
        if (hasUpdatedBy) data.updatedBy = input.author;
        const [{ id }] = await db.insert(table as any).values(data).$returningId();
        await audit((table as any)[Symbol.for("drizzle:Name")] ?? modKey, id, "create", { newValues: data, author: input.author });
        const row = await db.select().from(table as any).where(eq((cols as any).id, id));
        return row[0];
      }),

    update: publicQuery
      .input(z.object({ id: z.number(), data: z.record(z.string(), z.unknown()), author: z.string().default("panel") }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
        await assertRowAccess(ctx, input.id);
        const [old] = await db.select().from(table as any).where(eq((cols as any).id, input.id));
        if (!old) throw new TRPCError({ code: "NOT_FOUND", message: "Rekord nie istnieje" });
        const data: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(input.data)) {
          if ((cols as any)[k] !== undefined && k !== "id" && v !== undefined) data[k] = v;
        }
        if (hasUpdatedBy) data.updatedBy = input.author;
        await db.update(table as any).set(data).where(eq((cols as any).id, input.id));
        await audit(modKey, input.id, "update", { oldValues: old, newValues: data, author: input.author });
        const [row] = await db.select().from(table as any).where(eq((cols as any).id, input.id));
        return row;
      }),

    remove: publicQuery
      .input(z.object({ id: z.number(), author: z.string().default("panel") }))
      .mutation(async ({ input, ctx }) => {
        const db = getDb();
        await assertRowAccess(ctx, input.id);
        if (hasStatus) {
          await db.update(table as any).set({ status: "archived", ...(hasUpdatedBy ? { updatedBy: input.author } : {}) } as any)
            .where(eq((cols as any).id, input.id));
        } else {
          await db.delete(table as any).where(eq((cols as any).id, input.id));
        }
        await audit(modKey, input.id, "delete", { author: input.author });
        return { ok: true };
      }),
  };
}

export const erpRouter = createRouter(
  Object.fromEntries(
    (Object.keys(MODULES) as ModuleKey[]).map((k) => [k, createRouter(buildModule(k) as any)]),
  ) as { [K in ModuleKey]: ReturnType<typeof createRouter> },
);

/* ---- Powiadomienia (odczyt + oznaczanie) ---- */
export const notificationsRouter = createRouter({
  list: publicQuery.query(async ({ ctx }) => {
    const cid = ctx.companyId ?? -1;
    return getDb().select().from(s.notifications)
      .where(sql`(${s.notifications.companyId} = ${cid} OR ${s.notifications.companyId} IS NULL)`)
      .orderBy(desc(s.notifications.createdAt)).limit(50);
  }),
  markRead: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await getDb().update(s.notifications).set({ read: true }).where(eq(s.notifications.id, input.id));
    return { ok: true };
  }),
  markAllRead: publicQuery.mutation(async () => {
    await getDb().update(s.notifications).set({ read: true }).where(eq(s.notifications.read, false));
    return { ok: true };
  }),
  push: publicQuery
    .input(z.object({ severity: z.enum(["info", "warning", "critical"]).default("info"), title: z.string(), body: z.string().optional(), link: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const [{ id }] = await getDb().insert(s.notifications).values({ ...input, companyId: ctx.companyId ?? null } as any).$returningId();
      return { id };
    }),
});
