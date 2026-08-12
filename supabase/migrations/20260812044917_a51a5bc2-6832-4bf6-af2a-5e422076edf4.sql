-- 1. landing_events: validate anonymous analytics inserts
DROP POLICY IF EXISTS "Anon can record landing events" ON public.landing_events;
DROP POLICY IF EXISTS "Authenticated can record landing events" ON public.landing_events;

CREATE POLICY "Anon can record landing events"
ON public.landing_events FOR INSERT TO anon
WITH CHECK (
  event = ANY (ARRAY['page_view','cta_click','scroll_50','scroll_90','section_view','exit_intent'])
  AND session_id IS NOT NULL AND length(session_id) BETWEEN 4 AND 128
  AND (path IS NULL OR length(path) <= 512)
  AND (referrer IS NULL OR length(referrer) <= 1024)
  AND (metadata IS NULL OR length(metadata::text) <= 2048)
);

CREATE POLICY "Authenticated can record landing events"
ON public.landing_events FOR INSERT TO authenticated
WITH CHECK (
  event = ANY (ARRAY['page_view','cta_click','scroll_50','scroll_90','section_view','exit_intent'])
  AND session_id IS NOT NULL AND length(session_id) BETWEEN 4 AND 128
  AND (path IS NULL OR length(path) <= 512)
  AND (referrer IS NULL OR length(referrer) <= 1024)
  AND (metadata IS NULL OR length(metadata::text) <= 2048)
);

-- 2. location_codes: authenticated-only read
DROP POLICY IF EXISTS "Anyone can view location codes" ON public.location_codes;
CREATE POLICY "Authenticated users can view location codes"
ON public.location_codes FOR SELECT TO authenticated
USING (true);
REVOKE SELECT ON public.location_codes FROM anon;

-- 3. storage: require true ownership (owner column) in addition to folder convention
DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
CREATE POLICY "Users can update own documents" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid())
WITH CHECK (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Tutors can delete their own documents" ON storage.objects;
CREATE POLICY "Tutors can delete their own documents" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutor-documents' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Tutors can update their own documents" ON storage.objects;
CREATE POLICY "Tutors can update their own documents" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tutor-documents' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid())
WITH CHECK (bucket_id = 'tutor-documents' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Tutors can delete own videos" ON storage.objects;
CREATE POLICY "Tutors can delete own videos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tutor-videos' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Tutors can update own videos" ON storage.objects;
CREATE POLICY "Tutors can update own videos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tutor-videos' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid())
WITH CHECK (bucket_id = 'tutor-videos' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Tutors delete own library pdfs" ON storage.objects;
CREATE POLICY "Tutors delete own library pdfs" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'library-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Tutors update own library pdfs" ON storage.objects;
CREATE POLICY "Tutors update own library pdfs" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'library-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid())
WITH CHECK (bucket_id = 'library-pdfs' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());

DROP POLICY IF EXISTS "Users can update their own profile photos" ON storage.objects;
CREATE POLICY "Users can update their own profile photos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile-photos' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid())
WITH CHECK (bucket_id = 'profile-photos' AND (auth.uid())::text = (storage.foldername(name))[1] AND owner = auth.uid());