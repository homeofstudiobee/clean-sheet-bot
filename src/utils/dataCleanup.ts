import { DataRow } from '@/types/data';

// For backward compatibility with old Index.tsx
export const applyCleanupRules = (data: DataRow[], rules: any[]) => {
  return { cleanedData: data, changes: [] };
};

/**
 * Apply default values and temporary fills to a row
 */
export const applyDefaults = (
  row: DataRow,
  defaults: Record<string, any>,
  temporaryFills: Record<string, any>
): DataRow => {
  const cleanedRow = { ...row };

  // First apply defaults for any missing/blank values
  if (defaults) {
    Object.keys(defaults).forEach(key => {
      const value = cleanedRow[key];
      if (value === null || value === undefined || value === '') {
        cleanedRow[key] = defaults[key];
      }
    });
  }

  // Then apply temporary fills (overrides defaults)
  if (temporaryFills) {
    Object.keys(temporaryFills).forEach(key => {
      const value = cleanedRow[key];
      if (value === null || value === undefined || value === '') {
        cleanedRow[key] = temporaryFills[key];
      }
    });
  }

  return cleanedRow;
};

/**
 * Validate objective against allowed list
 */
export const validateObjective = (
  objective: string,
  allowedObjectives: string[],
  fallback: string
): { value: string; isValid: boolean } => {
  if (!allowedObjectives || allowedObjectives.length === 0) {
    return { value: objective, isValid: true };
  }

  const normalized = String(objective || '').trim().toLowerCase();
  const isValid = allowedObjectives.some(
    allowed => String(allowed).trim().toLowerCase() === normalized
  );

  return {
    value: isValid ? objective : fallback,
    isValid
  };
};

/**
 * Extract FX_Year from filename (e.g., "plans_2024.xlsx" -> "2024")
 */
export const extractFxYearFromFilename = (filename: string): string => {
  const match = filename.match(/(\d{4})/);
  return match ? match[1] : '';
};

/**
 * Fill missing dates with placeholder logic
 */
export const fillMissingDates = (row: DataRow): DataRow => {
  const cleanedRow = { ...row };
  
  if (!cleanedRow['Start Date'] || cleanedRow['Start Date'] === '') {
    cleanedRow['Start Date'] = '2024-01-01'; // Default placeholder
  }
  
  if (!cleanedRow['End Date'] || cleanedRow['End Date'] === '') {
    cleanedRow['End Date'] = '2024-12-31'; // Default placeholder
  }

  return cleanedRow;
};

/**
 * Backfill actuals from planned values for old lines
 */
export const backfillActuals = (row: DataRow): DataRow => {
  const cleanedRow = { ...row };
  const endDate = cleanedRow['End Date'];
  
  if (!endDate) return cleanedRow;

  try {
    const endDateObj = new Date(String(endDate));
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // If line ended more than 30 days ago and actuals are missing
    if (endDateObj < thirtyDaysAgo) {
      // Backfill Local
      if (!cleanedRow['Total Cost to Client Actual (Local)'] && cleanedRow['Total Cost to Client (Local)']) {
        cleanedRow['Total Cost to Client Actual (Local)'] = cleanedRow['Total Cost to Client (Local)'];
      }
      
      // Backfill Global
      if (!cleanedRow['Total Cost to Client Actual (Global)'] && cleanedRow['Total Cost to Client (Global)']) {
        cleanedRow['Total Cost to Client Actual (Global)'] = cleanedRow['Total Cost to Client (Global)'];
      }
    }
  } catch (error) {
    // Invalid date format, skip backfill
  }

  return cleanedRow;
};
