import { DataRow, ChangeLog, CleanupRule } from '@/types/data';

export const applyCleanupRules = (
  data: DataRow[],
  rules: CleanupRule[]
): { cleanedData: DataRow[]; changes: ChangeLog[] } => {
  let cleanedData = JSON.parse(JSON.stringify(data)) as DataRow[];
  const changes: ChangeLog[] = [];

  rules.forEach(rule => {
    if (!rule.enabled) return;

    cleanedData = cleanedData.map((row, rowIndex) => {
      const newRow = { ...row };
      
      rule.columns.forEach(column => {
        if (!(column in row)) return;
        
        const oldValue = row[column];
        let newValue = oldValue;

        switch (rule.type) {
          case 'trim':
            if (typeof oldValue === 'string') {
              newValue = oldValue.trim();
            }
            break;
          
          case 'uppercase':
            if (typeof oldValue === 'string') {
              newValue = oldValue.toUpperCase();
            }
            break;
          
          case 'lowercase':
            if (typeof oldValue === 'string') {
              newValue = oldValue.toLowerCase();
            }
            break;
          
          case 'remove-special-chars':
            if (typeof oldValue === 'string') {
              newValue = oldValue.replace(/[^a-zA-Z0-9\s]/g, '');
            }
            break;
        }

        if (oldValue !== newValue) {
          changes.push({
            id: `${Date.now()}-${rowIndex}-${column}`,
            rowIndex,
            column,
            oldValue,
            newValue,
            changeType: 'automated',
            timestamp: new Date(),
            rule: rule.name
          });
          newRow[column] = newValue;
        }
      });

      return newRow;
    });
  });

  // Remove duplicates if rule exists
  const duplicateRule = rules.find(r => r.type === 'remove-duplicates' && r.enabled);
  if (duplicateRule) {
    const seen = new Set<string>();
    const uniqueData: DataRow[] = [];
    
    cleanedData.forEach((row, index) => {
      const key = JSON.stringify(row);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueData.push(row);
      } else {
        changes.push({
          id: `${Date.now()}-${index}-duplicate`,
          rowIndex: index,
          column: 'ALL',
          oldValue: 'Duplicate Row',
          newValue: 'Removed',
          changeType: 'automated',
          timestamp: new Date(),
          rule: duplicateRule.name
        });
      }
    });
    
    cleanedData = uniqueData;
  }

  return { cleanedData, changes };
};
