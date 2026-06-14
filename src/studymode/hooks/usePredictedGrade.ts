/**
 * usePredictedGrade
 *
 * Persistent learner-model lite: predicts an exam grade per subject by
 * blending three signals already in the database — no AI call required.
 *
 *   • Mock exam % (weight 0.50, only if at least one attempt exists)
 *   • Recent daily-task / quiz accuracy, last 30 days (weight 0.30)
 *   • Average topic mastery (weight 0.20)
 *
 * Re-weights automatically when a signal is missing so the prediction
 * always sums to 1.0. Returns a confidence score driven by sample size.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PredictedSubjectGrade {
  subjectId: string;
  subjectName: string;
  predictedPercent: number;          // 0-100
  band: string;                       // A*, A, B, C, D, E, U  (ZIMSEC / Cambridge style)
  confidence: number;                 // 0-1
  signals: {
    mockExamPercent: number | null;
    recentAccuracy: number | null;    // 0-100
    avgMastery: number | null;        // 0-100
    sampleSize: number;
    topicsCovered: number;
    topicsTotal: number;
  };
}

function toBand(p: number): string {
  if (p >= 90) return "A*";
  if (p >= 80) return "A";
  if (p >= 70) return "B";
  if (p >= 60) return "C";
  if (p >= 50) return "D";
  if (p >= 40) return "E";
  return "U";
}

export function usePredictedGrade(subjects: { id: string; name: string }[]) {
  const [data, setData] = useState<PredictedSubjectGrade[]>([]);
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!subjects.length) {
      setData([]);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setData([]);
        setLoading(false);
        return;
      }

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const subjectIds = subjects.map((s) => s.id);

      const [mockRes, taskRes, masteryRes] = await Promise.all([
        supabase
          .from("mock_exam_attempts")
          .select("subject_id, percent")
          .eq("user_id", user.id)
          .in("subject_id", subjectIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("daily_task_attempts")
          .select("subject_id, marks_awarded, marks_possible")
          .eq("user_id", user.id)
          .in("subject_id", subjectIds)
          .gte("created_at", since),
        supabase
          .from("topic_mastery")
          .select("subject_id, mastery_percentage")
          .eq("user_id", user.id)
          .in("subject_id", subjectIds),
      ]);

      const out: PredictedSubjectGrade[] = subjects.map((s) => {
        const mocks = (mockRes.data ?? []).filter((m: any) => m.subject_id === s.id);
        const tasks = (taskRes.data ?? []).filter((t: any) => t.subject_id === s.id);
        const masteries = (masteryRes.data ?? []).filter((m: any) => m.subject_id === s.id);

        const mockAvg = mocks.length
          ? mocks.slice(0, 3).reduce((sum, m: any) => sum + Number(m.percent || 0), 0) / Math.min(mocks.length, 3)
          : null;

        const totalAwarded = tasks.reduce((s2, t: any) => s2 + Number(t.marks_awarded || 0), 0);
        const totalPossible = tasks.reduce((s2, t: any) => s2 + Number(t.marks_possible || 0), 0);
        const recentAcc = totalPossible > 0 ? (totalAwarded / totalPossible) * 100 : null;

        const masteredCount = masteries.length;
        const avgMastery = masteredCount
          ? masteries.reduce((sum, m: any) => sum + Number(m.mastery_percentage || 0), 0) / masteredCount
          : null;

        // Re-weight signals around what's available.
        const parts: { val: number; w: number }[] = [];
        if (mockAvg != null) parts.push({ val: mockAvg, w: 0.5 });
        if (recentAcc != null) parts.push({ val: recentAcc, w: 0.3 });
        if (avgMastery != null) parts.push({ val: avgMastery, w: 0.2 });

        const totalW = parts.reduce((sum, p) => sum + p.w, 0);
        const predicted = totalW > 0
          ? parts.reduce((sum, p) => sum + (p.val * p.w) / totalW, 0)
          : 0;

        const sample = tasks.length + mocks.length * 5;
        // Confidence: low without mock exams, climbs with sample size.
        const baseConf = (mockAvg != null ? 0.5 : 0.15) + Math.min(sample / 60, 1) * 0.4;
        const confidence = Math.max(0, Math.min(1, baseConf));

        return {
          subjectId: s.id,
          subjectName: s.name,
          predictedPercent: Math.round(predicted),
          band: toBand(predicted),
          confidence: Number(confidence.toFixed(2)),
          signals: {
            mockExamPercent: mockAvg != null ? Math.round(mockAvg) : null,
            recentAccuracy: recentAcc != null ? Math.round(recentAcc) : null,
            avgMastery: avgMastery != null ? Math.round(avgMastery) : null,
            sampleSize: tasks.length,
            topicsCovered: masteries.filter((m: any) => Number(m.mastery_percentage || 0) >= 70).length,
            topicsTotal: masteredCount,
          },
        };
      });

      if (!cancelled) {
        setData(out);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [JSON.stringify(subjects.map((s) => s.id))]);

  return { data, isLoading };
}
