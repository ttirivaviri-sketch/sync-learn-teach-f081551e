
-- 1) lesson_recordings
CREATE TABLE public.lesson_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  tutor_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  storage_path text NOT NULL,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded','transcribing','ready','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_recordings_booking ON public.lesson_recordings(booking_id);
CREATE INDEX idx_lesson_recordings_learner ON public.lesson_recordings(learner_id);
CREATE INDEX idx_lesson_recordings_tutor ON public.lesson_recordings(tutor_id);
GRANT SELECT ON public.lesson_recordings TO authenticated;
GRANT ALL ON public.lesson_recordings TO service_role;
ALTER TABLE public.lesson_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view recordings" ON public.lesson_recordings
  FOR SELECT TO authenticated
  USING (auth.uid() = learner_id OR auth.uid() = tutor_id);

-- 2) lesson_transcripts
CREATE TABLE public.lesson_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL UNIQUE REFERENCES public.lesson_recordings(id) ON DELETE CASCADE,
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  full_text text NOT NULL,
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  language text DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_transcripts_booking ON public.lesson_transcripts(booking_id);
GRANT SELECT ON public.lesson_transcripts TO authenticated;
GRANT ALL ON public.lesson_transcripts TO service_role;
ALTER TABLE public.lesson_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants can view transcripts" ON public.lesson_transcripts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id = lesson_transcripts.booking_id
      AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
  ));

-- 3) lesson_notes (per-audience)
CREATE TABLE public.lesson_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  audience text NOT NULL CHECK (audience IN ('learner','tutor','shared')),
  summary text,
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  vocabulary jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(booking_id, audience)
);
CREATE INDEX idx_lesson_notes_booking ON public.lesson_notes(booking_id);
CREATE INDEX idx_lesson_notes_owner ON public.lesson_notes(owner_id);
GRANT SELECT ON public.lesson_notes TO authenticated;
GRANT ALL ON public.lesson_notes TO service_role;
ALTER TABLE public.lesson_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner or participant can view notes" ON public.lesson_notes
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR (audience = 'shared' AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_notes.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    ))
  );

-- 4) lesson_topic_mapping
CREATE TABLE public.lesson_topic_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  learner_id uuid NOT NULL,
  subject_id uuid,
  subject_name text,
  topic text NOT NULL,
  concepts text[] NOT NULL DEFAULT '{}',
  weak_concepts text[] NOT NULL DEFAULT '{}',
  coverage_score numeric(3,2) NOT NULL DEFAULT 0.5 CHECK (coverage_score >= 0 AND coverage_score <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lesson_topic_mapping_booking ON public.lesson_topic_mapping(booking_id);
CREATE INDEX idx_lesson_topic_mapping_learner ON public.lesson_topic_mapping(learner_id);
GRANT SELECT ON public.lesson_topic_mapping TO authenticated;
GRANT ALL ON public.lesson_topic_mapping TO service_role;
ALTER TABLE public.lesson_topic_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Learner or tutor can view mappings" ON public.lesson_topic_mapping
  FOR SELECT TO authenticated
  USING (
    auth.uid() = learner_id
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_topic_mapping.booking_id AND b.tutor_id = auth.uid()
    )
  );

-- updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_lesson_recordings_updated
  BEFORE UPDATE ON public.lesson_recordings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_lesson_notes_updated
  BEFORE UPDATE ON public.lesson_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
