
-- 1. account_deletion_archive: explicit least-privilege grants
REVOKE ALL ON public.account_deletion_archive FROM anon;
REVOKE ALL ON public.account_deletion_archive FROM authenticated;
GRANT SELECT ON public.account_deletion_archive TO authenticated; -- admin-only via RLS policy
GRANT ALL ON public.account_deletion_archive TO service_role;

-- 2. payment-proofs: admin-only update/delete
DROP POLICY IF EXISTS "Admins manage payment proofs update" ON storage.objects;
CREATE POLICY "Admins manage payment proofs update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins manage payment proofs delete" ON storage.objects;
CREATE POLICY "Admins manage payment proofs delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'::app_role));

-- 3. profile-photos: owner delete (bucket stays public-read for avatars)
DROP POLICY IF EXISTS "Users can delete their own profile photos" ON storage.objects;
CREATE POLICY "Users can delete their own profile photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- tighten upload policy to authenticated only
DROP POLICY IF EXISTS "Users can upload their own profile photos" ON storage.objects;
CREATE POLICY "Users can upload their own profile photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = (auth.uid())::text
);

-- 4. school-content: staff writes scoped to uploader (teachers) / admins
DROP POLICY IF EXISTS "school-content upload materials by staff" ON storage.objects;
CREATE POLICY "school-content upload materials by staff"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND owner = auth.uid()
  AND (
    public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::app_role)
    OR public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::app_role)
  )
);

DROP POLICY IF EXISTS "school-content update materials by staff" ON storage.objects;
CREATE POLICY "school-content update materials by staff"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND (
    public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::app_role)
    OR (
      public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::app_role)
      AND owner = auth.uid()
    )
  )
)
WITH CHECK (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND (
    public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::app_role)
    OR (
      public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::app_role)
      AND owner = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "school-content delete materials by staff" ON storage.objects;
CREATE POLICY "school-content delete materials by staff"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'school-content'
  AND (storage.foldername(name))[2] IS DISTINCT FROM 'submissions'
  AND (
    public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::app_role)
    OR (
      public.is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::app_role)
      AND owner = auth.uid()
    )
  )
);
