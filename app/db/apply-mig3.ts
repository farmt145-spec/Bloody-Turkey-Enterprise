import mysql from "mysql2/promise";
import fs from "fs";
async function main() {
const url = process.env.DATABASE_URL!;
const sql = fs.readFileSync("db/migrations/0003_new_grandmaster.sql", "utf8");
const stmts = sql.split("--> statement-breakpoint").map(s => s.trim()).filter(Boolean);
const conn = await mysql.createConnection(url);
for (const st of stmts) {
  try { await conn.query(st); }
  catch (e: any) {
    if (/already exists|Duplicate/i.test(e.message)) console.log("skip:", e.message.slice(0, 80));
    else throw e;
  }
}
console.log("migracja OK");
await conn.end();
}
main();
