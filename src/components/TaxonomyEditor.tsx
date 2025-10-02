import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Save, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { TaxonomyDefinition } from '@/types/taxonomyConfig';

interface TaxonomyEditorProps {
  taxonomy: TaxonomyDefinition;
  onUpdate: (updatedTaxonomy: TaxonomyDefinition) => void;
  onExport: (taxonomy: TaxonomyDefinition) => void;
}

export const TaxonomyEditor: React.FC<TaxonomyEditorProps> = ({
  taxonomy,
  onUpdate,
  onExport
}) => {
  const [editingData, setEditingData] = useState(taxonomy.data);
  const [searchTerm, setSearchTerm] = useState('');

  const columns = taxonomy.outputColumns.length > 0 
    ? taxonomy.outputColumns 
    : taxonomy.keyColumns;

  const filteredData = searchTerm
    ? editingData.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    : editingData;

  const handleAddRow = () => {
    const newRow: Record<string, any> = {};
    columns.forEach(col => {
      newRow[col] = '';
    });
    setEditingData([...editingData, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = editingData.filter((_, i) => i !== index);
    setEditingData(updated);
  };

  const handleCellEdit = (rowIndex: number, column: string, value: string) => {
    const updated = [...editingData];
    updated[rowIndex] = { ...updated[rowIndex], [column]: value };
    setEditingData(updated);
  };

  const handleSave = () => {
    onUpdate({ ...taxonomy, data: editingData });
    toast({
      title: 'Taxonomy updated',
      description: `${taxonomy.name} has been saved successfully.`
    });
  };

  const handleExport = () => {
    onExport({ ...taxonomy, data: editingData });
    toast({
      title: 'Taxonomy exported',
      description: `${taxonomy.name} has been exported to CSV.`
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{taxonomy.name}</CardTitle>
            <CardDescription>
              {editingData.length} entries • Type: {taxonomy.type}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAddRow} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            <Button onClick={handleSave} size="sm" variant="outline">
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={handleExport} size="sm" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Input
            placeholder="Search taxonomy..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <ScrollArea className="h-[500px] w-full">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead key={col} className="min-w-[150px]">
                    {col}
                  </TableHead>
                ))}
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map(col => (
                    <TableCell key={col}>
                      <Input
                        value={String(row[col] || '')}
                        onChange={(e) => handleCellEdit(rowIndex, col, e.target.value)}
                        className="min-w-[140px]"
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteRow(rowIndex)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
