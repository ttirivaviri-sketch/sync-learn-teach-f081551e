-- Phase 1: Schema foundation for provenance, concept-level mastery, and novelty engine

-- Enable pgvector for semantic novelty (Phase 4 prep, but enabled now)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Canonical concept registry
CREATE TABLE IF NOT EXISTS public.concepts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   uuid,
  curriculum   text NOT NULL,
  grade        text,
  subject_name text NOT NULL,
  topic        text NOT NULL,
  subtopic     text,
  label        text NOT NULL,
  slug         text NOT NULL,
  syllabus_ref text,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curriculum, subject_name, slug)
);

CREATE INDEX IF NOT EXISTS idx_concepts_subject_topic
  ON public.concepts(curriculum, subject_name, topic);

GRANT SELECT ON public.concepts TO authenticated;
GRANT ALL ON public.concepts TO service_role;

ALTER TABLE public.concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read concepts"
  ON public.concepts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage concepts"
  ON public.concepts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 2. Unified per-attempt concept log
CREATE TABLE IF NOT EXISTS public.concept_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL,
  concept_id      uuid REFERENCES public.concepts(id) ON DELETE SET NULL,
  concept_label   text NOT NULL,
  subject_name    text NOT NULL,
  topic           text,
  surface         text NOT NULL,
  was_correct     boolean NOT NULL DEFAULT false,
  marks_awarded   numeric NOT NULL DEFAULT 0,
  marks_possible  numeric NOT NULL DEFAULT 0,
  source_id       uuid,
  source_table    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_attempts_user_concept
  ON public.concept_attempts(user_id, concept_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concept_attempts_user_label
  ON public.concept_attempts(user_id, subject_name, concept_label, created_at DESC);

GRANT SELECT, INSERT ON public.concept_attempts TO authenticated;
GRANT ALL ON public.concept_attempts TO service_role;

ALTER TABLE public.concept_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own concept attempts"
  ON public.concept_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own concept attempts"
  ON public.concept_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 3. Question fingerprint registry (with embedding for semantic novelty)
CREATE TABLE IF NOT EXISTS public.question_fingerprints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  subject_id    uuid,
  subject_name  text,
  fingerprint   text NOT NULL,
  stem_preview  text,
  surface       text NOT NULL,
  embedding     vector(1536),
  seen_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_qfp_user_subject_seen
  ON public.question_fingerprints(user_id, subject_name, seen_at DESC);

GRANT SELECT, INSERT, DELETE ON public.question_fingerprints TO authenticated;
GRANT ALL ON public.question_fingerprints TO service_role;

ALTER TABLE public.question_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own fingerprints"
  ON public.question_fingerprints FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own fingerprints"
  ON public.question_fingerprints FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own fingerprints"
  ON public.question_fingerprints FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. generation_meta provenance columns on existing artifact tables
ALTER TABLE public.daily_tasks         ADD COLUMN IF NOT EXISTS generation_meta jsonb;
ALTER TABLE public.quiz_attempts       ADD COLUMN IF NOT EXISTS generation_meta jsonb;
ALTER TABLE public.flashcards          ADD COLUMN IF NOT EXISTS generation_meta jsonb;
ALTER TABLE public.mock_exam_attempts  ADD COLUMN IF NOT EXISTS generation_meta jsonb;

-- topic_session_questions may not exist in all environments; guard
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='topic_session_questions') THEN
    EXECUTE 'ALTER TABLE public.topic_session_questions ADD COLUMN IF NOT EXISTS generation_meta jsonb';
  END IF;
END $$;

-- 5. concept_id FK on existing free-text concept tables (nullable, backfill later)
ALTER TABLE public.daily_task_concepts
  ADD COLUMN IF NOT EXISTS concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='weak_concepts') THEN
    EXECUTE 'ALTER TABLE public.weak_concepts ADD COLUMN IF NOT EXISTS concept_id uuid REFERENCES public.concepts(id) ON DELETE SET NULL';
  END IF;
END $$;