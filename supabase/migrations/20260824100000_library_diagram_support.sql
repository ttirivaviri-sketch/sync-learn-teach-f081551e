-- ─────────────────────────────────────────────────────────────────────────────
-- Library Diagram Support
--
-- Adds a new resource kind 'diagram' to library_system_resources:
--   • image_url     — public URL of the rendered diagram (generated lazily)
--   • diagram_spec  — structured JSON ground-truth of what the diagram shows.
--                     Written FIRST (spec-first pipeline); the image is
--                     rendered from the spec by the generate-library-diagram
--                     edge function on first open, then cached forever.
--
-- The spec doubles as the grounding context for the explain-diagram AI chat,
-- so explanations only ever discuss what is actually in the picture, at the
-- depth the learner's curriculum/level requires (spec.depth_notes).
--
-- Additive only: no existing rows, constraints on other kinds, or trigger
-- behaviour for video/pdf resources are changed.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. New columns (nullable — invisible to all existing queries)
ALTER TABLE public.library_system_resources
  ADD COLUMN IF NOT EXISTS image_url    TEXT,
  ADD COLUMN IF NOT EXISTS diagram_spec JSONB;

-- 2. Admit 'diagram' into the kind constraint
ALTER TABLE public.library_system_resources
  DROP CONSTRAINT IF EXISTS library_system_resources_kind_check;
ALTER TABLE public.library_system_resources
  ADD CONSTRAINT library_system_resources_kind_check
  CHECK (kind IN ('textbook','past_paper','syllabus','video','guide','diagram'));

-- 3. URL requirement: diagrams are valid with EITHER a rendered image OR a
--    spec awaiting render. All other kinds keep their existing rules.
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

-- 4. Classification trigger: teach it the diagram branch.
--    (Same function body as 20260618162720, plus the diagram case.)
CREATE OR REPLACE FUNCTION public.library_resource_classify()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  video_re TEXT := '(youtube\.com|youtu\.be|vimeo\.com|loom\.com|\.(mp4|webm|mov|m4v)(\?|$))';
BEGIN
  -- Diagrams are exempt from the video/pdf reclassification below.
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

-- 5. Public storage bucket for rendered diagram PNGs (service-role writes only;
--    bucket-level public read, same model as question-diagrams).
INSERT INTO storage.buckets (id, name, public)
VALUES ('library-diagrams', 'library-diagrams', true)
ON CONFLICT (id) DO NOTHING;

-- 6. Helpful partial index for the library fetch path
CREATE INDEX IF NOT EXISTS idx_library_resources_diagram
  ON public.library_system_resources (created_at DESC)
  WHERE kind = 'diagram';
