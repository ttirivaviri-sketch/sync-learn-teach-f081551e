-- ═══════════════════════════════════════════════════════════════════════════
-- Assessment → Mastery evidence pipeline (tier 4)
--
-- PR #70 wired school homework into learning_concept_mastery_ledger. This
-- migration closes the remaining gaps so *every* graded assessment feeds the
-- mastery model that drives run_study_plan_optimizer, MasteryIntelligenceCard
-- and guardian digests:
--
--   §1  mock_exam_attempts   → per-topic evidence on submission ('mock_exam')
--   §2  quiz_attempts        → per-concept evidence on insert     ('quiz')
--       (personal quizzes, structured daily tasks, flashcard mirrors)
--   §3  school_quiz_attempts → whole-quiz evidence on submission  ('quiz')
--
-- All functions are SECURITY DEFINER (ledger RLS is deny-by-default for
-- direct writes) and defensive: they never raise, so grading flows can't be
-- broken by evidence bookkeeping.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Mock exams → mastery ledger ─────────────────────────────────────────
-- grading_json.graded is an array of per-question results carrying
-- {topic, marks_awarded, marks_possible}. Aggregate per topic so one exam
-- yields one evidence row per topic examined.

CREATE OR REPLACE FUNCTION public.record_mock_exam_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  v_ratio numeric;
  v_delta numeric;
BEGIN
  -- Only when the attempt transitions into 'submitted' (never re-fires).
  IF NEW.status IS DISTINCT FROM 'submitted' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'submitted' THEN
    RETURN NEW;
  END IF;

  BEGIN
    FOR rec IN
      SELECT
        COALESCE(NULLIF(trim(g.value->>'topic'), ''), 'General') AS topic,
        SUM(COALESCE((g.value->>'marks_awarded')::numeric, 0))   AS awarded,
        SUM(COALESCE((g.value->>'marks_possible')::numeric, 0))  AS possible
      FROM jsonb_array_elements(COALESCE(NEW.grading_json->'graded', '[]'::jsonb)) AS g(value)
      GROUP BY 1
    LOOP
      IF rec.possible <= 0 THEN
        CONTINUE;
      END IF;
      v_ratio := LEAST(GREATEST(rec.awarded / rec.possible, 0), 1);
      v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);  -- −1 .. +1

      INSERT INTO public.learning_concept_mastery_ledger
        (user_id, subject_id, subject_name, topic_name, concept_name,
         evidence_type, evidence_source, score_delta, confidence, metadata)
      VALUES
        (NEW.user_id,
         NEW.subject_id,
         COALESCE(NULLIF(trim(NEW.subject_name), ''), 'General'),
         rec.topic,
         rec.topic,
         'mock_exam',
         'mock_exam_attempt',
         v_delta,
         0.75,  -- exam conditions: stronger than practice, weaker than teacher marks
         jsonb_build_object(
           'attempt_id',   NEW.id,
           'paper_code',   NEW.paper_code,
           'grade_band',   NEW.grade_band,
           'percent',      NEW.percent,
           'topic_awarded', rec.awarded,
           'topic_possible', rec.possible
         ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_mock_exam_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mock_exam_mastery_evidence ON public.mock_exam_attempts;
CREATE TRIGGER trg_mock_exam_mastery_evidence
  AFTER INSERT OR UPDATE OF status
  ON public.mock_exam_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_mock_exam_mastery_evidence();

-- ─── §2 Personal quiz / daily-task / flashcard attempts → mastery ledger ────
-- quiz_attempts is insert-only from the app (quizzes, structured daily tasks,
-- flashcard mirrors). Each row is one graded answer with optional
-- concepts_tested[]; fall back to the topic when no concepts were mapped.

CREATE OR REPLACE FUNCTION public.record_quiz_attempt_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject  text;
  v_topic    text;
  v_ratio    numeric;
  v_delta    numeric;
  v_concepts text[];
  v_concept  text;
BEGIN
  -- Need an owner and some grading signal.
  IF NEW.user_id IS NULL
     OR (NEW.was_correct IS NULL AND NEW.marks_awarded IS NULL) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT s.name INTO v_subject FROM public.subjects s WHERE s.id = NEW.subject_id;
    v_subject := COALESCE(NULLIF(trim(v_subject), ''), 'General');
    v_topic   := COALESCE(NULLIF(trim(NEW.topic_name), ''), 'General');

    IF COALESCE(NEW.marks_possible, 0) > 0 THEN
      v_ratio := LEAST(GREATEST(COALESCE(NEW.marks_awarded, 0)::numeric / NEW.marks_possible, 0), 1);
    ELSIF NEW.was_correct IS NOT NULL THEN
      v_ratio := CASE WHEN NEW.was_correct THEN 1 ELSE 0 END;
    ELSE
      RETURN NEW;
    END IF;
    v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);

    v_concepts := NEW.concepts_tested;
    IF v_concepts IS NULL OR array_length(v_concepts, 1) IS NULL THEN
      v_concepts := ARRAY[v_topic];
    END IF;

    FOREACH v_concept IN ARRAY v_concepts LOOP
      IF v_concept IS NULL OR trim(v_concept) = '' THEN
        CONTINUE;
      END IF;
      INSERT INTO public.learning_concept_mastery_ledger
        (user_id, subject_id, subject_name, topic_name, concept_name,
         evidence_type, evidence_source, score_delta, confidence, metadata)
      VALUES
        (NEW.user_id, NEW.subject_id, v_subject, v_topic, trim(v_concept),
         'quiz', 'quiz_attempt', v_delta, 0.55,
         jsonb_build_object(
           'attempt_id',     NEW.id,
           'was_correct',    NEW.was_correct,
           'marks_awarded',  NEW.marks_awarded,
           'marks_possible', NEW.marks_possible,
           'command_word',   NEW.command_word
         ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_quiz_attempt_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_attempt_mastery_evidence ON public.quiz_attempts;
CREATE TRIGGER trg_quiz_attempt_mastery_evidence
  AFTER INSERT
  ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_quiz_attempt_mastery_evidence();

-- ─── §3 School quizzes → mastery ledger ─────────────────────────────────────
-- Auto-graded on submission (score / max_score); long answers may be
-- re-graded by the teacher later (status → 'graded' with a new score), which
-- records a second, higher-confidence evidence row.

CREATE OR REPLACE FUNCTION public.record_school_quiz_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz    record;
  v_subject text;
  v_topic   text;
  v_ratio   numeric;
  v_delta   numeric;
BEGIN
  IF NEW.status NOT IN ('submitted', 'graded') THEN
    RETURN NEW;
  END IF;
  -- Skip no-op updates (same status, unchanged score).
  IF TG_OP = 'UPDATE'
     AND OLD.status = NEW.status
     AND OLD.score IS NOT DISTINCT FROM NEW.score THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.max_score, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT q.title, ss.name AS subject_name
      INTO v_quiz
      FROM public.quizzes q
      LEFT JOIN public.school_subjects ss ON ss.id = q.subject_id
     WHERE q.id = NEW.quiz_id;

    v_subject := COALESCE(NULLIF(trim(v_quiz.subject_name), ''), 'General');
    v_topic   := COALESCE(NULLIF(trim(v_quiz.title), ''), 'Class quiz');

    v_ratio := LEAST(GREATEST(COALESCE(NEW.score, 0)::numeric / NEW.max_score, 0), 1);
    v_delta := round(((v_ratio - 0.5) * 2)::numeric, 3);

    INSERT INTO public.learning_concept_mastery_ledger
      (user_id, subject_id, subject_name, topic_name, concept_name,
       evidence_type, evidence_source, score_delta, confidence, metadata)
    VALUES
      (NEW.student_id, NULL, v_subject, v_topic, v_topic,
       'quiz', 'school_quiz',
       v_delta,
       CASE WHEN NEW.status = 'graded' THEN 0.8 ELSE 0.6 END,
       jsonb_build_object(
         'attempt_id', NEW.id,
         'quiz_id',    NEW.quiz_id,
         'school_id',  NEW.school_id,
         'score',      NEW.score,
         'max_score',  NEW.max_score,
         'graded_by',  CASE WHEN NEW.status = 'graded' THEN 'teacher' ELSE 'auto' END
       ));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_school_quiz_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_quiz_mastery_evidence ON public.school_quiz_attempts;
CREATE TRIGGER trg_school_quiz_mastery_evidence
  AFTER INSERT OR UPDATE OF status, score
  ON public.school_quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.record_school_quiz_mastery_evidence();
