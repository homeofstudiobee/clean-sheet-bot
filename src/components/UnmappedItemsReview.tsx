import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Download, Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { TaxonomyDefinition } from '@/types/taxonomyConfig';

interface UnmappedItemsReviewProps {
  todoLists: {
    brands: Array<Record<string, any>>;
    campaigns: Array<Record<string, any>>;
    vendors: Array<Record<string, any>>;
    channels: Array<Record<string, any>>;
    cbht: Array<Record<string, any>>;
  };
  taxonomies: Record<string, TaxonomyDefinition>;
  onAddToTaxonomy: (taxonomyKey: string, newEntry: Record<string, any>) => void;
  onExportTodo: (type: string) => void;
}

export const UnmappedItemsReview: React.FC<UnmappedItemsReviewProps> = ({
  todoLists,
  taxonomies,
  onAddToTaxonomy,
  onExportTodo
}) => {
  const [editingEntries, setEditingEntries] = useState<Record<string, Record<string, any>>>({});

  const handleFieldEdit = (type: string, index: number, field: string, value: string) => {
    const key = `${type}-${index}`;
    setEditingEntries({
      ...editingEntries,
      [key]: {
        ...(editingEntries[key] || todoLists[type as keyof typeof todoLists][index]),
        [field]: value
      }
    });
  };

  const handleAddEntry = (type: string, index: number) => {
    const key = `${type}-${index}`;
    const entry = editingEntries[key] || todoLists[type as keyof typeof todoLists][index];
    
    onAddToTaxonomy(type, entry);
    
    toast({
      title: 'Added to taxonomy',
      description: `New ${type} entry has been added.`
    });

    // Clear the editing state
    const newEditingEntries = { ...editingEntries };
    delete newEditingEntries[key];
    setEditingEntries(newEditingEntries);
  };

  const renderTodoTable = (type: string, items: Array<Record<string, any>>) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No unmapped {type} found
        </div>
      );
    }

    const columns = Object.keys(items[0] || {});

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Badge variant="outline">
            {items.length} unmapped items
          </Badge>
          <Button size="sm" variant="outline" onClick={() => onExportTodo(type)}>
            <Download className="h-4 w-4 mr-2" />
            Export Todo CSV
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col}>{col}</TableHead>
              ))}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const key = `${type}-${index}`;
              const editingEntry = editingEntries[key] || item;
              
              return (
                <TableRow key={index}>
                  {columns.map(col => (
                    <TableCell key={col}>
                      <Input
                        value={String(editingEntry[col] || '')}
                        onChange={(e) => handleFieldEdit(type, index, col, e.target.value)}
                        placeholder={col.includes('row') ? 'Auto' : `Enter ${col}`}
                        disabled={col === 'rowIndex'}
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button size="sm" onClick={() => handleAddEntry(type, index)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unmapped Items Review</CardTitle>
        <CardDescription>
          Review and categorize items that couldn't be automatically mapped
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="brands">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="brands">
              Brands ({todoLists.brands.length})
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              Campaigns ({todoLists.campaigns.length})
            </TabsTrigger>
            <TabsTrigger value="vendors">
              Vendors ({todoLists.vendors.length})
            </TabsTrigger>
            <TabsTrigger value="channels">
              Channels ({todoLists.channels.length})
            </TabsTrigger>
            <TabsTrigger value="cbht">
              CBHT ({todoLists.cbht.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brands">
            {renderTodoTable('brands', todoLists.brands)}
          </TabsContent>
          <TabsContent value="campaigns">
            {renderTodoTable('campaigns', todoLists.campaigns)}
          </TabsContent>
          <TabsContent value="vendors">
            {renderTodoTable('vendors', todoLists.vendors)}
          </TabsContent>
          <TabsContent value="channels">
            {renderTodoTable('channels', todoLists.channels)}
          </TabsContent>
          <TabsContent value="cbht">
            {renderTodoTable('cbht', todoLists.cbht)}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
