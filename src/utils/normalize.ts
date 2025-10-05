// src/utils/normalize.ts
export const normHeader = (s: string): string =>
  (s ?? "")
    .replace(/\uFEFF/g, "") // BOM
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");

export const normCell = (v: unknown): unknown => {
  if (typeof v !== "string") return v;
  return v.replace(/\uFEFF/g, "").normalize("NFKC").trim().replace(/\s+/g, " ");
};

export const normalizeRow = <T extends Record<string, unknown>>(row: T): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = normCell(v);
  return out as T;
};
