// src/pages/DataCleaningTool.tsx
import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileUpload } from '@/components/FileUpload';
import { DataTable } from '@/components/DataTable';
import { TaxonomyUploader } from '@/components/TaxonomyUploader';
import { TaxonomyEditor } from '@/components/TaxonomyEditor';
import { UnmappedItemsReview } from '@/components/UnmappedItemsReview';
import { ExceptionsReport } from '@/components/ExceptionsReport';
import { ChangeLogView } from '@/components/ChangeLogView';
import { RulesUploader } from '@/components/RulesUploader';
import { toast } from '@/hooks/use-toast';
import { DataRow } from '@/types/data';
import { TaxonomyDefinition, ValidationConfig } from '@/types/taxonomyConfig';
import { processData, ProcessingResult } from '@/utils/dataProcessor';
import { createDefaultValidationConfig, exportTaxonomyToCSV } from '@/utils/taxonomyLoader';
import { exportToExcel } from '@/utils/fileHandlers';
import { saveTaxonomies, loadTaxonomies, clearTaxonomies, getCacheTimestamp } from '@/utils/taxonomyStorage';
import { Upload, Play, Download, Database, Trash2, FileCheck, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import yaml from 'js-yaml';
import { exceptionsTotal, rulesHit } from '@/utils/kpi';

export const DataCleaningTool: React.FC = () => {
  const [rawData, setRawData] = useState<DataRow[]>([]);
  const [cleanedData, setCleanedData] = useState<DataRow[]>([]);
  const [taxonomies, setTaxonomies] = useState<Record<string, TaxonomyDefinition>>({});
  const [validationConfig] = useState<ValidationConfig>(createDefaultValidationConfig());
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [selectedTaxonomy, setSelectedTaxonomy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [validationRules, setValidationRules] = useState<unknown>(null);
  const [dataFilename, setDataFilename] = useState<string>('');
  const [cacheTimestamp, setCacheTimestamp] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');

  useEffect(() => {
    const loadBuiltInRules = async () => {
      try {
        const response = await fetch('/validation_rules.yaml');
        if (response.ok) {
          const text = await response.text();
          const rules = yaml.load(text);
          setValidationRules(rules as unknown);
        }
      } catch { /* ignore */ }
    };
    loadBuiltInRules();
  }, []);

  useEffect(() => {
    const cached = loadTaxonomies();
    if (cached) {
      setTaxonomies(cached);
      setCacheTimestamp(getCacheTimestamp());
    }
  }, []);

  useEffect(() => {
    if (Object.keys(taxonomies).length > 0) {
      saveTaxonomies(taxonomies);
      setCacheTimestamp(Date.now());
    }
  }, [taxonomies]);

  const handleDataLoaded = (data: DataRow[], filename?: string) => {
    setRawData(data);
    setDataFilename(filename || '');
    setActiveTab('process');
  };

  const handleRulesLoaded = (rules: unknown) => setValidationRules(rules);

  const handleTaxonomyLoaded = (taxonomy: TaxonomyDefinition) => {
    setTaxonomies((prev) => ({ ...prev, [taxonomy.key]: taxonomy }));
  };

  const handleClearTaxonomies = () => {
    clearTaxonomies();
    setTaxonomies({});
    setCacheTimestamp(null);
  };

  const handleTaxonomyUpdate = (updatedTaxonomy: TaxonomyDefinition) => {
    setTaxonomies((prev) => ({ ...prev, [updatedTaxonomy.key]: updatedTaxonomy }));
  };

  const handleRunProcessing = async () => {
    if (rawData.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingMessage('Initializing...');

    try {
      const result = await processData(
        rawData,
        taxonomies,
        validationConfig,
        validationRules,
        dataFilename,
        (progress, message) => {
          setProcessingProgress(progress);
          setProcessingMessage(message || '');
        }
      );

      setProcessingResult(result);
      setCleanedData(result.cleanedData);

      const total = exceptionsTotal(result) || (result.exceptions?.length ?? 0);
      const hit = rulesHit(result);
      const changes = result.changeLog.length;

      toast({
        title: 'Processing complete',
        description: `Rows ${result.cleanedData.length}. Changes ${changes}. ${hit ? `Rules flagged ${hit}.` : `Exceptions ${total}.`}`
      });

      setActiveTab('cleaned');
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingMessage('');
    }
  };

  const handleExportCleaned = () => {
    if (cleanedData.length === 0) return;
    const timestamp = new Date().toISOString().split('T')[0];
    exportToExcel(cleanedData, `Plans_Clean_${timestamp}.xlsx`);
  };

  const handleExportTodo = (type: keyof ProcessingResult["todoLists"]) => {
    if (!processingResult) return;
    const todoData = processingResult.todoLists[type];
    if (todoData.length === 0) return;
    exportToExcel(todoData, `todo_${String(type)}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleAddToTaxonomy = (taxonomyKey: string, newEntry: Record<string, unknown>) => {
    const taxonomy = taxonomies[taxonomyKey];
    if (!taxonomy) return;
    const updated: TaxonomyDefinition = { ...taxonomy, data: [...taxonomy.data, newEntry] };
    setTaxonomies((prev) => ({ ...prev, [taxonomyKey]: updated }));
  };

  const taxonomyCount = Object.keys(taxonomies).length;
  const hasData = rawData.length > 0;
  const hasProcessed = processingResult !== null;
  const hasRules = validationRules !== null;
  const canProcess = hasData && hasRules && taxonomyCount === 6;

  const exceptionsCard = processingResult ? rulesHit(processingResult) || exceptionsTotal(processingResult) : 0;
  const changesCard = processingResult?.changeLog.length ?? 0;

  return (
    <div className="container mx-auto py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">DC Data Quality Tool</h1>
          <p className="text-muted-foreground mt-2">Process plans & budgets with taxonomy mappings and quality checks</p>
        </div>
        <div className="flex gap-2">
          {hasProcessed && (
            <Button onClick={handleExportCleaned} variant="default">
              <Download className="h-4 w-4 mr-2" />
              Export Cleaned Data
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-5 gap-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Rules</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${hasRules ? 'text-green-600' : 'text-muted-foreground'}`}>{hasRules ? 'Loaded' : 'Not loaded'}</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Taxonomies</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${taxonomyCount === 6 ? 'text-green-600' : 'text-muted-foreground'}`}>{taxonomyCount} / 6</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Data Rows</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{rawData.length}</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Exceptions / Rules</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{exceptionsCard}</div></CardContent>
        </Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Changes</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{changesCard}</div></CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="upload"><Upload className="h-4 w-4 mr-2" />Upload Data</TabsTrigger>
          <TabsTrigger value="taxonomies"><Database className="h-4 w-4 mr-2" />Taxonomies</TabsTrigger>
          <TabsTrigger value="process" disabled={!hasData}><Play className="h-4 w-4 mr-2" />Process</TabsTrigger>
          <TabsTrigger value="cleaned" disabled={!hasProcessed}>Cleaned Data</TabsTrigger>
          <TabsTrigger value="review" disabled={!hasProcessed}>Review & Flag</TabsTrigger>
          <TabsTrigger value="exceptions" disabled={!hasProcessed}>Exceptions ({exceptionsCard})</TabsTrigger>
          <TabsTrigger value="changes" disabled={!hasProcessed}>Changes ({changesCard})</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <RulesUploader onRulesLoaded={handleRulesLoaded} rulesLoaded={hasRules} />
          <FileUpload onDataLoaded={handleDataLoaded} />
          {rawData.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Raw Data Preview</CardTitle></CardHeader>
              <CardContent><DataTable data={rawData.slice(0, 100)} onDataChange={() => {}} readOnly /></CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="taxonomies" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Taxonomy Management</CardTitle>
                  <CardDescription>
                    {taxonomyCount}/6 taxonomies loaded
                    {cacheTimestamp && (
                      <span className="ml-2 text-xs"><FileCheck className="inline h-3 w-3 mr-1" />Auto-restored ({new Date(cacheTimestamp).toLocaleString()})</span>
                    )}
                  </CardDescription>
                </div>
                {taxonomyCount > 0 && (
                  <Button variant="outline" size="sm" onClick={handleClearTaxonomies}>
                    <Trash2 className="h-4 w-4 mr-2" />Clear All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <TaxonomyUploader onTaxonomyLoaded={handleTaxonomyLoaded} existingTaxonomies={taxonomies} />
            </CardContent>
          </Card>

          {Object.keys(taxonomies).length > 0 && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                {Object.keys(taxonomies).map((key) => (
                  <Button key={key} variant={selectedTaxonomy === key ? 'default' : 'outline'} onClick={() => setSelectedTaxonomy(key)} size="sm">
                    {taxonomies[key].name} ({taxonomies[key].data.length})
                  </Button>
                ))}
              </div>

              {selectedTaxonomy && taxonomies[selectedTaxonomy] && (
                <TaxonomyEditor taxonomy={taxonomies[selectedTaxonomy]} onUpdate={handleTaxonomyUpdate} onExport={exportTaxonomyToCSV} />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="process" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Processing Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Requirements</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2"><span className={hasRules ? 'text-green-600' : 'text-muted-foreground'}>{hasRules ? '✓' : '○'}</span>Validation Rules (YAML)</li>
                    {['brands', 'campaigns', 'vendors', 'channels', 'fx_rates', 'cbht'].map((key) => (
                      <li key={key} className="flex items-center gap-2">
                        <span className={taxonomies[key] ? 'text-green-600' : 'text-muted-foreground'}>{taxonomies[key] ? '✓' : '○'}</span>{key}.csv
                      </li>
                    ))}
                    <li className="flex items-center gap-2"><span className={hasData ? 'text-green-600' : 'text-muted-foreground'}>{hasData ? '✓' : '○'}</span>Data file uploaded</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Processing Steps</h3>
                  <ol className="space-y-1 text-sm list-decimal list-inside">
                    <li>Normalize</li>
                    <li>Hard remap into canonical fields</li>
                    <li>FX conversion and ISO dates</li>
                    <li>Grouped validation (optional)</li>
                    <li>Build change log and todos</li>
                  </ol>
                </div>
              </div>

              {isProcessing && (
                <div className="space-y-3 p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm font-medium">{processingMessage}</span>
                  </div>
                  <Progress value={processingProgress} />
                  <p className="text-xs text-muted-foreground">{processingProgress}% complete</p>
                </div>
              )}

              <Button onClick={handleRunProcessing} className="w-full" size="lg" disabled={!canProcess || isProcessing}>
                {isProcessing ? (<><Loader2 className="h-5 w-5 mr-2 animate-spin" />Processing...</>) : (<><Play className="h-5 w-5 mr-2" />Process Data with All Rules</>)}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cleaned" className="space-y-6">
          {processingResult && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Cleaned Data</CardTitle>
                    <CardDescription>{cleanedData.length} rows processed and ready for export</CardDescription>
                  </div>
                  <Button onClick={handleExportCleaned} variant="default">
                    <Download className="h-4 w-4 mr-2" />Export to Excel
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DataTable data={cleanedData} onDataChange={setCleanedData} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="review" className="space-y-6">
          {processingResult && (
            <Card>
              <CardHeader>
                <CardTitle>Review & Flag Items for Markets</CardTitle>
                <CardDescription>Items requiring manual review and classification.</CardDescription>
              </CardHeader>
              <CardContent>
                <UnmappedItemsReview
                  todoLists={processingResult.todoLists}
                  taxonomies={taxonomies}
                  onAddToTaxonomy={handleAddToTaxonomy}
                  onExportTodo={handleExportTodo}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="exceptions" className="space-y-6">
          {processingResult && (
            <ExceptionsReport
              summary={processingResult.summary}
              mode={processingResult.mode}
              warnings={processingResult.warnings}
              exceptions={processingResult.exceptions}
            />
          )}
        </TabsContent>

        <TabsContent value="changes" className="space-y-6">
          {processingResult && (
            <Card>
              <CardHeader><CardTitle>Change Log</CardTitle></CardHeader>
              <CardContent>
                <ChangeLogView changes={processingResult.changeLog} />
               </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};