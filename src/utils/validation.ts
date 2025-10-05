// src/utils/validation.ts
export type ColumnRule = {
  required?: boolean;
  oneOf?: string[];
  pattern?: string;
};

export type Rules = {
  columns?: Record<string, ColumnRule>;
  required_columns?: string[];
};

export type IssueBucket = { count: number; samples: any[] };
export type IssueSummary = Record<string, IssueBucket>;

export type ValidationOutput = {
  mode: "LIGHT" | "STRICT";
  cleaned: Record<string, unknown>[];
  summary: IssueSummary;
  warnings: { code: string; msg: string }[];
};

const MAX_SAMPLES = 25;

const hit = (summary: IssueSummary, code: string, sample: any) => {
  const b = summary[code] ?? (summary[code] = { count: 0, samples: [] });
  b.count++;
  if (b.samples.length < MAX_SAMPLES) b.samples.push(sample);
};

export function validateAgainstTaxonomy(
  rows: Record<string, unknown>[],
  headers: string[],
  rules?: Rules | null
): ValidationOutput {
  const warnings: { code: string; msg: string }[] = [];
  const summary: IssueSummary = {};
  const cleaned = rows.map((r) => ({ ...r }));

  // defaults make rules optional
  const defaults: Rules = {
    columns: {
      brand: { required: true },
      brand_line: { required: true },
      color_name: { required: true },
    },
  };
  const merged: Rules = deepMerge(defaults, rules ?? {});

  // If no column rules at all, short-circuit to LIGHT mode
  const hasColumnRules = merged.columns && Object.keys(merged.columns).length > 0;
  if (!hasColumnRules) {
    warnings.push({
      code: "NO_RULES",
      msg: "Strict validation skipped. Upload rules.yaml to enable it.",
    });
    return { mode: "LIGHT", cleaned, summary, warnings };
  }

  // Required columns presence check
  const required = new Set<string>([
    ...(merged.required_columns ?? []),
    ...Object.entries(merged.columns!)
      .filter(([, r]) => r.required)
      .map(([k]) => k),
  ]);
  const missing = [...required].filter((c) => !headers.includes(c));
  if (missing.length) {
    warnings.push({
      code: "MISSING_REQUIRED_COLUMNS",
      msg: `Upload is missing required columns: ${missing.join(", ")}`,
    });
    // still return LIGHT mode to allow header cleanup usage
    return { mode: "LIGHT", cleaned, summary, warnings };
  }

  // STRICT validation
  for (let i = 0; i < cleaned.length; i++) {
    const row = cleaned[i];
    for (const [col, val] of Object.entries(row)) {
      const rule = merged.columns![col];
      if (!rule) continue; // ignore unmapped columns

      if (rule.required && (val === null || val === undefined || val === "")) {
        hit(summary, `MISSING_REQUIRED:${col}`, { row: i + 1, col, val });
      }

      if (rule.oneOf && typeof val === "string") {
        const set = new Set(rule.oneOf.map((s) => s.toLowerCase()));
        if (!set.has(val.toLowerCase())) {
          hit(summary, `INVALID_VALUE:${col}`, { row: i + 1, col, val, allowed: rule.oneOf });
        }
      }

      if (rule.pattern && typeof val === "string") {
        try {
          const re = new RegExp(rule.pattern);
          if (!re.test(val)) {
            hit(summary, `PATTERN_MISMATCH:${col}`, { row: i + 1, col, val, pattern: rule.pattern });
          }
        } catch {
          // bad pattern in rules; warn once
          hit(summary, `BAD_PATTERN_RULE:${col}`, { pattern: rule.pattern });
        }
      }
    }
  }

  return { mode: "STRICT", cleaned, summary, warnings };
}

function isObject(a: any) {
  return a && typeof a === "object" && !Array.isArray(a);
}

function deepMerge<T>(a: T, b: Partial<T>): T {
  if (!isObject(a) || !isObject(b)) return (b as T) ?? a;
  const out: any = Array.isArray(a) ? [...(a as any)] : { ...(a as any) };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    if (isObject(v) && isObject((a as any)[k])) out[k] = deepMerge((a as any)[k], v as any);
    else out[k] = v;
  }
  return out as T;
}
