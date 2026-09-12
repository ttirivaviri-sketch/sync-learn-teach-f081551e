DROP POLICY IF EXISTS "Anyone can join community" ON public.community_signups;
DROP POLICY IF EXISTS "community_signups_insert" ON public.community_signups;

CREATE POLICY "Anyone can join community"
ON public.community_signups
FOR INSERT
TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());