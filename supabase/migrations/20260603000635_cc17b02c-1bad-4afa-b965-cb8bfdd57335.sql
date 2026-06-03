-- Phase 5: Concept-level mastery view
-- Computes per-(user, subject, concept) mastery using an EWMA over the last
-- 10 attempts in `concept_attempts`. Surfaces a `weakness_score` (1 - mastery)
-- so existing reads against `weak_concepts.weakness_score` map cleanly.
--
-- We use a plain VIEW (not MATERIALIZED) so it's always fresh; the dataset
-- is per-user and the underlying table has user_id indexed so reads stay cheap.

CREATE OR REPLACE VIEW public.concept_mastery_v AS
WITH ranked AS (
    SELECT
        ca.user_id,
        ca.subject_name,
        ca.concept_id,
        ca.concept_label,
        ca.topic,
        ca.was_correct,
        ca.created_at,
        ROW_NUMBER() OVER (
            PARTITION BY ca.user_id, ca.subject_name, COALESCE(ca.concept_id::text, ca.concept_label)
            ORDER BY ca.created_at DESC
        ) AS rn
    FROM public.concept_attempts ca
),
last_10 AS (
    SELECT * FROM ranked WHERE rn <= 10
),
weighted AS (
    SELECT
        user_id,
        subject_name,
        concept_id,
        concept_label,
        topic,
        -- EWMA: weight = 0.85^(rn-1). Sum(correct * weight) / Sum(weight)
        SUM((CASE WHEN was_correct THEN 1.0 ELSE 0.0 END) * POWER(0.85, rn - 1)) AS num,
        SUM(POWER(0.85, rn - 1))                                                 AS den,
        COUNT(*)                                                                 AS attempts,
        MAX(created_at)                                                          AS last_seen_at
    FROM last_10
    GROUP BY user_id, subject_name, concept_id, concept_label, topic
)
SELECT
    user_id,
    subject_name,
    concept_id,
    concept_label,
    topic,
    LEAST(1.0, num / NULLIF(den, 0))                          AS mastery_score,
    GREATEST(0.0, 1.0 - (num / NULLIF(den, 0)))               AS weakness_score,
    attempts,
    last_seen_at
FROM weighted;

GRANT SELECT ON public.concept_mastery_v TO authenticated;
GRANT SELECT ON public.concept_mastery_v TO service_role;

-- Trigger: when a concept_attempt is logged, also bump the legacy
-- `weak_concepts` table so older code paths keep functioning. The trigger is
-- additive — never throws, never blocks the insert.
CREATE OR REPLACE FUNCTION public.sync_weak_concepts_from_attempt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_label   text;
    v_score   numeric;
BEGIN
    v_label := COALESCE(NEW.concept_label, NEW.concept_id::text);
    IF v_label IS NULL OR NEW.subject_name IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT weakness_score
      INTO v_score
      FROM public.concept_mastery_v
     WHERE user_id      = NEW.user_id
       AND subject_name = NEW.subject_name
       AND concept_label = v_label
     LIMIT 1;

    IF v_score IS NULL THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.weak_concepts (
        user_id, subject, curriculum, concept, topic,
        weakness_score, last_seen_at, concept_id
    )
    VALUES (
        NEW.user_id, NEW.subject_name, 'ZIMSEC', v_label, NEW.topic,
        v_score, NEW.created_at, NEW.concept_id
    )
    ON CONFLICT (user_id, subject, curriculum, concept)
    DO UPDATE SET
        weakness_score = EXCLUDED.weakness_score,
        last_seen_at   = EXCLUDED.last_seen_at,
        concept_id     = COALESCE(EXCLUDED.concept_id, weak_concepts.concept_id);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Never block the attempt insert
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_weak_concepts ON public.concept_attempts;
CREATE TRIGGER trg_sync_weak_concepts
AFTER INSERT ON public.concept_attempts
FOR EACH ROW
EXECUTE FUNCTION public.sync_weak_concepts_from_attempt();