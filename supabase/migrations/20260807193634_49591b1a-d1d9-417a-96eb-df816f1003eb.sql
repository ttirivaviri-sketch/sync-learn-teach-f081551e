-- Burst rate limiting for gated AI edge functions (fixed-window counter).
CREATE TABLE IF NOT EXISTS public.ai_rate_limit_counters (
  user_id uuid NOT NULL,
  fn text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, fn, window_start)
);

GRANT ALL ON public.ai_rate_limit_counters TO service_role;

ALTER TABLE public.ai_rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rate limit counters"
ON public.ai_rate_limit_counters
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_window
  ON public.ai_rate_limit_counters (window_start);

-- Atomic check + increment against a fixed window.
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _user_id uuid,
  _fn text,
  _limit integer,
  _window_seconds integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _win timestamptz;
  _count integer;
BEGIN
  IF _user_id IS NULL OR _limit IS NULL OR _limit <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'count', 0, 'limit', _limit, 'retry_after', 0);
  END IF;

  _win := to_timestamp(floor(extract(epoch FROM now()) / GREATEST(_window_seconds, 1))
                       * GREATEST(_window_seconds, 1));

  INSERT INTO public.ai_rate_limit_counters (user_id, fn, window_start, count, updated_at)
  VALUES (_user_id, _fn, _win, 1, now())
  ON CONFLICT (user_id, fn, window_start)
  DO UPDATE SET count = public.ai_rate_limit_counters.count + 1, updated_at = now()
  RETURNING count INTO _count;

  RETURN jsonb_build_object(
    'allowed', _count <= _limit,
    'count', _count,
    'limit', _limit,
    'retry_after', GREATEST(
      1,
      CEIL(EXTRACT(epoch FROM (_win + make_interval(secs => GREATEST(_window_seconds, 1))) - now()))
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(uuid, text, integer, integer) TO service_role;

-- Housekeeping: drop counters older than a day.
CREATE OR REPLACE FUNCTION public.prune_ai_rate_limit_counters()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  DELETE FROM public.ai_rate_limit_counters WHERE window_start < now() - interval '1 day';
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_ai_rate_limit_counters() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_ai_rate_limit_counters() TO service_role;