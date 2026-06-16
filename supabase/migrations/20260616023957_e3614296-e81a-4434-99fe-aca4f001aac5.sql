
-- school_invitation_status enum
DO $$ BEGIN
  CREATE TYPE public.school_invitation_status AS ENUM ('pending','accepted','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Invitations table
CREATE TABLE IF NOT EXISTS public.school_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by UUID NOT NULL,
  status public.school_invitation_status NOT NULL DEFAULT 'pending',
  accepted_user_id UUID,
  message TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT school_invitations_role_chk CHECK (role IN ('school_teacher','school_student','school_admin'))
);

CREATE INDEX IF NOT EXISTS idx_school_invitations_school ON public.school_invitations(school_id);
CREATE INDEX IF NOT EXISTS idx_school_invitations_email ON public.school_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_school_invitations_status ON public.school_invitations(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_invitations TO authenticated;
GRANT ALL ON public.school_invitations TO service_role;

ALTER TABLE public.school_invitations ENABLE ROW LEVEL SECURITY;

-- Super admin can do everything
CREATE POLICY "Super admin manages invitations"
ON public.school_invitations
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- School admins manage invitations for their school
CREATE POLICY "School admins manage their invitations"
ON public.school_invitations
FOR ALL TO authenticated
USING (public.is_school_member(school_id, 'school_admin'::app_role))
WITH CHECK (public.is_school_member(school_id, 'school_admin'::app_role));

-- Invitees can read their own invitation by email
CREATE POLICY "Invitees can read invitations for their email"
ON public.school_invitations
FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- updated_at trigger
DROP TRIGGER IF EXISTS set_updated_at_school_invitations ON public.school_invitations;
CREATE TRIGGER set_updated_at_school_invitations
BEFORE UPDATE ON public.school_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RPC: accept invitation by token (creates membership + role)
CREATE OR REPLACE FUNCTION public.accept_school_invitation(_token UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce((auth.jwt() ->> 'email'), ''));
  v_inv public.school_invitations;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_inv FROM public.school_invitations WHERE token = _token FOR UPDATE;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitation not found'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'Invitation is %', v_inv.status; END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.school_invitations SET status='expired', updated_at=now() WHERE id=v_inv.id;
    RAISE EXCEPTION 'Invitation expired';
  END IF;
  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'This invitation is for a different email address';
  END IF;

  -- Upsert membership
  INSERT INTO public.school_memberships (school_id, user_id, role, status, invited_by, invited_at, joined_at)
  VALUES (v_inv.school_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.created_at, now())
  ON CONFLICT (school_id, user_id, role)
  DO UPDATE SET status='active', joined_at=COALESCE(public.school_memberships.joined_at, now()), updated_at=now();

  -- Ensure user has corresponding app_role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, v_inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.school_invitations
  SET status='accepted', accepted_user_id=v_uid, accepted_at=now(), updated_at=now()
  WHERE id=v_inv.id;

  RETURN jsonb_build_object('school_id', v_inv.school_id, 'role', v_inv.role);
END;
$$;

REVOKE ALL ON FUNCTION public.accept_school_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_school_invitation(uuid) TO authenticated;

-- RPC: lookup invitation summary by token (for landing pages, prior to login)
CREATE OR REPLACE FUNCTION public.get_invitation_summary(_token UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
BEGIN
  SELECT i.id, i.email, i.role, i.status, i.expires_at, s.name AS school_name, s.slug AS school_slug
  INTO v_row
  FROM public.school_invitations i
  JOIN public.schools s ON s.id = i.school_id
  WHERE i.token = _token;

  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'email', v_row.email,
    'role', v_row.role,
    'status', v_row.status,
    'expires_at', v_row.expires_at,
    'school_name', v_row.school_name,
    'school_slug', v_row.school_slug,
    'expired', v_row.expires_at < now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_summary(uuid) TO anon, authenticated;
