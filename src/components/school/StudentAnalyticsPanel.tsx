/**
 * StudentAnalyticsPanel — 5 counter tiles + sparkline trend for a student.
 * Reads `get_student_analytics`. Self-view by default; pass userId to view
 * another student (teacher/admin scope; RLS enforces).
 */
import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, ClipboardList, Brain, Layers, BookOpen } from "lucide-react";
import { useStudentAnalytics, type StudentAnalyticsDailyRow } from "@/hooks/useStudentAnalytics";
import { cn } from "@/lib/utils";

interface Tile {
  label: string;
  value: string | number;
  icon: any;
  trend: number[];
  accent: string;
}

function Sparkline({ values, accent }: { values: number[]; accent: string }) {
  const max = Math.max(1, ...values);
  const w = 80;
  const h = 24;
  const step = values.length > 1 ? w / (values.length - 1) : w;
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="opacity-70">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5}
        className={accent} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function StudentAnalyticsPanel({ userId, title }: { userId?: string | null; title?: string }) {
  const { data, isLoading, error } = useStudentAnalytics(userId, 30);

  const tiles: Tile[] = useMemo(() => {
    const daily: StudentAnalyticsDailyRow[] = data?.daily ?? [];
    const r = data?.rollup_30d;
    return [
      {
        label: "Tasks (30d)",
        value: r?.tasks ?? 0,
        icon: CheckCircle2,
        trend: daily.map((d) => d.tasks_completed),
        accent: "text-primary",
      },
      {
        label: "Homework",
        value: r?.homework ?? 0,
        icon: ClipboardList,
        trend: daily.map((d) => d.homework_completed),
        accent: "text-accent",
      },
      {
        label: "Quiz avg",
        value: `${r?.quiz_pct ?? 0}%`,
        icon: Brain,
        trend: daily.map((d) => d.quiz_pct),
        accent: "text-warning",
      },
      {
        label: "Flashcards",
        value: r?.flashcards ?? 0,
        icon: Layers,
        trend: daily.map((d) => d.flashcards_reviewed),
        accent: "text-success",
      },
      {
        label: "Resources",
        value: r?.resources ?? 0,
        icon: BookOpen,
        trend: daily.map((d) => d.resources_opened),
        accent: "text-muted-foreground",
      },
    ];
  }, [data]);

  if (isLoading) {
    return (
      <Card className="p-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading analytics…</span>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-destructive">Unable to load analytics.</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title ?? "Learning analytics"}</h3>
        <span className="text-xs text-muted-foreground">Last 30 days</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="p-3 rounded-xl border bg-card/50 space-y-1">
              <div className="flex items-center justify-between">
                <Icon className={cn("h-4 w-4", t.accent)} />
                <Sparkline values={t.trend} accent={t.accent} />
              </div>
              <p className="text-lg font-semibold leading-none">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
