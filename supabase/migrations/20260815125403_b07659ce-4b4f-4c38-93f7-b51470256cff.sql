-- Helper: is a given user a tutor (used for public review discovery)
CREATE OR REPLACE FUNCTION public.is_tutor_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.user_type = 'tutor'
  );
$$;

-- 1. reviews: participants always; others only for reviews about tutors
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.reviews;
CREATE POLICY "Participants and tutor reviews are readable"
ON public.reviews
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) = reviewer_id
  OR (SELECT auth.uid()) = reviewed_id
  OR public.is_tutor_user(reviewed_id)
);

-- 2. tutor_availability: only slots flagged available (own rows via existing manage policy)
DROP POLICY IF EXISTS "Authenticated users can view tutor availability" ON public.tutor_availability;
CREATE POLICY "Authenticated users can view open availability"
ON public.tutor_availability
FOR SELECT
TO authenticated
USING (
  is_available = true
  OR (SELECT auth.uid()) = tutor_id
);

-- 3. school_invitations: require verified email + pending + unexpired
DROP POLICY IF EXISTS "Invitees can read invitations for their email" ON public.school_invitations;
CREATE POLICY "Verified invitees can read their pending invitations"
ON public.school_invitations
FOR SELECT
TO authenticated
USING (
  (
    accepted_user_id = (SELECT auth.uid())
  )
  OR (
    status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
    AND lower(email) = lower(COALESCE((SELECT auth.jwt()) ->> 'email', ''))
    AND COALESCE(
      (((SELECT auth.jwt()) -> 'user_metadata' ->> 'email_verified'))::boolean,
      false
    ) = true
  )
);

-- 4. learning_concept_prerequisite_edges: only when the concept itself is visible
DROP POLICY IF EXISTS los_pe_select ON public.learning_concept_prerequisite_edges;
CREATE POLICY los_pe_select
ON public.learning_concept_prerequisite_edges
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.learning_concept_catalog c
    WHERE c.id = learning_concept_prerequisite_edges.concept_id
  )
);
