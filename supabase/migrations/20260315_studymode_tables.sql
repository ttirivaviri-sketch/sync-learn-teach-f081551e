-- ============================================================
-- StudySync StudyMode Tables Migration
-- Adds: quiz_attempts, user_progress, study_schedule,
--       subject_exams, exam_settings
-- Also adds missing columns to existing tables and fixes
-- the academic_profiles table to match the hook expectations.
-- ============================================================

-- ── 1. Quiz Attempts ─────────────────────────────────────────────────────────
-- Records every quiz attempt for spaced repetition & performance tracking.

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_name       TEXT NOT NULL,
  question         TEXT NOT NULL,
  model_answer     TEXT,
  user_answer      TEXT,
  was_correct      BOOLEAN NOT NULL DEFAULT FALSE,
  marks_awarded    NUMERIC(5,2),
  marks_possible   NUMERIC(5,2),
  difficulty_rating NUMERIC(3,2),
  command_word     TEXT,
  concepts_tested  TEXT[],
  -- SM-2 spaced repetition fields
  next_review_date DATE,
  review_count     INTEGER NOT NULL DEFAULT 0,
  ease_factor      NUMERIC(4,2) NOT NULL DEFAULT 2.5,
  interval_days    INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own quiz attempts"
  ON public.quiz_attempts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_subject
  ON public.quiz_attempts (user_id, subject_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_review_date
  ON public.quiz_attempts (user_id, next_review_date);


-- ── 2. User Progress ─────────────────────────────────────────────────────────
-- Tracks XP, streak, and earned badges for gamification.

CREATE TABLE IF NOT EXISTS public.user_progress (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xp              INTEGER NOT NULL DEFAULT 0,
  streak          INTEGER NOT NULL DEFAULT 0,
  badges          JSONB NOT NULL DEFAULT '[]',
  last_study_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_progress_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own progress"
  ON public.user_progress FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE TRIGGER update_user_progress_updated_at
  BEFORE UPDATE ON public.user_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 3. Study Schedule ────────────────────────────────────────────────────────
-- Stores the AI-generated study calendar for each learner.

CREATE TABLE IF NOT EXISTS public.study_schedule (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_name       TEXT,
  scheduled_date   DATE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  task_type        TEXT NOT NULL DEFAULT 'study',
  is_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own study schedule"
  ON public.study_schedule FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_study_schedule_user_date
  ON public.study_schedule (user_id, scheduled_date);

CREATE TRIGGER update_study_schedule_updated_at
  BEFORE UPDATE ON public.study_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 4. Subject Exams ─────────────────────────────────────────────────────────
-- Per-subject exam dates (used by MultiExamCountdown widget).

CREATE TABLE IF NOT EXISTS public.subject_exams (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id   UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name TEXT NOT NULL,
  exam_name    TEXT NOT NULL,
  exam_date    DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subject exams"
  ON public.subject_exams FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subject_exams_user_date
  ON public.subject_exams (user_id, exam_date);

CREATE TRIGGER update_subject_exams_updated_at
  BEFORE UPDATE ON public.subject_exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 5. Exam Settings ─────────────────────────────────────────────────────────
-- Global exam countdown settings (primary upcoming exam).

CREATE TABLE IF NOT EXISTS public.exam_settings (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name  TEXT NOT NULL,
  exam_date  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_settings_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own exam settings"
  ON public.exam_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_exam_settings_updated_at
  BEFORE UPDATE ON public.exam_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ── 6. Fix academic_profiles table ───────────────────────────────────────────
-- The hook expects study_level and curriculum columns.
-- The existing table from 20260314 uses grade instead of study_level.
-- Add the missing columns so both work.

ALTER TABLE public.academic_profiles
  ADD COLUMN IF NOT EXISTS study_level TEXT,
  ADD COLUMN IF NOT EXISTS exam_board  TEXT,
  ADD COLUMN IF NOT EXISTS school_name TEXT,
  ADD COLUMN IF NOT EXISTS target_grade TEXT;

-- Back-fill study_level from grade for existing rows
UPDATE public.academic_profiles
  SET study_level = grade
  WHERE study_level IS NULL AND grade IS NOT NULL;


-- ── 7. Fix documents table ───────────────────────────────────────────────────
-- The DocumentUpload component sends document_type in the body but inserts
-- using 'type'.  Ensure the column exists with both names (view alias).
-- The 'type' column already exists; add document_type as generated column
-- only if it doesn't exist yet.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type TEXT
    GENERATED ALWAYS AS (type) STORED;


-- ── 8. Notify PostgREST to reload schema ─────────────────────────────────────
NOTIFY pgrst, 'reload schema';
