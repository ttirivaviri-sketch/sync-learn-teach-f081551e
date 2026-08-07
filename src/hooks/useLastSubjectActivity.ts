/**
 * useLastSubjectActivity — "what did I last do in this subject?"
 *
 * Reads the unified learning timeline (learning_events) and returns the most
 * recent event per subject, so Home's Continue-learning cards can resume the
 * exact topic instead of dropping the learner on the generic Study dashboard.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LastSubjectActivity {
  subjectId: string;
  topicName: string | null;
  source: string;
  occurredAt: string;
}

export function useLastSubjectActivity() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  return useQuery<Record<string, LastSubjectActivity>>({
    queryKey: ["last-subject-activity", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("learning_events")
        .select("subject_id, topic_name, source, occurred_at")
        .eq("user_id", userId)
        .not("subject_id", "is", null)
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const map: Record<string, LastSubjectActivity> = {};
      for (const row of (data ?? []) as Array<{
        subject_id: string;
        topic_name: string | null;
        source: string;
        occurred_at: string;
      }>) {
        if (map[row.subject_id]) continue; // rows are newest-first
        map[row.subject_id] = {
          subjectId: row.subject_id,
          topicName: row.topic_name,
          source: row.source,
          occurredAt: row.occurred_at,
        };
      }
      return map;
    },
  });
}
