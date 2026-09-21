
DROP POLICY IF EXISTS "Tutors can upload own videos" ON storage.objects;
CREATE POLICY "Tutors can upload own videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tutor-videos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'tutor-documents'
  AND (auth.uid())::text = (storage.foldername(name))[1]
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Users upload own payment proofs" ON storage.objects;
CREATE POLICY "Users upload own payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (storage.foldername(name))[1] = (auth.uid())::text
  AND owner = auth.uid()
);
