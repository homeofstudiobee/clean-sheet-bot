import { DataRow } from '@/types/data';
import { TaxonomyDefinition, ValidationConfig } from '@/types/taxonomyConfig';
import { mapBrand, generateBrandTodoEntry } from './brandMapping';
import { mapCampaign, generateCampaignTodoEntry } from './campaignMapping';
import { lookupCBHT, generateCBHTTodoEntry } from './cbhtMapping';
import { applyDefaults, validateObjective, fillMissingDates, backfillActuals, extractFxYearFromFilename } from './dataCleanup';

export interface ProcessingResult {
  cleanedData: DataRow[];
  exceptions: Array<{
    market: string;
    region: string;
    planId: string;
    planName: string;
    field: string;
    issueType: string;
    currentValue: string;
    suggestedValue: string;
    priority: string;
    owner: string;
  }>;
  todoLists: {
    brands: Array<Record<string, any>>;
    campaigns: Array<Record<string, any>>;
    vendors: Array<Record<string, any>>;
    channels: Array<Record<string, any>>;
    cbht: Array<Record<string, any>>;
  };
}

/**
 * Main data processing pipeline
 * Applies all mappings, validations, and transformations
 */
export const processData = (
  rawData: DataRow[],
  taxonomies: Record<string, TaxonomyDefinition>,
  validationConfig: ValidationConfig,
  validationRules?: any,
  filename?: string
): ProcessingResult => {
  const cleanedData: DataRow[] = [];
  const exceptions: ProcessingResult['exceptions'] = [];
  const todoLists: ProcessingResult['todoLists'] = {
    brands: [],
    campaigns: [],
    vendors: [],
    channels: [],
    cbht: []
  };

  // Get taxonomies
  const brandsTax = taxonomies['brands'];
  const campaignsTax = taxonomies['campaigns'];
  const vendorsTax = taxonomies['vendors'];
  const channelsTax = taxonomies['channels'];
  const fxRatesTax = taxonomies['fx_rates'];
  const cbhtTax = taxonomies['cbht'];

  rawData.forEach((row, rowIndex) => {
    let cleanedRow = { ...row };

    // 0. Apply defaults and temporary fills from YAML rules
    if (validationRules) {
      cleanedRow = applyDefaults(
        cleanedRow,
        validationRules.defaults,
        validationRules.temporary_fills
      );

      // Extract FX_Year from filename if not present
      if (filename && !cleanedRow.FX_Year) {
        cleanedRow.FX_Year = extractFxYearFromFilename(filename);
      }

      // Fill missing dates
      cleanedRow = fillMissingDates(cleanedRow);

      // Backfill actuals for old lines
      cleanedRow = backfillActuals(cleanedRow);

      // Validate Objective
      if (validationRules.allowed_objectives) {
        const objectiveValidation = validateObjective(
          String(cleanedRow.Objective || ''),
          validationRules.allowed_objectives,
          validationRules.defaults?.Objective || 'Other'
        );

        if (!objectiveValidation.isValid) {
          exceptions.push({
            market: String(row.Market || ''),
            region: String(row.Region || ''),
            planId: String(row['Plan ID'] || ''),
            planName: String(row['Plan Name'] || ''),
            field: 'Objective',
            issueType: 'invalid_objective',
            currentValue: String(row.Objective || ''),
            suggestedValue: objectiveValidation.value,
            priority: 'P3',
            owner: 'Analytics'
          });
        }

        cleanedRow.Objective = objectiveValidation.value;
      }
    }

    // 1. Brand Mapping
    if (brandsTax && validationConfig.brand_mapping) {
      const brandResult = mapBrand(cleanedRow, brandsTax, validationConfig.brand_mapping);
      if (brandResult.matched) {
        Object.assign(cleanedRow, brandResult.outputs);
      } else {
        exceptions.push({
          market: String(row.Market || ''),
          region: String(row.Region || ''),
          planId: String(row['Plan ID'] || ''),
          planName: String(row['Plan Name'] || ''),
          field: 'Brand',
          issueType: 'brand_unmapped',
          currentValue: String(row.Brand || ''),
          suggestedValue: '',
          priority: 'P2',
          owner: 'Analytics'
        });
        todoLists.brands.push(generateBrandTodoEntry(row, rowIndex));
      }
    }

    // 2. Campaign Mapping
    if (campaignsTax && validationConfig.campaign_mapping) {
      const campaignResult = mapCampaign(cleanedRow, campaignsTax, validationConfig.campaign_mapping);
      if (campaignResult.matched) {
        Object.assign(cleanedRow, campaignResult.outputs);
      } else {
        exceptions.push({
          market: String(row.Market || ''),
          region: String(row.Region || ''),
          planId: String(row['Plan ID'] || ''),
          planName: String(row['Plan Name'] || ''),
          field: 'Campaign Name',
          issueType: 'campaign_unmapped',
          currentValue: String(row['Campaign Name'] || ''),
          suggestedValue: '',
          priority: 'P3',
          owner: 'Analytics'
        });
        todoLists.campaigns.push(generateCampaignTodoEntry(row, rowIndex));
      }
    }

    // 3. Vendor Mapping
    if (vendorsTax) {
      const vendorMatch = vendorsTax.data.find(v => 
        String(v.raw_vendor || '').trim().toLowerCase() === String(row.Vendor || '').trim().toLowerCase()
      );
      if (vendorMatch) {
        cleanedRow.Vendor_clean = vendorMatch.vendor_clean || '';
        cleanedRow.Vendor_House = vendorMatch.vendor_house || '';
        cleanedRow.Vendor_Type = vendorMatch.vendor_type || '';
      } else {
        cleanedRow.Vendor_clean = '_Placeholder';
        exceptions.push({
          market: String(row.Market || ''),
          region: String(row.Region || ''),
          planId: String(row['Plan ID'] || ''),
          planName: String(row['Plan Name'] || ''),
          field: 'Vendor',
          issueType: 'vendor_unmapped',
          currentValue: String(row.Vendor || ''),
          suggestedValue: '_Placeholder',
          priority: 'P2',
          owner: 'Partnerships'
        });
        todoLists.vendors.push({
          rowIndex,
          raw_vendor: row.Vendor || '',
          vendor_clean: '',
          vendor_house: '',
          vendor_type: ''
        });
      }
    }

    // 4. Channel Mapping
    if (channelsTax) {
      const channelMatch = channelsTax.data.find(c => 
        (String(c['Sub-Channel'] || c.SubChannel || '').trim().toLowerCase() === String(row['Sub-Channel'] || '').trim().toLowerCase()) ||
        (String(c.Channel || '').trim().toLowerCase() === String(row.Channel || '').trim().toLowerCase())
      );
      if (channelMatch) {
        cleanedRow.Channel_clean = channelMatch.Channel || '';
        cleanedRow.SubChannel_clean = channelMatch['Sub-Channel'] || channelMatch.SubChannel || '';
        cleanedRow.ChannelFinanceGroup_clean = channelMatch.ChannelFinanceGroup || '';
        cleanedRow.ExComChannel = channelMatch.ExComChannel || '';
      } else {
        exceptions.push({
          market: String(row.Market || ''),
          region: String(row.Region || ''),
          planId: String(row['Plan ID'] || ''),
          planName: String(row['Plan Name'] || ''),
          field: 'Channel',
          issueType: 'channel_unmapped',
          currentValue: `${row.Channel || ''}|${row['Sub-Channel'] || ''}`,
          suggestedValue: '',
          priority: 'P3',
          owner: 'Analytics'
        });
        todoLists.channels.push({
          rowIndex,
          channel: row.Channel || '',
          subChannel: row['Sub-Channel'] || '',
          channelFinanceGroup: '',
          exComChannel: ''
        });
      }
    }

    // 5. FX Conversion
    if (fxRatesTax && validationConfig.fx_rules) {
      const fxMatch = fxRatesTax.data.find(fx => 
        String(fx.market || '').trim().toLowerCase() === String(row.Market || '').trim().toLowerCase() &&
        String(fx.currency || '').trim().toLowerCase() === String(row.Currency || '').trim().toLowerCase() &&
        String(fx.fx_year || '') === String(row.FX_Year || '')
      );

      if (fxMatch) {
        const fxToEur = parseFloat(String(fxMatch.fx_to_eur || '0'));
        const fxToDkk = parseFloat(String(fxMatch.fx_to_dkk || '0'));
        cleanedRow.Region = fxMatch.region || cleanedRow.Region;

        // Apply FX conversions
        const fxRules = validationConfig.fx_rules;
        if (fxRules.compute_pairs?.eur) {
          fxRules.compute_pairs.eur.forEach(([sourceCol, targetCol]) => {
            const sourceValue = parseFloat(String(row[sourceCol] || '0'));
            cleanedRow[targetCol] = sourceValue * fxToEur;
          });
        }
        if (fxRules.compute_pairs?.dkk) {
          fxRules.compute_pairs.dkk.forEach(([sourceCol, targetCol]) => {
            const sourceValue = parseFloat(String(row[sourceCol] || '0'));
            cleanedRow[targetCol] = sourceValue * fxToDkk;
          });
        }

        // Audit EUR vs Global
        if (fxRules.audit_global_vs_eur?.enabled) {
          const tolerance = fxRules.audit_global_vs_eur.tolerance_ratio || 0.02;
          const checks = [
            ['Total Cost to Client (Global)', 'Planned_Spend_EUR'],
            ['Total Cost to Client Actual (Global)', 'Actualised_Spend_EUR'],
            ['Net Media Cost (Global)', 'Net_Media_EUR']
          ];
          
          checks.forEach(([globalCol, eurCol]) => {
            if (row[globalCol] && cleanedRow[eurCol]) {
              const globalVal = parseFloat(String(row[globalCol]));
              const eurVal = parseFloat(String(cleanedRow[eurCol]));
              if (globalVal > 0 && Math.abs(globalVal - eurVal) / globalVal > tolerance) {
                exceptions.push({
                  market: String(row.Market || ''),
                  region: String(row.Region || ''),
                  planId: String(row['Plan ID'] || ''),
                  planName: String(row['Plan Name'] || ''),
                  field: eurCol,
                  issueType: 'eur_mismatch',
                  currentValue: String(globalVal),
                  suggestedValue: String(eurVal),
                  priority: 'P3',
                  owner: 'Analytics'
                });
              }
            }
          });
        }
      } else {
        exceptions.push({
          market: String(row.Market || ''),
          region: String(row.Region || ''),
          planId: String(row['Plan ID'] || ''),
          planName: String(row['Plan Name'] || ''),
          field: 'FX',
          issueType: 'fx_missing',
          currentValue: `${row.Market || ''}/${row.Currency || ''}/${row.FX_Year || ''}`,
          suggestedValue: '',
          priority: 'P1',
          owner: 'Analytics'
        });
      }
    }

    // 6. CBHT Join
    if (cbhtTax && validationConfig.cbht_rules) {
      const cbhtResult = lookupCBHT(cleanedRow, cbhtTax, validationConfig.cbht_rules.join_keys_order);
      if (cbhtResult.matched && cbhtResult.cbhtData) {
        cleanedRow.CBHT_Brand_League = cbhtResult.cbhtData.brand_league || '';
        cleanedRow.CBHT_Study = cbhtResult.cbhtData.cbht_study || '';
      } else {
        exceptions.push({
          market: String(row.Market || ''),
          region: String(row.Region || ''),
          planId: String(row['Plan ID'] || ''),
          planName: String(row['Plan Name'] || ''),
          field: 'CBHT',
          issueType: 'cbht_missing',
          currentValue: String(cleanedRow.Brand_clean || row.Brand || ''),
          suggestedValue: '',
          priority: 'P3',
          owner: 'Analytics'
        });
        todoLists.cbht.push(generateCBHTTodoEntry(cleanedRow, rowIndex));
      }
    }

    cleanedData.push(cleanedRow);
  });

  return {
    cleanedData,
    exceptions,
    todoLists
  };
};
