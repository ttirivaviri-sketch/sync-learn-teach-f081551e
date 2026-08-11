ALTER TABLE public.school_homework
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'document',
  ADD COLUMN IF NOT EXISTS source_curriculum text,
  ADD COLUMN IF NOT EXISTS source_grade text,
  ADD COLUMN IF NOT EXISTS source_subject text;