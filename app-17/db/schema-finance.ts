/**
 * FINANCE SCHEMA — faktury, płatności, koszty stałe/zmienne, raporty finansowe.
 */
import { mysqlTable, serial, bigint, varchar, text, timestamp, boolean, mysqlEnum, decimal, int, date } from "drizzle-orm/mysql-core";

/** Faktury — zakupy i sprzedaż */
export const invoices = mysqlTable("invoices", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }), // opcjonalnie — per ferma

  // Typ faktury
  type: mysqlEnum("type", ["purchase", "sale", "cost", "correction"]).notNull(),

  // Numeracja
  number: varchar("number", { length: 50 }).notNull().unique(),
  externalNumber: varchar("externalNumber", { length: 100 }), // numer faktury dostawcy/odbiorcy

  // Kontrahent
  counterpartyId: bigint("counterpartyId", { mode: "number", unsigned: true }),
  counterpartyName: varchar("counterpartyName", { length: 255 }).notNull(),
  counterpartyNip: varchar("counterpartyNip", { length: 16 }),
  counterpartyAddress: text("counterpartyAddress"),

  // Daty
  issueDate: date("issueDate").notNull(),
  saleDate: date("saleDate"),
  dueDate: date("dueDate").notNull(),
  paymentDate: date("paymentDate"),

  // Kwoty
  netAmount: decimal("netAmount", { precision: 12, scale: 2 }).notNull(),
  vatAmount: decimal("vatAmount", { precision: 12, scale: 2 }).notNull(),
  grossAmount: decimal("grossAmount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("PLN").notNull(),
  exchangeRate: decimal("exchangeRate", { precision: 10, scale: 4 }).default("1.0000"),

  // Status płatności
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "partial", "paid", "overdue"]).default("unpaid").notNull(),
  paidAmount: decimal("paidAmount", { precision: 12, scale: 2 }).default("0.00"),

  // Kategoria
  category: mysqlEnum("category", [
    "feed", "chicks", "medicine", "equipment", "energy", "labor", 
    "transport", "veterinary", "insurance", "tax", "other"
  ]).notNull(),

  // Powiązanie z produkcją
  batchId: bigint("batchId", { mode: "number", unsigned: true }),
  slaughterBatchId: bigint("slaughterBatchId", { mode: "number", unsigned: true }),

  // Status
  isActive: boolean("isActive").default(true).notNull(),

  // Notatki
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
});

/** Pozycje faktury */
export const invoiceItems = mysqlTable("invoiceItems", {
  id: serial("id").primaryKey(),
  invoiceId: bigint("invoiceId", { mode: "number", unsigned: true }).notNull(),

  // Produkt/usługa
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  unit: varchar("unit", { length: 20 }).default("szt.").notNull(),

  // Ilość i cena
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(),
  unitPrice: decimal("unitPrice", { precision: 12, scale: 4 }).notNull(),
  netAmount: decimal("netAmount", { precision: 12, scale: 2 }).notNull(),

  // VAT
  vatRate: decimal("vatRate", { precision: 4, scale: 2 }).notNull(), // 23.00, 8.00, 0.00
  vatAmount: decimal("vatAmount", { precision: 12, scale: 2 }).notNull(),
  grossAmount: decimal("grossAmount", { precision: 12, scale: 2 }).notNull(),

  // Kategoria
  category: varchar("category", { length: 50 }),
});

/** Płatności */
export const payments = mysqlTable("payments", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  invoiceId: bigint("invoiceId", { mode: "number", unsigned: true }),

  // Typ
  type: mysqlEnum("type", ["income", "expense", "transfer"]).notNull(),

  // Kwota
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("PLN").notNull(),

  // Data
  paymentDate: date("paymentDate").notNull(),

  // Metoda płatności
  method: mysqlEnum("method", ["cash", "bank_transfer", "card", "direct_debit", "other"]).notNull(),

  // Kontrahent
  counterpartyName: varchar("counterpartyName", { length: 255 }),

  // Kategoria
  category: mysqlEnum("category", [
    "feed", "chicks", "medicine", "equipment", "energy", "labor",
    "transport", "veterinary", "insurance", "tax", "other"
  ]).notNull(),

  // Powiązanie z produkcją
  batchId: bigint("batchId", { mode: "number", unsigned: true }),
  farmId: bigint("farmId", { mode: "number", unsigned: true }),

  // Status
  isConfirmed: boolean("isConfirmed").default(false).notNull(),
  confirmedAt: timestamp("confirmedAt"),
  confirmedBy: bigint("confirmedBy", { mode: "number", unsigned: true }),

  // Notatki
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: bigint("createdBy", { mode: "number", unsigned: true }),
});

/** Kontrahenci (dostawcy i odbiorcy) */
export const counterparties = mysqlTable("counterparties", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),

  // Dane podstawowe
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["supplier", "customer", "both"]).notNull(),

  // NIP / dane firmy
  nip: varchar("nip", { length: 16 }),
  regon: varchar("regon", { length: 16 }),
  krs: varchar("krs", { length: 16 }),

  // Adres
  address: text("address"),
  city: varchar("city", { length: 100 }),
  postalCode: varchar("postalCode", { length: 10 }),
  country: varchar("country", { length: 2 }).default("PL"),

  // Kontakt
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 20 }),
  website: varchar("website", { length: 255 }),

  // Dane bankowe
  bankAccount: varchar("bankAccount", { length: 34 }), // IBAN
  bankName: varchar("bankName", { length: 255 }),

  // Kategoria dostawcy
  supplierCategory: mysqlEnum("supplierCategory", [
    "feed", "chicks", "medicine", "equipment", "transport", "veterinary", "other"
  ]),

  // Status
  isActive: boolean("isActive").default(true).notNull(),

  // Notatki
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

/** Koszty stałe — czynsz, ubezpieczenie, amortyzacja */
export const fixedCosts = mysqlTable("fixedCosts", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }),

  // Nazwa
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", [
    "rent", "insurance", "depreciation", "salary", "utilities", "maintenance", "other"
  ]).notNull(),

  // Kwota
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("PLN").notNull(),

  // Okres
  period: mysqlEnum("period", ["monthly", "quarterly", "yearly"]).notNull(),

  // Daty
  startDate: date("startDate").notNull(),
  endDate: date("endDate"),

  // Automatyczne księgowanie
  autoPost: boolean("autoPost").default(false).notNull(),
  autoPostDay: int("autoPostDay").default(1), // dzień miesiąca

  // Status
  isActive: boolean("isActive").default(true).notNull(),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

/** Budżet — planowanie przychodów i kosztów */
export const budgets = mysqlTable("budgets", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),

  // Okres
  year: int("year").notNull(),
  month: int("month").notNull(), // 0 = cały rok

  // Kategoria
  category: mysqlEnum("category", [
    "feed", "chicks", "medicine", "equipment", "energy", "labor",
    "transport", "veterinary", "insurance", "tax", "other", "revenue"
  ]).notNull(),

  // Kwoty planowane
  plannedAmount: decimal("plannedAmount", { precision: 12, scale: 2 }).notNull(),

  // Rzeczywiste (aktualizowane automatycznie)
  actualAmount: decimal("actualAmount", { precision: 12, scale: 2 }).default("0.00"),

  // Notatki
  notes: text("notes"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

/** Kursy walut */
export const exchangeRates = mysqlTable("exchangeRates", {
  id: serial("id").primaryKey(),
  currency: varchar("currency", { length: 3 }).notNull(),
  date: date("date").notNull(),
  rate: decimal("rate", { precision: 10, scale: 4 }).notNull(), // PLN per 1 unit

  source: varchar("source", { length: 100 }), // NBP, ECB, manual

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
