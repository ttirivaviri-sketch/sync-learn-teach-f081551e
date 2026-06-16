
-- ───────────────────────────────────────────────────────────────────────────
-- P10: school-scoped flashcards
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS school_id uuid,
  ADD COLUMN IF NOT EXISTS class_id uuid,
  ADD COLUMN IF NOT EXISTS source_document_id uuid,
  ADD COLUMN IF NOT EXISTS scope text NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal','class','grade','school')),
  ADD COLUMN IF NOT EXISTS shared_template_id uuid;

CREATE INDEX IF NOT EXISTS idx_flashcards_school ON public.flashcards(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_template ON public.flashcards(shared_template_id);

-- Existing flashcards RLS is user-scoped. Add a policy so students enrolled in a
-- class can also read shared-template flashcards published for that class.
DROP POLICY IF EXISTS "Students read class flashcards" ON public.flashcards;
CREATE POLICY "Students read class flashcards"
  ON public.flashcards FOR SELECT
  TO authenticated
  USING (
    scope <> 'personal'
    AND class_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.class_id = flashcards.class_id
        AND e.student_id = auth.uid()
        AND e.status = 'active'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- P11: teacher AI settings
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_ai_settings (
  teacher_id uuid PRIMARY KEY,
  school_id uuid NOT NULL,
  auto_release_grades boolean NOT NULL DEFAULT false,
  auto_release_feedback boolean NOT NULL DEFAULT true,
  feedback_style text NOT NULL DEFAULT 'examiner' CHECK (feedback_style IN ('concise','examiner','encouraging')),
  homework_difficulty_default text NOT NULL DEFAULT 'medium' CHECK (homework_difficulty_default IN ('easy','medium','hard','mixed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_ai_settings TO authenticated;
GRANT ALL ON public.teacher_ai_settings TO service_role;

ALTER TABLE public.teacher_ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher manages own ai settings"
  ON public.teacher_ai_settings FOR ALL
  TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Students read teacher settings for own school"
  ON public.teacher_ai_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = teacher_ai_settings.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- P11: school_homework (one row per shared homework)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid,
  teacher_id uuid NOT NULL,
  source_document_id uuid,
  title text NOT NULL,
  topic text,
  difficulty text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard','mixed')),
  instructions text,
  due_at timestamptz,
  total_marks numeric NOT NULL DEFAULT 0,
  auto_release_grades boolean NOT NULL DEFAULT false,
  auto_release_feedback boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_homework TO authenticated;
GRANT ALL ON public.school_homework TO service_role;

ALTER TABLE public.school_homework ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher/admin manages homework in own school"
  ON public.school_homework FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = school_homework.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('school_admin','school_teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = school_homework.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('school_admin','school_teacher')
    )
  );

CREATE POLICY "Enrolled students read published homework"
  ON public.school_homework FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.class_id = school_homework.class_id
        AND e.student_id = auth.uid()
        AND e.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_school_homework_class ON public.school_homework(class_id, status);
CREATE INDEX IF NOT EXISTS idx_school_homework_teacher ON public.school_homework(teacher_id);

-- ───────────────────────────────────────────────────────────────────────────
-- P11: school_homework_questions (shared rubric)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_homework_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.school_homework(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  ord integer NOT NULL,
  prompt text NOT NULL,
  question_type text NOT NULL DEFAULT 'short_answer' CHECK (question_type IN ('multiple_choice','true_false','short_answer','long_answer','exam_style')),
  options jsonb,
  expected_answer text,
  examiner_notes text,
  common_mistakes text,
  concepts text[],
  marks numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(homework_id, ord)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_homework_questions TO authenticated;
GRANT ALL ON public.school_homework_questions TO service_role;

ALTER TABLE public.school_homework_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher/admin manages questions in own school"
  ON public.school_homework_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = school_homework_questions.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('school_admin','school_teacher')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = school_homework_questions.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('school_admin','school_teacher')
    )
  );

CREATE POLICY "Enrolled students read questions for published homework"
  ON public.school_homework_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_homework h
      JOIN public.enrollments e ON e.class_id = h.class_id
      WHERE h.id = school_homework_questions.homework_id
        AND h.status = 'published'
        AND e.student_id = auth.uid()
        AND e.status = 'active'
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- P11: school_homework_responses (per-student per-question)
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_homework_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id uuid NOT NULL REFERENCES public.school_homework(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.school_homework_questions(id) ON DELETE CASCADE,
  school_id uuid NOT NULL,
  student_id uuid NOT NULL,
  student_answer text,
  ai_score numeric,
  ai_feedback jsonb,
  teacher_score numeric,
  teacher_comment text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','ai_marked','teacher_reviewed','released')),
  submitted_at timestamptz,
  marked_at timestamptz,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(question_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_homework_responses TO authenticated;
GRANT ALL ON public.school_homework_responses TO service_role;

ALTER TABLE public.school_homework_responses ENABLE ROW LEVEL SECURITY;

-- Students can read & write their own responses
CREATE POLICY "Student manages own responses"
  ON public.school_homework_responses FOR ALL
  TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Teachers/admins in the school can read all responses and update teacher fields
CREATE POLICY "Teacher/admin reads all responses in school"
  ON public.school_homework_responses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = school_homework_responses.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('school_admin','school_teacher')
    )
  );

CREATE POLICY "Teacher/admin updates responses in school"
  ON public.school_homework_responses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = school_homework_responses.school_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('school_admin','school_teacher')
    )
  );

CREATE INDEX IF NOT EXISTS idx_hw_responses_student ON public.school_homework_responses(student_id, status);
CREATE INDEX IF NOT EXISTS idx_hw_responses_homework ON public.school_homework_responses(homework_id, status);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS school_homework_touch ON public.school_homework;
CREATE TRIGGER school_homework_touch BEFORE UPDATE ON public.school_homework
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS school_homework_responses_touch ON public.school_homework_responses;
CREATE TRIGGER school_homework_responses_touch BEFORE UPDATE ON public.school_homework_responses
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

DROP TRIGGER IF EXISTS teacher_ai_settings_touch ON public.teacher_ai_settings;
CREATE TRIGGER teacher_ai_settings_touch BEFORE UPDATE ON public.teacher_ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();
