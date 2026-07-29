/**
 * PhotoSolveHistory — recent photo-solve attempts, shown on the Photo Solve
 * idle screen. Surfaces the persisted photo_solve_attempts rows (PR #85) so
 * corrections stop evaporating: each row shows the detected question, marks,
 * whether the final answer was right, and the practice follow-up score if
 * the learner did the correction loop.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, History, Target, XCircle } from "lucide-react";

interface AttemptRow {
  id: string;
  subject_name: string | null;
  topic_name: string | null;
  question_detected: string | null;
  final_answer_correct: boolean | null;
  marks_awarded: number | null;
  marks_possible: number | null;
  practice_score_pct: number | null;
  practiced_at: string | null;
  created_at: string;
}

export function PhotoSolveHistory() {
  const { data } = useQuery({
    queryKey: ["photo-solve-history"],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return [] as AttemptRow[];
      const { data, error } = await (supabase as any)
        .from("photo_solve_attempts")
        .select(
          "id,subject_name,topic_name,question_detected,final_answer_correct," +
          "marks_awarded,marks_possible,practice_score_pct,practiced_at,created_at",
        )
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) return [] as AttemptRow[];
      return (data ?? []) as AttemptRow[];
    },
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <History className="h-3.5 w-3.5" />
        Recent photo solves
      </div>
      <div className="space-y-1.5">
        {data.map((a) => {
          const marks =
            a.marks_awarded != null && a.marks_possible != null
              ? `${a.marks_awarded}/${a.marks_possible}`
              : null;
          return (
            <div
              key={a.id}
              className="rounded-xl border border-border bg-card px-3 py-2.5 space-y-1"
            >
              <div className="flex items-start gap-2">
                {a.final_answer_correct === true ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : a.final_answer_correct === false ? (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <History className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <p className="text-xs leading-snug line-clamp-2 flex-1">
                  {a.question_detected || "Photo working"}
                </p>
                {marks && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {marks}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 pl-6 text-[10px] text-muted-foreground">
                <span>
                  {[a.subject_name, a.topic_name].filter(Boolean).join(" · ") ||
                    new Date(a.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                </span>
                {a.practice_score_pct != null && (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
                    <Target className="h-3 w-3" />
                    practiced {Math.round(a.practice_score_pct)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
