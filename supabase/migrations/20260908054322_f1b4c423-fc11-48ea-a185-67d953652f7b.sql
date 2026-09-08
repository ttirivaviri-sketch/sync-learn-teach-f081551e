DROP POLICY IF EXISTS "Anyone can refresh their own submission" ON public.community_signups;

CREATE POLICY "Owners can update their own signup"
ON public.community_signups
FOR UPDATE
TO authenticated
USING (user_id IS NOT NULL AND user_id = auth.uid())
WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid());