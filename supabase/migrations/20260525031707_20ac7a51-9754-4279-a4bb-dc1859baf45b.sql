
-- 1. daily_task_attempts
CREATE TABLE IF NOT EXISTS public.daily_task_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  daily_task_id uuid,
  subject_id uuid,
  subject_name text NOT NULL,
  topic text NOT NULL,
  concept text,
  question text NOT NULL,
  user_answer text,
  model_answer text,
  was_correct boolean NOT NULL DEFAULT false,
  marks_awarded numeric NOT NULL DEFAULT 0,
  marks_possible numeric NOT NULL DEFAULT 0,
  difficulty text,
  block text NOT NULL,
  time_spent_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_task_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own daily task attempts"
  ON public.daily_task_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own daily task attempts"
  ON public.daily_task_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own daily task attempts"
  ON public.daily_task_attempts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_task_attempts_user_subject
  ON public.daily_task_attempts (user_id, subject_id, created_at DESC);

-- 2. Idempotent structured-bundle per (user, subject, date)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_tasks_structured_bundle
  ON public.daily_tasks (user_id, subject_id, task_date)
  WHERE task_type = 'structured-bundle';

-- 3. Auto-bump coverage on re-cover via trigger
CREATE OR REPLACE FUNCTION public.bump_daily_task_concept_coverage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_covered_at = now();
  NEW.coverage_count = COALESCE(OLD.coverage_count, 0) + 1;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_daily_task_concept_coverage ON public.daily_task_concepts;
CREATE TRIGGER trg_bump_daily_task_concept_coverage
  BEFORE UPDATE ON public.daily_task_concepts
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_daily_task_concept_coverage();
