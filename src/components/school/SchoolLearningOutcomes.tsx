/**
 * SchoolLearningOutcomes — aggregated 14-day learning metrics for a school.
 * Reads `student_analytics_daily` directly (RLS scopes to staff).
 */
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function SchoolLearningOutcomes({ schoolId }: { schoolId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["school-learning-outcomes", schoolId],
    queryFn: async () => {
      const from = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("student_analytics_daily")
        .select("tasks_completed,homework_completed,quiz_count,quiz_score_sum,quiz_score_max_sum,flashcards_reviewed,resources_opened,user_id,day")
        .eq("school_id", schoolId)
        .gte("day", from);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <Card className="p-4 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading learning outcomes…</span>
      </Card>
    );
  }
  const rows = (data ?? []) as any[];
  const sum = (k: string) => rows.reduce((acc, r) => acc + Number(r[k] ?? 0), 0);
  const students = new Set(rows.map((r) => r.user_id)).size;
  const qSum = sum("quiz_score_sum");
  const qMax = sum("quiz_score_max_sum");
  const quizPct = qMax > 0 ? Math.round((qSum / qMax) * 100) : 0;

  const tiles = [
    { label: "Active students", value: students },
    { label: "Tasks completed", value: sum("tasks_completed") },
    { label: "Homework completed", value: sum("homework_completed") },
    { label: "Quiz average", value: `${quizPct}%` },
    { label: "Flashcards reviewed", value: sum("flashcards_reviewed") },
    { label: "Resources opened", value: sum("resources_opened") },
  ];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Learning outcomes</h3>
        <span className="text-xs text-muted-foreground">Last 14 days</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="p-3 rounded-xl border bg-card/50">
            <p className="text-xl font-semibold">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
