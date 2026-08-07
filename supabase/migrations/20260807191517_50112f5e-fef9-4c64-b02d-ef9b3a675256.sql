DROP POLICY IF EXISTS "quiz_questions read" ON public.quiz_questions;

-- Restrict reading quiz questions (which include answer keys) to people who
-- actually belong to the quiz's class/school: the owning teacher, class teacher,
-- school admins/teachers, enrolled students, or platform admins.
CREATE POLICY "quiz_questions read" ON public.quiz_questions
FOR SELECT TO authenticated
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
        OR (q.class_id IS NOT NULL AND public.is_enrolled_in_class(q.class_id))
      )
  )
);