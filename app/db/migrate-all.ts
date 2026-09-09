/**
 * Zastosuj WSZYSTKIE migracje SQL z db/migrations w kolejności alfabetycznej.
 * Błędy "table already exists" / "Duplicate" są pomijane — skrypt jest idempotentny
 * i bezpieczny do wielokrotnego uruchamiania (np. przy każdym starcie kontenera).
 */
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Brak DATABASE_URL");
  const dir = "db/migrations";
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const conn = await mysql.createConnection(url);
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    const stmts = sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
    for (const st of stmts) {
      try {
        await conn.query(st);
      } catch (e: any) {
        if (/already exists|Duplicate/i.test(e.message)) continue;
        console.error(`Błąd w ${file}:`, e.message.slice(0, 200));
        throw e;
      }
    }
    console.log(`✓ ${file}`);
  }
  console.log("Wszystkie migracje zastosowane.");
  await conn.end();
}

main().catch((e) => {
  console.error("Migracja nieudana:", e.message);
  process.exit(1);
});
