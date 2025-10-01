import { TaxonomyDefinition } from '@/types/taxonomyConfig';
import { DataRow } from '@/types/data';

/**
 * FX rate lookup and conversion
 * Matches by (market, currency, fx_year)
 */
export const lookupFXRate = (
  market: string,
  currency: string,
  fxYear: string,
  fxRatesTaxonomy: TaxonomyDefinition
): { toDKK: number; toEUR: number } | null => {
  const marketLower = market.trim().toLowerCase();
  const currencyLower = currency.trim().toLowerCase();
  const yearStr = fxYear.trim();
  
  const match = fxRatesTaxonomy.data.find(entry => {
    return (
      String(entry.market || '').trim().toLowerCase() === marketLower &&
      String(entry.currency || '').trim().toLowerCase() === currencyLower &&
      String(entry.fx_year || '').trim() === yearStr
    );
  });
  
  if (!match) return null;
  
  return {
    toDKK: parseFloat(match.rate_to_dkk || match.to_dkk || 0),
    toEUR: parseFloat(match.rate_to_eur || match.to_eur || 0)
  };
};

/**
 * Apply FX conversions to a row based on configuration
 */
export const applyFXConversions = (
  row: DataRow,
  fxRatesTaxonomy: TaxonomyDefinition,
  conversions: { dkk?: [string, string][]; eur?: [string, string][] }
): { row: DataRow; issues: string[] } => {
  const issues: string[] = [];
  const market = String(row.Market || row.market || '');
  const currency = String(row.Currency || row.currency || '');
  const fxYear = String(row.FX_Year || row['FX Year'] || row.fx_year || '');
  
  const rates = lookupFXRate(market, currency, fxYear, fxRatesTaxonomy);
  
  if (!rates) {
    issues.push(`FX rate not found for ${market}/${currency}/${fxYear}`);
    return { row, issues };
  }
  
  const updatedRow = { ...row };
  
  // Apply DKK conversions
  if (conversions.dkk) {
    for (const [sourceCol, targetCol] of conversions.dkk) {
      const sourceValue = parseFloat(String(row[sourceCol] || 0));
      if (sourceValue) {
        updatedRow[targetCol] = sourceValue * rates.toDKK;
      }
    }
  }
  
  // Apply EUR conversions
  if (conversions.eur) {
    for (const [sourceCol, targetCol] of conversions.eur) {
      const sourceValue = parseFloat(String(row[sourceCol] || 0));
      if (sourceValue) {
        updatedRow[targetCol] = sourceValue * rates.toEUR;
      }
    }
  }
  
  return { row: updatedRow, issues };
};

/**
 * Audit global vs EUR values with tolerance check
 */
export const auditGlobalVsEUR = (
  row: DataRow,
  tolerance: number = 0.02
): { passed: boolean; deviation?: number } => {
  const globalValue = parseFloat(String(row['Total Cost to Client (Global)'] || row.global_spend || 0));
  const eurValue = parseFloat(String(row['Planned_Spend_EUR'] || row.planned_spend_eur || 0));
  
  if (!globalValue || !eurValue) {
    return { passed: true }; // Skip if either is missing
  }
  
  const deviation = Math.abs((globalValue - eurValue) / eurValue);
  
  return {
    passed: deviation <= tolerance,
    deviation
  };
};
