-- Photo Solve practice loop
--
-- 1. photo_solve_attempts — persist every photo-solve grading result so it
--    can drive follow-up practice, history and reporting (previously the
--    result lived only in React state and evaporated on unmount).
-- 2. Allow 'photo_solve' as a learning_events source so practice sessions
--    feed mastery / weak-topic detection / guardian reports.

-- ── 1. Attempts table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.photo_solve_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_name text,
  topic_name text,
  curriculum text,
  question_detected text,
  final_answer text,
  final_answer_correct boolean,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  missed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_hint text,
  model_solution text,
  confidence numeric,
  marks_awarded numeric,
  marks_possible numeric,
  -- Follow-up practice summary (filled after "Practice this correction")
  practice_questions jsonb,
  practice_score_pct numeric,
  practiced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.photo_solve_attempts TO authenticated;
GRANT ALL ON public.photo_solve_attempts TO service_role;

ALTER TABLE public.photo_solve_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own photo solve attempts"
  ON public.photo_solve_attempts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_photo_solve_attempts_user
  ON public.photo_solve_attempts (user_id, created_at DESC);

-- ── 2. learning_events: allow photo_solve source ────────────────────────────
ALTER TABLE public.learning_events
  DROP CONSTRAINT IF EXISTS learning_events_source_check;
ALTER TABLE public.learning_events
  ADD CONSTRAINT learning_events_source_check CHECK (source IN (
    'topic_session','school_homework','lesson_reinforcement','school_quiz',
    'daily_task','mock_exam','booking_completed','photo_solve'
  ));
