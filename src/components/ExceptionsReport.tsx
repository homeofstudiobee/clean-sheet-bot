// src/components/ExceptionsReport.tsx
import { useMemo } from "react";
import type { IssueSummary, CleanupResult } from "@/types/data";

type Primitive = string | number | boolean | null | undefined;
type SampleRow = Record<string, Primitive>;

type Props = {
  summary?: IssueSummary;
  mode?: CleanupResult["mode"];
  warnings?: { code: string; msg: string }[];
  // legacy fallback
  exceptions?: SampleRow[];
};

export const ExceptionsReport = ({ summary, mode = "LIGHT", warnings = [], exceptions = [] }: Props) => {
  const rows = useMemo(() => {
    const list: { code: string; count: number; samples: SampleRow[] }[] = [];
    const s = summary ?? {};
    for (const [code, b] of Object.entries(s)) {
      list.push({ code, count: b.count, samples: b.samples as SampleRow[] });
    }
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [summary]);

  const sampleHeaders = (samples: SampleRow[]): string[] => {
    const set = new Set<string>();
    samples.forEach((r) => Object.keys(r).forEach((k) => set.add(k)));
    return Array.from(set);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Validation mode</span>
        <span className={`px-2 py-1 text-xs rounded-full ${mode === "STRICT" ? "bg-emerald-100" : "bg-slate-100"}`}>
          {mode}
        </span>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-lg border p-3">
          <div className="text-sm font-medium mb-1">Warnings</div>
          <ul className="list-disc ml-5 text-sm">
            {warnings.map((w, i) => (
              <li key={i}><span className="font-mono">{w.code}</span>: {w.msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border">
        <div className="flex items-center justify-between p-3">
          <div className="font-medium">Exception summary</div>
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); downloadSamplesCsv(summary ?? {}, exceptions); }}
            className="text-sm underline"
          >
            Export samples CSV
          </a>
        </div>

        <div className="divide-y">
          {rows.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">No exceptions.</div>
          ) : (
            rows.map((r) => (
              <details key={r.code} className="p-3">
                <summary className="cursor-pointer flex items-center justify-between">
                  <span className="font-mono">{r.code}</span>
                  <span className="text-sm">{r.count.toLocaleString()}</span>
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left">
                        {sampleHeaders(r.samples).map((h) => (
                          <th key={h} className="py-1 pr-4 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.samples.map((s, i) => (
                        <tr key={i} className="border-t">
                          {sampleHeaders(r.samples).map((h) => (
                            <td key={h} className="py-1 pr-4">{String(s[h] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

function downloadSamplesCsv(summary: IssueSummary, legacyExceptions: SampleRow[]) {
  const rows: SampleRow[] = [];
  let cap = 0;

  for (const [code, b] of Object.entries(summary)) {
    for (const s of b.samples as SampleRow[]) {
      if (cap >= 5000) break;
      rows.push({ code, ...s });
      cap++;
    }
    if (cap >= 5000) break;
  }

  if (rows.length === 0 && legacyExceptions.length > 0) {
    const lim = Math.min(legacyExceptions.length, 5000);
    rows.push(...legacyExceptions.slice(0, lim));
  }

  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "exception_samples.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: SampleRow[]): string {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((set, r) => { Object.keys(r).forEach((k) => set.add(k)); return set; }, new Set<string>())
  );
  const esc = (s: Primitive) => {
    const t = String(s ?? "");
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(headers.map((h) => esc(r[h])).join(","));
  return lines.join("\n");
}