
-- 1) lesson_consents
CREATE TABLE public.lesson_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  recording_consent boolean NOT NULL DEFAULT false,
  transcription_consent boolean NOT NULL DEFAULT false,
  notes_consent boolean NOT NULL DEFAULT false,
  consented_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, booking_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_consents TO authenticated;
GRANT ALL ON public.lesson_consents TO service_role;

ALTER TABLE public.lesson_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own consent"
  ON public.lesson_consents FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Booking participants can read each other's consent"
  ON public.lesson_consents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_consents.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );

CREATE TRIGGER trg_lesson_consents_updated
  BEFORE UPDATE ON public.lesson_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) lesson_retention_settings
CREATE TABLE public.lesson_retention_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_delete_after_days integer NOT NULL DEFAULT 90,
  keep_notes_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_retention_settings TO authenticated;
GRANT ALL ON public.lesson_retention_settings TO service_role;

ALTER TABLE public.lesson_retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own retention"
  ON public.lesson_retention_settings FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_lesson_retention_updated
  BEFORE UPDATE ON public.lesson_retention_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) lesson_reinforcement_sets
CREATE TABLE public.lesson_reinforcement_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  recording_id uuid REFERENCES public.lesson_recordings(id) ON DELETE SET NULL,
  learner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz jsonb NOT NULL DEFAULT '[]'::jsonb,
  flashcards jsonb NOT NULL DEFAULT '[]'::jsonb,
  concepts text[] NOT NULL DEFAULT '{}',
  mastery_baseline jsonb NOT NULL DEFAULT '{}'::jsonb,
  mastery_after jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_reinforcement_sets TO authenticated;
GRANT ALL ON public.lesson_reinforcement_sets TO service_role;

ALTER TABLE public.lesson_reinforcement_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learner manages own reinforcement sets"
  ON public.lesson_reinforcement_sets FOR ALL
  TO authenticated
  USING (learner_id = auth.uid())
  WITH CHECK (learner_id = auth.uid());

CREATE TRIGGER trg_lesson_reinforcement_updated
  BEFORE UPDATE ON public.lesson_reinforcement_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Extend lesson_topic_mapping
ALTER TABLE public.lesson_topic_mapping
  ADD COLUMN IF NOT EXISTS confidence numeric,
  ADD COLUMN IF NOT EXISTS evidence jsonb,
  ADD COLUMN IF NOT EXISTS recommendation text;
