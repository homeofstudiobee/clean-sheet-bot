import { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataTable } from '@/components/DataTable';
import { ChangeLogView } from '@/components/ChangeLogView';
import { TaxonomyManager } from '@/components/TaxonomyManager';
import { ValidationIssues } from '@/components/ValidationIssues';
import { Dashboard } from '@/components/Dashboard';
import { DataRow, ChangeLog, TaxonomyData, ValidationIssue } from '@/types/data';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Play, RotateCcw, BarChart3 } from 'lucide-react';
import { diffRows, buildMarketTasks } from '@/utils/changeReport';
import { exportToExcel, exportWorkbook } from '@/utils/fileHandlers';
import { validateAgainstTaxonomyLegacy } from '@/utils/taxonomyValidation';
import { useToast } from '@/hooks/use-toast';
import { runCleanup } from '@/lib/runCleanup';
import { normHeader } from '@/utils/normalize';
import { coerceTaxonomy } from '@/utils/taxonomy';

const Index = () => {
  const [originalData, setOriginalData] = useState<DataRow[]>([]);
  const [currentData, setCurrentData] = useState<DataRow[]>([]);
  const [changes, setChanges] = useState<ChangeLog[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyData>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [activeTab, setActiveTab] = useState('data');
  const { toast } = useToast();

  useEffect(() => {
    const savedTaxonomy = localStorage.getItem('taxonomy');
    if (savedTaxonomy) setTaxonomy(JSON.parse(savedTaxonomy));
  }, []);

  useEffect(() => {
    localStorage.setItem('taxonomy', JSON.stringify(taxonomy));
  }, [taxonomy]);

  useEffect(() => {
    if (currentData.length > 0 && Object.keys(taxonomy).length > 0) {
      runValidation();
    }
  }, [currentData, taxonomy]);

  const handleDataLoaded = (data: DataRow[]) => {
    setOriginalData(data);
    setCurrentData(data);
    setChanges([]);
    setValidationIssues([]);
  };

  const runValidation = () => {
    const columns = currentData.length ? Object.keys(currentData[0]) : [];
    const normCols = new Map(columns.map(c => [normHeader(c), c]));

    // synonym map to match dataset columns to taxonomy keys
    const synonyms: Record<string, string[]> = {
      brand: ['brand', 'brand_name', 'brands'],
      brand_line: ['brand_line', 'line', 'range', 'series', 'sub_brand', 'subbrand'],
      sku: ['sku', 'code', 'item_code', 'product_code', 'sku_code', 'sku id', 'id'],
      color_name: ['color_name', 'colour_name', 'name', 'shade', 'shade_name'],
      channel: ['channel', 'media_channel', 'media', 'placement_channel'],
      vendor: ['vendor', 'supplier', 'partner', 'media_owner'],
      campaign: ['campaign', 'campaign_name', 'flight', 'initiative'],
      market: ['market', 'country', 'region', 'geo', 'location'],
    };

    // coerce uploaded taxonomy to { key: string[] }
    const fixedTax = coerceTaxonomy(taxonomy);

    const columnsToValidate: Record<string, string> = {};
    Object.keys(fixedTax).forEach(taxKey => {
      const nkey = normHeader(taxKey);
      const candidates = synonyms[nkey] || [nkey];
      for (const cand of candidates) {
        const hit = normCols.get(cand);
        if (hit) {
          columnsToValidate[hit] = taxKey;
          break;
        }
      }
    });

    console.log('columnsToValidate', columnsToValidate);

    const issues = validateAgainstTaxonomyLegacy(currentData, fixedTax, columnsToValidate);
    setValidationIssues(issues);
  };

  const handleDataChange = (newData: DataRow[], change?: ChangeLog) => {
    setCurrentData(newData);
    if (change) setChanges(prev => [...prev, change]);
  };

  const handleRunCleanup = async () => {
    if (!currentData.length) return;
    
    try {
      // Create a temporary File from current data for runCleanup
      const csvContent = currentData.map(row => 
        Object.values(row).map(v => `"${String(v ?? '')}"`).join(',')
      ).join('\n');
      const csvFile = new File([csvContent], 'data.csv', { type: 'text/csv' });
      
      const result = await runCleanup(csvFile);
      setCurrentData(result.cleaned as any[]);
      
      toast({
        title: 'Cleanup completed',
        description: `Mode: ${result.mode}, Rows: ${result.cleaned.length}, Issues: ${Object.keys(result.summary).length}`,
      });
    } catch (error) {
      toast({
        title: 'Cleanup failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    }
  };

  const handleReset = () => {
    setCurrentData(originalData);
    setChanges([]);
    setValidationIssues([]);
    runValidation();
    toast({ title: 'Data reset', description: 'All changes reverted' });
  };

  const handleAddToTaxonomy = (taxonomyKey: string, value: string) => {
    const updatedTaxonomy = {
      ...taxonomy,
      [taxonomyKey]: [...(taxonomy[taxonomyKey] || []), value],
    };
    setTaxonomy(updatedTaxonomy);
    setValidationIssues(prev =>
      prev.filter(issue => !(issue.taxonomyKey === taxonomyKey && issue.value === value))
    );
  };

  const handleExportData = () => {
    exportToExcel(currentData, `cleaned-data-${Date.now()}.xlsx`);
    toast({ title: 'Data exported', description: 'Cleaned data downloaded' });
  };

  const handleExportActions = () => {
    const cellChanges = diffRows(originalData, currentData);
    const marketTasks = buildMarketTasks(validationIssues, currentData);
    exportWorkbook(
      {
        Cell_Changes: cellChanges,
        Market_Tasks: marketTasks,
      },
      `actions-for-markets-${Date.now()}.xlsx`
    );
    toast({ title: 'Actions exported', description: 'Workbook with changes and tasks downloaded' });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">QA Data Cleanup Tool</h1>
              <p className="text-sm text-muted-foreground">
                Local, offline-capable data cleaning and change tracking
              </p>
            </div>
            {currentData.length > 0 && (
              <div className="flex gap-2">
                <Button onClick={handleReset} variant="outline" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button onClick={handleRunCleanup} size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Run Cleanup
                </Button>
                <Button onClick={handleExportData} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <Button onClick={handleExportActions} size="sm">
                  Export Actions
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {currentData.length === 0 ? (
          <div className="max-w-2xl mx-auto">
            <FileUpload onDataLoaded={handleDataLoaded} />
            <div className="mt-8 p-6 rounded-lg border bg-card">
              <h3 className="font-semibold mb-2 text-foreground">How it works:</h3>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Upload your CSV or Excel file</li>
                <li>Run automated cleanup with built-in rules</li>
                <li>Review issues against your taxonomy</li>
                <li>Export cleaned data and change report</li>
              </ol>
              <div className="mt-4 p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-foreground">
                  <strong>100% Local & Offline:</strong> All processing happens in your browser.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="taxonomy">Taxonomy</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="dashboard">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard
              </TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="space-y-6">
              <div className="grid grid-cols-1">
                <DataTable data={currentData} onDataChange={handleDataChange} />
              </div>
              <ChangeLogView changes={changes} />
            </TabsContent>

            <TabsContent value="taxonomy" className="space-y-6">
              <TaxonomyManager taxonomy={taxonomy} onTaxonomyChange={setTaxonomy} />
            </TabsContent>

            <TabsContent value="issues" className="space-y-6">
              <ValidationIssues
                issues={validationIssues}
                taxonomy={taxonomy}
                onAddToTaxonomy={handleAddToTaxonomy}
              />
            </TabsContent>

            <TabsContent value="dashboard" className="space-y-6">
              <Dashboard
                data={currentData}
                changes={changes}
                issues={validationIssues}
              />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default Index;
