import { Row, Rule, Rules } from "./types";

export function normalizeHeaders(headers: string[]): string[] {
  return headers.map(h => h.trim().toLowerCase().replace(/\s+/g,"_"));
}

function applyRule(rows: Row[], rule: Rule): Row[] {
  switch (rule.kind) {
    case "rename":
      return rows.map(r => {
        if (!(rule.from in r)) return r;
        const { [rule.from]: v, ...rest } = r; return { ...rest, [rule.to]: v };
      });
    case "map": {
      const m = rule.caseInsensitive
        ? Object.fromEntries(Object.entries(rule.map).map(([k,v])=>[k.toLowerCase(),v]))
        : rule.map;
      return rows.map(r => {
        const val = r[rule.column]; if (val==null) return r;
        const key = rule.caseInsensitive ? String(val).toLowerCase() : String(val);
        return key in m ? { ...r, [rule.column]: m[key] } : r;
      });
    }
    case "split":
      return rows.map(r => {
        const v = r[rule.column]; if (v==null) return r;
        const parts = String(v).split(rule.sep).map(s=>s.trim());
        const add: Row = {}; rule.into.forEach((c,i)=> add[c] = parts[i] ?? null);
        return { ...r, ...add };
      });
    case "join":
      return rows.map(r => ({ ...r, [rule.into]: rule.columns
        .map(c => r[c]).filter(x=>x!=null && x!=="").join(rule.sep) }));
    case "regex":
      return rows.map(r => {
        const v = r[rule.column]; if (v==null) return r;
        return { ...r, [rule.column]: String(v).replace(new RegExp(rule.pattern,"g"), rule.replace) };
      });
    case "required": return rows; // validated later
    case "lowercase": return rows.map(r => ({ ...r, [rule.column]: r[rule.column]==null?null:String(r[rule.column]).toLowerCase() }));
    case "uppercase": return rows.map(r => ({ ...r, [rule.column]: r[rule[column]==null?null:String(r[rule.column]).toUpperCase() ]}));
    case "trim":      return rows.map(r => ({ ...r, [rule.column]: r[rule.column]==null?null:String(r[rule.column]).trim() }));
    case "coerceNumber": return rows.map(r => ({ ...r, [rule.column]: r[rule.column]==null?null:Number(String(r[rule.column]).replace(/[, ]/g,"")) }));
    case "dedupeBy": {
      const seen = new Set<string>(); const out: Row[] = [];
      for (const r of rows) {
        const key = rule.keys.map(k => String(r[k] ?? "")).join("|");
        if (seen.has(key)) continue; seen.add(key); out.push(r);
      }
      return out;
    }
  }
}

export function applyExceptions(rows: Row[], rules: Rules): Row[] {
  if (!rules.exceptions?.length) return rows;
  return rows.map(r => {
    for (const ex of rules.exceptions!) {
      const match = Object.entries(ex.match).every(([k,v]) => String(r[k] ?? "") === String(v));
      if (match) return { ...r, ...ex.set };
    }
    return r;
  });
}

export function validate(rows: Row[], rules: Rules): { rows: Row[]; errors: string[] } {
  const required = rules.steps.filter(s => s.kind==="required") as Extract<Rule,{kind:"required">>[];
  const errors: string[] = [];
  rows.forEach((r,i) => {
    for (const req of required) {
      const v = r[req.column]; if (v==null || v==="") errors.push(`Row ${i+1}: missing ${req.column}`);
    }
  });
  return { rows, errors };
}

export function joinTaxonomy(rows: Row[], taxonomy: Row[], rules: Rules): Row[] {
  const tj = rules.taxonomyJoin; if (!tj) return rows;
  const idx = new Map<string, Row[]>(); for (const t of taxonomy) {
    const key = String(t[tj.taxonomyKey] ?? ""); if (!idx.has(key)) idx.set(key, []);
    idx.get(key)!.push(t);
  }
  return rows.map(r => {
    const key = String(r[tj.on] ?? ""); const hit = idx.get(key)?.[0];
    return hit ? { ...r, [tj.targetColumn]: hit[tj.taxonomyKey] } : r;
  });
}

export function clean(rows: Row[], rules: Rules, taxonomy?: Row[]) {
  let out = rows; for (const step of rules.steps) out = applyRule(out, step);
  out = applyExceptions(out, rules); if (taxonomy) out = joinTaxonomy(out, taxonomy);
  const { errors } = validate(out, rules); return { rows: out, errors };
}
