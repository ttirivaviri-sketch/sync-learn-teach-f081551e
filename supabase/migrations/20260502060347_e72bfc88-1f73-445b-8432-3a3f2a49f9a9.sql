CREATE TABLE public.progress_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  learner_id UUID NOT NULL,
  tutor_id UUID NULL,
  audience TEXT NOT NULL DEFAULT 'self' CHECK (audience IN ('self','tutor')),
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_plan_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_progress_reports_learner ON public.progress_reports(learner_id, generated_at DESC);
CREATE INDEX idx_progress_reports_tutor ON public.progress_reports(tutor_id, generated_at DESC) WHERE tutor_id IS NOT NULL;

ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learners view own progress reports"
ON public.progress_reports FOR SELECT
USING (auth.uid() = learner_id);

CREATE POLICY "Learners insert own progress reports"
ON public.progress_reports FOR INSERT
WITH CHECK (auth.uid() = learner_id);

CREATE POLICY "Learners update own progress reports"
ON public.progress_reports FOR UPDATE
USING (auth.uid() = learner_id);

CREATE POLICY "Learners delete own progress reports"
ON public.progress_reports FOR DELETE
USING (auth.uid() = learner_id);

CREATE POLICY "Tutors view reports for their bookings"
ON public.progress_reports FOR SELECT
USING (
  audience = 'tutor'
  AND tutor_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.tutor_id = auth.uid()
      AND b.learner_id = progress_reports.learner_id
      AND b.status IN ('requested'::booking_status, 'confirmed'::booking_status)
  )
);

CREATE POLICY "Admin full access progress reports"
ON public.progress_reports FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.landing_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  event TEXT NOT NULL,
  path TEXT NULL,
  referrer TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_landing_events_event_created ON public.landing_events(event, created_at DESC);
CREATE INDEX idx_landing_events_session ON public.landing_events(session_id);

ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record landing events"
ON public.landing_events FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin reads landing events"
ON public.landing_events FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
