// Legacy taxonomy validation for Index.tsx
// Validates data rows against taxonomy allowed values

import type { DataRow, ValidationIssue, TaxonomyData } from "@/types/data";

export function validateAgainstTaxonomyLegacy(
  data: DataRow[],
  taxonomy: TaxonomyData,
  columnsToValidate: Record<string, string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  data.forEach((row, rowIndex) => {
    Object.entries(columnsToValidate).forEach(([columnName, taxonomyKey]) => {
      const value = row[columnName];
      const allowedValues = taxonomy[taxonomyKey] || [];

      if (value && typeof value === 'string') {
        const normalizedValue = value.toLowerCase().trim();
        const normalizedAllowed = allowedValues.map(v => v.toLowerCase().trim());

        if (!normalizedAllowed.includes(normalizedValue)) {
          issues.push({
            id: `${rowIndex}-${columnName}-${Date.now()}`,
            rowIndex,
            column: columnName,
            value,
            taxonomyKey,
            timestamp: new Date(),
          });
        }
      }
    });
  });

  return issues;
}
