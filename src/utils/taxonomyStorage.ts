import { TaxonomyDefinition } from '@/types/taxonomyConfig';

const STORAGE_KEY = 'lovable_taxonomies_cache';

export interface TaxonomyCache {
  taxonomies: Record<string, TaxonomyDefinition>;
  timestamp: number;
}

/**
 * Save taxonomies to localStorage
 */
export const saveTaxonomies = (taxonomies: Record<string, TaxonomyDefinition>): void => {
  try {
    const cache: TaxonomyCache = {
      taxonomies,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error('Failed to save taxonomies to storage:', error);
  }
};

/**
 * Load taxonomies from localStorage
 */
export const loadTaxonomies = (): Record<string, TaxonomyDefinition> | null => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    
    const cache: TaxonomyCache = JSON.parse(cached);
    return cache.taxonomies;
  } catch (error) {
    console.error('Failed to load taxonomies from storage:', error);
    return null;
  }
};

/**
 * Clear all cached taxonomies
 */
export const clearTaxonomies = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear taxonomies:', error);
  }
};

/**
 * Get cache timestamp
 */
export const getCacheTimestamp = (): number | null => {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    
    const cache: TaxonomyCache = JSON.parse(cached);
    return cache.timestamp;
  } catch (error) {
    return null;
  }
};
