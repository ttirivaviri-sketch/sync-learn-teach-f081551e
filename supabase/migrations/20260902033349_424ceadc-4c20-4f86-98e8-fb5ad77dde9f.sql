CREATE OR REPLACE FUNCTION public.enforce_quiz_attempt_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quiz record;
  v_used integer;
BEGIN
  SELECT attempts_allowed, status, deleted_at
    INTO v_quiz
    FROM public.quizzes
   WHERE id = NEW.quiz_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;
  IF v_quiz.deleted_at IS NOT NULL OR v_quiz.status <> 'published' THEN
    RAISE EXCEPTION 'This quiz is not open for attempts';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.quiz_id::text || ':' || NEW.student_id::text, 0)
  );

  SELECT count(*) INTO v_used
    FROM public.school_quiz_attempts
   WHERE quiz_id = NEW.quiz_id
     AND student_id = NEW.student_id;

  IF v_used >= GREATEST(COALESCE(v_quiz.attempts_allowed, 1), 1) THEN
    RAISE EXCEPTION 'No attempts remaining for this quiz (allowed: %)',
      GREATEST(COALESCE(v_quiz.attempts_allowed, 1), 1);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_quiz_attempt_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_enforce_quiz_attempt_limit ON public.school_quiz_attempts;
CREATE TRIGGER trg_enforce_quiz_attempt_limit
  BEFORE INSERT ON public.school_quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quiz_attempt_limit();