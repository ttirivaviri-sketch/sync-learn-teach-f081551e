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

  INSERT INTO public.school_memberships (school_id, user_id, role, status, invited_by, invited_email, joined_at)
  VALUES (v_inv.school_id, v_uid, v_inv.role, 'active', v_inv.invited_by, v_inv.email, now())
  ON CONFLICT (school_id, user_id, role)
  DO UPDATE SET status='active', joined_at=COALESCE(public.school_memberships.joined_at, now()), updated_at=now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_uid, v_inv.role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.school_invitations
  SET status='accepted', accepted_user_id=v_uid, accepted_at=now(), updated_at=now()
  WHERE id=v_inv.id;

  RETURN jsonb_build_object('school_id', v_inv.school_id, 'role', v_inv.role);
END;
$$;