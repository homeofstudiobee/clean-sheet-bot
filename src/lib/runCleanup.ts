// src/lib/runCleanup.ts
import { decodeText, parseCsvFromText } from "@/utils/csv";
import { validateAgainstTaxonomy } from "@/utils/validation";
import type { Rules, CleanupResult } from "@/types/data";

export async function runCleanup(file: File, rulesYamlFile?: File | null): Promise<CleanupResult> {
  const buf = await file.arrayBuffer();
  const text = decodeText(buf);
  const parsed = parseCsvFromText(text);

  let rules: Rules | null = null;
  if (rulesYamlFile) {
    try {
      const yamlText = await rulesYamlFile.text();
      const { default: YAML } = await import("js-yaml");
      rules = (YAML.load(yamlText) ?? null) as Rules | null;
    } catch {
      rules = null;
    }
  }

  const out = validateAgainstTaxonomy(parsed.rows, parsed.headers, rules);
  return { ...out, delimiter: parsed.delimiter, headers: parsed.headers };
}
