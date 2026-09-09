DROP POLICY IF EXISTS "Participants and admins read reviews" ON public.reviews;
CREATE POLICY "Participants and admins read reviews"
ON public.reviews
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = reviewer_id
  OR (select auth.uid()) = reviewed_id
  OR public.has_role((select auth.uid()), 'admin'::app_role)
);