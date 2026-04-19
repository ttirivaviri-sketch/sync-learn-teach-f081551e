ALTER TABLE public.study_schedule
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS topic_name text;

CREATE INDEX IF NOT EXISTS idx_study_schedule_user_scheduled_date
  ON public.study_schedule (user_id, scheduled_date);