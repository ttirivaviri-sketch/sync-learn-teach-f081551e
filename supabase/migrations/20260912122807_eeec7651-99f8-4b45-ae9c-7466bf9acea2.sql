CREATE OR REPLACE FUNCTION public.can_read_school_ai_document(_document_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_ai_documents d
    WHERE d.id = _document_id
      AND (
        has_role((SELECT auth.uid()), 'admin'::app_role)
        OR is_school_member(d.school_id, 'school_admin'::app_role)
        OR is_school_member(d.school_id, 'school_teacher'::app_role)
        OR (
          is_school_member(d.school_id)
          AND d.resource_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.school_resources r
            WHERE r.id = d.resource_id
              AND r.deleted_at IS NULL
              AND r.status = 'published'::content_status
              AND (
                r.visibility = 'school'::content_visibility
                OR (r.visibility = 'class'::content_visibility AND r.class_id IS NOT NULL AND is_enrolled_in_class(r.class_id))
                OR (r.visibility = 'grade'::content_visibility AND r.grade_id IS NOT NULL AND EXISTS (
                      SELECT 1 FROM public.enrollments e
                      JOIN public.classes c ON c.id = e.class_id
                      WHERE e.student_id = (SELECT auth.uid())
                        AND e.status = 'active'::enrollment_status
                        AND c.grade_id = r.grade_id))
                OR (r.visibility = 'subject'::content_visibility AND r.subject_id IS NOT NULL AND EXISTS (
                      SELECT 1 FROM public.enrollments e
                      JOIN public.class_subjects cs ON cs.class_id = e.class_id
                      WHERE e.student_id = (SELECT auth.uid())
                        AND e.status = 'active'::enrollment_status
                        AND cs.subject_id = r.subject_id))
                OR (r.visibility = 'custom'::content_visibility AND (SELECT auth.uid()) = ANY (r.custom_audience))
              )
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_read_school_ai_document(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_school_ai_document(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "members read school ai docs" ON public.school_ai_documents;
CREATE POLICY "members read visible school ai docs"
ON public.school_ai_documents
FOR SELECT
TO authenticated
USING (public.can_read_school_ai_document(id));

DROP POLICY IF EXISTS "members read school ai chunks" ON public.school_ai_chunks;
CREATE POLICY "members read visible school ai chunks"
ON public.school_ai_chunks
FOR SELECT
TO authenticated
USING (public.can_read_school_ai_document(document_id));