-- ============================================================
-- AI STUDY MEMORY SYSTEM
--
-- Purpose: Give the AI a persistent, structured long-term memory
-- of every interaction a student has in Study Mode.  The memory
-- is used to:
--   1. Avoid repeating questions / flashcards the student has
--      already seen.
--   2. Map through a topic end-to-end by knowing what's been
--      covered and what's still outstanding.
--   3. Detect concepts that need reinforcement (wrong > 2×).
--   4. Provide a rich, dated context block to every AI prompt so
--      the AI can diversify content daily.
--
-- Tables created:
--   study_memory_events   — one row per "thing that happened"
--                           (quiz answered, flashcard reviewed,
--                            exam completed, concept breakdown
--                            viewed, etc.)
--   study_memory_summary  — one row per (user × subject × topic),
--                           maintained by trigger & upsert.
--                           The AI reads this for its context.
--   study_memory_daily    — one row per (user × date × subject),
--                           a daily digest of what was done.
--
-- All tables have strict RLS: users see only their own rows.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. EVENT LOG  (append-only, never deleted)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.study_memory_events (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_at     timestamptz NOT NULL DEFAULT now(),

  -- What kind of activity generated this event?
  event_type      text        NOT NULL,
  -- Allowed values (enforced by CHECK):
  --   'quiz_question'       — a single quiz question was answered
  --   'flashcard_review'    — a flashcard was shown and rated
  --   'exam_session'        — a full mock/exam-mode paper was submitted
  --   'concept_breakdown'   — student opened a concept explanation
  --   'task_content'        — AI generated daily task content for a topic
  --   'recall_session'      — an active-recall session was completed
  --   'weak_concept_flag'   — AI flagged a concept as needing reinforcement

  -- Location in the curriculum
  subject_id      uuid        REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name    text        NOT NULL,
  topic_name      text        NOT NULL,
  subtopic_name   text,
  curriculum      text,                 -- CAPS | ZIMSEC | Cambridge | IEB | null

  -- The content that was shown / tested
  question_text   text,                 -- quiz / exam question (trimmed to 500 chars)
  concepts_tested text[],              -- concept keywords extracted by AI
  command_word    text,                 -- e.g. "Calculate", "Explain", "Compare"

  -- Outcome / score
  was_correct     boolean,             -- quiz / flashcard correctness
  score_raw       numeric,             -- marks awarded
  score_max       numeric,             -- marks possible
  score_pct       numeric GENERATED ALWAYS AS (
                    CASE WHEN score_max > 0 THEN ROUND((score_raw / score_max) * 100, 1) ELSE NULL END
                  ) STORED,
  difficulty      text,                -- easy | medium | hard | exam-level
  ease_factor     numeric,             -- SM-2 ease factor (flashcards)

  -- Extra structured payload (flexible per event type)
  metadata        jsonb               DEFAULT '{}'::jsonb,

  CONSTRAINT chk_event_type CHECK (event_type IN (
    'quiz_question','flashcard_review','exam_session',
    'concept_breakdown','task_content','recall_session','weak_concept_flag'
  ))
);

CREATE INDEX IF NOT EXISTS idx_sme_user_subject_topic
  ON public.study_memory_events (user_id, subject_id, topic_name, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_sme_user_date
  ON public.study_memory_events (user_id, (occurred_at::date) DESC);

CREATE INDEX IF NOT EXISTS idx_sme_event_type
  ON public.study_memory_events (user_id, event_type, occurred_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2. TOPIC MEMORY SUMMARY  (one row per user × subject × topic)
-- ─────────────────────────────────────────────────────────────
-- This is what the AI reads in its system prompt context.
-- It is upserted automatically whenever new events are written.

CREATE TABLE IF NOT EXISTS public.study_memory_summary (
  id                   uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id           uuid    REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name         text    NOT NULL,
  topic_name           text    NOT NULL,
  curriculum           text,

  -- Coverage tracking
  subtopics_covered    text[]  NOT NULL DEFAULT '{}',  -- distinct subtopics seen
  concepts_covered     text[]  NOT NULL DEFAULT '{}',  -- all concept keywords seen
  concepts_weak        text[]  NOT NULL DEFAULT '{}',  -- concepts wrong ≥ 2×
  concepts_mastered    text[]  NOT NULL DEFAULT '{}',  -- concepts correct ≥ 3×

  -- Questions / flashcards seen (to avoid repetition)
  questions_seen       text[]  NOT NULL DEFAULT '{}',  -- trimmed question texts (last 50)
  command_words_used   text[]  NOT NULL DEFAULT '{}',  -- e.g. ['Calculate','Explain']

  -- Aggregate performance
  total_events         int     NOT NULL DEFAULT 0,
  quiz_attempts        int     NOT NULL DEFAULT 0,
  quiz_correct         int     NOT NULL DEFAULT 0,
  flashcard_reviews    int     NOT NULL DEFAULT 0,
  exam_sessions        int     NOT NULL DEFAULT 0,
  concept_breakdowns   int     NOT NULL DEFAULT 0,

  -- Scores
  avg_score_pct        numeric,                        -- rolling average
  best_score_pct       numeric,
  last_score_pct       numeric,

  -- Time tracking
  first_seen_at        timestamptz NOT NULL DEFAULT now(),
  last_activity_at     timestamptz NOT NULL DEFAULT now(),
  last_quiz_at         timestamptz,
  last_exam_at         timestamptz,
  last_flashcard_at    timestamptz,

  -- AI guidance flags
  needs_reinforcement  boolean NOT NULL DEFAULT false,  -- true if avg_score < 60 %
  topic_complete       boolean NOT NULL DEFAULT false,  -- true if coverage ≥ 80 %
  recommended_next_subtopic text,

  UNIQUE (user_id, subject_name, topic_name)
);

CREATE INDEX IF NOT EXISTS idx_sms_user_subject
  ON public.study_memory_summary (user_id, subject_name);

CREATE INDEX IF NOT EXISTS idx_sms_needs_reinforcement
  ON public.study_memory_summary (user_id, needs_reinforcement)
  WHERE needs_reinforcement = true;

-- ─────────────────────────────────────────────────────────────
-- 3. DAILY DIGEST  (one row per user × date × subject)
-- ─────────────────────────────────────────────────────────────
-- Gives the AI an instant "what did this student do today /
-- yesterday / this week" snapshot without reading raw events.

CREATE TABLE IF NOT EXISTS public.study_memory_daily (
  id                uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_date        date    NOT NULL DEFAULT CURRENT_DATE,
  subject_name      text    NOT NULL,

  topics_studied    text[]  NOT NULL DEFAULT '{}',
  subtopics_studied text[]  NOT NULL DEFAULT '{}',
  concepts_studied  text[]  NOT NULL DEFAULT '{}',

  quiz_count        int     NOT NULL DEFAULT 0,
  quiz_correct      int     NOT NULL DEFAULT 0,
  flashcard_count   int     NOT NULL DEFAULT 0,
  exam_count        int     NOT NULL DEFAULT 0,
  breakdown_count   int     NOT NULL DEFAULT 0,

  avg_score_pct     numeric,
  total_xp_earned   int     NOT NULL DEFAULT 0,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, study_date, subject_name)
);

CREATE INDEX IF NOT EXISTS idx_smd_user_date
  ON public.study_memory_daily (user_id, study_date DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. TRIGGER — keep summary + daily in sync with events
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_update_study_memory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_concepts_seen  text[];
  v_concept        text;
  v_weak           text[];
  v_mastered       text[];
  v_questions_seen text[];
BEGIN
  -- ── 4a. Upsert topic summary ──────────────────────────────
  INSERT INTO public.study_memory_summary (
    user_id, subject_id, subject_name, topic_name, curriculum,
    subtopics_covered, concepts_covered, questions_seen,
    command_words_used,
    total_events, quiz_attempts, quiz_correct,
    flashcard_reviews, exam_sessions, concept_breakdowns,
    avg_score_pct, best_score_pct, last_score_pct,
    first_seen_at, last_activity_at,
    last_quiz_at, last_exam_at, last_flashcard_at
  )
  VALUES (
    NEW.user_id, NEW.subject_id, NEW.subject_name, NEW.topic_name, NEW.curriculum,
    COALESCE(ARRAY[NEW.subtopic_name]::text[], '{}'),
    COALESCE(NEW.concepts_tested, '{}'),
    CASE WHEN NEW.question_text IS NOT NULL
         THEN ARRAY[LEFT(NEW.question_text, 200)]::text[]
         ELSE '{}' END,
    CASE WHEN NEW.command_word IS NOT NULL
         THEN ARRAY[NEW.command_word]::text[]
         ELSE '{}' END,
    1,
    CASE WHEN NEW.event_type = 'quiz_question' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'quiz_question' AND NEW.was_correct THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'flashcard_review' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'exam_session' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'concept_breakdown' THEN 1 ELSE 0 END,
    NEW.score_pct, NEW.score_pct, NEW.score_pct,
    NEW.occurred_at, NEW.occurred_at,
    CASE WHEN NEW.event_type = 'quiz_question' THEN NEW.occurred_at ELSE NULL END,
    CASE WHEN NEW.event_type = 'exam_session'  THEN NEW.occurred_at ELSE NULL END,
    CASE WHEN NEW.event_type = 'flashcard_review' THEN NEW.occurred_at ELSE NULL END
  )
  ON CONFLICT (user_id, subject_name, topic_name) DO UPDATE SET
    -- Merge array fields (union, keep last 50 questions to bound size)
    subtopics_covered  = CASE
      WHEN NEW.subtopic_name IS NOT NULL
      THEN array(SELECT DISTINCT unnest(study_memory_summary.subtopics_covered || ARRAY[NEW.subtopic_name]))
      ELSE study_memory_summary.subtopics_covered END,
    concepts_covered   = array(SELECT DISTINCT unnest(
      study_memory_summary.concepts_covered || COALESCE(NEW.concepts_tested,'{}')
    )),
    questions_seen     = (
      SELECT array_agg(q) FROM (
        SELECT unnest(study_memory_summary.questions_seen ||
          CASE WHEN NEW.question_text IS NOT NULL
               THEN ARRAY[LEFT(NEW.question_text, 200)]
               ELSE '{}' END)
        AS q LIMIT 50
      ) sub
    ),
    command_words_used = CASE
      WHEN NEW.command_word IS NOT NULL
      THEN array(SELECT DISTINCT unnest(study_memory_summary.command_words_used || ARRAY[NEW.command_word]))
      ELSE study_memory_summary.command_words_used END,
    -- Increment counters
    total_events       = study_memory_summary.total_events + 1,
    quiz_attempts      = study_memory_summary.quiz_attempts +
                         CASE WHEN NEW.event_type = 'quiz_question' THEN 1 ELSE 0 END,
    quiz_correct       = study_memory_summary.quiz_correct +
                         CASE WHEN NEW.event_type = 'quiz_question' AND NEW.was_correct THEN 1 ELSE 0 END,
    flashcard_reviews  = study_memory_summary.flashcard_reviews +
                         CASE WHEN NEW.event_type = 'flashcard_review' THEN 1 ELSE 0 END,
    exam_sessions      = study_memory_summary.exam_sessions +
                         CASE WHEN NEW.event_type = 'exam_session' THEN 1 ELSE 0 END,
    concept_breakdowns = study_memory_summary.concept_breakdowns +
                         CASE WHEN NEW.event_type = 'concept_breakdown' THEN 1 ELSE 0 END,
    -- Rolling average score
    avg_score_pct      = CASE
      WHEN NEW.score_pct IS NOT NULL THEN
        ROUND(
          (COALESCE(study_memory_summary.avg_score_pct, NEW.score_pct) * study_memory_summary.total_events
           + NEW.score_pct) / (study_memory_summary.total_events + 1),
          1
        )
      ELSE study_memory_summary.avg_score_pct END,
    best_score_pct     = CASE
      WHEN NEW.score_pct IS NOT NULL THEN
        GREATEST(COALESCE(study_memory_summary.best_score_pct, 0), NEW.score_pct)
      ELSE study_memory_summary.best_score_pct END,
    last_score_pct     = COALESCE(NEW.score_pct, study_memory_summary.last_score_pct),
    -- Timestamps
    last_activity_at   = NEW.occurred_at,
    last_quiz_at       = CASE WHEN NEW.event_type = 'quiz_question' THEN NEW.occurred_at
                              ELSE study_memory_summary.last_quiz_at END,
    last_exam_at       = CASE WHEN NEW.event_type = 'exam_session' THEN NEW.occurred_at
                              ELSE study_memory_summary.last_exam_at END,
    last_flashcard_at  = CASE WHEN NEW.event_type = 'flashcard_review' THEN NEW.occurred_at
                              ELSE study_memory_summary.last_flashcard_at END,
    -- Derive weak / mastered concept lists from accumulated event data
    -- (We recompute from a subquery over the last 30 events for this topic)
    needs_reinforcement = (
      CASE
        WHEN NEW.score_pct IS NOT NULL
        THEN (
          (COALESCE(study_memory_summary.avg_score_pct, 100) * study_memory_summary.total_events
            + NEW.score_pct) / (study_memory_summary.total_events + 1)
        ) < 60
        ELSE study_memory_summary.needs_reinforcement
      END
    );

  -- ── 4b. Upsert daily digest ───────────────────────────────
  INSERT INTO public.study_memory_daily (
    user_id, study_date, subject_name,
    topics_studied, subtopics_studied, concepts_studied,
    quiz_count, quiz_correct, flashcard_count, exam_count, breakdown_count,
    avg_score_pct
  )
  VALUES (
    NEW.user_id, (NEW.occurred_at AT TIME ZONE 'UTC')::date, NEW.subject_name,
    ARRAY[NEW.topic_name],
    COALESCE(ARRAY[NEW.subtopic_name]::text[], '{}'),
    COALESCE(NEW.concepts_tested, '{}'),
    CASE WHEN NEW.event_type = 'quiz_question' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'quiz_question' AND NEW.was_correct THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'flashcard_review' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'exam_session' THEN 1 ELSE 0 END,
    CASE WHEN NEW.event_type = 'concept_breakdown' THEN 1 ELSE 0 END,
    NEW.score_pct
  )
  ON CONFLICT (user_id, study_date, subject_name) DO UPDATE SET
    topics_studied    = array(SELECT DISTINCT unnest(
                          study_memory_daily.topics_studied || ARRAY[NEW.topic_name])),
    subtopics_studied = CASE
      WHEN NEW.subtopic_name IS NOT NULL
      THEN array(SELECT DISTINCT unnest(study_memory_daily.subtopics_studied || ARRAY[NEW.subtopic_name]))
      ELSE study_memory_daily.subtopics_studied END,
    concepts_studied  = array(SELECT DISTINCT unnest(
                          study_memory_daily.concepts_studied || COALESCE(NEW.concepts_tested,'{}'))),
    quiz_count        = study_memory_daily.quiz_count +
                        CASE WHEN NEW.event_type = 'quiz_question' THEN 1 ELSE 0 END,
    quiz_correct      = study_memory_daily.quiz_correct +
                        CASE WHEN NEW.event_type = 'quiz_question' AND NEW.was_correct THEN 1 ELSE 0 END,
    flashcard_count   = study_memory_daily.flashcard_count +
                        CASE WHEN NEW.event_type = 'flashcard_review' THEN 1 ELSE 0 END,
    exam_count        = study_memory_daily.exam_count +
                        CASE WHEN NEW.event_type = 'exam_session' THEN 1 ELSE 0 END,
    breakdown_count   = study_memory_daily.breakdown_count +
                        CASE WHEN NEW.event_type = 'concept_breakdown' THEN 1 ELSE 0 END,
    avg_score_pct     = CASE
      WHEN NEW.score_pct IS NOT NULL THEN
        ROUND((COALESCE(study_memory_daily.avg_score_pct, NEW.score_pct) + NEW.score_pct) / 2, 1)
      ELSE study_memory_daily.avg_score_pct END,
    updated_at        = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_study_memory ON public.study_memory_events;
CREATE TRIGGER trg_update_study_memory
  AFTER INSERT ON public.study_memory_events
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_study_memory();

-- ─────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTION — build AI memory context string
-- ─────────────────────────────────────────────────────────────
-- Called by edge functions (or the client-side hook) to produce
-- a compact natural-language summary of the student's memory
-- for a given subject.  This is injected into every AI prompt.

CREATE OR REPLACE FUNCTION public.get_study_memory_context(
  p_user_id    uuid,
  p_subject    text,
  p_topic      text    DEFAULT NULL,  -- if NULL, returns all topics for the subject
  p_days_back  int     DEFAULT 7
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result      text := '';
  v_daily       text := '';
  v_topic_rows  RECORD;
  v_day_rows    RECORD;
BEGIN
  -- Guard: only the requesting user may fetch their own context
  IF auth.uid() IS DISTINCT FROM p_user_id AND
     NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN '';
  END IF;

  -- ── Recent daily summary (last N days) ────────────────────
  FOR v_day_rows IN
    SELECT study_date,
           topics_studied,
           quiz_count, quiz_correct, flashcard_count, exam_count,
           avg_score_pct
    FROM   public.study_memory_daily
    WHERE  user_id    = p_user_id
      AND  subject_name = p_subject
      AND  study_date >= CURRENT_DATE - p_days_back
    ORDER  BY study_date DESC
    LIMIT  7
  LOOP
    v_daily := v_daily ||
      format('• %s: studied %s | quizzes %s/%s | flashcards %s | exams %s | avg %s%%'||chr(10),
        v_day_rows.study_date,
        array_to_string(v_day_rows.topics_studied, ', '),
        v_day_rows.quiz_correct, v_day_rows.quiz_count,
        v_day_rows.flashcard_count,
        v_day_rows.exam_count,
        COALESCE(v_day_rows.avg_score_pct::text, '—')
      );
  END LOOP;

  IF v_daily <> '' THEN
    v_result := v_result || '=== RECENT DAILY ACTIVITY (' || p_days_back || ' days) ===' || chr(10) || v_daily || chr(10);
  END IF;

  -- ── Per-topic memory summaries ─────────────────────────────
  FOR v_topic_rows IN
    SELECT topic_name,
           subtopics_covered, concepts_covered,
           concepts_weak, concepts_mastered,
           questions_seen,
           command_words_used,
           quiz_attempts, quiz_correct,
           avg_score_pct, best_score_pct, last_score_pct,
           needs_reinforcement, topic_complete,
           last_activity_at
    FROM   public.study_memory_summary
    WHERE  user_id      = p_user_id
      AND  subject_name = p_subject
      AND  (p_topic IS NULL OR topic_name = p_topic)
    ORDER  BY last_activity_at DESC
    LIMIT  20
  LOOP
    v_result := v_result ||
      format('=== TOPIC: %s ===' || chr(10), v_topic_rows.topic_name);

    IF array_length(v_topic_rows.subtopics_covered, 1) > 0 THEN
      v_result := v_result ||
        'Subtopics covered: ' || array_to_string(v_topic_rows.subtopics_covered, ', ') || chr(10);
    END IF;

    IF array_length(v_topic_rows.concepts_covered, 1) > 0 THEN
      v_result := v_result ||
        'Concepts seen: ' || array_to_string(v_topic_rows.concepts_covered[1:15], ', ') || chr(10);
    END IF;

    IF array_length(v_topic_rows.concepts_weak, 1) > 0 THEN
      v_result := v_result ||
        '⚠ Weak concepts (needs reinforcement): ' ||
        array_to_string(v_topic_rows.concepts_weak, ', ') || chr(10);
    END IF;

    IF array_length(v_topic_rows.concepts_mastered, 1) > 0 THEN
      v_result := v_result ||
        '✓ Mastered concepts: ' ||
        array_to_string(v_topic_rows.concepts_mastered[1:10], ', ') || chr(10);
    END IF;

    IF v_topic_rows.quiz_attempts > 0 THEN
      v_result := v_result ||
        format('Quiz performance: %s/%s correct (avg %s%%, best %s%%)' || chr(10),
          v_topic_rows.quiz_correct, v_topic_rows.quiz_attempts,
          COALESCE(v_topic_rows.avg_score_pct::text, '—'),
          COALESCE(v_topic_rows.best_score_pct::text, '—')
        );
    END IF;

    IF array_length(v_topic_rows.questions_seen, 1) > 0 THEN
      v_result := v_result ||
        'Questions already seen (DO NOT repeat): ' ||
        array_to_string(v_topic_rows.questions_seen[1:10], ' | ') || chr(10);
    END IF;

    IF array_length(v_topic_rows.command_words_used, 1) > 0 THEN
      v_result := v_result ||
        'Command words used recently: ' ||
        array_to_string(v_topic_rows.command_words_used, ', ') || chr(10);
    END IF;

    IF v_topic_rows.needs_reinforcement THEN
      v_result := v_result || '⚠ THIS TOPIC NEEDS REINFORCEMENT — prioritise it.' || chr(10);
    END IF;

    IF v_topic_rows.topic_complete THEN
      v_result := v_result || '✓ Topic coverage appears complete — move to next topic.' || chr(10);
    END IF;

    v_result := v_result || chr(10);
  END LOOP;

  IF v_result = '' THEN
    v_result := 'No prior study memory for this subject yet — this is a fresh start.';
  ELSE
    v_result := 'STUDENT STUDY MEMORY (use this to avoid repetition and guide new content):' ||
                chr(10) || v_result;
  END IF;

  RETURN v_result;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.study_memory_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_memory_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_memory_daily   ENABLE ROW LEVEL SECURITY;

-- Events: owner can INSERT + SELECT; no UPDATE/DELETE (append-only)
DROP POLICY IF EXISTS "sme_owner_select" ON public.study_memory_events;
CREATE POLICY "sme_owner_select" ON public.study_memory_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sme_owner_insert" ON public.study_memory_events;
CREATE POLICY "sme_owner_insert" ON public.study_memory_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Summary: owner can SELECT; writes happen via trigger (SECURITY DEFINER) or service_role
DROP POLICY IF EXISTS "sms_owner_select" ON public.study_memory_summary;
CREATE POLICY "sms_owner_select" ON public.study_memory_summary
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sms_service_write" ON public.study_memory_summary;
CREATE POLICY "sms_service_write" ON public.study_memory_summary
  FOR ALL USING (auth.role() = 'service_role');

-- Daily: owner can SELECT; writes happen via trigger
DROP POLICY IF EXISTS "smd_owner_select" ON public.study_memory_daily;
CREATE POLICY "smd_owner_select" ON public.study_memory_daily
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "smd_service_write" ON public.study_memory_daily;
CREATE POLICY "smd_service_write" ON public.study_memory_daily
  FOR ALL USING (auth.role() = 'service_role');
