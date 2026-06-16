import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnalyticsFilters {
  from?: string;
  to?: string;
  classId?: string;
  gradeId?: string;
  days?: number;
}

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
  filters: { from: string; to: string; class_id: string | null; grade_id: string | null; applied: boolean };
  classes: Array<{ id: string; name: string; grade_id: string | null }>;
  grades: Array<{ id: string; name: string }>;
}

export function useSchoolAnalytics(schoolId: string | undefined, filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ["school-analytics", schoolId, filters],
    enabled: !!schoolId,
    queryFn: async (): Promise<SchoolAnalytics> => {
      const { data, error } = await supabase.functions.invoke("school-analytics", {
        body: {
          school_id: schoolId,
          days: filters.days,
          from: filters.from,
          to: filters.to,
          class_id: filters.classId,
          grade_id: filters.gradeId,
        },
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
  const qc = useQueryClient();
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
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["school-ai-documents", vars.schoolId] });
    },
  });
}

/** Live list of ingest jobs (queued/parsed/embedded/failed) for a school. */
export function useSchoolAIDocuments(schoolId: string | undefined) {
  return useQuery({
    queryKey: ["school-ai-documents", schoolId],
    enabled: !!schoolId,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_ai_documents")
        .select("id,title,status,error,page_count,total_tokens,created_at,updated_at")
        .eq("school_id", schoolId!)
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Reset a failed ingest document back to queued so the user can re-upload content. */
export function useRetrySchoolIngest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; documentId: string }) => {
      const { data, error } = await supabase.functions.invoke("school-ingest-retry", {
        body: { school_id: args.schoolId, document_id: args.documentId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["school-ai-documents", vars.schoolId] });
    },
  });
}
