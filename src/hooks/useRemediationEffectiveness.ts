/**
 * useRemediationEffectiveness — before/after risk snapshot comparison
 * per remediation homework. Uses `remediation_effectiveness` RPC.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RemediationEffectivenessRow {
  homework_id: string;
  title: string;
  topic: string;
  class_id: string | null;
  created_at: string;
  students_total: number;
  students_improved: number;
  students_worsened: number;
  avg_ewma_before: number | null;
  avg_ewma_after: number | null;
  avg_delta: number | null;
}

export function useRemediationEffectiveness(schoolId?: string) {
  return useQuery<RemediationEffectivenessRow[]>({
    queryKey: ["remediation-effectiveness", schoolId],
    enabled: !!schoolId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("remediation_effectiveness", { _school_id: schoolId! });
      if (error) throw error;
      return (data ?? []) as RemediationEffectivenessRow[];
    },
  });
}
