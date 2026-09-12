import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  decimal,
  boolean,
  date,
  json,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  password: varchar("password", { length: 255 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
  userRole: mysqlEnum("userRole", ["worker", "manager", "admin"]).notNull().default("worker"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;


export const userInvites = mysqlTable("user_invites", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  role: mysqlEnum("role", ["worker", "manager", "admin"]).notNull().default("worker"),
  token: varchar("token", { length: 64 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "cancelled"]).default("pending").notNull(),
  message: text("message"),
  sentAt: timestamp("sentAt").defaultNow(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type UserInvite = typeof userInvites.$inferSelect;
export type InsertUserInvite = typeof userInvites.$inferInsert;

/* ============================================================
   AUDIT TRAIL — globalny, każda tabela biznesowa
   ============================================================ */

export const auditLog = mysqlTable("audit_log", {
  id: serial("id").primaryKey(),
  tableName: varchar("tableName", { length: 64 }).notNull(),
  recordId: bigint("recordId", { mode: "number", unsigned: true }).notNull(),
  action: mysqlEnum("action", ["create", "update", "delete"]).notNull(),
  oldValues: json("oldValues"),
  newValues: json("newValues"),
  author: varchar("author", { length: 255 }).notNull().default("system"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ============================================================
   ORGANIZACJA — multi-company (multi-tenant)
   ============================================================ */

const base = {
  status: mysqlEnum("status", ["active", "archived"]).notNull().default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: varchar("updatedBy", { length: 255 }).notNull().default("system"),
};

/** Wariant bez statusu — dla tabel z własnym cyklem statusów (ubojnia). */
const baseNoStatus = {
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: varchar("updatedBy", { length: 255 }).notNull().default("system"),
};

export const companies = mysqlTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  countryCode: varchar("countryCode", { length: 2 }).notNull(),
  baseCurrency: varchar("baseCurrency", { length: 3 }).notNull().default("EUR"),
  /* Wybór gospodarstwa — firma użytkownika vs dane demonstracyjne */
  isDemo: boolean("isDemo").notNull().default(false),
  address: varchar("address", { length: 255 }),
  nip: varchar("nip", { length: 16 }),
  contact: varchar("contact", { length: 255 }),
  declaredHouses: int("declaredHouses").notNull().default(0),
  ...base,
});

export const geneticLines = mysqlTable("genetic_lines", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  supplier: varchar("supplier", { length: 255 }),
  notes: text("notes"),
  ...base,
});

/* Normy żywieniowe linii genetycznych — per linia × faza wieku.
   Wartości domyślne to normy otwarte (obowiązujące w systemie),
   firma może je nadpisać własnymi. */
export const geneticLineNorms = mysqlTable("genetic_line_norms", {
  id: serial("id").primaryKey(),
  geneticLineId: bigint("geneticLineId", { mode: "number", unsigned: true }).notNull(),
  phaseKey: varchar("phaseKey", { length: 32 }).notNull(), // prestarter|starter|grower1|grower2|finisher1|finisher2
  dayFrom: int("dayFrom").notNull(),
  dayTo: int("dayTo").notNull(),
  proteinPct: decimal("proteinPct", { precision: 5, scale: 2 }).notNull(),
  energyKcal: int("energyKcal").notNull(),
  lysinePct: decimal("lysinePct", { precision: 5, scale: 3 }).notNull(),
  methioninePct: decimal("methioninePct", { precision: 5, scale: 3 }).notNull(),
  feedPerBirdG: int("feedPerBirdG").notNull().default(0), // dobowe pobranie na sztukę
  targetWeightG: int("targetWeightG").notNull().default(0), // docelowa masa na koniec fazy
  ...base,
});

export const farms = mysqlTable("farms", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  countryCode: varchar("countryCode", { length: 2 }).notNull(),
  city: varchar("city", { length: 255 }).notNull(),
  lat: decimal("lat", { precision: 9, scale: 5 }).notNull(),
  lng: decimal("lng", { precision: 9, scale: 5 }).notNull(),
  capacity: int("capacity").notNull().default(0),
  isDemo: boolean("isDemo").notNull().default(false),
  ...base,
});

export const houses = mysqlTable("houses", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  houseType: mysqlEnum("houseType", ["brooder", "finisher"]).notNull(),
  areaM2: decimal("areaM2", { precision: 10, scale: 1 }).notNull(),
  maxDensityKgM2: decimal("maxDensityKgM2", { precision: 5, scale: 1 })
    .notNull()
    .default("42.0"),
  ...base,
});

export const sectors = mysqlTable("sectors", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  areaM2: decimal("areaM2", { precision: 10, scale: 1 }).notNull(),
  ...base,
});

/* ============================================================
   PRODUKCJA
   ============================================================ */

export const batches = mysqlTable("batches", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  sectorId: bigint("sectorId", { mode: "number", unsigned: true }),
  geneticLineId: bigint("geneticLineId", { mode: "number", unsigned: true }),
  code: varchar("code", { length: 64 }).notNull(),
  geneticLine: varchar("geneticLine", { length: 128 }).notNull(),
  sex: mysqlEnum("sex", ["toms", "hens", "mixed"]).notNull(),
  chickSupplier: varchar("chickSupplier", { length: 255 }),
  chickPrice: decimal("chickPrice", { precision: 8, scale: 3 })
    .notNull()
    .default("0.000"),
  startDate: date("startDate", { mode: "string" }).notNull(),
  plannedEndDate: date("plannedEndDate", { mode: "string" }),
  initialCount: int("initialCount").notNull(),
  currentCount: int("currentCount").notNull(),
  soldCount: int("soldCount").notNull().default(0),
  status: mysqlEnum("status", ["active", "closed", "planned", "archived"])
    .notNull()
    .default("active"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: varchar("updatedBy", { length: 255 }).notNull().default("system"),
});

export const weighings = mysqlTable("weighings", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  weighedAt: timestamp("weighedAt").notNull(),
  dayAge: int("dayAge").notNull(),
  sampleSize: int("sampleSize").notNull(),
  avgWeightG: int("avgWeightG").notNull(),
  medianG: int("medianG"),
  stdDevG: int("stdDevG"),
  minG: int("minG"),
  maxG: int("maxG"),
  cv: decimal("cv", { precision: 5, scale: 2 }),
  operator: varchar("operator", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const selects = mysqlTable("selects", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  criteria: varchar("criteria", { length: 255 }).notNull(),
  origin: mysqlEnum("origin", ["manual", "dynamic"]).notNull().default("manual"),
  birdCount: int("birdCount").notNull(),
  avgWeightG: int("avgWeightG").notNull(),
  fcr: decimal("fcr", { precision: 5, scale: 3 }),
  mortalityPct: decimal("mortalityPct", { precision: 5, scale: 2 }),
  waterIntakeMl: int("waterIntakeMl"),
  status: mysqlEnum("status", ["ok", "warning", "critical"])
    .notNull()
    .default("ok"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const mortalities = mysqlTable("mortalities", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  count: int("count").notNull(),
  cause: varchar("cause", { length: 255 }),
});

export const feedUsages = mysqlTable("feed_usages", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  kg: decimal("kg", { precision: 12, scale: 1 }).notNull(),
  recipeId: bigint("recipeId", { mode: "number", unsigned: true }),
});

export const litter = mysqlTable("litter", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  material: varchar("material", { length: 128 }).notNull(),
  thicknessCm: decimal("thicknessCm", { precision: 4, scale: 1 }).notNull(),
  moisturePct: decimal("moisturePct", { precision: 5, scale: 2 }),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull().default("0"),
  /* Ścielenie w belach (obchód) — liczba bel i rozmiar beli */
  balesCount: int("balesCount"),
  baleKg: decimal("baleKg", { precision: 8, scale: 1 }),
  laidAt: date("laidAt", { mode: "string" }).notNull(),
  ...base,
});

/* ============================================================
   DZIENNIK PRODUKCJI — dzienne wpisy (upadki, woda, pasza, środowisko)
   ============================================================ */

export const dailyLogs = mysqlTable("daily_logs", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  mortality: int("mortality").notNull().default(0),
  culls: int("culls").notNull().default(0),
  waterLiters: decimal("waterLiters", { precision: 12, scale: 1 }),
  feedKg: decimal("feedKg", { precision: 12, scale: 1 }),
  tempC: decimal("tempC", { precision: 4, scale: 1 }),
  humidityPct: decimal("humidityPct", { precision: 4, scale: 1 }),
  ammoniaPpm: decimal("ammoniaPpm", { precision: 5, scale: 1 }),
  note: varchar("note", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  updatedBy: varchar("updatedBy", { length: 255 }).notNull().default("system"),
});

/* ============================================================
   PROGRAM ŻYWIENIA + WYDANIA PASZY
   ============================================================ */

export const feedPrograms = mysqlTable("feed_programs", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sex: mysqlEnum("sex", ["toms", "hens", "mixed"]).notNull().default("mixed"),
  ...base,
});

export const feedProgramStages = mysqlTable("feed_program_stages", {
  id: serial("id").primaryKey(),
  programId: bigint("programId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  dayFrom: int("dayFrom").notNull(),
  dayTo: int("dayTo").notNull(),
  recipeId: bigint("recipeId", { mode: "number", unsigned: true }),
  proteinTargetPct: decimal("proteinTargetPct", { precision: 5, scale: 2 }),
  energyTargetKcal: int("energyTargetKcal"),
  feedPerBirdG: int("feedPerBirdG"),
});

export const feedDeliveries = mysqlTable("feed_deliveries", {
  id: serial("id").primaryKey(),
  siloId: bigint("siloId", { mode: "number", unsigned: true }).notNull(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  recipeId: bigint("recipeId", { mode: "number", unsigned: true }),
  day: date("day", { mode: "string" }).notNull(),
  kg: decimal("kg", { precision: 12, scale: 1 }).notNull(),
  ...base,
});

/* ============================================================
   TRANSFERY — pełna genealogia stad
   ============================================================ */

export const transfers = mysqlTable("transfers", {
  id: serial("id").primaryKey(),
  sourceBatchId: bigint("sourceBatchId", { mode: "number", unsigned: true }).notNull(),
  targetBatchId: bigint("targetBatchId", { mode: "number", unsigned: true }).notNull(),
  birdCount: int("birdCount").notNull(),
  avgWeightG: int("avgWeightG"),
  transportMortality: int("transportMortality").notNull().default(0),
  transferDate: timestamp("transferDate").notNull(),
  durationMin: int("durationMin"),
  driver: varchar("driver", { length: 255 }),
  vehicle: varchar("vehicle", { length: 255 }),
  signatureFrom: varchar("signatureFrom", { length: 255 }),
  signatureTo: varchar("signatureTo", { length: 255 }),
  documentNo: varchar("documentNo", { length: 64 }).notNull(),
  ...base,
});

/* ============================================================
   HARMONOGRAM PRODUKCJI (Workflow Engine)
   ============================================================ */

export const scheduleEvents = mysqlTable("schedule_events", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  eventType: mysqlEnum("eventType", [
    "placement", "vaccination", "weighing", "feedChange", "litter",
    "treatment", "sampling", "washing", "disinfection", "housePrep", "sale",
  ]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  done: boolean("done").notNull().default(false),
  doneAt: timestamp("doneAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* ============================================================
   ŻYWIENIE + MAGAZYN
   ============================================================ */

export const feedIngredients = mysqlTable("feed_ingredients", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }),
  name: varchar("name", { length: 255 }).notNull(),
  countryCode: varchar("countryCode", { length: 2 }).notNull(),
  pricePerTon: decimal("pricePerTon", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  proteinPct: decimal("proteinPct", { precision: 5, scale: 2 }).notNull(),
  energyKcal: int("energyKcal").notNull(),
  lysinePct: decimal("lysinePct", { precision: 5, scale: 3 }).notNull().default("0"),
  methioninePct: decimal("methioninePct", { precision: 5, scale: 3 })
    .notNull()
    .default("0"),
  fiberPct: decimal("fiberPct", { precision: 5, scale: 2 }).notNull().default("0"),
  fatPct: decimal("fatPct", { precision: 5, scale: 2 }).notNull().default("0"),
  calciumPct: decimal("calciumPct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  phosphorusPct: decimal("phosphorusPct", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  stockTons: decimal("stockTons", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  /* Tom III — rozszerzona karta surowca */
  moisturePct: decimal("moisturePct", { precision: 5, scale: 2 }).notNull().default("12"),
  ashPct: decimal("ashPct", { precision: 5, scale: 2 }).notNull().default("0"),
  starchPct: decimal("starchPct", { precision: 5, scale: 2 }).notNull().default("0"),
  cystinePct: decimal("cystinePct", { precision: 5, scale: 3 }).notNull().default("0"),
  threoninePct: decimal("threoninePct", { precision: 5, scale: 3 }).notNull().default("0"),
  tryptophanPct: decimal("tryptophanPct", { precision: 5, scale: 3 }).notNull().default("0"),
  argininePct: decimal("argininePct", { precision: 5, scale: 3 }).notNull().default("0"),
  sodiumPct: decimal("sodiumPct", { precision: 5, scale: 3 }).notNull().default("0"),
  producer: varchar("producer", { length: 255 }),
  code: varchar("code", { length: 32 }),
  extraParams: json("extraParams"), // witaminy, mikroelementy, mykotoksyny itd. wg Tom III
  ...base,
});

export const recipes = mysqlTable("recipes", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }),
  name: varchar("name", { length: 255 }).notNull(),
  ageGroup: varchar("ageGroup", { length: 64 }).notNull(),
  strategy: mysqlEnum("strategy", ["cheapest", "maxGrowth", "balanced"]).notNull(),
  costPerTon: decimal("costPerTon", { precision: 10, scale: 2 }).notNull(),
  proteinPct: decimal("proteinPct", { precision: 5, scale: 2 }).notNull(),
  energyKcal: int("energyKcal").notNull(),
  lysinePct: decimal("lysinePct", { precision: 5, scale: 3 }).notNull(),
  explanation: text("explanation"),
  /* Tom III — metadane receptury */
  version: int("version").notNull().default(1),
  author: varchar("author", { length: 128 }).notNull().default("system"),
  status: mysqlEnum("status", ["draft", "active", "archived"]).notNull().default("active"),
  sex: mysqlEnum("sex", ["toms", "hens", "mixed"]).notNull().default("mixed"),
  season: mysqlEnum("season", ["winter", "summer", "all"]).notNull().default("all"),
  genetics: varchar("genetics", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const recipeItems = mysqlTable("recipe_items", {
  id: serial("id").primaryKey(),
  recipeId: bigint("recipeId", { mode: "number", unsigned: true }).notNull(),
  ingredientId: bigint("ingredientId", { mode: "number", unsigned: true }).notNull(),
  percent: decimal("percent", { precision: 5, scale: 2 }).notNull(),
});

export const warehouses = mysqlTable("warehouses", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  capacityTons: decimal("capacityTons", { precision: 10, scale: 1 }).notNull(),
  ...base,
});

export const silos = mysqlTable("silos", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  capacityTons: decimal("capacityTons", { precision: 10, scale: 1 }).notNull(),
  currentTons: decimal("currentTons", { precision: 10, scale: 2 }).notNull().default("0"),
  recipeId: bigint("recipeId", { mode: "number", unsigned: true }),
  ...base,
});

/* ============================================================
   ZDROWIE
   ============================================================ */

export const treatments = mysqlTable("treatments", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  startedAt: date("startedAt", { mode: "string" }).notNull(),
  product: varchar("product", { length: 255 }).notNull(),
  activeSubstance: varchar("activeSubstance", { length: 255 }).notNull(),
  dose: varchar("dose", { length: 128 }).notNull(),
  reason: varchar("reason", { length: 255 }),
  withdrawalDays: int("withdrawalDays").notNull().default(0),
  vet: varchar("vet", { length: 255 }),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const vaccinations = mysqlTable("vaccinations", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  vaccine: varchar("vaccine", { length: 255 }).notNull(),
  method: varchar("method", { length: 128 }),
  done: boolean("done").notNull().default(false),
});

/* ============================================================
   EKONOMIA
   ============================================================ */

export const costs = mysqlTable("costs", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  category: mysqlEnum("category", [
    "chicks", "feed", "vet", "energy", "litter", "labor", "transport", "other",
  ]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  day: date("day", { mode: "string" }).notNull(),
  note: varchar("note", { length: 255 }),
});

export const sales = mysqlTable("sales", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  birdCount: int("birdCount").notNull(),
  totalWeightKg: decimal("totalWeightKg", { precision: 12, scale: 1 }).notNull(),
  pricePerKg: decimal("pricePerKg", { precision: 6, scale: 3 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  buyer: varchar("buyer", { length: 255 }),
});


/* ============================================================
   ERP — łańcuch dostaw, finanse, laboratorium, klimat, energia,
   utrzymanie ruchu, bioasekuracja, dokumenty, zadania, komunikacja
   ============================================================ */

export const suppliers = mysqlTable("suppliers", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["feed", "chicks", "medicine", "equipment", "energy", "transport", "other"]).notNull(),
  countryCode: varchar("countryCode", { length: 2 }),
  nip: varchar("nip", { length: 32 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 32 }),
  rating: int("rating").notNull().default(3),
  ...base,
});

export const purchaseOrders = mysqlTable("purchase_orders", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }).notNull(),
  number: varchar("number", { length: 64 }).notNull(),
  item: varchar("item", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 14, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 16 }).notNull().default("kg"),
  priceNet: decimal("priceNet", { precision: 14, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  orderDate: date("orderDate", { mode: "string" }).notNull(),
  deliveryDate: date("deliveryDate", { mode: "string" }),
  orderStatus: mysqlEnum("orderStatus", ["draft", "sent", "confirmed", "delivered", "cancelled"]).notNull().default("draft"),
  ...base,
});

export const contracts = mysqlTable("contracts", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  party: varchar("party", { length: 255 }).notNull(),
  kind: mysqlEnum("kind", ["purchase", "sale", "service", "lease"]).notNull(),
  number: varchar("number", { length: 64 }).notNull(),
  validFrom: date("validFrom", { mode: "string" }).notNull(),
  validTo: date("validTo", { mode: "string" }),
  valueEur: decimal("valueEur", { precision: 14, scale: 2 }),
  terms: text("terms"),
  ...base,
});

export const invoices = mysqlTable("invoices", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  number: varchar("number", { length: 64 }).notNull(),
  kind: mysqlEnum("kind", ["sale", "purchase"]).notNull(),
  counterparty: varchar("counterparty", { length: 255 }).notNull(),
  issueDate: date("issueDate", { mode: "string" }).notNull(),
  dueDate: date("dueDate", { mode: "string" }),
  amountNet: decimal("amountNet", { precision: 14, scale: 2 }).notNull(),
  vatPct: int("vatPct").notNull().default(23),
  currency: varchar("currency", { length: 3 }).notNull().default("EUR"),
  paid: boolean("paid").notNull().default(false),
  batchId: bigint("batchId", { mode: "number", unsigned: true }),
  ...base,
});

export const medicines = mysqlTable("medicines", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  substance: varchar("substance", { length: 255 }),
  form: varchar("form", { length: 64 }),
  stockQty: decimal("stockQty", { precision: 12, scale: 2 }).notNull().default("0"),
  unit: varchar("unit", { length: 16 }).notNull().default("ml"),
  expiryDate: date("expiryDate", { mode: "string" }),
  minStock: decimal("minStock", { precision: 12, scale: 2 }).notNull().default("0"),
  pricePerUnit: decimal("pricePerUnit", { precision: 10, scale: 2 }),
  ...base,
});

export const labResults = mysqlTable("lab_results", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }),
  sampleType: mysqlEnum("sampleType", ["blood", "swab", "water", "feed", "litter", "carcass"]).notNull(),
  testName: varchar("testName", { length: 255 }).notNull(),
  resultValue: varchar("resultValue", { length: 255 }).notNull(),
  unit: varchar("unit", { length: 32 }),
  refRange: varchar("refRange", { length: 64 }),
  verdict: mysqlEnum("verdict", ["ok", "warning", "critical"]).notNull().default("ok"),
  labName: varchar("labName", { length: 255 }),
  day: date("day", { mode: "string" }).notNull(),
  ...base,
});

export const climateLogs = mysqlTable("climate_logs", {
  id: serial("id").primaryKey(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }).notNull(),
  ts: timestamp("ts").defaultNow().notNull(),
  tempC: decimal("tempC", { precision: 4, scale: 1 }),
  humidityPct: decimal("humidityPct", { precision: 4, scale: 1 }),
  co2Ppm: int("co2Ppm"),
  ammoniaPpm: decimal("ammoniaPpm", { precision: 5, scale: 1 }),
  ventilationPct: int("ventilationPct"),
  source: varchar("source", { length: 32 }).notNull().default("sensor"),
});

export const energyLogs = mysqlTable("energy_logs", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  kind: mysqlEnum("kind", ["power", "gas", "water", "fuel"]).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  consumption: decimal("consumption", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 16 }).notNull(),
  costEur: decimal("costEur", { precision: 12, scale: 2 }).notNull(),
  ...base,
});

export const maintenanceTickets = mysqlTable("maintenance_tickets", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  houseId: bigint("houseId", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: mysqlEnum("priority", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  ticketStatus: mysqlEnum("ticketStatus", ["open", "in_progress", "done", "cancelled"]).notNull().default("open"),
  reportedBy: varchar("reportedBy", { length: 255 }).notNull().default("system"),
  dueDate: date("dueDate", { mode: "string" }),
  ...base,
});

export const biosecurityChecks = mysqlTable("biosecurity_checks", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  area: varchar("area", { length: 128 }).notNull(),
  checkName: varchar("checkName", { length: 255 }).notNull(),
  passed: boolean("passed").notNull().default(true),
  score: int("score"),
  inspector: varchar("inspector", { length: 255 }).notNull().default("system"),
  note: varchar("note", { length: 500 }),
  ...base,
});

export const documents = mysqlTable("documents", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["vet", "contract", "invoice", "protocol", "certificate", "other"]).notNull().default("other"),
  reference: varchar("reference", { length: 128 }),
  docDate: date("docDate", { mode: "string" }).notNull(),
  url: varchar("url", { length: 500 }),
  note: varchar("note", { length: 500 }),
  ...base,
});

export const tasks = mysqlTable("tasks", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  assignee: varchar("assignee", { length: 255 }),
  dueDate: date("dueDate", { mode: "string" }),
  priority: mysqlEnum("priority", ["low", "medium", "high"]).notNull().default("medium"),
  done: boolean("done").notNull().default(false),
  ...base,
});

export const messages = mysqlTable("messages", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  author: varchar("author", { length: 255 }).notNull().default("system"),
  channel: varchar("channel", { length: 64 }).notNull().default("general"),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const notifications = mysqlTable("notifications", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }),
  severity: mysqlEnum("severity", ["info", "warning", "critical"]).notNull().default("info"),
  title: varchar("title", { length: 255 }).notNull(),
  body: varchar("body", { length: 500 }),
  link: varchar("link", { length: 255 }),
  read: boolean("read_flag").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const hatcheryBatches = mysqlTable("hatchery_batches", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  geneticLineId: bigint("geneticLineId", { mode: "number", unsigned: true }).notNull(),
  code: varchar("code", { length: 64 }).notNull(),
  eggsSet: int("eggsSet").notNull(),
  fertilePct: decimal("fertilePct", { precision: 5, scale: 2 }),
  hatchedCount: int("hatchedCount"),
  hatchPct: decimal("hatchPct", { precision: 5, scale: 2 }),
  setDate: date("setDate", { mode: "string" }).notNull(),
  hatchDate: date("hatchDate", { mode: "string" }),
  ...base,
});

export type AuditLog = typeof auditLog.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type GeneticLine = typeof geneticLines.$inferSelect;
export type GeneticLineNorm = typeof geneticLineNorms.$inferSelect;
export type Farm = typeof farms.$inferSelect;
export type House = typeof houses.$inferSelect;
export type Sector = typeof sectors.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type Weighing = typeof weighings.$inferSelect;
export type Select = typeof selects.$inferSelect;
export type Litter = typeof litter.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type ScheduleEvent = typeof scheduleEvents.$inferSelect;
export type FeedIngredient = typeof feedIngredients.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeItem = typeof recipeItems.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type Silo = typeof silos.$inferSelect;
export type Treatment = typeof treatments.$inferSelect;
export type Vaccination = typeof vaccinations.$inferSelect;
export type Cost = typeof costs.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type Mortality = typeof mortalities.$inferSelect;
export type FeedUsage = typeof feedUsages.$inferSelect;
export type DailyLog = typeof dailyLogs.$inferSelect;
export type FeedProgram = typeof feedPrograms.$inferSelect;
export type FeedProgramStage = typeof feedProgramStages.$inferSelect;
export type FeedDelivery = typeof feedDeliveries.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Medicine = typeof medicines.$inferSelect;
export type LabResult = typeof labResults.$inferSelect;
export type ClimateLog = typeof climateLogs.$inferSelect;
export type EnergyLog = typeof energyLogs.$inferSelect;
export type MaintenanceTicket = typeof maintenanceTickets.$inferSelect;
export type BiosecurityCheck = typeof biosecurityChecks.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type HatcheryBatch = typeof hatcheryBatches.$inferSelect;

/* ============================================================
   LUKI Z DOKUMENTACJI — zdrowie (choroby, nekropsja, karencja),
   magazyn (partie/loty, ruchy, lokalizacje), ekonomia
   (scenariusze, benchmarki), żywienie (historia receptur,
   dokładność prognoz, profile eksperckie), integracje,
   generyczny rejestr encji (odpowiednik /v1/entities)
   ============================================================ */

export const diseases = mysqlTable("diseases", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  latinName: varchar("latinName", { length: 255 }),
  category: mysqlEnum("category", ["viral", "bacterial", "parasitic", "metabolic", "fungal", "other"]).notNull(),
  symptoms: text("symptoms"),
  diagnosis: text("diagnosis"),
  treatmentProtocol: text("treatmentProtocol"),
  prevention: text("prevention"),
  severity: mysqlEnum("severity", ["low", "medium", "high", "critical"]).notNull().default("medium"),
  ...base,
});

export const necropsy = mysqlTable("necropsy", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  birdCount: int("birdCount").notNull().default(1),
  findings: text("findings").notNull(),
  suspectedDiseaseId: bigint("suspectedDiseaseId", { mode: "number", unsigned: true }),
  vet: varchar("vet", { length: 255 }).notNull().default("system"),
  verdict: varchar("verdict", { length: 255 }),
  ...base,
});

export const withdrawalPeriods = mysqlTable("withdrawal_periods", {
  id: serial("id").primaryKey(),
  treatmentId: bigint("treatmentId", { mode: "number", unsigned: true }).notNull(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  medicine: varchar("medicine", { length: 255 }).notNull(),
  startDay: date("startDay", { mode: "string" }).notNull(),
  withdrawalDays: int("withdrawalDays").notNull(),
  safeFrom: date("safeFrom", { mode: "string" }).notNull(),
  ...base,
});

/* --- magazyn: partie (loty) z traceability FIFO/FEFO --- */
export const warehouseLots = mysqlTable("warehouse_lots", {
  id: serial("id").primaryKey(),
  warehouseId: bigint("warehouseId", { mode: "number", unsigned: true }).notNull(),
  product: varchar("product", { length: 255 }).notNull(),
  lotNumber: varchar("lotNumber", { length: 64 }).notNull(),
  qty: decimal("qty", { precision: 12, scale: 2 }).notNull(),
  unit: varchar("unit", { length: 16 }).notNull().default("kg"),
  receivedDate: date("receivedDate", { mode: "string" }).notNull(),
  expiryDate: date("expiryDate", { mode: "string" }),
  supplierId: bigint("supplierId", { mode: "number", unsigned: true }),
  ...base,
});

export const stockMovements = mysqlTable("stock_movements", {
  id: serial("id").primaryKey(),
  lotId: bigint("lotId", { mode: "number", unsigned: true }).notNull(),
  kind: mysqlEnum("kind", ["in", "out", "transfer", "adjust"]).notNull(),
  qty: decimal("qty", { precision: 12, scale: 2 }).notNull(),
  reference: varchar("reference", { length: 128 }),
  batchId: bigint("batchId", { mode: "number", unsigned: true }),
  day: date("day", { mode: "string" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* --- ekonomia: scenariusze i benchmarki --- */
export const scenarios = mysqlTable("scenarios", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }),
  name: varchar("name", { length: 255 }).notNull(),
  assumptions: json("assumptions").notNull(),
  result: json("result").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const benchmarks = mysqlTable("benchmarks", {
  id: serial("id").primaryKey(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }),
  metric: varchar("metric", { length: 64 }).notNull(),
  value: decimal("value", { precision: 12, scale: 4 }).notNull(),
  period: varchar("period", { length: 32 }).notNull(),
  source: varchar("source", { length: 64 }).notNull().default("internal"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* --- żywienie: historia zmian receptur i dokładność prognoz --- */
export const recipeHistory = mysqlTable("recipe_history", {
  id: serial("id").primaryKey(),
  recipeId: bigint("recipeId", { mode: "number", unsigned: true }).notNull(),
  changeNote: varchar("changeNote", { length: 500 }).notNull(),
  oldProfile: json("oldProfile"),
  newProfile: json("newProfile"),
  expertReport: text("expertReport"),
  author: varchar("author", { length: 255 }).notNull().default("system"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const forecastAccuracy = mysqlTable("forecast_accuracy", {
  id: serial("id").primaryKey(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  metric: varchar("metric", { length: 64 }).notNull(),
  predicted: decimal("predicted", { precision: 12, scale: 4 }).notNull(),
  actual: decimal("actual", { precision: 12, scale: 4 }).notNull(),
  accuracyPct: decimal("accuracyPct", { precision: 6, scale: 2 }).notNull(),
  day: date("day", { mode: "string" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/* --- integracje między modułami (sourceModule -> targetModule) --- */
export const integrations = mysqlTable("integrations", {
  id: serial("id").primaryKey(),
  sourceModule: varchar("sourceModule", { length: 64 }).notNull(),
  targetModule: varchar("targetModule", { length: 64 }).notNull(),
  kind: mysqlEnum("kind", ["api", "webhook", "device", "file"]).notNull().default("api"),
  config: json("config"),
  enabled: boolean("enabled").notNull().default(true),
  ...base,
});

/* --- generyczny rejestr encji dynamicznych (odpowiednik /v1/entities/:entity) --- */
export const dynamicEntities = mysqlTable("dynamic_entities", {
  id: serial("id").primaryKey(),
  entity: varchar("entity", { length: 64 }).notNull(),
  data: json("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});
export type Disease = typeof diseases.$inferSelect;
export type Necropsy = typeof necropsy.$inferSelect;
export type WithdrawalPeriod = typeof withdrawalPeriods.$inferSelect;
export type WarehouseLot = typeof warehouseLots.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Scenario = typeof scenarios.$inferSelect;
/* --- klucze API do wpinania komputerów/czujników/systemów zewnętrznych (ingest danych) --- */
export const apiKeys = mysqlTable("api_keys", {
  id: serial("id").primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  keyHash: varchar("keyHash", { length: 64 }).notNull().unique(), // sha256 klucza — samego klucza nie przechowujemy
  keyPrefix: varchar("keyPrefix", { length: 12 }).notNull(), // do rozpoznania na liście
  active: boolean("active").notNull().default(true),
  lastUsedAt: timestamp("lastUsedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ApiKey = typeof apiKeys.$inferSelect;

export type Benchmark = typeof benchmarks.$inferSelect;
export type RecipeHistory = typeof recipeHistory.$inferSelect;
export type ForecastAccuracy = typeof forecastAccuracy.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type DynamicEntity = typeof dynamicEntities.$inferSelect;

/* ============================================================
   UBOJNIA — pełny łańcuch FERMA → STADO → PLAN UBOJU → TRANSPORT
   → UBOJNIA → WYNIKI → KLASYFIKACJA → ROZLICZENIE → ANALITYKA
   ============================================================ */

/* Plan uboju — wiąże stado (batch) z planowanym terminem */
export const slaughterPlans = mysqlTable("slaughter_plans", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  plannedDate: date("plannedDate", { mode: "string" }).notNull(),
  plannedCount: int("plannedCount").notNull(),
  targetAvgWeightKg: decimal("targetAvgWeightKg", { precision: 6, scale: 3 }),
  status: mysqlEnum("status", ["planned", "confirmed", "inProgress", "completed", "cancelled"]).notNull().default("planned"),
  notes: text("notes"),
  ...baseNoStatus,
});

/* Partia ubojowa — kod UB-RRRR-NNNNNN nadawany automatycznie */
export const slaughterBatches = mysqlTable("slaughter_batches", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  planId: bigint("planId", { mode: "number", unsigned: true }),
  companyId: bigint("companyId", { mode: "number", unsigned: true }).notNull(),
  farmId: bigint("farmId", { mode: "number", unsigned: true }).notNull(),
  batchId: bigint("batchId", { mode: "number", unsigned: true }).notNull(),
  isDemo: boolean("isDemo").notNull().default(false),
  status: mysqlEnum("status", ["created", "transport", "reception", "slaughtered", "settled", "closed"]).notNull().default("created"),
  notes: text("notes"),
  ...baseNoStatus,
});

/* Transport do zakładu */
export const transports = mysqlTable("transports", {
  id: serial("id").primaryKey(),
  slaughterBatchId: bigint("slaughterBatchId", { mode: "number", unsigned: true }).notNull(),
  vehiclePlate: varchar("vehiclePlate", { length: 32 }),
  driverName: varchar("driverName", { length: 128 }),
  cratesCount: int("cratesCount"),
  loadedCount: int("loadedCount").notNull().default(0),
  loadStartAt: timestamp("loadStartAt"),
  loadEndAt: timestamp("loadEndAt"),
  departureAt: timestamp("departureAt"),
  arrivalAt: timestamp("arrivalAt"),
  distanceKm: decimal("distanceKm", { precision: 8, scale: 1 }),
  transportCost: decimal("transportCost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  deadInTransport: int("deadInTransport").notNull().default(0),
  notes: text("notes"),
  ...base,
});

/* Przyjęcie na ubojni — rozważenie żywca */
export const slaughterReceptions = mysqlTable("slaughter_receptions", {
  id: serial("id").primaryKey(),
  slaughterBatchId: bigint("slaughterBatchId", { mode: "number", unsigned: true }).notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  receivedCount: int("receivedCount").notNull(),
  deadOnArrival: int("deadOnArrival").notNull().default(0),
  rejectedCount: int("rejectedCount").notNull().default(0),
  liveWeightKg: decimal("liveWeightKg", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  ...base,
});

/* Wynik uboju — wydajność liczona automatycznie: masa tuszek / masa żywa × 100 */
export const slaughterResults = mysqlTable("slaughter_results", {
  id: serial("id").primaryKey(),
  slaughterBatchId: bigint("slaughterBatchId", { mode: "number", unsigned: true }).notNull(),
  slaughteredAt: timestamp("slaughteredAt").defaultNow().notNull(),
  carcassCount: int("carcassCount").notNull(),
  carcassWeightKg: decimal("carcassWeightKg", { precision: 12, scale: 2 }).notNull(),
  yieldPct: decimal("yieldPct", { precision: 5, scale: 2 }).notNull(), // auto: carcass/live ×100
  wasteKg: decimal("wasteKg", { precision: 10, scale: 2 }).notNull().default("0.00"),
  byproductsKg: decimal("byproductsKg", { precision: 10, scale: 2 }).notNull().default("0.00"),
  notes: text("notes"),
  ...base,
});

/* Słownik klas konfekcyjnych — KONFIGUROWALNY przez użytkownika.
   System NIE narzuca norm zakładowych — klasy definiuje użytkownik. */
export const carcassClassDict = mysqlTable("carcass_class_dict", {
  id: serial("id").primaryKey(),
  companyId: bigint("companyId", { mode: "number", unsigned: true }), // null = globalny
  code: varchar("code", { length: 32 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  sortOrder: int("sortOrder").notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...base,
});

/* Klasyfikacja tuszek partii wg słownika */
export const carcassClassifications = mysqlTable("carcass_classifications", {
  id: serial("id").primaryKey(),
  slaughterBatchId: bigint("slaughterBatchId", { mode: "number", unsigned: true }).notNull(),
  classCode: varchar("classCode", { length: 32 }).notNull(),
  count: int("count").notNull(),
  weightKg: decimal("weightKg", { precision: 12, scale: 2 }).notNull(),
  ...base,
});

/* Rozliczenie finansowe partii ubojowej */
export const slaughterSettlements = mysqlTable("slaughter_settlements", {
  id: serial("id").primaryKey(),
  slaughterBatchId: bigint("slaughterBatchId", { mode: "number", unsigned: true }).notNull(),
  pricePerKg: decimal("pricePerKg", { precision: 8, scale: 3 }).notNull(),
  bonuses: decimal("bonuses", { precision: 10, scale: 2 }).notNull().default("0.00"),
  deductions: decimal("deductions", { precision: 10, scale: 2 }).notNull().default("0.00"),
  grossAmount: decimal("grossAmount", { precision: 12, scale: 2 }).notNull(),
  netAmount: decimal("netAmount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("PLN"),
  documentNumber: varchar("documentNumber", { length: 64 }),
  settledAt: date("settledAt", { mode: "string" }),
  notes: text("notes"),
  ...base,
});

/* Historia zdarzeń partii ubojowej (pełna ścieżka audytu) */
export const slaughterEvents = mysqlTable("slaughter_events", {
  id: serial("id").primaryKey(),
  slaughterBatchId: bigint("slaughterBatchId", { mode: "number", unsigned: true }).notNull(),
  eventType: varchar("eventType", { length: 48 }).notNull(),
  message: varchar("message", { length: 255 }).notNull(),
  payload: json("payload"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SlaughterPlan = typeof slaughterPlans.$inferSelect;
export type SlaughterBatch = typeof slaughterBatches.$inferSelect;
export type Transport = typeof transports.$inferSelect;
export type SlaughterReception = typeof slaughterReceptions.$inferSelect;
export type SlaughterResult = typeof slaughterResults.$inferSelect;
export type CarcassClassDict = typeof carcassClassDict.$inferSelect;
export type CarcassClassification = typeof carcassClassifications.$inferSelect;
export type SlaughterSettlement = typeof slaughterSettlements.$inferSelect;
export type SlaughterEvent = typeof slaughterEvents.$inferSelect;
