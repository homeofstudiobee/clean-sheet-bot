export type Row = Record<string, string | number | null>;
export type Rule =
  | { kind: "rename"; from: string; to: string }
  | { kind: "map"; column: string; map: Record<string, string>; caseInsensitive?: boolean }
  | { kind: "split"; column: string; into: string[]; sep: string }
  | { kind: "join"; columns: string[]; into: string; sep: string }
  | { kind: "regex"; column: string; pattern: string; replace: string }
  | { kind: "required"; column: string }
  | { kind: "lowercase" | "uppercase" | "trim" | "coerceNumber"; column: string }
  | { kind: "dedupeBy"; keys: string[] };

export interface Rules {
  steps: Rule[];
  exceptions?: { match: Partial<Row>; set: Partial<Row> }[];
  taxonomyJoin?: { on: string; taxonomyKey: string; targetColumn: string };
}
