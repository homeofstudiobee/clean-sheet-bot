// src/utils/changeReport.ts
import { DataRow, ValidationIssue } from "@/types/data";

export type CellChange = {
  row: number;
  column: string;
  before: string | number | null;
  after: string | number | null;
};

export function diffRows(before: DataRow[], after: DataRow[]): CellChange[] {
  const changes: CellChange[] = [];
  const n = Math.min(before.length, after.length);
  for (let i = 0; i < n; i++) {
    const b = before[i] || {};
    const a = after[i] || {};
    const cols = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
    for (const c of cols) {
      const vb = b[c] ?? null;
      const va = a[c] ?? null;
      if (String(vb) !== String(va)) {
        changes.push({ row: i + 1, column: c, before: vb, after: va });
      }
    }
  }
  return changes;
}

export type MarketTask = {
  taxonomyKey: string;
  value: string;
  occurrences: number;
  sample_rows: string; // e.g., "2, 15, 61"
  suggestion?: string;
};

export function buildMarketTasks(
  issues: ValidationIssue[],
  data: DataRow[]
): MarketTask[] {
  // group by taxonomyKey + value
  const map = new Map<string, { rows: number[] }>();
  for (const i of issues) {
    const key = `${i.taxonomyKey}||${i.value}`;
    if (!map.has(key)) map.set(key, { rows: [] });
    if (typeof i.rowIndex === "number") map.get(key)!.rows.push(i.rowIndex + 1);
  }
  const out: MarketTask[] = [];
  for (const [k, v] of map) {
    const [taxonomyKey, value] = k.split("||");
    const sample = v.rows.slice(0, 10).join(", ");
    out.push({
      taxonomyKey,
      value,
      occurrences: v.rows.length,
      sample_rows: sample,
      suggestion: undefined, // optional: plug in mapping proposals later
    });
  }
  // sort by frequency
  out.sort((a, b) => b.occurrences - a.occurrences);
  return out;
}
