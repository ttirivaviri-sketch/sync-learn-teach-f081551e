CREATE OR REPLACE FUNCTION public.current_user_verified_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email)
  FROM auth.users u
  WHERE u.id = auth.uid()
    AND u.email_confirmed_at IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_verified_email() FROM anon;
GRANT EXECUTE ON FUNCTION public.current_user_verified_email() TO authenticated;

DROP POLICY IF EXISTS "Verified invitees can read their pending invitations" ON public.school_invitations;
CREATE POLICY "Verified invitees can read their pending invitations"
ON public.school_invitations
FOR SELECT
TO authenticated
USING (
  accepted_user_id = (SELECT auth.uid())
  OR (
    status = 'pending'
    AND (expires_at IS NULL OR expires_at > now())
    AND lower(email) = public.current_user_verified_email()
  )
);
