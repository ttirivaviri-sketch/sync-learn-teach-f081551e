/**
 * Hooks for school academic data: grades, subjects, classes, enrollments,
 * resources, announcements, assignments, submissions, quizzes.
 *
 * All queries are RLS-scoped on the server — a user only sees rows they're
 * allowed to. Mutations always pass `school_id` so policies can match.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Id = string;

const sb = supabase as any; // tables are not in generated types yet

// ── Grades ────────────────────────────────────────────────────────────────
export interface Grade { id: Id; school_id: Id; name: string; sort_order: number; }
export function useGrades(schoolId?: Id) {
  return useQuery({
    queryKey: ["grades", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await sb.from("grades").select("*").eq("school_id", schoolId).order("sort_order");
      if (error) throw error;
      return (data ?? []) as Grade[];
    },
  });
}
export function useUpsertGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: Partial<Grade> & { school_id: Id; name: string }) => {
      const { data, error } = await sb.from("grades").upsert(g).select().single();
      if (error) throw error;
      return data as Grade;
    },
    onSuccess: (g) => qc.invalidateQueries({ queryKey: ["grades", g.school_id] }),
  });
}
export function useDeleteGrade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: Grade) => {
      const { error } = await sb.from("grades").delete().eq("id", g.id);
      if (error) throw error;
      return g;
    },
    onSuccess: (g) => qc.invalidateQueries({ queryKey: ["grades", g.school_id] }),
  });
}

// ── Subjects ──────────────────────────────────────────────────────────────
export interface SchoolSubject { id: Id; school_id: Id; name: string; code: string | null; color: string | null; }
export function useSchoolSubjects(schoolId?: Id) {
  return useQuery({
    queryKey: ["school-subjects", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await sb.from("school_subjects").select("*").eq("school_id", schoolId).order("name");
      if (error) throw error;
      return (data ?? []) as SchoolSubject[];
    },
  });
}
export function useUpsertSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<SchoolSubject> & { school_id: Id; name: string }) => {
      const { data, error } = await sb.from("school_subjects").upsert(s).select().single();
      if (error) throw error;
      return data as SchoolSubject;
    },
    onSuccess: (s) => qc.invalidateQueries({ queryKey: ["school-subjects", s.school_id] }),
  });
}
export function useDeleteSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: SchoolSubject) => {
      const { error } = await sb.from("school_subjects").delete().eq("id", s.id);
      if (error) throw error;
      return s;
    },
    onSuccess: (s) => qc.invalidateQueries({ queryKey: ["school-subjects", s.school_id] }),
  });
}

// ── Classes ───────────────────────────────────────────────────────────────
export interface SchoolClass {
  id: Id; school_id: Id; grade_id: Id | null; name: string; code: string | null;
  homeroom_teacher_id: Id | null;
}
export function useClasses(schoolId?: Id) {
  return useQuery({
    queryKey: ["classes", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data, error } = await sb.from("classes").select("*").eq("school_id", schoolId).is("deleted_at", null).order("name");
      if (error) throw error;
      return (data ?? []) as SchoolClass[];
    },
  });
}
export function useClass(classId?: Id) {
  return useQuery({
    queryKey: ["class", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await sb.from("classes").select("*").eq("id", classId).maybeSingle();
      if (error) throw error;
      return data as SchoolClass | null;
    },
  });
}
export function useUpsertClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<SchoolClass> & { school_id: Id; name: string }) => {
      const { data, error } = await sb.from("classes").upsert(c).select().single();
      if (error) throw error;
      return data as SchoolClass;
    },
    onSuccess: (c) => qc.invalidateQueries({ queryKey: ["classes", c.school_id] }),
  });
}
export function useDeleteClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: SchoolClass) => {
      const { error } = await sb.from("classes").update({ deleted_at: new Date().toISOString() }).eq("id", c.id);
      if (error) throw error;
      return c;
    },
    onSuccess: (c) => qc.invalidateQueries({ queryKey: ["classes", c.school_id] }),
  });
}

// ── Class subjects (teacher assignments) ─────────────────────────────────
export interface ClassSubject { id: Id; school_id: Id; class_id: Id; subject_id: Id; teacher_id: Id | null; }
export function useClassSubjects(classId?: Id) {
  return useQuery({
    queryKey: ["class-subjects", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await sb.from("class_subjects").select("*").eq("class_id", classId);
      if (error) throw error;
      return (data ?? []) as ClassSubject[];
    },
  });
}
export function useUpsertClassSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cs: Partial<ClassSubject> & { school_id: Id; class_id: Id; subject_id: Id }) => {
      const { data, error } = await sb.from("class_subjects").upsert(cs, { onConflict: "class_id,subject_id" }).select().single();
      if (error) throw error;
      return data as ClassSubject;
    },
    onSuccess: (cs) => qc.invalidateQueries({ queryKey: ["class-subjects", cs.class_id] }),
  });
}
export function useDeleteClassSubject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cs: ClassSubject) => {
      const { error } = await sb.from("class_subjects").delete().eq("id", cs.id);
      if (error) throw error;
      return cs;
    },
    onSuccess: (cs) => qc.invalidateQueries({ queryKey: ["class-subjects", cs.class_id] }),
  });
}

// ── Enrollments ───────────────────────────────────────────────────────────
export interface Enrollment {
  id: Id; school_id: Id; class_id: Id; student_id: Id; status: string;
  profile?: { full_name: string | null; email: string | null; avatar_url: string | null } | null;
}
export function useEnrollments(classId?: Id) {
  return useQuery({
    queryKey: ["enrollments", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await sb.from("enrollments").select("*").eq("class_id", classId).eq("status", "active");
      if (error) throw error;
      const rows = (data ?? []) as Enrollment[];
      const ids = rows.map((r) => r.student_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email,avatar_url").in("id", ids);
        const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
        rows.forEach((r) => { r.profile = (m.get(r.student_id) as any) ?? null; });
      }
      return rows;
    },
  });
}
export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { school_id: Id; class_id: Id; student_id: Id }) => {
      const { data, error } = await sb.from("enrollments").upsert({ ...e, status: "active" }, { onConflict: "class_id,student_id" }).select().single();
      if (error) throw error;
      return data as Enrollment;
    },
    onSuccess: (e) => qc.invalidateQueries({ queryKey: ["enrollments", e.class_id] }),
  });
}
export function useRemoveEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Enrollment) => {
      const { error } = await sb.from("enrollments").update({ status: "withdrawn" }).eq("id", e.id);
      if (error) throw error;
      return e;
    },
    onSuccess: (e) => qc.invalidateQueries({ queryKey: ["enrollments", e.class_id] }),
  });
}

// "My classes" — for teacher and student dashboards
export function useMyTeachingClasses(schoolId?: Id) {
  return useQuery({
    queryKey: ["my-teaching", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      // homeroom
      const { data: hr } = await sb.from("classes").select("*").eq("school_id", schoolId).eq("homeroom_teacher_id", user.id).is("deleted_at", null);
      // subject teacher
      const { data: cs } = await sb.from("class_subjects").select("class_id").eq("school_id", schoolId).eq("teacher_id", user.id);
      const ids = new Set<string>((hr ?? []).map((c: any) => c.id));
      (cs ?? []).forEach((row: any) => ids.add(row.class_id));
      if (!ids.size) return [];
      const { data, error } = await sb.from("classes").select("*").in("id", Array.from(ids)).is("deleted_at", null);
      if (error) throw error;
      return (data ?? []) as SchoolClass[];
    },
  });
}

export function useMyEnrolledClasses(schoolId?: Id) {
  return useQuery({
    queryKey: ["my-enrolled", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: enr } = await sb.from("enrollments").select("class_id").eq("school_id", schoolId).eq("student_id", user.id).eq("status", "active");
      const ids = (enr ?? []).map((r: any) => r.class_id);
      if (!ids.length) return [];
      const { data, error } = await sb.from("classes").select("*").in("id", ids);
      if (error) throw error;
      return (data ?? []) as SchoolClass[];
    },
  });
}

// ── Resources ─────────────────────────────────────────────────────────────
export interface SchoolResource {
  id: Id; school_id: Id; class_id: Id | null; grade_id: Id | null; subject_id: Id | null;
  teacher_id: Id; kind: string; title: string; description: string | null;
  storage_path: string | null; external_url: string | null; mime: string | null;
  size_bytes: number | null; visibility: string; status: string; created_at: string;
}
export function useResources(opts: { schoolId?: Id; classId?: Id }) {
  return useQuery({
    queryKey: ["resources", opts.schoolId, opts.classId],
    enabled: !!opts.schoolId,
    queryFn: async () => {
      let q = sb.from("school_resources").select("*").eq("school_id", opts.schoolId).is("deleted_at", null).order("created_at", { ascending: false });
      if (opts.classId) q = q.eq("class_id", opts.classId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as SchoolResource[];
    },
  });
}
export function useCreateResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SchoolResource> & { school_id: Id; title: string; kind: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await sb.from("school_resources").insert({ ...input, teacher_id: user?.id }).select().single();
      if (error) throw error;
      return data as SchoolResource;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["resources", r.school_id] });
    },
  });
}
export function useDeleteResource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: SchoolResource) => {
      const { error } = await sb.from("school_resources").update({ deleted_at: new Date().toISOString() }).eq("id", r.id);
      if (error) throw error;
      return r;
    },
    onSuccess: (r) => qc.invalidateQueries({ queryKey: ["resources", r.school_id] }),
  });
}

// ── Announcements ─────────────────────────────────────────────────────────
export interface Announcement {
  id: Id; school_id: Id; audience: "school" | "grade" | "class";
  grade_id: Id | null; class_id: Id | null; author_id: Id;
  title: string; body: string; pinned: boolean; created_at: string;
}
export function useAnnouncements(opts: { schoolId?: Id; classId?: Id }) {
  return useQuery({
    queryKey: ["announcements", opts.schoolId, opts.classId],
    enabled: !!opts.schoolId,
    queryFn: async () => {
      let q = sb.from("announcements").select("*").eq("school_id", opts.schoolId).is("deleted_at", null).order("pinned", { ascending: false }).order("created_at", { ascending: false });
      if (opts.classId) q = q.eq("class_id", opts.classId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
  });
}
export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<Announcement> & { school_id: Id; title: string; body: string; audience: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await sb.from("announcements").insert({ ...a, author_id: user?.id }).select().single();
      if (error) throw error;
      return data as Announcement;
    },
    onSuccess: (a) => qc.invalidateQueries({ queryKey: ["announcements", a.school_id] }),
  });
}

// ── Assignments + Submissions ────────────────────────────────────────────
export interface Assignment {
  id: Id; school_id: Id; class_id: Id; subject_id: Id | null; teacher_id: Id;
  title: string; instructions: string | null; due_at: string | null;
  max_score: number; status: string;
}
export function useAssignments(opts: { schoolId?: Id; classId?: Id }) {
  return useQuery({
    queryKey: ["assignments", opts.schoolId, opts.classId],
    enabled: !!opts.schoolId,
    queryFn: async () => {
      let q = sb.from("assignments").select("*").eq("school_id", opts.schoolId).is("deleted_at", null).order("due_at", { ascending: true, nullsFirst: false });
      if (opts.classId) q = q.eq("class_id", opts.classId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Assignment[];
    },
  });
}
export function useAssignment(id?: Id) {
  return useQuery({
    queryKey: ["assignment", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb.from("assignments").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Assignment | null;
    },
  });
}
export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<Assignment> & { school_id: Id; class_id: Id; title: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await sb.from("assignments").insert({ ...a, teacher_id: user?.id }).select().single();
      if (error) throw error;
      return data as Assignment;
    },
    onSuccess: (a) => qc.invalidateQueries({ queryKey: ["assignments", a.school_id] }),
  });
}

export interface Submission {
  id: Id; school_id: Id; assignment_id: Id; student_id: Id;
  status: string; text_response: string | null; submitted_at: string | null;
  score: number | null; feedback: string | null;
  profile?: { full_name: string | null; email: string | null } | null;
}
export function useSubmissions(assignmentId?: Id) {
  return useQuery({
    queryKey: ["submissions", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data, error } = await sb.from("submissions").select("*").eq("assignment_id", assignmentId);
      if (error) throw error;
      const rows = (data ?? []) as Submission[];
      const ids = rows.map((r) => r.student_id);
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
        rows.forEach((r) => { r.profile = (m.get(r.student_id) as any) ?? null; });
      }
      return rows;
    },
  });
}
export function useMySubmission(assignmentId?: Id) {
  return useQuery({
    queryKey: ["my-submission", assignmentId],
    enabled: !!assignmentId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await sb.from("submissions").select("*").eq("assignment_id", assignmentId).eq("student_id", user.id).maybeSingle();
      if (error) throw error;
      return data as Submission | null;
    },
  });
}
export function useSubmitAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { school_id: Id; assignment_id: Id; text_response: string; final: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        school_id: input.school_id,
        assignment_id: input.assignment_id,
        student_id: user!.id,
        text_response: input.text_response,
        status: input.final ? "submitted" : "draft",
        submitted_at: input.final ? new Date().toISOString() : null,
      };
      const { data, error } = await sb.from("submissions").upsert(payload, { onConflict: "assignment_id,student_id" }).select().single();
      if (error) throw error;
      return data as Submission;
    },
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["my-submission", s.assignment_id] });
      qc.invalidateQueries({ queryKey: ["submissions", s.assignment_id] });
    },
  });
}
export function useGradeSubmission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { submission: Submission; score: number; feedback: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await sb.from("submissions").update({
        score: input.score, feedback: input.feedback, status: "graded",
        graded_by: user?.id, graded_at: new Date().toISOString(),
      }).eq("id", input.submission.id).select().single();
      if (error) throw error;
      return data as Submission;
    },
    onSuccess: (s) => qc.invalidateQueries({ queryKey: ["submissions", s.assignment_id] }),
  });
}

// ── Quizzes ──────────────────────────────────────────────────────────────
export interface Quiz {
  id: Id; school_id: Id; class_id: Id; subject_id: Id | null; teacher_id: Id;
  title: string; instructions: string | null; time_limit_min: number | null;
  attempts_allowed: number; status: string; due_at: string | null;
}
export interface QuizQuestion {
  id: Id; school_id: Id; quiz_id: Id; ord: number;
  type: "mcq" | "short" | "tf" | "long";
  prompt: string; options: any; answer: any; marks: number;
}
export interface QuizAttempt {
  id: Id; school_id: Id; quiz_id: Id; student_id: Id;
  started_at: string; submitted_at: string | null; status: string;
  score: number | null; max_score: number | null; per_question: any;
}
export function useQuizzes(opts: { schoolId?: Id; classId?: Id }) {
  return useQuery({
    queryKey: ["quizzes", opts.schoolId, opts.classId],
    enabled: !!opts.schoolId,
    queryFn: async () => {
      let q = sb.from("quizzes").select("*").eq("school_id", opts.schoolId).is("deleted_at", null).order("created_at", { ascending: false });
      if (opts.classId) q = q.eq("class_id", opts.classId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Quiz[];
    },
  });
}
export function useQuiz(id?: Id) {
  return useQuery({
    queryKey: ["quiz", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await sb.from("quizzes").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Quiz | null;
    },
  });
}
export function useQuizQuestions(quizId?: Id) {
  return useQuery({
    queryKey: ["quiz-questions", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data, error } = await sb.from("quiz_questions").select("*").eq("quiz_id", quizId).order("ord");
      if (error) throw error;
      return (data ?? []) as QuizQuestion[];
    },
  });
}
export function useCreateQuiz() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: Partial<Quiz> & { school_id: Id; class_id: Id; title: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await sb.from("quizzes").insert({ ...q, teacher_id: user?.id }).select().single();
      if (error) throw error;
      return data as Quiz;
    },
    onSuccess: (q) => qc.invalidateQueries({ queryKey: ["quizzes", q.school_id] }),
  });
}
export function useUpsertQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: Partial<QuizQuestion> & { school_id: Id; quiz_id: Id; type: QuizQuestion["type"]; prompt: string }) => {
      const { data, error } = await sb.from("quiz_questions").upsert(q).select().single();
      if (error) throw error;
      return data as QuizQuestion;
    },
    onSuccess: (q) => qc.invalidateQueries({ queryKey: ["quiz-questions", q.quiz_id] }),
  });
}
export function useDeleteQuizQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: QuizQuestion) => {
      const { error } = await sb.from("quiz_questions").delete().eq("id", q.id);
      if (error) throw error;
      return q;
    },
    onSuccess: (q) => qc.invalidateQueries({ queryKey: ["quiz-questions", q.quiz_id] }),
  });
}
export function useStartQuizAttempt() {
  return useMutation({
    mutationFn: async (input: { school_id: Id; quiz_id: Id }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await sb.from("school_quiz_attempts").insert({
        school_id: input.school_id,
        quiz_id: input.quiz_id,
        student_id: user!.id,
      }).select().single();
      if (error) throw error;
      return data as QuizAttempt;
    },
  });
}
export function useSubmitQuizAttempt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { attempt: QuizAttempt; answers: Array<{ question_id: Id; response: any }>; questions: QuizQuestion[] }) => {
      let score = 0, max = 0;
      const per_question = input.questions.map((q) => {
        const a = input.answers.find((x) => x.question_id === q.id);
        max += Number(q.marks);
        const ans = a?.response;
        let correct = false;
        if (q.type === "mcq" || q.type === "tf") correct = ans !== undefined && JSON.stringify(ans) === JSON.stringify(q.answer);
        else if (q.type === "short") correct = typeof ans === "string" && typeof q.answer === "string" && ans.trim().toLowerCase() === q.answer.trim().toLowerCase();
        // long: leave for teacher to grade — counts 0 here
        if (correct) score += Number(q.marks);
        return { question_id: q.id, response: ans ?? null, correct, awarded: correct ? Number(q.marks) : 0 };
      });
      const { data, error } = await sb.from("school_quiz_attempts").update({
        submitted_at: new Date().toISOString(),
        status: "submitted",
        score, max_score: max, per_question,
      }).eq("id", input.attempt.id).select().single();
      if (error) throw error;
      return data as QuizAttempt;
    },
    onSuccess: (a) => qc.invalidateQueries({ queryKey: ["quiz-attempts", a.quiz_id] }),
  });
}
export function useMyQuizAttempts(quizId?: Id) {
  return useQuery({
    queryKey: ["my-quiz-attempts", quizId],
    enabled: !!quizId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await sb.from("school_quiz_attempts").select("*").eq("quiz_id", quizId).eq("student_id", user.id).order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as QuizAttempt[];
    },
  });
}

// ── Student "today" — assignments due across all enrolled classes ─────────
export function useStudentTodayFeed(schoolId?: Id) {
  return useQuery({
    queryKey: ["student-today", schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { assignments: [] as Assignment[], quizzes: [] as Quiz[] };
      const { data: enr } = await sb.from("enrollments").select("class_id").eq("school_id", schoolId).eq("student_id", user.id).eq("status", "active");
      const classIds = (enr ?? []).map((r: any) => r.class_id);
      if (!classIds.length) return { assignments: [], quizzes: [] };
      const { data: assignments } = await sb.from("assignments").select("*").in("class_id", classIds).eq("status", "published").is("deleted_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(20);
      const { data: quizzes } = await sb.from("quizzes").select("*").in("class_id", classIds).eq("status", "published").is("deleted_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(20);
      return { assignments: (assignments ?? []) as Assignment[], quizzes: (quizzes ?? []) as Quiz[] };
    },
  });
}

// ── User search by email (admin: enroll students / assign teachers) ──────
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("id").ilike("email", email.trim()).maybeSingle();
  return (data as any)?.id ?? null;
}
