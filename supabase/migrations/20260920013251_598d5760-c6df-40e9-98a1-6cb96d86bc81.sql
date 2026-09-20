ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS learner_note TEXT;

COMMENT ON COLUMN public.bookings.learner_note IS 'Optional note from the learner about what to focus on, captured at booking time.';