
-- School admins can manage their school's logo files in the public profile-photos bucket
-- under the path  schools/{school_id}/...
CREATE POLICY "School admins upload school logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = 'schools'
  AND public.is_school_member(((storage.foldername(name))[2])::uuid, 'school_admin'::public.app_role)
);

CREATE POLICY "School admins update school logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = 'schools'
  AND public.is_school_member(((storage.foldername(name))[2])::uuid, 'school_admin'::public.app_role)
);

CREATE POLICY "School admins delete school logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = 'schools'
  AND public.is_school_member(((storage.foldername(name))[2])::uuid, 'school_admin'::public.app_role)
);
