DO $$
DECLARE
  v_user UUID := 'ecd47c48-3016-432b-9fb5-da74b8007902';
  v_old  UUID := 'c40155cf-45ae-4393-93d3-f2aa6d1912ae';
  v_new  UUID := 'a5b9d408-074c-4dc9-8441-abafcb1b306f';
BEGIN
  -- Drop daily_tasks for the old subject that would clash on unique key; safe — they're regenerated daily.
  DELETE FROM public.daily_tasks WHERE subject_id = v_old AND user_id = v_user;

  UPDATE public.topic_mastery      SET subject_id = v_new WHERE subject_id = v_old AND user_id = v_user;
  UPDATE public.quiz_attempts      SET subject_id = v_new WHERE subject_id = v_old AND user_id = v_user;
  UPDATE public.paper_blueprints   SET subject_id = v_new WHERE subject_id = v_old AND user_id = v_user;
  UPDATE public.exam_patterns      SET subject_id = v_new WHERE subject_id = v_old AND user_id = v_user;
  UPDATE public.subject_exams      SET subject_id = v_new WHERE subject_id = v_old AND user_id = v_user;
  UPDATE public.flashcards         SET subject_id = v_new WHERE subject_id = v_old AND user_id = v_user;
  UPDATE public.mock_exam_attempts SET subject_id = v_new WHERE subject_id = v_old AND user_id = v_user;

  DELETE FROM public.subjects WHERE id = v_old;
  UPDATE public.subjects SET name = 'Mathematics' WHERE id = v_new;
END $$;

CREATE OR REPLACE FUNCTION public.subject_canonical_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(p_name, ''), '\s*\([^)]*\)\s*', ' ', 'g')));
$$;

CREATE UNIQUE INDEX IF NOT EXISTS subjects_user_canonical_name_key
  ON public.subjects (user_id, public.subject_canonical_name(name));