import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { TaxonomyDefinition, ValidationConfig } from '@/types/taxonomyConfig';
import { readFileWithEncoding } from './fileEncoding';

/**
 * Load taxonomy from CSV/Excel file
 */
export const loadTaxonomyFile = async (
  file: File,
  taxonomyType: string
): Promise<TaxonomyDefinition> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  let data: Record<string, any>[] = [];

  if (fileExtension === 'csv') {
    const text = await readFileWithEncoding(file);
    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false
    });
    data = parsed.data as Record<string, any>[];
  } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    data = XLSX.utils.sheet_to_json(firstSheet, { raw: false, defval: '' });
  }

  // Normalize column names and trim values
  const normalized = data.map(row => {
    const newRow: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = key.trim();
      newRow[normalizedKey] = typeof value === 'string' ? value.trim() : value;
    }
    return newRow;
  });

  // Determine taxonomy configuration
  const config = getTaxonomyConfig(taxonomyType, normalized);

  return {
    ...config,
    data: normalized
  };
};

/**
 * Get taxonomy configuration based on type
 */
const getTaxonomyConfig = (
  type: string,
  data: Record<string, any>[]
): Omit<TaxonomyDefinition, 'data'> => {
  const firstRow = data[0] || {};
  const columns = Object.keys(firstRow);

  switch (type) {
    case 'brands':
      return {
        name: 'Brands',
        key: 'brands',
        type: 'hierarchical',
        keyColumns: ['raw_brand', 'raw_variant', 'market'],
        outputColumns: columns,
        precedence: [
          ['market', 'raw_brand', 'raw_variant'],
          ['market', 'raw_brand'],
          ['raw_brand', 'raw_variant'],
          ['raw_brand']
        ]
      };

    case 'campaigns':
      return {
        name: 'Campaigns',
        key: 'campaigns',
        type: 'hierarchical',
        keyColumns: ['raw_campaign', 'market', 'brand'],
        outputColumns: columns,
        precedence: [
          ['market', 'brand', 'raw_campaign'],
          ['market', 'raw_campaign'],
          ['brand', 'raw_campaign'],
          ['raw_campaign']
        ]
      };

    case 'vendors':
      return {
        name: 'Vendors',
        key: 'vendors',
        type: 'simple',
        keyColumns: ['raw_vendor'],
        outputColumns: columns
      };

    case 'channels':
      return {
        name: 'Channels',
        key: 'channels',
        type: 'simple',
        keyColumns: ['Channel', 'Sub-Channel', 'SubChannel'],
        outputColumns: columns
      };

    case 'fx_rates':
      return {
        name: 'FX Rates',
        key: 'fx_rates',
        type: 'fx-rates',
        keyColumns: ['market', 'currency', 'fx_year'],
        outputColumns: columns
      };

    case 'cbht':
      return {
        name: 'CBHT',
        key: 'cbht',
        type: 'cbht',
        keyColumns: ['brand', 'market', 'fx_year'],
        outputColumns: columns,
        precedence: [
          ['Brand_clean', 'Market', 'FX_Year'],
          ['Brand_clean', 'Market'],
          ['Brand_clean']
        ]
      };

    default:
      return {
        name: type,
        key: type,
        type: 'simple',
        keyColumns: columns.slice(0, 2),
        outputColumns: columns
      };
  }
};

/**
 * Export taxonomy to CSV
 */
export const exportTaxonomyToCSV = (taxonomy: TaxonomyDefinition): void => {
  const csv = Papa.unparse(taxonomy.data, {
    quotes: true,
    header: true
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${taxonomy.key}.csv`;
  link.click();
};

/**
 * Create default validation config
 */
export const createDefaultValidationConfig = (): ValidationConfig => {
  return {
    allowed_objectives: ['Awareness', 'Consideration', 'Engagement', 'Loyalty', 'Sales/Trial'],
    defaults: {
      'Plan Status': 'Planned',
      'Buying Model': 'Fixed Cost',
      Innovation: 'No',
      'Inventory Buy': 'No',
      'Creative Source': 'Locally Produced Asset'
    },
    brand_mapping: {
      precedence: [
        ['market', 'raw_brand', 'raw_variant'],
        ['market', 'raw_brand'],
        ['raw_brand', 'raw_variant'],
        ['raw_brand']
      ],
      outputs: {
        brand_clean: 'Brand_clean',
        brand_type: 'Brand_Type',
        category: 'Category_clean',
        subcategory: 'SubCategory_clean',
        variant: 'Variant_clean'
      },
      conflict_hints: {
        Carlsberg: '(?i)\\bcarlsberg\\b',
        Tuborg: '(?i)\\btuborg\\b',
        '1664': '(?i)\\b1664\\b'
      }
    },
    campaign_mapping: {
      precedence: [
        ['market', 'brand', 'raw_campaign'],
        ['market', 'raw_campaign'],
        ['brand', 'raw_campaign']
      ],
      outputs: {
        campaign_clean: 'Campaign_clean',
        campaign_type: 'Campaign_Type',
        campaign_subtype: 'Campaign_SubType'
      }
    },
    fx_rules: {
      compute_pairs: {
        dkk: [
          ['Net Media Cost (Local)', 'Net_Media_DKK'],
          ['Total Cost to Client (Local)', 'Planned_Spend_DKK'],
          ['Total Cost to Client Actual (Local)', 'Actualised_Spend_DKK']
        ],
        eur: [
          ['Net Media Cost (Local)', 'Net_Media_EUR'],
          ['Total Cost to Client (Local)', 'Planned_Spend_EUR'],
          ['Total Cost to Client Actual (Local)', 'Actualised_Spend_EUR']
        ]
      },
      audit_global_vs_eur: {
        enabled: true,
        tolerance_ratio: 0.02
      }
    },
    cbht_rules: {
      join_keys_order: [
        ['Brand_clean', 'Market', 'FX_Year'],
        ['Brand_clean', 'Market'],
        ['Brand_clean']
      ]
    }
  };
};
