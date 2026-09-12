-- 1. Remove duplicate permissive INSERT policy on community_signups
DROP POLICY IF EXISTS "Anyone can join the community" ON public.community_signups;

-- 2. Validate school-content submission files against real submissions rows
DROP POLICY IF EXISTS "school-content upload submissions by student" ON storage.objects;
DROP POLICY IF EXISTS "school-content read submissions" ON storage.objects;
DROP POLICY IF EXISTS "school-content delete own submission" ON storage.objects;

CREATE POLICY "school-content upload submissions by student"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] = 'submissions'
  AND ((storage.foldername(name))[4])::uuid = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.student_id = auth.uid()
      AND (a.id)::text = (storage.foldername(name))[3]
      AND (a.school_id)::text = (storage.foldername(name))[1]
      AND public.is_enrolled_in_class(a.class_id)
  )
);

CREATE POLICY "school-content read submissions"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] = 'submissions'
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE (a.id)::text = (storage.foldername(name))[3]
      AND (s.student_id)::text = (storage.foldername(name))[4]
      AND (a.school_id)::text = (storage.foldername(name))[1]
      AND (
        s.student_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.is_school_member(a.school_id, 'school_admin'::app_role)
        OR public.is_class_teacher(a.class_id)
      )
  )
);

CREATE POLICY "school-content delete own submission"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] = 'submissions'
  AND ((storage.foldername(name))[4])::uuid = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE s.student_id = auth.uid()
      AND (a.id)::text = (storage.foldername(name))[3]
      AND (a.school_id)::text = (storage.foldername(name))[1]
  )
);