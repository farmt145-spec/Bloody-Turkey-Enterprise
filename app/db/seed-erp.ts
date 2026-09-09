/* Seed demonstracyjny modułów ERP — realistyczne dane po polsku */
import { getDb } from "../api/queries/connection";
import * as s from "./schema";

const ri = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]) => arr[ri(0, arr.length - 1)];
const dayStr = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5);
const daysAhead = (n: number) => new Date(Date.now() + n * 864e5);

async function main() {
  const db = getDb();
  const companies = await db.select().from(s.companies);
  const farms = await db.select().from(s.farms);
  const batches = await db.select().from(s.batches);
  const houses = await db.select().from(s.houses);
  const lines = await db.select().from(s.geneticLines);
  if (!companies.length) throw new Error("Najpierw uruchom główny seed!");

  // czyść (idempotentnie)
  for (const t of [s.suppliers, s.purchaseOrders, s.contracts, s.invoices, s.medicines, s.labResults, s.climateLogs, s.energyLogs, s.maintenanceTickets, s.biosecurityChecks, s.documents, s.tasks, s.messages, s.notifications, s.hatcheryBatches]) {
    await db.delete(t);
  }

  // --- dostawcy ---
  const supplierData = [
    ["Wipasz S.A.", "feed", "PL"], ["Cargill Polska", "feed", "PL"], ["De Heus", "feed", "NL"],
    ["Grelavi S.A.", "chicks", "FR"], ["Aviagen Turkeys", "chicks", "GB"],
    ["Ceva Santé Animale", "medicine", "FR"], ["Zoetis Polska", "medicine", "PL"],
    ["Big Dutchman", "equipment", "DE"], ["SKOV A/S", "equipment", "DK"],
    ["PGNiG Obrót Detaliczny", "energy", "PL"], ["PGE Dystrybucja", "energy", "PL"],
    ["TransDrob Logistics", "transport", "PL"],
  ] as const;
  const supplierIds: number[] = [];
  for (const [name, category, cc] of supplierData) {
    const [{ id }] = await db.insert(s.suppliers).values({
      companyId: companies[0].id, name, category, countryCode: cc,
      nip: `${ri(100, 999)}-${ri(10, 99)}-${ri(10, 99)}-${ri(100, 999)}`,
      email: `kontakt@${name.toLowerCase().replace(/[^a-z]/g, "")}.eu`,
      phone: `+48 ${ri(500, 899)} ${ri(100, 999)} ${ri(100, 999)}`, rating: ri(3, 5),
    }).$returningId();
    supplierIds.push(id);
  }

  // --- zamówienia zakupu ---
  const items = [["Pasza finisher 40 t", "40000", "kg"], ["Pasza grower 30 t", "30000", "kg"], ["Pisklęta indycze 12 000 szt", "12000", "szt"], ["Ściółka słomiana 20 t", "20000", "kg"], ["Witamina AD3E 200 l", "200", "l"]];
  for (let i = 0; i < 12; i++) {
    const [item, qty, unit] = pick(items);
    await db.insert(s.purchaseOrders).values({
      companyId: pick(companies).id, supplierId: pick(supplierIds),
      number: `PO/2026/${String(i + 1).padStart(4, "0")}`,
      item, quantity: qty, unit, priceNet: String(ri(8, 90) * 1000),
      orderDate: dayStr(daysAgo(ri(1, 45))), deliveryDate: dayStr(daysAhead(ri(1, 21))),
      orderStatus: pick(["sent", "confirmed", "delivered", "draft"] as const),
    });
  }

  // --- kontrakty ---
  const contractData = [["Kontrakt odbioru żywca — Ubojnia Drobiu Piast", "sale"], ["Kontrakt paszowy Wipasz 2026", "purchase"], ["Umowa serwisowa SKOV — wentylacja", "service"], ["Dzierżawa gruntów pod fermę Lubin", "lease"]];
  for (let i = 0; i < contractData.length; i++) {
    const [party, kind] = contractData[i];
    await db.insert(s.contracts).values({
      companyId: companies[0].id, party, kind: kind as any,
      number: `K/2026/${String(i + 1).padStart(3, "0")}`,
      validFrom: dayStr(daysAgo(ri(30, 200))), validTo: dayStr(daysAhead(ri(100, 400))),
      valueEur: String(ri(50, 800) * 1000),
      terms: "Standardowe warunki ramowe; kary umowne za opóźnienia wg aneksu A.",
    });
  }

  // --- faktury ---
  for (let i = 0; i < 15; i++) {
    const isSale = Math.random() > 0.5;
    await db.insert(s.invoices).values({
      companyId: pick(companies).id,
      number: `FV/2026/${String(1000 + i)}`,
      kind: isSale ? "sale" : "purchase",
      counterparty: isSale ? pick(["Ubojnia Piast", "Indykpol S.A.", "SuperDrob"]) : pick(supplierData.map((x) => x[0])),
      issueDate: dayStr(daysAgo(ri(1, 60))), dueDate: dayStr(daysAhead(ri(7, 30))),
      amountNet: String(ri(15, 300) * 100), vatPct: pick([8, 23]), paid: Math.random() > 0.35,
      batchId: isSale && batches.length ? pick(batches).id : null,
    });
  }

  // --- leki ---
  const meds = [
    ["Amoksycylina 50%", "Amoxicillinum", "proszek", "kg", 25, 5],
    ["Doxyvet 20%", "Doxycyclinum", "proszek", "kg", 18, 4],
    ["Fluniksyna 50 mg/ml", "Flunixinum", "injekcja", "ml", 3500, 500],
    ["Witamina AD3E forte", "Vit. A+D3+E", "płyn", "l", 120, 20],
    ["Elektrolity + Vit. C", "Electrolyta", "proszek", "kg", 40, 10],
    ["Enrofloksacyna 10%", "Enrofloxacinum", "płyn doustny", "l", 8, 3],
    ["Jodyna 10% dezynfekcja", "Iodum", "płyn", "l", 60, 15],
  ] as const;
  for (const [name, substance, form, unit, stock, min] of meds) {
    await db.insert(s.medicines).values({
      companyId: companies[0].id, name, substance, form,
      stockQty: String(stock), unit, minStock: String(min),
      expiryDate: dayStr(daysAhead(ri(60, 700))), pricePerUnit: String(ri(20, 180)),
    });
  }

  // --- wyniki laboratoryjne ---
  const tests: [s.LabResult["sampleType"], string, string, string, s.LabResult["verdict"]][] = [
    ["water", "Liczba drobnoustrojów ogólna", "120", "jtk/ml", "ok"],
    ["water", "E. coli", "0", "jtk/100ml", "ok"],
    ["swab", "Salmonella spp.", "nie wykryto", "", "ok"],
    ["blood", "Przeciwciała ND (HI)", "6.2", "log2", "ok"],
    ["feed", "Białko ogólne", "17.8", "%", "ok"],
    ["litter", "Wilgotność ściółki", "38", "%", "warning"],
    ["swab", "Ornithobacterium (ORT)", "wykryto", "PCR", "critical"],
    ["carcass", "Sekcja — zmiany dróg oddechowych", "zapalne", "", "critical"],
  ];
  for (let i = 0; i < 24; i++) {
    const t = pick(tests);
    await db.insert(s.labResults).values({
      farmId: pick(farms).id, batchId: pick(batches).id,
      sampleType: t[0], testName: t[1], resultValue: t[2], unit: t[3], verdict: t[4],
      refRange: "wg norm PIWet", labName: pick(["PIWet Puławy", "VetLab Wrocław", "LabVet Poznań"]),
      day: dayStr(daysAgo(ri(1, 40))),
    });
  }

  // --- klimat IoT (czujniki) ---
  for (const h of houses.slice(0, 20)) {
    for (let hAgo = 0; hAgo < 24; hAgo += 3) {
      await db.insert(s.climateLogs).values({
        houseId: h.id, ts: new Date(Date.now() - hAgo * 36e5),
        tempC: String(ri(18, 29)), humidityPct: String(ri(52, 78)),
        co2Ppm: ri(800, 3200), ammoniaPpm: String(ri(2, 26)), ventilationPct: ri(20, 90),
        source: "sensor",
      });
    }
  }

  // --- energia i media ---
  const kinds: [s.EnergyLog["kind"], string, [number, number], [number, number]][] = [
    ["power", "kWh", [400, 1200], [0.35, 0.55]],
    ["gas", "m3", [80, 400], [1.8, 2.6]],
    ["water", "m3", [20, 90], [0.9, 1.4]],
    ["fuel", "l", [50, 300], [1.4, 1.7]],
  ];
  for (const f of farms) {
    for (let d = 0; d < 30; d += 2) {
      const k = pick(kinds);
      const cons = ri(k[2][0], k[2][1]);
      await db.insert(s.energyLogs).values({
        farmId: f.id, kind: k[0], day: dayStr(daysAgo(d)),
        consumption: String(cons), unit: k[1],
        costEur: (cons * (k[3][0] + Math.random() * (k[3][1] - k[3][0]))).toFixed(2),
      });
    }
  }

  // --- utrzymanie ruchu ---
  const tickets = [
    ["Naprawa linii pojenia — kurnik 3", "high", "open"],
    ["Wymiana wentylatora tunelowego", "critical", "in_progress"],
    ["Serwis okresowy nagrzewnicy gazowej", "medium", "done"],
    ["Kalibracja wag paszowych", "medium", "open"],
    ["Wymiana uszczelki w silosie nr 2", "low", "open"],
    ["Przegląd agregatu prądotwórczego", "high", "done"],
  ] as const;
  for (const [title, priority, st] of tickets) {
    await db.insert(s.maintenanceTickets).values({
      farmId: pick(farms).id, houseId: pick(houses).id,
      title, description: "Zgłoszenie z panelu fermy — szczegóły w protokole serwisowym.",
      priority, ticketStatus: st, reportedBy: pick(["jan.kowalski", "anna.nowak", "piotr.wisniewski"]),
      dueDate: dayStr(daysAhead(ri(1, 21))),
    });
  }

  // --- bioasekuracja ---
  const checks = ["Odwach — rejestr wejść", "Dezynfekcja pojazdów", "Maty dezynfekcyjne — skuteczność", "Szatnia dwustrefowa", "Kontrola gryzoni", "Zabezpieczenie przed ptactwem dzikim"];
  for (const f of farms) {
    for (const c of checks) {
      const passed = Math.random() > 0.12;
      await db.insert(s.biosecurityChecks).values({
        farmId: f.id, day: dayStr(daysAgo(ri(0, 14))), area: pick(["Strefa wejścia", "Kurniki", "Magazyn paszy", "Otoczenie fermy"]),
        checkName: c, passed, score: passed ? ri(80, 100) : ri(40, 75),
        inspector: pick(["m.kowal", "j.zielinska", "weterynarz nadzorujący"]),
      });
    }
  }

  // --- dokumenty ---
  const docs = [
    ["Świadectwo zdrowia stada — rzut RZ/2026/001", "vet", "PW/2026/045"],
    ["Protokół dezynfekcji kurników — maj 2026", "protocol", "PD/2026/012"],
    ["Certyfikat GlobalG.A.P. — ferma Wrocław", "certificate", "GG/2026/077"],
    ["Umowa kontraktacji piskląt Q3 2026", "contract", "K/2026/003"],
  ] as const;
  for (const [title, category, ref] of docs) {
    await db.insert(s.documents).values({
      companyId: companies[0].id, title, category: category as any, reference: ref,
      docDate: dayStr(daysAgo(ri(5, 90))), note: "Dokument zarchiwizowany w repozytorium ERP.",
    });
  }

  // --- zadania ---
  const taskData = [
    ["Ważenie kontrolne — kurnik 5", "jan.kowalski", "high", false],
    ["Wymiana ściółki — sektor B", "anna.nowak", "medium", false],
    ["Przegląd zapasów leków", "weterynarz", "medium", true],
    ["Przygotowanie dokumentów do sprzedaży RZ/2026/004", "biuro", "high", false],
    ["Kalibracja czujników NH3", "serwis", "low", false],
  ] as const;
  for (const [title, assignee, priority, done] of taskData) {
    await db.insert(s.tasks).values({
      companyId: companies[0].id, farmId: pick(farms).id,
      title, description: "Zadanie wygenerowane z harmonogramu produkcji.",
      assignee, dueDate: dayStr(daysAhead(ri(1, 14))), priority, done,
    });
  }

  // --- wiadomości ---
  const msgs = [
    ["general", "jan.kowalski", "Zamknięto ważenie w kurniku 5 — średnia 4.12 kg, selekcje wygenerowane."],
    ["general", "biuro", "Faktura FV/2026/1004 została opłacona."],
    ["weterynaria", "dr.piotrowska", "Wyniki ORT z kurnika 7 wymagają konsultacji — proponuję rozpocząć terapię jutro."],
    ["produkcja", "anna.nowak", "Silos nr 2 na fermie Lubin poniżej 20% — zaplanowano dostawę na piątek."],
  ] as const;
  for (const [channel, author, body] of msgs) {
    await db.insert(s.messages).values({ companyId: companies[0].id, channel, author, body });
  }

  // --- powiadomienia ---
  const notifs = [
    ["critical", "Krytyczny wynik laboratoryjny", "ORT wykryto w wymazach — kurnik 7", "/zdrowie"],
    ["warning", "Niski stan leku: Enrofloksacyna 10%", "Stan 8 l przy minimum 3 l — rozważ domówienie", "/erp/medicines"],
    ["warning", "Silos poniżej 20% pojemności", "Ferma Lubin, silos nr 2", "/magazyn"],
    ["info", "Nowy wynik ważenia", "RZ/2026/001 — Dynamic Select wygenerowany", "/produkcja"],
    ["info", "Zbliża się szczepienie ND", "Harmonogram: jutro, kurnik 3", "/harmonogram"],
  ] as const;
  for (const [severity, title, body, link] of notifs) {
    await db.insert(s.notifications).values({ companyId: companies[0].id, severity, title, body, link, read: severity === "info" });
  }

  // --- wylęgarnia ---
  for (let i = 0; i < 6; i++) {
    const eggsSet = ri(8000, 20000);
    const fert = ri(88, 96);
    const hatchPct = ri(78, 90);
    await db.insert(s.hatcheryBatches).values({
      companyId: companies[0].id, geneticLineId: pick(lines).id,
      code: `HB/2026/${String(i + 1).padStart(3, "0")}`,
      eggsSet, fertilePct: String(fert),
      hatchedCount: Math.round((eggsSet * fert * hatchPct) / 10000),
      hatchPct: String(hatchPct),
      setDate: dayStr(daysAgo(ri(10, 60))), hatchDate: dayStr(daysAgo(ri(0, 30))),
    });
  }

  console.log("Seed ERP gotowy: dostawcy, zamówienia, kontrakty, faktury, leki, laboratorium, klimat, energia, utrzymanie, bioasekuracja, dokumenty, zadania, wiadomości, powiadomienia, wylęgarnia.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
