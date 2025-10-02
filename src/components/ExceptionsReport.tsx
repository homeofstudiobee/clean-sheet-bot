import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as XLSX from 'xlsx';

interface Exception {
  market: string;
  region: string;
  planId: string;
  planName: string;
  field: string;
  issueType: string;
  currentValue: string;
  suggestedValue: string;
  priority: string;
  owner: string;
}

interface ExceptionsReportProps {
  exceptions: Exception[];
}

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'P1':
      return 'destructive';
    case 'P2':
      return 'default';
    case 'P3':
      return 'secondary';
    default:
      return 'outline';
  }
};

export const ExceptionsReport: React.FC<ExceptionsReportProps> = ({ exceptions }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterIssueType, setFilterIssueType] = useState<string>('all');

  const filteredExceptions = exceptions.filter(ex => {
    const matchesSearch = Object.values(ex).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesPriority = filterPriority === 'all' || ex.priority === filterPriority;
    const matchesIssueType = filterIssueType === 'all' || ex.issueType === filterIssueType;
    return matchesSearch && matchesPriority && matchesIssueType;
  });

  const issueTypes = Array.from(new Set(exceptions.map(ex => ex.issueType)));
  const priorities = ['P1', 'P2', 'P3'];

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredExceptions);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Exceptions');
    XLSX.writeFile(workbook, `exceptions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const priorityCounts = priorities.reduce((acc, p) => {
    acc[p] = exceptions.filter(ex => ex.priority === p).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quality Exceptions Report</CardTitle>
            <CardDescription>
              {filteredExceptions.length} of {exceptions.length} exceptions shown
            </CardDescription>
          </div>
          <Button onClick={handleExport} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          {priorities.map(p => (
            <Badge
              key={p}
              variant={getPriorityColor(p)}
              className="cursor-pointer"
              onClick={() => setFilterPriority(filterPriority === p ? 'all' : p)}
            >
              {p}: {priorityCounts[p]}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>

        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Priority</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Plan ID</TableHead>
                <TableHead>Field</TableHead>
                <TableHead>Issue Type</TableHead>
                <TableHead>Current Value</TableHead>
                <TableHead>Suggested</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExceptions.map((ex, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Badge variant={getPriorityColor(ex.priority)}>
                      {ex.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>{ex.market}</TableCell>
                  <TableCell className="font-mono text-sm">{ex.planId}</TableCell>
                  <TableCell>{ex.field}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {ex.issueType.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {ex.currentValue}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-green-600">
                    {ex.suggestedValue}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ex.owner}</Badge>
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
