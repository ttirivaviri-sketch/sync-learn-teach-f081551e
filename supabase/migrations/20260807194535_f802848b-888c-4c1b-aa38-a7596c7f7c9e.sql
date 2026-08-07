-- IP-based rate limiting (fixed-window counter), complements per-user burst limits.
CREATE TABLE IF NOT EXISTS public.ip_rate_limit_counters (
  ip text NOT NULL,
  fn text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, fn, window_start)
);

GRANT ALL ON public.ip_rate_limit_counters TO service_role;

ALTER TABLE public.ip_rate_limit_counters ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ip_rate_limit_window
  ON public.ip_rate_limit_counters (window_start);

CREATE OR REPLACE FUNCTION public.check_ip_rate_limit(
  _ip text,
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
  IF _ip IS NULL OR _ip = '' OR _limit IS NULL OR _limit <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'count', 0, 'limit', _limit, 'retry_after', 0);
  END IF;

  _win := to_timestamp(floor(extract(epoch FROM now()) / GREATEST(_window_seconds, 1))
                       * GREATEST(_window_seconds, 1));

  INSERT INTO public.ip_rate_limit_counters (ip, fn, window_start, count, updated_at)
  VALUES (_ip, _fn, _win, 1, now())
  ON CONFLICT (ip, fn, window_start)
  DO UPDATE SET count = public.ip_rate_limit_counters.count + 1, updated_at = now()
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

REVOKE ALL ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ip_rate_limit(text, text, integer, integer) TO service_role;

-- Extend housekeeping to prune IP counters too.
CREATE OR REPLACE FUNCTION public.prune_ai_rate_limit_counters()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer; _m integer;
BEGIN
  DELETE FROM public.ai_rate_limit_counters WHERE window_start < now() - interval '1 day';
  GET DIAGNOSTICS _n = ROW_COUNT;
  DELETE FROM public.ip_rate_limit_counters WHERE window_start < now() - interval '1 day';
  GET DIAGNOSTICS _m = ROW_COUNT;
  RETURN _n + _m;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_ai_rate_limit_counters() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_ai_rate_limit_counters() TO service_role;