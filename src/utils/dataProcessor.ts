// src/utils/dataProcessor.ts
import type { DataRow, IssueSummary, Rules, ChangeLog } from "@/types/data";
import type { TaxonomyDefinition, ValidationConfig } from "@/types/taxonomyConfig";
import { validateAgainstTaxonomy } from "@/utils/validation";

// Local cell + row types aligned to DataRow (no boolean in values)
type Cell = string | number | null | undefined;
type Row = Record<string, Cell>;

export type TodoLists = {
  brands: DataRow[];
  campaigns: DataRow[];
  vendors: DataRow[];
  channels: DataRow[];
  fx_rates: DataRow[];
  cbht: DataRow[];
};

export type ProcessingResult = {
  cleanedData: DataRow[];
  exceptions: Row[];
  summary: IssueSummary;
  warnings: { code: string; msg: string }[];
  mode: "LIGHT" | "STRICT";
  headers: string[];
  delimiter: string;
  changeLog: ChangeLog[];
  todoLists: TodoLists;
};

const DEFAULT_CURRENCY = "USD";
const FILL_STR = "Unmapped";
const FILL_MARKET = "Global";

const CANON = {
  brand: "brand",
  campaign: "campaign",
  vendor: "vendor",
  channel: "channel",
  market: "market",
  currency: "currency",
  spend: "spend",
  spendUsd: "spend_usd",
  date: "date",
  dateIso: "date_iso",
} as const;

const SYN = {
  brand: ["brand", "brand_name", "advertiser", "client"],
  campaign: ["campaign", "campaign_name", "line_item", "activity"],
  vendor: ["vendor", "partner", "publisher", "supplier", "media_owner"],
  channel: ["channel", "channel_name", "medium", "placement_channel"],
  market: ["market", "country", "region", "geo"],
  currency: ["currency", "ccy"],
  spend: ["spend", "amount", "cost", "budget", "value"],
  date: ["date", "start_date", "month_start", "date_start"],
  month: ["month", "mo"],
  year: ["year", "yr"],
};

export async function processData(
  data: DataRow[],
  taxonomies: Record<string, TaxonomyDefinition>,
  _validationConfig: ValidationConfig,
  validationRules: unknown,
  _dataFilename: string,
  onProgress?: (pct: number, msg?: string) => void
): Promise<ProcessingResult> {
  const changeLog: ChangeLog[] = [];
  const todos: TodoLists = { brands: [], campaigns: [], vendors: [], channels: [], fx_rates: [], cbht: [] };

  onProgress?.(5, "Normalizing…");
  const rows = (data as Row[]).map((r, i) => normalizeRow(r, i, changeLog));

  onProgress?.(25, "Hard remapping…");
  const lookups = buildLookups(taxonomies);
  const remapped = rows.map((r, i) => hardRemap(r, i, lookups, changeLog, todos));

  onProgress?.(60, "FX + dates…");
  const finalRows = remapped.map((r, i) => deriveFxAndDates(r, i, lookups, changeLog));

  // grouped validation (optional)
  onProgress?.(75, "Validating…");
  const headers = collectHeaders(finalRows);
  const rules = (validationRules as Rules) ?? null;

  let mode: "LIGHT" | "STRICT" = "LIGHT";
  let warnings: { code: string; msg: string }[] = [];
  let summary: IssueSummary = {};
  let exceptions: Row[] = [];

  try {
    const v = validateAgainstTaxonomy(finalRows as Record<string, unknown>[], headers, rules);
    mode = v.mode;
    warnings = v.warnings;
    summary = v.summary;
    exceptions = flattenSummarySamples(summary);
  } catch {
    // optional
  }

  onProgress?.(100, `Done. ${finalRows.length} rows.`);

  return {
    cleanedData: finalRows as DataRow[],
    exceptions,
    summary,
    warnings,
    mode,
    headers,
    delimiter: ",",
    changeLog,
    todoLists: todos,
  };
}

export default { processData };

// ---------- helpers ----------
type Lookup = {
  brands: Set<string>;
  campaigns: Set<string>;
  vendors: Set<string>;
  channels: Set<string>;
  markets: Set<string>;
  fx: Array<{ from: string; to: string; rate: number }>;
};

function collectHeaders(rows: Row[]): string[] {
  const set = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
  return Array.from(set);
}

function normalizeRow(r: Row, rowIndex: number, log: ChangeLog[]): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") {
      const orig = v;
      const norm = v.replace(/\uFEFF/g, "").normalize("NFKC").trim().replace(/\s+/g, " ");
      out[k] = norm;
      if (norm !== orig) pushChange(log, rowIndex, k, "automated", orig, norm, "normalize");
    } else out[k] = v;
  }
  return out;
}

function buildLookups(taxonomies: Record<string, TaxonomyDefinition>): Lookup {
  const norm = (s: Cell) => String(s ?? "").trim().toLowerCase();
  const asSet = (tx?: TaxonomyDefinition, keys: string[] = []) => {
    const s = new Set<string>();
    if (!tx?.data) return s;
    for (const row of tx.data as Record<string, unknown>[]) {
      for (const k of keys) {
        const v = (row as Record<string, unknown>)[k];
        if (v != null) s.add(norm(v as Cell));
      }
    }
    return s;
  };

  const brands = asSet(taxonomies["brands"], ["brand", "brand_name", "name"]);
  const campaigns = asSet(taxonomies["campaigns"], ["campaign", "campaign_name", "name"]);
  const vendors = asSet(taxonomies["vendors"], ["vendor", "name", "publisher", "partner"]);
  const channels = asSet(taxonomies["channels"], ["channel", "name", "medium"]);
  const markets = asSet(taxonomies["cbht"], ["market", "country", "region", "geo"]);

  const fx: Array<{ from: string; to: string; rate: number }> = [];
  const fxTx = taxonomies["fx_rates"];
  if (fxTx?.data?.length) {
    for (const r of fxTx.data as Record<string, unknown>[]) {
      const from = toUpper3((r as Row)["from"] ?? (r as Row)["currency"] ?? "");
      const to = toUpper3((r as Row)["to"] ?? "USD");
      const rate = Number((r as Row)["rate"] ?? (r as Row)["fx"] ?? 1);
      if (from && to && Number.isFinite(rate) && rate > 0) fx.push({ from, to, rate });
    }
  }
  return { brands, campaigns, vendors, channels, markets, fx };
}

function toUpper3(v: Cell, fallback = DEFAULT_CURRENCY): string {
  const t = typeof v === "string" ? v.trim().toUpperCase() : "";
  return t || fallback;
}
function findField(row: Row, cands: string[]): string | undefined {
  for (const c of cands) {
    const key = Object.keys(row).find((h) => h.toLowerCase() === c.toLowerCase());
    if (key) return key;
  }
  return undefined;
}

function hardRemap(row: Row, rowIndex: number, lookup: Lookup, log: ChangeLog[], todos: TodoLists): Row {
  const out: Row = { ...row };
  mapInto(out, rowIndex, lookup.brands, SYN.brand, CANON.brand, FILL_STR, "brand", todos.brands, log);
  mapInto(out, rowIndex, lookup.campaigns, SYN.campaign, CANON.campaign, FILL_STR, "campaign", todos.campaigns, log);
  mapInto(out, rowIndex, lookup.vendors, SYN.vendor, CANON.vendor, FILL_STR, "vendor", todos.vendors, log);
  mapInto(out, rowIndex, lookup.channels, SYN.channel, CANON.channel, FILL_STR, "channel", todos.channels, log);
  mapInto(out, rowIndex, lookup.markets, SYN.market, CANON.market, FILL_MARKET, "market", todos.cbht, log);

  const kCur = findField(out, SYN.currency) ?? CANON.currency;
  if (!(kCur in out)) {
    out[kCur] = DEFAULT_CURRENCY;
    pushChange(log, rowIndex, kCur, "automated", "", DEFAULT_CURRENCY, "create_field:currency");
  } else {
    const curOrig = out[kCur];
    const curUp = toUpper3(curOrig);
    if (curUp !== curOrig) pushChange(log, rowIndex, kCur, "automated", curOrig, curUp, "uppercase_currency");
    out[kCur] = curUp;
  }

  const kAmt = findField(out, SYN.spend) ?? CANON.spend;
  if (!(kAmt in out)) {
    out[kAmt] = 0;
    pushChange(log, rowIndex, kAmt, "automated", "", 0, "create_field:spend");
  } else {
    const sOrig = out[kAmt];
    const sNum = parseNumber(sOrig);
    if (String(sOrig) !== String(sNum)) pushChange(log, rowIndex, kAmt, "automated", sOrig, sNum, "coerce_number");
    out[kAmt] = sNum;
  }
  return out;
}

function mapInto(
  out: Row,
  rowIndex: number,
  known: Set<string>,
  syn: string[],
  canonKey: string,
  fill: string,
  noteField: string,
  todoBucket: DataRow[],
  log: ChangeLog[]
) {
  const k = findField(out, syn);
  const key = k ?? canonKey;

  if (!(key in out)) {
    out[key] = fill;
    pushChange(log, rowIndex, key, "automated", "", fill, `create_field:${noteField}`);
    return;
  }

  const raw = String(out[key] ?? "").trim();
  if (!raw) {
    out[key] = fill;
    pushChange(log, rowIndex, key, "automated", "", fill, `fill_default:${noteField}`);
    return;
  }

  const hit = known.has(raw.toLowerCase());
  if (!hit) {
    todoBucket.push({ field: noteField, raw } as unknown as DataRow);
    out[key] = fill;
    pushChange(log, rowIndex, key, "automated", raw, fill, `map_taxonomy:${noteField}`);
  }
}

function parseNumber(v: Cell): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string") return 0;
  const t = v.replace(/[^0-9.,()-]/g, "").trim();
  if (!t) return 0;
  const neg = /^\(.*\)$/.test(t);
  const core = t.replace(/[(),]/g, "");
  const n = Number(core);
  if (!Number.isFinite(n)) return 0;
  return neg ? -n : n;
}

function deriveFxAndDates(row: Row, rowIndex: number, lookup: Lookup, log: ChangeLog[]): Row {
  const out: Row = { ...row };

  // FX
  const amt = Number(out[CANON.spend] ?? 0);
  const cur = String(out[CANON.currency] ?? DEFAULT_CURRENCY);
  const usd = fxToUsd(lookup, amt, cur);
  out[CANON.spendUsd] = usd;
  pushChange(log, rowIndex, CANON.spendUsd, "automated", "", usd, `compute_fx_usd:${cur}->USD`);

  // Date
  const iso = toDateIso(out);
  const kDate = findField(out, SYN.date) ?? CANON.date;
  if (iso) {
    const from = out[kDate] ?? "";
    out[kDate] = iso;
    out[CANON.dateIso] = iso;
    if (String(from) !== iso) pushChange(log, rowIndex, kDate, "automated", from, iso, "coerce_date:ISO");
  } else {
    out[CANON.dateIso] = "";
  }

  return out;
}

function fxToUsd(lookup: Lookup, amount: number, currency: string): number {
  if (!amount) return 0;
  const cur = toUpper3(currency);
  if (cur === "USD") return amount;

  const direct = lookup.fx.find((r) => r.from === cur && r.to === "USD");
  if (direct) return amount * direct.rate;

  const inverse = lookup.fx.find((r) => r.from === "USD" && r.to === cur);
  if (inverse && inverse.rate) return amount / inverse.rate;

  return amount;
}

function toDateIso(row: Row): string {
  const kDate = findField(row, SYN.date);
  if (kDate && row[kDate]) {
    const d = new Date(String(row[kDate]));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const kM = findField(row, SYN.month);
  const kY = findField(row, SYN.year);
  if (kM && kY && row[kM] && row[kY]) {
    const m = String(row[kM]).padStart(2, "0");
    const y = String(row[kY]).padStart(4, "0");
    const d = new Date(`${y}-${m}-01T00:00:00Z`);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return "";
}

function toScalar(v: Cell): string | number {
  return typeof v === "number" ? v : String(v ?? "");
}

function pushChange(
  log: ChangeLog[],
  rowIndex: number,
  column: string,
  changeType: "automated" | "manual",
  oldValue: Cell,
  newValue: Cell,
  rule?: string
) {
  const oldS = toScalar(oldValue);
  const newS = toScalar(newValue);
  if (oldS === newS) return;
  log.push({
    id: `${rowIndex}-${column}-${log.length}`,
    rowIndex,
    column,
    oldValue: oldS,
    newValue: newS,
    changeType,
    rule,
    timestamp: new Date(),
  });
}

function flattenSummarySamples(summary: IssueSummary): Row[] {
  const rows: Row[] = [];
  for (const [code, b] of Object.entries(summary)) {
    for (const s of b.samples as Row[]) rows.push({ code, ...s });
  }
  return rows;
}