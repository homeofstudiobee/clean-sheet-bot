import { TaxonomyDefinition, CampaignMappingConfig } from '@/types/taxonomyConfig';
import { DataRow } from '@/types/data';

/**
 * Hierarchical campaign mapping with precedence rules
 * Similar to brand mapping but for campaigns
 */
export const mapCampaign = (
  row: DataRow,
  campaignsTaxonomy: TaxonomyDefinition,
  config: CampaignMappingConfig
): { matched: boolean; outputs: Record<string, string> } => {
  const { precedence, outputs } = config;
  
  // Try each precedence rule in order
  for (const keyCombo of precedence) {
    const lookupKey = keyCombo.map(k => {
      const value = String(row[k] || '').trim().toLowerCase();
      return value;
    });
    
    if (lookupKey.some(v => !v)) continue;
    
    const match = campaignsTaxonomy.data.find(entry => {
      return keyCombo.every((keyName, idx) => {
        const entryValue = String(entry[keyName] || '').trim().toLowerCase();
        return entryValue === lookupKey[idx];
      });
    });
    
    if (match) {
      return {
        matched: true,
        outputs: {
          [outputs.campaign_clean]: match[outputs.campaign_clean] || '',
          [outputs.campaign_type]: match[outputs.campaign_type] || '',
          [outputs.campaign_subtype]: match[outputs.campaign_subtype] || '',
        }
      };
    }
  }
  
  return {
    matched: false,
    outputs: {}
  };
};

/**
 * Generate a "todo" entry for unmapped campaigns
 */
export const generateCampaignTodoEntry = (
  row: DataRow,
  rowIndex: number
): Record<string, any> => {
  return {
    rowIndex,
    market: row.Market || row.market || '',
    brand: row.Brand || row.brand || '',
    raw_campaign: row.Campaign || row.campaign || '',
    // Empty columns for manual filling
    Campaign_clean: '',
    Campaign_Type: '',
    Campaign_SubType: ''
  };
};
