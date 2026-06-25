
-- Learner State derived table — O(1) reads of mastery/risk per topic
CREATE TABLE public.learner_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid,
  topic_name text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_score_pct numeric,
  avg_score_pct numeric,
  ewma_score_pct numeric,
  mastery_pct numeric NOT NULL DEFAULT 0,
  risk_level text NOT NULL DEFAULT 'unknown',
  sources jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_event_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id, topic_name)
);

GRANT SELECT ON public.learner_state TO authenticated;
GRANT ALL ON public.learner_state TO service_role;

ALTER TABLE public.learner_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their own learner state"
  ON public.learner_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "School staff read learner state in their schools"
  ON public.learner_state FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.school_memberships sm
    JOIN public.school_memberships sm2 ON sm2.school_id = sm.school_id
    WHERE sm.user_id = auth.uid()
      AND sm.role IN ('school_admin','school_teacher')
      AND sm2.user_id = learner_state.user_id
  ));

CREATE INDEX idx_learner_state_user ON public.learner_state(user_id, updated_at DESC);
CREATE INDEX idx_learner_state_risk ON public.learner_state(user_id, risk_level);

-- Recompute trigger from learning_events
CREATE OR REPLACE FUNCTION public.recompute_learner_state_from_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_topic text;
  v_existing public.learner_state%ROWTYPE;
  v_attempts int;
  v_avg numeric;
  v_ewma numeric;
  v_mastery numeric;
  v_risk text;
  v_sources jsonb;
BEGIN
  v_topic := COALESCE(NULLIF(trim(NEW.topic_name), ''), NEW.payload->>'topic', NEW.payload->>'topic_name');
  IF v_topic IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_existing FROM public.learner_state
    WHERE user_id = NEW.user_id
      AND COALESCE(subject_id::text,'') = COALESCE(NEW.subject_id::text,'')
      AND topic_name = v_topic
    FOR UPDATE;

  v_attempts := COALESCE(v_existing.attempts, 0) + 1;
  IF NEW.score_pct IS NOT NULL THEN
    v_avg := ROUND(((COALESCE(v_existing.avg_score_pct,0) * COALESCE(v_existing.attempts,0)) + NEW.score_pct) / v_attempts, 2);
    -- EWMA with alpha = 0.4 (recent attempts weighted higher)
    v_ewma := ROUND(COALESCE(v_existing.ewma_score_pct, NEW.score_pct) * 0.6 + NEW.score_pct * 0.4, 2);
  ELSE
    v_avg := v_existing.avg_score_pct;
    v_ewma := v_existing.ewma_score_pct;
  END IF;

  v_mastery := GREATEST(0, LEAST(100, COALESCE(v_existing.mastery_pct, 0) + COALESCE(NEW.mastery_delta, 0)));
  -- If no explicit delta, drift mastery towards ewma
  IF NEW.mastery_delta IS NULL AND v_ewma IS NOT NULL THEN
    v_mastery := ROUND(COALESCE(v_existing.mastery_pct, v_ewma) * 0.7 + v_ewma * 0.3, 2);
  END IF;

  v_risk := CASE
    WHEN v_ewma IS NULL THEN 'unknown'
    WHEN v_ewma < 45 THEN 'critical'
    WHEN v_ewma < 65 THEN 'warning'
    WHEN v_ewma < 80 THEN 'watch'
    ELSE 'mastered'
  END;

  v_sources := COALESCE(v_existing.sources, '{}'::jsonb);
  v_sources := jsonb_set(v_sources, ARRAY[NEW.source], to_jsonb(COALESCE((v_sources->>NEW.source)::int, 0) + 1), true);

  INSERT INTO public.learner_state (
    user_id, subject_id, topic_name, attempts, last_score_pct, avg_score_pct,
    ewma_score_pct, mastery_pct, risk_level, sources, last_event_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.subject_id, v_topic, v_attempts, NEW.score_pct, v_avg,
    v_ewma, v_mastery, v_risk, v_sources, COALESCE(NEW.occurred_at, now()), now()
  )
  ON CONFLICT (user_id, subject_id, topic_name) DO UPDATE SET
    attempts = EXCLUDED.attempts,
    last_score_pct = EXCLUDED.last_score_pct,
    avg_score_pct = EXCLUDED.avg_score_pct,
    ewma_score_pct = EXCLUDED.ewma_score_pct,
    mastery_pct = EXCLUDED.mastery_pct,
    risk_level = EXCLUDED.risk_level,
    sources = EXCLUDED.sources,
    last_event_at = EXCLUDED.last_event_at,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_learner_state ON public.learning_events;
CREATE TRIGGER trg_recompute_learner_state
  AFTER INSERT ON public.learning_events
  FOR EACH ROW EXECUTE FUNCTION public.recompute_learner_state_from_event();

-- Backfill from existing learning_events history
INSERT INTO public.learner_state (user_id, subject_id, topic_name, attempts, last_score_pct, avg_score_pct, ewma_score_pct, mastery_pct, risk_level, sources, last_event_at)
SELECT
  user_id,
  subject_id,
  topic,
  COUNT(*) AS attempts,
  (ARRAY_AGG(score_pct ORDER BY occurred_at DESC NULLS LAST))[1] AS last_score,
  ROUND(AVG(score_pct)::numeric, 2) AS avg_score,
  ROUND(AVG(score_pct)::numeric, 2) AS ewma_score,
  GREATEST(0, LEAST(100, COALESCE(SUM(mastery_delta), 0) + COALESCE(AVG(score_pct), 0)))::numeric AS mastery,
  CASE
    WHEN AVG(score_pct) IS NULL THEN 'unknown'
    WHEN AVG(score_pct) < 45 THEN 'critical'
    WHEN AVG(score_pct) < 65 THEN 'warning'
    WHEN AVG(score_pct) < 80 THEN 'watch'
    ELSE 'mastered'
  END AS risk,
  jsonb_object_agg(source, cnt) AS sources,
  MAX(occurred_at) AS last_event_at
FROM (
  SELECT
    user_id, subject_id,
    COALESCE(NULLIF(trim(topic_name), ''), payload->>'topic', payload->>'topic_name') AS topic,
    source, score_pct, mastery_delta, occurred_at,
    COUNT(*) OVER (PARTITION BY user_id, subject_id, COALESCE(NULLIF(trim(topic_name), ''), payload->>'topic', payload->>'topic_name'), source) AS cnt
  FROM public.learning_events
) e
WHERE topic IS NOT NULL
GROUP BY user_id, subject_id, topic
ON CONFLICT (user_id, subject_id, topic_name) DO NOTHING;
