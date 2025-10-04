// src/lib/runCleanup.ts
import { DEFAULT_RULES } from "@/lib/rules"; // or "@/config/rules"
import { clean, normalizeHeaders } from "@/lib/cleanup";
import { normHeader, normValue } from "@/utils/normalize";

export function runCleanup(inputRows: any[], taxonomyRows?: any[]) {
  if (!inputRows?.length) return { rows: [], errors: ["no input rows"] };

  // normalize headers
  const rawHeaders = Object.keys(inputRows[0]);
  const headers = rawHeaders.map(normHeader);

  // normalize values
  const rows = inputRows.map(r =>
    Object.fromEntries(
      headers.map((h, i) => [h, normValue(r[rawHeaders[i]])])
    )
  );

  // optional: normalize taxonomy rows too if provided
  const normTax =
    taxonomyRows?.map((t: any) =>
      Object.fromEntries(Object.entries(t).map(([k, v]) => [normHeader(k), normValue(v as any)]))
    ) ?? undefined;

  const { rows: cleaned, errors } = clean(rows, DEFAULT_RULES, normTax);
  return { rows: cleaned, errors };
}
