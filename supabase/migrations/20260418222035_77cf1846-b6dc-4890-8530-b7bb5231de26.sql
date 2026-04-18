
-- 1. Add official flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_official BOOLEAN NOT NULL DEFAULT false;

-- 2. Extend tutor_tutorials with content type + pdf fields
ALTER TABLE public.tutor_tutorials
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS resource_category TEXT;

-- 3. Trigger: only official accounts can insert/update PDF tutorials
CREATE OR REPLACE FUNCTION public.enforce_official_pdf_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.content_type = 'pdf' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = NEW.tutor_id AND is_official = true
    ) THEN
      RAISE EXCEPTION 'Only the StudySync Official account can publish PDF study materials';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_official_pdf_upload_trigger ON public.tutor_tutorials;
CREATE TRIGGER enforce_official_pdf_upload_trigger
BEFORE INSERT OR UPDATE ON public.tutor_tutorials
FOR EACH ROW
EXECUTE FUNCTION public.enforce_official_pdf_upload();

-- 4. Create library-pdfs storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('library-pdfs', 'library-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policies: public read, official-only write
DROP POLICY IF EXISTS "Library PDFs are publicly readable" ON storage.objects;
CREATE POLICY "Library PDFs are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'library-pdfs');

DROP POLICY IF EXISTS "Only official can upload library PDFs" ON storage.objects;
CREATE POLICY "Only official can upload library PDFs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'library-pdfs'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_official = true)
);

DROP POLICY IF EXISTS "Only official can update library PDFs" ON storage.objects;
CREATE POLICY "Only official can update library PDFs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'library-pdfs'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_official = true)
);

DROP POLICY IF EXISTS "Only official can delete library PDFs" ON storage.objects;
CREATE POLICY "Only official can delete library PDFs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'library-pdfs'
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_official = true)
);
