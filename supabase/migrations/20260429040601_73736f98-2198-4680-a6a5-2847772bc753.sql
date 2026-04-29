-- AI usage quotas (per-user, per-day, per-bucket) + shared response cache.
CREATE TABLE IF NOT EXISTS public.ai_usage_daily (
  user_id     UUID NOT NULL,
  usage_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  bucket      TEXT NOT NULL,
  requests    INTEGER NOT NULL DEFAULT 0,
  tokens_in   INTEGER NOT NULL DEFAULT 0,
  tokens_out  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date, bucket)
);

ALTER TABLE public.ai_usage_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own ai usage"
  ON public.ai_usage_daily
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_usage(
  _user_id UUID,
  _bucket  TEXT,
  _limit   INTEGER,
  _amount  INTEGER DEFAULT 1
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INTEGER;
BEGIN
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', true, 'used', 0, 'limit', _limit, 'anonymous', true);
  END IF;

  INSERT INTO public.ai_usage_daily (user_id, usage_date, bucket, requests)
  VALUES (_user_id, CURRENT_DATE, _bucket, 0)
  ON CONFLICT (user_id, usage_date, bucket) DO NOTHING;

  SELECT requests INTO v_current
  FROM public.ai_usage_daily
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE AND bucket = _bucket
  FOR UPDATE;

  IF v_current + _amount > _limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', v_current, 'limit', _limit, 'bucket', _bucket);
  END IF;

  UPDATE public.ai_usage_daily
  SET requests = requests + _amount, updated_at = now()
  WHERE user_id = _user_id AND usage_date = CURRENT_DATE AND bucket = _bucket;

  RETURN jsonb_build_object('allowed', true, 'used', v_current + _amount, 'limit', _limit, 'bucket', _bucket);
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_ai_usage(UUID, TEXT, INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_usage(UUID, TEXT, INTEGER, INTEGER) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  cache_key   TEXT PRIMARY KEY,
  fn_name     TEXT NOT NULL,
  response    JSONB NOT NULL,
  hits        INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS ai_response_cache_fn_idx ON public.ai_response_cache (fn_name, created_at DESC);

ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_ai_usage_today()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_object_agg(bucket, jsonb_build_object('used', requests)),
    '{}'::jsonb
  )
  FROM public.ai_usage_daily
  WHERE user_id = auth.uid() AND usage_date = CURRENT_DATE;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_usage_today() TO authenticated;