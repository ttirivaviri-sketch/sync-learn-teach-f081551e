/**
 * useSchoolKernelRealtime — subscribes to kernel_alerts + school_kernel_snapshots
 * changes for the given school and invalidates related queries. Mount once
 * on the school shell so admin/teacher dashboards stay live.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSchoolKernelRealtime(schoolId: string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!schoolId) return;
    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["kernel-alerts", schoolId] });
      qc.invalidateQueries({ queryKey: ["school-kernel", schoolId] });
      qc.invalidateQueries({ queryKey: ["remediation-tracker", schoolId] });
      qc.invalidateQueries({ queryKey: ["remediation-effectiveness", schoolId] });
    };
    const channel = supabase
      .channel(`school-kernel-${schoolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kernel_alerts", filter: `school_id=eq.${schoolId}` }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "school_kernel_snapshots", filter: `school_id=eq.${schoolId}` }, invalidate)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [schoolId, qc]);
}
