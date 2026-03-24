
-- ============================================================
-- StudySync Missing Schema Migration
-- Adds: missing columns, new tables, RLS, functions, triggers
-- All idempotent (safe to run multiple times)
-- ============================================================

-- ── 1. Missing columns on quiz_attempts ──
ALTER TABLE public.quiz_attempts
  ADD COLUMN IF NOT EXISTS subject_id UUID,
  ADD COLUMN IF NOT EXISTS topic_name TEXT,
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS was_correct BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Add RLS policy for quiz_attempts (currently has none)
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

-- ── 2. Missing columns on user_progress ──
ALTER TABLE public.user_progress
  ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;

-- ── 3. Missing columns on academic_profiles ──
ALTER TABLE public.academic_profiles
  ADD COLUMN IF NOT EXISTS curriculum TEXT DEFAULT 'ZIMSEC',
  ADD COLUMN IF NOT EXISTS exam_year INTEGER;

-- ── 4. Missing policies on subject_exams (currently only SELECT) ──
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

-- ── 5. New table: topic_tutor_rankings ──
CREATE TABLE IF NOT EXISTS public.topic_tutor_rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  topic_rating NUMERIC(3,2) DEFAULT 0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  success_rate NUMERIC(5,2) DEFAULT 0,
  rank_position INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- ── 6. New table: tutorial_watch_events ──
CREATE TABLE IF NOT EXISTS public.tutorial_watch_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id UUID NOT NULL REFERENCES public.tutor_tutorials(id) ON DELETE CASCADE,
  learner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  watch_seconds INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  booked_tutor BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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
CREATE INDEX IF NOT EXISTS idx_tutorial_watch_events_learner ON public.tutorial_watch_events (learner_id);

-- ── 7. New table: library_saved_items ──
CREATE TABLE IF NOT EXISTS public.library_saved_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  title TEXT NOT NULL,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
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

-- ── 8. New table: flashcards ──
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  hint TEXT,
  difficulty TEXT DEFAULT 'medium',
  tags JSONB DEFAULT '[]',
  repetitions INTEGER DEFAULT 0,
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  next_review_date DATE DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
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

CREATE INDEX IF NOT EXISTS idx_flashcards_user_topic ON public.flashcards (user_id, subject, topic);
CREATE INDEX IF NOT EXISTS idx_flashcards_review_date ON public.flashcards (user_id, next_review_date);

-- ── 9. Triggers ──
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_academic_profiles_updated_at') THEN
    CREATE TRIGGER update_academic_profiles_updated_at
      BEFORE UPDATE ON public.academic_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tutor_tutorials_updated_at') THEN
    CREATE TRIGGER update_tutor_tutorials_updated_at
      BEFORE UPDATE ON public.tutor_tutorials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_progress_updated_at') THEN
    CREATE TRIGGER update_user_progress_updated_at
      BEFORE UPDATE ON public.user_progress
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_study_schedule_updated_at') THEN
    CREATE TRIGGER update_study_schedule_updated_at
      BEFORE UPDATE ON public.study_schedule
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_subject_exams_updated_at') THEN
    CREATE TRIGGER update_subject_exams_updated_at
      BEFORE UPDATE ON public.subject_exams
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_exam_settings_updated_at') THEN
    CREATE TRIGGER update_exam_settings_updated_at
      BEFORE UPDATE ON public.exam_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_flashcards_updated_at') THEN
    CREATE TRIGGER update_flashcards_updated_at
      BEFORE UPDATE ON public.flashcards
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ── 10. Subject unique index ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_user_lower_name_unique
  ON public.subjects (user_id, lower(name));

-- ── 11. Composite indexes for performance ──
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_status_curriculum_subject
  ON public.tutor_tutorials (status, curriculum, subject, created_at DESC);

-- ── 12. Functions ──

-- upsert_academic_profile RPC
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
    grade = EXCLUDED.grade,
    subjects = EXCLUDED.subjects,
    exam_year = EXCLUDED.exam_year,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT, TEXT, TEXT[], INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT, TEXT, TEXT[], INTEGER) TO authenticated;

-- get_published_tutorials RPC
CREATE OR REPLACE FUNCTION public.get_published_tutorials(
  p_curriculum TEXT DEFAULT NULL,
  p_subject TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  tutor_id UUID,
  title TEXT,
  description TEXT,
  subject TEXT,
  topic TEXT,
  subtopic TEXT,
  grade TEXT,
  curriculum TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration_label TEXT,
  watch_count INTEGER,
  completion_rate NUMERIC,
  rating NUMERIC,
  review_count INTEGER,
  created_at TIMESTAMPTZ,
  tutor_full_name TEXT,
  tutor_avatar_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.tutor_id, t.title, t.description, t.subject, t.topic,
    t.subtopic, t.grade, t.curriculum, t.video_url, t.thumbnail_url,
    t.duration_label, t.watch_count, t.completion_rate, t.rating,
    t.review_count, t.created_at,
    p.full_name AS tutor_full_name,
    p.avatar_url AS tutor_avatar_url
  FROM public.tutor_tutorials t
  LEFT JOIN public.profiles p ON p.id = t.tutor_id
  WHERE t.status = 'published'
    AND (p_curriculum IS NULL OR t.curriculum = p_curriculum)
    AND (p_subject IS NULL OR t.subject = p_subject)
  ORDER BY t.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_published_tutorials(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_published_tutorials(TEXT, TEXT) TO anon, authenticated;

-- get_subject_context RPC
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
  v_uid UUID;
  v_subject_name TEXT;
  v_all_topics JSONB := '[]'::jsonb;
  v_topic JSONB := NULL;
  v_syllabus_topic JSONB := NULL;
  v_merged_topic JSONB := NULL;
  v_exam_patterns JSONB := '[]'::jsonb;
  v_past_questions JSONB := '[]'::jsonb;
  v_doc RECORD;
  v_q JSONB;
  v_t JSONB;
  v_mastered_count INTEGER := 0;
  v_total_count INTEGER := 0;
  v_syllabus_progress INTEGER := 0;
  v_exam_weight_from_papers INTEGER := 0;
  v_freq_sum NUMERIC := 0;
  v_freq_count INTEGER := 0;
  v_freq_raw TEXT;
  v_context TEXT := '';
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT s.name, COALESCE(s.topics, '[]'::jsonb)
  INTO v_subject_name, v_all_topics
  FROM public.subjects s
  WHERE s.id = p_subject_id AND (s.user_id IS NULL OR s.user_id = v_uid);

  IF v_subject_name IS NULL THEN
    RAISE EXCEPTION 'Subject not found';
  END IF;

  SELECT t INTO v_topic
  FROM jsonb_array_elements(v_all_topics) t
  WHERE lower(COALESCE(t->>'name', '')) = lower(p_topic_name)
    OR lower(COALESCE(t->>'name', '')) LIKE '%' || lower(p_topic_name) || '%'
    OR lower(p_topic_name) LIKE '%' || lower(COALESCE(t->>'name', '')) || '%'
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'topic_name', ep.topic_name,
    'frequency_score', ep.frequency_score,
    'avg_marks', COALESCE(ep.avg_marks, 0),
    'question_types', COALESCE(ep.question_types, '[]'::jsonb),
    'year', ep.year
  )), '[]'::jsonb)
  INTO v_exam_patterns
  FROM public.exam_patterns ep
  WHERE ep.subject_id = p_subject_id AND ep.user_id = v_uid;

  FOR v_doc IN
    SELECT d.parsed_content, d.type
    FROM public.documents d
    WHERE d.user_id = v_uid AND d.is_processed = true
      AND d.type IN ('past_paper', 'syllabus')
      AND lower(d.subject) = lower(v_subject_name)
  LOOP
    IF v_doc.type = 'past_paper' THEN
      FOR v_q IN SELECT value FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'questions', '[]'::jsonb))
      LOOP
        IF lower(COALESCE(v_q->>'topic', '')) LIKE '%' || lower(p_topic_name) || '%'
          OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_q->>'topic', '')) || '%'
        THEN
          v_past_questions := v_past_questions || jsonb_build_array(jsonb_build_object(
            'question_number', COALESCE(v_q->>'question_number', ''),
            'topic', COALESCE(v_q->>'topic', ''),
            'subtopic', v_q->>'subtopic',
            'marks', COALESCE((v_q->>'marks')::numeric, 1),
            'question_type', COALESCE(v_q->>'question_type', 'structured'),
            'difficulty', COALESCE(v_q->>'difficulty', 'medium'),
            'command_words', COALESCE(v_q->'command_words', '[]'::jsonb),
            'concepts_tested', COALESCE(v_q->'concepts_tested', '[]'::jsonb)
          ));
        END IF;
      END LOOP;
    ELSIF v_doc.type = 'syllabus' AND v_syllabus_topic IS NULL THEN
      FOR v_t IN SELECT value FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'topics', '[]'::jsonb))
      LOOP
        IF lower(COALESCE(v_t->>'name', '')) LIKE '%' || lower(p_topic_name) || '%'
          OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_t->>'name', '')) || '%'
        THEN
          v_syllabus_topic := jsonb_build_object(
            'id', COALESCE(v_t->>'id', ''),
            'name', COALESCE(v_t->>'name', p_topic_name),
            'subtopics', COALESCE(v_t->'subtopics', '[]'::jsonb),
            'learningObjectives', COALESCE(v_t->'learningObjectives', COALESCE(v_t->'learning_objectives', '[]'::jsonb)),
            'concepts', COALESCE(v_t->'concepts', COALESCE(v_t->'key_concepts', '[]'::jsonb)),
            'examWeight', COALESCE((v_t->>'examWeight')::numeric, COALESCE((v_t->>'exam_weight')::numeric, 0)),
            'prerequisites', COALESCE(v_t->'prerequisites', '[]'::jsonb)
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
  SELECT COUNT(*) INTO v_mastered_count
  FROM public.topic_mastery tm
  WHERE tm.subject_id = p_subject_id AND tm.user_id = v_uid
    AND COALESCE(tm.mastery_percentage, 0) >= 70;

  IF v_total_count > 0 THEN
    v_syllabus_progress := ROUND((v_mastered_count::numeric / v_total_count::numeric) * 100)::int;
  END IF;

  FOR v_t IN SELECT value FROM jsonb_array_elements(v_exam_patterns)
  LOOP
    IF lower(COALESCE(v_t->>'topic_name', '')) LIKE '%' || lower(p_topic_name) || '%'
      OR lower(p_topic_name) LIKE '%' || lower(COALESCE(v_t->>'topic_name', '')) || '%'
    THEN
      v_freq_raw := v_t->>'frequency_score';
      IF v_freq_raw ~ '^\-?[0-9]+(\.[0-9]+)?$' THEN
        v_freq_sum := v_freq_sum + v_freq_raw::numeric;
        v_freq_count := v_freq_count + 1;
      END IF;
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
      v_context := v_context || 'Subtopics: ' || (SELECT string_agg(value::text, ' | ') FROM jsonb_array_elements_text(v_merged_topic->'subtopics')) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'learningObjectives', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Learning Objectives:' || E'\n • ' || (SELECT string_agg(value::text, E'\n • ') FROM jsonb_array_elements_text(v_merged_topic->'learningObjectives')) || E'\n';
    END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'concepts', '[]'::jsonb)) > 0 THEN
      v_context := v_context || 'Key Concepts: ' || (SELECT string_agg(value::text, ', ') FROM jsonb_array_elements_text(v_merged_topic->'concepts')) || E'\n';
    END IF;
    IF v_exam_weight_from_papers > 0 THEN
      v_context := v_context || 'Exam Weight Estimate: ' || v_exam_weight_from_papers || '%' || E'\n';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'topic', v_merged_topic,
    'allTopics', v_all_topics,
    'examPatterns', v_exam_patterns,
    'pastPaperQuestions', v_past_questions,
    'examWeightFromPapers', v_exam_weight_from_papers,
    'masteredTopicCount', v_mastered_count,
    'totalTopicCount', v_total_count,
    'syllabusProgress', v_syllabus_progress,
    'curriculumContext', trim(v_context)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_subject_context(UUID, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_subject_context(UUID, TEXT) TO authenticated;

-- ── 13. Realtime publications ──
DO $$ BEGIN
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

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    AND tablename = 'study_schedule'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_schedule;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
    AND tablename = 'user_progress'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_progress;
  END IF;
END $$;

-- ── 14. Reload PostgREST schema cache ──
DO $$ BEGIN
  NOTIFY pgrst, 'reload schema';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
