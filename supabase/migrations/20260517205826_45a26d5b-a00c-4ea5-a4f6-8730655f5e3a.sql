
DROP VIEW IF EXISTS public.tutor_profiles_public;

CREATE OR REPLACE FUNCTION public.get_tutor_directory()
RETURNS TABLE (
  id uuid,
  full_name text,
  avatar_url text,
  bio text,
  user_type text,
  is_official boolean,
  online_status boolean,
  last_seen timestamptz,
  location_lat numeric,
  location_lng numeric,
  country text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.full_name, p.avatar_url, p.bio, p.user_type,
    p.is_official, p.online_status, p.last_seen,
    p.location_lat, p.location_lng, p.country, p.created_at
  FROM public.profiles p
  WHERE p.user_type = 'tutor'
    AND COALESCE(p.is_suspended, false) = false;
$$;

-- Only signed-in users should browse tutors
REVOKE ALL ON FUNCTION public.get_tutor_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tutor_directory() TO authenticated;
