/**
 * useStudentAnalytics — wraps `get_student_analytics` RPC.
 * - Students may pass their own id (or omit it).
 * - Teachers/admins may pass a student's id within their school.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StudentAnalyticsDailyRow {
  day: string;
  tasks_completed: number;
  homework_completed: number;
  quiz_count: number;
  quiz_pct: number;
  flashcards_reviewed: number;
  flashcard_mastery_avg: number;
  resources_opened: number;
  minutes_studied: number;
}

export interface StudentAnalyticsRollup {
  tasks: number;
  homework: number;
  quizzes: number;
  quiz_pct: number;
  flashcards: number;
  resources: number;
}

export interface StudentAnalyticsReport {
  user_id: string;
  from: string;
  to: string;
  daily: StudentAnalyticsDailyRow[];
  rollup_7d: StudentAnalyticsRollup;
  rollup_30d: StudentAnalyticsRollup;
}

export function useStudentAnalytics(userId?: string | null, fromDays = 30) {
  return useQuery<StudentAnalyticsReport>({
    queryKey: ["student-analytics", userId ?? "self", fromDays],
    staleTime: 60_000,
    queryFn: async () => {
      const from = new Date(Date.now() - fromDays * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const to = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("get_student_analytics", {
        _user_id: userId ?? null,
        _from: from,
        _to: to,
      });
      if (error) throw error;
      return data as unknown as StudentAnalyticsReport;
    },
  });
}

export function useRebuildStudentAnalyticsToday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId?: string | null) => {
      const { data, error } = await supabase.rpc("rebuild_student_analytics_today", {
        _user_id: userId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-analytics"] });
    },
  });
}
