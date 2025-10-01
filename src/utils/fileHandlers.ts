import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DataRow, ChangeLog } from '@/types/data';
import { readFileWithEncoding, normalizeColumnName } from './fileEncoding';

export const importFile = (file: File): Promise<DataRow[]> => {
  return new Promise(async (resolve, reject) => {
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();

      if (fileExtension === 'csv') {
        const text = await readFileWithEncoding(file);
        Papa.parse(text, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          transformHeader: (header) => normalizeColumnName(header),
          complete: (results) => {
            resolve(results.data as DataRow[]);
          },
          error: (error) => {
            reject(error);
          },
        });
      } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { 
              type: 'array',
              cellText: false,
              cellDates: true,
              raw: false
            });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet, {
              raw: false,
              defval: ''
            });
            
            // Normalize column names
            const normalized = jsonData.map((row: any) => {
              const newRow: any = {};
              for (const [key, value] of Object.entries(row)) {
                newRow[normalizeColumnName(key)] = value;
              }
              return newRow;
            });
            
            resolve(normalized as DataRow[]);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file);
      } else {
        reject(new Error('Unsupported file format'));
      }
    } catch (error) {
      reject(error);
    }
  });
};

export const exportToExcel = (data: DataRow[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, filename);
};

export const exportChangeLog = (changes: ChangeLog[], filename: string) => {
  const changeData = changes.map(change => ({
    'Row Index': change.rowIndex + 1,
    'Column': change.column,
    'Old Value': change.oldValue,
    'New Value': change.newValue,
    'Change Type': change.changeType,
    'Rule Applied': change.rule || 'Manual Edit',
    'Timestamp': change.timestamp.toLocaleString()
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(changeData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Change Log');
  XLSX.writeFile(workbook, filename);
};
