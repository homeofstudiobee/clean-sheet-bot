import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Info } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';

interface Exception {
  rowNumber: number;
  field: string;
  issueType: string;
  originalValue: string;
  newValue: string;
  notes: string;
}

interface ExceptionsReportProps {
  exceptions: Exception[];
}

const ISSUE_TYPE_LEGEND: Record<string, { label: string; description: string; severity: 'high' | 'medium' | 'low' }> = {
  invalid_objective: {
    label: 'Invalid Objective',
    description: 'Objective value not in allowed list, replaced with fallback',
    severity: 'medium'
  },
  brand_unmapped: {
    label: 'Brand Unmapped',
    description: 'Brand not found in taxonomy, needs manual mapping',
    severity: 'high'
  },
  campaign_unmapped: {
    label: 'Campaign Unmapped',
    description: 'Campaign not found in taxonomy, needs manual mapping',
    severity: 'medium'
  },
  vendor_unmapped: {
    label: 'Vendor Unmapped',
    description: 'Vendor not found in taxonomy, needs manual mapping',
    severity: 'high'
  },
  channel_unmapped: {
    label: 'Channel Unmapped',
    description: 'Channel/SubChannel combination not found in taxonomy',
    severity: 'medium'
  },
  fx_missing: {
    label: 'FX Rate Missing',
    description: 'No FX rate found for Market/Currency/Year combination',
    severity: 'high'
  },
  cbht_missing: {
    label: 'CBHT Missing',
    description: 'No CBHT data found for Brand/Market/Year combination',
    severity: 'low'
  },
  eur_mismatch: {
    label: 'EUR Mismatch',
    description: 'Calculated EUR value differs from Global value beyond tolerance',
    severity: 'low'
  }
};

const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
  switch (severity) {
    case 'high':
      return 'destructive';
    case 'medium':
      return 'default';
    case 'low':
      return 'secondary';
  }
};

export const ExceptionsReport: React.FC<ExceptionsReportProps> = ({ exceptions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterIssueType, setFilterIssueType] = useState<string>('all');

  const filteredExceptions = useMemo(() => {
    return exceptions.filter(ex => {
      const matchesSearch = Object.values(ex).some(val =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      );
      
      const severity = ISSUE_TYPE_LEGEND[ex.issueType]?.severity || 'medium';
      const matchesSeverity = filterSeverity === 'all' || severity === filterSeverity;
      const matchesIssueType = filterIssueType === 'all' || ex.issueType === filterIssueType;
      
      return matchesSearch && matchesSeverity && matchesIssueType;
    });
  }, [exceptions, searchTerm, filterSeverity, filterIssueType]);

  const issueTypes = Array.from(new Set(exceptions.map(ex => ex.issueType)));

  const severityCounts = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    exceptions.forEach(ex => {
      const severity = ISSUE_TYPE_LEGEND[ex.issueType]?.severity || 'medium';
      counts[severity]++;
    });
    return counts;
  }, [exceptions]);

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredExceptions);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Exceptions');
    XLSX.writeFile(workbook, `exceptions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quality Exceptions Report</CardTitle>
            <CardDescription>
              High: {severityCounts.high} | Medium: {severityCounts.medium} | Low: {severityCounts.low}
            </CardDescription>
          </div>
          <Button onClick={handleExport} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          <Badge
            variant={filterSeverity === 'high' ? 'destructive' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilterSeverity(filterSeverity === 'high' ? 'all' : 'high')}
          >
            🔴 High: {severityCounts.high}
          </Badge>
          <Badge
            variant={filterSeverity === 'medium' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilterSeverity(filterSeverity === 'medium' ? 'all' : 'medium')}
          >
            🟡 Medium: {severityCounts.medium}
          </Badge>
          <Badge
            variant={filterSeverity === 'low' ? 'secondary' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilterSeverity(filterSeverity === 'low' ? 'all' : 'low')}
          >
            🔵 Low: {severityCounts.low}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="text-sm space-y-1">
              <p className="font-semibold mb-2">Issue Type Legend:</p>
              {Object.entries(ISSUE_TYPE_LEGEND).map(([key, info]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full mt-1 ${
                    info.severity === 'high' ? 'bg-red-500' :
                    info.severity === 'medium' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <div>
                    <span className="font-medium">{info.label}:</span> {info.description}
                  </div>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Input
            placeholder="Search exceptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          <select
            className="border rounded px-3 py-2"
            value={filterIssueType}
            onChange={(e) => setFilterIssueType(e.target.value)}
          >
            <option value="all">All Issue Types</option>
            {issueTypes.map(type => (
              <option key={type} value={type}>
                {ISSUE_TYPE_LEGEND[type]?.label || type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-muted-foreground">
          Showing {filteredExceptions.length} of {exceptions.length} exceptions
        </div>

        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Row #</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Issue Type</TableHead>
                <TableHead>Original Value</TableHead>
                <TableHead>New Value</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExceptions.map((ex, idx) => {
                const severity = ISSUE_TYPE_LEGEND[ex.issueType]?.severity || 'medium';
                return (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-sm">{ex.rowNumber}</TableCell>
                    <TableCell>
                      <Badge variant={getSeverityColor(severity)}>
                        {severity === 'high' ? '🔴' : severity === 'medium' ? '🟡' : '🔵'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{ex.field}</TableCell>
                    <TableCell>
                      <span className="text-xs">
                        {ISSUE_TYPE_LEGEND[ex.issueType]?.label || ex.issueType.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {ex.originalValue || '-'}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-green-600">
                      {ex.newValue || '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                      {ex.notes}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
