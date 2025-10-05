import { Rules } from "@/types/data";

// Simple column validation rules for CSV cleanup
export const DEFAULT_RULES: Rules = {
  columns: {
    brand: { required: true },
    brand_line: { required: true },
    sku: { required: true, pattern: "^[A-Za-z0-9-_]+$" },
  },
  required_columns: ["brand", "brand_line", "sku"]
};
