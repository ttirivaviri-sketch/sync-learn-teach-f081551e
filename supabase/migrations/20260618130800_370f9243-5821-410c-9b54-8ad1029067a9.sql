
-- Allow teachers (school_teacher) to create classrooms in their school and manage
-- the ones they teach. Admins keep full control.

-- classes: teachers can INSERT new classes in their school; UPDATE/DELETE only
-- if they are assigned to that class via class_subjects.
DROP POLICY IF EXISTS "classes teacher insert" ON public.classes;
CREATE POLICY "classes teacher insert" ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (is_school_member(school_id, 'school_teacher'::app_role));

DROP POLICY IF EXISTS "classes teacher update own" ON public.classes;
CREATE POLICY "classes teacher update own" ON public.classes
  FOR UPDATE TO authenticated
  USING (
    is_school_member(school_id, 'school_teacher'::app_role)
    AND EXISTS (SELECT 1 FROM public.class_subjects cs
                WHERE cs.class_id = classes.id AND cs.teacher_id = auth.uid())
  )
  WITH CHECK (is_school_member(school_id, 'school_teacher'::app_role));

-- class_subjects: teachers can INSERT (assign a subject + themselves/other teacher)
-- in their school; can DELETE rows for classes they teach.
DROP POLICY IF EXISTS "class_subjects teacher insert" ON public.class_subjects;
CREATE POLICY "class_subjects teacher insert" ON public.class_subjects
  FOR INSERT TO authenticated
  WITH CHECK (is_school_member(school_id, 'school_teacher'::app_role));

DROP POLICY IF EXISTS "class_subjects teacher delete own" ON public.class_subjects;
CREATE POLICY "class_subjects teacher delete own" ON public.class_subjects
  FOR DELETE TO authenticated
  USING (
    is_school_member(school_id, 'school_teacher'::app_role)
    AND EXISTS (SELECT 1 FROM public.class_subjects cs2
                WHERE cs2.class_id = class_subjects.class_id AND cs2.teacher_id = auth.uid())
  );

-- enrollments: teachers can INSERT/DELETE students for classes they teach.
DROP POLICY IF EXISTS "enrollments teacher manage own classes" ON public.enrollments;
CREATE POLICY "enrollments teacher manage own classes" ON public.enrollments
  FOR ALL TO authenticated
  USING (
    is_school_member(school_id, 'school_teacher'::app_role)
    AND EXISTS (SELECT 1 FROM public.class_subjects cs
                WHERE cs.class_id = enrollments.class_id AND cs.teacher_id = auth.uid())
  )
  WITH CHECK (
    is_school_member(school_id, 'school_teacher'::app_role)
    AND EXISTS (SELECT 1 FROM public.class_subjects cs
                WHERE cs.class_id = enrollments.class_id AND cs.teacher_id = auth.uid())
  );
