-- 1. qualifications: owner + admin only; public discovery via definer RPC without document_url
DROP POLICY IF EXISTS "Authenticated users can view qualifications" ON public.qualifications;

CREATE POLICY "Owners view own qualifications"
  ON public.qualifications FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins view all qualifications"
  ON public.qualifications FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_public_qualifications()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  qualification_type text,
  institution text,
  year_obtained integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.user_id, q.qualification_type::text, q.institution::text, q.year_obtained
  FROM public.qualifications q
  JOIN public.profiles p ON p.id = q.user_id
  WHERE p.user_type = 'tutor'
    AND COALESCE(p.is_suspended, false) = false
$$;

REVOKE ALL ON FUNCTION public.get_public_qualifications() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_qualifications() TO authenticated, service_role;

-- 2. profiles realtime: publish only non-PII columns
ALTER PUBLICATION supabase_realtime SET TABLE public.profiles (
  id, full_name, user_type, study_level, online_status, last_seen,
  bio, avatar_url, is_official, onboarding_completed_at, created_at, updated_at
);

-- 3. learning_concept_catalog: scope staff writes to their own rows
ALTER TABLE public.learning_concept_catalog
  ADD COLUMN IF NOT EXISTS created_by uuid;

DROP POLICY IF EXISTS los_cc_write ON public.learning_concept_catalog;
CREATE POLICY los_cc_write ON public.learning_concept_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR (
      public.is_any_los_staff((SELECT auth.uid()))
      AND created_by = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS los_cc_update ON public.learning_concept_catalog;
CREATE POLICY los_cc_update ON public.learning_concept_catalog
  FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR (
      public.is_any_los_staff((SELECT auth.uid()))
      AND created_by = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR (
      public.is_any_los_staff((SELECT auth.uid()))
      AND created_by = (SELECT auth.uid())
    )
  );