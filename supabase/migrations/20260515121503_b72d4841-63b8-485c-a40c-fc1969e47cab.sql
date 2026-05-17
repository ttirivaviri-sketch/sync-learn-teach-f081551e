
-- 1. Flip bucket to private
UPDATE storage.buckets SET public = false WHERE id = 'library-pdfs';

-- 2. Drop old public-read policies on library-pdfs (created in 20260418222035)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%library-pdfs%' OR with_check LIKE '%library-pdfs%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Allow tutors to upload into their own folder (still needed for the upload flow)
CREATE POLICY "Tutors upload library pdfs to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'library-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Tutors update own library pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'library-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Tutors delete own library pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'library-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- NOTE: no SELECT policy. Reads are exclusively via the library-stream
-- edge function using the service role key.

-- 3. Backfill pdf_url -> object path
UPDATE public.library_system_resources
SET pdf_url = regexp_replace(pdf_url, '^https?://[^/]+/storage/v1/object/(?:public|sign)/library-pdfs/', '')
WHERE pdf_url ~ '^https?://[^/]+/storage/v1/object/(?:public|sign)/library-pdfs/';

UPDATE public.tutor_tutorials
SET pdf_url = regexp_replace(pdf_url, '^https?://[^/]+/storage/v1/object/(?:public|sign)/library-pdfs/', '')
WHERE pdf_url IS NOT NULL
  AND pdf_url ~ '^https?://[^/]+/storage/v1/object/(?:public|sign)/library-pdfs/';

-- 4. Access log
CREATE TABLE IF NOT EXISTS public.library_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('system','tutorial')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_library_access_log_user ON public.library_access_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_library_access_log_resource ON public.library_access_log(resource_id, created_at DESC);

ALTER TABLE public.library_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own access log"
ON public.library_access_log FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
