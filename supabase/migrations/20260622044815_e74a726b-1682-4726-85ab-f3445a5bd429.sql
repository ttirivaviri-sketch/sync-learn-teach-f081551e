
CREATE TABLE public.learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  subject_id uuid,
  topic_name text,
  source text NOT NULL,
  score_pct numeric,
  mastery_delta numeric,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_events_source_check CHECK (source IN (
    'topic_session','school_homework','lesson_reinforcement','school_quiz',
    'daily_task','mock_exam','booking_completed'
  ))
);

CREATE INDEX learning_events_user_occurred_idx
  ON public.learning_events (user_id, occurred_at DESC);
CREATE INDEX learning_events_school_occurred_idx
  ON public.learning_events (school_id, occurred_at DESC) WHERE school_id IS NOT NULL;
CREATE INDEX learning_events_user_source_idx
  ON public.learning_events (user_id, source, occurred_at DESC);

GRANT SELECT, INSERT ON public.learning_events TO authenticated;
GRANT ALL ON public.learning_events TO service_role;

ALTER TABLE public.learning_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users insert own learning events"
  ON public.learning_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users read own learning events"
  ON public.learning_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "school staff read school learning events"
  ON public.learning_events FOR SELECT
  TO authenticated
  USING (
    school_id IS NOT NULL AND (
      public.is_school_member(school_id, 'school_admin'::public.app_role)
      OR public.is_school_member(school_id, 'school_teacher'::public.app_role)
    )
  );
