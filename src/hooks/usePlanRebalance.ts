/**
 * usePlanRebalance — invokes the autonomous scheduler that ensures top
 * risk topics from learner_state are present in today/tomorrow's study_schedule.
 * Auto-runs at most once per day per user (localStorage gated).
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePlanRebalance(userId: string | null | undefined) {
  const qc = useQueryClient();
  const ran = useRef(false);
  useEffect(() => {
    if (!userId || ran.current) return;
    const key = `plan-rebalance:${userId}:${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;
    ran.current = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("learning-plan-rebalance", { body: {} });
        if (!error) {
          localStorage.setItem(key, "1");
          if ((data as { scheduled?: number })?.scheduled) {
            qc.invalidateQueries({ queryKey: ["study-schedule"] });
            qc.invalidateQueries({ queryKey: ["next-action", userId] });
          }
        }
      } catch { /* best effort */ }
    })();
  }, [userId, qc]);
}
