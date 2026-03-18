-- ============================================================
-- StudySync Consolidated Pending Migrations
-- Covers everything after 2026-03-09 that was never applied:
--   20260314_feature_expansion.sql
--   202603150001_backend_feature_functions.sql
--   202603150115_subject_icons_and_studymode_fixes.sql
--   202603150245_get_subject_context_rpc.sql
--   20260315_studymode_tables.sql
--
-- All statements are idempotent (CREATE … IF NOT EXISTS,
-- ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE FUNCTION, etc.)
-- Safe to run multiple times.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1: Feature Expansion (from 20260314)
-- academic_profiles, tutor_tutorials, topic_tutor_rankings,
-- tutorial_watch_events, library_saved_items, storage buckets
-- ────────────────────────────────────────────────────────────

-- 1a. Academic Profiles
CREATE TABLE IF NOT EXISTS public.academic_profiles (
  id          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  curriculum  TEXT NOT NULL DEFAULT 'ZIMSEC',
  grade       TEXT NOT NULL DEFAULT '',
  subjects    TEXT[] NOT NULL DEFAULT '{}',
  exam_year   INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT academic_profiles_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.academic_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academic_profiles'
      AND policyname='Learners can view own academic profile'
  ) THEN
    CREATE POLICY "Learners can view own academic profile"
      ON public.academic_profiles FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academic_profiles'
      AND policyname='Learners can insert own academic profile'
  ) THEN
    CREATE POLICY "Learners can insert own academic profile"
      ON public.academic_profiles FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='academic_profiles'
      AND policyname='Learners can update own academic profile'
  ) THEN
    CREATE POLICY "Learners can update own academic profile"
      ON public.academic_profiles FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_triggers
    WHERE tgname = 'update_academic_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_academic_profiles_updated_at
      BEFORE UPDATE ON public.academic_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_academic_profiles_user_id
  ON public.academic_profiles (user_id);


-- 1b. Tutor Tutorials
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
  duration_label    TEXT,
  duration_seconds  INTEGER,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'archived')),
  watch_count       INTEGER NOT NULL DEFAULT 0,
  completion_rate   NUMERIC(5,2) DEFAULT 0,
  rating            NUMERIC(3,2) DEFAULT 0,
  review_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tutor_tutorials ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_tutorials'
      AND policyname='Anyone can read published tutorials'
  ) THEN
    CREATE POLICY "Anyone can read published tutorials"
      ON public.tutor_tutorials FOR SELECT
      USING (status = 'published' OR auth.uid() = tutor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_tutorials'
      AND policyname='Tutors can insert own tutorials'
  ) THEN
    CREATE POLICY "Tutors can insert own tutorials"
      ON public.tutor_tutorials FOR INSERT
      WITH CHECK (auth.uid() = tutor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_tutorials'
      AND policyname='Tutors can update own tutorials'
  ) THEN
    CREATE POLICY "Tutors can update own tutorials"
      ON public.tutor_tutorials FOR UPDATE
      USING (auth.uid() = tutor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_tutorials'
      AND policyname='Tutors can delete own tutorials'
  ) THEN
    CREATE POLICY "Tutors can delete own tutorials"
      ON public.tutor_tutorials FOR DELETE
      USING (auth.uid() = tutor_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_triggers
    WHERE tgname = 'update_tutor_tutorials_updated_at'
  ) THEN
    CREATE TRIGGER update_tutor_tutorials_updated_at
      BEFORE UPDATE ON public.tutor_tutorials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_tutor_id   ON public.tutor_tutorials (tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_subject     ON public.tutor_tutorials (subject);
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_status      ON public.tutor_tutorials (status);
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_curriculum_grade ON public.tutor_tutorials (curriculum, grade);


-- 1c. Topic Tutor Rankings
CREATE TABLE IF NOT EXISTS public.topic_tutor_rankings (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject          TEXT NOT NULL,
  topic            TEXT NOT NULL,
  topic_rating     NUMERIC(3,2) DEFAULT 0,
  total_reviews    INTEGER NOT NULL DEFAULT 0,
  completion_rate  NUMERIC(5,2) DEFAULT 0,
  success_rate     NUMERIC(5,2) DEFAULT 0,
  rank_position    INTEGER,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT topic_tutor_rankings_unique UNIQUE (tutor_id, subject, topic)
);

ALTER TABLE public.topic_tutor_rankings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='topic_tutor_rankings'
      AND policyname='Anyone can read topic rankings'
  ) THEN
    CREATE POLICY "Anyone can read topic rankings"
      ON public.topic_tutor_rankings FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_topic_tutor_rankings_subject_topic
  ON public.topic_tutor_rankings (subject, topic);
CREATE INDEX IF NOT EXISTS idx_topic_tutor_rankings_tutor_id
  ON public.topic_tutor_rankings (tutor_id);


-- 1d. Tutorial Watch Events
CREATE TABLE IF NOT EXISTS public.tutorial_watch_events (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id     UUID NOT NULL REFERENCES public.tutor_tutorials(id) ON DELETE CASCADE,
  learner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  watch_seconds   INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT false,
  booked_tutor    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tutorial_watch_unique UNIQUE (tutorial_id, learner_id)
);

ALTER TABLE public.tutorial_watch_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='tutorial_watch_events'
      AND policyname='Learners can manage own watch events'
  ) THEN
    CREATE POLICY "Learners can manage own watch events"
      ON public.tutorial_watch_events FOR ALL
      USING (auth.uid() = learner_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tutorial_watch_events_tutorial ON public.tutorial_watch_events (tutorial_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_watch_events_learner  ON public.tutorial_watch_events (learner_id);


-- 1e. Library Saved Items
CREATE TABLE IF NOT EXISTS public.library_saved_items (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id   TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  title         TEXT NOT NULL,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT library_saved_items_unique UNIQUE (user_id, resource_id)
);

ALTER TABLE public.library_saved_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='library_saved_items'
      AND policyname='Users can manage own saved items'
  ) THEN
    CREATE POLICY "Users can manage own saved items"
      ON public.library_saved_items FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_library_saved_items_user ON public.library_saved_items (user_id);


-- 1f. Storage buckets for tutorial videos and thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-videos', 'tutorial-videos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('tutorial-thumbnails', 'tutorial-thumbnails', true)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- SECTION 2: Backend RPCs (from 202603150001)
-- upsert_academic_profile, get_published_tutorials
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_academic_profile(
  p_curriculum TEXT,
  p_grade TEXT,
  p_subjects TEXT[],
  p_exam_year INTEGER DEFAULT NULL
)
RETURNS public.academic_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_row public.academic_profiles;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.academic_profiles (
    user_id, curriculum, grade, subjects, exam_year, updated_at
  )
  VALUES (
    v_uid,
    COALESCE(NULLIF(p_curriculum, ''), 'ZIMSEC'),
    p_grade,
    COALESCE(p_subjects, '{}'),
    p_exam_year,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    curriculum = EXCLUDED.curriculum,
    grade      = EXCLUDED.grade,
    subjects   = EXCLUDED.subjects,
    exam_year  = EXCLUDED.exam_year,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT, TEXT, TEXT[], INTEGER) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_published_tutorials(
  p_curriculum TEXT DEFAULT NULL,
  p_subject    TEXT DEFAULT NULL
)
RETURNS TABLE (
  id              UUID,
  tutor_id        UUID,
  title           TEXT,
  description     TEXT,
  subject         TEXT,
  topic           TEXT,
  subtopic        TEXT,
  grade           TEXT,
  curriculum      TEXT,
  video_url       TEXT,
  thumbnail_url   TEXT,
  duration_label  TEXT,
  watch_count     INTEGER,
  completion_rate NUMERIC,
  rating          NUMERIC,
  review_count    INTEGER,
  created_at      TIMESTAMPTZ,
  tutor_full_name TEXT,
  tutor_avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.tutor_id,
    t.title,
    t.description,
    t.subject,
    t.topic,
    t.subtopic,
    t.grade,
    t.curriculum,
    t.video_url,
    t.thumbnail_url,
    t.duration_label,
    t.watch_count,
    t.completion_rate,
    t.rating,
    t.review_count,
    t.created_at,
    p.full_name  AS tutor_full_name,
    p.avatar_url AS tutor_avatar_url
  FROM public.tutor_tutorials t
  LEFT JOIN public.profiles p ON p.id = t.tutor_id
  WHERE t.status = 'published'
    AND (p_curriculum IS NULL OR t.curriculum = p_curriculum)
    AND (p_subject    IS NULL OR t.subject    = p_subject)
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_tutorials(TEXT, TEXT) TO anon, authenticated;


-- Ensure realtime publication covers new tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'tutor_tutorials'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tutor_tutorials;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
      AND tablename = 'academic_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_profiles;
  END IF;
END
$$;


-- ────────────────────────────────────────────────────────────
-- SECTION 3: Subject icons + uniqueness (from 202603150115)
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS icon_emoji    TEXT,
  ADD COLUMN IF NOT EXISTS icon_gradient TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_user_lower_name_unique
  ON public.subjects (user_id, lower(name));

UPDATE public.subjects
SET
  icon_emoji = CASE
    WHEN lower(name) IN ('mathematics', 'maths', 'math') THEN '📐'
    WHEN lower(name) = 'physics'             THEN '⚛️'
    WHEN lower(name) = 'chemistry'           THEN '🧪'
    WHEN lower(name) = 'biology'             THEN '🧬'
    WHEN lower(name) IN ('english', 'english language') THEN '📖'
    WHEN lower(name) = 'literature'          THEN '🪶'
    WHEN lower(name) = 'geography'           THEN '🌍'
    WHEN lower(name) = 'history'             THEN '🏛️'
    WHEN lower(name) IN ('computer science', 'ict') THEN '💻'
    WHEN lower(name) = 'economics'           THEN '📢'
    WHEN lower(name) = 'accounting'          THEN '🧮'
    WHEN lower(name) = 'business studies'    THEN '💼'
    WHEN lower(name) = 'agriculture'         THEN '🚜'
    WHEN lower(name) = 'foreign languages'   THEN '🗣️'
    WHEN lower(name) = 'design & technology' THEN '🛠️'
    WHEN lower(name) = 'engineering graphics' THEN '📘'
    WHEN lower(name) = 'sociology'           THEN '👥'
    WHEN lower(name) = 'psychology'          THEN '🧠'
    WHEN lower(name) = 'religious studies'   THEN '✝️'
    WHEN lower(name) = 'law'                 THEN '⚖️'
    WHEN lower(name) = 'music'               THEN '🎵'
    WHEN lower(name) = 'health'              THEN '🩺'
    WHEN lower(name) = 'environmental science' THEN '🌱'
    WHEN lower(name) = 'physical education'  THEN '⚽'
    WHEN lower(name) = 'first aid'           THEN '🛡️'
    WHEN lower(name) = 'art'                 THEN '🎨'
    ELSE COALESCE(icon_emoji, '📚')
  END,
  icon_gradient = CASE
    WHEN lower(name) IN ('mathematics', 'maths', 'math') THEN 'from-purple-500 to-violet-600'
    WHEN lower(name) = 'physics'             THEN 'from-blue-500 to-indigo-600'
    WHEN lower(name) = 'chemistry'           THEN 'from-green-500 to-emerald-600'
    WHEN lower(name) = 'biology'             THEN 'from-pink-500 to-rose-600'
    WHEN lower(name) IN ('english', 'english language') THEN 'from-orange-500 to-amber-600'
    WHEN lower(name) = 'literature'          THEN 'from-red-500 to-rose-600'
    WHEN lower(name) = 'geography'           THEN 'from-lime-500 to-green-600'
    WHEN lower(name) = 'history'             THEN 'from-stone-500 to-amber-700'
    WHEN lower(name) IN ('computer science', 'ict') THEN 'from-cyan-500 to-sky-600'
    WHEN lower(name) = 'economics'           THEN 'from-teal-500 to-cyan-600'
    WHEN lower(name) = 'accounting'          THEN 'from-blue-500 to-indigo-600'
    WHEN lower(name) = 'business studies'    THEN 'from-teal-500 to-cyan-600'
    WHEN lower(name) = 'agriculture'         THEN 'from-green-500 to-lime-600'
    WHEN lower(name) = 'foreign languages'   THEN 'from-yellow-500 to-amber-600'
    WHEN lower(name) = 'design & technology' THEN 'from-purple-500 to-indigo-600'
    WHEN lower(name) = 'engineering graphics' THEN 'from-blue-600 to-indigo-800'
    WHEN lower(name) = 'sociology'           THEN 'from-fuchsia-500 to-pink-600'
    WHEN lower(name) = 'psychology'          THEN 'from-violet-500 to-purple-700'
    WHEN lower(name) = 'religious studies'   THEN 'from-yellow-500 to-amber-600'
    WHEN lower(name) = 'law'                 THEN 'from-slate-500 to-gray-700'
    WHEN lower(name) = 'music'               THEN 'from-indigo-500 to-violet-600'
    WHEN lower(name) = 'health'              THEN 'from-cyan-400 to-teal-500'
    WHEN lower(name) = 'environmental science' THEN 'from-emerald-400 to-teal-500'
    WHEN lower(name) = 'physical education'  THEN 'from-green-500 to-lime-600'
    WHEN lower(name) = 'first aid'           THEN 'from-red-500 to-rose-600'
    WHEN lower(name) = 'art'                 THEN 'from-yellow-500 to-amber-600'
    ELSE COALESCE(icon_gradient, 'from-gray-500 to-slate-600')
  END;


-- ────────────────────────────────────────────────────────────
-- SECTION 4: get_subject_context RPC (from 202603150245)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_subject_context(
  p_subject_id UUID,
  p_topic_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid                  UUID;
  v_subject_name         TEXT;
  v_all_topics           JSONB := '[]'::jsonb;
  v_topic                JSONB := NULL;
  v_syllabus_topic       JSONB := NULL;
  v_merged_topic         JSONB := NULL;
  v_exam_patterns        JSONB := '[]'::jsonb;
  v_past_questions       JSONB := '[]'::jsonb;
  v_doc                  RECORD;
  v_q                    JSONB;
  v_t                    JSONB;
  v_mastered_count       INTEGER := 0;
  v_total_count          INTEGER := 0;
  v_syllabus_progress    INTEGER := 0;
  v_exam_weight_from_papers INTEGER := 0;
  v_freq_sum             NUMERIC := 0;
  v_freq_count           INTEGER := 0;
  v_context              TEXT := '';
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.name, COALESCE(s.topics, '[]'::jsonb)
  INTO v_subject_name, v_all_topics
  FROM public.subjects s
  WHERE s.id = p_subject_id AND s.user_id = v_uid;

  IF v_subject_name IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  SELECT t
  INTO v_topic
  FROM jsonb_array_elements(v_all_topics) t
  WHERE
    lower(COALESCE(t->>'name', '')) = lower(p_topic_name)
    OR lower(COALESCE(t->>'name', '')) LIKE '%' || lower(p_topic_name) || '%'
    OR lower(p_topic_name) LIKE '%' || lower(COALESCE(t->>'name', '')) || '%'
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'topic_name',      ep.topic_name,
        'frequency_score', ep.frequency_score,
        'avg_marks',       COALESCE(ep.avg_marks, 0),
        'question_types',  COALESCE(ep.question_types, '[]'::jsonb),
        'year',            ep.year
      )
    ),
    '[]'::jsonb
  )
  INTO v_exam_patterns
  FROM public.exam_patterns ep
  WHERE ep.subject_id = p_subject_id
    AND ep.user_id = v_uid;

  FOR v_doc IN
    SELECT d.parsed_content, d.type
    FROM public.documents d
    WHERE d.user_id = v_uid
      AND d.is_processed = true
      AND d.type IN ('past_paper', 'syllabus')
      AND lower(d.subject) = lower(v_subject_name)
  LOOP
    IF v_doc.type = 'past_paper' THEN
      FOR v_q IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'questions', '[]'::jsonb))
      LOOP
        IF lower(COALESCE(v_q->>'topic', '')) LIKE '%' || lower(p_topic_name) || '%'
           OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_q->>'topic', '')) || '%'
        THEN
          v_past_questions := v_past_questions || jsonb_build_array(
            jsonb_build_object(
              'question_number', COALESCE(v_q->>'question_number', ''),
              'topic',           COALESCE(v_q->>'topic', ''),
              'subtopic',        v_q->>'subtopic',
              'marks',           COALESCE((v_q->>'marks')::numeric, 1),
              'question_type',   COALESCE(v_q->>'question_type', 'structured'),
              'difficulty',      COALESCE(v_q->>'difficulty', 'medium'),
              'command_words',   COALESCE(v_q->'command_words', '[]'::jsonb),
              'concepts_tested', COALESCE(v_q->'concepts_tested', '[]'::jsonb)
            )
          );
        END IF;
      END LOOP;
    ELSIF v_doc.type = 'syllabus' AND v_syllabus_topic IS NULL THEN
      FOR v_t IN
        SELECT value
        FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'topics', '[]'::jsonb))
      LOOP
        IF lower(COALESCE(v_t->>'name', '')) LIKE '%' || lower(p_topic_name) || '%'
           OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_t->>'name', '')) || '%'
        THEN
          v_syllabus_topic := jsonb_build_object(
            'id',               COALESCE(v_t->>'id', ''),
            'name',             COALESCE(v_t->>'name', p_topic_name),
            'subtopics',        COALESCE(v_t->'subtopics', '[]'::jsonb),
            'learningObjectives', COALESCE(v_t->'learningObjectives',
                                  COALESCE(v_t->'learning_objectives', '[]'::jsonb)),
            'concepts',         COALESCE(v_t->'concepts',
                                  COALESCE(v_t->'key_concepts', '[]'::jsonb)),
            'examWeight',       COALESCE((v_t->>'examWeight')::numeric,
                                  COALESCE((v_t->>'exam_weight')::numeric, 0)),
            'prerequisites',    COALESCE(v_t->'prerequisites', '[]'::jsonb)
          );
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  v_merged_topic := COALESCE(v_topic, v_syllabus_topic);

  IF v_topic IS NOT NULL AND v_syllabus_topic IS NOT NULL THEN
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'subtopics', '[]'::jsonb)) > 0 THEN
      v_merged_topic := jsonb_set(v_merged_topic, '{subtopics}', v_syllabus_topic->'subtopics', true);
    END IF;
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'learningObjectives', '[]'::jsonb)) > 0 THEN
      v_merged_topic := jsonb_set(v_merged_topic, '{learningObjectives}', v_syllabus_topic->'learningObjectives', true);
    END IF;
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'concepts', '[]'::jsonb)) > 0 THEN
      v_merged_topic := jsonb_set(v_merged_topic, '{concepts}', v_syllabus_topic->'concepts', true);
    END IF;
  END IF;

  v_total_count := jsonb_array_length(v_all_topics);
  SELECT COUNT(*)
  INTO v_mastered_count
  FROM public.topic_mastery tm
  WHERE tm.subject_id = p_subject_id
    AND tm.user_id = v_uid
    AND COALESCE(tm.mastery_percentage, 0) >= 70;

  IF v_total_count > 0 THEN
    v_syllabus_progress := ROUND((v_mastered_count::numeric / v_total_count::numeric) * 100)::int;
  END IF;

  FOR v_t IN SELECT value FROM jsonb_array_elements(v_exam_patterns)
  LOOP
    IF lower(COALESCE(v_t->>'topic_name', '')) LIKE '%' || lower(p_topic_name) || '%'
       OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_t->>'topic_name', '')) || '%'
    THEN
      v_freq_sum   := v_freq_sum + COALESCE((v_t->>'frequency_score')::numeric, 0);
      v_freq_count := v_freq_count + 1;
    END IF;
  END LOOP;

  IF v_freq_count > 0 THEN
    v_exam_weight_from_papers := ROUND(v_freq_sum / v_freq_count)::int;
  ELSE
    v_exam_weight_from_papers := COALESCE((v_merged_topic->>'examWeight')::numeric, 0)::int;
  END IF;

  IF v_merged_topic IS NOT NULL THEN
    v_context := v_context || '=== SYLLABUS DATA FOR: ' || p_topic_name || E' ===\n';
    IF jsonb_array_length(COALESCE(v_merged_topic->'subtopics', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Subtopics: ' || (
        SELECT string_agg(value::text, ' | ')
        FROM jsonb_array_elements_text(v_merged_topic->'subtopics')
      ) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'learningObjectives', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Learning Objectives:' || E'\n  • ' || (
        SELECT string_agg(value::text, E'\n  • ')
        FROM jsonb_array_elements_text(v_merged_topic->'learningObjectives')
      ) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'concepts', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Key Concepts: ' || (
        SELECT string_agg(value::text, ', ')
        FROM jsonb_array_elements_text(v_merged_topic->'concepts')
      ) || E'\n';
    END IF;
    IF v_exam_weight_from_papers > 0 THEN
      v_context := v_context || 'Exam Weight Estimate: ' || v_exam_weight_from_papers || '%' || E'\n';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'topic',                  v_merged_topic,
    'allTopics',              v_all_topics,
    'examPatterns',           v_exam_patterns,
    'pastPaperQuestions',     v_past_questions,
    'examWeightFromPapers',   v_exam_weight_from_papers,
    'masteredTopicCount',     v_mastered_count,
    'totalTopicCount',        v_total_count,
    'syllabusProgress',       v_syllabus_progress,
    'curriculumContext',       trim(v_context)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_subject_context(UUID, TEXT) TO authenticated;


-- ────────────────────────────────────────────────────────────
-- SECTION 5: StudyMode core tables (from 20260315)
-- quiz_attempts, user_progress, study_schedule,
-- subject_exams, exam_settings
-- + academic_profiles column additions
-- + documents.document_type generated column
-- ────────────────────────────────────────────────────────────

-- 5a. Quiz Attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id                UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id        UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_name        TEXT NOT NULL,
  question          TEXT NOT NULL,
  model_answer      TEXT,
  user_answer       TEXT,
  was_correct       BOOLEAN NOT NULL DEFAULT FALSE,
  marks_awarded     NUMERIC(5,2),
  marks_possible    NUMERIC(5,2),
  difficulty_rating NUMERIC(3,2),
  command_word      TEXT,
  concepts_tested   TEXT[],
  next_review_date  DATE,
  review_count      INTEGER NOT NULL DEFAULT 0,
  ease_factor       NUMERIC(4,2) NOT NULL DEFAULT 2.5,
  interval_days     INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='quiz_attempts'
      AND policyname='Users can manage own quiz attempts'
  ) THEN
    CREATE POLICY "Users can manage own quiz attempts"
      ON public.quiz_attempts FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_subject
  ON public.quiz_attempts (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_review_date
  ON public.quiz_attempts (user_id, next_review_date);


-- 5b. User Progress
CREATE TABLE IF NOT EXISTS public.user_progress (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  xp              INTEGER NOT NULL DEFAULT 0,
  streak          INTEGER NOT NULL DEFAULT 0,
  badges          JSONB NOT NULL DEFAULT '[]',
  last_study_date DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_progress_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_progress'
      AND policyname='Users can manage own progress'
  ) THEN
    CREATE POLICY "Users can manage own progress"
      ON public.user_progress FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_triggers
    WHERE tgname = 'update_user_progress_updated_at'
  ) THEN
    CREATE TRIGGER update_user_progress_updated_at
      BEFORE UPDATE ON public.user_progress
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- 5c. Study Schedule
CREATE TABLE IF NOT EXISTS public.study_schedule (
  id               UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_name       TEXT,
  scheduled_date   DATE NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 45,
  task_type        TEXT NOT NULL DEFAULT 'study',
  is_completed     BOOLEAN NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.study_schedule ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='study_schedule'
      AND policyname='Users can manage own study schedule'
  ) THEN
    CREATE POLICY "Users can manage own study schedule"
      ON public.study_schedule FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_study_schedule_user_date
  ON public.study_schedule (user_id, scheduled_date);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_triggers
    WHERE tgname = 'update_study_schedule_updated_at'
  ) THEN
    CREATE TRIGGER update_study_schedule_updated_at
      BEFORE UPDATE ON public.study_schedule
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- 5d. Subject Exams
CREATE TABLE IF NOT EXISTS public.subject_exams (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id   UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name TEXT NOT NULL,
  exam_name    TEXT NOT NULL,
  exam_date    DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subject_exams ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='subject_exams'
      AND policyname='Users can manage own subject exams'
  ) THEN
    CREATE POLICY "Users can manage own subject exams"
      ON public.subject_exams FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_subject_exams_user_date
  ON public.subject_exams (user_id, exam_date);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_triggers
    WHERE tgname = 'update_subject_exams_updated_at'
  ) THEN
    CREATE TRIGGER update_subject_exams_updated_at
      BEFORE UPDATE ON public.subject_exams
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- 5e. Exam Settings
CREATE TABLE IF NOT EXISTS public.exam_settings (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name  TEXT NOT NULL,
  exam_date  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_settings_user_id_unique UNIQUE (user_id)
);

ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='exam_settings'
      AND policyname='Users can manage own exam settings'
  ) THEN
    CREATE POLICY "Users can manage own exam settings"
      ON public.exam_settings FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_triggers
    WHERE tgname = 'update_exam_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_exam_settings_updated_at
      BEFORE UPDATE ON public.exam_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;


-- 5f. Add missing columns to academic_profiles
ALTER TABLE public.academic_profiles
  ADD COLUMN IF NOT EXISTS study_level  TEXT,
  ADD COLUMN IF NOT EXISTS exam_board   TEXT,
  ADD COLUMN IF NOT EXISTS school_name  TEXT,
  ADD COLUMN IF NOT EXISTS target_grade TEXT;

-- Back-fill study_level from grade for existing rows
UPDATE public.academic_profiles
  SET study_level = grade
  WHERE study_level IS NULL AND grade IS NOT NULL;


-- 5g. Add document_type generated column to documents
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type TEXT
    GENERATED ALWAYS AS (type) STORED;


-- ────────────────────────────────────────────────────────────
-- 6. flashcards table (AI-generated, per-topic flashcard store)
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flashcards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id       UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject          TEXT NOT NULL,
  topic            TEXT NOT NULL,
  front            TEXT NOT NULL,
  back             TEXT NOT NULL,
  hint             TEXT,
  difficulty       TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  tags             JSONB DEFAULT '[]',
  -- SM-2 spaced-repetition fields
  repetitions      INTEGER DEFAULT 0,
  ease_factor      REAL DEFAULT 2.5,
  interval_days    INTEGER DEFAULT 1,
  next_review_date DATE DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='flashcards'
      AND policyname='Users can manage own flashcards'
  ) THEN
    CREATE POLICY "Users can manage own flashcards"
      ON public.flashcards FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flashcards_user_topic
  ON public.flashcards (user_id, subject, topic);

CREATE INDEX IF NOT EXISTS idx_flashcards_review_date
  ON public.flashcards (user_id, next_review_date);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_triggers
    WHERE tgname = 'update_flashcards_updated_at'
  ) THEN
    CREATE TRIGGER update_flashcards_updated_at
      BEFORE UPDATE ON public.flashcards
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Add notes column to study_schedule if missing (stores AI task_description)
ALTER TABLE public.study_schedule
  ADD COLUMN IF NOT EXISTS notes TEXT;


-- ────────────────────────────────────────────────────────────
-- FINAL: Reload PostgREST schema cache
-- ────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
