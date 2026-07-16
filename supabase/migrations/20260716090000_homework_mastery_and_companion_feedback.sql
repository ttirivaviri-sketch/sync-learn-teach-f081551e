-- ============================================================================
-- Homework → Mastery pipeline + Companion feedback loop
--
-- 1. Graded school homework now feeds the LOS concept-mastery ledger:
--    a trigger on school_homework_responses converts every AI/teacher-marked
--    response into learning_concept_mastery_ledger evidence rows (one per
--    concept tagged on the question, falling back to homework topic). This
--    connects the classic schools system to the Learning OS intervention
--    engine — homework performance now drives risk projection, nightly
--    sweeps, and study-plan optimization.
--
-- 2. companion_interactions: outcome tracking for the Study Companion.
--    Records shown / clicked / dismissed / booked events so suggestions can
--    learn from what students actually engage with.
-- ============================================================================

-- ─── 1. Homework → mastery ledger trigger ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_homework_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hw          record;
  v_question    record;
  v_subject     text;
  v_topic       text;
  v_score       numeric;
  v_marks       numeric;
  v_ratio       numeric;
  v_delta       numeric;
  v_confidence  numeric;
  v_concept     text;
  v_concepts    text[];
BEGIN
  -- Only act when a response transitions into a marked state.
  IF NEW.status NOT IN ('ai_marked', 'released') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IN ('ai_marked', 'released')
     AND COALESCE(OLD.teacher_score, -1) = COALESCE(NEW.teacher_score, -1) THEN
    -- Already recorded and score unchanged — avoid duplicate evidence.
    RETURN NEW;
  END IF;

  SELECT h.subject_id, h.topic, h.title, s.name AS subject_name
    INTO v_hw
    FROM public.school_homework h
    LEFT JOIN public.subjects s ON s.id = h.subject_id
   WHERE h.id = NEW.homework_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT q.concepts, q.marks, q.prompt
    INTO v_question
    FROM public.school_homework_questions q
   WHERE q.id = NEW.question_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_marks := GREATEST(COALESCE(v_question.marks, 1), 1);
  -- Teacher score wins over AI score when present.
  v_score := COALESCE(NEW.teacher_score, NEW.ai_score, 0);
  v_ratio := GREATEST(0, LEAST(1, v_score / v_marks));
  -- Map 0..1 ratio to -1..+1 delta centred at 0.5.
  v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);
  v_confidence := CASE WHEN NEW.teacher_score IS NOT NULL THEN 0.85 ELSE 0.6 END;

  v_subject := COALESCE(v_hw.subject_name, 'General');
  v_topic := COALESCE(NULLIF(trim(v_hw.topic), ''), v_hw.title, 'Homework');

  v_concepts := v_question.concepts;
  IF v_concepts IS NULL OR array_length(v_concepts, 1) IS NULL THEN
    v_concepts := ARRAY[v_topic];
  END IF;

  FOREACH v_concept IN ARRAY v_concepts LOOP
    CONTINUE WHEN NULLIF(trim(v_concept), '') IS NULL;
    INSERT INTO public.learning_concept_mastery_ledger
      (user_id, subject_id, subject_name, topic_name, concept_name,
       evidence_type, evidence_source, score_delta, confidence, metadata)
    VALUES
      (NEW.student_id, v_hw.subject_id, v_subject, v_topic, trim(v_concept),
       'task', 'school_homework',
       v_delta, v_confidence,
       jsonb_build_object(
         'homework_id', NEW.homework_id,
         'question_id', NEW.question_id,
         'response_id', NEW.id,
         'score', v_score,
         'marks', v_marks,
         'graded_by', CASE WHEN NEW.teacher_score IS NOT NULL THEN 'teacher' ELSE 'ai' END
       ));
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_homework_mastery_evidence ON public.school_homework_responses;
CREATE TRIGGER trg_homework_mastery_evidence
  AFTER INSERT OR UPDATE OF status, teacher_score ON public.school_homework_responses
  FOR EACH ROW EXECUTE FUNCTION public.record_homework_mastery_evidence();

-- ─── 2. Companion interactions (feedback loop) ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.companion_interactions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL,
  suggestion_id  text NOT NULL,
  suggestion_kind text NOT NULL
    CHECK (suggestion_kind IN ('resource', 'tutor', 'homework', 'encourage')),
  event          text NOT NULL
    CHECK (event IN ('shown', 'clicked', 'dismissed', 'booked')),
  topic          text,
  subject        text,
  resource_id    uuid,
  tutor_id       uuid,
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_interactions_user
  ON public.companion_interactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_interactions_suggestion
  ON public.companion_interactions (user_id, suggestion_id, event);

ALTER TABLE public.companion_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companion_interactions_own_insert" ON public.companion_interactions;
CREATE POLICY "companion_interactions_own_insert"
  ON public.companion_interactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "companion_interactions_own_select" ON public.companion_interactions;
CREATE POLICY "companion_interactions_own_select"
  ON public.companion_interactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT ON public.companion_interactions TO authenticated;
GRANT ALL ON public.companion_interactions TO service_role;
