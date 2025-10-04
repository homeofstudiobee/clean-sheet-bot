// src/utils/validation.ts
import { DataRow, ValidationIssue, TaxonomyData } from "@/types/data";
import { normHeader, normValue } from "@/utils/normalize";

/**
 * taxonomy shape: { key: string[] } or key -> Set of allowed values.
 * columnsToValidate maps dataset column -> taxonomy key.
 */
export function validateAgainstTaxonomy(
  data: DataRow[],
  taxonomy: TaxonomyData,
  columnsToValidate: Record<string, string>
): ValidationIssue[] {
  if (!data?.length) return [];

  // build normalized allowed sets per taxonomy key
  const allowed = new Map<string, Set<string>>();
  for (const [rawKey, arr] of Object.entries(taxonomy)) {
    const k = normHeader(rawKey);
    const set = new Set<string>((arr || []).map(v => normValue(v)));
    allowed.set(k, set);
  }

  const issues: ValidationIssue[] = [];
  data.forEach((row, idx) => {
    for (const [rawCol, rawTaxKey] of Object.entries(columnsToValidate)) {
      const col = normHeader(rawCol);
      const taxKey = normHeader(rawTaxKey);
      const v = normValue((row as any)[rawCol] ?? (row as any)[col]);
      if (!allowed.has(taxKey)) continue;
      if (v === "") continue; // empty handled elsewhere if needed
      if (!allowed.get(taxKey)!.has(v)) {
        issues.push({
          id: `${idx}-${rawCol}-${Date.now()}`,
          rowIndex: idx,
          column: rawCol,
          value: v,
          taxonomyKey: rawTaxKey,
          timestamp: new Date()
        });
      }
    }
  });
  return issues;
}
