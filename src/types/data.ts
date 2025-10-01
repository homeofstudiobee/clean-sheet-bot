export interface DataRow {
  [key: string]: string | number | null;
}

export interface ChangeLog {
  id: string;
  rowIndex: number;
  column: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  changeType: 'automated' | 'manual';
  timestamp: Date;
  rule?: string;
}

export interface CleanupRule {
  id: string;
  name: string;
  enabled: boolean;
  type: 'trim' | 'uppercase' | 'lowercase' | 'remove-duplicates' | 'standardize-date' | 'remove-special-chars' | 'validate-taxonomy' | 'custom';
  columns: string[];
  description: string;
  taxonomyKey?: string;
}

export interface TaxonomyData {
  [key: string]: string[];
}

export interface ValidationIssue {
  id: string;
  rowIndex: number;
  column: string;
  value: string | number | null;
  taxonomyKey: string;
  timestamp: Date;
}
