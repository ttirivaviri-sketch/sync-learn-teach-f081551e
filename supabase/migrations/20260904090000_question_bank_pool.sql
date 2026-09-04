-- Question-bank pooling: share validated AI-generated questions across
-- students on the same curriculum/subject/topic.
--
-- Economics: every generate-quiz / generate-exam-questions call is an AI
-- round-trip. Students on the same syllabus request near-identical content.
-- The pool serves previously generated + validator-clean questions first;
-- the AI is only called for the shortfall, and fresh output is contributed
-- back. Per-user repeats are prevented via question_fingerprints (the same
-- registry the novelty engine uses).
--
-- Contents are ANONYMOUS study content (no user ids, no personal data).
-- RLS is enabled with zero policies: only edge functions (service role)
-- read/write. Rollout is gated by the QUESTION_BANK_ENABLED env flag on
-- the edge functions, mirroring NOVELTY_ENGINE_ENABLED.

CREATE TABLE IF NOT EXISTS public.question_bank (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SHA-256 of the normalised stem — same scheme as question_fingerprints,
  -- so pool exclusion and novelty checks speak one language.
  fingerprint   text NOT NULL UNIQUE,
  -- Pool key (normalised lowercase in the edge helper).
  curriculum    text NOT NULL DEFAULT '',
  subject       text NOT NULL,
  topic         text NOT NULL,
  exam_level    text NOT NULL DEFAULT '',
  difficulty    text NOT NULL DEFAULT 'medium',
  question_type text,
  surface       text NOT NULL,                 -- 'quiz' | 'exam_questions'
  marks         integer,
  -- Granular syllabus concepts this question tests (from conceptsTested),
  -- lowercased. Enables depth-aware draws that match the same targeting the
  -- AI prompt receives, not just the topic label.
  concepts      text[] NOT NULL DEFAULT '{}',
  -- Full normalised question object exactly as the generator returns it
  -- (question, options, modelAnswer, markingScheme, visual, ...).
  payload       jsonb NOT NULL,
  times_served  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_question_bank_pool_key
  ON public.question_bank (subject, topic, curriculum, exam_level, surface, difficulty);

CREATE INDEX IF NOT EXISTS idx_question_bank_concepts
  ON public.question_bank USING gin (concepts);

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
-- No policies: service-role-only access via edge functions.

COMMENT ON TABLE public.question_bank IS
  'Shared pool of validator-clean AI-generated questions, keyed by curriculum/subject/topic. Service role only; QUESTION_BANK_ENABLED gates usage.';

-- Atomic serve-count bump (supabase-js cannot do increments without an RPC).
CREATE OR REPLACE FUNCTION public.bump_question_bank_served(p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.question_bank
     SET times_served = times_served + 1
   WHERE id = ANY(p_ids);
$$;

-- Service role only — revoke from app roles.
REVOKE EXECUTE ON FUNCTION public.bump_question_bank_served(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_question_bank_served(uuid[]) FROM anon, authenticated;
