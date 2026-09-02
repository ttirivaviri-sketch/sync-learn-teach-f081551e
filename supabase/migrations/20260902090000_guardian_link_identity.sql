-- Guardian portal review (2026-09-02)
--
-- When a guardian redeemed an invite code, guardian_label was never set, so
-- the learner's control panel showed only "Guardian linked" with no way to
-- tell WHO redeemed the code. If a code leaked and a stranger redeemed it,
-- the learner had no signal. Capture the guardian's profile name (fallback:
-- masked email) at accept time so the learner always sees who has access.

CREATE OR REPLACE FUNCTION public.accept_guardian_invite(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.guardian_links;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link
  FROM public.guardian_links
  WHERE invite_code = upper(trim(p_code)) AND status = 'invited'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or already-used code');
  END IF;

  IF v_link.learner_user_id = auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot link to your own account');
  END IF;

  -- Who is redeeming? Prefer their profile name; fall back to a masked email
  -- (j***@gmail.com) so the learner can recognise the guardian either way.
  SELECT COALESCE(
    NULLIF(trim(p.full_name), ''),
    CASE
      WHEN p.email IS NOT NULL AND position('@' in p.email) > 1 THEN
        left(p.email, 1) || '***' || substr(p.email, position('@' in p.email))
      ELSE NULL
    END
  )
  INTO v_label
  FROM public.profiles p
  WHERE p.id = auth.uid();

  UPDATE public.guardian_links
  SET guardian_user_id = auth.uid(),
      guardian_label = COALESCE(v_label, guardian_label),
      status = 'active',
      accepted_at = now()
  WHERE id = v_link.id;

  RETURN jsonb_build_object('ok', true, 'link_id', v_link.id, 'guardian_label', v_label);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_guardian_invite(text) TO authenticated;
