ALTER TABLE public.library_system_resources
  ADD COLUMN IF NOT EXISTS image_url    TEXT,
  ADD COLUMN IF NOT EXISTS diagram_spec JSONB;

ALTER TABLE public.library_system_resources
  DROP CONSTRAINT IF EXISTS library_system_resources_kind_check;
ALTER TABLE public.library_system_resources
  ADD CONSTRAINT library_system_resources_kind_check
  CHECK (kind IN ('textbook','past_paper','syllabus','video','guide','diagram'));

ALTER TABLE public.library_system_resources
  DROP CONSTRAINT IF EXISTS library_system_resources_url_required;
ALTER TABLE public.library_system_resources
  ADD CONSTRAINT library_system_resources_url_required
  CHECK (
    (kind = 'video'   AND video_url IS NOT NULL AND video_url <> '')
    OR (kind = 'diagram' AND (
          (image_url IS NOT NULL AND image_url <> '')
          OR diagram_spec IS NOT NULL
        ))
    OR (kind NOT IN ('video','diagram') AND pdf_url IS NOT NULL AND pdf_url <> '')
  );

CREATE OR REPLACE FUNCTION public.library_resource_classify()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  video_re TEXT := '(youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.(mp4|webm|mov|m4v)(\?|$))';
BEGIN
  IF NEW.kind = 'diagram' THEN
    IF (NEW.image_url IS NULL OR NEW.image_url = '') AND NEW.diagram_spec IS NULL THEN
      RAISE EXCEPTION 'library_system_resources: kind=diagram requires image_url or diagram_spec';
    END IF;
    RETURN NEW;
  END IF;

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

CREATE INDEX IF NOT EXISTS idx_library_resources_diagram
  ON public.library_system_resources (created_at DESC)
  WHERE kind = 'diagram';