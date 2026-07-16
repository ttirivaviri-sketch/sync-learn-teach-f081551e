-- ═══════════════════════════════════════════════════════════════════════════
-- Tutor-lesson mastery evidence + companion effectiveness analytics (tier 5)
--
--   §1  lesson_topic_mapping → 'tutor_note' evidence in the mastery ledger.
--       process-lesson-recording already AI-maps each tutor lesson to a
--       topic, concepts[] and weak_concepts[] with a coverage score — but
--       none of it reached the mastery model. Now covered concepts add
--       positive evidence and weak concepts add negative evidence.
--
--   §2  companion_suggestion_effectiveness view — aggregates the
--       companion_interactions telemetry (PR #70) into per-kind funnel
--       stats (shown → clicked/booked vs dismissed) so the recommendation
--       engine and future dashboards can rank suggestion kinds by what
--       students actually engage with.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1 Tutor lessons → mastery ledger ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_lesson_mastery_evidence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject   text;
  v_topic     text;
  v_conf      numeric;
  v_coverage  numeric;
  v_concept   text;
  v_weak      text[];
BEGIN
  BEGIN
    v_subject  := COALESCE(NULLIF(trim(NEW.subject_name), ''), 'General');
    v_topic    := COALESCE(NULLIF(trim(NEW.topic), ''), 'Tutor lesson');
    -- coverage_score is 0..1; treat missing as neutral-positive.
    v_coverage := LEAST(GREATEST(COALESCE(NEW.coverage_score, 0.6), 0), 1);
    -- Blend the mapper's own confidence into the evidence confidence,
    -- capped below teacher-marked homework (0.85).
    v_conf     := LEAST(GREATEST(COALESCE(NEW.confidence, 0.6), 0.3), 0.8);
    v_weak     := COALESCE(NEW.weak_concepts, ARRAY[]::text[]);

    -- Concepts covered in the lesson: positive evidence scaled by coverage.
    -- A concept flagged weak is skipped here (handled below).
    IF NEW.concepts IS NOT NULL THEN
      FOREACH v_concept IN ARRAY NEW.concepts LOOP
        IF v_concept IS NULL OR trim(v_concept) = '' OR trim(v_concept) = ANY (v_weak) THEN
          CONTINUE;
        END IF;
        INSERT INTO public.learning_concept_mastery_ledger
          (user_id, subject_id, subject_name, topic_name, concept_name,
           evidence_type, evidence_source, score_delta, confidence, metadata)
        VALUES
          (NEW.learner_id, NEW.subject_id, v_subject, v_topic, trim(v_concept),
           'tutor_note', 'lesson_topic_mapping',
           round((v_coverage * 0.5)::numeric, 3),          -- gentle positive: 0 .. +0.5
           v_conf,
           jsonb_build_object(
             'booking_id',     NEW.booking_id,
             'mapping_id',     NEW.id,
             'coverage_score', NEW.coverage_score,
             'signal',         'covered'
           ));
      END LOOP;
    END IF;

    -- Concepts the tutor/AI flagged as weak: negative evidence.
    FOREACH v_concept IN ARRAY v_weak LOOP
      IF v_concept IS NULL OR trim(v_concept) = '' THEN
        CONTINUE;
      END IF;
      INSERT INTO public.learning_concept_mastery_ledger
        (user_id, subject_id, subject_name, topic_name, concept_name,
         evidence_type, evidence_source, score_delta, confidence, metadata)
      VALUES
        (NEW.learner_id, NEW.subject_id, v_subject, v_topic, trim(v_concept),
         'tutor_note', 'lesson_topic_mapping',
         -0.4,
         v_conf,
         jsonb_build_object(
           'booking_id',     NEW.booking_id,
           'mapping_id',     NEW.id,
           'coverage_score', NEW.coverage_score,
           'signal',         'weak'
         ));
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'record_lesson_mastery_evidence skipped: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lesson_mastery_evidence ON public.lesson_topic_mapping;
CREATE TRIGGER trg_lesson_mastery_evidence
  AFTER INSERT
  ON public.lesson_topic_mapping
  FOR EACH ROW
  EXECUTE FUNCTION public.record_lesson_mastery_evidence();

-- ─── §2a Fix companion_interactions kind constraint ─────────────────────────
-- The original CHECK only allowed category names ('resource','tutor',
-- 'homework','encourage') but the client records the real suggestion kinds
-- ('struggle_video', 'homework_book', …), so every insert was silently
-- rejected. Widen the constraint to accept both vocabularies.

ALTER TABLE public.companion_interactions
  DROP CONSTRAINT IF EXISTS companion_interactions_suggestion_kind_check;

ALTER TABLE public.companion_interactions
  ADD CONSTRAINT companion_interactions_suggestion_kind_check
  CHECK (suggestion_kind IN (
    'struggle_video', 'struggle_book', 'struggle_tutor',
    'homework_video', 'homework_book',
    'mastery_video', 'mastery_book',
    'resource', 'tutor', 'homework', 'encourage'
  ));

-- ─── §2b Companion suggestion effectiveness ─────────────────────────────────
-- Per-user, per-kind funnel over the last 60 days. security_invoker keeps
-- the underlying table's own-rows RLS in force, so students only see their
-- own stats (service role / definer contexts see everything).

CREATE OR REPLACE VIEW public.companion_suggestion_effectiveness
WITH (security_invoker = true) AS
SELECT
  user_id,
  suggestion_kind,
  count(*) FILTER (WHERE event = 'shown')::int     AS shown_count,
  count(*) FILTER (WHERE event = 'clicked')::int   AS clicked_count,
  count(*) FILTER (WHERE event = 'booked')::int    AS booked_count,
  count(*) FILTER (WHERE event = 'dismissed')::int AS dismissed_count,
  CASE WHEN count(*) FILTER (WHERE event = 'shown') > 0
       THEN round(
         (count(*) FILTER (WHERE event IN ('clicked', 'booked')))::numeric
         / count(*) FILTER (WHERE event = 'shown'), 3)
  END AS engagement_rate,
  max(created_at) AS last_interaction_at
FROM public.companion_interactions
WHERE created_at >= now() - interval '60 days'
GROUP BY user_id, suggestion_kind;

GRANT SELECT ON public.companion_suggestion_effectiveness TO authenticated;
