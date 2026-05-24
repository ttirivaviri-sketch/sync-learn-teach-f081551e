
-- 1. Force caller identity for AI usage counter (prevents spoofing _user_id)
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  _user_id uuid, _bucket text, _limit integer, _amount integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_current INTEGER;
  v_uid uuid := auth.uid();
BEGIN
  -- Anonymous callers
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', _limit, 'anonymous', true);
  END IF;

  -- Caller can only increment their own bucket
  IF _user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Cannot modify AI usage for another user';
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, usage_date, bucket, requests)
  VALUES (v_uid, CURRENT_DATE, _bucket, 0)
  ON CONFLICT (user_id, usage_date, bucket) DO NOTHING;

  SELECT requests INTO v_current
  FROM public.ai_usage_daily
  WHERE user_id = v_uid AND usage_date = CURRENT_DATE AND bucket = _bucket
  FOR UPDATE;

  IF v_current + _amount > _limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_current, 'limit', _limit, 'bucket', _bucket);
  END IF;

  UPDATE public.ai_usage_daily
  SET requests = requests + _amount, updated_at = now()
  WHERE user_id = v_uid AND usage_date = CURRENT_DATE AND bucket = _bucket;

  RETURN jsonb_build_object('allowed', true, 'used', v_current + _amount, 'limit', _limit, 'bucket', _bucket);
END;
$fn$;

-- 2. Force caller identity for security event logger
CREATE OR REPLACE FUNCTION public.log_security_event(
  _user_id uuid, _action text, _details jsonb DEFAULT NULL::jsonb,
  _ip_address inet DEFAULT NULL::inet, _user_agent text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  log_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Non-admins cannot log on behalf of another user
  IF _user_id IS DISTINCT FROM v_uid AND NOT public.has_role(v_uid, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Cannot log security events for another user';
  END IF;

  INSERT INTO public.security_audit_logs (user_id, action, details, ip_address, user_agent)
  VALUES (COALESCE(_user_id, v_uid), _action, _details, _ip_address, _user_agent)
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$fn$;

-- 3. Revoke EXECUTE from anon and PUBLIC on non-public-facing SECURITY DEFINER functions.
--    Trigger functions and authenticated-only RPCs should not be callable by signed-out users.
DO $$
DECLARE
  r record;
  keep_public text[] := ARRAY[
    'has_role',                  -- used in RLS predicates
    'has_shared_relationship',   -- used in RLS predicates
    'get_published_tutorials',   -- public marketplace listing
    'get_overall_leaderboard',   -- public leaderboard
    'get_subject_leaderboard'    -- public leaderboard
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    IF r.proname = ANY(keep_public) THEN CONTINUE; END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon', r.proname, r.args);
  END LOOP;
END$$;
