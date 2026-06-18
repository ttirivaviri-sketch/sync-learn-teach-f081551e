
DROP POLICY IF EXISTS "subjects manage by school admin" ON public.school_subjects;
DROP POLICY IF EXISTS "grades manage by school admin" ON public.grades;

CREATE POLICY "subjects manage by school staff" ON public.school_subjects
FOR ALL
USING (
  is_school_member(school_id, 'school_admin'::app_role)
  OR is_school_member(school_id, 'school_teacher'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  is_school_member(school_id, 'school_admin'::app_role)
  OR is_school_member(school_id, 'school_teacher'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "grades manage by school staff" ON public.grades
FOR ALL
USING (
  is_school_member(school_id, 'school_admin'::app_role)
  OR is_school_member(school_id, 'school_teacher'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  is_school_member(school_id, 'school_admin'::app_role)
  OR is_school_member(school_id, 'school_teacher'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);
