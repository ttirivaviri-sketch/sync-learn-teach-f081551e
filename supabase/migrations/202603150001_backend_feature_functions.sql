-- Backend function support for learner profile persistence and tutorial library feed

-- 1) Upsert learner academic profile via backend RPC
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
    user_id,
    curriculum,
    grade,
    subjects,
    exam_year,
    updated_at
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

GRANT EXECUTE ON FUNCTION public.upsert_academic_profile(TEXT, TEXT, TEXT[], INTEGER) TO authenticated;

-- 2) Backend feed for published tutorials used by student library
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
    p.full_name AS tutor_full_name,
    p.avatar_url AS tutor_avatar_url
  FROM public.tutor_tutorials t
  LEFT JOIN public.profiles p ON p.id = t.tutor_id
  WHERE t.status = 'published'
    AND (p_curriculum IS NULL OR t.curriculum = p_curriculum)
    AND (p_subject IS NULL OR t.subject = p_subject)
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_published_tutorials(TEXT, TEXT) TO anon, authenticated;

-- 3) Ensure realtime publication includes core learning tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tutor_tutorials'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tutor_tutorials;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'academic_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_profiles;
  END IF;
END
$$;
