// app/src/hooks/useBatchCosts.ts
import { trpc } from "@/providers/trpc";

export function useBatchCosts(batchId?: number) {
  const query = trpc.slaughter.getBatchCosts.useQuery(
    { batchId: batchId ?? 0 },
    { enabled: !!batchId }
  );
  return query;
}
