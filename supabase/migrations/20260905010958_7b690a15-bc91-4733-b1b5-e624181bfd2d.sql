CREATE TABLE IF NOT EXISTS public.question_bank (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint   text NOT NULL UNIQUE,
  curriculum    text NOT NULL DEFAULT '',
  subject       text NOT NULL,
  topic         text NOT NULL,
  exam_level    text NOT NULL DEFAULT '',
  difficulty    text NOT NULL DEFAULT 'medium',
  question_type text,
  surface       text NOT NULL,
  marks         integer,
  concepts      text[] NOT NULL DEFAULT '{}',
  payload       jsonb NOT NULL,
  times_served  integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.question_bank TO service_role;

CREATE INDEX IF NOT EXISTS idx_question_bank_pool_key
  ON public.question_bank (subject, topic, curriculum, exam_level, surface, difficulty);

CREATE INDEX IF NOT EXISTS idx_question_bank_concepts
  ON public.question_bank USING gin (concepts);

ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.question_bank IS
  'Shared pool of validator-clean AI-generated questions, keyed by curriculum/subject/topic. Service role only; QUESTION_BANK_ENABLED gates usage.';

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

REVOKE EXECUTE ON FUNCTION public.bump_question_bank_served(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bump_question_bank_served(uuid[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bump_question_bank_served(uuid[]) TO service_role;