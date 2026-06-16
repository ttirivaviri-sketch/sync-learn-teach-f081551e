
-- Status enums for schools / memberships
DO $$ BEGIN
  CREATE TYPE public.school_status AS ENUM ('active','suspended','archived','trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.school_plan AS ENUM ('trial','starter','standard','premium','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.school_membership_status AS ENUM ('invited','active','suspended','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- schools
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  brand_color text,
  country text,
  school_type text,
  address text,
  contact_person text,
  contact_email text,
  contact_phone text,
  status public.school_status NOT NULL DEFAULT 'trial',
  plan public.school_plan NOT NULL DEFAULT 'trial',
  seats_teachers integer NOT NULL DEFAULT 10,
  seats_students integer NOT NULL DEFAULT 200,
  ai_quota_daily integer NOT NULL DEFAULT 500,
  storage_quota_mb integer NOT NULL DEFAULT 5120,
  contract_start date,
  contract_end date,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- school_memberships
CREATE TABLE IF NOT EXISTS public.school_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text,
  role public.app_role NOT NULL,
  status public.school_membership_status NOT NULL DEFAULT 'active',
  invited_by uuid,
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_memberships_role_check
    CHECK (role IN ('school_admin','school_teacher','school_student')),
  CONSTRAINT school_memberships_user_or_email
    CHECK (user_id IS NOT NULL OR invited_email IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS school_memberships_user_role_unique
  ON public.school_memberships (school_id, user_id, role)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_memberships_user_idx
  ON public.school_memberships (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS school_memberships_school_idx
  ON public.school_memberships (school_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_memberships TO authenticated;
GRANT ALL ON public.school_memberships TO service_role;
ALTER TABLE public.school_memberships ENABLE ROW LEVEL SECURITY;

-- school_audit_logs
CREATE TABLE IF NOT EXISTS public.school_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  actor_id uuid,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  diff jsonb,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_audit_logs_school_idx
  ON public.school_audit_logs (school_id, created_at DESC);

GRANT SELECT, INSERT ON public.school_audit_logs TO authenticated;
GRANT ALL ON public.school_audit_logs TO service_role;
ALTER TABLE public.school_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.is_school_member(_school_id uuid, _role public.app_role DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_memberships
    WHERE school_id = _school_id
      AND user_id   = auth.uid()
      AND status    = 'active'
      AND (_role IS NULL OR role = _role)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_school_member(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_school_member(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_school_ids()
RETURNS uuid[] LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(array_agg(DISTINCT school_id), ARRAY[]::uuid[])
  FROM public.school_memberships
  WHERE user_id = auth.uid() AND status = 'active';
$$;
REVOKE EXECUTE ON FUNCTION public.current_school_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_school_ids() TO authenticated, service_role;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_schools_updated_at ON public.schools;
CREATE TRIGGER trg_schools_updated_at BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_school_memberships_updated_at ON public.school_memberships;
CREATE TRIGGER trg_school_memberships_updated_at BEFORE UPDATE ON public.school_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS policies — schools
DROP POLICY IF EXISTS "super admins manage schools" ON public.schools;
CREATE POLICY "super admins manage schools" ON public.schools
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "members read own school" ON public.schools;
CREATE POLICY "members read own school" ON public.schools
  FOR SELECT TO authenticated
  USING (public.is_school_member(id));

DROP POLICY IF EXISTS "school admins update own school" ON public.schools;
CREATE POLICY "school admins update own school" ON public.schools
  FOR UPDATE TO authenticated
  USING (public.is_school_member(id, 'school_admin'))
  WITH CHECK (public.is_school_member(id, 'school_admin'));

-- school_memberships
DROP POLICY IF EXISTS "super admins manage memberships" ON public.school_memberships;
CREATE POLICY "super admins manage memberships" ON public.school_memberships
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "school admins manage own memberships" ON public.school_memberships;
CREATE POLICY "school admins manage own memberships" ON public.school_memberships
  FOR ALL TO authenticated
  USING (public.is_school_member(school_id, 'school_admin'))
  WITH CHECK (public.is_school_member(school_id, 'school_admin'));

DROP POLICY IF EXISTS "members read own memberships" ON public.school_memberships;
CREATE POLICY "members read own memberships" ON public.school_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_school_member(school_id));

-- school_audit_logs
DROP POLICY IF EXISTS "super admins read audit logs" ON public.school_audit_logs;
CREATE POLICY "super admins read audit logs" ON public.school_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "school admins read own audit logs" ON public.school_audit_logs;
CREATE POLICY "school admins read own audit logs" ON public.school_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_school_member(school_id, 'school_admin'));

DROP POLICY IF EXISTS "members insert audit logs for own school" ON public.school_audit_logs;
CREATE POLICY "members insert audit logs for own school" ON public.school_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_school_member(school_id) AND actor_id = auth.uid());
