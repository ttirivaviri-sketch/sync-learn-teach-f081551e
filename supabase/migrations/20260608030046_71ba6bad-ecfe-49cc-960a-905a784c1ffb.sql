
-- ───── lesson_notes ─────
CREATE POLICY "Owner can insert notes" ON public.lesson_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_notes.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );
CREATE POLICY "Owner can update notes" ON public.lesson_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner can delete notes" ON public.lesson_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id);

-- ───── lesson_recordings ─────
CREATE POLICY "Participants can insert recordings" ON public.lesson_recordings
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = learner_id OR auth.uid() = tutor_id)
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_recordings.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );
CREATE POLICY "Participants can update recordings" ON public.lesson_recordings
  FOR UPDATE TO authenticated
  USING (auth.uid() = learner_id OR auth.uid() = tutor_id)
  WITH CHECK (auth.uid() = learner_id OR auth.uid() = tutor_id);
CREATE POLICY "Participants can delete recordings" ON public.lesson_recordings
  FOR DELETE TO authenticated
  USING (auth.uid() = learner_id OR auth.uid() = tutor_id);

-- ───── lesson_transcripts ─────
CREATE POLICY "Participants can insert transcripts" ON public.lesson_transcripts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_transcripts.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );
CREATE POLICY "Participants can update transcripts" ON public.lesson_transcripts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_transcripts.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_transcripts.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );
CREATE POLICY "Participants can delete transcripts" ON public.lesson_transcripts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_transcripts.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );

-- ───── lesson_topic_mapping ─────
CREATE POLICY "Participants can insert topic mappings" ON public.lesson_topic_mapping
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_topic_mapping.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );
CREATE POLICY "Participants can update topic mappings" ON public.lesson_topic_mapping
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_topic_mapping.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_topic_mapping.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );
CREATE POLICY "Participants can delete topic mappings" ON public.lesson_topic_mapping
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_topic_mapping.booking_id
        AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
    )
  );

-- ───── lesson_reinforcement_sets — give tutors SELECT ─────
CREATE POLICY "Tutor can view reinforcement sets for own bookings"
  ON public.lesson_reinforcement_sets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = lesson_reinforcement_sets.booking_id
        AND b.tutor_id = auth.uid()
    )
  );

-- ───── tutor_booking_insights — give learner SELECT ─────
CREATE POLICY "Student can view their booking insights"
  ON public.tutor_booking_insights
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- ───── landing_events — allow anon inserts for funnel tracking ─────
CREATE POLICY "Anon can record landing events"
  ON public.landing_events
  FOR INSERT TO anon
  WITH CHECK (true);
GRANT INSERT ON public.landing_events TO anon;
