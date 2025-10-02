import { useState } from 'react';
import { DataRow, ChangeLog } from '@/types/data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DataTableProps {
  data: DataRow[];
  onDataChange: (newData: DataRow[], change?: ChangeLog) => void;
  readOnly?: boolean;
}

export const DataTable = ({ data, onDataChange, readOnly = false }: DataTableProps) => {
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  if (data.length === 0) return null;

  const columns = Object.keys(data[0]);

  const handleCellEdit = (rowIndex: number, column: string, newValue: string) => {
    const oldValue = data[rowIndex][column];
    
    if (oldValue === newValue) {
      setEditingCell(null);
      return;
    }

    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [column]: newValue };
    
    const change: ChangeLog = {
      id: `${Date.now()}-${rowIndex}-${column}`,
      rowIndex,
      column,
      oldValue,
      newValue,
      changeType: 'manual',
      timestamp: new Date()
    };

    onDataChange(newData, change);
    setEditingCell(null);
  };

  return (
    <div className="border rounded-lg bg-card">
      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader className="sticky top-0 bg-muted z-10">
            <TableRow>
              <TableHead className="w-16 font-semibold">#</TableHead>
              {columns.map((col) => (
                <TableHead key={col} className="font-semibold min-w-[150px]">
                  {col}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="hover:bg-accent/50">
                <TableCell className="font-medium text-muted-foreground">
                  {rowIndex + 1}
                </TableCell>
                {columns.map((col) => {
                  const isEditing =
                    editingCell?.row === rowIndex && editingCell?.col === col;
                  
                  return (
                    <TableCell
                      key={`${rowIndex}-${col}`}
                      onDoubleClick={() => !readOnly && setEditingCell({ row: rowIndex, col })}
                      className={readOnly ? '' : 'cursor-pointer'}
                    >
                      {isEditing ? (
                        <Input
                          autoFocus
                          defaultValue={String(row[col] || '')}
                          onBlur={(e) => handleCellEdit(rowIndex, col, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCellEdit(rowIndex, col, e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                              setEditingCell(null);
                            }
                          }}
                          className="h-8"
                        />
                      ) : (
                        <span>{String(row[col] || '')}</span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>
      <div className="p-4 border-t bg-muted/50 text-sm text-muted-foreground">
        <p>{readOnly ? 'Read-only preview' : 'Double-click any cell to edit'} • {data.length} rows total</p>
      </div>
    </div>
  );
};
