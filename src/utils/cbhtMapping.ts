import { TaxonomyDefinition } from '@/types/taxonomyConfig';
import { DataRow } from '@/types/data';

/**
 * CBHT (Cost per Brand, Market, Year) join logic
 * Tries multiple key combinations in precedence order
 */
export const lookupCBHT = (
  row: DataRow,
  cbhtTaxonomy: TaxonomyDefinition,
  precedence: string[][]
): { matched: boolean; cbhtData?: Record<string, any> } => {
  
  for (const keyCombo of precedence) {
    const lookupKey = keyCombo.map(k => {
      const value = String(row[k] || '').trim().toLowerCase();
      return value;
    });
    
    if (lookupKey.some(v => !v)) continue;
    
    const match = cbhtTaxonomy.data.find(entry => {
      return keyCombo.every((keyName, idx) => {
        const entryValue = String(entry[keyName] || '').trim().toLowerCase();
        return entryValue === lookupKey[idx];
      });
    });
    
    if (match) {
      return {
        matched: true,
        cbhtData: match
      };
    }
  }
  
  return {
    matched: false
  };
};

/**
 * Generate a "todo" entry for missing CBHT data
 */
export const generateCBHTTodoEntry = (
  row: DataRow,
  rowIndex: number
): Record<string, any> => {
  return {
    rowIndex,
    brand: row.Brand_clean || row.Brand || row.brand || '',
    market: row.Market || row.market || '',
    fx_year: row.FX_Year || row['FX Year'] || row.fx_year || '',
    // Empty columns for manual filling
    cbht_value: '',
    notes: ''
  };
};
