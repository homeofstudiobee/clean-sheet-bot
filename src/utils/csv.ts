// src/utils/csv.ts
import Papa from "papaparse";
import { normHeader, normalizeRow } from "./normalize";

export type ParsedCSV = {
  headers: string[];
  rows: Record<string, unknown>[];
  delimiter: string;
};

const detectDelimiter = (firstLine: string): string => {
  const c = (d: string) => (firstLine.match(new RegExp(`\\${d}`, "g")) || []).length;
  const candidates = [",", ";", "\t", "|"];
  return candidates.reduce((best, d) => (c(d) > c(best) ? d : best), ",");
};

export function decodeText(buf: ArrayBuffer | string): string {
  if (typeof buf === "string") return buf;
  // try Windows-1252 then UTF-8
  try {
    return new TextDecoder("windows-1252").decode(new DataView(buf));
  } catch {}
  return new TextDecoder("utf-8").decode(new DataView(buf));
}

export function parseCsvFromText(text: string): ParsedCSV {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (h) => normHeader(h),
  });
  const headers = (result.meta.fields ?? []).map(normHeader);
  const rows = (result.data ?? []).map(normalizeRow);
  return { headers, rows, delimiter };
}
