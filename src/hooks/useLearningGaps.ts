/**
 * useLearningGaps — calls the studymode-detect-gaps edge function and caches
 * the weak-topic report for 10 minutes. Only meaningful for users with a school
 * context, but works for any signed-in user.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WeakTopic {
  topic: string;
  subject_id: string | null;
  attempts: number;
  accuracy: number;
  evidence_source: string[];
  severity: "critical" | "warning" | "watch";
}

export interface SuggestedTask {
  task_type: string;
  title: string;
  description: string;
  topic: string;
  subject_id: string | null;
}

export interface LearningGapsReport {
  generated_at: string;
  window_days: number;
  weak_topics: WeakTopic[];
  suggested_tasks: SuggestedTask[];
}

export function useLearningGaps(userId: string | null | undefined) {
  return useQuery<LearningGapsReport>({
    queryKey: ["learning-gaps", userId],
    enabled: !!userId,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("studymode-detect-gaps", {
        body: {},
      });
      if (error) throw error;
      return data as LearningGapsReport;
    },
  });
}
