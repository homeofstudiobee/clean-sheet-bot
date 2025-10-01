import * as XLSX from 'xlsx';

/**
 * Robust file reading with multiple encoding fallback strategies
 * Handles special characters, BOM markers, and various encodings
 */
export const readFileWithEncoding = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        let text = e.target?.result as string;
        
        // Remove BOM if present (UTF-8, UTF-16LE, UTF-16BE)
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        
        // Clean up any null characters
        text = text.replace(/\0/g, '');
        
        resolve(text);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    
    // Try UTF-8 first (most common)
    reader.readAsText(file, 'UTF-8');
  });
};

/**
 * Read Excel file with proper handling of special characters
 */
export const readExcelWithEncoding = async (file: File): Promise<any[][]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { 
          type: 'array',
          cellText: false,
          cellDates: true,
          raw: false // This helps with special characters
        });
        
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { 
          header: 1,
          raw: false,
          defval: ''
        });
        
        resolve(jsonData as any[][]);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Sanitize text for safe display and processing
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  
  return String(text)
    .trim()
    // Replace multiple whitespace with single space
    .replace(/\s+/g, ' ')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
};

/**
 * Normalize column names for consistency
 */
export const normalizeColumnName = (name: string): string => {
  return sanitizeText(name)
    .replace(/\s+/g, ' ')
    .trim();
};
