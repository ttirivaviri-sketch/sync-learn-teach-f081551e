-- ═══════════════════════════════════════════════════════════════════════════
-- Seat-scaled school AI quota + token accounting (part 3 of 3)
--
--   §1  check_school_ai_quota now derives the effective daily limit from the
--       school's student seats:  effective = GREATEST(ai_quota_daily,
--       seats_students × per-seat allowance). ai_quota_daily becomes a FLOOR
--       (and can still be raised for bespoke contracts); the pool scales
--       automatically as seats grow. Per-seat allowance defaults to 5/day
--       and is overridable per school via metadata.ai_per_seat_daily.
--
--   §2  record_ai_token_usage(): single RPC the edge functions call after
--       every model response to persist real tokens_in/tokens_out into
--       ai_usage_daily (per user) and school_ai_usage_daily (per school,
--       when applicable) — replacing the always-zero placeholders.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Seat-scaled quota ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_school_ai_quota(_school_id uuid)
RETURNS TABLE(allowed boolean, used int, "limit" int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _floor    int;
  _seats    int;
  _per_seat int;
  _limit    int;
  _used     int;
BEGIN
  SELECT
    COALESCE(s.ai_quota_daily, 0),
    COALESCE(s.seats_students, 0),
    COALESCE((s.metadata->>'ai_per_seat_daily')::int, 5)
  INTO _floor, _seats, _per_seat
  FROM public.schools s
  WHERE s.id = _school_id;

  -- Effective limit: the larger of the contractual floor and the
  -- seat-derived pool. A floor of 0 still means "unlimited" only when the
  -- seat pool is also 0 (no seats configured).
  _limit := GREATEST(_floor, _seats * _per_seat);

  SELECT COALESCE(sum(requests), 0)::int INTO _used
  FROM public.school_ai_usage_daily
  WHERE school_id = _school_id AND usage_date = current_date;

  RETURN QUERY SELECT (_limit = 0 OR _used < _limit), _used, _limit;
END $$;

COMMENT ON FUNCTION public.check_school_ai_quota(uuid) IS
  'Effective daily AI limit = GREATEST(ai_quota_daily floor, seats_students × '
  'per-seat allowance). Per-seat allowance = metadata.ai_per_seat_daily (default 5).';

-- ─── §2 Token accounting RPC ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_ai_token_usage(
  _user_id    uuid,
  _bucket     text,
  _tokens_in  int DEFAULT 0,
  _tokens_out int DEFAULT 0,
  _school_id  uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NOT NULL THEN
    INSERT INTO public.ai_usage_daily (user_id, usage_date, bucket, requests, tokens_in, tokens_out)
    VALUES (_user_id, current_date, COALESCE(_bucket, 'misc'), 0,
            GREATEST(COALESCE(_tokens_in, 0), 0), GREATEST(COALESCE(_tokens_out, 0), 0))
    ON CONFLICT (user_id, usage_date, bucket) DO UPDATE
      SET tokens_in  = ai_usage_daily.tokens_in  + GREATEST(COALESCE(_tokens_in, 0), 0),
          tokens_out = ai_usage_daily.tokens_out + GREATEST(COALESCE(_tokens_out, 0), 0),
          updated_at = now();
  END IF;

  IF _school_id IS NOT NULL THEN
    INSERT INTO public.school_ai_usage_daily (school_id, usage_date, bucket, requests, tokens_in, tokens_out)
    VALUES (_school_id, current_date, COALESCE(_bucket, 'misc'), 0,
            GREATEST(COALESCE(_tokens_in, 0), 0), GREATEST(COALESCE(_tokens_out, 0), 0))
    ON CONFLICT (school_id, usage_date, bucket) DO UPDATE
      SET tokens_in  = school_ai_usage_daily.tokens_in  + GREATEST(COALESCE(_tokens_in, 0), 0),
          tokens_out = school_ai_usage_daily.tokens_out + GREATEST(COALESCE(_tokens_out, 0), 0),
          updated_at = now();
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.record_ai_token_usage(uuid, text, int, int, uuid) FROM PUBLIC, anon;
-- service_role only: edge functions report usage; clients must not self-report.
GRANT EXECUTE ON FUNCTION public.record_ai_token_usage(uuid, text, int, int, uuid) TO service_role;
