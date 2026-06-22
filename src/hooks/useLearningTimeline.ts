/**
 * useLearningTimeline — single read hook for the unified learning timeline.
 *
 * Every surface that wants "what has this learner been doing?" (learner
 * activity tab, tutor briefing card, school analytics, SAIL) should read
 * through this hook so cache invalidation and shape stay consistent.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LearningEventSource } from "@/lib/learningEvents";

export interface LearningEventRow {
  id: string;
  user_id: string;
  school_id: string | null;
  subject_id: string | null;
  topic_name: string | null;
  source: LearningEventSource;
  score_pct: number | null;
  mastery_delta: number | null;
  payload: Record<string, unknown>;
  occurred_at: string;
}

interface Options {
  userId?: string | null;
  schoolId?: string | null;
  sources?: LearningEventSource[];
  limit?: number;
  enabled?: boolean;
}

export function useLearningTimeline(options: Options = {}) {
  const { userId = null, schoolId = null, sources, limit = 50, enabled = true } = options;

  return useQuery<LearningEventRow[]>({
    queryKey: ["learning-timeline", userId, schoolId, sources?.join(",") ?? null, limit],
    enabled: enabled && (!!userId || !!schoolId),
    staleTime: 30_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = (supabase as any)
        .from("learning_events")
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(limit);
      if (userId) q = q.eq("user_id", userId);
      if (schoolId) q = q.eq("school_id", schoolId);
      if (sources && sources.length) q = q.in("source", sources);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LearningEventRow[];
    },
  });
}
