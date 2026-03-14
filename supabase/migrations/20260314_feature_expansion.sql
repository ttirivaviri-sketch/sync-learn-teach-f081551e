-- ============================================================
-- StudySync Feature Expansion Migration
-- Adds: academic_profiles, tutor_tutorials, topic_tutor_rankings
-- ============================================================

-- ── 1. Academic Profiles ──────────────────────────────────────────────────────
-- Stores each learner's curriculum, grade, subjects, and exam year.
-- This drives library personalization and tutor recommendations.

CREATE TABLE IF NOT EXISTS public.academic_profiles (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  curriculum  TEXT NOT NULL DEFAULT 'ZIMSEC',
  grade       TEXT NOT NULL,
  subjects    TEXT[] NOT NULL DEFAULT '{}',
  exam_year   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academic_profiles_user_id_unique UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.academic_profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Learners can view own academic profile"
  ON public.academic_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Learners can insert own academic profile"
  ON public.academic_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Learners can update own academic profile"
  ON public.academic_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger: auto-update updated_at
CREATE TRIGGER update_academic_profiles_updated_at
  BEFORE UPDATE ON public.academic_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_academic_profiles_user_id
  ON public.academic_profiles (user_id);


-- ── 2. Tutor Tutorials ────────────────────────────────────────────────────────
-- Stores video tutorials uploaded by tutors.
-- The system automatically places tutorials inside the library racks.

CREATE TABLE IF NOT EXISTS public.tutor_tutorials (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  subject           TEXT NOT NULL,
  topic             TEXT NOT NULL,
  subtopic          TEXT,
  grade             TEXT,
  curriculum        TEXT DEFAULT 'ZIMSEC',
  video_url         TEXT,
  thumbnail_url     TEXT,
  duration_label    TEXT,          -- e.g. "22 min"
  duration_seconds  INTEGER,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'archived')),
  watch_count       INTEGER NOT NULL DEFAULT 0,
  completion_rate   NUMERIC(5,2) DEFAULT 0,   -- percentage 0-100
  rating            NUMERIC(3,2) DEFAULT 0,
  review_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutor_tutorials ENABLE ROW LEVEL SECURITY;

-- Everyone can read published tutorials
CREATE POLICY "Anyone can read published tutorials"
  ON public.tutor_tutorials FOR SELECT
  USING (status = 'published' OR auth.uid() = tutor_id);

-- Only the owning tutor can insert/update
CREATE POLICY "Tutors can insert own tutorials"
  ON public.tutor_tutorials FOR INSERT
  WITH CHECK (auth.uid() = tutor_id);

CREATE POLICY "Tutors can update own tutorials"
  ON public.tutor_tutorials FOR UPDATE
  USING (auth.uid() = tutor_id);

CREATE POLICY "Tutors can delete own tutorials"
  ON public.tutor_tutorials FOR DELETE
  USING (auth.uid() = tutor_id);

-- Trigger: auto-update updated_at
CREATE TRIGGER update_tutor_tutorials_updated_at
  BEFORE UPDATE ON public.tutor_tutorials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_tutor_id
  ON public.tutor_tutorials (tutor_id);

CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_subject
  ON public.tutor_tutorials (subject);

CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_status
  ON public.tutor_tutorials (status);

CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_curriculum_grade
  ON public.tutor_tutorials (curriculum, grade);


-- ── 3. Topic Tutor Rankings ───────────────────────────────────────────────────
-- Pre-computed ranking of tutors per topic.
-- Updated by a background job / edge function after each session review.

CREATE TABLE IF NOT EXISTS public.topic_tutor_rankings (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL,
  topic            TEXT NOT NULL,
  topic_rating     NUMERIC(3,2) DEFAULT 0,   -- rating specific to this topic
  total_reviews    INTEGER NOT NULL DEFAULT 0,
  completion_rate  NUMERIC(5,2) DEFAULT 0,   -- % sessions on this topic completed
  success_rate     NUMERIC(5,2) DEFAULT 0,   -- % students who improved
  rank_position    INTEGER,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_tutor_rankings_unique UNIQUE (tutor_id, subject, topic)
);

-- Enable RLS
ALTER TABLE public.topic_tutor_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read topic rankings"
  ON public.topic_tutor_rankings FOR SELECT
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_topic_tutor_rankings_subject_topic
  ON public.topic_tutor_rankings (subject, topic);

CREATE INDEX IF NOT EXISTS idx_topic_tutor_rankings_tutor_id
  ON public.topic_tutor_rankings (tutor_id);


-- ── 4. Tutorial Watch Events (for analytics & completion tracking) ────────────

CREATE TABLE IF NOT EXISTS public.tutorial_watch_events (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id     UUID NOT NULL REFERENCES public.tutor_tutorials(id) ON DELETE CASCADE,
  learner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  watch_seconds   INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT false,
  booked_tutor    BOOLEAN NOT NULL DEFAULT false,   -- did learner book after watching?
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tutorial_watch_unique UNIQUE (tutorial_id, learner_id)
);

ALTER TABLE public.tutorial_watch_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Learners can manage own watch events"
  ON public.tutorial_watch_events FOR ALL
  USING (auth.uid() = learner_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_tutorial_watch_events_tutorial
  ON public.tutorial_watch_events (tutorial_id);

CREATE INDEX IF NOT EXISTS idx_tutorial_watch_events_learner
  ON public.tutorial_watch_events (learner_id);


-- ── 5. Library Saved Items (saved bookmarks) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.library_saved_items (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id   TEXT NOT NULL,        -- can be UUID or seed string id
  resource_type TEXT NOT NULL,        -- 'video' | 'book' | 'pastpaper' etc
  title         TEXT NOT NULL,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT library_saved_items_unique UNIQUE (user_id, resource_id)
);

ALTER TABLE public.library_saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved items"
  ON public.library_saved_items FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_library_saved_items_user
  ON public.library_saved_items (user_id);


-- ── 6. Storage bucket for tutorial videos and thumbnails ─────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-videos', 'tutorial-videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-thumbnails', 'tutorial-thumbnails', true)
ON CONFLICT (id) DO NOTHING;
