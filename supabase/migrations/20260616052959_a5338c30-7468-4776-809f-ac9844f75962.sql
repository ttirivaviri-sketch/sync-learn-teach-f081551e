
-- Helper: extract path tokens
-- existing functions: is_school_member, is_class_teacher, is_enrolled_in_class

-- Drop overly-permissive policies and replace
DROP POLICY IF EXISTS "school-content read by members" ON storage.objects;
DROP POLICY IF EXISTS "school-content write by teachers/admins" ON storage.objects;
DROP POLICY IF EXISTS "school-content update by teachers/admins" ON storage.objects;
DROP POLICY IF EXISTS "school-content delete by teachers/admins" ON storage.objects;

-- READ: materials readable by school members; submissions only by owner / class teacher / admin
CREATE POLICY "school-content read materials"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND public.is_school_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "school-content read submissions"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] = 'submissions'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::public.app_role)
    OR ((storage.foldername(name))[4])::uuid = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id::text = (storage.foldername(name))[3]
        AND public.is_class_teacher(a.class_id)
    )
  )
);

-- INSERT: teachers/admins can upload class materials; students can upload only to their own submission folder
CREATE POLICY "school-content upload materials by staff"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND (
    public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::public.app_role)
    OR public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::public.app_role)
  )
);

CREATE POLICY "school-content upload submissions by student"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] = 'submissions'
  AND ((storage.foldername(name))[4])::uuid = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id::text = (storage.foldername(name))[3]
      AND public.is_enrolled_in_class(a.class_id)
  )
);

-- UPDATE/DELETE: staff for materials, owner for own submissions (only while not graded)
CREATE POLICY "school-content update materials by staff"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND (
    public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::public.app_role)
    OR public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::public.app_role)
  )
);

CREATE POLICY "school-content delete materials by staff"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND (
    public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::public.app_role)
    OR public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::public.app_role)
  )
);

CREATE POLICY "school-content delete own submission"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] = 'submissions'
  AND ((storage.foldername(name))[4])::uuid = auth.uid()
);

-- Notify student when submission graded
CREATE OR REPLACE FUNCTION public.notify_submission_graded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title text;
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS DISTINCT FROM 'graded') THEN
    SELECT title INTO v_title FROM public.assignments WHERE id = NEW.assignment_id;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.student_id,
      'Assignment graded',
      COALESCE(v_title, 'Your assignment') || ' has been graded' ||
        CASE WHEN NEW.score IS NOT NULL THEN ' (' || NEW.score || ')' ELSE '' END || '.',
      'success'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_submission_graded ON public.submissions;
CREATE TRIGGER trg_notify_submission_graded
AFTER UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.notify_submission_graded();
