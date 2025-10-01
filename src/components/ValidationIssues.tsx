import { ValidationIssue, TaxonomyData } from '@/types/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ValidationIssuesProps {
  issues: ValidationIssue[];
  taxonomy: TaxonomyData;
  onAddToTaxonomy: (taxonomyKey: string, value: string) => void;
}

export const ValidationIssues = ({ issues, taxonomy, onAddToTaxonomy }: ValidationIssuesProps) => {
  const { toast } = useToast();

  const handleAddToTaxonomy = (issue: ValidationIssue) => {
    onAddToTaxonomy(issue.taxonomyKey, String(issue.value));
    toast({
      title: 'Added to taxonomy',
      description: `"${issue.value}" added to ${issue.taxonomyKey}`,
    });
  };

  if (issues.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Validation Issues
          </CardTitle>
          <CardDescription>No validation issues found</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Validation Issues
        </CardTitle>
        <CardDescription>
          {issues.length} items not found in taxonomy
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-warning border-warning">
                      {issue.taxonomyKey}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      Row {issue.rowIndex + 1} • {issue.column}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-mono bg-muted px-2 py-1 rounded inline-block">
                    {String(issue.value)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Not found in {issue.taxonomyKey} taxonomy
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddToTaxonomy(issue)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add to Taxonomy
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
