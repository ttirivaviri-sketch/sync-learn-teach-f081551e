-- =============================================================================
-- Migration: Student Profile Enhancements
-- Date: 2026-04-06
-- Description:
--   1. Add student_email, guardian_email, exam_dates to academic_profiles
--   2. Create study_activity table for tracking tasks/quizzes/revision
--   3. Create tutor_bookings_insights table for AI-generated tutor summaries
--   4. Create analytics_reports cache table for weekly guardian reports
--   5. Update upsert_academic_profile function to support new fields
--   6. RLS policies to ensure student_email and guardian_email are private
-- =============================================================================

-- ── 1. Add new columns to academic_profiles ─────────────────────────────────

DO $$
BEGIN
  -- student_email: only the student can view/edit
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'academic_profiles' AND column_name = 'student_email'
  ) THEN
    ALTER TABLE public.academic_profiles ADD COLUMN student_email TEXT DEFAULT NULL;
  END IF;

  -- guardian_email: receives weekly reports, no login access
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'academic_profiles' AND column_name = 'guardian_email'
  ) THEN
    ALTER TABLE public.academic_profiles ADD COLUMN guardian_email TEXT DEFAULT NULL;
  END IF;

  -- exam_dates: JSON array of {subject, date} objects
  -- e.g. [{"subject":"Mathematics","date":"2026-10-15"},{"subject":"Physics","date":"2026-10-20"}]
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'academic_profiles' AND column_name = 'exam_dates'
  ) THEN
    ALTER TABLE public.academic_profiles ADD COLUMN exam_dates JSONB DEFAULT '[]'::jsonb;
  END IF;
END$$;

-- ── 2. Create study_activity table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.study_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'task',  -- task, quiz, revision, flashcard, exam_practice
  task_completed BOOLEAN NOT NULL DEFAULT false,
  score NUMERIC(5,2) DEFAULT NULL,
  topic TEXT DEFAULT NULL,
  duration_minutes INTEGER DEFAULT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_activity ENABLE ROW LEVEL SECURITY;

-- Students can only see their own activity
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_activity' AND policyname='study_activity_select_own'
  ) THEN
    CREATE POLICY study_activity_select_own ON public.study_activity
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_activity' AND policyname='study_activity_insert_own'
  ) THEN
    CREATE POLICY study_activity_insert_own ON public.study_activity
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='study_activity' AND policyname='study_activity_update_own'
  ) THEN
    CREATE POLICY study_activity_update_own ON public.study_activity
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_study_activity_user_date ON public.study_activity (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_study_activity_user_subject ON public.study_activity (user_id, subject);

-- ── 3. Create tutor_booking_insights table ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tutor_booking_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  insights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- insights_json structure:
  -- { strengths: [], weaknesses: [], study_patterns: {}, topics_needing_help: [], exam_date: "...", risk_level: "green|yellow|red" }
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.tutor_booking_insights ENABLE ROW LEVEL SECURITY;

-- Tutors can only see insights for their own bookings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tutor_booking_insights' AND policyname='tutor_booking_insights_tutor_select'
  ) THEN
    CREATE POLICY tutor_booking_insights_tutor_select ON public.tutor_booking_insights
      FOR SELECT USING (auth.uid() = tutor_id);
  END IF;
END$$;

-- System/edge functions can insert (service_role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tutor_booking_insights' AND policyname='tutor_booking_insights_insert'
  ) THEN
    CREATE POLICY tutor_booking_insights_insert ON public.tutor_booking_insights
      FOR INSERT WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_tutor_booking_insights_booking ON public.tutor_booking_insights (booking_id);
CREATE INDEX IF NOT EXISTS idx_tutor_booking_insights_tutor ON public.tutor_booking_insights (tutor_id);

-- ── 4. Create analytics_reports cache table ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'guardian_weekly',
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- summary_json structure:
  -- { subjects: [{name, progress_pct, tasks_completed, tasks_missed, avg_score, risk_level, exam_date}],
  --   overall_trend: "improving|stable|declining",
  --   weak_areas: [], upcoming_exams: [], recommendations: [] }
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analytics_reports_unique_week UNIQUE(user_id, week_start, report_type)
);

ALTER TABLE public.analytics_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analytics_reports' AND policyname='analytics_reports_select_own'
  ) THEN
    CREATE POLICY analytics_reports_select_own ON public.analytics_reports
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='analytics_reports' AND policyname='analytics_reports_insert'
  ) THEN
    CREATE POLICY analytics_reports_insert ON public.analytics_reports
      FOR INSERT WITH CHECK (true);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_analytics_reports_user_week ON public.analytics_reports (user_id, week_start DESC);

-- ── 5. Update upsert_academic_profile RPC to support new fields ─────────────

CREATE OR REPLACE FUNCTION public.upsert_academic_profile(
  p_curriculum TEXT,
  p_grade TEXT,
  p_subjects TEXT[],
  p_exam_year INTEGER DEFAULT NULL,
  p_student_email TEXT DEFAULT NULL,
  p_guardian_email TEXT DEFAULT NULL,
  p_exam_dates JSONB DEFAULT '[]'::jsonb
)
RETURNS public.academic_profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_row public.academic_profiles;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.academic_profiles (
    user_id, curriculum, grade, subjects, exam_year,
    student_email, guardian_email, exam_dates, updated_at
  )
  VALUES (
    v_user_id, p_curriculum, p_grade, p_subjects, p_exam_year,
    p_student_email, p_guardian_email, p_exam_dates, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    curriculum     = EXCLUDED.curriculum,
    grade          = EXCLUDED.grade,
    subjects       = EXCLUDED.subjects,
    exam_year      = EXCLUDED.exam_year,
    student_email  = COALESCE(EXCLUDED.student_email, academic_profiles.student_email),
    guardian_email  = COALESCE(EXCLUDED.guardian_email, academic_profiles.guardian_email),
    exam_dates     = EXCLUDED.exam_dates,
    updated_at     = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT, TEXT, TEXT[], INTEGER, TEXT, TEXT, JSONB) TO authenticated;

-- ── 6. Privacy: Ensure tutors cannot see student_email or guardian_email ─────
-- The existing RLS on academic_profiles already restricts SELECT to auth.uid() = user_id,
-- which means only the student themselves can see their own profile data including emails.
-- Tutors querying the table will get no rows for other students. This is correct.
-- The tutor_booking_insights table contains only subject-specific AI summaries, not emails.

-- ── 7. Add realtime support for new tables ──────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_publication_tables
    WHERE schemaname = 'public' AND tablename = 'study_activity'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_activity;
  END IF;
END$$;
