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

export type GeneratedQuizQuestion = {
  type: "mcq" | "tf" | "short";
  prompt: string;
  options: string[] | null;
  answer: string | boolean | number;
  marks: number;
  difficulty?: string;
};

export function useGenerateSchoolQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      schoolId: string; documentId: string; classId: string; subjectId?: string;
      title: string; topic: string;
      count?: number; difficulty?: string; types?: string[];
      typeCounts?: { mcq?: number; tf?: number; short?: number };
    }) =>
      invokeWithContract<{ ok: boolean; quiz_id: string; count: number }>(() =>
        supabase.functions.invoke("studymode-generate-school-quiz", {
          body: {
            school_id: args.schoolId, document_id: args.documentId, class_id: args.classId,
            subject_id: args.subjectId, title: args.title, topic: args.topic,
            count: args.count, difficulty: args.difficulty, types: args.types,
            type_counts: args.typeCounts,
          },
        }),
      ),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["class-quizzes", v.classId] }),
  });
}

/** Preview-only: generate questions without writing a quiz. */
export function usePreviewSchoolQuiz() {
  return useMutation({
    mutationFn: async (args: {
      schoolId: string; documentId: string; classId: string;
      topic: string; difficulty?: string;
      typeCounts: { mcq?: number; tf?: number; short?: number };
      avoidPrompts?: string[];
    }) =>
      invokeWithContract<{ ok: boolean; preview: true; questions: GeneratedQuizQuestion[]; count: number }>(() =>
        supabase.functions.invoke("studymode-generate-school-quiz", {
          body: {
            school_id: args.schoolId, document_id: args.documentId, class_id: args.classId,
            topic: args.topic, difficulty: args.difficulty,
            type_counts: args.typeCounts, preview: true,
            avoid_prompts: args.avoidPrompts,
          },
        }),
      ),
  });
}

/** Regenerate a single question of a given type. */
export function useRegenerateSchoolQuizQuestion() {
  return useMutation({
    mutationFn: async (args: {
      schoolId: string; documentId: string; classId: string;
      topic: string; difficulty?: string;
      type: "mcq" | "tf" | "short";
      avoidPrompts?: string[];
    }) =>
      invokeWithContract<{ ok: boolean; preview: true; questions: GeneratedQuizQuestion[]; count: number }>(() =>
        supabase.functions.invoke("studymode-generate-school-quiz", {
          body: {
            school_id: args.schoolId, document_id: args.documentId, class_id: args.classId,
            topic: args.topic, difficulty: args.difficulty,
            type_counts: { [args.type]: 1 },
            preview: true,
            avoid_prompts: args.avoidPrompts,
          },
        }),
      ),
  });
}

/** Persist a (possibly edited) preview as a published or draft quiz. */
export function useSaveSchoolQuizFromPreview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      schoolId: string; documentId: string; classId: string; subjectId?: string;
      title: string; status?: "draft" | "published";
      questions: GeneratedQuizQuestion[];
    }) =>
      invokeWithContract<{ ok: boolean; quiz_id: string; count: number; status: string }>(() =>
        supabase.functions.invoke("studymode-generate-school-quiz", {
          body: {
            school_id: args.schoolId, document_id: args.documentId, class_id: args.classId,
            subject_id: args.subjectId, title: args.title, status: args.status ?? "published",
            questions: args.questions,
          },
        }),
      ),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["class-quizzes", v.classId] }),
  });
}

export function useGenerateHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; documentId: string; classId: string; subjectId?: string; title: string; topic?: string; difficulty?: string; count?: number; dueAt?: string; instructions?: string; asDraft?: boolean; isRemediation?: boolean; remediationTopic?: string; kernelAlertId?: string; }) =>
      invokeWithContract<{ ok: boolean; homework_id: string; count: number; total_marks: number }>(() =>
        supabase.functions.invoke("studymode-generate-homework", {
          body: { school_id: args.schoolId, document_id: args.documentId, class_id: args.classId, subject_id: args.subjectId, title: args.title, topic: args.topic, difficulty: args.difficulty, count: args.count, due_at: args.dueAt, instructions: args.instructions, as_draft: args.asDraft, is_remediation: args.isRemediation, remediation_topic: args.remediationTopic, kernel_alert_id: args.kernelAlertId },
        }),
      ),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["teacher-homework", v.schoolId] });
      qc.invalidateQueries({ queryKey: ["ai-homework-class", v.classId] });
      qc.invalidateQueries({ queryKey: ["student-homework"] });
      qc.invalidateQueries({ queryKey: ["kernel-alerts", v.schoolId] });
      qc.invalidateQueries({ queryKey: ["remediation-tracker", v.schoolId] });
    },
  });
}

// ── Teacher: AI homework for a class (drafts + published) ──────────────────
export function useAiHomeworkForClass(classId?: string) {
  return useQuery({
    queryKey: ["ai-homework-class", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase.from("school_homework")
        .select("id,school_id,class_id,title,topic,due_at,total_marks,status,created_at")
        .eq("class_id", classId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useHomeworkQuestions(homeworkId?: string) {
  return useQuery({
    queryKey: ["homework-questions", homeworkId],
    enabled: !!homeworkId,
    queryFn: async () => {
      const { data, error } = await supabase.from("school_homework_questions")
        .select("*").eq("homework_id", homeworkId!).order("ord");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useUpdateHomeworkQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id: string; homework_id: string; prompt?: string; expected_answer?: string; marks?: number; options?: any; examiner_notes?: string; common_mistakes?: string; }) => {
      const { id, homework_id, ...patch } = row;
      const { error } = await supabase.from("school_homework_questions").update(patch).eq("id", id);
      if (error) throw error;
      return row;
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["homework-questions", r.homework_id] }),
  });
}

export function useDeleteHomeworkQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id: string; homework_id: string }) => {
      const { error } = await supabase.from("school_homework_questions").delete().eq("id", row.id);
      if (error) throw error;
      return row;
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["homework-questions", r.homework_id] }),
  });
}

export function usePublishHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; class_id: string; due_at: string | null; status?: "published" | "draft" }) => {
      const patch: any = { status: args.status ?? "published", due_at: args.due_at };
      // Recompute total_marks from current questions.
      const { data: qs } = await supabase.from("school_homework_questions").select("marks").eq("homework_id", args.id);
      if (qs) patch.total_marks = (qs as any[]).reduce((s, q) => s + Number(q.marks || 0), 0);
      const { error } = await supabase.from("school_homework").update(patch).eq("id", args.id);
      if (error) throw error;
      return args;
    },
    onSuccess: (a) => {
      qc.invalidateQueries({ queryKey: ["ai-homework-class", a.class_id] });
      qc.invalidateQueries({ queryKey: ["student-homework"] });
    },
  });
}

// ── Teacher: class performance analytics ───────────────────────────────────
export function useClassPerformance(classId?: string) {
  return useQuery({
    queryKey: ["class-performance", classId],
    enabled: !!classId,
    queryFn: async () => {
      const [enrRes, hwRes, qzRes] = await Promise.all([
        supabase.from("enrollments").select("student_id").eq("class_id", classId!).eq("status", "active"),
        supabase.from("school_homework").select("id,title,total_marks,status,due_at,created_at").eq("class_id", classId!).eq("status", "published"),
        supabase.from("quizzes").select("id,title,created_at").eq("class_id", classId!),
      ]);
      const enrolled = enrRes.data ?? [];
      const enrolledCount = enrolled.length;
      const hwIds = (hwRes.data ?? []).map((h) => h.id);
      const quizIds = (qzRes.data ?? []).map((q) => q.id);

      const [respRes, attRes] = await Promise.all([
        hwIds.length
          ? supabase.from("school_homework_responses")
            .select("homework_id,student_id,ai_score,teacher_score,status").in("homework_id", hwIds)
          : Promise.resolve({ data: [] as any[] }),
        quizIds.length
          ? supabase.from("school_quiz_attempts")
            .select("quiz_id,student_id,score,max_score,status").in("quiz_id", quizIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const homework = (hwRes.data ?? []).map((h) => {
        const rows = (respRes.data ?? []).filter((r: any) => r.homework_id === h.id);
        const studentsAnswered = new Set(rows.map((r: any) => r.student_id)).size;
        const scoreSum = rows.reduce((s: number, r: any) => s + Number(r.teacher_score ?? r.ai_score ?? 0), 0);
        const scored = rows.filter((r: any) => r.teacher_score != null || r.ai_score != null).length;
        return {
          id: h.id, title: h.title, total_marks: Number(h.total_marks || 0), due_at: h.due_at,
          completion: enrolledCount ? studentsAnswered / enrolledCount : 0,
          students_answered: studentsAnswered, enrolled: enrolledCount,
          avg_score: scored ? scoreSum / scored : null,
        };
      });

      const quizzes = (qzRes.data ?? []).map((q) => {
        const rows = (attRes.data ?? []).filter((r: any) => r.quiz_id === q.id && r.status === "submitted");
        const studentsAttempted = new Set(rows.map((r: any) => r.student_id)).size;
        const pctSum = rows.reduce((s: number, r: any) => s + (Number(r.max_score || 0) > 0 ? Number(r.score || 0) / Number(r.max_score) : 0), 0);
        return {
          id: q.id, title: q.title,
          completion: enrolledCount ? studentsAttempted / enrolledCount : 0,
          students_attempted: studentsAttempted, enrolled: enrolledCount,
          avg_pct: rows.length ? pctSum / rows.length : null,
        };
      });

      return { enrolled: enrolledCount, homework, quizzes };
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
      // Questions come through a SECURITY DEFINER RPC that exposes ONLY
      // student-safe columns (never expected_answer / examiner_notes /
      // common_mistakes — direct table SELECT for students was removed).
      const [{ data: hw }, { data: qs }, { data: resp }] = await Promise.all([
        supabase.from("school_homework").select("*").eq("id", homeworkId!).maybeSingle(),
        supabase.rpc("get_homework_questions_for_student" as never, { _homework_id: homeworkId! } as never),
        studentId
          ? supabase.from("school_homework_responses")
            .select("question_id,student_answer,ai_score,teacher_score,ai_feedback,teacher_comment,status,released_at")
            .eq("homework_id", homeworkId!).eq("student_id", studentId)
          : Promise.resolve({ data: [] }),
      ]);
      return { homework: hw, questions: (qs ?? []) as any[], responses: resp ?? [] };
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
    onSuccess: async (d, v) => {
      qc.invalidateQueries({ queryKey: ["homework-detail", v.homeworkId] });
      qc.invalidateQueries({ queryKey: ["student-homework"] });
      // Unified learning timeline (best-effort).
      try {
        const { logLearningEvent } = await import("@/lib/learningEvents");
        const responses = (d?.responses ?? []) as Array<{ ai_score?: number | null; teacher_score?: number | null }>;
        let scorePct: number | null = null;
        if (responses.length) {
          const scores = responses
            .map((r) => Number(r.teacher_score ?? r.ai_score ?? NaN))
            .filter((n) => Number.isFinite(n));
          if (scores.length) scorePct = scores.reduce((a, b) => a + b, 0) / scores.length;
        }
        await logLearningEvent({
          source: "school_homework",
          schoolId: v.schoolId,
          scorePct,
          payload: { homework_id: v.homeworkId, answered: v.answers.length, grades_released: d?.grades_released },
        });
        qc.invalidateQueries({ queryKey: ["learning-timeline"] });
      } catch { /* best-effort */ }
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
      const [{ data, error }, { data: qs }] = await Promise.all([
        supabase.from("school_homework_responses")
          .select("id,student_id,question_id,student_answer,ai_score,teacher_score,ai_feedback,teacher_comment,status,submitted_at")
          .eq("homework_id", homeworkId!)
          .order("submitted_at", { ascending: true }),
        supabase.from("school_homework_questions")
          .select("id,ord,prompt,marks")
          .eq("homework_id", homeworkId!).order("ord"),
      ]);
      if (error) throw error;
      const rows = data ?? [];

      // Resolve student names so teachers don't mark against raw UUIDs.
      const studentIds = [...new Set(rows.map((r) => r.student_id))];
      let names: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", studentIds);
        for (const p of (profiles ?? []) as any[]) {
          if (p.full_name) names[p.id] = p.full_name;
        }
      }

      const qById = new Map((qs ?? []).map((q: any) => [q.id, q]));
      return rows.map((r) => ({
        ...r,
        student_name: names[r.student_id] ?? null,
        question: qById.get(r.question_id) ?? null,
      }));
    },
  });
}

export function useReleaseHomework() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { schoolId: string; homeworkId: string; studentId?: string; overrides?: Array<{ question_id: string; teacher_score?: number; teacher_comment?: string }> }) =>
      invokeWithContract<{ ok: boolean; released: number; skipped_unmarked?: number }>(() =>
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
