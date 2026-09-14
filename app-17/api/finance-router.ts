/**
 * FINANCE ROUTER — faktury, płatności, koszty, raporty finansowe.
 * 
 * Endpointy:
 * - Invoices: CRUD, list z filtrami, status płatności
 * - Payments: CRUD, potwierdzanie
 * - Counterparties: CRUD dostawcy/odbiorcy
 * - FixedCosts: koszty stałe z auto-księgowaniem
 * - Budgets: planowanie vs rzeczywistość
 * - Reports: P&L, cash flow, koszty per kategoria, aging
 */
import { z } from "zod";
import { eq, and, gte, lte, desc, sql, like, or } from "drizzle-orm";
import { createRouter, publicQuery, protectedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";
import * as fin from "../db/schema-finance";

const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const financeRouter = createRouter({
  /* ═══════════════════════════════════════════════════════════
     INVOICES — faktury
     ═══════════════════════════════════════════════════════════ */

  /** Lista faktur z filtrami */
  listInvoices: publicQuery
    .input(z.object({
      type: z.enum(["purchase", "sale", "cost", "correction"]).optional(),
      category: z.string().optional(),
      paymentStatus: z.enum(["unpaid", "partial", "paid", "overdue"]).optional(),
      counterpartyId: z.number().optional(),
      batchId: z.number().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      let query = db.select().from(fin.invoices)
        .where(and(eq(fin.invoices.companyId, cid), eq(fin.invoices.isActive, true)));

      if (input.type) query = query.where(eq(fin.invoices.type, input.type));
      if (input.category) query = query.where(eq(fin.invoices.category, input.category));
      if (input.paymentStatus) query = query.where(eq(fin.invoices.paymentStatus, input.paymentStatus));
      if (input.counterpartyId) query = query.where(eq(fin.invoices.counterpartyId, input.counterpartyId));
      if (input.batchId) query = query.where(eq(fin.invoices.batchId, input.batchId));
      if (input.dateFrom) query = query.where(gte(fin.invoices.issueDate, input.dateFrom));
      if (input.dateTo) query = query.where(lte(fin.invoices.issueDate, input.dateTo));
      if (input.search) {
        query = query.where(or(
          like(fin.invoices.number, `%${input.search}%`),
          like(fin.invoices.counterpartyName, `%${input.search}%`)
        ));
      }

      const [rows, countResult] = await Promise.all([
        query.orderBy(desc(fin.invoices.issueDate)).limit(input.limit).offset(input.offset),
        db.select({ count: sql<number>`COUNT(*)` }).from(fin.invoices)
          .where(and(eq(fin.invoices.companyId, cid), eq(fin.invoices.isActive, true))),
      ]);

      return {
        invoices: rows,
        total: Number(countResult[0]?.count ?? 0),
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /** Pobierz fakturę z pozycjami */
  getInvoice: publicQuery
    .input(z.object({ invoiceId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      const [invoice] = await db.select().from(fin.invoices)
        .where(eq(fin.invoices.id, input.invoiceId)).limit(1);
      if (!invoice) throw new Error("Nie znaleziono faktury");

      const items = await db.select().from(fin.invoiceItems)
        .where(eq(fin.invoiceItems.invoiceId, input.invoiceId));

      const payments = await db.select().from(fin.payments)
        .where(eq(fin.payments.invoiceId, input.invoiceId));

      return { invoice, items, payments };
    }),

  /** Utwórz fakturę */
  createInvoice: protectedQuery
    .input(z.object({
      type: z.enum(["purchase", "sale", "cost", "correction"]),
      number: z.string().min(1).max(50),
      externalNumber: z.string().max(100).optional(),
      counterpartyId: z.number().optional(),
      counterpartyName: z.string().min(1).max(255),
      counterpartyNip: z.string().max(16).optional(),
      counterpartyAddress: z.string().optional(),
      issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      netAmount: z.number().min(0),
      vatAmount: z.number().min(0),
      grossAmount: z.number().min(0),
      currency: z.string().default("PLN"),
      exchangeRate: z.number().default(1),
      category: z.enum(["feed", "chicks", "medicine", "equipment", "energy", "labor", "transport", "veterinary", "insurance", "tax", "other"]),
      batchId: z.number().optional(),
      slaughterBatchId: z.number().optional(),
      notes: z.string().optional(),
      items: z.array(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        unit: z.string().default("szt."),
        quantity: z.number().min(0.001),
        unitPrice: z.number().min(0),
        netAmount: z.number().min(0),
        vatRate: z.number().min(0).max(100),
        vatAmount: z.number().min(0),
        grossAmount: z.number().min(0),
        category: z.string().optional(),
      })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      // Transakcja — faktura + pozycje
      const result = await db.transaction(async (tx) => {
        const [{ id: invoiceId }] = await tx.insert(fin.invoices).values({
          companyId: cid,
          type: input.type,
          number: input.number,
          externalNumber: input.externalNumber ?? null,
          counterpartyId: input.counterpartyId ?? null,
          counterpartyName: input.counterpartyName,
          counterpartyNip: input.counterpartyNip ?? null,
          counterpartyAddress: input.counterpartyAddress ?? null,
          issueDate: input.issueDate,
          saleDate: input.saleDate ?? null,
          dueDate: input.dueDate,
          netAmount: input.netAmount.toFixed(2),
          vatAmount: input.vatAmount.toFixed(2),
          grossAmount: input.grossAmount.toFixed(2),
          currency: input.currency,
          exchangeRate: input.exchangeRate.toFixed(4),
          category: input.category,
          batchId: input.batchId ?? null,
          slaughterBatchId: input.slaughterBatchId ?? null,
          notes: input.notes ?? null,
          createdBy: ctx.user?.id,
        }).$returningId();

        for (const item of input.items) {
          await tx.insert(fin.invoiceItems).values({
            invoiceId,
            name: item.name,
            description: item.description ?? null,
            unit: item.unit,
            quantity: item.quantity.toFixed(3),
            unitPrice: item.unitPrice.toFixed(4),
            netAmount: item.netAmount.toFixed(2),
            vatRate: item.vatRate.toFixed(2),
            vatAmount: item.vatAmount.toFixed(2),
            grossAmount: item.grossAmount.toFixed(2),
            category: item.category ?? null,
          });
        }

        return { invoiceId };
      });

      return result;
    }),

  /** Aktualizuj status płatności faktury */
  updateInvoicePayment: protectedQuery
    .input(z.object({
      invoiceId: z.number(),
      paidAmount: z.number().min(0),
      paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const [invoice] = await db.select().from(fin.invoices)
        .where(eq(fin.invoices.id, input.invoiceId)).limit(1);
      if (!invoice) throw new Error("Nie znaleziono faktury");

      const gross = num(invoice.grossAmount);
      const paid = input.paidAmount;

      let paymentStatus: "unpaid" | "partial" | "paid" = "unpaid";
      if (paid >= gross) paymentStatus = "paid";
      else if (paid > 0) paymentStatus = "partial";

      await db.update(fin.invoices)
        .set({
          paidAmount: paid.toFixed(2),
          paymentStatus,
          paymentDate: input.paymentDate ?? (paymentStatus === "paid" ? new Date().toISOString().slice(0, 10) : null),
        })
        .where(eq(fin.invoices.id, input.invoiceId));

      return { ok: true, paymentStatus };
    }),

  /** Anuluj fakturę */
  cancelInvoice: protectedQuery
    .input(z.object({ invoiceId: z.number(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      await db.update(fin.invoices)
        .set({ isActive: false, notes: input.reason ?? "Anulowana" })
        .where(eq(fin.invoices.id, input.invoiceId));

      return { ok: true };
    }),

  /* ═══════════════════════════════════════════════════════════
     PAYMENTS — płatności
     ═══════════════════════════════════════════════════════════ */

  /** Lista płatności */
  listPayments: publicQuery
    .input(z.object({
      type: z.enum(["income", "expense", "transfer"]).optional(),
      category: z.string().optional(),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      isConfirmed: z.boolean().optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      let query = db.select().from(fin.payments)
        .where(eq(fin.payments.companyId, cid));

      if (input.type) query = query.where(eq(fin.payments.type, input.type));
      if (input.category) query = query.where(eq(fin.payments.category, input.category));
      if (input.dateFrom) query = query.where(gte(fin.payments.paymentDate, input.dateFrom));
      if (input.dateTo) query = query.where(lte(fin.payments.paymentDate, input.dateTo));
      if (input.isConfirmed !== undefined) query = query.where(eq(fin.payments.isConfirmed, input.isConfirmed));

      return await query.orderBy(desc(fin.payments.paymentDate)).limit(input.limit);
    }),

  /** Utwórz płatność */
  createPayment: protectedQuery
    .input(z.object({
      invoiceId: z.number().optional(),
      type: z.enum(["income", "expense", "transfer"]),
      amount: z.number().min(0.01),
      currency: z.string().default("PLN"),
      paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      method: z.enum(["cash", "bank_transfer", "card", "direct_debit", "other"]),
      counterpartyName: z.string().max(255).optional(),
      category: z.enum(["feed", "chicks", "medicine", "equipment", "energy", "labor", "transport", "veterinary", "insurance", "tax", "other"]),
      batchId: z.number().optional(),
      farmId: z.number().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      const [{ id }] = await db.insert(fin.payments).values({
        companyId: cid,
        invoiceId: input.invoiceId ?? null,
        type: input.type,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        paymentDate: input.paymentDate,
        method: input.method,
        counterpartyName: input.counterpartyName ?? null,
        category: input.category,
        batchId: input.batchId ?? null,
        farmId: input.farmId ?? null,
        notes: input.notes ?? null,
        createdBy: ctx.user?.id,
      }).$returningId();

      // Jeśli powiązana z fakturą — aktualizuj status
      if (input.invoiceId) {
        const [invoice] = await db.select().from(fin.invoices)
          .where(eq(fin.invoices.id, input.invoiceId)).limit(1);
        if (invoice) {
          const newPaid = num(invoice.paidAmount) + input.amount;
          await db.update(fin.invoices)
            .set({
              paidAmount: newPaid.toFixed(2),
              paymentStatus: newPaid >= num(invoice.grossAmount) ? "paid" : "partial",
            })
            .where(eq(fin.invoices.id, input.invoiceId));
        }
      }

      return { id };
    }),

  /** Potwierdź płatność */
  confirmPayment: protectedQuery
    .input(z.object({ paymentId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      await db.update(fin.payments)
        .set({
          isConfirmed: true,
          confirmedAt: new Date(),
          confirmedBy: ctx.user?.id,
        })
        .where(eq(fin.payments.id, input.paymentId));

      return { ok: true };
    }),

  /* ═══════════════════════════════════════════════════════════
     COUNTERPARTIES — kontrahenci
     ═══════════════════════════════════════════════════════════ */

  /** Lista kontrahentów */
  listCounterparties: publicQuery
    .input(z.object({
      type: z.enum(["supplier", "customer", "both"]).optional(),
      supplierCategory: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(500).default(100),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      let query = db.select().from(fin.counterparties)
        .where(and(eq(fin.counterparties.companyId, cid), eq(fin.counterparties.isActive, true)));

      if (input.type) query = query.where(eq(fin.counterparties.type, input.type));
      if (input.supplierCategory) query = query.where(eq(fin.counterparties.supplierCategory, input.supplierCategory));
      if (input.search) query = query.where(like(fin.counterparties.name, `%${input.search}%`));

      return await query.orderBy(fin.counterparties.name).limit(input.limit);
    }),

  /** Utwórz kontrahenta */
  createCounterparty: protectedQuery
    .input(z.object({
      name: z.string().min(1).max(255),
      type: z.enum(["supplier", "customer", "both"]),
      nip: z.string().max(16).optional(),
      regon: z.string().max(16).optional(),
      krs: z.string().max(16).optional(),
      address: z.string().optional(),
      city: z.string().max(100).optional(),
      postalCode: z.string().max(10).optional(),
      country: z.string().max(2).default("PL"),
      email: z.string().email().optional(),
      phone: z.string().max(20).optional(),
      website: z.string().max(255).optional(),
      bankAccount: z.string().max(34).optional(),
      bankName: z.string().max(255).optional(),
      supplierCategory: z.enum(["feed", "chicks", "medicine", "equipment", "transport", "veterinary", "other"]).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      const [{ id }] = await db.insert(fin.counterparties).values({
        companyId: cid,
        ...input,
      }).$returningId();

      return { id };
    }),

  /* ═══════════════════════════════════════════════════════════
     FIXED COSTS — koszty stałe
     ═══════════════════════════════════════════════════════════ */

  /** Lista kosztów stałych */
  listFixedCosts: publicQuery
    .input(z.object({
      farmId: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      let query = db.select().from(fin.fixedCosts)
        .where(eq(fin.fixedCosts.companyId, cid));

      if (input.farmId) query = query.where(eq(fin.fixedCosts.farmId, input.farmId));
      if (input.isActive !== undefined) query = query.where(eq(fin.fixedCosts.isActive, input.isActive));

      return await query.orderBy(fin.fixedCosts.name);
    }),

  /** Utwórz koszt stały */
  createFixedCost: protectedQuery
    .input(z.object({
      farmId: z.number().optional(),
      name: z.string().min(1).max(255),
      category: z.enum(["rent", "insurance", "depreciation", "salary", "utilities", "maintenance", "other"]),
      amount: z.number().min(0),
      currency: z.string().default("PLN"),
      period: z.enum(["monthly", "quarterly", "yearly"]),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      autoPost: z.boolean().default(false),
      autoPostDay: z.number().min(1).max(28).default(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      const [{ id }] = await db.insert(fin.fixedCosts).values({
        companyId: cid,
        farmId: input.farmId ?? null,
        name: input.name,
        category: input.category,
        amount: input.amount.toFixed(2),
        currency: input.currency,
        period: input.period,
        startDate: input.startDate,
        endDate: input.endDate ?? null,
        autoPost: input.autoPost,
        autoPostDay: input.autoPostDay,
      }).$returningId();

      return { id };
    }),

  /* ═══════════════════════════════════════════════════════════
     BUDGETS — budżetowanie
     ═══════════════════════════════════════════════════════════ */

  /** Pobierz budżet */
  getBudget: publicQuery
    .input(z.object({
      year: z.number(),
      month: z.number().min(0).max(12).default(0), // 0 = cały rok
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      const budgets = await db.select().from(fin.budgets)
        .where(and(
          eq(fin.budgets.companyId, cid),
          eq(fin.budgets.year, input.year),
          input.month > 0 ? eq(fin.budgets.month, input.month) : undefined
        ));

      // Oblicz rzeczywiste z faktur
      const actuals = await db.select({
        category: fin.invoices.category,
        total: sql<string>`SUM(CAST(${fin.invoices.grossAmount} AS DECIMAL(12,2)))`,
      })
        .from(fin.invoices)
        .where(and(
          eq(fin.invoices.companyId, cid),
          eq(fin.invoices.isActive, true),
          gte(fin.invoices.issueDate, `${input.year}-01-01`),
          lte(fin.invoices.issueDate, `${input.year}-12-31`)
        ))
        .groupBy(fin.invoices.category);

      const actualByCategory: Record<string, number> = {};
      for (const a of actuals) {
        actualByCategory[a.category ?? "other"] = num(a.total);
      }

      return {
        budgets: budgets.map(b => ({
          ...b,
          actualAmount: actualByCategory[b.category]?.toFixed(2) ?? "0.00",
          variance: (num(b.plannedAmount) - (actualByCategory[b.category] ?? 0)).toFixed(2),
        })),
        actualByCategory,
      };
    }),

  /** Ustaw budżet */
  setBudget: protectedQuery
    .input(z.object({
      year: z.number(),
      month: z.number().min(0).max(12),
      category: z.enum(["feed", "chicks", "medicine", "equipment", "energy", "labor", "transport", "veterinary", "insurance", "tax", "other", "revenue"]),
      plannedAmount: z.number().min(0),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      // Upsert
      const [existing] = await db.select().from(fin.budgets)
        .where(and(
          eq(fin.budgets.companyId, cid),
          eq(fin.budgets.year, input.year),
          eq(fin.budgets.month, input.month),
          eq(fin.budgets.category, input.category)
        ))
        .limit(1);

      if (existing) {
        await db.update(fin.budgets)
          .set({ plannedAmount: input.plannedAmount.toFixed(2), notes: input.notes })
          .where(eq(fin.budgets.id, existing.id));
        return { id: existing.id };
      } else {
        const [{ id }] = await db.insert(fin.budgets).values({
          companyId: cid,
          year: input.year,
          month: input.month,
          category: input.category,
          plannedAmount: input.plannedAmount.toFixed(2),
          notes: input.notes,
        }).$returningId();
        return { id };
      }
    }),

  /* ═══════════════════════════════════════════════════════════
     REPORTS — raporty finansowe
     ═══════════════════════════════════════════════════════════ */

  /** P&L — rachunek zysków i strat */
  getProfitLoss: publicQuery
    .input(z.object({
      year: z.number(),
      month: z.number().min(0).max(12).default(0), // 0 = cały rok
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      const dateFrom = input.month > 0 
        ? `${input.year}-${String(input.month).padStart(2, '0')}-01`
        : `${input.year}-01-01`;
      const dateTo = input.month > 0
        ? `${input.year}-${String(input.month).padStart(2, '0')}-31`
        : `${input.year}-12-31`;

      // Przychody
      const revenues = await db.select({
        category: fin.invoices.category,
        total: sql<string>`SUM(CAST(${fin.invoices.grossAmount} AS DECIMAL(12,2)))`,
        count: sql<number>`COUNT(*)`,
      })
        .from(fin.invoices)
        .where(and(
          eq(fin.invoices.companyId, cid),
          eq(fin.invoices.type, "sale"),
          eq(fin.invoices.isActive, true),
          gte(fin.invoices.issueDate, dateFrom),
          lte(fin.invoices.issueDate, dateTo)
        ))
        .groupBy(fin.invoices.category);

      // Koszty
      const costs = await db.select({
        category: fin.invoices.category,
        total: sql<string>`SUM(CAST(${fin.invoices.grossAmount} AS DECIMAL(12,2)))`,
        count: sql<number>`COUNT(*)`,
      })
        .from(fin.invoices)
        .where(and(
          eq(fin.invoices.companyId, cid),
          or(eq(fin.invoices.type, "purchase"), eq(fin.invoices.type, "cost")),
          eq(fin.invoices.isActive, true),
          gte(fin.invoices.issueDate, dateFrom),
          lte(fin.invoices.issueDate, dateTo)
        ))
        .groupBy(fin.invoices.category);

      const totalRevenue = revenues.reduce((a, r) => a + num(r.total), 0);
      const totalCosts = costs.reduce((a, c) => a + num(c.total), 0);

      return {
        period: { year: input.year, month: input.month, dateFrom, dateTo },
        revenues: revenues.map(r => ({
          category: r.category,
          amount: num(r.total).toFixed(2),
          count: Number(r.count),
        })),
        costs: costs.map(c => ({
          category: c.category,
          amount: num(c.total).toFixed(2),
          count: Number(c.count),
        })),
        summary: {
          totalRevenue: totalRevenue.toFixed(2),
          totalCosts: totalCosts.toFixed(2),
          grossProfit: (totalRevenue - totalCosts).toFixed(2),
          grossMarginPct: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue * 100).toFixed(1) : "0",
        },
      };
    }),

  /** Cash flow — przepływ środków */
  getCashFlow: publicQuery
    .input(z.object({
      year: z.number(),
      month: z.number().min(0).max(12).default(0),
    }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      const dateFrom = input.month > 0 
        ? `${input.year}-${String(input.month).padStart(2, '0')}-01`
        : `${input.year}-01-01`;
      const dateTo = input.month > 0
        ? `${input.year}-${String(input.month).padStart(2, '0')}-31`
        : `${input.year}-12-31`;

      // Płatności przychodzące
      const inflows = await db.select({
        category: fin.payments.category,
        total: sql<string>`SUM(CAST(${fin.payments.amount} AS DECIMAL(12,2)))`,
      })
        .from(fin.payments)
        .where(and(
          eq(fin.payments.companyId, cid),
          eq(fin.payments.type, "income"),
          eq(fin.payments.isConfirmed, true),
          gte(fin.payments.paymentDate, dateFrom),
          lte(fin.payments.paymentDate, dateTo)
        ))
        .groupBy(fin.payments.category);

      // Płatności wychodzące
      const outflows = await db.select({
        category: fin.payments.category,
        total: sql<string>`SUM(CAST(${fin.payments.amount} AS DECIMAL(12,2)))`,
      })
        .from(fin.payments)
        .where(and(
          eq(fin.payments.companyId, cid),
          eq(fin.payments.type, "expense"),
          eq(fin.payments.isConfirmed, true),
          gte(fin.payments.paymentDate, dateFrom),
          lte(fin.payments.paymentDate, dateTo)
        ))
        .groupBy(fin.payments.category);

      const totalInflow = inflows.reduce((a, i) => a + num(i.total), 0);
      const totalOutflow = outflows.reduce((a, o) => a + num(o.total), 0);

      return {
        period: { year: input.year, month: input.month },
        inflows: inflows.map(i => ({ category: i.category, amount: num(i.total).toFixed(2) })),
        outflows: outflows.map(o => ({ category: o.category, amount: num(o.total).toFixed(2) })),
        summary: {
          totalInflow: totalInflow.toFixed(2),
          totalOutflow: totalOutflow.toFixed(2),
          netCashFlow: (totalInflow - totalOutflow).toFixed(2),
        },
      };
    }),

  /** Aging — przeterminowane faktury */
  getAging: publicQuery
    .input(z.object({ asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      const asOf = input.asOfDate ?? new Date().toISOString().slice(0, 10);

      // Faktury nieopłacone lub częściowo opłacone
      const invoices = await db.select().from(fin.invoices)
        .where(and(
          eq(fin.invoices.companyId, cid),
          eq(fin.invoices.isActive, true),
          or(
            eq(fin.invoices.paymentStatus, "unpaid"),
            eq(fin.invoices.paymentStatus, "partial")
          )
        ));

      // Grupuj po przedziałach wieku
      const buckets = {
        current: { label: "Bieżące (nieprzeterminowane)", amount: 0, count: 0 },
        d1_30: { label: "1-30 dni", amount: 0, count: 0 },
        d31_60: { label: "31-60 dni", amount: 0, count: 0 },
        d61_90: { label: "61-90 dni", amount: 0, count: 0 },
        d90plus: { label: "90+ dni", amount: 0, count: 0 },
      };

      for (const inv of invoices) {
        const gross = num(inv.grossAmount);
        const paid = num(inv.paidAmount);
        const balance = gross - paid;

        if (balance <= 0) continue;

        const dueDate = new Date(inv.dueDate);
        const asOfDate = new Date(asOf);
        const daysOverdue = Math.floor((asOfDate.getTime() - dueDate.getTime()) / 86400000);

        if (daysOverdue <= 0) {
          buckets.current.amount += balance;
          buckets.current.count++;
        } else if (daysOverdue <= 30) {
          buckets.d1_30.amount += balance;
          buckets.d1_30.count++;
        } else if (daysOverdue <= 60) {
          buckets.d31_60.amount += balance;
          buckets.d31_60.count++;
        } else if (daysOverdue <= 90) {
          buckets.d61_90.amount += balance;
          buckets.d61_90.count++;
        } else {
          buckets.d90plus.amount += balance;
          buckets.d90plus.count++;
        }
      }

      const totalOutstanding = Object.values(buckets).reduce((a, b) => a + b.amount, 0);

      return {
        asOfDate: asOf,
        buckets: Object.entries(buckets).map(([key, val]) => ({
          key,
          ...val,
          amount: val.amount.toFixed(2),
          pctOfTotal: totalOutstanding > 0 ? (val.amount / totalOutstanding * 100).toFixed(1) : "0",
        })),
        summary: {
          totalOutstanding: totalOutstanding.toFixed(2),
          totalOverdue: (buckets.d1_30.amount + buckets.d31_60.amount + buckets.d61_90.amount + buckets.d90plus.amount).toFixed(2),
        },
      };
    }),

  /** Koszty per rzut — integracja z produkcją */
  getBatchCosts: publicQuery
    .input(z.object({ batchId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();

      // Faktury powiązane z rzutem
      const invoices = await db.select().from(fin.invoices)
        .where(and(eq(fin.invoices.batchId, input.batchId), eq(fin.invoices.isActive, true)));

      // Płatności bezpośrednie
      const payments = await db.select().from(fin.payments)
        .where(eq(fin.payments.batchId, input.batchId));

      // Koszty z modułu produkcji (tabela costs)
      const productionCosts = await db.select().from(s.costs)
        .where(eq(s.costs.batchId, input.batchId));

      // Agreguj
      const byCategory: Record<string, { invoices: number; payments: number; production: number; total: number }> = {};

      for (const inv of invoices) {
        const cat = inv.category ?? "other";
        if (!byCategory[cat]) byCategory[cat] = { invoices: 0, payments: 0, production: 0, total: 0 };
        byCategory[cat].invoices += num(inv.grossAmount);
        byCategory[cat].total += num(inv.grossAmount);
      }

      for (const pay of payments) {
        const cat = pay.category ?? "other";
        if (!byCategory[cat]) byCategory[cat] = { invoices: 0, payments: 0, production: 0, total: 0 };
        byCategory[cat].payments += num(pay.amount);
        byCategory[cat].total += num(pay.amount);
      }

      for (const cost of productionCosts) {
        const cat = cost.category ?? "other";
        if (!byCategory[cat]) byCategory[cat] = { invoices: 0, payments: 0, production: 0, total: 0 };
        byCategory[cat].production += num(cost.amount);
        byCategory[cat].total += num(cost.amount);
      }

      const totalAll = Object.values(byCategory).reduce((a, c) => a + c.total, 0);

      return {
        batchId: input.batchId,
        byCategory: Object.entries(byCategory).map(([category, data]) => ({
          category,
          ...data,
          invoices: data.invoices.toFixed(2),
          payments: data.payments.toFixed(2),
          production: data.production.toFixed(2),
          total: data.total.toFixed(2),
          pctOfTotal: totalAll > 0 ? (data.total / totalAll * 100).toFixed(1) : "0",
        })),
        summary: {
          total: totalAll.toFixed(2),
          fromInvoices: invoices.reduce((a, i) => a + num(i.grossAmount), 0).toFixed(2),
          fromPayments: payments.reduce((a, p) => a + num(p.amount), 0).toFixed(2),
          fromProduction: productionCosts.reduce((a, c) => a + num(c.amount), 0).toFixed(2),
        },
      };
    }),
});
