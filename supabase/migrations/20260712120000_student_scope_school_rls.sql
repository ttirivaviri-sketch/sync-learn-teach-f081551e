-- ─────────────────────────────────────────────────────────────────────────────
-- Student-scope My School data access (UI spec §15-17 flag-back)
--
-- Problem: the "members read own school" policy on public.schools let every
-- active member — including school_student — read ALL columns: contact
-- person/email/phone, seat counts, AI/storage quotas, and contract dates.
-- The UI hides billing from students, but nothing stopped a student from
-- querying the table directly.
--
-- Fix:
--   1. public.school_member_directory — a view exposing only identity-safe
--      columns (name, logo, brand color, status, plan label, etc.). It runs
--      with definer rights (security_invoker = false) and re-checks active
--      membership itself, so any active member — student included — can read
--      their own school's public identity but nothing commercial.
--   2. The base-table member read policy is tightened to school_admin and
--      school_teacher only. Students no longer read public.schools directly.
--   3. Platform super-admin and school-admin management policies unchanged.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Member-safe directory view (definer rights; membership re-checked inline)
CREATE OR REPLACE VIEW public.school_member_directory AS
SELECT
  s.id,
  s.name,
  s.slug,
  s.logo_url,
  s.brand_color,
  s.country,
  s.school_type,
  s.status,
  s.plan,
  s.created_at
FROM public.schools s
WHERE s.deleted_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.school_memberships m
    WHERE m.school_id = s.id
      AND m.user_id   = auth.uid()
      AND m.status    = 'active'
  );

-- Views default to definer rights; make it explicit for future readers.
ALTER VIEW public.school_member_directory SET (security_invoker = false);

REVOKE ALL ON public.school_member_directory FROM PUBLIC, anon;
GRANT SELECT ON public.school_member_directory TO authenticated, service_role;

COMMENT ON VIEW public.school_member_directory IS
  'Identity-safe school columns readable by any ACTIVE member (incl. students). '
  'Excludes contact details, seats, quotas, contract dates and metadata — those '
  'stay on public.schools, readable only by school_admin/school_teacher/platform admin.';

-- 2) Tighten base-table read: staff only (students use the view above)
DROP POLICY IF EXISTS "members read own school" ON public.schools;
CREATE POLICY "staff read own school" ON public.schools
  FOR SELECT TO authenticated
  USING (
    public.is_school_member(id, 'school_admin')
    OR public.is_school_member(id, 'school_teacher')
  );

-- (unchanged, restated for clarity after the drop above:)
--   "super admins manage schools"      — platform admins, FOR ALL
--   "school admins update own school"  — school_admin, FOR UPDATE
