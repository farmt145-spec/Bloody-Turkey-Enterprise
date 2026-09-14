/**
 * SLAUGHTER EDI — integracja z systemami ubojni przez API/EDI.
 * 
 * Obsługiwane formaty:
 * - JSON REST (nowoczesne systemy)
 * - EDIFACT (standard UE)
 * - CSV (legacy)
 * 
 * Przepływ:
 * 1. BTE wysyła zlecenie uboju → ubojnia potwierdza
 * 2. Ubojnia wysyła wyniki (waga żywa, waga tuszki, klasyfikacja)
 * 3. Automatyczne rozliczenie + faktura
 */
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createRouter, publicQuery, protectedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import * as s from "@db/schema";

// Konfiguracja EDI per ubojnia
interface EdiConfig {
  slaughterhouseId: number;
  name: string;
  format: "json" | "edifact" | "csv";
  endpoint: string; // URL API lub email dla EDI
  authType: "apikey" | "oauth2" | "basic";
  authConfig: Record<string, string>;
  isActive: boolean;
}

export const slaughterEdiRouter = createRouter({
  /** Wyślij zlecenie uboju do ubojni */
  sendOrder: protectedQuery
    .input(z.object({
      slaughterBatchId: z.number(),
      slaughterhouseId: z.number(),
      scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      estimatedCount: z.number().min(1),
      estimatedWeightKg: z.number().min(1),
      specialInstructions: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();

      // Pobierz partię ubojową
      const [sb] = await db.select().from(s.slaughterBatches)
        .where(eq(s.slaughterBatches.id, input.slaughterBatchId)).limit(1);
      if (!sb) throw new Error("Nie znaleziono partii ubojowej");

      // Pobierz rzut
      const [batch] = await db.select().from(s.batches)
        .where(eq(s.batches.id, sb.batchId)).limit(1);
      if (!batch) throw new Error("Nie znaleziono rzutu");

      // Pobierz konfigurację EDI ubojni
      const ediConfig = await getEdiConfig(input.slaughterhouseId);
      if (!ediConfig) throw new Error("Brak konfiguracji EDI dla tej ubojni");

      // Przygotuj zlecenie
      const order = {
        orderId: `BTE-${sb.code}`,
        orderDate: new Date().toISOString(),
        scheduledDate: input.scheduledDate,
        supplier: {
          companyId: sb.companyId,
          farmId: sb.farmId,
          batchCode: batch.code,
        },
        birds: {
          estimatedCount: input.estimatedCount,
          estimatedWeightKg: input.estimatedWeightKg,
          geneticLine: batch.geneticLine,
          sex: batch.sex,
          ageDays: Math.floor((Date.now() - new Date(batch.startDate).getTime()) / 86400000),
        },
        specialInstructions: input.specialInstructions,
      };

      // Wyślij w odpowiednim formacie
      let result;
      switch (ediConfig.format) {
        case "json":
          result = await sendJsonOrder(ediConfig, order);
          break;
        case "edifact":
          result = await sendEdifactOrder(ediConfig, order);
          break;
        case "csv":
          result = await sendCsvOrder(ediConfig, order);
          break;
      }

      // Zapisz log EDI
      await db.insert(s.slaughterEvents).values({
        slaughterBatchId: input.slaughterBatchId,
        type: "edi_order_sent",
        payload: JSON.stringify({ order, result }),
        createdBy: ctx.user?.id,
      });

      return {
        ok: true,
        orderId: order.orderId,
        ediFormat: ediConfig.format,
        response: result,
      };
    }),

  /** Odbierz wyniki uboju (webhook od ubojni) */
  receiveResults: publicQuery
    .input(z.object({
      // Autentykacja webhooka
      apiKey: z.string(),

      // Dane wynikowe
      orderId: z.string(), // BTE-UB-2024-000001
      slaughteredAt: z.string().datetime(),

      // Przyjęcie
      receivedCount: z.number().min(0),
      receivedWeightKg: z.number().min(0),
      rejectedCount: z.number().min(0).default(0),
      rejectionReason: z.string().optional(),

      // Wynik uboju
      carcassCount: z.number().min(0),
      carcassWeightKg: z.number().min(0),
      offalWeightKg: z.number().min(0).default(0),
      wasteWeightKg: z.number().min(0).default(0),

      // Klasyfikacja tuszek
      classifications: z.array(z.object({
        class: z.string(), // A, B, C, D
        count: z.number(),
        weightKg: z.number(),
        pricePerKg: z.number(),
      })).optional(),

      // Rozliczenie
      pricePerKg: z.number().min(0),
      bonuses: z.number().default(0),
      deductions: z.number().default(0),
      currency: z.string().default("PLN"),

      // Weterynaria
      vetInspection: z.object({
        passed: z.boolean(),
        notes: z.string().optional(),
        inspectorName: z.string(),
      }),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // Weryfikuj API key
      // TODO: sprawdzić apiKey w konfiguracji

      // Znajdź partię ubojową po orderId
      const code = input.orderId.replace("BTE-", "");
      const [sb] = await db.select().from(s.slaughterBatches)
        .where(eq(s.slaughterBatches.code, code)).limit(1);
      if (!sb) throw new Error(`Nie znaleziono partii: ${input.orderId}`);

      // Zapisz przyjęcie
      await db.insert(s.slaughterReceptions).values({
        slaughterBatchId: sb.id,
        receivedCount: input.receivedCount,
        liveWeightKg: input.receivedWeightKg.toFixed(1),
        rejectedCount: input.rejectedCount,
        rejectionReason: input.rejectionReason,
        receivedAt: new Date(input.slaughteredAt),
      });

      // Zapisz wynik uboju
      const yieldPct = input.receivedWeightKg > 0 
        ? (input.carcassWeightKg / input.receivedWeightKg) * 100 
        : 0;

      await db.insert(s.slaughterResults).values({
        slaughterBatchId: sb.id,
        carcassCount: input.carcassCount,
        carcassWeightKg: input.carcassWeightKg.toFixed(1),
        yieldPct: yieldPct.toFixed(2),
        slaughteredAt: new Date(input.slaughteredAt),
      });

      // Zapisz klasyfikacje
      if (input.classifications) {
        for (const cls of input.classifications) {
          await db.insert(s.carcassClassifications).values({
            slaughterBatchId: sb.id,
            class: cls.class,
            count: cls.count,
            weightKg: cls.weightKg.toFixed(1),
            pricePerKg: cls.pricePerKg.toFixed(2),
          });
        }
      }

      // Oblicz rozliczenie
      const grossAmount = input.carcassWeightKg * input.pricePerKg;
      const netAmount = grossAmount + input.bonuses - input.deductions;

      await db.insert(s.slaughterSettlements).values({
        slaughterBatchId: sb.id,
        grossAmount: grossAmount.toFixed(2),
        bonuses: input.bonuses.toFixed(2),
        deductions: input.deductions.toFixed(2),
        netAmount: netAmount.toFixed(2),
        currency: input.currency,
        settledAt: new Date(),
      });

      // Zapisz wydarzenie EDI
      await db.insert(s.slaughterEvents).values({
        slaughterBatchId: sb.id,
        type: "edi_results_received",
        payload: JSON.stringify(input),
      });

      // Automatycznie zaktualizuj status rzutu
      await db.update(s.batches)
        .set({ status: "slaughtered", soldCount: input.receivedCount })
        .where(eq(s.batches.id, sb.batchId));

      return {
        ok: true,
        settlement: {
          grossAmount: grossAmount.toFixed(2),
          netAmount: netAmount.toFixed(2),
          yieldPct: yieldPct.toFixed(2),
        },
      };
    }),

  /** Status integracji EDI */
  getIntegrationStatus: publicQuery
    .input(z.object({ slaughterhouseId: z.number().optional() }))
    .query(async ({ input, ctx }) => {
      const db = getDb();
      const cid = ctx.companyId;
      if (!cid) throw new Error("Wymagany companyId");

      // Pobierz ostatnie zlecenia EDI
      let query = db.select().from(s.slaughterEvents)
        .where(eq(s.slaughterEvents.type, "edi_order_sent"));

      // TODO: filtrować po companyId przez join

      const events = await query.limit(50);

      return {
        totalOrders: events.length,
        recentOrders: events.slice(0, 10).map(e => ({
          id: e.id,
          type: e.type,
          createdAt: e.createdAt,
          payload: JSON.parse(e.payload ?? "{}"),
        })),
        // TODO: dodać statystyki błędów, czasów odpowiedzi
      };
    }),
});

// Helper functions

async function getEdiConfig(slaughterhouseId: number): Promise<EdiConfig | null> {
  // TODO: pobrać z bazy tabela slaughterhouses
  // Na razie mock
  return {
    slaughterhouseId,
    name: "Ubojnia Demo",
    format: "json",
    endpoint: "https://api.slaughterhouse-demo.pl/orders",
    authType: "apikey",
    authConfig: { apiKey: process.env.SLAUGHTERHOUSE_API_KEY ?? "" },
    isActive: true,
  };
}

async function sendJsonOrder(config: EdiConfig, order: any) {
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.authConfig.apiKey}`,
    },
    body: JSON.stringify(order),
  });

  if (!response.ok) {
    throw new Error(`EDI error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

async function sendEdifactOrder(config: EdiConfig, order: any) {
  // Generuj EDIFACT D96A ORDERS
  const edifact = generateEdifactOrder(order);

  // Wyślij jako POST lub email
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/edifact",
      "Authorization": `Bearer ${config.authConfig.apiKey}`,
    },
    body: edifact,
  });

  return { edifact, status: response.status };
}

async function sendCsvOrder(config: EdiConfig, order: any) {
  const csv = generateCsvOrder(order);

  // Wyślij jako email lub POST
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/csv",
      "Authorization": `Bearer ${config.authConfig.apiKey}`,
    },
    body: csv,
  });

  return { csv, status: response.status };
}

function generateEdifactOrder(order: any): string {
  // Uproszczony EDIFACT D96A ORDERS
  return `UNH+1+ORDERS:D:96A:UN:EAN008'
BGM+220+${order.orderId}+9'
DTM+137:${order.orderDate}:203'
DTM+63:${order.scheduledDate}:102'
NAD+SU+${order.supplier.companyId}::9'
NAD+BY+${order.supplier.farmId}::9'
LIN+1++${order.birds.geneticLine}:EN'
QTY+21:${order.birds.estimatedCount}'
QTY+40:${order.birds.estimatedWeightKg}:KGM'
UNT+10+1'`;
}

function generateCsvOrder(order: any): string {
  return `order_id,order_date,scheduled_date,estimated_count,estimated_weight_kg,genetic_line,sex,age_days
${order.orderId},${order.orderDate},${order.scheduledDate},${order.birds.estimatedCount},${order.birds.estimatedWeightKg},${order.birds.geneticLine},${order.birds.sex},${order.birds.ageDays}`;
}
