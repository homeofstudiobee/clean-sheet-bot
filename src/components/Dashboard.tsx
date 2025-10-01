import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangeLog, ValidationIssue, DataRow } from '@/types/data';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertTriangle, Edit, Database } from 'lucide-react';

interface DashboardProps {
  data: DataRow[];
  changes: ChangeLog[];
  issues: ValidationIssue[];
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--accent))'];

export const Dashboard = ({ data, changes, issues }: DashboardProps) => {
  const stats = useMemo(() => {
    const changesByColumn = changes.reduce((acc, change) => {
      acc[change.column] = (acc[change.column] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const issuesByTaxonomy = issues.reduce((acc, issue) => {
      acc[issue.taxonomyKey] = (acc[issue.taxonomyKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const changesByType = changes.reduce((acc, change) => {
      const type = change.changeType === 'automated' ? 'Automated' : 'Manual';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const columnChartData = Object.entries(changesByColumn)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([column, count]) => ({ column, count }));

    const taxonomyChartData = Object.entries(issuesByTaxonomy)
      .map(([taxonomy, count]) => ({ name: taxonomy, value: count }));

    const changeTypeData = Object.entries(changesByType)
      .map(([type, count]) => ({ name: type, value: count }));

    return {
      totalRows: data.length,
      totalChanges: changes.length,
      totalIssues: issues.length,
      columnChartData,
      taxonomyChartData,
      changeTypeData,
    };
  }, [data, changes, issues]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Total Rows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalRows}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Edit className="h-4 w-4 text-success" />
              Changes Applied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalChanges}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Validation Issues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{stats.totalIssues}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalRows > 0
                ? Math.round(((stats.totalRows - stats.totalIssues) / stats.totalRows) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Changes by Column</CardTitle>
            <CardDescription>Top columns with most modifications</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.columnChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.columnChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="column"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No changes recorded yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validation Issues by Taxonomy</CardTitle>
            <CardDescription>Distribution of items not in taxonomy</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.taxonomyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.taxonomyChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                  >
                    {stats.taxonomyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No validation issues found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {stats.changeTypeData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Change Type Distribution</CardTitle>
            <CardDescription>Breakdown of automated vs manual changes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.changeTypeData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
