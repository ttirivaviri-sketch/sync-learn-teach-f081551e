/**
 * useSchoolStudyMode — P10/P11 client hooks
 *
 * One place for the school-aware StudyMode features:
 *   - useTeacherDocuments     : list of teacher's school_ai_documents
 *   - useGenerateSchoolFlashcards / Quiz / Homework
 *   - useTeacherAiSettings + useUpdateTeacherAiSettings
 *   - useStudentHomeworkList  : open/completed homework for a learner
 *   - useHomeworkDetail       : questions + own responses
 *   - useSubmitHomework       : answers + AI mark in one call
 *   - useTeacherReviewList    : per-class homework with pending/released counts
 *   - useReleaseHomework
 *
 * Tenant isolation is enforced inside the edge functions; client passes
 * school_id and the server re-verifies it from the JWT.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithContract } from "@/lib/contractError";

// ── Teacher: documents available as generation sources ──────────────────────
export function useTeacherSchoolDocuments(schoolId?: string) {
  return useQuery({
    queryKey: ["teacher-school-documents", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("school_ai_documents")
        .select("id,title,status,page_count,created_at")
        .eq("school_id", schoolId!)
        .eq("status", "embedded")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Generators ──────────────────────────────────────────────────────────────
export function useGenerateSchoolFlashcards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; documentId: string; classId?: string; subject?: string; topic: string; count?: number; }) =>
      invokeWithContract<{ ok: boolean; shared_template_id: string; count: number }>(() =>
        supabase.functions.invoke("studymode-generate-school-flashcards", {
          body: { school_id: args.schoolId, document_id: args.documentId, class_id: args.classId, subject: args.subject, topic: args.topic, count: args.count },
        }),
      ),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["flashcards", v.classId] }),
  });
}

export function useGenerateSchoolQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; documentId: string; classId: string; subjectId?: string; title: string; topic: string; count?: number; difficulty?: string; types?: string[]; }) =>
      invokeWithContract<{ ok: boolean; quiz_id: string; count: number }>(() =>
        supabase.functions.invoke("studymode-generate-school-quiz", {
          body: { school_id: args.schoolId, document_id: args.documentId, class_id: args.classId, subject_id: args.subjectId, title: args.title, topic: args.topic, count: args.count, difficulty: args.difficulty, types: args.types },
        }),
      ),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["class-quizzes", v.classId] }),
  });
}

export function useGenerateHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; documentId: string; classId: string; subjectId?: string; title: string; topic?: string; difficulty?: string; count?: number; dueAt?: string; instructions?: string; }) =>
      invokeWithContract<{ ok: boolean; homework_id: string; count: number; total_marks: number }>(() =>
        supabase.functions.invoke("studymode-generate-homework", {
          body: { school_id: args.schoolId, document_id: args.documentId, class_id: args.classId, subject_id: args.subjectId, title: args.title, topic: args.topic, difficulty: args.difficulty, count: args.count, due_at: args.dueAt, instructions: args.instructions },
        }),
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["teacher-homework", v.schoolId] });
      qc.invalidateQueries({ queryKey: ["student-homework"] });
    },
  });
}

// ── Teacher AI settings ─────────────────────────────────────────────────────
export function useTeacherAiSettings(teacherId?: string, schoolId?: string) {
  return useQuery({
    queryKey: ["teacher-ai-settings", teacherId],
    enabled: !!teacherId && !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from("teacher_ai_settings")
        .select("*").eq("teacher_id", teacherId!).maybeSingle();
      return data ?? {
        teacher_id: teacherId, school_id: schoolId,
        auto_release_grades: false, auto_release_feedback: true,
        feedback_style: "examiner", homework_difficulty_default: "medium",
      };
    },
  });
}

export function useUpdateTeacherAiSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { teacher_id: string; school_id: string; auto_release_grades: boolean; auto_release_feedback: boolean; feedback_style: string; homework_difficulty_default: string; }) => {
      const { data, error } = await supabase.from("teacher_ai_settings")
        .upsert(row, { onConflict: "teacher_id" }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => qc.invalidateQueries({ queryKey: ["teacher-ai-settings", d.teacher_id] }),
  });
}

// ── Student: my homework ────────────────────────────────────────────────────
export function useStudentHomeworkList(studentId?: string) {
  return useQuery({
    queryKey: ["student-homework", studentId],
    enabled: !!studentId,
    queryFn: async () => {
      // Read all published homework for classes the student is enrolled in (RLS
      // already enforces this — we just need to join in own responses).
      const { data: hw } = await supabase
        .from("school_homework")
        .select("id,school_id,class_id,subject_id,title,topic,due_at,total_marks,status,created_at")
        .eq("status", "published")
        .order("due_at", { ascending: true, nullsFirst: false });

      const ids = (hw ?? []).map((h) => h.id);
      const { data: resp } = ids.length
        ? await supabase.from("school_homework_responses")
          .select("homework_id,status,ai_score,teacher_score,released_at")
          .in("homework_id", ids).eq("student_id", studentId!)
        : { data: [] as any[] };

      const byHw = new Map<string, { answered: number; released: number; scoreSum: number }>();
      for (const r of resp ?? []) {
        const acc = byHw.get(r.homework_id) ?? { answered: 0, released: 0, scoreSum: 0 };
        acc.answered += 1;
        if (r.status === "released") {
          acc.released += 1;
          acc.scoreSum += Number(r.teacher_score ?? r.ai_score ?? 0);
        }
        byHw.set(r.homework_id, acc);
      }
      return (hw ?? []).map((h) => ({
        ...h,
        my_progress: byHw.get(h.id) ?? { answered: 0, released: 0, scoreSum: 0 },
      }));
    },
  });
}

export function useHomeworkDetail(homeworkId?: string, studentId?: string) {
  return useQuery({
    queryKey: ["homework-detail", homeworkId, studentId],
    enabled: !!homeworkId,
    queryFn: async () => {
      const [{ data: hw }, { data: qs }, { data: resp }] = await Promise.all([
        supabase.from("school_homework").select("*").eq("id", homeworkId!).maybeSingle(),
        supabase.from("school_homework_questions").select("id,ord,prompt,question_type,options,marks")
          .eq("homework_id", homeworkId!).order("ord"),
        studentId
          ? supabase.from("school_homework_responses")
            .select("question_id,student_answer,ai_score,teacher_score,ai_feedback,teacher_comment,status,released_at")
            .eq("homework_id", homeworkId!).eq("student_id", studentId)
          : Promise.resolve({ data: [] }),
      ]);
      return { homework: hw, questions: qs ?? [], responses: resp ?? [] };
    },
  });
}

export function useSubmitHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; homeworkId: string; answers: Array<{ question_id: string; answer: string }> }) =>
      invokeWithContract<{ ok: boolean; responses: any[]; grades_released: boolean; feedback_visible: boolean }>(() =>
        supabase.functions.invoke("studymode-mark-homework", {
          body: { school_id: args.schoolId, homework_id: args.homeworkId, answers: args.answers },
        }),
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["homework-detail", v.homeworkId] });
      qc.invalidateQueries({ queryKey: ["student-homework"] });
    },
  });
}

// ── Teacher: review queue ───────────────────────────────────────────────────
export function useTeacherHomeworkList(schoolId?: string, teacherId?: string) {
  return useQuery({
    queryKey: ["teacher-homework", schoolId, teacherId],
    enabled: !!schoolId && !!teacherId,
    queryFn: async () => {
      const { data, error } = await supabase.from("school_homework")
        .select("id,class_id,title,topic,due_at,total_marks,status,created_at")
        .eq("school_id", schoolId!).eq("teacher_id", teacherId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHomeworkReviewQueue(homeworkId?: string) {
  return useQuery({
    queryKey: ["homework-review", homeworkId],
    enabled: !!homeworkId,
    queryFn: async () => {
      const { data, error } = await supabase.from("school_homework_responses")
        .select("id,student_id,question_id,student_answer,ai_score,teacher_score,ai_feedback,teacher_comment,status,submitted_at")
        .eq("homework_id", homeworkId!)
        .order("submitted_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReleaseHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; homeworkId: string; studentId?: string; overrides?: Array<{ question_id: string; teacher_score?: number; teacher_comment?: string }> }) =>
      invokeWithContract<{ ok: boolean; released: number }>(() =>
        supabase.functions.invoke("studymode-release-homework", {
          body: { school_id: args.schoolId, homework_id: args.homeworkId, student_id: args.studentId, overrides: args.overrides },
        }),
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["homework-review", v.homeworkId] });
      qc.invalidateQueries({ queryKey: ["teacher-homework"] });
    },
  });
}
