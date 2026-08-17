-- 1. Freeze profiles.user_type after onboarding window (prevents self-escalation to tutor)
CREATE OR REPLACE FUNCTION public.guard_profiles_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin'::app_role) OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.is_suspended := OLD.is_suspended;
  NEW.suspended_at := OLD.suspended_at;
  NEW.suspended_reason := OLD.suspended_reason;
  NEW.is_official := OLD.is_official;

  -- user_type may only be set during the initial onboarding window (e.g. Google
  -- OAuth sign-up normalisation). After that it is immutable for normal users.
  IF NEW.user_type IS DISTINCT FROM OLD.user_type
     AND (OLD.created_at IS NULL OR OLD.created_at < now() - interval '15 minutes') THEN
    NEW.user_type := OLD.user_type;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. tutor_subjects: discovery data restricted to authenticated users
DROP POLICY IF EXISTS "Anyone can view tutor subjects for discovery" ON public.tutor_subjects;
CREATE POLICY "Authenticated users can view tutor subjects for discovery"
ON public.tutor_subjects
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.tutor_subjects FROM anon;