import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileUpload } from '@/components/FileUpload';
import { DataTable } from '@/components/DataTable';
import { TaxonomyUploader } from '@/components/TaxonomyUploader';
import { TaxonomyEditor } from '@/components/TaxonomyEditor';
import { UnmappedItemsReview } from '@/components/UnmappedItemsReview';
import { ExceptionsReport } from '@/components/ExceptionsReport';
import { toast } from '@/hooks/use-toast';
import { DataRow } from '@/types/data';
import { TaxonomyDefinition, ValidationConfig } from '@/types/taxonomyConfig';
import { processData, ProcessingResult } from '@/utils/dataProcessor';
import { createDefaultValidationConfig, exportTaxonomyToCSV } from '@/utils/taxonomyLoader';
import { exportToExcel } from '@/utils/fileHandlers';
import { Upload, Play, Download, Database } from 'lucide-react';

export const DataCleaningTool: React.FC = () => {
  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [cleanedData, setCleanedData] = useState<DataRow[]>([]);
  const [taxonomies, setTaxonomies] = useState<Record<string, TaxonomyDefinition>>({});
  const [validationConfig, setValidationConfig] = useState<ValidationConfig>(
    createDefaultValidationConfig()
  );
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upload');

  // Load taxonomies from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('taxonomies');
    if (saved) {
      try {
        setTaxonomies(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading taxonomies:', error);
      }
    }
  }, []);

  // Save taxonomies to localStorage
  useEffect(() => {
    if (Object.keys(taxonomies).length > 0) {
      localStorage.setItem('taxonomies', JSON.stringify(taxonomies));
    }
  }, [taxonomies]);

  const handleDataLoaded = (data: DataRow[]) => {
    setRawData(data);
    toast({
      title: 'Data loaded',
      description: `${data.length} rows loaded successfully.`
    });
    setActiveTab('process');
  };

  const handleTaxonomyLoaded = (taxonomy: TaxonomyDefinition) => {
    setTaxonomies({
      ...taxonomies,
      [taxonomy.key]: taxonomy
    });
  };

  const handleTaxonomyUpdate = (updatedTaxonomy: TaxonomyDefinition) => {
    setTaxonomies({
      ...taxonomies,
      [updatedTaxonomy.key]: updatedTaxonomy
    });
  };

  const handleRunProcessing = () => {
    if (rawData.length === 0) {
      toast({
        title: 'No data to process',
        description: 'Please upload a data file first.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const result = processData(rawData, taxonomies, validationConfig);
      setProcessingResult(result);
      setCleanedData(result.cleanedData);
      
      toast({
        title: 'Processing complete',
        description: `Processed ${result.cleanedData.length} rows with ${result.exceptions.length} exceptions.`
      });
      
      setActiveTab('cleaned');
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: 'Processing failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      });
    }
  };

  const handleExportCleaned = () => {
    if (cleanedData.length === 0) {
      toast({
        title: 'No data to export',
        description: 'Run processing first.',
        variant: 'destructive'
      });
      return;
    }

    const timestamp = new Date().toISOString().split('T')[0];
    exportToExcel(cleanedData, `Plans_Clean_${timestamp}.xlsx`);
    
    toast({
      title: 'Data exported',
      description: 'Cleaned data has been exported successfully.'
    });
  };

  const handleExportTodo = (type: string) => {
    if (!processingResult) return;

    const todoData = processingResult.todoLists[type as keyof typeof processingResult.todoLists];
    if (todoData.length === 0) {
      toast({
        title: 'No items to export',
        description: `No unmapped ${type} found.`
      });
      return;
    }

    exportToExcel(todoData, `todo_${type}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({
      title: 'Todo list exported',
      description: `${todoData.length} items exported.`
    });
  };

  const handleAddToTaxonomy = (taxonomyKey: string, newEntry: Record<string, any>) => {
    const taxonomy = taxonomies[taxonomyKey];
    if (!taxonomy) return;

    const updatedTaxonomy: TaxonomyDefinition = {
      ...taxonomy,
      data: [...taxonomy.data, newEntry]
    };

    setTaxonomies({
      ...taxonomies,
      [taxonomyKey]: updatedTaxonomy
    });
  };

  const taxonomyCount = Object.keys(taxonomies).length;
  const hasData = rawData.length > 0;
  const hasProcessed = processingResult !== null;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">DC Data Quality Tool</h1>
          <p className="text-muted-foreground mt-2">
            Process plans & budgets with taxonomy mappings and quality checks
          </p>
        </div>
        <div className="flex gap-2">
          {hasData && (
            <>
              <Button onClick={handleRunProcessing} variant="default">
                <Play className="h-4 w-4 mr-2" />
                Run Processing
              </Button>
              {hasProcessed && (
                <Button onClick={handleExportCleaned} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Cleaned
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Taxonomies Loaded</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{taxonomyCount} / 6</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Data Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rawData.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {processingResult?.exceptions.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="upload">
            <Upload className="h-4 w-4 mr-2" />
            Upload Data
          </TabsTrigger>
          <TabsTrigger value="taxonomies">
            <Database className="h-4 w-4 mr-2" />
            Taxonomies
          </TabsTrigger>
          <TabsTrigger value="process" disabled={!hasData}>
            <Play className="h-4 w-4 mr-2" />
            Process
          </TabsTrigger>
          <TabsTrigger value="cleaned" disabled={!hasProcessed}>
            Cleaned Data
          </TabsTrigger>
          <TabsTrigger value="exceptions" disabled={!hasProcessed}>
            Exceptions ({processingResult?.exceptions.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <FileUpload onDataLoaded={handleDataLoaded} />
          {rawData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Raw Data Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={rawData.slice(0, 100)}
                  onDataChange={() => {}}
                  readOnly
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="taxonomies" className="space-y-6">
          <TaxonomyUploader
            onTaxonomyLoaded={handleTaxonomyLoaded}
            existingTaxonomies={taxonomies}
          />

          {Object.keys(taxonomies).length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2">
                {Object.keys(taxonomies).map(key => (
                  <Button
                    key={key}
                    variant={selectedTaxonomy === key ? 'default' : 'outline'}
                    onClick={() => setSelectedTaxonomy(key)}
                    size="sm"
                  >
                    {taxonomies[key].name} ({taxonomies[key].data.length})
                  </Button>
                ))}
              </div>

              {selectedTaxonomy && taxonomies[selectedTaxonomy] && (
                <TaxonomyEditor
                  taxonomy={taxonomies[selectedTaxonomy]}
                  onUpdate={handleTaxonomyUpdate}
                  onExport={exportTaxonomyToCSV}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="process" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Processing Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Taxonomies Required</h3>
                  <ul className="space-y-1 text-sm">
                    {['brands', 'campaigns', 'vendors', 'channels', 'fx_rates', 'cbht'].map(key => (
                      <li key={key} className="flex items-center gap-2">
                        <span className={taxonomies[key] ? 'text-green-600' : 'text-muted-foreground'}>
                          {taxonomies[key] ? '✓' : '○'}
                        </span>
                        {key}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Processing Steps</h3>
                  <ol className="space-y-1 text-sm list-decimal list-inside">
                    <li>Brand hierarchy mapping</li>
                    <li>Campaign classification</li>
                    <li>Vendor mapping</li>
                    <li>Channel taxonomy</li>
                    <li>FX conversion & audit</li>
                    <li>CBHT join</li>
                  </ol>
                </div>
              </div>
              <Button onClick={handleRunProcessing} className="w-full" size="lg">
                <Play className="h-5 w-5 mr-2" />
                Run Full Processing Pipeline
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleaned" className="space-y-6">
          {processingResult && (
            <>
              <DataTable
                data={cleanedData}
                onDataChange={setCleanedData}
              />
              
              <UnmappedItemsReview
                todoLists={processingResult.todoLists}
                taxonomies={taxonomies}
                onAddToTaxonomy={handleAddToTaxonomy}
                onExportTodo={handleExportTodo}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-6">
          {processingResult && (
            <ExceptionsReport exceptions={processingResult.exceptions} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
