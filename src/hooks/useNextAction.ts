/**
 * useNextAction — single source of "what should I do now?" for the learner.
 * Calls the learning-next-action edge function which reads the unified
 * learner_state derived from learning_events.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NextAction {
  kind: "remediate" | "practice" | "advance" | "homework" | "lesson_recap" | "onboard";
  priority: number;
  title: string;
  reason: string;
  topic?: string;
  subject_id?: string | null;
  route?: string;
  cta?: string;
  meta?: Record<string, unknown>;
}

export interface NextActionResponse {
  primary: NextAction | null;
  actions: NextAction[];
}

export function useNextAction(userId: string | null | undefined) {
  return useQuery<NextActionResponse>({
    queryKey: ["next-action", userId],
    enabled: !!userId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("learning-next-action", { body: {} });
      if (error) throw error;
      return data as NextActionResponse;
    },
  });
}
