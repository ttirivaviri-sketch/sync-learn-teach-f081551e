-- RLS/security audit hardening (2026-08-31)
-- Three SECURITY DEFINER functions were created without SET search_path and
-- kept PostgreSQL's default PUBLIC EXECUTE grant. None are called by the app
-- or edge functions today, but as-deployed they are:
--   1. public.log_activity(text, jsonb)        - anon could spam activity_logs
--   2. public.cleanup_expired_insights()       - anyone could trigger cache deletes
--   3. public.get_tutor_commission_tier(uuid)  - internal commission logic exposed
-- Fix: pin search_path (prevents search_path hijacking of SECURITY DEFINER)
-- and scope EXECUTE to the roles that should legitimately call them.
-- Wrapped in exception-safe blocks so the migration succeeds even if a
-- function is absent in a given environment.

-- 1. log_activity: pin search_path; only signed-in users may log activity.
DO $$
BEGIN
  ALTER FUNCTION public.log_activity(text, jsonb) SET search_path = public;
  REVOKE ALL ON FUNCTION public.log_activity(text, jsonb) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.log_activity(text, jsonb) FROM anon;
  GRANT EXECUTE ON FUNCTION public.log_activity(text, jsonb) TO authenticated, service_role;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'log_activity(text, jsonb) not found - skipping';
END $$;

-- 2. cleanup_expired_insights: maintenance job; service_role only.
DO $$
BEGIN
  ALTER FUNCTION public.cleanup_expired_insights() SET search_path = public;
  REVOKE ALL ON FUNCTION public.cleanup_expired_insights() FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.cleanup_expired_insights() FROM anon;
  REVOKE ALL ON FUNCTION public.cleanup_expired_insights() FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.cleanup_expired_insights() TO service_role;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'cleanup_expired_insights() not found - skipping';
END $$;

-- 3. get_tutor_commission_tier: internal payout logic; service_role only.
DO $$
BEGIN
  ALTER FUNCTION public.get_tutor_commission_tier(uuid) SET search_path = public;
  REVOKE ALL ON FUNCTION public.get_tutor_commission_tier(uuid) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.get_tutor_commission_tier(uuid) FROM anon;
  REVOKE ALL ON FUNCTION public.get_tutor_commission_tier(uuid) FROM authenticated;
  GRANT EXECUTE ON FUNCTION public.get_tutor_commission_tier(uuid) TO service_role;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'get_tutor_commission_tier(uuid) not found - skipping';
END $$;
