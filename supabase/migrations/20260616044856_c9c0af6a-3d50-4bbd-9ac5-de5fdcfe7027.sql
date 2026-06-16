
-- =========================================================================
-- P4 + P5: School academic hierarchy, content, assignments, quizzes, etc.
-- =========================================================================

-- ── Enums ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.enrollment_status AS ENUM ('active','withdrawn','suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.resource_kind AS ENUM ('pdf','doc','ppt','image','note','video','past_paper','link');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_visibility AS ENUM ('school','grade','class','subject','custom');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.content_status AS ENUM ('draft','published','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.announcement_audience AS ENUM ('school','grade','class');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.submission_status AS ENUM ('not_started','draft','submitted','late','graded','returned');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.quiz_question_type AS ENUM ('mcq','short','tf','long');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.quiz_attempt_status AS ENUM ('in_progress','submitted','graded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── grades ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grades TO authenticated;
GRANT ALL ON public.grades TO service_role;
ALTER TABLE public.grades ENABLE ROW LEVEL SECURITY;

-- ── school_subjects ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_subjects TO authenticated;
GRANT ALL ON public.school_subjects TO service_role;
ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;

-- ── classes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  grade_id uuid REFERENCES public.grades(id) ON DELETE SET NULL,
  name text NOT NULL,
  code text,
  homeroom_teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(school_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.classes TO authenticated;
GRANT ALL ON public.classes TO service_role;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS classes_school_idx ON public.classes(school_id);

-- ── class_subjects (teacher assignments) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.school_subjects(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, subject_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_subjects TO authenticated;
GRANT ALL ON public.class_subjects TO service_role;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS class_subjects_teacher_idx ON public.class_subjects(teacher_id);

-- ── enrollments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS enrollments_student_idx ON public.enrollments(student_id);
CREATE INDEX IF NOT EXISTS enrollments_class_idx ON public.enrollments(class_id);

-- ── timetables ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.timetables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetables TO authenticated;
GRANT ALL ON public.timetables TO service_role;
ALTER TABLE public.timetables ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  timetable_id uuid NOT NULL REFERENCES public.timetables(id) ON DELETE CASCADE,
  weekday int NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_min int NOT NULL CHECK (start_min BETWEEN 0 AND 1440),
  end_min int NOT NULL CHECK (end_min BETWEEN 0 AND 1440),
  subject_id uuid REFERENCES public.school_subjects(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_slots TO authenticated;
GRANT ALL ON public.timetable_slots TO service_role;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;

-- ── school_resources ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  grade_id uuid REFERENCES public.grades(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.school_subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.resource_kind NOT NULL,
  title text NOT NULL,
  description text,
  storage_path text,
  external_url text,
  mime text,
  size_bytes bigint,
  version int NOT NULL DEFAULT 1,
  visibility public.content_visibility NOT NULL DEFAULT 'class',
  custom_audience uuid[] DEFAULT '{}'::uuid[],
  status public.content_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_resources TO authenticated;
GRANT ALL ON public.school_resources TO service_role;
ALTER TABLE public.school_resources ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS school_resources_school_idx ON public.school_resources(school_id);
CREATE INDEX IF NOT EXISTS school_resources_class_idx ON public.school_resources(class_id);

-- ── school_videos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  subject_id uuid REFERENCES public.school_subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  storage_path text NOT NULL,
  thumbnail_url text,
  duration_seconds int,
  visibility public.content_visibility NOT NULL DEFAULT 'class',
  also_public boolean NOT NULL DEFAULT false,
  status public.content_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_videos TO authenticated;
GRANT ALL ON public.school_videos TO service_role;
ALTER TABLE public.school_videos ENABLE ROW LEVEL SECURITY;

-- ── announcements ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  audience public.announcement_audience NOT NULL DEFAULT 'school',
  grade_id uuid REFERENCES public.grades(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS announcements_school_idx ON public.announcements(school_id);

-- ── assignments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.school_subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  due_at timestamptz,
  max_score numeric NOT NULL DEFAULT 100,
  attachment_resource_ids uuid[] DEFAULT '{}'::uuid[],
  allow_late boolean NOT NULL DEFAULT true,
  status public.content_status NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS assignments_class_idx ON public.assignments(class_id);

-- ── submissions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  submitted_at timestamptz,
  status public.submission_status NOT NULL DEFAULT 'not_started',
  text_response text,
  attachment_paths text[] DEFAULT '{}'::text[],
  score numeric,
  feedback text,
  graded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  graded_at timestamptz,
  version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS submissions_student_idx ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS submissions_assignment_idx ON public.submissions(assignment_id);

-- ── quizzes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.school_subjects(id) ON DELETE SET NULL,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  time_limit_min int,
  attempts_allowed int NOT NULL DEFAULT 1,
  ai_generated boolean NOT NULL DEFAULT false,
  source_resource_id uuid REFERENCES public.school_resources(id) ON DELETE SET NULL,
  status public.content_status NOT NULL DEFAULT 'published',
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS quizzes_class_idx ON public.quizzes(class_id);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  ord int NOT NULL DEFAULT 0,
  type public.quiz_question_type NOT NULL,
  prompt text NOT NULL,
  options jsonb,
  answer jsonb,
  marks numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_idx ON public.quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS public.school_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  status public.quiz_attempt_status NOT NULL DEFAULT 'in_progress',
  score numeric,
  max_score numeric,
  per_question jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_quiz_attempts TO authenticated;
GRANT ALL ON public.school_quiz_attempts TO service_role;
ALTER TABLE public.school_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS sqa_quiz_idx ON public.school_quiz_attempts(quiz_id);
CREATE INDEX IF NOT EXISTS sqa_student_idx ON public.school_quiz_attempts(student_id);

-- ── updated_at triggers ──────────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'grades','school_subjects','classes','class_subjects','enrollments',
    'timetables','timetable_slots','school_resources','school_videos',
    'announcements','assignments','submissions','quizzes','quiz_questions',
    'school_quiz_attempts'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON public.%I;
       CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t);
  END LOOP;
END $$;

-- ── Helper functions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_class_teacher(_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = _class_id AND c.homeroom_teacher_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.class_subjects cs
    WHERE cs.class_id = _class_id AND cs.teacher_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_class_teacher(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_class_teacher(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_class(_class_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enrollments e
    WHERE e.class_id = _class_id AND e.student_id = auth.uid() AND e.status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_enrolled_in_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in_class(uuid) TO authenticated, service_role;

-- ── RLS policies ─────────────────────────────────────────────────────────
CREATE POLICY "grades read by members" ON public.grades FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "grades manage by school admin" ON public.grades FOR ALL TO authenticated
  USING (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "subjects read by members" ON public.school_subjects FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "subjects manage by school admin" ON public.school_subjects FOR ALL TO authenticated
  USING (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "classes read by members" ON public.classes FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "classes manage by school admin" ON public.classes FOR ALL TO authenticated
  USING (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "class_subjects read by members" ON public.class_subjects FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "class_subjects manage by school admin" ON public.class_subjects FOR ALL TO authenticated
  USING (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "enrollments read by members" ON public.enrollments FOR SELECT TO authenticated
  USING (
    public.is_school_member(school_id,'school_admin')
    OR public.is_school_member(school_id,'school_teacher')
    OR student_id = auth.uid()
    OR public.has_role(auth.uid(),'admin')
  );
CREATE POLICY "enrollments manage by school admin" ON public.enrollments FOR ALL TO authenticated
  USING (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "timetables read by members" ON public.timetables FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "timetables manage by school admin" ON public.timetables FOR ALL TO authenticated
  USING (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "timetable_slots read by members" ON public.timetable_slots FOR SELECT TO authenticated
  USING (public.is_school_member(school_id) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "timetable_slots manage by school admin" ON public.timetable_slots FOR ALL TO authenticated
  USING (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_member(school_id,'school_admin') OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "resources read by visibility" ON public.school_resources FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR public.is_school_member(school_id,'school_teacher')
    OR (
      public.is_school_member(school_id) AND deleted_at IS NULL AND status = 'published' AND (
        visibility = 'school'
        OR (visibility = 'class'   AND class_id   IS NOT NULL AND public.is_enrolled_in_class(class_id))
        OR (visibility = 'grade'   AND grade_id   IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.enrollments e JOIN public.classes c ON c.id=e.class_id
              WHERE e.student_id = auth.uid() AND e.status='active' AND c.grade_id = school_resources.grade_id))
        OR (visibility = 'subject' AND subject_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.enrollments e JOIN public.class_subjects cs ON cs.class_id=e.class_id
              WHERE e.student_id = auth.uid() AND e.status='active' AND cs.subject_id = school_resources.subject_id))
        OR (visibility = 'custom'  AND auth.uid() = ANY(custom_audience))
      )
    )
  );
CREATE POLICY "resources insert by teacher" ON public.school_resources FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR (public.is_school_member(school_id,'school_teacher') AND teacher_id = auth.uid())
  );
CREATE POLICY "resources update by owner or admin" ON public.school_resources FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );
CREATE POLICY "resources delete by owner or admin" ON public.school_resources FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );

CREATE POLICY "videos read by visibility" ON public.school_videos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR public.is_school_member(school_id,'school_teacher')
    OR (
      public.is_school_member(school_id) AND deleted_at IS NULL AND status = 'published' AND (
        visibility = 'school'
        OR (visibility = 'class'   AND class_id   IS NOT NULL AND public.is_enrolled_in_class(class_id))
        OR (visibility = 'subject' AND subject_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.enrollments e JOIN public.class_subjects cs ON cs.class_id=e.class_id
              WHERE e.student_id = auth.uid() AND e.status='active' AND cs.subject_id = school_videos.subject_id))
      )
    )
  );
CREATE POLICY "videos insert by teacher" ON public.school_videos FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR (public.is_school_member(school_id,'school_teacher') AND teacher_id = auth.uid())
  );
CREATE POLICY "videos modify by owner or admin" ON public.school_videos FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );
CREATE POLICY "videos delete by owner or admin" ON public.school_videos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );

CREATE POLICY "announcements read by audience" ON public.announcements FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR public.is_school_member(school_id,'school_teacher')
    OR (
      public.is_school_member(school_id) AND deleted_at IS NULL AND (
        audience = 'school'
        OR (audience = 'class' AND class_id IS NOT NULL AND public.is_enrolled_in_class(class_id))
        OR (audience = 'grade' AND grade_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.enrollments e JOIN public.classes c ON c.id=e.class_id
              WHERE e.student_id = auth.uid() AND e.status='active' AND c.grade_id = announcements.grade_id))
      )
    )
  );
CREATE POLICY "announcements insert by teacher/admin" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR (public.is_school_member(school_id,'school_teacher') AND author_id = auth.uid())
  );
CREATE POLICY "announcements modify by author or admin" ON public.announcements FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR author_id = auth.uid()
  );
CREATE POLICY "announcements delete by author or admin" ON public.announcements FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR author_id = auth.uid()
  );

CREATE POLICY "assignments read" ON public.assignments FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR public.is_class_teacher(class_id)
    OR (public.is_enrolled_in_class(class_id) AND deleted_at IS NULL AND status = 'published')
  );
CREATE POLICY "assignments insert by class teacher" ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR (public.is_class_teacher(class_id) AND teacher_id = auth.uid())
  );
CREATE POLICY "assignments update by owner/admin" ON public.assignments FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );
CREATE POLICY "assignments delete by owner/admin" ON public.assignments FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );

CREATE POLICY "submissions read" ON public.submissions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = submissions.assignment_id AND public.is_class_teacher(a.class_id))
  );
CREATE POLICY "submissions insert by student" ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = assignment_id AND public.is_enrolled_in_class(a.class_id))
  );
CREATE POLICY "submissions update by student or teacher" ON public.submissions FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR (student_id = auth.uid() AND status IN ('not_started','draft','submitted','late'))
    OR EXISTS (SELECT 1 FROM public.assignments a WHERE a.id = submissions.assignment_id AND public.is_class_teacher(a.class_id))
  );

CREATE POLICY "quizzes read" ON public.quizzes FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR public.is_class_teacher(class_id)
    OR (public.is_enrolled_in_class(class_id) AND deleted_at IS NULL AND status = 'published')
  );
CREATE POLICY "quizzes insert by class teacher" ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR (public.is_class_teacher(class_id) AND teacher_id = auth.uid())
  );
CREATE POLICY "quizzes update by owner/admin" ON public.quizzes FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );
CREATE POLICY "quizzes delete by owner/admin" ON public.quizzes FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR teacher_id = auth.uid()
  );

CREATE POLICY "quiz_questions read" ON public.quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id));
CREATE POLICY "quiz_questions manage by teacher/admin" ON public.quiz_questions FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.teacher_id = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND q.teacher_id = auth.uid())
  );

CREATE POLICY "sqa read" ON public.school_quiz_attempts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_class_teacher(q.class_id))
  );
CREATE POLICY "sqa insert by student" ON public.school_quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_enrolled_in_class(q.class_id))
  );
CREATE POLICY "sqa update by student or teacher" ON public.school_quiz_attempts FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.is_school_member(school_id,'school_admin')
    OR (student_id = auth.uid() AND status = 'in_progress')
    OR EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND public.is_class_teacher(q.class_id))
  );

-- ── Storage policies (bucket 'school-content' must be created manually) ──
CREATE POLICY "school-content read by members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'school-content'
  AND public.is_school_member( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "school-content write by teachers/admins"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-content'
  AND (
    public.is_school_member( ((storage.foldername(name))[1])::uuid, 'school_admin')
    OR public.is_school_member( ((storage.foldername(name))[1])::uuid, 'school_teacher')
  )
);

CREATE POLICY "school-content update by teachers/admins"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-content'
  AND (
    public.is_school_member( ((storage.foldername(name))[1])::uuid, 'school_admin')
    OR public.is_school_member( ((storage.foldername(name))[1])::uuid, 'school_teacher')
  )
);

CREATE POLICY "school-content delete by teachers/admins"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-content'
  AND (
    public.is_school_member( ((storage.foldername(name))[1])::uuid, 'school_admin')
    OR public.is_school_member( ((storage.foldername(name))[1])::uuid, 'school_teacher')
  )
);
