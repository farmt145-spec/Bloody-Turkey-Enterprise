import { Bird } from "lucide-react";

const NODES = [
  { id: "companies", label: "companies", x: 380, y: 30, fields: ["id PK", "name", "countryCode", "baseCurrency", "status", "createdAt", "updatedAt", "updatedBy"] },
  { id: "users", label: "users", x: 60, y: 30, fields: ["id PK", "unionId", "name", "email", "role", "companyId FK"] },
  { id: "genetic_lines", label: "genetic_lines", x: 700, y: 30, fields: ["id PK", "companyId FK", "name", "supplier", "status"] },
  { id: "farms", label: "farms", x: 380, y: 240, fields: ["id PK", "companyId FK", "name", "countryCode", "city", "lat/lng", "capacity", "status"] },
  { id: "houses", label: "houses", x: 380, y: 460, fields: ["id PK", "farmId FK", "name", "houseType", "areaM2", "maxDensityKgM2", "status"] },
  { id: "sectors", label: "sectors", x: 60, y: 460, fields: ["id PK", "houseId FK", "name", "areaM2", "status"] },
  { id: "warehouses", label: "warehouses", x: 700, y: 460, fields: ["id PK", "farmId FK", "name", "capacityTons", "status"] },
  { id: "silos", label: "silos", x: 700, y: 660, fields: ["id PK", "farmId FK", "name", "capacityTons", "currentTons", "recipeId FK"] },
  { id: "batches", label: "batches", x: 380, y: 690, fields: ["id PK", "houseId FK", "sectorId FK", "geneticLineId FK", "code", "sex", "initialCount", "currentCount", "soldCount", "status"] },
  { id: "weighings", label: "weighings", x: 60, y: 810, fields: ["id PK", "batchId FK", "dayAge", "avgWeightG", "stdDevG", "cv"] },
  { id: "selects", label: "selects", x: 60, y: 1000, fields: ["id PK", "batchId FK", "name", "origin", "birdCount", "fcr", "status"] },
  { id: "mortalities", label: "mortalities", x: 380, y: 1180, fields: ["id PK", "batchId FK", "day", "count", "cause"] },
  { id: "schedule_events", label: "schedule_events", x: 60, y: 1200, fields: ["id PK", "batchId FK", "day", "eventType", "title", "done"] },
  { id: "transfers", label: "transfers", x: 700, y: 900, fields: ["id PK", "sourceBatchId FK", "targetBatchId FK", "birdCount", "documentNo", "signatures", "status"] },
  { id: "treatments", label: "treatments", x: 700, y: 1140, fields: ["id PK", "batchId FK", "product", "withdrawalDays", "cost"] },
  { id: "vaccinations", label: "vaccinations", x: 60, y: 1400, fields: ["id PK", "batchId FK", "day", "vaccine", "done"] },
  { id: "feed_ingredients", label: "feed_ingredients", x: 60, y: 240, fields: ["id PK", "companyId FK", "name", "pricePerTon", "protein/energy/aa", "stockTons"] },
  { id: "recipes", label: "recipes", x: 60, y: 1590, fields: ["id PK", "companyId FK", "name", "strategy", "costPerTon", "explanation"] },
  { id: "recipe_items", label: "recipe_items", x: 380, y: 1580, fields: ["id PK", "recipeId FK", "ingredientId FK", "percent"] },
  { id: "costs", label: "costs", x: 60, y: 1760, fields: ["id PK", "batchId FK", "category", "amount", "currency"] },
  { id: "sales", label: "sales", x: 380, y: 1760, fields: ["id PK", "batchId FK", "birdCount", "totalWeightKg", "pricePerKg"] },
  { id: "feed_usages", label: "feed_usages", x: 700, y: 1560, fields: ["id PK", "batchId FK", "day", "kg", "recipeId FK"] },
  { id: "litter", label: "litter", x: 60, y: 580, fields: ["id PK", "houseId FK", "material", "thicknessCm", "cost"] },
  { id: "audit_log", label: "audit_log", x: 380, y: 1380, fields: ["id PK", "tableName", "recordId", "action", "old/newValues", "author"] },
];

const EDGES: Array<[string, string]> = [
  ["companies", "farms"], ["companies", "users"], ["companies", "genetic_lines"],
  ["companies", "feed_ingredients"], ["companies", "recipes"],
  ["farms", "houses"], ["farms", "warehouses"], ["farms", "silos"],
  ["houses", "sectors"], ["houses", "batches"], ["houses", "litter"],
  ["batches", "weighings"], ["batches", "selects"], ["batches", "mortalities"],
  ["batches", "schedule_events"], ["batches", "transfers"], ["batches", "treatments"],
  ["batches", "vaccinations"], ["batches", "costs"], ["batches", "sales"], ["batches", "feed_usages"],
  ["recipes", "recipe_items"], ["feed_ingredients", "recipe_items"], ["recipes", "silos"],
  ["genetic_lines", "batches"], ["sectors", "batches"],
];

const W = 240, HEADER = 34, ROW = 19;
function nodeH(n: (typeof NODES)[0]) { return HEADER + n.fields.length * ROW + 8; }
function center(n: (typeof NODES)[0]) { return { cx: n.x + W / 2, cy: n.y + nodeH(n) / 2 }; }

export default function Erd() {
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">ERD — model danych Bloody Turkey Enterprise</h1>
        <p className="text-sm text-zinc-500">
          24 tabele · multi-company · audit trail na każdej encji biznesowej · silnik: MySQL (mapowanie 1:1 PostgreSQL)
        </p>
      </div>
      <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-950 p-4">
        <svg width={1000} height={1900} className="mx-auto">
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#52525b" />
            </marker>
          </defs>
          {EDGES.map(([a, b], i) => {
            const na = byId[a], nb = byId[b];
            const A = center(na), B = center(nb);
            return (
              <path
                key={i}
                d={`M ${A.cx} ${A.cy} C ${A.cx} ${(A.cy + B.cy) / 2}, ${B.cx} ${(A.cy + B.cy) / 2}, ${B.cx} ${B.cy}`}
                fill="none" stroke="#3f3f46" strokeWidth={1.2} markerEnd="url(#arrow)"
              />
            );
          })}
          {NODES.map((n) => (
            <g key={n.id}>
              <rect x={n.x} y={n.y} width={W} height={nodeH(n)} rx={8} fill="#18181b" stroke="#3f3f46" />
              <rect x={n.x} y={n.y} width={W} height={HEADER} rx={8} fill="#7f1d1d" />
              <text x={n.x + 12} y={n.y + 22} fill="#fecaca" fontSize={13} fontWeight={700} fontFamily="monospace">
                {n.label}
              </text>
              {n.fields.map((f, i) => (
                <text key={i} x={n.x + 12} y={n.y + HEADER + 15 + i * ROW} fill={f.includes("PK") ? "#fbbf24" : f.includes("FK") ? "#93c5fd" : "#a1a1aa"} fontSize={11} fontFamily="monospace">
                  {f}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Bird className="h-4 w-4 text-red-400" />
        Legenda: <span className="text-amber-400">PK</span> klucz główny · <span className="text-sky-300">FK</span> klucz obcy · każda tabela biznesowa ma status / createdAt / updatedAt / updatedBy + wpis w audit_log
      </div>
    </div>
  );
}
