/**
 * ClassPerformancePanel — homework + quiz performance for a class.
 * Shows completion rate and average score per item.
 */
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Loader2, ClipboardList, ListChecks, Users } from "lucide-react";
import { useClassPerformance } from "@/hooks/useSchoolStudyMode";

function pct(n: number) { return `${Math.round(n * 100)}%`; }

export function ClassPerformancePanel({ classId }: { classId: string }) {
  const { data, isLoading } = useClassPerformance(classId);
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-center gap-3">
        <Users className="h-5 w-5 text-primary" />
        <div>
          <div className="text-sm text-muted-foreground">Enrolled students</div>
          <div className="text-xl font-semibold">{data.enrolled}</div>
        </div>
      </Card>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Homework performance</h4>
        </div>
        {data.homework.length === 0 ? (
          <p className="text-sm text-muted-foreground">No published homework yet.</p>
        ) : data.homework.map((h) => (
          <Card key={h.id} className="p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{h.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {h.students_answered}/{h.enrolled} answered
              </span>
            </div>
            <Progress value={h.completion * 100} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completion {pct(h.completion)}</span>
              <span>
                Avg score {h.avg_score != null ? `${h.avg_score.toFixed(1)} / ${h.total_marks}` : "—"}
              </span>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          <h4 className="font-medium text-sm">Quiz performance</h4>
        </div>
        {data.quizzes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quizzes yet.</p>
        ) : data.quizzes.map((q) => (
          <Card key={q.id} className="p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{q.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {q.students_attempted}/{q.enrolled} attempted
              </span>
            </div>
            <Progress value={q.completion * 100} />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Completion {pct(q.completion)}</span>
              <span>Avg score {q.avg_pct != null ? pct(q.avg_pct) : "—"}</span>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
