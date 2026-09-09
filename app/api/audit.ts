import { getDb } from "./queries/connection";
import { auditLog } from "@db/schema";

export async function audit(
  tableName: string,
  recordId: number,
  action: "create" | "update" | "delete",
  opts: { oldValues?: unknown; newValues?: unknown; author?: string } = {},
) {
  await getDb().insert(auditLog).values({
    tableName,
    recordId,
    action,
    oldValues: opts.oldValues ? JSON.parse(JSON.stringify(opts.oldValues)) : null,
    newValues: opts.newValues ? JSON.parse(JSON.stringify(opts.newValues)) : null,
    author: opts.author ?? "system",
  });
}
