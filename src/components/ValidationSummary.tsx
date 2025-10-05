import { useMemo } from "react";
import type { CleanupResult } from "@/types/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type Props = { result: CleanupResult };

export default function ValidationSummary({ result }: Props) {
  const rows = useMemo(() => {
    const list: { code: string; count: number; samples: any[] }[] = [];
    for (const [code, b] of Object.entries(result.summary)) list.push({ code, count: b.count, samples: b.samples });
    list.sort((a, b) => b.count - a.count);
    return list;
  }, [result.summary]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Validation mode</span>
        <Badge variant={result.mode === "STRICT" ? "default" : "secondary"}>
          {result.mode}
        </Badge>
      </div>

      {result.warnings.length > 0 && (
        <Card className="p-4">
          <div className="text-sm font-medium mb-2">Warnings</div>
          <ul className="list-disc ml-5 text-sm space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i}>
                <span className="font-mono text-xs">{w.code}</span>: {w.msg}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-medium">Exception summary</div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => downloadSamplesCsv(result)}
          >
            <Download className="h-4 w-4 mr-2" />
            Export samples CSV
          </Button>
        </div>

        <div className="divide-y">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No exceptions found.</div>
          ) : (
            rows.map((r) => (
              <details key={r.code} className="p-4">
                <summary className="cursor-pointer flex items-center justify-between hover:bg-accent/50 -mx-4 px-4 py-2 rounded">
                  <span className="font-mono text-sm">{r.code}</span>
                  <Badge variant="outline">{r.count.toLocaleString()}</Badge>
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border rounded">
                    <thead>
                      <tr className="bg-muted/50">
                        {sampleHeaders(r.samples).map((h) => (
                          <th key={h} className="py-2 px-3 text-left font-medium border-b">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {r.samples.map((s, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {sampleHeaders(r.samples).map((h) => (
                            <td key={h} className="py-2 px-3">
                              {String((s as any)[h] ?? "")}
                            </td>
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
      </Card>
    </div>
  );
}

function sampleHeaders(samples: any[]): string[] {
  const first = samples[0] ?? {};
  return Object.keys(first);
}

function downloadSamplesCsv(result: CleanupResult) {
  const rows: any[] = [];
  let cap = 0;
  for (const [code, b] of Object.entries(result.summary)) {
    for (const s of b.samples) {
      if (cap >= 5000) break;
      rows.push({ code, ...s });
      cap++;
    }
    if (cap >= 5000) break;
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

function toCsv(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const esc = (s: any) => {
    const t = String(s ?? "");
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    const rowValues = headers.map((h) => esc(r[h as keyof typeof r]));
    lines.push(rowValues.join(","));
  }
  return lines.join("\n");
}
