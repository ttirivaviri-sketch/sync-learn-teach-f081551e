-- ═══════════════════════════════════════════════════════════════════════════
-- Security hardening (Supabase advisory remediation, part 1 of 3)
--
--   §1  learning_concept_catalog — close the any-authenticated-user write
--       hole. Writes now require platform admin OR active LOS-workspace
--       staff (owner/admin/teacher/tutor).
--   §2  school_member_directory — replace the SECURITY DEFINER view
--       (ERROR-level advisory) with a definer FUNCTION + invoker view.
--       Same columns, same client API, same membership gating — but the
--       linter-flagged pattern is gone and the privilege boundary is an
--       auditable function instead of an implicit view property.
--   §3  storage.objects — stop anonymous/blanket enumeration of public
--       buckets (library, profile-photos, question-diagrams, tutor-videos,
--       tutorial-videos, tutorial-thumbnails, study-resources, library-pdfs).
--       Files stay fetchable via their public CDN URLs (that path bypasses
--       RLS); what goes away is `.list()` — enumerating every student's
--       photo or every file name. Owners keep SELECT on their own folder,
--       platform admins keep SELECT on everything.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Concept catalog: staff-only writes ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_any_los_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.learning_workspace_memberships m
    WHERE m.user_id = _user_id
      AND m.status = 'active'
      AND m.role IN ('owner', 'admin', 'teacher', 'tutor')
  );
$$;

REVOKE ALL ON FUNCTION public.is_any_los_staff(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_any_los_staff(uuid) TO authenticated, service_role;

-- Read stays open to all signed-in users (the catalog is shared reference
-- data); INSERT/UPDATE require admin or LOS staff. DELETE was never granted.
DROP POLICY IF EXISTS los_cc_write ON public.learning_concept_catalog;
CREATE POLICY los_cc_write ON public.learning_concept_catalog
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_any_los_staff((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS los_cc_update ON public.learning_concept_catalog;
CREATE POLICY los_cc_update ON public.learning_concept_catalog
  FOR UPDATE TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_any_los_staff((SELECT auth.uid()))
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin')
    OR public.is_any_los_staff((SELECT auth.uid()))
  );

-- ─── §2 Member directory: definer function + invoker view ───────────────────

CREATE OR REPLACE FUNCTION public.school_member_directory_rows()
RETURNS TABLE (
  id          uuid,
  name        text,
  slug        text,
  logo_url    text,
  brand_color text,
  country     text,
  school_type text,
  status      public.school_status,
  plan        public.school_plan,
  created_at  timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.name, s.slug, s.logo_url, s.brand_color,
    s.country, s.school_type, s.status, s.plan, s.created_at
  FROM public.schools s
  WHERE s.deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.school_memberships m
      WHERE m.school_id = s.id
        AND m.user_id   = auth.uid()
        AND m.status    = 'active'
    );
$$;

REVOKE ALL ON FUNCTION public.school_member_directory_rows() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_member_directory_rows() TO authenticated, service_role;

DROP VIEW IF EXISTS public.school_member_directory;
CREATE VIEW public.school_member_directory
WITH (security_invoker = true) AS
SELECT * FROM public.school_member_directory_rows();

REVOKE ALL ON public.school_member_directory FROM PUBLIC, anon;
GRANT SELECT ON public.school_member_directory TO authenticated, service_role;

COMMENT ON VIEW public.school_member_directory IS
  'Identity-safe school columns readable by any ACTIVE member (incl. students). '
  'security_invoker view over a SECURITY DEFINER function that re-checks '
  'membership inline — no definer-view RLS bypass.';

-- ─── §3 Storage: kill blanket enumeration of public buckets ─────────────────

DO $$
DECLARE
  p record;
  dropped int := 0;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND cmd        = 'SELECT'
      AND (
        qual ILIKE '%''library''%'
        OR qual ILIKE '%''library-pdfs''%'
        OR qual ILIKE '%''profile-photos''%'
        OR qual ILIKE '%''question-diagrams''%'
        OR qual ILIKE '%''tutor-videos''%'
        OR qual ILIKE '%''tutorial-videos''%'
        OR qual ILIKE '%''tutorial-thumbnails''%'
        OR qual ILIKE '%''study-resources''%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', p.policyname);
    dropped := dropped + 1;
  END LOOP;
  RAISE NOTICE 'Dropped % enumerating SELECT policies on storage.objects', dropped;
END $$;

-- Owners can still list/inspect their own folder (uploads use
-- <user_id>/<file> convention where ownership applies).
DROP POLICY IF EXISTS "own folder select on public buckets" ON storage.objects;
CREATE POLICY "own folder select on public buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('profile-photos', 'tutor-videos', 'tutorial-videos', 'tutorial-thumbnails')
    AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

-- Platform admins keep full visibility for moderation/curation.
DROP POLICY IF EXISTS "admin select on public buckets" ON storage.objects;
CREATE POLICY "admin select on public buckets" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('library', 'library-pdfs', 'profile-photos', 'question-diagrams',
                  'tutor-videos', 'tutorial-videos', 'tutorial-thumbnails', 'study-resources')
    AND public.has_role((SELECT auth.uid()), 'admin')
  );
