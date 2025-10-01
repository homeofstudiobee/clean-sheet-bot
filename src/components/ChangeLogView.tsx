import { ChangeLog } from '@/types/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { exportChangeLog } from '@/utils/fileHandlers';

interface ChangeLogViewProps {
  changes: ChangeLog[];
}

export const ChangeLogView = ({ changes }: ChangeLogViewProps) => {
  const handleExport = () => {
    exportChangeLog(changes, `change-log-${Date.now()}.xlsx`);
  };

  if (changes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Change Log</CardTitle>
          <CardDescription>No changes recorded yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Change Log</CardTitle>
            <CardDescription>{changes.length} changes recorded</CardDescription>
          </div>
          <Button onClick={handleExport} size="sm" variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Log
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2">
            {changes.map((change) => (
              <div
                key={change.id}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={change.changeType === 'automated' ? 'default' : 'secondary'}>
                      {change.changeType}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      Row {change.rowIndex + 1} • {change.column}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(change.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Old:</span>
                    <p className="font-mono text-xs bg-muted p-1 rounded mt-1">
                      {String(change.oldValue || '(empty)')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">New:</span>
                    <p className="font-mono text-xs bg-muted p-1 rounded mt-1">
                      {String(change.newValue || '(empty)')}
                    </p>
                  </div>
                </div>
                {change.rule && (
                  <p className="text-xs text-muted-foreground mt-2">Rule: {change.rule}</p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
