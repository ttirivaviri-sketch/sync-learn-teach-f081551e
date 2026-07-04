/**
 * useLearnerWeeklyDigest — 7-day rollup for a learner: events, avg score,
 * mastered/at-risk topic counts, top strength/struggle. Powers the weekly
 * digest cards for learners and (later) guardians.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WeeklyDigest {
  events_7d: number;
  avg_score_7d: number | null;
  topics_mastered: number;
  topics_at_risk: number;
  top_strength: string | null;
  top_struggle: string | null;
}

export function useLearnerWeeklyDigest(userId: string | null | undefined) {
  return useQuery<WeeklyDigest | null>({
    queryKey: ["learner-weekly-digest", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("learner_weekly_digest", { _user_id: userId! });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as WeeklyDigest | null;
    },
  });
}
