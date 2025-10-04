import { Rules } from "@/lib/types";

export const DEFAULT_RULES: Rules = {
  steps: [
    { kind: "rename", from: "Brand Name", to: "brand" },
    { kind: "rename", from: "Line", to: "brand_line" },
    { kind: "trim", column: "brand" },
    { kind: "trim", column: "brand_line" },
    { kind: "lowercase", column: "brand" },
    { kind: "regex", column: "sku", pattern: "\\s+", replace: "" },
    { kind: "required", column: "brand" },
    { kind: "required", column: "sku" },
    { kind: "dedupeBy", keys: ["brand","brand_line","sku"] },
  ],
  exceptions: [
    { match: { brand: "ohuhu", sku: "bv38" }, set: { brand_line: "Honolulu" } },
  ],
  taxonomyJoin: { on: "brand", taxonomyKey: "brand", targetColumn: "brand_group" },
};
