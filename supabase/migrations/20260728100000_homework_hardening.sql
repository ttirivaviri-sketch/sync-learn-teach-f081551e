-- Homework hardening (AI homework critique fix package)
--
-- 1. Close the rubric leak: students could SELECT * on
--    school_homework_questions (including expected_answer, examiner_notes,
--    common_mistakes) via the broad RLS policy. Replace the student SELECT
--    policy with a SECURITY DEFINER RPC that returns only student-safe
--    columns for published homework in classes they are enrolled in.
--
-- 2. Add `visual` jsonb to school_homework_questions so AI-generated
--    homework can carry the same visual spec (function-graph / data-chart /
--    svg-diagram / ai-image) used by quiz and exam questions.

-- ── 2. Visual spec column ───────────────────────────────────────────────────
ALTER TABLE public.school_homework_questions
  ADD COLUMN IF NOT EXISTS visual jsonb;

-- ── 1. Remove direct student read access to the rubric table ───────────────
DROP POLICY IF EXISTS "Enrolled students read questions for published homework"
  ON public.school_homework_questions;

-- Student-safe accessor: only id/ord/prompt/type/options/marks/visual —
-- never expected_answer, examiner_notes or common_mistakes.
CREATE OR REPLACE FUNCTION public.get_homework_questions_for_student(_homework_id uuid)
RETURNS TABLE (
  id uuid,
  ord integer,
  prompt text,
  question_type text,
  options jsonb,
  marks numeric,
  visual jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.ord, q.prompt, q.question_type, q.options, q.marks, q.visual
  FROM public.school_homework_questions q
  JOIN public.school_homework h ON h.id = q.homework_id
  JOIN public.enrollments e
    ON e.class_id = h.class_id
   AND e.student_id = auth.uid()
   AND e.status = 'active'
  WHERE q.homework_id = _homework_id
    AND h.status = 'published'
  ORDER BY q.ord;
$$;

REVOKE ALL ON FUNCTION public.get_homework_questions_for_student(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_homework_questions_for_student(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_homework_questions_for_student(uuid) IS
  'Student-safe homework question reader: excludes rubric columns (expected_answer, examiner_notes, common_mistakes). Enrolled students + published homework only.';
