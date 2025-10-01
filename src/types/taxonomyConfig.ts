/**
 * Configuration types for hierarchical taxonomy mappings
 * Based on validation_rules.yaml structure
 */

export interface PrecedenceRule {
  keys: string[];  // e.g., ["market", "raw_brand", "raw_variant"]
  outputs?: Record<string, string>;  // Column mappings
}

export interface BrandMappingConfig {
  precedence: string[][];  // Ordered list of key combinations to try
  outputs: {
    brand_clean: string;
    brand_type: string;
    category: string;
    subcategory: string;
    variant: string;
  };
  conflict_hints?: Record<string, string>;  // Regex patterns for disambiguation
}

export interface CampaignMappingConfig {
  precedence: string[][];
  outputs: {
    campaign_clean: string;
    campaign_type: string;
    campaign_subtype: string;
  };
}

export interface FXConversionRule {
  source_column: string;
  target_column: string;
  target_currency: 'DKK' | 'EUR';
}

export interface TaxonomyDefinition {
  name: string;
  key: string;
  type: 'simple' | 'hierarchical' | 'fx-rates' | 'cbht';
  keyColumns: string[];  // Columns used for lookup
  outputColumns: string[];  // Columns to populate
  precedence?: string[][];  // For hierarchical lookups
  data: Record<string, any>[];  // Actual taxonomy data
}

export interface ValidationConfig {
  allowed_objectives?: string[];
  defaults?: Record<string, any>;
  brand_mapping?: BrandMappingConfig;
  campaign_mapping?: CampaignMappingConfig;
  fx_rules?: {
    compute_pairs: {
      dkk?: [string, string][];
      eur?: [string, string][];
    };
    audit_global_vs_eur?: {
      enabled: boolean;
      tolerance_ratio: number;
    };
  };
  cbht_rules?: {
    join_keys_order: string[][];
  };
}

export interface UnmappedItem {
  id: string;
  type: 'brand' | 'campaign' | 'vendor' | 'channel' | 'cbht';
  rowIndex: number;
  keys: Record<string, string>;  // The key values that failed to match
  suggestedOutputs?: Record<string, string>;  // Pre-filled suggestions
}
