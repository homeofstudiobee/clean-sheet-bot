import { TaxonomyDefinition, BrandMappingConfig } from '@/types/taxonomyConfig';
import { DataRow } from '@/types/data';

/**
 * Hierarchical brand mapping with precedence rules
 * Tries multiple key combinations in order until a match is found
 */
export const mapBrand = (
  row: DataRow,
  brandsTaxonomy: TaxonomyDefinition,
  config: BrandMappingConfig
): { matched: boolean; outputs: Record<string, string> } => {
  const { precedence, outputs } = config;
  
  // Try each precedence rule in order
  for (const keyCombo of precedence) {
    // Build lookup key from row data
    const lookupKey = keyCombo.map(k => {
      const value = String(row[k] || '').trim().toLowerCase();
      return value;
    });
    
    // Skip if any key is missing
    if (lookupKey.some(v => !v)) continue;
    
    // Find matching entry in taxonomy
    const match = brandsTaxonomy.data.find(entry => {
      return keyCombo.every((keyName, idx) => {
        const entryValue = String(entry[keyName] || '').trim().toLowerCase();
        return entryValue === lookupKey[idx];
      });
    });
    
    if (match) {
      // Return mapped outputs
      return {
        matched: true,
        outputs: {
          [outputs.brand_clean]: match[outputs.brand_clean] || '',
          [outputs.brand_type]: match[outputs.brand_type] || '',
          [outputs.category]: match[outputs.category] || '',
          [outputs.subcategory]: match[outputs.subcategory] || '',
          [outputs.variant]: match[outputs.variant] || '',
        }
      };
    }
  }
  
  // No match found
  return {
    matched: false,
    outputs: {}
  };
};

/**
 * Apply conflict hints using regex patterns
 * Useful for disambiguating similar brand names
 */
export const applyConflictHints = (
  value: string,
  hints: Record<string, string>
): string | null => {
  for (const [brand, pattern] of Object.entries(hints)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(value)) {
      return brand;
    }
  }
  return null;
};

/**
 * Generate a "todo" entry for unmapped brands
 */
export const generateBrandTodoEntry = (
  row: DataRow,
  rowIndex: number
): Record<string, any> => {
  return {
    rowIndex,
    market: row.Market || row.market || '',
    raw_brand: row.Brand || row.brand || '',
    raw_variant: row.Variant || row.variant || '',
    // Empty columns for manual filling
    Brand_clean: '',
    Brand_Type: '',
    Category_clean: '',
    SubCategory_clean: '',
    Variant_clean: ''
  };
};
