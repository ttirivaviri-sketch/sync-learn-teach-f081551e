/**
 * useKernelAlerts — reads the kernel_alerts feed for a school plus
 * acknowledge / dismiss / drill-down helpers. The hourly pg_cron job
 * `detect-kernel-alerts-hourly` populates the feed; homework generation
 * automatically transitions an alert to "assigned" via the edge function.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export type KernelAlertStatus = "new" | "acknowledged" | "assigned" | "resolved" | "dismissed";

export interface KernelAlertRow {
  id: string;
  school_id: string;
  subject_id: string | null;
  topic: string;
  severity: "warning" | "critical";
  students_affected: number;
  avg_score: number | null;
  delta_students: number;
  status: KernelAlertStatus;
  assigned_homework_id: string | null;
  detected_at: string;
  created_at: string;
}

export function useKernelAlerts(schoolId?: string, status: KernelAlertStatus[] = ["new", "acknowledged"]) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!schoolId) return;
    const ch = supabase
      .channel(`kernel-alerts-${schoolId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kernel_alerts", filter: `school_id=eq.${schoolId}` }, () => {
        qc.invalidateQueries({ queryKey: ["kernel-alerts", schoolId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [schoolId, qc]);

  return useQuery({
    queryKey: ["kernel-alerts", schoolId, status.join(",")],
    enabled: !!schoolId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kernel_alerts")
        .select("*")
        .eq("school_id", schoolId!)
        .in("status", status)
        .order("severity", { ascending: false })
        .order("students_affected", { ascending: false })
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KernelAlertRow[];
    },
  });
}

export function useUpdateKernelAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; status?: KernelAlertStatus }) => {
      const patch: Record<string, unknown> = {};
      if (args.status) patch.status = args.status;
      if (args.status === "acknowledged") {
        const { data: u } = await supabase.auth.getUser();
        patch.acknowledged_by = u.user?.id;
        patch.acknowledged_at = new Date().toISOString();
      }
      if (args.status === "resolved") patch.resolved_at = new Date().toISOString();
      const { error } = await supabase.from("kernel_alerts").update(patch).eq("id", args.id);
      if (error) throw error;
      return args;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kernel-alerts"] }),
  });
}

export interface AffectedStudent {
  student_id: string;
  full_name: string | null;
  email: string | null;
  risk_level: string | null;
  ewma_score_pct: number | null;
  mastery_pct: number | null;
  class_names?: string | null;
  attempts?: number | null;
  last_event_at?: string | null;
}

export function useSchoolTopicStudents(schoolId?: string, topic?: string | null) {
  return useQuery({
    queryKey: ["school-topic-students", schoolId, topic?.toLowerCase()],
    enabled: !!schoolId && !!topic,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("school_topic_affected_students", {
        _school_id: schoolId!, _topic: topic!,
      });
      if (error) throw error;
      return (data ?? []) as AffectedStudent[];
    },
  });
}

export function useClassTopicStudents(classId?: string, topic?: string | null) {
  return useQuery({
    queryKey: ["class-topic-students", classId, topic?.toLowerCase()],
    enabled: !!classId && !!topic,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("class_topic_affected_students", {
        _class_id: classId!, _topic: topic!,
      });
      if (error) throw error;
      return (data ?? []) as AffectedStudent[];
    },
  });
}
