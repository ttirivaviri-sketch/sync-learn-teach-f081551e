
-- 1. Add video_url column and relax pdf_url NOT NULL
ALTER TABLE public.library_system_resources
  ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE public.library_system_resources
  ALTER COLUMN pdf_url DROP NOT NULL;

-- 2. Backfill: move video-like pdf_url into video_url and set kind=video
UPDATE public.library_system_resources
SET video_url = pdf_url,
    pdf_url = NULL,
    kind = 'video'
WHERE pdf_url ~* '(youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.(mp4|webm|mov|m4v)(\?|$))';

-- 3. Normalise unknown kinds
UPDATE public.library_system_resources
SET kind = 'textbook'
WHERE kind IS NULL OR kind NOT IN ('textbook','past_paper','syllabus','video','guide');

-- 4. Default grade levels for videos
UPDATE public.library_system_resources
SET grade_levels = ARRAY['8','9','10','11','12']
WHERE kind = 'video'
  AND (grade_levels IS NULL OR array_length(grade_levels, 1) IS NULL);

-- 5. Constraint
ALTER TABLE public.library_system_resources
  DROP CONSTRAINT IF EXISTS library_system_resources_kind_check;
ALTER TABLE public.library_system_resources
  ADD CONSTRAINT library_system_resources_kind_check
  CHECK (kind IN ('textbook','past_paper','syllabus','video','guide'));

-- 6. Require at least one URL
ALTER TABLE public.library_system_resources
  DROP CONSTRAINT IF EXISTS library_system_resources_url_required;
ALTER TABLE public.library_system_resources
  ADD CONSTRAINT library_system_resources_url_required
  CHECK (
    (kind = 'video' AND video_url IS NOT NULL AND video_url <> '')
    OR (kind <> 'video' AND pdf_url IS NOT NULL AND pdf_url <> '')
  );

-- 7. Classification trigger
CREATE OR REPLACE FUNCTION public.library_resource_classify()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  video_re TEXT := '(youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.(mp4|webm|mov|m4v)(\?|$))';
BEGIN
  IF NEW.pdf_url IS NOT NULL AND NEW.pdf_url ~* video_re THEN
    NEW.video_url := COALESCE(NEW.video_url, NEW.pdf_url);
    NEW.pdf_url := NULL;
    NEW.kind := 'video';
  END IF;

  IF NEW.video_url IS NOT NULL AND NEW.video_url <> '' THEN
    NEW.kind := 'video';
  END IF;

  IF NEW.kind = 'video' THEN
    IF NEW.video_url IS NULL OR NEW.video_url = '' THEN
      RAISE EXCEPTION 'library_system_resources: kind=video requires video_url';
    END IF;
  ELSE
    IF NEW.pdf_url IS NULL OR NEW.pdf_url = '' THEN
      RAISE EXCEPTION 'library_system_resources: kind=% requires pdf_url', NEW.kind;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS library_resource_classify_trg ON public.library_system_resources;
CREATE TRIGGER library_resource_classify_trg
  BEFORE INSERT OR UPDATE ON public.library_system_resources
  FOR EACH ROW EXECUTE FUNCTION public.library_resource_classify();
