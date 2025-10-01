import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { DataRow, ChangeLog } from '@/types/data';

export const importFile = (file: File): Promise<DataRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        
        if (file.name.endsWith('.csv')) {
          Papa.parse(file, {
            header: true,
            complete: (results) => {
              resolve(results.data as DataRow[]);
            },
            error: (error) => {
              reject(error);
            }
          });
        } else {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet) as DataRow[];
          resolve(jsonData);
        }
      } catch (error) {
        reject(error);
      }
    };
    
    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
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
