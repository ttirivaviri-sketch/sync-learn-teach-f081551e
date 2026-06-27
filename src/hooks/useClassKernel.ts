/**
 * useClassKernel — reads learner_state for all students enrolled in a class
 * and aggregates risk distribution + top struggling topics. Powers the
 * teacher-facing Class Kernel panel (read-only mirror of the learner LOS).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClassKernelSummary {
  studentCount: number;
  riskCounts: { critical: number; warning: number; watch: number; mastered: number; on_track: number };
  topStruggles: Array<{ topic: string; subject_id: string | null; avgScore: number; studentsAffected: number }>;
  topMasteries: Array<{ topic: string; subject_id: string | null; avgMastery: number; studentsAffected: number }>;
}

export function useClassKernel(classId: string | null | undefined) {
  return useQuery<ClassKernelSummary>({
    queryKey: ["class-kernel", classId],
    enabled: !!classId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data: enr, error: enrErr } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("class_id", classId!)
        .eq("status", "active");
      if (enrErr) throw enrErr;
      const ids = (enr ?? []).map((e) => e.student_id);
      const empty: ClassKernelSummary = {
        studentCount: ids.length,
        riskCounts: { critical: 0, warning: 0, watch: 0, mastered: 0, on_track: 0 },
        topStruggles: [],
        topMasteries: [],
      };
      if (!ids.length) return empty;

      const { data: state, error: stateErr } = await supabase
        .from("learner_state")
        .select("user_id, subject_id, topic_name, risk_level, ewma_score_pct, mastery_pct, attempts")
        .in("user_id", ids);
      if (stateErr) throw stateErr;
      if (!state) return empty;

      const counts = { ...empty.riskCounts };
      const struggleMap = new Map<string, { topic: string; subject_id: string | null; sum: number; n: number; students: Set<string> }>();
      const masteryMap = new Map<string, { topic: string; subject_id: string | null; sum: number; n: number; students: Set<string> }>();

      for (const r of state) {
        const risk = (r.risk_level ?? "on_track") as keyof typeof counts;
        if (risk in counts) counts[risk]++;
        const key = `${r.subject_id ?? "_"}::${(r.topic_name ?? "").toLowerCase()}`;
        if (r.topic_name && (r.risk_level === "critical" || r.risk_level === "warning")) {
          const e = struggleMap.get(key) ?? { topic: r.topic_name, subject_id: r.subject_id, sum: 0, n: 0, students: new Set<string>() };
          e.sum += Number(r.ewma_score_pct ?? 0);
          e.n += 1;
          e.students.add(r.user_id);
          struggleMap.set(key, e);
        }
        if (r.topic_name && r.risk_level === "mastered") {
          const e = masteryMap.get(key) ?? { topic: r.topic_name, subject_id: r.subject_id, sum: 0, n: 0, students: new Set<string>() };
          e.sum += Number(r.mastery_pct ?? 0);
          e.n += 1;
          e.students.add(r.user_id);
          masteryMap.set(key, e);
        }
      }

      const topStruggles = Array.from(struggleMap.values())
        .map((e) => ({ topic: e.topic, subject_id: e.subject_id, avgScore: e.sum / Math.max(1, e.n), studentsAffected: e.students.size }))
        .sort((a, b) => b.studentsAffected - a.studentsAffected || a.avgScore - b.avgScore)
        .slice(0, 5);
      const topMasteries = Array.from(masteryMap.values())
        .map((e) => ({ topic: e.topic, subject_id: e.subject_id, avgMastery: e.sum / Math.max(1, e.n), studentsAffected: e.students.size }))
        .sort((a, b) => b.studentsAffected - a.studentsAffected || b.avgMastery - a.avgMastery)
        .slice(0, 5);

      return { studentCount: ids.length, riskCounts: counts, topStruggles, topMasteries };
    },
  });
}
