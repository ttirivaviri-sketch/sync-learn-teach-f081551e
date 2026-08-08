DROP POLICY IF EXISTS "Admins can update library PDFs" ON storage.objects;
CREATE POLICY "Admins can update library PDFs" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'library-pdfs') AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((bucket_id = 'library-pdfs') AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update library files" ON storage.objects;
CREATE POLICY "Admins can update library files" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'library') AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK ((bucket_id = 'library') AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "School admins update school logos" ON storage.objects;
CREATE POLICY "School admins update school logos" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'profile-photos') AND ((storage.foldername(name))[1] = 'schools') AND is_school_member(((storage.foldername(name))[2])::uuid, 'school_admin'::app_role))
WITH CHECK ((bucket_id = 'profile-photos') AND ((storage.foldername(name))[1] = 'schools') AND is_school_member(((storage.foldername(name))[2])::uuid, 'school_admin'::app_role));

DROP POLICY IF EXISTS "Tutors update own library pdfs" ON storage.objects;
CREATE POLICY "Tutors update own library pdfs" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'library-pdfs') AND ((auth.uid())::text = (storage.foldername(name))[1]))
WITH CHECK ((bucket_id = 'library-pdfs') AND ((auth.uid())::text = (storage.foldername(name))[1]));

DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
CREATE POLICY "Users can update their own profile photos" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'profile-photos') AND ((auth.uid())::text = (storage.foldername(name))[1]))
WITH CHECK ((bucket_id = 'profile-photos') AND ((auth.uid())::text = (storage.foldername(name))[1]));

DROP POLICY IF EXISTS "school-content update materials by staff" ON storage.objects;
CREATE POLICY "school-content update materials by staff" ON storage.objects FOR UPDATE TO authenticated
USING ((bucket_id = 'school-content') AND ((storage.foldername(name))[2] IS DISTINCT FROM 'submissions') AND (is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::app_role) OR is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::app_role)))
WITH CHECK ((bucket_id = 'school-content') AND ((storage.foldername(name))[2] IS DISTINCT FROM 'submissions') AND (is_school_member(((storage.foldername(name))[1])::uuid, 'school_admin'::app_role) OR is_school_member(((storage.foldername(name))[1])::uuid, 'school_teacher'::app_role)));