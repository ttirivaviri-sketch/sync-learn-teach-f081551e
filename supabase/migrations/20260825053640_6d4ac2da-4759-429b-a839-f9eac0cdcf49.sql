DROP POLICY IF EXISTS los_pe_select ON public.learning_concept_prerequisite_edges;
CREATE POLICY los_pe_select ON public.learning_concept_prerequisite_edges
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.is_any_los_staff(auth.uid())
);

DROP POLICY IF EXISTS "Participants and tutor reviews are readable" ON public.reviews;
CREATE POLICY "Participants and admins read reviews" ON public.reviews
FOR SELECT TO authenticated
USING (
  auth.uid() = reviewer_id
  OR auth.uid() = reviewed_id
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE OR REPLACE FUNCTION public.get_tutor_ratings()
RETURNS TABLE (reviewed_id uuid, rating integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.reviewed_id, r.rating
  FROM public.reviews r
  WHERE r.reviewed_id IS NOT NULL
    AND public.is_tutor_user(r.reviewed_id)
$$;

GRANT EXECUTE ON FUNCTION public.get_tutor_ratings() TO anon, authenticated;

CREATE POLICY "staff insert school ai chunks" ON public.school_ai_chunks
FOR INSERT TO authenticated
WITH CHECK (
  public.is_school_member(school_id, 'school_teacher'::app_role)
  OR public.is_school_member(school_id, 'school_admin'::app_role)
);

CREATE POLICY "staff update school ai chunks" ON public.school_ai_chunks
FOR UPDATE TO authenticated
USING (
  public.is_school_member(school_id, 'school_teacher'::app_role)
  OR public.is_school_member(school_id, 'school_admin'::app_role)
)
WITH CHECK (
  public.is_school_member(school_id, 'school_teacher'::app_role)
  OR public.is_school_member(school_id, 'school_admin'::app_role)
);

CREATE POLICY "staff delete school ai chunks" ON public.school_ai_chunks
FOR DELETE TO authenticated
USING (
  public.is_school_member(school_id, 'school_teacher'::app_role)
  OR public.is_school_member(school_id, 'school_admin'::app_role)
);