import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SchoolAnalytics {
  school: {
    id: string;
    name: string;
    seats_teachers: number | null;
    seats_students: number | null;
    ai_quota_daily: number | null;
    storage_quota_mb: number | null;
    plan: string | null;
  } | null;
  quota: { allowed: boolean; used: number; limit: number } | null;
  counts: { teachers: number; students: number; classes: number };
  daily: Array<{
    day: string;
    active_users: number;
    assignments_created: number;
    submissions: number;
    graded_submissions: number;
    quiz_attempts: number;
    ai_requests: number;
    storage_mb: number;
  }>;
  ai_usage: Array<{ usage_date: string; bucket: string; requests: number; tokens_in: number; tokens_out: number }>;
}

export function useSchoolAnalytics(schoolId: string | undefined, days = 14) {
  return useQuery({
    queryKey: ["school-analytics", schoolId, days],
    enabled: !!schoolId,
    queryFn: async (): Promise<SchoolAnalytics> => {
      const { data, error } = await supabase.functions.invoke("school-analytics", {
        body: { school_id: schoolId, days },
      });
      if (error) throw error;
      return data as SchoolAnalytics;
    },
  });
}

/** Search the school's RAG index. Tenant isolation is enforced server-side. */
export function useSchoolSearch() {
  return useMutation({
    mutationFn: async (args: { schoolId: string; query: string; classId?: string; k?: number }) => {
      const { data, error } = await supabase.functions.invoke("school-search", {
        body: {
          school_id: args.schoolId,
          query: args.query,
          class_id: args.classId,
          k: args.k ?? 8,
        },
      });
      if (error) throw error;
      return (data?.chunks ?? []) as Array<{
        id: string;
        document_id: string;
        content: string;
        class_id: string | null;
        subject_id: string | null;
        metadata: Record<string, unknown>;
        similarity: number;
      }>;
    },
  });
}

/** Ingest a resource into the school's RAG index. Teacher/admin only. */
export function useIngestSchoolDocument() {
  return useMutation({
    mutationFn: async (args: {
      schoolId: string;
      resourceId?: string;
      title?: string;
      content: string;
      classId?: string;
      subjectId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("school-ingest-document", {
        body: {
          school_id: args.schoolId,
          resource_id: args.resourceId,
          title: args.title,
          content: args.content,
          class_id: args.classId,
          subject_id: args.subjectId,
        },
      });
      if (error) throw error;
      return data as { ok: boolean; document_id: string; chunks: number; tokens: number };
    },
  });
}
