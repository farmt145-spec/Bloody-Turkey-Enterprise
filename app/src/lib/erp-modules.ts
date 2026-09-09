/* Rejestr modułów ERP — konfiguracja pól dla generycznego CRUD */
export type FieldType = "text" | "number" | "date" | "select" | "bool" | "textarea";
export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  required?: boolean;
  list?: boolean; // pokaż w tabeli
};
export type ModuleDef = {
  key: string;
  label: string;
  description: string;
  fields: FieldDef[];
};

const sel = (v: [string, string][]) => v.map(([value, label]) => ({ value, label }));

export const ERP_MODULES: ModuleDef[] = [
  {
    key: "suppliers", label: "Dostawcy", description: "Baza dostawców pasz, piskląt, leków i usług",
    fields: [
      { name: "name", label: "Nazwa", type: "text", required: true, list: true },
      { name: "category", label: "Kategoria", type: "select", options: sel([["feed","Pasze"],["chicks","Pisklęta"],["medicine","Leki"],["equipment","Sprzęt"],["energy","Energia"],["transport","Transport"],["other","Inne"]]), required: true, list: true },
      { name: "countryCode", label: "Kraj", type: "text", list: true },
      { name: "nip", label: "NIP", type: "text" },
      { name: "email", label: "E-mail", type: "text" },
      { name: "phone", label: "Telefon", type: "text", list: true },
      { name: "rating", label: "Ocena (1–5)", type: "number", list: true },
    ],
  },
  {
    key: "purchaseOrders", label: "Zamówienia zakupu", description: "Zamówienia do dostawców ze statusami realizacji",
    fields: [
      { name: "number", label: "Numer", type: "text", required: true, list: true },
      { name: "supplierId", label: "ID dostawcy", type: "number", required: true },
      { name: "item", label: "Pozycja", type: "text", required: true, list: true },
      { name: "quantity", label: "Ilość", type: "number", required: true, list: true },
      { name: "unit", label: "Jednostka", type: "text" },
      { name: "priceNet", label: "Wartość netto", type: "number", required: true, list: true },
      { name: "orderDate", label: "Data zamówienia", type: "date", required: true, list: true },
      { name: "deliveryDate", label: "Data dostawy", type: "date" },
      { name: "orderStatus", label: "Status", type: "select", options: sel([["draft","Szkic"],["sent","Wysłane"],["confirmed","Potwierdzone"],["delivered","Dostarczone"],["cancelled","Anulowane"]]), list: true },
    ],
  },
  {
    key: "contracts", label: "Kontrakty", description: "Umowy zakupu, sprzedaży, usług i dzierżawy",
    fields: [
      { name: "number", label: "Numer", type: "text", required: true, list: true },
      { name: "party", label: "Kontrahent", type: "text", required: true, list: true },
      { name: "kind", label: "Rodzaj", type: "select", options: sel([["purchase","Zakup"],["sale","Sprzedaż"],["service","Usługa"],["lease","Dzierżawa"]]), required: true, list: true },
      { name: "validFrom", label: "Obowiązuje od", type: "date", required: true, list: true },
      { name: "validTo", label: "Obowiązuje do", type: "date" },
      { name: "valueEur", label: "Wartość (EUR)", type: "number", list: true },
      { name: "terms", label: "Warunki", type: "textarea" },
    ],
  },
  {
    key: "invoices", label: "Faktury", description: "Faktury sprzedaży i zakupu z kontrolą płatności",
    fields: [
      { name: "number", label: "Numer", type: "text", required: true, list: true },
      { name: "kind", label: "Rodzaj", type: "select", options: sel([["sale","Sprzedaż"],["purchase","Zakup"]]), required: true, list: true },
      { name: "counterparty", label: "Kontrahent", type: "text", required: true, list: true },
      { name: "issueDate", label: "Data wystawienia", type: "date", required: true, list: true },
      { name: "dueDate", label: "Termin płatności", type: "date" },
      { name: "amountNet", label: "Netto", type: "number", required: true, list: true },
      { name: "vatPct", label: "VAT %", type: "number" },
      { name: "paid", label: "Opłacona", type: "bool", list: true },
    ],
  },
  {
    key: "medicines", label: "Magazyn leków", description: "Stany leków i produktów weterynaryjnych z datami ważności",
    fields: [
      { name: "name", label: "Nazwa", type: "text", required: true, list: true },
      { name: "substance", label: "Substancja czynna", type: "text", list: true },
      { name: "form", label: "Postać", type: "text" },
      { name: "stockQty", label: "Stan", type: "number", required: true, list: true },
      { name: "unit", label: "Jednostka", type: "text" },
      { name: "minStock", label: "Stan minimalny", type: "number" },
      { name: "expiryDate", label: "Data ważności", type: "date", list: true },
      { name: "pricePerUnit", label: "Cena/jedn.", type: "number" },
    ],
  },
  {
    key: "labResults", label: "Laboratorium", description: "Wyniki badań: krew, wymazy, woda, pasza, ściółka",
    fields: [
      { name: "farmId", label: "ID fermy", type: "number", required: true },
      { name: "batchId", label: "ID rzutu", type: "number" },
      { name: "sampleType", label: "Próbka", type: "select", options: sel([["blood","Krew"],["swab","Wymaz"],["water","Woda"],["feed","Pasza"],["litter","Ściółka"],["carcass","Padnięte"]]), required: true, list: true },
      { name: "testName", label: "Badanie", type: "text", required: true, list: true },
      { name: "resultValue", label: "Wynik", type: "text", required: true, list: true },
      { name: "unit", label: "Jednostka", type: "text" },
      { name: "refRange", label: "Zakres ref.", type: "text" },
      { name: "verdict", label: "Ocena", type: "select", options: sel([["ok","OK"],["warning","Uwaga"],["critical","Krytyczny"]]), list: true },
      { name: "labName", label: "Laboratorium", type: "text" },
      { name: "day", label: "Data", type: "date", required: true, list: true },
    ],
  },
  {
    key: "energyLogs", label: "Energia i media", description: "Zużycie i koszty prądu, gazu, wody i paliwa",
    fields: [
      { name: "farmId", label: "ID fermy", type: "number", required: true },
      { name: "kind", label: "Rodzaj", type: "select", options: sel([["power","Prąd"],["gas","Gaz"],["water","Woda"],["fuel","Paliwo"]]), required: true, list: true },
      { name: "day", label: "Data", type: "date", required: true, list: true },
      { name: "consumption", label: "Zużycie", type: "number", required: true, list: true },
      { name: "unit", label: "Jednostka", type: "text", list: true },
      { name: "costEur", label: "Koszt (EUR)", type: "number", required: true, list: true },
    ],
  },
  {
    key: "maintenanceTickets", label: "Utrzymanie ruchu", description: "Zgłoszenia awarii i prace serwisowe",
    fields: [
      { name: "farmId", label: "ID fermy", type: "number", required: true },
      { name: "title", label: "Tytuł", type: "text", required: true, list: true },
      { name: "description", label: "Opis", type: "textarea" },
      { name: "priority", label: "Priorytet", type: "select", options: sel([["low","Niski"],["medium","Średni"],["high","Wysoki"],["critical","Krytyczny"]]), list: true },
      { name: "ticketStatus", label: "Status", type: "select", options: sel([["open","Otwarte"],["in_progress","W trakcie"],["done","Wykonane"],["cancelled","Anulowane"]]), list: true },
      { name: "dueDate", label: "Termin", type: "date", list: true },
    ],
  },
  {
    key: "biosecurityChecks", label: "Bioasekuracja", description: "Kontrole procedur bezpieczeństwa biologicznego",
    fields: [
      { name: "farmId", label: "ID fermy", type: "number", required: true },
      { name: "day", label: "Data", type: "date", required: true, list: true },
      { name: "area", label: "Obszar", type: "text", required: true, list: true },
      { name: "checkName", label: "Kontrola", type: "text", required: true, list: true },
      { name: "passed", label: "Zaliczona", type: "bool", list: true },
      { name: "score", label: "Punktacja", type: "number", list: true },
      { name: "inspector", label: "Inspektor", type: "text" },
      { name: "note", label: "Uwagi", type: "textarea" },
    ],
  },
  {
    key: "documents", label: "Dokumenty", description: "Rejestr dokumentów weterynaryjnych, umów i certyfikatów",
    fields: [
      { name: "title", label: "Tytuł", type: "text", required: true, list: true },
      { name: "category", label: "Kategoria", type: "select", options: sel([["vet","Weterynaria"],["contract","Umowa"],["invoice","Faktura"],["protocol","Protokół"],["certificate","Certyfikat"],["other","Inny"]]), list: true },
      { name: "reference", label: "Sygnatura", type: "text", list: true },
      { name: "docDate", label: "Data", type: "date", required: true, list: true },
      { name: "url", label: "Link", type: "text" },
      { name: "note", label: "Uwagi", type: "textarea" },
    ],
  },
  {
    key: "tasks", label: "Zadania", description: "Zadania operacyjne z przypisaniem i terminami",
    fields: [
      { name: "title", label: "Tytuł", type: "text", required: true, list: true },
      { name: "description", label: "Opis", type: "textarea" },
      { name: "assignee", label: "Odpowiedzialny", type: "text", list: true },
      { name: "dueDate", label: "Termin", type: "date", list: true },
      { name: "priority", label: "Priorytet", type: "select", options: sel([["low","Niski"],["medium","Średni"],["high","Wysoki"]]), list: true },
      { name: "done", label: "Wykonane", type: "bool", list: true },
    ],
  },
  {
    key: "hatcheryBatches", label: "Wylęgarnia", description: "Partie jaj: nasady, klujność, data wylęgu",
    fields: [
      { name: "code", label: "Kod partii", type: "text", required: true, list: true },
      { name: "geneticLineId", label: "ID linii genetycznej", type: "number", required: true },
      { name: "eggsSet", label: "Nasada (jaja)", type: "number", required: true, list: true },
      { name: "fertilePct", label: "Zapłodnienie %", type: "number", list: true },
      { name: "hatchedCount", label: "Wyklute", type: "number", list: true },
      { name: "hatchPct", label: "Klujność %", type: "number", list: true },
      { name: "setDate", label: "Data nasady", type: "date", required: true, list: true },
      { name: "hatchDate", label: "Data wylęgu", type: "date" },
    ],
  },
];
