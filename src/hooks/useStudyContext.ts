/**
 * useStudyContext — P9 Context Engine (client)
 *
 * Single hook that exposes the learner's full study context:
 *   - profile (curriculum / grade / target / exam year)
 *   - school   (school_id, grade_id, class_ids, teacher_ids, subject_ids) when the
 *              learner is a school_learner
 *
 * Backed by `student_context_snapshots`. If the snapshot is missing or stale
 * (>24h) we call the RPC `refresh_student_context_snapshot` to rebuild it.
 *
 * This is the single source of school context for every StudyMode AI call —
 * existing hooks (useAITutor, useQuizGenerator, useDailyTasks, etc.) read
 * `context.school` through `AIContextPayload.school`.
 *
 * Solo learners (no school membership) get `school: null` — behavior unchanged.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SchoolStudyContext {
  schoolId: string;
  schoolName?: string | null;
  gradeId: string | null;
  gradeName?: string | null;
  classIds: string[];
  teacherIds: string[];
  subjectIds: string[];
  curriculum: string | null;
}

export interface StudyContext {
  userId: string | null;
  curriculum: string | null;
  school: SchoolStudyContext | null;
  refreshedAt: string | null;
}

const STALE_MS = 24 * 60 * 60 * 1000;

export function useStudyContext() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  return useQuery<StudyContext>({
    queryKey: ["study-context", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!userId) return { userId: null, curriculum: null, school: null, refreshedAt: null };

      // 1. Try to read cached snapshot.
      let { data: snap } = await supabase
        .from("student_context_snapshots")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const isStale = !snap || (snap.refreshed_at && Date.now() - new Date(snap.refreshed_at).getTime() > STALE_MS);

      if (isStale) {
        const { data: refreshed } = await supabase.rpc("refresh_student_context_snapshot", { _user_id: userId });
        // RPC returns the row directly.
        if (refreshed) snap = Array.isArray(refreshed) ? refreshed[0] : refreshed;
      }

      if (!snap) return { userId, curriculum: null, school: null, refreshedAt: null };

      let school: SchoolStudyContext | null = null;
      if (snap.school_id) {
        // Pull friendly names in parallel.
        const [schoolRow, gradeRow] = await Promise.all([
          // Students can't read public.schools directly (RLS is staff-only);
          // the member directory view exposes identity-safe columns to any member.
          supabase.from("school_member_directory" as any).select("name").eq("id", snap.school_id).maybeSingle(),
          snap.grade_id
            ? supabase.from("grades").select("name").eq("id", snap.grade_id).maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        school = {
          schoolId: snap.school_id,
          schoolName: schoolRow.data?.name ?? null,
          gradeId: snap.grade_id,
          gradeName: gradeRow.data?.name ?? null,
          classIds: snap.class_ids ?? [],
          teacherIds: snap.teacher_ids ?? [],
          subjectIds: snap.subject_ids ?? [],
          curriculum: snap.curriculum,
        };
      }

      return {
        userId,
        curriculum: snap.curriculum,
        school,
        refreshedAt: snap.refreshed_at,
      };
    },
  });
}
