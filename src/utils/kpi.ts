import type { CleanupResult } from "@/types/data";

export function exceptionsTotal(result?: Pick<CleanupResult,"summary"> | null): number {
  if (!result?.summary) return 0;
  return Object.values(result.summary).reduce((a, b) => a + b.count, 0);
}

export function rulesHit(result?: Pick<CleanupResult,"summary"> | null): number {
  if (!result?.summary) return 0;
  return Object.keys(result.summary).length;
}