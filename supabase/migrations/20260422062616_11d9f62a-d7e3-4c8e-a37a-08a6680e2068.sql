-- 1. topic_sessions
CREATE TABLE public.topic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid,
  subject_name text NOT NULL,
  topic_id text,
  topic_name text NOT NULL,
  subtopic text,
  curriculum text NOT NULL DEFAULT 'ZIMSEC',
  mode text NOT NULL DEFAULT 'flexible',
  status text NOT NULL DEFAULT 'active',
  questions_attempted int NOT NULL DEFAULT 0,
  questions_correct int NOT NULL DEFAULT 0,
  mastery_score numeric NOT NULL DEFAULT 0,
  concept_review_count int NOT NULL DEFAULT 0,
  session_xp int NOT NULL DEFAULT 0,
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.topic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own topic sessions"
  ON public.topic_sessions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_topic_sessions_user_active ON public.topic_sessions(user_id, status, last_activity_at DESC);

-- 2. topic_session_questions
CREATE TABLE public.topic_session_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.topic_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question_text text NOT NULL,
  expected_answer text,
  student_answer text,
  concept_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  accuracy boolean,
  coverage_score numeric,
  expression_score numeric,
  missing_points jsonb DEFAULT '[]'::jsonb,
  improvement_needed boolean DEFAULT false,
  level text,
  xp_delta int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_session_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own session questions"
  ON public.topic_session_questions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_tsq_session ON public.topic_session_questions(session_id, created_at);

-- 3. weak_concepts
CREATE TABLE public.weak_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject text NOT NULL,
  curriculum text NOT NULL DEFAULT 'ZIMSEC',
  concept text NOT NULL,
  topic text,
  weakness_score numeric NOT NULL DEFAULT 0.5,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, subject, curriculum, concept)
);

ALTER TABLE public.weak_concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own weak concepts"
  ON public.weak_concepts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_weak_concepts_user_subject ON public.weak_concepts(user_id, subject, curriculum, weakness_score DESC);

-- 4. Auto-expire stale sessions
CREATE OR REPLACE FUNCTION public.expire_stale_topic_sessions()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE public.topic_sessions
    SET status = 'expired', completed_at = now()
    WHERE user_id = auth.uid()
      AND status = 'active'
      AND last_activity_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 5. Start session with 3-active cap
CREATE OR REPLACE FUNCTION public.start_topic_session(
  p_subject_name text,
  p_topic_name text,
  p_curriculum text DEFAULT 'ZIMSEC',
  p_subject_id uuid DEFAULT NULL,
  p_topic_id text DEFAULT NULL,
  p_subtopic text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_active_count int;
  v_oldest_id uuid;
  v_new_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;

  -- Auto-expire stale first
  UPDATE public.topic_sessions
    SET status = 'expired', completed_at = now()
    WHERE user_id = v_user
      AND status = 'active'
      AND last_activity_at < now() - interval '24 hours';

  -- Cap at 3 active
  SELECT count(*) INTO v_active_count
    FROM public.topic_sessions
    WHERE user_id = v_user AND status = 'active';

  IF v_active_count >= 3 THEN
    SELECT id INTO v_oldest_id
      FROM public.topic_sessions
      WHERE user_id = v_user AND status = 'active'
      ORDER BY last_activity_at ASC LIMIT 1;
    UPDATE public.topic_sessions
      SET status = 'expired', completed_at = now()
      WHERE id = v_oldest_id;
  END IF;

  INSERT INTO public.topic_sessions(
    user_id, subject_id, subject_name, topic_id, topic_name, subtopic, curriculum
  ) VALUES (
    v_user, p_subject_id, p_subject_name, p_topic_id, p_topic_name, p_subtopic, p_curriculum
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;