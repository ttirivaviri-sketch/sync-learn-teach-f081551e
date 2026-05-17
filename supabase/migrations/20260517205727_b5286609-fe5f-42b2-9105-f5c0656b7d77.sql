
-- 1. Drop the overly broad policy that exposed all tutor columns
DROP POLICY IF EXISTS "Authenticated users can view tutor profiles" ON public.profiles;

-- 2. Helper: do the two users share a booking or conversation?
CREATE OR REPLACE FUNCTION public.has_shared_relationship(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE (b.learner_id = auth.uid() AND b.tutor_id = _other)
       OR (b.tutor_id   = auth.uid() AND b.learner_id = _other)
  )
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE (c.learner_id = auth.uid() AND c.tutor_id = _other)
       OR (c.tutor_id   = auth.uid() AND c.learner_id = _other)
  );
$$;

-- 3. Replacement policy: only counterparties can read the full row
CREATE POLICY "Counterparties can view each other's profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_shared_relationship(id));

-- 4. Public tutor discovery view — safe columns only.
--    Uses default (security definer) so it bypasses the new restrictive RLS,
--    but only ever exposes non-sensitive columns.
DROP VIEW IF EXISTS public.tutor_profiles_public;
CREATE VIEW public.tutor_profiles_public AS
SELECT
  id,
  full_name,
  avatar_url,
  bio,
  user_type,
  is_official,
  online_status,
  last_seen,
  location_lat,
  location_lng,
  country,
  created_at
FROM public.profiles
WHERE user_type = 'tutor'
  AND COALESCE(is_suspended, false) = false;

GRANT SELECT ON public.tutor_profiles_public TO anon, authenticated;
