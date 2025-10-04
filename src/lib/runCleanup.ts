// src/lib/runCleanup.ts
import { DEFAULT_RULES } from "@/config/rules";
import { clean, normalizeHeaders } from "@/lib/cleanup";

export function runCleanup(inputRows: any[], taxonomyRows?: any[]) {
  if (!inputRows?.length) return { rows: [], errors: ["no input rows"] };
  const headers = normalizeHeaders(Object.keys(inputRows[0]));
  const rows = inputRows.map(r =>
    Object.fromEntries(headers.map(h => [h, r[h] ?? r[h.replace(/_/g," ")] ?? null]))
  );
  const { rows: cleaned, errors } = clean(rows, DEFAULT_RULES, taxonomyRows);
  return { rows: cleaned, errors };
}
