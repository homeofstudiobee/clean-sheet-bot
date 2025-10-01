import { CleanupRule } from '@/types/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

interface CleanupRulesProps {
  rules: CleanupRule[];
  onRulesChange: (rules: CleanupRule[]) => void;
}

export const CleanupRules = ({ rules, onRulesChange }: CleanupRulesProps) => {
  const toggleRule = (ruleId: string) => {
    const updatedRules = rules.map(rule =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    );
    onRulesChange(updatedRules);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cleanup Rules</CardTitle>
        <CardDescription>
          Enable or disable automatic cleanup rules for your data
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-foreground">{rule.name}</h4>
                <Badge variant={rule.enabled ? "default" : "secondary"} className="text-xs">
                  {rule.enabled ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{rule.description}</p>
              {rule.columns.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Applies to: {rule.columns.join(', ')}
                </p>
              )}
            </div>
            <Switch
              checked={rule.enabled}
              onCheckedChange={() => toggleRule(rule.id)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
