-- ─────────────────────────────────────────────────────────────────────────────
-- Session Integrity Signals
--
-- Captures browser-observable focus/independence signals during AI study
-- sessions (topic sessions, exam mode, active recall):
--   • tab_hidden / window_blur  — student switched away mid-question
--   • paste                     — answer text was pasted rather than typed
--   • question_copied           — question text was copied (lookup pattern)
--
-- These are INTEGRITY SIGNALS, not cheating proof. They power an
-- "Independence & Focus" section in guardian reports and are visible to the
-- student themselves, their guardians, their tutors (active booking
-- relationship), and school staff (teacher/admin at the student's school).
--
-- Reporting threshold (enforced in the report generator, documented here):
-- a session is only surfaced as "flagged" when it has ≥3 flagged questions
-- OR ≥40% of questions flagged; a week is only surfaced to guardians when
-- ≥2 sessions are flagged. Single glances at notifications never appear.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.session_integrity_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Which study surface produced this (mirrors learning event sources)
  session_kind  TEXT NOT NULL CHECK (session_kind IN ('topic_session', 'exam_mode', 'active_recall')),
  -- Loose reference to the underlying session row (topic_sessions.id etc.);
  -- kept as plain UUID because the three session kinds live in different tables.
  session_ref   UUID,
  subject_name  TEXT,
  topic_name    TEXT,
  -- Aggregates
  questions_total    INTEGER NOT NULL DEFAULT 0,
  questions_flagged  INTEGER NOT NULL DEFAULT 0,
  focus_score        NUMERIC(5,2),          -- 0..100, 100 = fully focused
  tab_switches       INTEGER NOT NULL DEFAULT 0,
  total_away_ms      BIGINT  NOT NULL DEFAULT 0,
  paste_events       INTEGER NOT NULL DEFAULT 0,
  question_copies    INTEGER NOT NULL DEFAULT 0,
  -- Per-question event log:
  -- [{ q: 1, type: 'tab_hidden'|'window_blur'|'paste'|'question_copied',
  --    away_ms?, paste_len?, paste_similarity?, at }]
  events        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Whether this session crossed the per-session flag threshold
  is_flagged    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integrity_reports_user_created
  ON public.session_integrity_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_integrity_reports_flagged
  ON public.session_integrity_reports (user_id, is_flagged, created_at DESC)
  WHERE is_flagged;

ALTER TABLE public.session_integrity_reports ENABLE ROW LEVEL SECURITY;

-- Students write & read their own reports.
DROP POLICY IF EXISTS "Students manage own integrity reports" ON public.session_integrity_reports;
CREATE POLICY "Students manage own integrity reports"
  ON public.session_integrity_reports FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Tutors with an active/completed booking relationship to the student can read.
DROP POLICY IF EXISTS "Tutors read integrity of their learners" ON public.session_integrity_reports;
CREATE POLICY "Tutors read integrity of their learners"
  ON public.session_integrity_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.tutor_id = auth.uid()
        AND b.learner_id = session_integrity_reports.user_id
        AND b.status IN ('confirmed', 'completed')
    )
  );

-- School staff (teacher/admin/owner) at a school the student belongs to can read.
DROP POLICY IF EXISTS "School staff read student integrity" ON public.session_integrity_reports;
CREATE POLICY "School staff read student integrity"
  ON public.session_integrity_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.school_memberships sm_student
      JOIN public.school_memberships sm_staff
        ON sm_staff.school_id = sm_student.school_id
      WHERE sm_student.user_id = session_integrity_reports.user_id
        AND sm_student.status = 'active'
        AND sm_staff.user_id = auth.uid()
        AND sm_staff.status = 'active'
        AND sm_staff.role IN ('school_admin', 'school_teacher')
    )
  );

-- Platform admins can read everything (support/debug).
DROP POLICY IF EXISTS "Admins read all integrity reports" ON public.session_integrity_reports;
CREATE POLICY "Admins read all integrity reports"
  ON public.session_integrity_reports FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Guardians receive the digest via the emailed guardian report (service role);
-- no direct table access needed since guardians have no login account —
-- guardian_email on academic_profiles is just an address.
