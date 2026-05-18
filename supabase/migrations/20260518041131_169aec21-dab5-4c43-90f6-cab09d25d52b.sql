
-- ============ study_memory_events ============
CREATE TABLE IF NOT EXISTS public.study_memory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'quiz_question','flashcard_review','exam_session',
    'concept_breakdown','task_content','recall_session','weak_concept_flag'
  )),
  subject_id UUID,
  subject_name TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  subtopic_name TEXT,
  curriculum TEXT,
  question_text TEXT,
  concepts_tested TEXT[],
  command_word TEXT,
  was_correct BOOLEAN,
  score_raw NUMERIC,
  score_max NUMERIC,
  difficulty TEXT,
  ease_factor NUMERIC,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sme_user_subject ON public.study_memory_events(user_id, subject_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sme_user_topic ON public.study_memory_events(user_id, subject_name, topic_name);

ALTER TABLE public.study_memory_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sme_select_own" ON public.study_memory_events;
CREATE POLICY "sme_select_own" ON public.study_memory_events FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "sme_insert_own" ON public.study_memory_events;
CREATE POLICY "sme_insert_own" ON public.study_memory_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ============ study_memory_summary ============
CREATE TABLE IF NOT EXISTS public.study_memory_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  topic_name TEXT NOT NULL,
  subtopics_covered TEXT[] NOT NULL DEFAULT '{}',
  concepts_covered TEXT[] NOT NULL DEFAULT '{}',
  concepts_weak TEXT[] NOT NULL DEFAULT '{}',
  concepts_mastered TEXT[] NOT NULL DEFAULT '{}',
  questions_seen TEXT[] NOT NULL DEFAULT '{}',
  command_words_used TEXT[] NOT NULL DEFAULT '{}',
  quiz_attempts INT NOT NULL DEFAULT 0,
  quiz_correct INT NOT NULL DEFAULT 0,
  avg_score_pct NUMERIC,
  best_score_pct NUMERIC,
  last_score_pct NUMERIC,
  needs_reinforcement BOOLEAN NOT NULL DEFAULT false,
  topic_complete BOOLEAN NOT NULL DEFAULT false,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, subject_name, topic_name)
);
CREATE INDEX IF NOT EXISTS idx_sms_user_subject ON public.study_memory_summary(user_id, subject_name, last_activity_at DESC);

ALTER TABLE public.study_memory_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sms_select_own" ON public.study_memory_summary;
CREATE POLICY "sms_select_own" ON public.study_memory_summary FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ study_memory_daily ============
CREATE TABLE IF NOT EXISTS public.study_memory_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date DATE NOT NULL,
  subject_name TEXT NOT NULL,
  topics_studied TEXT[] NOT NULL DEFAULT '{}',
  subtopics_studied TEXT[] NOT NULL DEFAULT '{}',
  quiz_count INT NOT NULL DEFAULT 0,
  quiz_correct INT NOT NULL DEFAULT 0,
  flashcard_count INT NOT NULL DEFAULT 0,
  exam_count INT NOT NULL DEFAULT 0,
  avg_score_pct NUMERIC,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, study_date, subject_name)
);
CREATE INDEX IF NOT EXISTS idx_smd_user_date ON public.study_memory_daily(user_id, study_date DESC);

ALTER TABLE public.study_memory_daily ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "smd_select_own" ON public.study_memory_daily;
CREATE POLICY "smd_select_own" ON public.study_memory_daily FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ aggregation trigger ============
CREATE OR REPLACE FUNCTION public.fn_update_study_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pct NUMERIC;
BEGIN
  -- Score percentage for this event (if applicable)
  IF NEW.score_max IS NOT NULL AND NEW.score_max > 0 AND NEW.score_raw IS NOT NULL THEN
    v_pct := ROUND((NEW.score_raw / NEW.score_max) * 100, 1);
  END IF;

  -- ---- Topic summary upsert ----
  INSERT INTO public.study_memory_summary AS s (
    user_id, subject_name, topic_name,
    subtopics_covered, concepts_covered, questions_seen, command_words_used,
    quiz_attempts, quiz_correct,
    avg_score_pct, best_score_pct, last_score_pct,
    last_activity_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.subject_name, NEW.topic_name,
    CASE WHEN NEW.subtopic_name IS NOT NULL THEN ARRAY[NEW.subtopic_name] ELSE '{}' END,
    COALESCE(NEW.concepts_tested, '{}'),
    CASE WHEN NEW.question_text IS NOT NULL THEN ARRAY[NEW.question_text] ELSE '{}' END,
    CASE WHEN NEW.command_word IS NOT NULL THEN ARRAY[NEW.command_word] ELSE '{}' END,
    CASE WHEN NEW.was_correct IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN NEW.was_correct THEN 1 ELSE 0 END,
    v_pct, v_pct, v_pct,
    now(), now()
  )
  ON CONFLICT (user_id, subject_name, topic_name) DO UPDATE SET
    subtopics_covered = (
      SELECT ARRAY(SELECT DISTINCT unnest(s.subtopics_covered || COALESCE(ARRAY[NEW.subtopic_name]::text[], '{}')))
    ),
    concepts_covered = (
      SELECT ARRAY(SELECT DISTINCT unnest(s.concepts_covered || COALESCE(NEW.concepts_tested, '{}')))
    ),
    questions_seen = (
      SELECT ARRAY(SELECT unnest((s.questions_seen || COALESCE(ARRAY[NEW.question_text]::text[], '{}'))) LIMIT 50)
    ),
    command_words_used = (
      SELECT ARRAY(SELECT DISTINCT unnest(s.command_words_used || COALESCE(ARRAY[NEW.command_word]::text[], '{}')))
    ),
    quiz_attempts = s.quiz_attempts + CASE WHEN NEW.was_correct IS NOT NULL THEN 1 ELSE 0 END,
    quiz_correct  = s.quiz_correct  + CASE WHEN NEW.was_correct THEN 1 ELSE 0 END,
    avg_score_pct = CASE
      WHEN v_pct IS NULL THEN s.avg_score_pct
      WHEN s.avg_score_pct IS NULL THEN v_pct
      ELSE ROUND(((s.avg_score_pct * s.quiz_attempts) + v_pct) / (s.quiz_attempts + 1), 1)
    END,
    best_score_pct = GREATEST(COALESCE(s.best_score_pct, 0), COALESCE(v_pct, 0)),
    last_score_pct = COALESCE(v_pct, s.last_score_pct),
    needs_reinforcement = (CASE
      WHEN v_pct IS NULL THEN s.avg_score_pct
      WHEN s.avg_score_pct IS NULL THEN v_pct
      ELSE ((s.avg_score_pct * s.quiz_attempts) + v_pct) / (s.quiz_attempts + 1)
    END) < 60,
    last_activity_at = now(),
    updated_at = now();

  -- Weak/mastered concept tracking: ≥2 wrong attempts → weak; ≥3 correct → mastered
  IF NEW.was_correct = false AND NEW.concepts_tested IS NOT NULL THEN
    UPDATE public.study_memory_summary
       SET concepts_weak = (SELECT ARRAY(SELECT DISTINCT unnest(concepts_weak || NEW.concepts_tested)))
     WHERE user_id = NEW.user_id AND subject_name = NEW.subject_name AND topic_name = NEW.topic_name;
  ELSIF NEW.was_correct = true AND NEW.concepts_tested IS NOT NULL THEN
    UPDATE public.study_memory_summary
       SET concepts_mastered = (SELECT ARRAY(SELECT DISTINCT unnest(concepts_mastered || NEW.concepts_tested)))
     WHERE user_id = NEW.user_id AND subject_name = NEW.subject_name AND topic_name = NEW.topic_name;
  END IF;

  -- ---- Daily digest upsert ----
  INSERT INTO public.study_memory_daily AS d (
    user_id, study_date, subject_name,
    topics_studied, subtopics_studied,
    quiz_count, quiz_correct, flashcard_count, exam_count,
    avg_score_pct, updated_at
  ) VALUES (
    NEW.user_id, CURRENT_DATE, NEW.subject_name,
    ARRAY[NEW.topic_name],
    CASE WHEN NEW.subtopic_name IS NOT NULL THEN ARRAY[NEW.subtopic_name] ELSE '{}' END,
    CASE WHEN NEW.event_type IN ('quiz_question','recall_session') THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type IN ('quiz_question','recall_session') AND NEW.was_correct THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'flashcard_review' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'exam_session' THEN 1 ELSE 0 END,
    v_pct, now()
  )
  ON CONFLICT (user_id, study_date, subject_name) DO UPDATE SET
    topics_studied = (SELECT ARRAY(SELECT DISTINCT unnest(d.topics_studied || ARRAY[NEW.topic_name]))),
    subtopics_studied = (SELECT ARRAY(SELECT DISTINCT unnest(d.subtopics_studied || COALESCE(ARRAY[NEW.subtopic_name]::text[], '{}')))),
    quiz_count = d.quiz_count + CASE WHEN NEW.event_type IN ('quiz_question','recall_session') THEN 1 ELSE 0 END,
    quiz_correct = d.quiz_correct + CASE WHEN NEW.event_type IN ('quiz_question','recall_session') AND NEW.was_correct THEN 1 ELSE 0 END,
    flashcard_count = d.flashcard_count + CASE WHEN NEW.event_type = 'flashcard_review' THEN 1 ELSE 0 END,
    exam_count = d.exam_count + CASE WHEN NEW.event_type = 'exam_session' THEN 1 ELSE 0 END,
    avg_score_pct = CASE
      WHEN v_pct IS NULL THEN d.avg_score_pct
      WHEN d.avg_score_pct IS NULL THEN v_pct
      ELSE ROUND(((d.avg_score_pct * GREATEST(d.quiz_count,1)) + v_pct) / (GREATEST(d.quiz_count,1) + 1), 1)
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_study_memory_events ON public.study_memory_events;
CREATE TRIGGER trg_study_memory_events
AFTER INSERT ON public.study_memory_events
FOR EACH ROW EXECUTE FUNCTION public.fn_update_study_memory();
