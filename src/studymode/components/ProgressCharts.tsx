import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useMasteryHistory } from '../hooks/useMasteryHistory';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp } from 'lucide-react';

export function ProgressCharts() {
  const { chartData, subjects, isLoading } = useMasteryHistory();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="p-8 text-center rounded-2xl border border-dashed border-border">
        <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-semibold text-foreground mb-1">No progress data yet</h3>
        <p className="text-sm text-muted-foreground">
          Complete quizzes and study tasks to see your mastery trends over time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-accent-foreground" />
        <h2 className="text-xl font-bold text-foreground">Mastery Trends</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Your quiz accuracy over time across all subjects.
      </p>

      <div className="p-4 rounded-2xl bg-card border border-border">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                fontSize: '13px',
              }}
              formatter={(value: number) => [`${value}%`, undefined]}
            />
            <Legend
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
            />
            {subjects.map((subject) => (
              <Line
                key={subject.name}
                type="monotone"
                dataKey={subject.name}
                stroke={subject.color}
                strokeWidth={2.5}
                dot={{ r: 4, fill: subject.color }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Subject summary cards */}
      {subjects.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjects.map((subject) => {
            const lastPoint = chartData[chartData.length - 1];
            const firstPoint = chartData[0];
            const current = (lastPoint[subject.name] as number) ?? 0;
            const initial = (firstPoint[subject.name] as number) ?? 0;
            const change = current - initial;

            return (
              <div
                key={subject.name}
                className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: subject.color }}
                  />
                  <span className="text-sm font-medium text-foreground">{subject.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-foreground">{current}%</span>
                  {chartData.length > 1 && (
                    <span className={`text-xs ml-1 ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {change >= 0 ? '↑' : '↓'}{Math.abs(change)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
