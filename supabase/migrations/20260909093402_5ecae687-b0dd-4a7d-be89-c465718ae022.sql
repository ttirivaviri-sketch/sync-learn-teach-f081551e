
-- 1. Remove the broad counterparty full-row read on profiles
DROP POLICY IF EXISTS "Counterparties can view each other's profile" ON public.profiles;

-- 2. Safe public display fields for other users (no phone/email/location)
CREATE OR REPLACE FUNCTION public.get_public_profiles(_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  user_type text,
  is_official boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.bio, p.user_type, COALESCE(p.is_official, false)
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- 3. Contact details only after a mutually-confirmed booking
CREATE OR REPLACE FUNCTION public.get_counterparty_contact(_other uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.phone
  FROM public.profiles p
  WHERE p.id = _other
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.status IN ('confirmed','completed')
        AND (
          (b.learner_id = auth.uid() AND b.tutor_id = _other)
          OR (b.tutor_id = auth.uid() AND b.learner_id = _other)
        )
    );
$$;

REVOKE ALL ON FUNCTION public.get_counterparty_contact(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_counterparty_contact(uuid) TO authenticated;
