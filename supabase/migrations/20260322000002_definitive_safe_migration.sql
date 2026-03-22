-- ================================================================
-- StudySync Definitive Safe Migration
-- Version: 2026-03-22-v3
-- File: 20260322000002_definitive_safe_migration.sql
--
-- INSTRUCTIONS:
--   Paste this ENTIRE file into the Supabase SQL Editor and click Run.
--   It is 100% idempotent — safe to run multiple times.
--   It handles any combination of tables/columns already existing.
--
-- WHAT IT DOES:
--   1. Ensures the update_updated_at_column() trigger function exists.
--   2. Adds missing columns to tables that already exist (subjects,
--      academic_profiles, documents, topic_mastery, quiz_attempts,
--      user_progress, study_schedule, subject_exams, exam_settings).
--   3. Creates tables that don't yet exist:
--      topic_mastery, quiz_attempts, user_progress, study_schedule,
--      subject_exams, exam_settings, flashcards, tutor_tutorials,
--      topic_tutor_rankings, tutorial_watch_events, library_saved_items.
--   4. Adds RLS policies, indexes and triggers (all idempotent).
--   5. Creates/replaces functions: upsert_academic_profile,
--      get_published_tutorials, get_subject_context.
--   6. Reloads the PostgREST schema cache.
-- ================================================================


-- ────────────────────────────────────────────────────────────────
-- STEP 0 – Core trigger function (must exist before any trigger)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- PART A – PATCH EXISTING TABLES (add missing columns)
-- Every ALTER uses ADD COLUMN IF NOT EXISTS → zero risk.
-- ════════════════════════════════════════════════════════════════

-- ── A1. subjects ─────────────────────────────────────────────────
-- subjects exists from March 9 baseline but wrapping for safety
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='subjects'
  ) THEN
    ALTER TABLE public.subjects
      ADD COLUMN IF NOT EXISTS icon_emoji    TEXT,
      ADD COLUMN IF NOT EXISTS icon_gradient TEXT;

    -- Back-fill icons (COALESCE keeps existing values)
    UPDATE public.subjects SET
      icon_emoji = CASE
        WHEN icon_emoji IS NOT NULL THEN icon_emoji
        WHEN lower(name) IN ('mathematics','maths','math') THEN '📐'
        WHEN lower(name) = 'physics'               THEN '⚛️'
        WHEN lower(name) = 'chemistry'             THEN '🧪'
        WHEN lower(name) = 'biology'               THEN '🧬'
        WHEN lower(name) IN ('english','english language') THEN '📖'
        WHEN lower(name) = 'literature'            THEN '🪶'
        WHEN lower(name) = 'geography'             THEN '🌍'
        WHEN lower(name) = 'history'               THEN '🏛️'
        WHEN lower(name) IN ('computer science','ict') THEN '💻'
        WHEN lower(name) = 'economics'             THEN '📊'
        WHEN lower(name) = 'accounting'            THEN '🧮'
        WHEN lower(name) = 'business studies'      THEN '💼'
        WHEN lower(name) = 'agriculture'           THEN '🌾'
        WHEN lower(name) = 'sociology'             THEN '👥'
        WHEN lower(name) = 'psychology'            THEN '🧠'
        WHEN lower(name) = 'law'                   THEN '⚖️'
        WHEN lower(name) = 'music'                 THEN '🎵'
        WHEN lower(name) = 'art'                   THEN '🎨'
        WHEN lower(name) = 'physical education'    THEN '⚽'
        ELSE '📚'
      END,
      icon_gradient = CASE
        WHEN icon_gradient IS NOT NULL THEN icon_gradient
        WHEN lower(name) IN ('mathematics','maths','math') THEN 'from-purple-500 to-violet-600'
        WHEN lower(name) = 'physics'               THEN 'from-blue-500 to-indigo-600'
        WHEN lower(name) = 'chemistry'             THEN 'from-green-500 to-emerald-600'
        WHEN lower(name) = 'biology'               THEN 'from-pink-500 to-rose-600'
        WHEN lower(name) IN ('english','english language') THEN 'from-orange-500 to-amber-600'
        WHEN lower(name) = 'geography'             THEN 'from-lime-500 to-green-600'
        WHEN lower(name) = 'history'               THEN 'from-stone-500 to-amber-700'
        WHEN lower(name) IN ('computer science','ict') THEN 'from-cyan-500 to-sky-600'
        WHEN lower(name) = 'economics'             THEN 'from-teal-500 to-cyan-600'
        WHEN lower(name) = 'accounting'            THEN 'from-blue-500 to-indigo-600'
        WHEN lower(name) = 'business studies'      THEN 'from-teal-500 to-cyan-600'
        WHEN lower(name) = 'psychology'            THEN 'from-violet-500 to-purple-700'
        WHEN lower(name) = 'law'                   THEN 'from-slate-500 to-gray-700'
        WHEN lower(name) = 'music'                 THEN 'from-indigo-500 to-violet-600'
        ELSE 'from-gray-500 to-slate-600'
      END;
  END IF;
END $$;

-- Unique index on (user_id, lower(name)) — safe
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_user_lower_name_unique
  ON public.subjects (user_id, lower(name));


-- ── A2. academic_profiles ────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='academic_profiles'
  ) THEN
    ALTER TABLE public.academic_profiles
      ADD COLUMN IF NOT EXISTS study_level  TEXT,
      ADD COLUMN IF NOT EXISTS exam_board   TEXT,
      ADD COLUMN IF NOT EXISTS school_name  TEXT,
      ADD COLUMN IF NOT EXISTS target_grade TEXT;

    UPDATE public.academic_profiles
      SET study_level = grade
      WHERE study_level IS NULL AND grade IS NOT NULL;
  END IF;
END $$;


-- ── A3. documents ────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='documents'
  ) THEN
    ALTER TABLE public.documents
      ADD COLUMN IF NOT EXISTS document_type TEXT;

    UPDATE public.documents
      SET document_type = type
      WHERE document_type IS NULL AND type IS NOT NULL;
  END IF;
END $$;


-- ── A4. topic_mastery — add columns added after March 9 ──────────
-- Wrapped in DO block: silently skips if table doesn't exist yet
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='topic_mastery'
  ) THEN
    ALTER TABLE public.topic_mastery
      ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;

    -- Sync attempts from total_attempts if that column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='topic_mastery'
        AND column_name='total_attempts'
    ) THEN
      UPDATE public.topic_mastery
        SET attempts = COALESCE(total_attempts, 0)
        WHERE attempts = 0 AND total_attempts IS NOT NULL;
    END IF;
  END IF;
END $$;


-- ── A5. quiz_attempts — add SM-2 and grading columns ────────────
-- Wrapped in DO block: silently skips if table doesn't exist yet
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='quiz_attempts'
  ) THEN
    ALTER TABLE public.quiz_attempts
      ADD COLUMN IF NOT EXISTS model_answer      TEXT,
      ADD COLUMN IF NOT EXISTS user_answer       TEXT,
      ADD COLUMN IF NOT EXISTS marks_awarded     NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS marks_possible    NUMERIC(5,2),
      ADD COLUMN IF NOT EXISTS difficulty_rating NUMERIC(3,2),
      ADD COLUMN IF NOT EXISTS command_word      TEXT,
      ADD COLUMN IF NOT EXISTS concepts_tested   TEXT[],
      ADD COLUMN IF NOT EXISTS next_review_date  DATE,
      ADD COLUMN IF NOT EXISTS review_count      INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ease_factor       NUMERIC(4,2) DEFAULT 2.5,
      ADD COLUMN IF NOT EXISTS interval_days     INTEGER DEFAULT 1;
  END IF;
END $$;


-- ── A6. user_progress — add gamification columns ─────────────────
-- Wrapped in DO block: silently skips if table doesn't exist yet
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='user_progress'
  ) THEN
    ALTER TABLE public.user_progress
      ADD COLUMN IF NOT EXISTS badges          JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS last_study_date DATE,
      ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;


-- ── A7. study_schedule — add AI-plan columns ─────────────────────
-- Wrapped in DO block: silently skips if table doesn't exist yet
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='study_schedule'
  ) THEN
    ALTER TABLE public.study_schedule
      ADD COLUMN IF NOT EXISTS task_type        TEXT DEFAULT 'revision',
      ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30,
      ADD COLUMN IF NOT EXISTS is_completed     BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS notes            TEXT,
      ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;


-- ── A8. subject_exams — add subject linkage + paper columns ──────
-- Wrapped in DO block: silently skips if table doesn't exist yet
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='subject_exams'
  ) THEN
    ALTER TABLE public.subject_exams
      ADD COLUMN IF NOT EXISTS subject_id   UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS subject_name TEXT,
      ADD COLUMN IF NOT EXISTS paper_number TEXT,
      ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT now();

    -- Back-fill subject_id from subject_name where possible
    UPDATE public.subject_exams se
    SET subject_id = s.id
    FROM public.subjects s
    WHERE s.user_id = se.user_id
      AND lower(s.name) = lower(se.subject_name)
      AND se.subject_id IS NULL;
  END IF;
END $$;


-- ── A9. exam_settings — add name/date if missing ─────────────────
-- Wrapped in DO block: silently skips if table doesn't exist yet
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='exam_settings'
  ) THEN
    ALTER TABLE public.exam_settings
      ADD COLUMN IF NOT EXISTS exam_name  TEXT DEFAULT 'Examinations',
      ADD COLUMN IF NOT EXISTS exam_date  DATE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- PART B – CREATE MISSING TABLES
-- Each table uses CREATE TABLE IF NOT EXISTS → zero risk.
-- ════════════════════════════════════════════════════════════════

-- ── B1. topic_mastery (if somehow missing) ───────────────────────
CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id                  UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id          UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  topic_name          TEXT NOT NULL,
  mastery_percentage  NUMERIC(5,2) NOT NULL DEFAULT 0,
  attempts            INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_mastery_unique UNIQUE (user_id, subject_id, topic_name)
);

ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='topic_mastery'
      AND policyname='Users can manage own topic mastery'
  ) THEN
    CREATE POLICY "Users can manage own topic mastery"
      ON public.topic_mastery FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user_subject
  ON public.topic_mastery (user_id, subject_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='topic_mastery'
      AND trigger_name='update_topic_mastery_updated_at'
  ) THEN
    CREATE TRIGGER update_topic_mastery_updated_at
      BEFORE UPDATE ON public.topic_mastery
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ── B2. quiz_attempts ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id        UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_name        TEXT NOT NULL,
  question          TEXT NOT NULL,
  model_answer      TEXT,
  user_answer       TEXT,
  was_correct       BOOLEAN NOT NULL DEFAULT FALSE,
  marks_awarded     NUMERIC(5,2),
  marks_possible    NUMERIC(5,2),
  difficulty_rating NUMERIC(3,2),
  command_word      TEXT,
  concepts_tested   TEXT[],
  next_review_date  DATE,
  review_count      INTEGER NOT NULL DEFAULT 0,
  ease_factor       NUMERIC(4,2) NOT NULL DEFAULT 2.5,
  interval_days     INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='quiz_attempts'
      AND policyname='Users can manage own quiz attempts'
  ) THEN
    CREATE POLICY "Users can manage own quiz attempts"
      ON public.quiz_attempts FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_subject
  ON public.quiz_attempts (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_review_date
  ON public.quiz_attempts (user_id, next_review_date);


-- ── B3. user_progress ────────────────────────────────────────────
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

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_progress'
      AND policyname='Users can manage own progress'
  ) THEN
    CREATE POLICY "Users can manage own progress"
      ON public.user_progress FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='user_progress'
      AND trigger_name='update_user_progress_updated_at'
  ) THEN
    CREATE TRIGGER update_user_progress_updated_at
      BEFORE UPDATE ON public.user_progress
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ── B4. study_schedule ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.study_schedule (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_name       TEXT NOT NULL,
  scheduled_date   DATE NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  task_type        TEXT DEFAULT 'revision',
  is_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_schedule ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='study_schedule'
      AND policyname='Users can manage own study schedule'
  ) THEN
    CREATE POLICY "Users can manage own study schedule"
      ON public.study_schedule FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_schedule_user_date
  ON public.study_schedule (user_id, scheduled_date);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='study_schedule'
      AND trigger_name='update_study_schedule_updated_at'
  ) THEN
    CREATE TRIGGER update_study_schedule_updated_at
      BEFORE UPDATE ON public.study_schedule
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ── B5. subject_exams ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subject_exams (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id   UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  subject_name TEXT,
  exam_name    TEXT NOT NULL,
  exam_date    DATE NOT NULL,
  paper_number TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_exams ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subject_exams'
      AND policyname='Users can manage own subject exams'
  ) THEN
    CREATE POLICY "Users can manage own subject exams"
      ON public.subject_exams FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subject_exams_user_date
  ON public.subject_exams (user_id, exam_date);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='subject_exams'
      AND trigger_name='update_subject_exams_updated_at'
  ) THEN
    CREATE TRIGGER update_subject_exams_updated_at
      BEFORE UPDATE ON public.subject_exams
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ── B6. exam_settings ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exam_settings (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name  TEXT NOT NULL DEFAULT 'Examinations',
  exam_date  DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_settings_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='exam_settings'
      AND policyname='Users can manage own exam settings'
  ) THEN
    CREATE POLICY "Users can manage own exam settings"
      ON public.exam_settings FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='exam_settings'
      AND trigger_name='update_exam_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_exam_settings_updated_at
      BEFORE UPDATE ON public.exam_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ── B7. flashcards (SM-2 spaced repetition) ──────────────────────
CREATE TABLE IF NOT EXISTS public.flashcards (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject          TEXT NOT NULL,
  topic            TEXT NOT NULL,
  front            TEXT NOT NULL,
  back             TEXT NOT NULL,
  hint             TEXT,
  difficulty       TEXT NOT NULL DEFAULT 'medium',
  tags             TEXT[] DEFAULT '{}',
  -- SM-2 fields
  ease_factor      NUMERIC(4,2) NOT NULL DEFAULT 2.5,
  interval_days    INTEGER NOT NULL DEFAULT 1,
  review_count     INTEGER NOT NULL DEFAULT 0,
  next_review_date DATE,
  last_reviewed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='flashcards'
      AND policyname='Users can manage own flashcards'
  ) THEN
    CREATE POLICY "Users can manage own flashcards"
      ON public.flashcards FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flashcards_user_subject
  ON public.flashcards (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_review_date
  ON public.flashcards (user_id, next_review_date);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='flashcards'
      AND trigger_name='update_flashcards_updated_at'
  ) THEN
    CREATE TRIGGER update_flashcards_updated_at
      BEFORE UPDATE ON public.flashcards
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ── B8. tutor_tutorials ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutor_tutorials (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  subject         TEXT NOT NULL,
  topic           TEXT NOT NULL,
  subtopic        TEXT,
  grade           TEXT,
  curriculum      TEXT DEFAULT 'ZIMSEC',
  video_url       TEXT,
  thumbnail_url   TEXT,
  duration_label  TEXT,
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  watch_count     INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  rating          NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_tutorials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_tutorials'
      AND policyname='Tutors can manage own tutorials'
  ) THEN
    CREATE POLICY "Tutors can manage own tutorials"
      ON public.tutor_tutorials FOR ALL
      USING (auth.uid() = tutor_id)
      WITH CHECK (auth.uid() = tutor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_tutorials'
      AND policyname='Anyone can view published tutorials'
  ) THEN
    CREATE POLICY "Anyone can view published tutorials"
      ON public.tutor_tutorials FOR SELECT
      USING (status = 'published');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='tutor_tutorials'
      AND trigger_name='update_tutor_tutorials_updated_at'
  ) THEN
    CREATE TRIGGER update_tutor_tutorials_updated_at
      BEFORE UPDATE ON public.tutor_tutorials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ── B9. topic_tutor_rankings ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.topic_tutor_rankings (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id    UUID NOT NULL REFERENCES public.tutor_tutorials(id) ON DELETE CASCADE,
  subject        TEXT NOT NULL,
  topic          TEXT NOT NULL,
  grade          TEXT,
  curriculum     TEXT,
  rank_score     NUMERIC(10,4) NOT NULL DEFAULT 0,
  watch_count    INTEGER NOT NULL DEFAULT 0,
  avg_rating     NUMERIC(3,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_tutor_rankings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='topic_tutor_rankings'
      AND policyname='Anyone can view tutor rankings'
  ) THEN
    CREATE POLICY "Anyone can view tutor rankings"
      ON public.topic_tutor_rankings FOR SELECT USING (true);
  END IF;
END $$;


-- ── B10. tutorial_watch_events ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tutorial_watch_events (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id   UUID NOT NULL REFERENCES public.tutor_tutorials(id) ON DELETE CASCADE,
  learner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  progress_pct  NUMERIC(5,2) DEFAULT 0,
  completed     BOOLEAN DEFAULT FALSE
);

ALTER TABLE public.tutorial_watch_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutorial_watch_events'
      AND policyname='Users can manage own watch events'
  ) THEN
    CREATE POLICY "Users can manage own watch events"
      ON public.tutorial_watch_events FOR ALL
      USING (auth.uid() = learner_id)
      WITH CHECK (auth.uid() = learner_id);
  END IF;
END $$;


-- ── B11. library_saved_items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.library_saved_items (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutorial_id UUID NOT NULL REFERENCES public.tutor_tutorials(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT library_saved_items_unique UNIQUE (user_id, tutorial_id)
);

ALTER TABLE public.library_saved_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='library_saved_items'
      AND policyname='Users can manage own library'
  ) THEN
    CREATE POLICY "Users can manage own library"
      ON public.library_saved_items FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_library_saved_items_user
  ON public.library_saved_items (user_id);


-- ── B12. academic_profiles (if missing) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.academic_profiles (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curriculum   TEXT NOT NULL DEFAULT 'ZIMSEC',
  grade        TEXT,
  study_level  TEXT,
  exam_board   TEXT,
  school_name  TEXT,
  target_grade TEXT,
  subjects     JSONB NOT NULL DEFAULT '[]',
  exam_year    INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academic_profiles_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.academic_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academic_profiles'
      AND policyname='Learners can view own academic profile'
  ) THEN
    CREATE POLICY "Learners can view own academic profile"
      ON public.academic_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academic_profiles'
      AND policyname='Learners can insert own academic profile'
  ) THEN
    CREATE POLICY "Learners can insert own academic profile"
      ON public.academic_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academic_profiles'
      AND policyname='Learners can update own academic profile'
  ) THEN
    CREATE POLICY "Learners can update own academic profile"
      ON public.academic_profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_schema='public' AND event_object_table='academic_profiles'
      AND trigger_name='update_academic_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_academic_profiles_updated_at
      BEFORE UPDATE ON public.academic_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- ════════════════════════════════════════════════════════════════
-- PART C – FUNCTIONS (CREATE OR REPLACE = always safe)
-- ════════════════════════════════════════════════════════════════

-- ── C1. upsert_academic_profile ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_academic_profile(
  p_curriculum   TEXT,
  p_grade        TEXT,
  p_subjects     JSONB,
  p_exam_year    INTEGER DEFAULT NULL,
  p_study_level  TEXT    DEFAULT NULL,
  p_exam_board   TEXT    DEFAULT NULL,
  p_school_name  TEXT    DEFAULT NULL,
  p_target_grade TEXT    DEFAULT NULL
)
RETURNS public.academic_profiles LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_row  public.academic_profiles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.academic_profiles
    (user_id, curriculum, grade, subjects, exam_year,
     study_level, exam_board, school_name, target_grade)
  VALUES
    (v_uid, p_curriculum, p_grade, p_subjects, p_exam_year,
     p_study_level, p_exam_board, p_school_name, p_target_grade)
  ON CONFLICT (user_id) DO UPDATE SET
    curriculum   = EXCLUDED.curriculum,
    grade        = EXCLUDED.grade,
    subjects     = EXCLUDED.subjects,
    exam_year    = COALESCE(EXCLUDED.exam_year, academic_profiles.exam_year),
    study_level  = COALESCE(EXCLUDED.study_level, academic_profiles.study_level),
    exam_board   = COALESCE(EXCLUDED.exam_board, academic_profiles.exam_board),
    school_name  = COALESCE(EXCLUDED.school_name, academic_profiles.school_name),
    target_grade = COALESCE(EXCLUDED.target_grade, academic_profiles.target_grade),
    updated_at   = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT,TEXT,JSONB,INTEGER,TEXT,TEXT,TEXT,TEXT)
  TO authenticated;


-- ── C2. get_published_tutorials ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_published_tutorials(
  p_subject   TEXT DEFAULT NULL,
  p_topic     TEXT DEFAULT NULL,
  p_grade     TEXT DEFAULT NULL,
  p_limit     INTEGER DEFAULT 20,
  p_offset    INTEGER DEFAULT 0
)
RETURNS TABLE (
  id             UUID,
  title          TEXT,
  description    TEXT,
  subject        TEXT,
  topic          TEXT,
  subtopic       TEXT,
  grade          TEXT,
  curriculum     TEXT,
  video_url      TEXT,
  thumbnail_url  TEXT,
  duration_label TEXT,
  watch_count    INTEGER,
  rating         NUMERIC,
  review_count   INTEGER,
  tutor_name     TEXT,
  created_at     TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    t.id,
    t.title,
    t.description,
    t.subject,
    t.topic,
    t.subtopic,
    t.grade,
    t.curriculum,
    t.video_url,
    t.thumbnail_url,
    t.duration_label,
    t.watch_count,
    t.rating,
    t.review_count,
    COALESCE(
      (SELECT raw_user_meta_data->>'full_name'
       FROM auth.users WHERE id = t.tutor_id),
      (SELECT email FROM auth.users WHERE id = t.tutor_id),
      'Unknown Tutor'
    ) AS tutor_name,
    t.created_at
  FROM public.tutor_tutorials t
  WHERE t.status = 'published'
    AND (p_subject IS NULL OR lower(t.subject) = lower(p_subject))
    AND (p_topic   IS NULL OR lower(t.topic)   LIKE '%' || lower(p_topic) || '%')
    AND (p_grade   IS NULL OR t.grade = p_grade)
  ORDER BY t.rating DESC, t.watch_count DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_tutorials(TEXT,TEXT,TEXT,INTEGER,INTEGER)
  TO anon, authenticated;


-- ── C3. get_subject_context ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_subject_context(
  p_subject_id  UUID,
  p_topic_name  TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_uid                     UUID := auth.uid();
  v_subject_name            TEXT;
  v_all_topics              JSONB;
  v_exam_patterns           JSONB;
  v_past_questions          JSONB := '[]';
  v_merged_topic            JSONB;
  v_context                 TEXT  := '';
  v_mastered_count          INTEGER := 0;
  v_total_count             INTEGER := 0;
  v_syllabus_progress       INTEGER := 0;
  v_freq_sum                NUMERIC := 0;
  v_freq_count              INTEGER := 0;
  v_exam_weight_from_papers INTEGER := 0;
  v_t                       JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Load subject
  SELECT s.name, COALESCE(s.topics, '[]'), COALESCE(s.exam_patterns, '{}')
  INTO v_subject_name, v_all_topics, v_exam_patterns
  FROM public.subjects s
  WHERE s.id = p_subject_id AND s.user_id = v_uid;

  IF v_subject_name IS NULL THEN
    RETURN jsonb_build_object('error', 'Subject not found');
  END IF;

  -- Total topic count
  v_total_count := jsonb_array_length(v_all_topics);

  -- Find matching topic in syllabus
  IF p_topic_name IS NOT NULL THEN
    SELECT t.value INTO v_merged_topic
    FROM jsonb_array_elements(v_all_topics) AS t(value)
    WHERE lower(COALESCE(t.value->>'name','')) = lower(p_topic_name)
       OR lower(COALESCE(t.value->>'topic_name','')) = lower(p_topic_name)
    LIMIT 1;
  END IF;

  -- Load exam patterns for frequency analysis
  SELECT COALESCE(ep.patterns, '[]') INTO v_exam_patterns
  FROM public.exam_patterns ep
  WHERE ep.subject_id = p_subject_id
  LIMIT 1;

  -- Past paper questions (best-effort — may not exist)
  BEGIN
    SELECT jsonb_agg(
      jsonb_build_object(
        'question',    d.content,
        'topic_name',  p_topic_name,
        'document_id', d.id
      )
    ) INTO v_past_questions
    FROM public.documents d
    WHERE d.user_id = v_uid
      AND d.subject  = v_subject_name
      AND d.type IN ('past_paper','mark_scheme')
    LIMIT 5;
  EXCEPTION WHEN OTHERS THEN
    v_past_questions := '[]';
  END;

  -- Mastery count (safe — topic_mastery exists per Part B1 above)
  SELECT COUNT(*) INTO v_mastered_count
  FROM public.topic_mastery tm
  WHERE tm.subject_id = p_subject_id
    AND tm.user_id    = v_uid
    AND COALESCE(tm.mastery_percentage, 0) >= 70;

  IF v_total_count > 0 THEN
    v_syllabus_progress :=
      ROUND((v_mastered_count::numeric / v_total_count::numeric) * 100)::int;
  END IF;

  -- Compute exam weight from past-paper patterns
  FOR v_t IN SELECT value FROM jsonb_array_elements(v_exam_patterns) LOOP
    IF lower(COALESCE(v_t->>'topic_name','')) LIKE '%' || lower(COALESCE(p_topic_name,'')) || '%'
       OR lower(COALESCE(p_topic_name,'')) LIKE '%' || lower(COALESCE(v_t->>'topic_name','')) || '%'
    THEN
      v_freq_sum   := v_freq_sum + COALESCE((v_t->>'frequency_score')::numeric, 0);
      v_freq_count := v_freq_count + 1;
    END IF;
  END LOOP;

  IF v_freq_count > 0 THEN
    v_exam_weight_from_papers := ROUND(v_freq_sum / v_freq_count)::int;
  ELSE
    v_exam_weight_from_papers :=
      COALESCE((v_merged_topic->>'examWeight')::numeric, 0)::int;
  END IF;

  -- Build context string
  IF v_merged_topic IS NOT NULL THEN
    v_context := v_context || '=== SYLLABUS DATA FOR: ' || p_topic_name || E' ===\n';
    IF jsonb_array_length(COALESCE(v_merged_topic->'subtopics','[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Subtopics: ' || (
        SELECT string_agg(value::text, ' | ')
        FROM jsonb_array_elements_text(v_merged_topic->'subtopics')
      ) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'learningObjectives','[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Learning Objectives:' || E'\n  - ' || (
        SELECT string_agg(value::text, E'\n  - ')
        FROM jsonb_array_elements_text(v_merged_topic->'learningObjectives')
      ) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'concepts','[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Key Concepts: ' || (
        SELECT string_agg(value::text, ', ')
        FROM jsonb_array_elements_text(v_merged_topic->'concepts')
      ) || E'\n';
    END IF;
    IF v_exam_weight_from_papers > 0 THEN
      v_context := v_context || 'Exam Weight Estimate: '
                   || v_exam_weight_from_papers || '%' || E'\n';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'subjectName',          v_subject_name,
    'topic',                v_merged_topic,
    'allTopics',            v_all_topics,
    'examPatterns',         v_exam_patterns,
    'pastPaperQuestions',   COALESCE(v_past_questions,'[]'),
    'examWeightFromPapers', v_exam_weight_from_papers,
    'masteredTopicCount',   v_mastered_count,
    'totalTopicCount',      v_total_count,
    'syllabusProgress',     v_syllabus_progress,
    'curriculumContext',    trim(v_context)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subject_context(UUID, TEXT)
  TO authenticated;


-- ════════════════════════════════════════════════════════════════
-- PART D – STORAGE BUCKETS (exception-safe)
-- ════════════════════════════════════════════════════════════════
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES
    ('tutorial-videos',     'tutorial-videos',     true),
    ('tutorial-thumbnails', 'tutorial-thumbnails', true)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════════
-- PART E – REALTIME PUBLICATIONS (exception-safe)
-- ════════════════════════════════════════════════════════════════
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
      AND tablename='tutor_tutorials'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.tutor_tutorials; END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public'
      AND tablename='academic_profiles'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_profiles; END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ════════════════════════════════════════════════════════════════
-- FINAL – Reload PostgREST schema cache
-- ════════════════════════════════════════════════════════════════
NOTIFY pgrst, 'reload schema';
