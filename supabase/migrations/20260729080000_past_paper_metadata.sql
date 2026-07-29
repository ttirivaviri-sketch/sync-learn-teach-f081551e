-- ═══════════════════════════════════════════════════════════════════════════
-- Past-paper library: structured metadata + admin uploads
--
-- Audit gap #5 (🟠): "real past papers". ZIMSEC students already organise in
-- WhatsApp past-paper groups — this gives papers first-class metadata so the
-- Library can present them as a browsable, year-sorted archive with marking
-- schemes, instead of loose PDFs.
--
-- 1. Metadata columns on library_system_resources (all nullable — additive,
--    only meaningful when kind = 'past_paper'):
--      paper_year          e.g. 2023
--      paper_session       e.g. 'June' / 'November' / 'March'
--      paper_number        e.g. 'Paper 1' / 'Paper 2'
--      marking_scheme_url  direct PDF link to the official marking scheme
--      rights_note         provenance/licensing note shown to admins
-- 2. Storage: allow platform admins (has_role 'admin') to manage objects in
--    the public 'library-pdfs' bucket alongside the existing official-account
--    policies, so past papers can be uploaded from the admin console.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.library_system_resources
  ADD COLUMN IF NOT EXISTS paper_year int,
  ADD COLUMN IF NOT EXISTS paper_session text,
  ADD COLUMN IF NOT EXISTS paper_number text,
  ADD COLUMN IF NOT EXISTS marking_scheme_url text,
  ADD COLUMN IF NOT EXISTS rights_note text;

-- Sanity bounds — papers must be from the modern exam era.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'library_paper_year_range'
  ) THEN
    ALTER TABLE public.library_system_resources
      ADD CONSTRAINT library_paper_year_range
      CHECK (paper_year IS NULL OR (paper_year >= 1980 AND paper_year <= 2100));
  END IF;
END $$;

-- Fast year-descending listing of papers per curriculum/subject.
CREATE INDEX IF NOT EXISTS library_past_papers_idx
  ON public.library_system_resources (curriculum, subject, paper_year DESC)
  WHERE kind = 'past_paper';

-- ── Storage: admin management of library-pdfs ───────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins can upload library PDFs" ON storage.objects;
  CREATE POLICY "Admins can upload library PDFs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'library-pdfs'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

  DROP POLICY IF EXISTS "Admins can update library PDFs" ON storage.objects;
  CREATE POLICY "Admins can update library PDFs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'library-pdfs'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

  DROP POLICY IF EXISTS "Admins can delete library PDFs" ON storage.objects;
  CREATE POLICY "Admins can delete library PDFs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'library-pdfs'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );
EXCEPTION WHEN OTHERS THEN
  -- storage schema may not be writable from the SQL editor; skip gracefully
  NULL;
END $$;
