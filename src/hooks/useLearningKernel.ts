/**
 * useLearningKernel — single realtime subscription on learning_events for the
 * signed-in learner. Whenever a new event lands (homework graded, topic
 * session finished, lesson reinforced…) it invalidates the dependent queries
 * so the next-action card, artifacts feed, and learner_state-backed surfaces
 * refresh without manual reloads. Mount once at the learner shell level.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useLearningKernel(userId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`learning-kernel-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "learning_events", filter: `user_id=eq.${userId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["next-action", userId] });
          qc.invalidateQueries({ queryKey: ["learner-artifacts", userId] });
          qc.invalidateQueries({ queryKey: ["learning-timeline", userId] });
          qc.invalidateQueries({ queryKey: ["learning-gaps", userId] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);
}
