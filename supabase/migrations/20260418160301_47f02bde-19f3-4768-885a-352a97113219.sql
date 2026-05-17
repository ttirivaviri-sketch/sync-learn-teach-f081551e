-- Mock exam attempts: stores full submitted papers + grading
CREATE TABLE public.mock_exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  subject_name TEXT NOT NULL,
  paper_code TEXT NOT NULL,
  total_marks INTEGER NOT NULL DEFAULT 0,
  marks_awarded NUMERIC NOT NULL DEFAULT 0,
  percent NUMERIC NOT NULL DEFAULT 0,
  grade_band TEXT,
  duration_minutes INTEGER,
  time_taken_seconds INTEGER,
  paper_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  grading_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mock_exam_attempts_user ON public.mock_exam_attempts(user_id, subject_id, paper_code);

ALTER TABLE public.mock_exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own mock attempts"
ON public.mock_exam_attempts FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mock attempts"
ON public.mock_exam_attempts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mock attempts"
ON public.mock_exam_attempts FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_mock_exam_attempts_updated_at
BEFORE UPDATE ON public.mock_exam_attempts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Unlock check function: returns whether mock paper is unlocked + progress
CREATE OR REPLACE FUNCTION public.check_mock_exam_unlock(p_subject_id UUID, p_paper_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_blueprint RECORD;
  v_topic_coverage JSONB;
  v_topic_key TEXT;
  v_topic_weight NUMERIC;
  v_topic_mastery NUMERIC;
  v_total INT := 0;
  v_mastered INT := 0;
  v_unmastered JSONB := '[]'::jsonb;
  v_readiness JSONB;
  v_readiness_pct INT := 0;
  v_unlocked BOOLEAN := false;
  v_mastery_threshold INT := 80;
  v_readiness_threshold INT := 75;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_blueprint
  FROM public.paper_blueprints
  WHERE user_id = v_uid AND subject_id = p_subject_id AND paper_code = p_paper_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'unlocked', false,
      'has_blueprint', false,
      'topics_total', 0,
      'topics_mastered', 0,
      'unmastered_topics', '[]'::jsonb,
      'readiness_percent', 0,
      'mastery_threshold', v_mastery_threshold,
      'readiness_threshold', v_readiness_threshold
    );
  END IF;

  v_topic_coverage := COALESCE(v_blueprint.topic_coverage, '{}'::jsonb);

  FOR v_topic_key, v_topic_weight IN
    SELECT key, (value)::text::numeric FROM jsonb_each_text(v_topic_coverage)
  LOOP
    v_total := v_total + 1;
    SELECT COALESCE(mastery_percentage, 0) INTO v_topic_mastery
    FROM public.topic_mastery
    WHERE user_id = v_uid AND subject_id = p_subject_id
      AND lower(topic_name) = lower(v_topic_key)
    LIMIT 1;
    v_topic_mastery := COALESCE(v_topic_mastery, 0);

    IF v_topic_mastery >= v_mastery_threshold THEN
      v_mastered := v_mastered + 1;
    ELSE
      v_unmastered := v_unmastered || jsonb_build_array(jsonb_build_object(
        'topic', v_topic_key,
        'mastery', v_topic_mastery,
        'weight', v_topic_weight
      ));
    END IF;
  END LOOP;

  v_readiness := public.get_exam_readiness(p_subject_id, p_paper_code);
  v_readiness_pct := COALESCE((v_readiness->>'readiness_percent')::int, 0);

  v_unlocked := (v_total > 0) AND (v_mastered = v_total) AND (v_readiness_pct >= v_readiness_threshold);

  RETURN jsonb_build_object(
    'unlocked', v_unlocked,
    'has_blueprint', true,
    'topics_total', v_total,
    'topics_mastered', v_mastered,
    'unmastered_topics', v_unmastered,
    'readiness_percent', v_readiness_pct,
    'mastery_threshold', v_mastery_threshold,
    'readiness_threshold', v_readiness_threshold,
    'paper_code', p_paper_code,
    'total_marks', v_blueprint.total_marks,
    'duration_minutes', v_blueprint.duration_minutes
  );
END;
$$;