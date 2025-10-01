import { useState, useEffect } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { DataTable } from '@/components/DataTable';
import { CleanupRules } from '@/components/CleanupRules';
import { ChangeLogView } from '@/components/ChangeLogView';
import { TaxonomyManager } from '@/components/TaxonomyManager';
import { ValidationIssues } from '@/components/ValidationIssues';
import { Dashboard } from '@/components/Dashboard';
import { DataRow, ChangeLog, CleanupRule, TaxonomyData, ValidationIssue } from '@/types/data';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Play, RotateCcw, BarChart3 } from 'lucide-react';
import { exportToExcel } from '@/utils/fileHandlers';
import { applyCleanupRules } from '@/utils/dataCleanup';
import { validateAgainstTaxonomy } from '@/utils/validation';
import { useToast } from '@/hooks/use-toast';

const defaultRules: CleanupRule[] = [
  {
    id: '1',
    name: 'Trim Whitespace',
    enabled: true,
    type: 'trim',
    columns: [],
    description: 'Remove leading and trailing spaces from all text fields'
  },
  {
    id: '2',
    name: 'Remove Duplicates',
    enabled: false,
    type: 'remove-duplicates',
    columns: [],
    description: 'Remove duplicate rows from the dataset'
  },
  {
    id: '3',
    name: 'Standardize to Uppercase',
    enabled: false,
    type: 'uppercase',
    columns: [],
    description: 'Convert all text to uppercase'
  },
  {
    id: '4',
    name: 'Remove Special Characters',
    enabled: false,
    type: 'remove-special-chars',
    columns: [],
    description: 'Remove special characters, keeping only letters, numbers, and spaces'
  }
];

const Index = () => {
  const [originalData, setOriginalData] = useState<DataRow[]>([]);
  const [currentData, setCurrentData] = useState<DataRow[]>([]);
  const [changes, setChanges] = useState<ChangeLog[]>([]);
  const [rules, setRules] = useState<CleanupRule[]>(defaultRules);
  const [taxonomy, setTaxonomy] = useState<TaxonomyData>({});
  const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
  const [activeTab, setActiveTab] = useState('data');
  const { toast } = useToast();

  useEffect(() => {
    const savedRules = localStorage.getItem('cleanupRules');
    if (savedRules) {
      setRules(JSON.parse(savedRules));
    }
    
    const savedTaxonomy = localStorage.getItem('taxonomy');
    if (savedTaxonomy) {
      setTaxonomy(JSON.parse(savedTaxonomy));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cleanupRules', JSON.stringify(rules));
  }, [rules]);

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
    
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const updatedRules = rules.map(rule => ({
      ...rule,
      columns: rule.columns.length === 0 ? columns : rule.columns
    }));
    setRules(updatedRules);
  };

  const runValidation = () => {
    const columns = currentData.length > 0 ? Object.keys(currentData[0]) : [];
    const columnsToValidate: Record<string, string> = {};
    
    Object.keys(taxonomy).forEach(taxonomyKey => {
      const matchingColumn = columns.find(col => 
        col.toLowerCase().includes(taxonomyKey.toLowerCase()) ||
        taxonomyKey.toLowerCase().includes(col.toLowerCase())
      );
      if (matchingColumn) {
        columnsToValidate[matchingColumn] = taxonomyKey;
      }
    });

    const issues = validateAgainstTaxonomy(currentData, taxonomy, columnsToValidate);
    setValidationIssues(issues);
  };

  const handleDataChange = (newData: DataRow[], change?: ChangeLog) => {
    setCurrentData(newData);
    if (change) {
      setChanges(prev => [...prev, change]);
    }
  };

  const handleRunCleanup = () => {
    const { cleanedData, changes: newChanges } = applyCleanupRules(currentData, rules);
    setCurrentData(cleanedData);
    setChanges(prev => [...prev, ...newChanges]);
    runValidation();
    toast({
      title: 'Cleanup completed',
      description: `${newChanges.length} changes applied`,
    });
  };

  const handleReset = () => {
    setCurrentData(originalData);
    setChanges([]);
    setValidationIssues([]);
    runValidation();
    toast({
      title: 'Data reset',
      description: 'All changes have been reverted',
    });
  };

  const handleAddToTaxonomy = (taxonomyKey: string, value: string) => {
    const updatedTaxonomy = {
      ...taxonomy,
      [taxonomyKey]: [...(taxonomy[taxonomyKey] || []), value]
    };
    setTaxonomy(updatedTaxonomy);
    
    setValidationIssues(prev => 
      prev.filter(issue => !(issue.taxonomyKey === taxonomyKey && issue.value === value))
    );
  };

  const handleExportData = () => {
    exportToExcel(currentData, `cleaned-data-${Date.now()}.xlsx`);
    toast({
      title: 'Data exported',
      description: 'Your cleaned data has been downloaded',
    });
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
                <li>Configure cleanup rules or edit data manually</li>
                <li>Run automated cleanup</li>
                <li>Review all changes in the change log</li>
                <li>Export cleaned data and change report</li>
              </ol>
              <div className="mt-4 p-4 bg-accent/50 rounded-lg">
                <p className="text-sm text-foreground">
                  <strong>100% Local & Offline:</strong> All processing happens in your browser.
                  No data leaves your computer. Perfect for on-premise deployment.
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <DataTable data={currentData} onDataChange={handleDataChange} />
                </div>
                <div className="space-y-6">
                  <CleanupRules rules={rules} onRulesChange={setRules} />
                </div>
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
