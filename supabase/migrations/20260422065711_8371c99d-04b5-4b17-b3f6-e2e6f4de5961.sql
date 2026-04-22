-- Track concept coverage per user/subject for daily task generation
CREATE TABLE public.daily_task_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid,
  subject_name text NOT NULL,
  topic text NOT NULL,
  subtopic text,
  concept text NOT NULL,
  last_covered_at timestamp with time zone NOT NULL DEFAULT now(),
  coverage_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT daily_task_concepts_unique UNIQUE (user_id, subject_name, concept)
);

CREATE INDEX idx_daily_task_concepts_user_subject
  ON public.daily_task_concepts (user_id, subject_name);

ALTER TABLE public.daily_task_concepts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own concept coverage"
  ON public.daily_task_concepts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own concept coverage"
  ON public.daily_task_concepts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own concept coverage"
  ON public.daily_task_concepts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own concept coverage"
  ON public.daily_task_concepts FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_daily_task_concepts_updated_at
  BEFORE UPDATE ON public.daily_task_concepts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Extend daily_tasks with structured-task fields (nullable, backwards compatible)
ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS task_payload jsonb,
  ADD COLUMN IF NOT EXISTS selection_reason text,
  ADD COLUMN IF NOT EXISTS concepts_covered text[];