import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileCheck, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import yaml from 'js-yaml';

interface RulesUploaderProps {
  onRulesLoaded: (rules: any) => void;
  rulesLoaded: boolean;
}

export const RulesUploader: React.FC<RulesUploaderProps> = ({ onRulesLoaded, rulesLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(yaml|yml)$/i)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a .yaml or .yml file',
        variant: 'destructive'
      });
      return;
    }

    try {
      const text = await file.text();
      const rules = yaml.load(text);
      
      onRulesLoaded(rules);
      
      toast({
        title: 'Rules loaded',
        description: `Validation rules from ${file.name} loaded successfully`
      });
    } catch (error) {
      console.error('Error parsing YAML:', error);
      toast({
        title: 'Failed to parse rules',
        description: error instanceof Error ? error.message : 'Invalid YAML format',
        variant: 'destructive'
      });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {rulesLoaded ? (
            <FileCheck className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
          )}
          Validation Rules
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant={rulesLoaded ? 'outline' : 'default'}
          >
            <Upload className="h-4 w-4 mr-2" />
            {rulesLoaded ? 'Replace Rules' : 'Upload Rules (.yaml)'}
          </Button>
          <div className="text-sm">
            Status: <span className={rulesLoaded ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
              {rulesLoaded ? 'Loaded' : 'Not loaded'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
