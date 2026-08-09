DROP POLICY IF EXISTS "quiz_questions read" ON public.quiz_questions;

CREATE POLICY "quiz_questions read staff"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_questions.quiz_id
      AND (
        q.teacher_id = (SELECT auth.uid())
        OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
        OR public.is_school_member(q.school_id, 'school_admin'::app_role)
        OR public.is_school_member(q.school_id, 'school_teacher'::app_role)
        OR (q.class_id IS NOT NULL AND public.is_class_teacher(q.class_id))
      )
  )
);

CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_student(p_quiz_id uuid)
RETURNS TABLE (
  id uuid,
  quiz_id uuid,
  school_id uuid,
  ord integer,
  type public.quiz_question_type,
  prompt text,
  options jsonb,
  marks numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT qq.id, qq.quiz_id, qq.school_id, qq.ord, qq.type, qq.prompt, qq.options, qq.marks
  FROM public.quiz_questions qq
  JOIN public.quizzes q ON q.id = qq.quiz_id
  WHERE qq.quiz_id = p_quiz_id
    AND q.status = 'published'
    AND q.deleted_at IS NULL
    AND q.class_id IS NOT NULL
    AND public.is_enrolled_in_class(q.class_id)
  ORDER BY qq.ord;
$$;

GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_student(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_school_quiz_attempt(p_attempt_id uuid, p_answers jsonb)
RETURNS public.school_quiz_attempts
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
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

  UPDATE public.school_quiz_attempts
  SET submitted_at = now(),
      status = 'submitted',
      score = v_score,
      max_score = v_max,
      per_question = v_per_question
  WHERE id = p_attempt_id
  RETURNING * INTO v_attempt;

  RETURN v_attempt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_school_quiz_attempt(uuid, jsonb) TO authenticated;