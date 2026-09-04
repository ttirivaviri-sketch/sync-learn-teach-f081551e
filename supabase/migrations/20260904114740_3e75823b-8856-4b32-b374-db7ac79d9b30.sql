-- 1) Subject coverage audit writer -------------------------------------------
GRANT SELECT ON public.subject_coverage_audit TO authenticated;
GRANT ALL ON public.subject_coverage_audit TO service_role;

CREATE OR REPLACE FUNCTION public.recompute_subject_coverage(_subject_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _total int := 0;
  _covered int := 0;
  _mastered int := 0;
BEGIN
  SELECT s.user_id,
         GREATEST(
           COALESCE(jsonb_array_length(CASE WHEN jsonb_typeof(s.topics) = 'array' THEN s.topics ELSE '[]'::jsonb END), 0),
           0)
    INTO _user_id, _total
  FROM public.subjects s
  WHERE s.id = _subject_id;

  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) FILTER (WHERE tm.total_attempts > 0 OR tm.attempts > 0),
         COUNT(*) FILTER (WHERE tm.mastery_percentage >= 80)
    INTO _covered, _mastered
  FROM public.topic_mastery tm
  WHERE tm.subject_id = _subject_id;

  IF _total < _covered THEN
    _total := _covered;
  END IF;

  INSERT INTO public.subject_coverage_audit
    (subject_id, user_id, total_topics, covered_topics, mastered_topics, last_audit_at)
  VALUES (_subject_id, _user_id, _total, _covered, _mastered, now())
  ON CONFLICT (subject_id) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        total_topics = EXCLUDED.total_topics,
        covered_topics = EXCLUDED.covered_topics,
        mastered_topics = EXCLUDED.mastered_topics,
        last_audit_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_subject_coverage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sid uuid;
BEGIN
  IF TG_TABLE_NAME = 'subjects' THEN
    _sid := COALESCE(NEW.id, OLD.id);
  ELSE
    _sid := COALESCE(NEW.subject_id, OLD.subject_id);
  END IF;
  IF _sid IS NOT NULL THEN
    PERFORM public.recompute_subject_coverage(_sid);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_topic_mastery_coverage ON public.topic_mastery;
CREATE TRIGGER trg_topic_mastery_coverage
AFTER INSERT OR UPDATE OR DELETE ON public.topic_mastery
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_subject_coverage();

DROP TRIGGER IF EXISTS trg_subjects_coverage ON public.subjects;
CREATE TRIGGER trg_subjects_coverage
AFTER INSERT OR UPDATE OF topics ON public.subjects
FOR EACH ROW EXECUTE FUNCTION public.trg_recompute_subject_coverage();

-- Backfill existing subjects
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.subjects LOOP
    PERFORM public.recompute_subject_coverage(r.id);
  END LOOP;
END $$;

-- 2) Template verification fields --------------------------------------------
ALTER TABLE public.curriculum_topic_templates
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS coverage_score numeric,
  ADD COLUMN IF NOT EXISTS verification_report jsonb,
  ADD COLUMN IF NOT EXISTS verified_against text,
  ADD COLUMN IF NOT EXISTS last_verification_at timestamptz;
