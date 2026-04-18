ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS exam_board_meta jsonb NOT NULL DEFAULT '{}'::jsonb;