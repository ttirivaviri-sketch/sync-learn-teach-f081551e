CREATE OR REPLACE FUNCTION public.set_subscription_plan(p_plan TEXT)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.subscriptions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_plan NOT IN ('free','ai_moderate','ai_premium','tutor_payg','combo_moderate','combo_premium') THEN
    RAISE EXCEPTION 'Invalid plan: %', p_plan;
  END IF;

  -- Ensure a row exists (defensive — trigger normally creates one)
  INSERT INTO public.subscriptions (user_id, plan, trial_start, trial_end, status)
  VALUES (v_uid, 'free', now(), now() + interval '7 days', 'trial')
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.subscriptions
  SET plan = p_plan,
      updated_at = now()
  WHERE user_id = v_uid
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;