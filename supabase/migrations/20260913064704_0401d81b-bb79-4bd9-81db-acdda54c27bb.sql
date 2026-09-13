CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  _user_id uuid, _bucket text, _limit integer, _amount integer DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $fn$
DECLARE
  v_current INTEGER;
  v_uid uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_target uuid;
BEGIN
  IF v_role = 'service_role' THEN
    v_target := _user_id;
  ELSIF v_uid IS NOT NULL THEN
    IF _user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Cannot modify AI usage for another user';
    END IF;
    v_target := v_uid;
  END IF;

  IF v_target IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', _limit, 'anonymous', true);
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, usage_date, bucket, requests)
  VALUES (v_target, CURRENT_DATE, _bucket, 0)
  ON CONFLICT (user_id, usage_date, bucket) DO NOTHING;

  SELECT requests INTO v_current
  FROM public.ai_usage_daily
  WHERE user_id = v_target AND usage_date = CURRENT_DATE AND bucket = _bucket
  FOR UPDATE;

  IF v_current + _amount > _limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_current, 'limit', _limit, 'bucket', _bucket);
  END IF;

  UPDATE public.ai_usage_daily
  SET requests = requests + _amount, updated_at = now()
  WHERE user_id = v_target AND usage_date = CURRENT_DATE AND bucket = _bucket;

  RETURN jsonb_build_object('allowed', true, 'used', v_current + _amount, 'limit', _limit, 'bucket', _bucket);
END;
$fn$;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(uuid, text, integer, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(uuid, text, integer, integer) TO authenticated, service_role;