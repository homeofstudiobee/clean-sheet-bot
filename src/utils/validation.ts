import { DataRow, ValidationIssue, TaxonomyData } from '@/types/data';

export const validateAgainstTaxonomy = (
  data: DataRow[],
  taxonomy: TaxonomyData,
  columnsToValidate: Record<string, string> // column name -> taxonomy key
): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];

  data.forEach((row, rowIndex) => {
    Object.entries(columnsToValidate).forEach(([column, taxonomyKey]) => {
      if (!(column in row)) return;
      
      const value = row[column];
      const taxonomyValues = taxonomy[taxonomyKey] || [];
      
      if (value && !taxonomyValues.includes(String(value))) {
        issues.push({
          id: `${Date.now()}-${rowIndex}-${column}`,
          rowIndex,
          column,
          value,
          taxonomyKey,
          timestamp: new Date()
        });
      }
    });
  });

  return issues;
};
