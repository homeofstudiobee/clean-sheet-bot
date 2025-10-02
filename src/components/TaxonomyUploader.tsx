import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { TaxonomyDefinition } from '@/types/taxonomyConfig';
import { loadTaxonomyFile } from '@/utils/taxonomyLoader';

interface TaxonomyUploaderProps {
  onTaxonomyLoaded: (taxonomy: TaxonomyDefinition) => void;
  existingTaxonomies: Record<string, TaxonomyDefinition>;
}

const TAXONOMY_TYPES = [
  { key: 'brands', label: 'Brands', description: 'Brand hierarchies and mappings' },
  { key: 'campaigns', label: 'Campaigns', description: 'Campaign classifications' },
  { key: 'vendors', label: 'Vendors', description: 'Vendor mappings and types' },
  { key: 'channels', label: 'Channels', description: 'Channel taxonomies' },
  { key: 'fx_rates', label: 'FX Rates', description: 'Currency conversion rates' },
  { key: 'cbht', label: 'CBHT', description: 'Cost per Brand, Market, Year' }
];

export const TaxonomyUploader: React.FC<TaxonomyUploaderProps> = ({
  onTaxonomyLoaded,
  existingTaxonomies
}) => {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const handleFileUpload = async (type: string, file: File) => {
    setUploading({ ...uploading, [type]: true });
    
    try {
      const taxonomy = await loadTaxonomyFile(file, type);
      onTaxonomyLoaded(taxonomy);
      
      toast({
        title: 'Taxonomy loaded',
        description: `${taxonomy.name} with ${taxonomy.data.length} entries loaded successfully.`
      });
    } catch (error) {
      console.error('Error loading taxonomy:', error);
      toast({
        title: 'Error loading taxonomy',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    } finally {
      setUploading({ ...uploading, [type]: false });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Taxonomy Files</CardTitle>
        <CardDescription>
          Upload CSV or Excel files for each taxonomy type
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TAXONOMY_TYPES.map(({ key, label, description }) => {
            const isLoaded = !!existingTaxonomies[key];
            const entryCount = existingTaxonomies[key]?.data.length || 0;

            return (
              <div
                key={key}
                className="border rounded-lg p-4 space-y-3 hover:border-primary transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <Label className="font-semibold">{label}</Label>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {description}
                    </p>
                  </div>
                  {isLoaded && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                </div>

                {isLoaded && (
                  <div className="text-sm text-muted-foreground">
                    {entryCount} entries loaded
                  </div>
                )}

                <div>
                  <Input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileUpload(key, file);
                      }
                    }}
                    disabled={uploading[key]}
                    className="cursor-pointer"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
