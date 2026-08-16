
-- Guard: protected grading columns can only be changed by staff or trusted server routines
CREATE OR REPLACE FUNCTION public.guard_student_grade_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Trusted server-side grading routines set this flag
  IF current_setting('app.grading_context', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Only restrict the student acting on their own row
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM OLD.student_id THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'school_homework_responses' THEN
    IF NEW.ai_score IS DISTINCT FROM OLD.ai_score
       OR NEW.teacher_score IS DISTINCT FROM OLD.teacher_score
       OR NEW.status IS DISTINCT FROM OLD.status AND NEW.status NOT IN ('draft', 'submitted')
       OR NEW.released_at IS DISTINCT FROM OLD.released_at THEN
      RAISE EXCEPTION 'STUDENT_CANNOT_GRADE: scores, grading status and release time are set by your teacher'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'school_quiz_attempts' THEN
    IF NEW.score IS DISTINCT FROM OLD.score
       OR NEW.max_score IS DISTINCT FROM OLD.max_score
       OR NEW.per_question IS DISTINCT FROM OLD.per_question THEN
      RAISE EXCEPTION 'STUDENT_CANNOT_GRADE: quiz scores are calculated on the server'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'submissions' THEN
    IF NEW.score IS DISTINCT FROM OLD.score
       OR NEW.feedback IS DISTINCT FROM OLD.feedback
       OR NEW.graded_by IS DISTINCT FROM OLD.graded_by
       OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('graded', 'returned')) THEN
      RAISE EXCEPTION 'STUDENT_CANNOT_GRADE: scores and feedback are set by your teacher'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_grades_hw_responses ON public.school_homework_responses;
CREATE TRIGGER trg_guard_grades_hw_responses
BEFORE UPDATE ON public.school_homework_responses
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grade_columns();

DROP TRIGGER IF EXISTS trg_guard_grades_quiz_attempts ON public.school_quiz_attempts;
CREATE TRIGGER trg_guard_grades_quiz_attempts
BEFORE UPDATE ON public.school_quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grade_columns();

DROP TRIGGER IF EXISTS trg_guard_grades_submissions ON public.submissions;
CREATE TRIGGER trg_guard_grades_submissions
BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.guard_student_grade_columns();

-- Server-side quiz grading marks itself as trusted
CREATE OR REPLACE FUNCTION public.submit_school_quiz_attempt(p_attempt_id uuid, p_answers jsonb)
RETURNS school_quiz_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_attempt public.school_quiz_attempts;
  v_q record;
  v_response jsonb;
  v_correct boolean;
  v_score numeric := 0;
  v_max numeric := 0;
  v_per_question jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_attempt FROM public.school_quiz_attempts WHERE id = p_attempt_id;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;
  IF v_attempt.student_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not your attempt';
  END IF;
  IF v_attempt.submitted_at IS NOT NULL THEN
    RETURN v_attempt;
  END IF;

  FOR v_q IN
    SELECT qq.id, qq.type, qq.answer, qq.marks
    FROM public.quiz_questions qq
    WHERE qq.quiz_id = v_attempt.quiz_id
    ORDER BY qq.ord
  LOOP
    v_response := p_answers -> (v_q.id::text);
    v_max := v_max + COALESCE(v_q.marks, 0);
    v_correct := false;

    IF v_response IS NOT NULL AND v_q.answer IS NOT NULL THEN
      IF v_q.type IN ('mcq', 'tf') THEN
        v_correct := (v_response = v_q.answer);
      ELSIF v_q.type = 'short' THEN
        v_correct := btrim(COALESCE(v_response #>> '{}', '')) <> ''
          AND lower(btrim(COALESCE(v_response #>> '{}', ''))) = lower(btrim(COALESCE(v_q.answer #>> '{}', '')));
      END IF;
    END IF;

    IF v_correct THEN
      v_score := v_score + COALESCE(v_q.marks, 0);
    END IF;

    v_per_question := v_per_question || jsonb_build_object(
      'question_id', v_q.id,
      'response', COALESCE(v_response, 'null'::jsonb),
      'correct', v_correct,
      'awarded', CASE WHEN v_correct THEN COALESCE(v_q.marks, 0) ELSE 0 END,
      'answer', v_q.answer
    );
  END LOOP;

  PERFORM set_config('app.grading_context', 'on', true);

  UPDATE public.school_quiz_attempts
  SET submitted_at = now(),
      status = 'submitted',
      score = v_score,
      max_score = v_max,
      per_question = v_per_question
  WHERE id = p_attempt_id
  RETURNING * INTO v_attempt;

  PERFORM set_config('app.grading_context', 'off', true);

  RETURN v_attempt;
END;
$function$;
