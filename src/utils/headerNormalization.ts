import { DataRow } from '@/types/data';

/**
 * Header normalization map
 * Maps various header formats to canonical column names
 */
const HEADER_NORMALIZATION_MAP: Record<string, string> = {
  // Channel variations
  'Channel Finance Group': 'ChannelFinanceGroup',
  'channel finance group': 'ChannelFinanceGroup',
  'CHANNEL FINANCE GROUP': 'ChannelFinanceGroup',
  
  // Sub-Channel variations
  'Sub-Channel': 'SubChannel',
  'sub-channel': 'SubChannel',
  'SUB-CHANNEL': 'SubChannel',
  'Sub Channel': 'SubChannel',
  
  // Plan ID variations
  'Plan ID': 'PlanId',
  'plan id': 'PlanId',
  'PLAN ID': 'PlanId',
  'PlanID': 'PlanId',
  
  // FX Year variations
  'FX Year': 'FX_Year',
  'fx year': 'FX_Year',
  'FX_Year': 'FX_Year',
  'fx_year': 'FX_Year',
  
  // Common spacing issues
  ' Total Cost to Client (Local) ': 'Total Cost to Client (Local)',
  ' Total Cost to Client (Global) ': 'Total Cost to Client (Global)',
  ' Budget (Local) ': 'Budget (Local)',
  ' Budget (Global) ': 'Budget (Global)',
};

/**
 * Currency normalization to ISO codes
 */
export const CURRENCY_SYNONYMS: Record<string, string> = {
  // Euro variations
  'eur': 'EUR',
  'euro': 'EUR',
  'euros': 'EUR',
  '€': 'EUR',
  
  // Dollar variations
  'usd': 'USD',
  'dollar': 'USD',
  'dollars': 'USD',
  '$': 'USD',
  
  // Pound variations
  'gbp': 'GBP',
  'pound': 'GBP',
  'pounds': 'GBP',
  '£': 'GBP',
  
  // Danish Krone
  'dkk': 'DKK',
  'kroner': 'DKK',
  'kr': 'DKK',
  
  // Swedish Krona
  'sek': 'SEK',
  
  // Norwegian Krone
  'nok': 'NOK',
  
  // Polish Zloty
  'pln': 'PLN',
  
  // Czech Koruna
  'czk': 'CZK',
};

/**
 * Normalize headers in a data row
 * Trims all headers and maps them to canonical names
 */
export const normalizeHeaders = (row: DataRow): DataRow => {
  const normalized: DataRow = {};
  
  Object.keys(row).forEach(key => {
    const trimmedKey = key.trim();
    const normalizedKey = HEADER_NORMALIZATION_MAP[trimmedKey] || trimmedKey;
    const value = row[key];
    
    // Trim string values and treat empty strings as null
    if (typeof value === 'string') {
      const trimmedValue = value.trim();
      normalized[normalizedKey] = trimmedValue === '' ? null : trimmedValue;
    } else {
      normalized[normalizedKey] = value;
    }
  });
  
  return normalized;
};

/**
 * Normalize currency code to ISO standard
 */
export const normalizeCurrency = (currency: string): string => {
  if (!currency) return '';
  
  const trimmed = currency.trim().toLowerCase();
  return CURRENCY_SYNONYMS[trimmed] || currency.trim().toUpperCase();
};

/**
 * Extract year from filename (e.g., "plans_2024.xlsx" -> "2024")
 */
export const extractYearFromFilename = (filename: string): string => {
  const match = filename.match(/[_\s](\d{4})[._]/);
  return match ? match[1] : '';
};
