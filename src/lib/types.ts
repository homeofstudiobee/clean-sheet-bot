export type Row = Record<string, any>;

export type Rule =
  | { kind: "rename"; from: string; to: string }
  | { kind: "map"; column: string; map: Record<string, any>; caseInsensitive?: boolean }
  | { kind: "split"; column: string; sep: string; into: string[] }
  | { kind: "join"; columns: string[]; sep: string; into: string }
  | { kind: "regex"; column: string; pattern: string; replace: string }
  | { kind: "required"; column: string }
  | { kind: "lowercase"; column: string }
  | { kind: "uppercase"; column: string }
  | { kind: "trim"; column: string }
  | { kind: "coerceNumber"; column: string }
  | { kind: "dedupeBy"; keys: string[] };

export interface Rules {
  steps: Rule[];
  exceptions?: Array<{ match: Record<string, any>; set: Record<string, any> }>;
  taxonomyJoin?: { on: string; taxonomyKey: string; targetColumn: string };
}
