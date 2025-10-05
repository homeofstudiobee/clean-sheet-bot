// src/utils/dataProcessor.ts
import type { DataRow, IssueSummary, Rules, ChangeLog } from "@/types/data";
import type { TaxonomyDefinition, ValidationConfig } from "@/types/taxonomyConfig";
import { validateAgainstTaxonomy } from "@/utils/validation";

// Cells align to DataRow: no boolean
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
  brand: ["brand", "brand_name", "advertiser", "client", "canonical", "name"],
  campaign: ["campaign", "campaign_name", "activity", "canonical", "name"],
  vendor: ["vendor", "publisher", "partner", "supplier", "media_owner", "canonical", "name"],
  channel: ["channel", "medium", "placement_channel", "canonical", "name"],
  market: ["market", "country", "region", "geo", "canonical", "name"],
  raw: ["raw", "alias", "input", "source", "original", "from"],
  currency: ["currency", "ccy"],
  spend: ["spend", "amount", "cost", "budget", "value"],
  date: ["date", "start_date", "month_start", "date_start"],
  month: ["month", "mo"],
  year: ["year", "yr"],
};

// ---------- API ----------
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

  onProgress?.(25, "Loading taxonomies…");
  const lookups = buildLookups(taxonomies);

  onProgress?.(45, "Hard remapping…");
  const remapped = rows.map((r, i) => hardRemap(r, i, lookups, changeLog, todos));

  onProgress?.(70, "FX + dates…");
  const finalRows = remapped.map((r, i) => deriveFxAndDates(r, i, lookups, changeLog));

  // optional validation
  onProgress?.(85, "Validating…");
  const headers = collectHeaders(finalRows);
  const rules = (validationRules as Rules) ?? null;

  let mode: "LIGHT" | "STRICT" = "LIGHT";
  let warnings: { code: string; msg: string }[] = [];
  let summary: IssueSummary = {};
  let exceptions: Row[] = [];

  try {
    const v = validateAgainstTaxonomy(finalRows as Record<string, unknown>[], headers, rules);
    mode = v.mode; warnings = v.warnings; summary = v.summary;
    exceptions = flattenSummarySamples(summary);
  } catch { /* optional */ }

  onProgress?.(100, `Done. ${finalRows.length} rows.`);

  return {
    cleanedData: finalRows as DataRow[],
    exceptions, summary, warnings, mode, headers, delimiter: ",",
    changeLog, todoLists: todos,
  };
}

export default { processData };

// ---------- helpers ----------
type Dict = Map<string, string>;
type SetAndDict = { set: Set<string>; dict: Dict };

type Lookup = {
  brands: SetAndDict;
  campaigns: SetAndDict;
  vendors: SetAndDict;
  channels: SetAndDict;
  markets: SetAndDict;
  fx: Array<{ from: string; to: string; rate: number }>;
};

const norm = (v: Cell) =>
  String(v ?? "")
    .replace(/\uFEFF/g, "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

function collectHeaders(rows: Row[]): string[] {
  const set = new Set<string>();
  rows.forEach(r => Object.keys(r).forEach(k => set.add(k)));
  return Array.from(set);
}

function normalizeRow(r: Row, rowIndex: number, log: ChangeLog[]): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === "string") {
      const orig = v;
      const normed = v.replace(/\uFEFF/g, "").normalize("NFKC").trim().replace(/\s+/g, " ");
      out[k] = normed;
      if (normed !== orig) pushChange(log, rowIndex, k, "automated", toScalar(orig), toScalar(normed), "normalize");
    } else out[k] = v;
  }
  return out;
}

function toUpper3(v: Cell, fb = DEFAULT_CURRENCY): string {
  const t = typeof v === "string" ? v.trim().toUpperCase() : "";
  return t || fb;
}

function findKeyCI(obj: Record<string, unknown>, candidates: string[]): string | undefined {
  const wants = new Set(candidates.map(c => c.toLowerCase()));
  for (const k of Object.keys(obj)) if (wants.has(k.toLowerCase())) return k;
  return undefined;
}

function valCI(row: Record<string, unknown>, candidates: string[]): Cell | undefined {
  const k = findKeyCI(row, candidates);
  return k ? (row as Row)[k] : undefined;
}

function buildSetAndDict(tx?: TaxonomyDefinition, lhs: string[] = SYN.raw, rhs: string[] = SYN.brand, alsoAllow: string[] = ["name"]): SetAndDict {
  const set = new Set<string>();
  const dict: Dict = new Map();
  if (!tx?.data?.length) return { set, dict };

  for (const r0 of tx.data as Record<string, unknown>[]) {
    // dictionary: raw/alias/input -> canonical
    const rawVal = valCI(r0, lhs);
    const canVal = valCI(r0, rhs) ?? valCI(r0, alsoAllow);
    if (rawVal != null && canVal != null) {
      dict.set(norm(rawVal as Cell), String(canVal ?? ""));
    }
    // whitelist set: accept canonical/name values directly
    const nameVal = valCI(r0, rhs) ?? valCI(r0, alsoAllow);
    if (nameVal != null && String(nameVal).trim() !== "") {
      set.add(norm(nameVal as Cell));
    }
  }
  return { set, dict };
}

function buildLookups(taxonomies: Record<string, TaxonomyDefinition>): Lookup {
  const brands   = buildSetAndDict(taxonomies["brands"],   SYN.raw, SYN.brand,   ["name"]);
  const campaigns= buildSetAndDict(taxonomies["campaigns"],SYN.raw, SYN.campaign,["name"]);
  const vendors  = buildSetAndDict(taxonomies["vendors"],  SYN.raw, SYN.vendor,  ["name"]);
  const channels = buildSetAndDict(taxonomies["channels"], SYN.raw, SYN.channel, ["name"]);
  const markets  = buildSetAndDict(taxonomies["cbht"],     SYN.raw, SYN.market,  ["name","country","region","geo"]);

  const fx: Array<{ from: string; to: string; rate: number }> = [];
  const fxTx = taxonomies["fx_rates"];
  if (fxTx?.data?.length) {
    for (const r of fxTx.data as Record<string, unknown>[]) {
      const from = toUpper3(valCI(r, ["from","currency"]));
      const to   = toUpper3(valCI(r, ["to"]), "USD");
      const rate = Number(valCI(r, ["rate","fx"]) ?? 1);
      if (from && to && Number.isFinite(rate) && rate > 0) fx.push({ from, to, rate });
    }
  }
  return { brands, campaigns, vendors, channels, markets, fx };
}

function findField(row: Row, cands: string[]): string | undefined {
  return findKeyCI(row as Record<string, unknown>, cands);
}

function hardRemap(row: Row, rowIndex: number, L: Lookup, log: ChangeLog[], todos: TodoLists): Row {
  const out: Row = { ...row };
  mapInto(out, rowIndex, L.brands,   SYN.brand,   CANON.brand,   FILL_STR,    "brand",   todos.brands,   log);
  mapInto(out, rowIndex, L.campaigns,SYN.campaign,CANON.campaign,FILL_STR,    "campaign",todos.campaigns,log);
  mapInto(out, rowIndex, L.vendors,  SYN.vendor,  CANON.vendor,  FILL_STR,    "vendor",  todos.vendors,  log);
  mapInto(out, rowIndex, L.channels, SYN.channel, CANON.channel, FILL_STR,    "channel", todos.channels, log);
  mapInto(out, rowIndex, L.markets,  SYN.market,  CANON.market,  FILL_MARKET, "market",  todos.cbht,     log);

  // currency
  const kCur = findField(out, SYN.currency) ?? CANON.currency;
  if (!(kCur in out)) {
    out[kCur] = DEFAULT_CURRENCY;
    pushChange(log, rowIndex, kCur, "automated", "", DEFAULT_CURRENCY, "create_field:currency");
  } else {
    const curOrig = out[kCur];
    const curUp = toUpper3(curOrig);
    if (curUp !== curOrig) pushChange(log, rowIndex, kCur, "automated", toScalar(curOrig), toScalar(curUp), "uppercase_currency");
    out[kCur] = curUp;
  }

  // spend
  const kAmt = findField(out, SYN.spend) ?? CANON.spend;
  if (!(kAmt in out)) {
    out[kAmt] = 0;
    pushChange(log, rowIndex, kAmt, "automated", "", 0, "create_field:spend");
  } else {
    const sOrig = out[kAmt];
    const sNum = parseNumber(sOrig);
    if (String(sOrig) !== String(sNum)) pushChange(log, rowIndex, kAmt, "automated", toScalar(sOrig), toScalar(sNum), "coerce_number");
    out[kAmt] = sNum;
  }

  return out;
}

function mapInto(
  out: Row,
  rowIndex: number,
  sd: SetAndDict,
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

  const n = norm(raw);

  // 1) dictionary mapping wins: alias/raw -> canonical
  const mapped = sd.dict.get(n);
  if (mapped) {
    if (mapped !== raw) pushChange(log, rowIndex, key, "automated", raw, mapped, `map_taxonomy:${noteField}`);
    out[key] = mapped;
    return;
  }

  // 2) whitelist: accept as-is if present
  if (sd.set.has(n)) return;

  // 3) unmapped
  todoBucket.push({ field: noteField, raw } as unknown as DataRow);
  out[key] = fill;
  pushChange(log, rowIndex, key, "automated", raw, fill, `unmapped:${noteField}`);
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

function deriveFxAndDates(row: Row, rowIndex: number, L: Lookup, log: ChangeLog[]): Row {
  const out: Row = { ...row };

  // FX
  const amt = Number(out[CANON.spend] ?? 0);
  const cur = String(out[CANON.currency] ?? DEFAULT_CURRENCY);
  const usd = fxToUsd(L, amt, cur);
  out[CANON.spendUsd] = usd;
  pushChange(log, rowIndex, CANON.spendUsd, "automated", "", usd, `compute_fx_usd:${cur}->USD`);

  // Date
  const iso = toDateIso(out);
  const kDate = findField(out, SYN.date) ?? CANON.date;
  if (iso) {
    const from = out[kDate] ?? "";
    out[kDate] = iso;
    out[CANON.dateIso] = iso;
    if (String(from) !== iso) pushChange(log, rowIndex, kDate, "automated", toScalar(from), toScalar(iso), "coerce_date:ISO");
  } else {
    out[CANON.dateIso] = "";
  }

  return out;
}

function fxToUsd(L: Lookup, amount: number, currency: string): number {
  if (!amount) return 0;
  const cur = toUpper3(currency);
  if (cur === "USD") return amount;

  const direct = L.fx.find(r => r.from === cur && r.to === "USD");
  if (direct) return amount * direct.rate;

  const inverse = L.fx.find(r => r.from === "USD" && r.to === cur);
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
  oldValue: string | number,
  newValue: string | number,
  rule?: string
) {
  if (oldValue === newValue) return;
  log.push({
    id: `${rowIndex}-${column}-${log.length}`,
    rowIndex,
    column,
    oldValue,
    newValue,
    changeType,
    rule,
    timestamp: new Date(),
  });
}

function flattenSummarySamples(summary: IssueSummary): Row[] {
  const rows: Row[] = [];
  for (const [_, b] of Object.entries(summary)) {
    for (const s of b.samples as Row[]) rows.push(s);
  }
  return rows;
}