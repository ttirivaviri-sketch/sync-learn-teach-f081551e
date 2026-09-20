-- 1. Stop broadcasting profile row changes over Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;

-- 2. Restrict topic_tutor_rankings reads to the owning tutor and admins
DROP POLICY IF EXISTS "Anyone can read topic rankings" ON public.topic_tutor_rankings;
CREATE POLICY "Tutors read their own topic rankings"
  ON public.topic_tutor_rankings FOR SELECT
  TO authenticated
  USING (
    tutor_id = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
  );

-- 3. Rate limit + sanity check anonymous landing analytics inserts
CREATE OR REPLACE FUNCTION public.guard_landing_events_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_count integer;
BEGIN
  IF NEW.session_id ~ '[\x00-\x1F\x7F]'
     OR (NEW.path IS NOT NULL AND NEW.path ~ '[\x00-\x1F\x7F]')
     OR (NEW.referrer IS NOT NULL AND NEW.referrer ~ '[\x00-\x1F\x7F]') THEN
    RAISE EXCEPTION 'invalid characters in analytics event';
  END IF;

  SELECT count(*) INTO recent_count
  FROM public.landing_events
  WHERE session_id = NEW.session_id
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 120 THEN
    RAISE EXCEPTION 'analytics event rate limit exceeded';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_landing_events_insert ON public.landing_events;
CREATE TRIGGER guard_landing_events_insert
  BEFORE INSERT ON public.landing_events
  FOR EACH ROW EXECUTE FUNCTION public.guard_landing_events_insert();

CREATE INDEX IF NOT EXISTS idx_landing_events_session_created
  ON public.landing_events (session_id, created_at DESC);
