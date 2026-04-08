// run-migration/index.ts
// Deploys all pending migrations (post-March-9) to the live Supabase database.
// Invoked via: POST /functions/v1/run-migration with header x-migration-token

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-migration-token",
};

const MIGRATION_TOKEN = "studysync-migrate-2026-secure";

// ---------------------------------------------------------------------------
// All pending migration steps (idempotent – safe to re-run)
// ---------------------------------------------------------------------------
const STEPS: Array<{ name: string; sql: string }> = [
  // ── Migration 1: Feature Expansion ──────────────────────────────────────
  {
    name: "create academic_profiles",
    sql: `
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
)`,
  },
  {
    name: "rls academic_profiles",
    sql: `ALTER TABLE public.academic_profiles ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy academic_profiles select",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='academic_profiles' AND policyname='Learners can view own academic profile') THEN
    CREATE POLICY "Learners can view own academic profile" ON public.academic_profiles FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "policy academic_profiles insert",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='academic_profiles' AND policyname='Learners can insert own academic profile') THEN
    CREATE POLICY "Learners can insert own academic profile" ON public.academic_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "policy academic_profiles update",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='academic_profiles' AND policyname='Learners can update own academic profile') THEN
    CREATE POLICY "Learners can update own academic profile" ON public.academic_profiles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "trigger academic_profiles updated_at",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_triggers WHERE tgname='update_academic_profiles_updated_at') THEN
    CREATE TRIGGER update_academic_profiles_updated_at
      BEFORE UPDATE ON public.academic_profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$`,
  },
  {
    name: "index academic_profiles",
    sql: `CREATE INDEX IF NOT EXISTS idx_academic_profiles_user_id ON public.academic_profiles (user_id)`,
  },

  // tutor_tutorials
  {
    name: "create tutor_tutorials",
    sql: `
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
                      CHECK (status IN ('draft','published','archived')),
  watch_count       INTEGER NOT NULL DEFAULT 0,
  completion_rate   NUMERIC(5,2) DEFAULT 0,
  rating            NUMERIC(3,2) DEFAULT 0,
  review_count      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  },
  {
    name: "rls tutor_tutorials",
    sql: `ALTER TABLE public.tutor_tutorials ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy tutor_tutorials select",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_tutorials' AND policyname='Anyone can read published tutorials') THEN
    CREATE POLICY "Anyone can read published tutorials" ON public.tutor_tutorials FOR SELECT
      USING (status = 'published' OR auth.uid() = tutor_id);
  END IF;
END $$`,
  },
  {
    name: "policy tutor_tutorials insert",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_tutorials' AND policyname='Tutors can insert own tutorials') THEN
    CREATE POLICY "Tutors can insert own tutorials" ON public.tutor_tutorials FOR INSERT WITH CHECK (auth.uid() = tutor_id);
  END IF;
END $$`,
  },
  {
    name: "policy tutor_tutorials update",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_tutorials' AND policyname='Tutors can update own tutorials') THEN
    CREATE POLICY "Tutors can update own tutorials" ON public.tutor_tutorials FOR UPDATE USING (auth.uid() = tutor_id);
  END IF;
END $$`,
  },
  {
    name: "policy tutor_tutorials delete",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_tutorials' AND policyname='Tutors can delete own tutorials') THEN
    CREATE POLICY "Tutors can delete own tutorials" ON public.tutor_tutorials FOR DELETE USING (auth.uid() = tutor_id);
  END IF;
END $$`,
  },
  {
    name: "trigger tutor_tutorials updated_at",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_triggers WHERE tgname='update_tutor_tutorials_updated_at') THEN
    CREATE TRIGGER update_tutor_tutorials_updated_at
      BEFORE UPDATE ON public.tutor_tutorials
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$`,
  },
  {
    name: "indexes tutor_tutorials",
    sql: `CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_tutor_id ON public.tutor_tutorials (tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_subject ON public.tutor_tutorials (subject);
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_status ON public.tutor_tutorials (status);
CREATE INDEX IF NOT EXISTS idx_tutor_tutorials_curriculum_grade ON public.tutor_tutorials (curriculum, grade)`,
  },

  // topic_tutor_rankings
  {
    name: "create topic_tutor_rankings",
    sql: `
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
)`,
  },
  {
    name: "rls topic_tutor_rankings",
    sql: `ALTER TABLE public.topic_tutor_rankings ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy topic_tutor_rankings",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='topic_tutor_rankings' AND policyname='Anyone can read topic rankings') THEN
    CREATE POLICY "Anyone can read topic rankings" ON public.topic_tutor_rankings FOR SELECT TO authenticated USING (true);
  END IF;
END $$`,
  },
  {
    name: "indexes topic_tutor_rankings",
    sql: `CREATE INDEX IF NOT EXISTS idx_topic_tutor_rankings_subject_topic ON public.topic_tutor_rankings (subject, topic);
CREATE INDEX IF NOT EXISTS idx_topic_tutor_rankings_tutor_id ON public.topic_tutor_rankings (tutor_id)`,
  },

  // tutorial_watch_events
  {
    name: "create tutorial_watch_events",
    sql: `
CREATE TABLE IF NOT EXISTS public.tutorial_watch_events (
  id              UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tutorial_id     UUID NOT NULL REFERENCES public.tutor_tutorials(id) ON DELETE CASCADE,
  learner_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  watch_seconds   INTEGER NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT false,
  booked_tutor    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tutorial_watch_unique UNIQUE (tutorial_id, learner_id)
)`,
  },
  {
    name: "rls tutorial_watch_events",
    sql: `ALTER TABLE public.tutorial_watch_events ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy tutorial_watch_events",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutorial_watch_events' AND policyname='Learners can manage own watch events') THEN
    CREATE POLICY "Learners can manage own watch events" ON public.tutorial_watch_events FOR ALL USING (auth.uid() = learner_id);
  END IF;
END $$`,
  },
  {
    name: "indexes tutorial_watch_events",
    sql: `CREATE INDEX IF NOT EXISTS idx_tutorial_watch_events_tutorial ON public.tutorial_watch_events (tutorial_id);
CREATE INDEX IF NOT EXISTS idx_tutorial_watch_events_learner ON public.tutorial_watch_events (learner_id)`,
  },

  // library_saved_items
  {
    name: "create library_saved_items",
    sql: `
CREATE TABLE IF NOT EXISTS public.library_saved_items (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_id   TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  title         TEXT NOT NULL,
  saved_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT library_saved_items_unique UNIQUE (user_id, resource_id)
)`,
  },
  {
    name: "rls library_saved_items",
    sql: `ALTER TABLE public.library_saved_items ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy library_saved_items",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='library_saved_items' AND policyname='Users can manage own saved items') THEN
    CREATE POLICY "Users can manage own saved items" ON public.library_saved_items FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "index library_saved_items",
    sql: `CREATE INDEX IF NOT EXISTS idx_library_saved_items_user ON public.library_saved_items (user_id)`,
  },

  // Storage buckets
  {
    name: "storage buckets",
    sql: `INSERT INTO storage.buckets (id, name, public) VALUES ('tutorial-videos','tutorial-videos',true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('tutorial-thumbnails','tutorial-thumbnails',true) ON CONFLICT (id) DO NOTHING`,
  },

  // ── Migration 2: Backend Functions ──────────────────────────────────────
  {
    name: "fn upsert_academic_profile",
    sql: `
CREATE OR REPLACE FUNCTION public.upsert_academic_profile(
  p_curriculum TEXT, p_grade TEXT, p_subjects TEXT[], p_exam_year INTEGER DEFAULT NULL
)
RETURNS public.academic_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_row public.academic_profiles;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.academic_profiles (user_id, curriculum, grade, subjects, exam_year, updated_at)
  VALUES (v_uid, COALESCE(NULLIF(p_curriculum,''),'ZIMSEC'), p_grade, COALESCE(p_subjects,'{}'), p_exam_year, now())
  ON CONFLICT (user_id) DO UPDATE SET
    curriculum = EXCLUDED.curriculum,
    grade      = EXCLUDED.grade,
    subjects   = EXCLUDED.subjects,
    exam_year  = EXCLUDED.exam_year,
    updated_at = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$`,
  },
  {
    name: "grant upsert_academic_profile",
    sql: `GRANT EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT,TEXT,TEXT[],INTEGER) TO authenticated`,
  },
  {
    name: "fn get_published_tutorials",
    sql: `
CREATE OR REPLACE FUNCTION public.get_published_tutorials(
  p_curriculum TEXT DEFAULT NULL,
  p_subject    TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID, tutor_id UUID, title TEXT, description TEXT,
  subject TEXT, topic TEXT, subtopic TEXT, grade TEXT, curriculum TEXT,
  video_url TEXT, thumbnail_url TEXT, duration_label TEXT,
  watch_count INTEGER, completion_rate NUMERIC, rating NUMERIC,
  review_count INTEGER, created_at TIMESTAMPTZ,
  tutor_full_name TEXT, tutor_avatar_url TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    t.id, t.tutor_id, t.title, t.description,
    t.subject, t.topic, t.subtopic, t.grade, t.curriculum,
    t.video_url, t.thumbnail_url, t.duration_label,
    t.watch_count, t.completion_rate, t.rating,
    t.review_count, t.created_at,
    p.full_name  AS tutor_full_name,
    p.avatar_url AS tutor_avatar_url
  FROM public.tutor_tutorials t
  LEFT JOIN public.profiles p ON p.id = t.tutor_id
  WHERE t.status = 'published'
    AND (p_curriculum IS NULL OR t.curriculum = p_curriculum)
    AND (p_subject    IS NULL OR t.subject    = p_subject)
  ORDER BY t.created_at DESC
$$`,
  },
  {
    name: "grant get_published_tutorials",
    sql: `GRANT EXECUTE ON FUNCTION public.get_published_tutorials(TEXT,TEXT) TO anon, authenticated`,
  },
  {
    name: "realtime publication",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='tutor_tutorials') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tutor_tutorials;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='academic_profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_profiles;
  END IF;
END $$`,
  },

  // ── Migration 3: Subject Icons ───────────────────────────────────────────
  {
    name: "subjects icon columns",
    sql: `ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS icon_emoji    TEXT,
  ADD COLUMN IF NOT EXISTS icon_gradient TEXT`,
  },
  {
    name: "subjects unique index",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_user_lower_name_unique
  ON public.subjects (user_id, lower(name))`,
  },
  {
    name: "backfill subject icons",
    sql: `UPDATE public.subjects SET
  icon_emoji = CASE lower(name)
    WHEN 'mathematics'           THEN '📐'
    WHEN 'maths'                 THEN '📐'
    WHEN 'math'                  THEN '📐'
    WHEN 'physics'               THEN '⚛️'
    WHEN 'chemistry'             THEN '🧪'
    WHEN 'biology'               THEN '🧬'
    WHEN 'english'               THEN '📖'
    WHEN 'english language'      THEN '📖'
    WHEN 'literature'            THEN '🪶'
    WHEN 'geography'             THEN '🌍'
    WHEN 'history'               THEN '🏛️'
    WHEN 'computer science'      THEN '💻'
    WHEN 'ict'                   THEN '💻'
    WHEN 'economics'             THEN '📢'
    WHEN 'accounting'            THEN '🧮'
    WHEN 'business studies'      THEN '💼'
    WHEN 'agriculture'           THEN '🚜'
    WHEN 'foreign languages'     THEN '🗣️'
    WHEN 'design & technology'   THEN '🛠️'
    WHEN 'engineering graphics'  THEN '📘'
    WHEN 'sociology'             THEN '👥'
    WHEN 'psychology'            THEN '🧠'
    WHEN 'religious studies'     THEN '✝️'
    WHEN 'law'                   THEN '⚖️'
    WHEN 'music'                 THEN '🎵'
    WHEN 'health'                THEN '🩺'
    WHEN 'environmental science' THEN '🌱'
    WHEN 'physical education'    THEN '⚽'
    WHEN 'first aid'             THEN '🛡️'
    WHEN 'art'                   THEN '🎨'
    ELSE '📚'
  END,
  icon_gradient = CASE lower(name)
    WHEN 'mathematics'           THEN 'from-purple-500 to-violet-600'
    WHEN 'maths'                 THEN 'from-purple-500 to-violet-600'
    WHEN 'math'                  THEN 'from-purple-500 to-violet-600'
    WHEN 'physics'               THEN 'from-blue-500 to-indigo-600'
    WHEN 'chemistry'             THEN 'from-green-500 to-emerald-600'
    WHEN 'biology'               THEN 'from-pink-500 to-rose-600'
    WHEN 'english'               THEN 'from-orange-500 to-amber-600'
    WHEN 'english language'      THEN 'from-orange-500 to-amber-600'
    WHEN 'literature'            THEN 'from-red-500 to-rose-600'
    WHEN 'geography'             THEN 'from-lime-500 to-green-600'
    WHEN 'history'               THEN 'from-stone-500 to-amber-700'
    WHEN 'computer science'      THEN 'from-cyan-500 to-sky-600'
    WHEN 'ict'                   THEN 'from-cyan-500 to-sky-600'
    WHEN 'economics'             THEN 'from-teal-500 to-cyan-600'
    WHEN 'accounting'            THEN 'from-blue-500 to-indigo-600'
    WHEN 'business studies'      THEN 'from-teal-500 to-cyan-600'
    WHEN 'agriculture'           THEN 'from-green-500 to-lime-600'
    WHEN 'foreign languages'     THEN 'from-yellow-500 to-amber-600'
    WHEN 'design & technology'   THEN 'from-purple-500 to-indigo-600'
    WHEN 'engineering graphics'  THEN 'from-blue-600 to-indigo-800'
    WHEN 'sociology'             THEN 'from-fuchsia-500 to-pink-600'
    WHEN 'psychology'            THEN 'from-violet-500 to-purple-700'
    WHEN 'religious studies'     THEN 'from-yellow-500 to-amber-600'
    WHEN 'law'                   THEN 'from-slate-500 to-gray-700'
    WHEN 'music'                 THEN 'from-indigo-500 to-violet-600'
    WHEN 'health'                THEN 'from-cyan-400 to-teal-500'
    WHEN 'environmental science' THEN 'from-emerald-400 to-teal-500'
    WHEN 'physical education'    THEN 'from-green-500 to-lime-600'
    WHEN 'first aid'             THEN 'from-red-500 to-rose-600'
    WHEN 'art'                   THEN 'from-yellow-500 to-amber-600'
    ELSE 'from-gray-500 to-slate-600'
  END
WHERE icon_emoji IS NULL`,
  },

  // ── Migration 4: get_subject_context RPC ────────────────────────────────
  {
    name: "fn get_subject_context",
    sql: `
CREATE OR REPLACE FUNCTION public.get_subject_context(
  p_subject_id UUID,
  p_topic_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid              UUID;
  v_subject_name     TEXT;
  v_all_topics       JSONB := '[]';
  v_topic            JSONB := NULL;
  v_syllabus_topic   JSONB := NULL;
  v_merged_topic     JSONB := NULL;
  v_exam_patterns    JSONB := '[]';
  v_past_questions   JSONB := '[]';
  v_doc              RECORD;
  v_q                JSONB;
  v_t                JSONB;
  v_mastered_count   INTEGER := 0;
  v_total_count      INTEGER := 0;
  v_syllabus_progress INTEGER := 0;
  v_exam_weight      INTEGER := 0;
  v_freq_sum         NUMERIC := 0;
  v_freq_count       INTEGER := 0;
  v_context          TEXT    := '';
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT s.name, COALESCE(s.topics,'[]'::jsonb)
    INTO v_subject_name, v_all_topics
    FROM public.subjects s
   WHERE s.id = p_subject_id AND s.user_id = v_uid;
  IF v_subject_name IS NULL THEN RAISE EXCEPTION 'Subject not found'; END IF;

  SELECT t INTO v_topic
    FROM jsonb_array_elements(v_all_topics) t
   WHERE lower(COALESCE(t->>'name','')) = lower(p_topic_name)
      OR lower(COALESCE(t->>'name','')) LIKE '%'||lower(p_topic_name)||'%'
      OR lower(p_topic_name) LIKE '%'||lower(COALESCE(t->>'name',''))||'%'
   LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'topic_name',ep.topic_name,'frequency_score',ep.frequency_score,
      'avg_marks',COALESCE(ep.avg_marks,0),
      'question_types',COALESCE(ep.question_types,'[]'::jsonb),'year',ep.year)),'[]')
    INTO v_exam_patterns
    FROM public.exam_patterns ep
   WHERE ep.subject_id = p_subject_id AND ep.user_id = v_uid;

  FOR v_doc IN
    SELECT d.parsed_content, d.type FROM public.documents d
     WHERE d.user_id = v_uid AND d.is_processed = true
       AND d.type IN ('past_paper','syllabus')
       AND lower(d.subject) = lower(v_subject_name)
  LOOP
    IF v_doc.type = 'past_paper' THEN
      FOR v_q IN SELECT value FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'questions','[]')) LOOP
        IF lower(COALESCE(v_q->>'topic','')) LIKE '%'||lower(p_topic_name)||'%'
          OR lower(p_topic_name) LIKE '%'||lower(COALESCE(v_q->>'topic',''))||'%' THEN
          v_past_questions := v_past_questions || jsonb_build_array(jsonb_build_object(
            'question_number',COALESCE(v_q->>'question_number',''),
            'topic',COALESCE(v_q->>'topic',''),
            'subtopic',v_q->>'subtopic',
            'marks',COALESCE((v_q->>'marks')::numeric,1),
            'question_type',COALESCE(v_q->>'question_type','structured'),
            'difficulty',COALESCE(v_q->>'difficulty','medium'),
            'command_words',COALESCE(v_q->'command_words','[]'),
            'concepts_tested',COALESCE(v_q->'concepts_tested','[]')));
        END IF;
      END LOOP;
    ELSIF v_doc.type = 'syllabus' AND v_syllabus_topic IS NULL THEN
      FOR v_t IN SELECT value FROM jsonb_array_elements(COALESCE(v_doc.parsed_content->'topics','[]')) LOOP
        IF lower(COALESCE(v_t->>'name','')) LIKE '%'||lower(p_topic_name)||'%'
          OR lower(p_topic_name) LIKE '%'||lower(COALESCE(v_t->>'name',''))||'%' THEN
          v_syllabus_topic := jsonb_build_object(
            'id',COALESCE(v_t->>'id',''),'name',COALESCE(v_t->>'name',p_topic_name),
            'subtopics',COALESCE(v_t->'subtopics','[]'),
            'learningObjectives',COALESCE(v_t->'learningObjectives',COALESCE(v_t->'learning_objectives','[]')),
            'concepts',COALESCE(v_t->'concepts',COALESCE(v_t->'key_concepts','[]')),
            'examWeight',COALESCE((v_t->>'examWeight')::numeric,COALESCE((v_t->>'exam_weight')::numeric,0)),
            'prerequisites',COALESCE(v_t->'prerequisites','[]'));
          EXIT;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  v_merged_topic := COALESCE(v_topic, v_syllabus_topic);
  IF v_topic IS NOT NULL AND v_syllabus_topic IS NOT NULL THEN
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'subtopics','[]'))>0 THEN
      v_merged_topic := jsonb_set(v_merged_topic,'{subtopics}',v_syllabus_topic->'subtopics',true); END IF;
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'learningObjectives','[]'))>0 THEN
      v_merged_topic := jsonb_set(v_merged_topic,'{learningObjectives}',v_syllabus_topic->'learningObjectives',true); END IF;
    IF jsonb_array_length(COALESCE(v_syllabus_topic->'concepts','[]'))>0 THEN
      v_merged_topic := jsonb_set(v_merged_topic,'{concepts}',v_syllabus_topic->'concepts',true); END IF;
  END IF;

  v_total_count := jsonb_array_length(v_all_topics);
  SELECT COUNT(*) INTO v_mastered_count FROM public.topic_mastery tm
   WHERE tm.subject_id = p_subject_id AND tm.user_id = v_uid
     AND COALESCE(tm.mastery_percentage,0) >= 70;
  IF v_total_count > 0 THEN
    v_syllabus_progress := ROUND((v_mastered_count::numeric/v_total_count::numeric)*100)::int;
  END IF;

  FOR v_t IN SELECT value FROM jsonb_array_elements(v_exam_patterns) LOOP
    IF lower(COALESCE(v_t->>'topic_name','')) LIKE '%'||lower(p_topic_name)||'%'
      OR lower(p_topic_name) LIKE '%'||lower(COALESCE(v_t->>'topic_name',''))||'%' THEN
      v_freq_sum   := v_freq_sum + COALESCE((v_t->>'frequency_score')::numeric,0);
      v_freq_count := v_freq_count + 1;
    END IF;
  END LOOP;
  IF v_freq_count > 0 THEN v_exam_weight := ROUND(v_freq_sum/v_freq_count)::int;
  ELSE v_exam_weight := COALESCE((v_merged_topic->>'examWeight')::numeric,0)::int; END IF;

  IF v_merged_topic IS NOT NULL THEN
    v_context := '=== SYLLABUS DATA FOR: '||p_topic_name||E' ===\n';
    IF jsonb_array_length(COALESCE(v_merged_topic->'subtopics','[]'))>0 THEN
      v_context := v_context||'Subtopics: '||(SELECT string_agg(value::text,' | ') FROM jsonb_array_elements_text(v_merged_topic->'subtopics'))||E'\n'; END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'learningObjectives','[]'))>0 THEN
      v_context := v_context||E'Learning Objectives:\n  • '||(SELECT string_agg(value::text,E'\n  • ') FROM jsonb_array_elements_text(v_merged_topic->'learningObjectives'))||E'\n'; END IF;
    IF jsonb_array_length(COALESCE(v_merged_topic->'concepts','[]'))>0 THEN
      v_context := v_context||'Key Concepts: '||(SELECT string_agg(value::text,', ') FROM jsonb_array_elements_text(v_merged_topic->'concepts'))||E'\n'; END IF;
    IF v_exam_weight > 0 THEN
      v_context := v_context||'Exam Weight Estimate: '||v_exam_weight||'%'||E'\n'; END IF;
  END IF;

  RETURN jsonb_build_object(
    'topic',v_merged_topic,'allTopics',v_all_topics,
    'examPatterns',v_exam_patterns,'pastPaperQuestions',v_past_questions,
    'examWeightFromPapers',v_exam_weight,
    'masteredTopicCount',v_mastered_count,'totalTopicCount',v_total_count,
    'syllabusProgress',v_syllabus_progress,'curriculumContext',trim(v_context));
END;
$$`,
  },
  {
    name: "grant get_subject_context",
    sql: `GRANT EXECUTE ON FUNCTION public.get_subject_context(UUID,TEXT) TO authenticated`,
  },

  // ── Migration 5: StudyMode Tables ───────────────────────────────────────
  {
    name: "create quiz_attempts",
    sql: `
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
)`,
  },
  {
    name: "rls quiz_attempts",
    sql: `ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy quiz_attempts",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='quiz_attempts' AND policyname='Users can manage own quiz attempts') THEN
    CREATE POLICY "Users can manage own quiz attempts" ON public.quiz_attempts FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "indexes quiz_attempts",
    sql: `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_subject ON public.quiz_attempts (user_id, subject_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_review_date ON public.quiz_attempts (user_id, next_review_date)`,
  },

  {
    name: "create user_progress",
    sql: `
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
)`,
  },
  {
    name: "rls user_progress",
    sql: `ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy user_progress",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_progress' AND policyname='Users can manage own progress') THEN
    CREATE POLICY "Users can manage own progress" ON public.user_progress FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "trigger user_progress updated_at",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_triggers WHERE tgname='update_user_progress_updated_at') THEN
    CREATE TRIGGER update_user_progress_updated_at
      BEFORE UPDATE ON public.user_progress
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$`,
  },

  {
    name: "create study_schedule",
    sql: `
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
)`,
  },
  {
    name: "rls study_schedule",
    sql: `ALTER TABLE public.study_schedule ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy study_schedule",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_schedule' AND policyname='Users can manage own study schedule') THEN
    CREATE POLICY "Users can manage own study schedule" ON public.study_schedule FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "index study_schedule",
    sql: `CREATE INDEX IF NOT EXISTS idx_study_schedule_user_date ON public.study_schedule (user_id, scheduled_date)`,
  },
  {
    name: "trigger study_schedule updated_at",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_triggers WHERE tgname='update_study_schedule_updated_at') THEN
    CREATE TRIGGER update_study_schedule_updated_at
      BEFORE UPDATE ON public.study_schedule
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$`,
  },

  {
    name: "create subject_exams",
    sql: `
CREATE TABLE IF NOT EXISTS public.subject_exams (
  id           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id   UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  subject_name TEXT NOT NULL,
  exam_name    TEXT NOT NULL,
  exam_date    DATE NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  },
  {
    name: "rls subject_exams",
    sql: `ALTER TABLE public.subject_exams ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy subject_exams",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='subject_exams' AND policyname='Users can manage own subject exams') THEN
    CREATE POLICY "Users can manage own subject exams" ON public.subject_exams FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "index subject_exams",
    sql: `CREATE INDEX IF NOT EXISTS idx_subject_exams_user_date ON public.subject_exams (user_id, exam_date)`,
  },
  {
    name: "trigger subject_exams updated_at",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_triggers WHERE tgname='update_subject_exams_updated_at') THEN
    CREATE TRIGGER update_subject_exams_updated_at
      BEFORE UPDATE ON public.subject_exams
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$`,
  },

  {
    name: "create exam_settings",
    sql: `
CREATE TABLE IF NOT EXISTS public.exam_settings (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_name  TEXT NOT NULL,
  exam_date  DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT exam_settings_user_id_unique UNIQUE (user_id)
)`,
  },
  {
    name: "rls exam_settings",
    sql: `ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy exam_settings",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='exam_settings' AND policyname='Users can manage own exam settings') THEN
    CREATE POLICY "Users can manage own exam settings" ON public.exam_settings FOR ALL
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "trigger exam_settings updated_at",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_triggers WHERE tgname='update_exam_settings_updated_at') THEN
    CREATE TRIGGER update_exam_settings_updated_at
      BEFORE UPDATE ON public.exam_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$`,
  },

  // Fix existing tables
  {
    name: "academic_profiles extra columns",
    sql: `ALTER TABLE public.academic_profiles
  ADD COLUMN IF NOT EXISTS study_level  TEXT,
  ADD COLUMN IF NOT EXISTS exam_board   TEXT,
  ADD COLUMN IF NOT EXISTS school_name  TEXT,
  ADD COLUMN IF NOT EXISTS target_grade TEXT`,
  },
  {
    name: "backfill study_level",
    sql: `UPDATE public.academic_profiles
  SET study_level = grade
  WHERE study_level IS NULL AND grade IS NOT NULL`,
  },
  {
    name: "documents document_type column",
    sql: `ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type TEXT GENERATED ALWAYS AS (type) STORED`,
  },
  {
    name: "notify pgrst reload",
    sql: `NOTIFY pgrst, 'reload schema'`,
  },

  // ── Migration 7: Student Profile Enhancements ─────────────────────────────
  // Adds student_email, guardian_email, exam_dates columns to academic_profiles
  // and updates the upsert RPC to accept the new fields.
  {
    name: "academic_profiles email + exam_dates columns",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'academic_profiles' AND column_name = 'student_email'
  ) THEN
    ALTER TABLE public.academic_profiles ADD COLUMN student_email TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'academic_profiles' AND column_name = 'guardian_email'
  ) THEN
    ALTER TABLE public.academic_profiles ADD COLUMN guardian_email TEXT DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'academic_profiles' AND column_name = 'exam_dates'
  ) THEN
    ALTER TABLE public.academic_profiles ADD COLUMN exam_dates JSONB DEFAULT '[]'::jsonb;
  END IF;
END$$`,
  },
  {
    name: "fn upsert_academic_profile v2 (with emails + exam_dates)",
    sql: `
CREATE OR REPLACE FUNCTION public.upsert_academic_profile(
  p_curriculum TEXT,
  p_grade TEXT,
  p_subjects TEXT[],
  p_exam_year INTEGER DEFAULT NULL,
  p_student_email TEXT DEFAULT NULL,
  p_guardian_email TEXT DEFAULT NULL,
  p_exam_dates JSONB DEFAULT '[]'::jsonb
)
RETURNS public.academic_profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_row public.academic_profiles;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  INSERT INTO public.academic_profiles (
    user_id, curriculum, grade, subjects, exam_year,
    student_email, guardian_email, exam_dates, updated_at
  )
  VALUES (
    v_uid,
    COALESCE(NULLIF(p_curriculum,''),'ZIMSEC'),
    p_grade,
    COALESCE(p_subjects,'{}'),
    p_exam_year,
    p_student_email,
    p_guardian_email,
    COALESCE(p_exam_dates,'[]'::jsonb),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    curriculum     = EXCLUDED.curriculum,
    grade          = EXCLUDED.grade,
    subjects       = EXCLUDED.subjects,
    exam_year      = EXCLUDED.exam_year,
    student_email  = COALESCE(EXCLUDED.student_email, academic_profiles.student_email),
    guardian_email  = COALESCE(EXCLUDED.guardian_email, academic_profiles.guardian_email),
    exam_dates     = EXCLUDED.exam_dates,
    updated_at     = now()
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$`,
  },
  {
    name: "grant upsert_academic_profile v2",
    sql: `GRANT EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT,TEXT,TEXT[],INTEGER,TEXT,TEXT,JSONB) TO authenticated`,
  },

  // study_activity table
  {
    name: "create study_activity",
    sql: `
CREATE TABLE IF NOT EXISTS public.study_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'task',
  task_completed BOOLEAN NOT NULL DEFAULT false,
  score NUMERIC(5,2) DEFAULT NULL,
  topic TEXT DEFAULT NULL,
  duration_minutes INTEGER DEFAULT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`,
  },
  {
    name: "rls study_activity",
    sql: `ALTER TABLE public.study_activity ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy study_activity select",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_activity' AND policyname='study_activity_select_own') THEN
    CREATE POLICY study_activity_select_own ON public.study_activity FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "policy study_activity insert",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_activity' AND policyname='study_activity_insert_own') THEN
    CREATE POLICY study_activity_insert_own ON public.study_activity FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "policy study_activity update",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='study_activity' AND policyname='study_activity_update_own') THEN
    CREATE POLICY study_activity_update_own ON public.study_activity FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "indexes study_activity",
    sql: `CREATE INDEX IF NOT EXISTS idx_study_activity_user_date ON public.study_activity (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_study_activity_user_subject ON public.study_activity (user_id, subject)`,
  },

  // tutor_booking_insights table
  {
    name: "create tutor_booking_insights",
    sql: `
CREATE TABLE IF NOT EXISTS public.tutor_booking_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  insights_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
)`,
  },
  {
    name: "rls tutor_booking_insights",
    sql: `ALTER TABLE public.tutor_booking_insights ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy tutor_booking_insights select",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_booking_insights' AND policyname='tutor_booking_insights_tutor_select') THEN
    CREATE POLICY tutor_booking_insights_tutor_select ON public.tutor_booking_insights FOR SELECT USING (auth.uid() = tutor_id);
  END IF;
END $$`,
  },
  {
    name: "policy tutor_booking_insights insert",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_booking_insights' AND policyname='tutor_booking_insights_insert') THEN
    CREATE POLICY tutor_booking_insights_insert ON public.tutor_booking_insights FOR INSERT WITH CHECK (true);
  END IF;
END $$`,
  },
  {
    name: "indexes tutor_booking_insights",
    sql: `CREATE INDEX IF NOT EXISTS idx_tutor_booking_insights_booking ON public.tutor_booking_insights (booking_id);
CREATE INDEX IF NOT EXISTS idx_tutor_booking_insights_tutor ON public.tutor_booking_insights (tutor_id)`,
  },

  // analytics_reports table
  {
    name: "create analytics_reports",
    sql: `
CREATE TABLE IF NOT EXISTS public.analytics_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'guardian_weekly',
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT analytics_reports_unique_week UNIQUE(user_id, week_start, report_type)
)`,
  },
  {
    name: "rls analytics_reports",
    sql: `ALTER TABLE public.analytics_reports ENABLE ROW LEVEL SECURITY`,
  },
  {
    name: "policy analytics_reports select",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analytics_reports' AND policyname='analytics_reports_select_own') THEN
    CREATE POLICY analytics_reports_select_own ON public.analytics_reports FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$`,
  },
  {
    name: "policy analytics_reports insert",
    sql: `DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='analytics_reports' AND policyname='analytics_reports_insert') THEN
    CREATE POLICY analytics_reports_insert ON public.analytics_reports FOR INSERT WITH CHECK (true);
  END IF;
END $$`,
  },
  {
    name: "index analytics_reports",
    sql: `CREATE INDEX IF NOT EXISTS idx_analytics_reports_user_week ON public.analytics_reports (user_id, week_start DESC)`,
  },

  // Realtime for study_activity
  {
    name: "realtime study_activity",
    sql: `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='study_activity') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.study_activity;
  END IF;
END $$`,
  },

  // Final schema reload after all new steps
  {
    name: "notify pgrst reload final",
    sql: `NOTIFY pgrst, 'reload schema'`,
  },
];

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth check
  const token = req.headers.get("x-migration-token");
  if (token !== MIGRATION_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Read optional range from body
  let startStep = 0;
  let endStep = STEPS.length;
  try {
    const body = await req.json().catch(() => ({})) as { startStep?: number; endStep?: number };
    if (typeof body.startStep === "number") startStep = body.startStep;
    if (typeof body.endStep   === "number") endStep   = body.endStep;
  } catch (_) { /* no body */ }

  // Get DB credentials
  const SUPABASE_DB_URL = Deno.env.get("SUPABASE_DB_URL");
  const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!SUPABASE_DB_URL && (!SUPABASE_URL || !SERVICE_KEY)) {
    return new Response(
      JSON.stringify({
        error: "Missing credentials",
        available_env: Object.keys(Deno.env.toObject()).filter(k => k.startsWith("SUPABASE")),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const stepsToRun = STEPS.slice(startStep, endStep);
  const results: Array<{ step: number; name: string; success: boolean; error?: string }> = [];
  let hasErrors = false;

  if (SUPABASE_DB_URL) {
    // ── Path A: direct postgres connection via postgres.js ──────────────
    const postgresModule = await import("https://deno.land/x/postgres@v0.17.0/mod.ts");
    const postgres = (postgresModule as any).default ?? postgresModule;
    const sql = postgres(SUPABASE_DB_URL, { max: 1, idle_timeout: 30, connect_timeout: 10 });

    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i];
      const idx  = startStep + i;
      try {
        await sql.unsafe(step.sql);
        results.push({ step: idx, name: step.name, success: true });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ step: idx, name: step.name, success: false, error: msg });
        hasErrors = true;
      }
    }

    await sql.end();

  } else {
    // ── Path B: pg-meta HTTP API (service role, REST) ───────────────────
    // Supabase exposes /pg/query on their internal management layer.
    // This is accessible from Edge Functions via the project's REST base URL.
    const pgMetaUrl = `${SUPABASE_URL}/pg/query`;

    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i];
      const idx  = startStep + i;
      try {
        const resp = await fetch(pgMetaUrl, {
          method: "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "apikey":        SERVICE_KEY,
          },
          body: JSON.stringify({ query: step.sql }),
        });
        if (resp.ok) {
          results.push({ step: idx, name: step.name, success: true });
        } else {
          const err = await resp.text();
          results.push({ step: idx, name: step.name, success: false, error: `HTTP ${resp.status}: ${err.substring(0,200)}` });
          hasErrors = true;
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ step: idx, name: step.name, success: false, error: msg });
        hasErrors = true;
      }
    }
  }

  return new Response(
    JSON.stringify({
      success:    !hasErrors,
      method:     SUPABASE_DB_URL ? "postgres.js" : "pg-meta-http",
      totalSteps: stepsToRun.length,
      startStep,
      endStep:    startStep + stepsToRun.length,
      results,
    }),
    {
      status: hasErrors ? 207 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
