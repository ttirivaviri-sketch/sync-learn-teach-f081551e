/**
 * useRemediationTracker — aggregates is_remediation school_homework rows
 * across a school plus their submission counts so admins can track
 * "generated → released → completed" status of remediation interventions.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RemediationItem {
  id: string;
  title: string;
  topic: string | null;
  remediation_topic: string | null;
  class_id: string | null;
  class_name: string | null;
  status: string;
  due_at: string | null;
  total_marks: number | null;
  created_at: string;
  enrolled: number;
  responses: number;
  graded: number;
  avgScorePct: number | null;
}

export function useRemediationTracker(schoolId?: string) {
  return useQuery({
    queryKey: ["remediation-tracker", schoolId],
    enabled: !!schoolId,
    staleTime: 60_000,
    queryFn: async (): Promise<RemediationItem[]> => {
      const { data: hw, error } = await supabase
        .from("school_homework")
        .select("id, title, topic, remediation_topic, class_id, status, due_at, total_marks, created_at, classes:class_id(name)")
        .eq("school_id", schoolId!)
        .eq("is_remediation", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (hw ?? []) as any[];
      if (!rows.length) return [];

      const ids = rows.map((r) => r.id);
      const classIds = Array.from(new Set(rows.map((r) => r.class_id).filter(Boolean)));

      const [respRes, enrRes] = await Promise.all([
        supabase.from("school_homework_responses").select("homework_id, student_id, status, ai_score, teacher_score").in("homework_id", ids),
        classIds.length
          ? supabase.from("enrollments").select("class_id").in("class_id", classIds).eq("status", "active")
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const enrolledByClass = new Map<string, number>();
      for (const e of (enrRes.data ?? []) as any[]) {
        enrolledByClass.set(e.class_id, (enrolledByClass.get(e.class_id) ?? 0) + 1);
      }
      const respByHw = new Map<string, { students: Set<string>; graded: Set<string>; scoreSum: number; scoreN: number }>();
      for (const r of (respRes.data ?? []) as any[]) {
        const e = respByHw.get(r.homework_id) ?? { students: new Set<string>(), graded: new Set<string>(), scoreSum: 0, scoreN: 0 };
        e.students.add(r.student_id);
        if (r.status === "graded" || r.status === "released") e.graded.add(r.student_id);
        const score = r.teacher_score ?? r.ai_score;
        if (score != null) { e.scoreSum += Number(score); e.scoreN += 1; }
        respByHw.set(r.homework_id, e);
      }

      return rows.map((r) => {
        const stats = respByHw.get(r.id);
        return {
          id: r.id,
          title: r.title,
          topic: r.topic,
          remediation_topic: r.remediation_topic,
          class_id: r.class_id,
          class_name: r.classes?.name ?? null,
          status: r.status,
          due_at: r.due_at,
          total_marks: r.total_marks,
          created_at: r.created_at,
          enrolled: r.class_id ? enrolledByClass.get(r.class_id) ?? 0 : 0,
          responses: stats?.students.size ?? 0,
          graded: stats?.graded.size ?? 0,
          avgScorePct: stats && stats.scoreN && r.total_marks
            ? (stats.scoreSum / stats.scoreN) / Number(r.total_marks) * 100
            : null,
        };
      });
    },
  });
}
