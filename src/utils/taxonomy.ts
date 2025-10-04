// src/utils/taxonomy.ts
export function coerceTaxonomy(raw: Record<string, any>): Record<string, string[]> {
  const out: Record<string,string[]> = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (Array.isArray(v)) {
      if (v.length && typeof v[0] === "object") {
        // take a sensible field or first value
        out[k] = v.map((o:any) =>
          String(o.name ?? o.label ?? o.value ?? o[k] ?? Object.values(o)[0] ?? "")
        );
      } else {
        out[k] = v.map((x:any) => String(x ?? ""));
      }
    } else {
      out[k] = [String(v ?? "")];
    }
  }
  return out;
}
