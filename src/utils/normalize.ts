// src/utils/normalize.ts
export function normHeader(s: string) {
  return s?.toString().trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}
export function normValue(s: unknown) {
  if (s == null) return "";
  return s
    .toString()
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\-\/&' ]/gu, "") // strip weird punctuation, keep common ones
    .toLowerCase();
}
