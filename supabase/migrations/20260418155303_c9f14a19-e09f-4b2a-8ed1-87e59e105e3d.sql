-- 1. paper_blueprints table
CREATE TABLE public.paper_blueprints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subject_id UUID NOT NULL,
  subject_name TEXT NOT NULL,
  paper_code TEXT NOT NULL,
  total_marks INTEGER,
  duration_minutes INTEGER,
  question_type_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  topic_coverage JSONB NOT NULL DEFAULT '{}'::jsonb,
  command_word_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  difficulty_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  years_analysed TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_id, paper_code)
);

ALTER TABLE public.paper_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own paper blueprints"
ON public.paper_blueprints FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own paper blueprints"
ON public.paper_blueprints FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own paper blueprints"
ON public.paper_blueprints FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER trg_paper_blueprints_updated_at
BEFORE UPDATE ON public.paper_blueprints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_paper_blueprints_user_subject
  ON public.paper_blueprints (user_id, subject_id);

-- 2. get_exam_readiness RPC
CREATE OR REPLACE FUNCTION public.get_exam_readiness(
  p_subject_id UUID,
  p_paper_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID;
  v_blueprint RECORD;
  v_topic_coverage JSONB;
  v_qtype_dist JSONB;
  v_topic_key TEXT;
  v_topic_weight NUMERIC;
  v_topic_mastery NUMERIC;
  v_weighted_sum NUMERIC := 0;
  v_weight_total NUMERIC := 0;
  v_readiness INTEGER := 0;
  v_weak_topics JSONB := '[]'::jsonb;
  v_weak_qtypes JSONB := '[]'::jsonb;
  v_qtype TEXT;
  v_qtype_pct NUMERIC;
  v_qtype_acc NUMERIC;
  v_band TEXT;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_blueprint
  FROM public.paper_blueprints
  WHERE user_id = v_uid
    AND subject_id = p_subject_id
    AND paper_code = p_paper_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'readiness_percent', 0,
      'weakest_topics', '[]'::jsonb,
      'weakest_question_types', '[]'::jsonb,
      'confidence_band', 'unknown',
      'has_blueprint', false
    );
  END IF;

  v_topic_coverage := COALESCE(v_blueprint.topic_coverage, '{}'::jsonb);
  v_qtype_dist := COALESCE(v_blueprint.question_type_distribution, '{}'::jsonb);

  -- Weighted topic mastery
  FOR v_topic_key, v_topic_weight IN
    SELECT key, (value)::text::numeric FROM jsonb_each_text(v_topic_coverage)
  LOOP
    SELECT COALESCE(mastery_percentage, 0) INTO v_topic_mastery
    FROM public.topic_mastery
    WHERE user_id = v_uid
      AND subject_id = p_subject_id
      AND lower(topic_name) = lower(v_topic_key)
    LIMIT 1;

    v_topic_mastery := COALESCE(v_topic_mastery, 0);
    v_weighted_sum := v_weighted_sum + (v_topic_mastery * v_topic_weight);
    v_weight_total := v_weight_total + v_topic_weight;

    IF v_topic_mastery < 50 THEN
      v_weak_topics := v_weak_topics || jsonb_build_array(jsonb_build_object(
        'topic', v_topic_key,
        'mastery', v_topic_mastery,
        'weight', v_topic_weight
      ));
    END IF;
  END LOOP;

  IF v_weight_total > 0 THEN
    v_readiness := ROUND(v_weighted_sum / v_weight_total)::int;
  END IF;

  -- Weak question types (based on quiz_attempts accuracy)
  FOR v_qtype, v_qtype_pct IN
    SELECT key, (value)::text::numeric FROM jsonb_each_text(v_qtype_dist)
  LOOP
    SELECT CASE WHEN COUNT(*) = 0 THEN NULL
                ELSE ROUND(100.0 * SUM(CASE WHEN was_correct THEN 1 ELSE 0 END) / COUNT(*))
           END
      INTO v_qtype_acc
    FROM public.quiz_attempts
    WHERE user_id = v_uid
      AND subject_id = p_subject_id;

    IF v_qtype_acc IS NOT NULL AND v_qtype_acc < 60 THEN
      v_weak_qtypes := v_weak_qtypes || jsonb_build_array(jsonb_build_object(
        'question_type', v_qtype,
        'accuracy', v_qtype_acc,
        'paper_share', v_qtype_pct
      ));
    END IF;
  END LOOP;

  v_band := CASE
    WHEN v_readiness >= 75 THEN 'ready'
    WHEN v_readiness >= 50 THEN 'building'
    ELSE 'low'
  END;

  RETURN jsonb_build_object(
    'readiness_percent', v_readiness,
    'weakest_topics', v_weak_topics,
    'weakest_question_types', v_weak_qtypes,
    'confidence_band', v_band,
    'paper_code', p_paper_code,
    'total_marks', v_blueprint.total_marks,
    'duration_minutes', v_blueprint.duration_minutes,
    'years_analysed', to_jsonb(v_blueprint.years_analysed),
    'has_blueprint', true
  );
END;
$$;