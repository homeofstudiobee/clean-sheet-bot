import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { importFile } from '@/utils/fileHandlers';
import { TaxonomyData } from '@/types/data';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface TaxonomyManagerProps {
  taxonomy: TaxonomyData;
  onTaxonomyChange: (taxonomy: TaxonomyData) => void;
}

export const TaxonomyManager = ({ taxonomy, onTaxonomyChange }: TaxonomyManagerProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newTaxonomyName, setNewTaxonomyName] = useState('');
  const { toast } = useToast();

  const handleUploadTaxonomy = async (file: File, taxonomyKey: string) => {
    try {
      const data = await importFile(file);
      const firstColumn = Object.keys(data[0])[0];
      const values = data.map(row => String(row[firstColumn])).filter(Boolean);
      
      onTaxonomyChange({
        ...taxonomy,
        [taxonomyKey]: values
      });
      
      toast({
        title: 'Taxonomy uploaded',
        description: `${values.length} items loaded for ${taxonomyKey}`,
      });
    } catch (error) {
      toast({
        title: 'Error uploading taxonomy',
        description: 'Please check your file format',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveTaxonomy = (key: string) => {
    const newTaxonomy = { ...taxonomy };
    delete newTaxonomy[key];
    onTaxonomyChange(newTaxonomy);
    toast({
      title: 'Taxonomy removed',
      description: `${key} taxonomy has been removed`,
    });
  };

  const handleAddNewTaxonomy = () => {
    if (!newTaxonomyName.trim()) return;
    
    const key = newTaxonomyName.toLowerCase().replace(/\s+/g, '-');
    onTaxonomyChange({
      ...taxonomy,
      [key]: []
    });
    
    setNewTaxonomyName('');
    setIsAddDialogOpen(false);
    toast({
      title: 'Taxonomy added',
      description: `${newTaxonomyName} taxonomy created`,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Taxonomy Files</CardTitle>
            <CardDescription>
              Upload reference data for validation (brands, vendors, markets, etc.)
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Taxonomy
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Taxonomy</DialogTitle>
                <DialogDescription>
                  Create a new taxonomy category for validation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="taxonomy-name">Taxonomy Name</Label>
                  <Input
                    id="taxonomy-name"
                    placeholder="e.g., Brands, Vendors, Markets"
                    value={newTaxonomyName}
                    onChange={(e) => setNewTaxonomyName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddNewTaxonomy();
                    }}
                  />
                </div>
                <Button onClick={handleAddNewTaxonomy} className="w-full">
                  Create Taxonomy
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.keys(taxonomy).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No taxonomy files uploaded yet
          </p>
        ) : (
          Object.entries(taxonomy).map(([key, values]) => (
            <div
              key={key}
              className="flex items-center justify-between p-3 rounded-lg border bg-card"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-foreground capitalize">
                    {key.replace(/-/g, ' ')}
                  </h4>
                  <Badge variant="secondary">{values.length} items</Badge>
                </div>
                {values.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {values.slice(0, 5).join(', ')}
                    {values.length > 5 && '...'}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.csv,.xlsx,.xls';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleUploadTaxonomy(file, key);
                    };
                    input.click();
                  }}
                >
                  <Upload className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemoveTaxonomy(key)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
