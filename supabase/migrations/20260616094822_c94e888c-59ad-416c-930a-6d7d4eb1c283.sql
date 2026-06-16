
-- =====================================================================
-- P13: Student analytics counters & trends
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.student_analytics_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  school_id UUID NULL,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  homework_completed INTEGER NOT NULL DEFAULT 0,
  quiz_count INTEGER NOT NULL DEFAULT 0,
  quiz_score_sum NUMERIC NOT NULL DEFAULT 0,
  quiz_score_max_sum NUMERIC NOT NULL DEFAULT 0,
  flashcards_reviewed INTEGER NOT NULL DEFAULT 0,
  flashcard_mastery_avg NUMERIC NOT NULL DEFAULT 0,
  resources_opened INTEGER NOT NULL DEFAULT 0,
  minutes_studied INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day)
);

CREATE INDEX IF NOT EXISTS student_analytics_daily_user_day_idx
  ON public.student_analytics_daily (user_id, day DESC);
CREATE INDEX IF NOT EXISTS student_analytics_daily_school_day_idx
  ON public.student_analytics_daily (school_id, day DESC);

GRANT SELECT ON public.student_analytics_daily TO authenticated;
GRANT ALL ON public.student_analytics_daily TO service_role;

ALTER TABLE public.student_analytics_daily ENABLE ROW LEVEL SECURITY;

-- Students see their own
CREATE POLICY "student reads own analytics"
ON public.student_analytics_daily FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Teachers/admins of the same school can read
CREATE POLICY "school staff reads student analytics"
ON public.student_analytics_daily FOR SELECT
TO authenticated
USING (
  school_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.school_memberships sm
    WHERE sm.school_id = student_analytics_daily.school_id
      AND sm.user_id = auth.uid()
      AND sm.status = 'active'
      AND sm.role IN ('school_admin','school_teacher')
  )
);

-- =====================================================================
-- Helper: resolve a user's primary school (their school_student membership)
-- =====================================================================
CREATE OR REPLACE FUNCTION public._student_primary_school(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT school_id FROM public.school_memberships
  WHERE user_id = _user_id AND role = 'school_student' AND status = 'active'
  ORDER BY created_at ASC LIMIT 1;
$$;

-- =====================================================================
-- Touch helper for updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public._sad_touch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_analytics_daily_touch ON public.student_analytics_daily;
CREATE TRIGGER student_analytics_daily_touch
  BEFORE UPDATE ON public.student_analytics_daily
  FOR EACH ROW EXECUTE FUNCTION public._sad_touch();

-- =====================================================================
-- Upsert helper
-- =====================================================================
CREATE OR REPLACE FUNCTION public._sad_upsert(_user_id UUID, _day DATE)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_school UUID;
  v_id UUID;
BEGIN
  v_school := public._student_primary_school(_user_id);
  INSERT INTO public.student_analytics_daily (user_id, school_id, day)
  VALUES (_user_id, v_school, _day)
  ON CONFLICT (user_id, day) DO UPDATE
    SET school_id = COALESCE(public.student_analytics_daily.school_id, EXCLUDED.school_id),
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =====================================================================
-- Trigger fns
-- =====================================================================

-- Daily task completion
CREATE OR REPLACE FUNCTION public.tg_sad_daily_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND (OLD.completed_at IS NULL OR TG_OP = 'INSERT') THEN
    PERFORM public._sad_upsert(NEW.user_id, (NEW.completed_at AT TIME ZONE 'UTC')::date);
    UPDATE public.student_analytics_daily
      SET tasks_completed = tasks_completed + 1
    WHERE user_id = NEW.user_id AND day = (NEW.completed_at AT TIME ZONE 'UTC')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sad_daily_task_attempts_trg ON public.daily_task_attempts;
CREATE TRIGGER sad_daily_task_attempts_trg
  AFTER INSERT OR UPDATE ON public.daily_task_attempts
  FOR EACH ROW EXECUTE FUNCTION public.tg_sad_daily_task();

-- Homework completion (released)
CREATE OR REPLACE FUNCTION public.tg_sad_homework()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID;
  v_day DATE;
BEGIN
  IF NEW.status = 'released' AND (OLD.status IS DISTINCT FROM 'released') THEN
    v_user := NEW.student_id;
    v_day := COALESCE(NEW.released_at, now())::date;
    PERFORM public._sad_upsert(v_user, v_day);
    UPDATE public.student_analytics_daily
      SET homework_completed = homework_completed + 1
    WHERE user_id = v_user AND day = v_day;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sad_homework_trg ON public.school_homework_responses;
CREATE TRIGGER sad_homework_trg
  AFTER UPDATE ON public.school_homework_responses
  FOR EACH ROW EXECUTE FUNCTION public.tg_sad_homework();

-- Quiz attempts
CREATE OR REPLACE FUNCTION public.tg_sad_quiz()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day DATE;
  v_score NUMERIC;
  v_max NUMERIC;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  v_day := COALESCE(NEW.completed_at, NEW.created_at, now())::date;
  v_score := COALESCE(NEW.score, 0);
  v_max := COALESCE(NEW.total_questions, NEW.max_score, 0);
  IF v_max <= 0 THEN RETURN NEW; END IF;
  PERFORM public._sad_upsert(NEW.user_id, v_day);
  UPDATE public.student_analytics_daily
    SET quiz_count = quiz_count + 1,
        quiz_score_sum = quiz_score_sum + v_score,
        quiz_score_max_sum = quiz_score_max_sum + v_max
  WHERE user_id = NEW.user_id AND day = v_day;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sad_quiz_trg ON public.quiz_attempts;
CREATE TRIGGER sad_quiz_trg
  AFTER INSERT ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.tg_sad_quiz();

-- Tutorial / resource engagement
CREATE OR REPLACE FUNCTION public.tg_sad_tutorial_watch()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day DATE := COALESCE(NEW.created_at, now())::date;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public._sad_upsert(NEW.user_id, v_day);
  UPDATE public.student_analytics_daily
    SET resources_opened = resources_opened + 1
  WHERE user_id = NEW.user_id AND day = v_day;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sad_tutorial_watch_trg ON public.tutorial_watch_events;
CREATE TRIGGER sad_tutorial_watch_trg
  AFTER INSERT ON public.tutorial_watch_events
  FOR EACH ROW EXECUTE FUNCTION public.tg_sad_tutorial_watch();

-- =====================================================================
-- Rebuild today RPC (callable to refresh on demand)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rebuild_student_analytics_today(_user_id UUID DEFAULT NULL)
RETURNS public.student_analytics_daily
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := COALESCE(_user_id, auth.uid());
  v_day DATE := CURRENT_DATE;
  v_school UUID;
  v_row public.student_analytics_daily;
  v_tasks INT;
  v_hw INT;
  v_quiz_count INT;
  v_quiz_sum NUMERIC;
  v_quiz_max NUMERIC;
  v_resources INT;
  v_fc_reviewed INT;
  v_fc_mastery NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Caller must be self or staff of student's school
  IF v_uid <> auth.uid() THEN
    v_school := public._student_primary_school(v_uid);
    IF v_school IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.school_memberships sm
      WHERE sm.school_id = v_school AND sm.user_id = auth.uid()
        AND sm.status = 'active' AND sm.role IN ('school_admin','school_teacher')
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  v_school := public._student_primary_school(v_uid);

  SELECT COUNT(*) INTO v_tasks FROM public.daily_task_attempts
   WHERE user_id = v_uid AND completed_at::date = v_day;
  SELECT COUNT(*) INTO v_hw FROM public.school_homework_responses
   WHERE student_id = v_uid AND status = 'released' AND released_at::date = v_day;
  SELECT COUNT(*), COALESCE(SUM(score),0), COALESCE(SUM(COALESCE(total_questions, max_score, 0)),0)
    INTO v_quiz_count, v_quiz_sum, v_quiz_max
    FROM public.quiz_attempts
   WHERE user_id = v_uid AND COALESCE(completed_at, created_at)::date = v_day;
  SELECT COUNT(*) INTO v_resources FROM public.tutorial_watch_events
   WHERE user_id = v_uid AND created_at::date = v_day;
  SELECT COUNT(*), COALESCE(AVG(COALESCE(ease_factor,0)),0)
    INTO v_fc_reviewed, v_fc_mastery
    FROM public.flashcards
   WHERE user_id = v_uid AND last_reviewed_at::date = v_day;

  INSERT INTO public.student_analytics_daily (
    user_id, school_id, day,
    tasks_completed, homework_completed, quiz_count, quiz_score_sum, quiz_score_max_sum,
    flashcards_reviewed, flashcard_mastery_avg, resources_opened
  )
  VALUES (
    v_uid, v_school, v_day,
    v_tasks, v_hw, v_quiz_count, v_quiz_sum, v_quiz_max,
    v_fc_reviewed, v_fc_mastery, v_resources
  )
  ON CONFLICT (user_id, day) DO UPDATE SET
    school_id = COALESCE(public.student_analytics_daily.school_id, EXCLUDED.school_id),
    tasks_completed = EXCLUDED.tasks_completed,
    homework_completed = EXCLUDED.homework_completed,
    quiz_count = EXCLUDED.quiz_count,
    quiz_score_sum = EXCLUDED.quiz_score_sum,
    quiz_score_max_sum = EXCLUDED.quiz_score_max_sum,
    flashcards_reviewed = EXCLUDED.flashcards_reviewed,
    flashcard_mastery_avg = EXCLUDED.flashcard_mastery_avg,
    resources_opened = EXCLUDED.resources_opened,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- =====================================================================
-- Trend RPC
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_student_analytics(
  _user_id UUID DEFAULT NULL,
  _from DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::date,
  _to DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := COALESCE(_user_id, auth.uid());
  v_school UUID;
  v_daily JSONB;
  v_7d JSONB;
  v_30d JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_uid <> auth.uid() THEN
    v_school := public._student_primary_school(v_uid);
    IF v_school IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.school_memberships sm
      WHERE sm.school_id = v_school AND sm.user_id = auth.uid()
        AND sm.status = 'active' AND sm.role IN ('school_admin','school_teacher')
    ) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.day), '[]'::jsonb) INTO v_daily
  FROM (
    SELECT day, tasks_completed, homework_completed, quiz_count,
           CASE WHEN quiz_score_max_sum > 0 THEN ROUND((quiz_score_sum / quiz_score_max_sum) * 100, 1) ELSE 0 END AS quiz_pct,
           flashcards_reviewed, flashcard_mastery_avg, resources_opened, minutes_studied
    FROM public.student_analytics_daily
    WHERE user_id = v_uid AND day BETWEEN _from AND _to
  ) r;

  SELECT jsonb_build_object(
    'tasks', COALESCE(SUM(tasks_completed),0),
    'homework', COALESCE(SUM(homework_completed),0),
    'quizzes', COALESCE(SUM(quiz_count),0),
    'quiz_pct', CASE WHEN SUM(quiz_score_max_sum) > 0 THEN ROUND((SUM(quiz_score_sum) / SUM(quiz_score_max_sum)) * 100, 1) ELSE 0 END,
    'flashcards', COALESCE(SUM(flashcards_reviewed),0),
    'resources', COALESCE(SUM(resources_opened),0)
  ) INTO v_7d
  FROM public.student_analytics_daily
  WHERE user_id = v_uid AND day >= (CURRENT_DATE - INTERVAL '7 days')::date;

  SELECT jsonb_build_object(
    'tasks', COALESCE(SUM(tasks_completed),0),
    'homework', COALESCE(SUM(homework_completed),0),
    'quizzes', COALESCE(SUM(quiz_count),0),
    'quiz_pct', CASE WHEN SUM(quiz_score_max_sum) > 0 THEN ROUND((SUM(quiz_score_sum) / SUM(quiz_score_max_sum)) * 100, 1) ELSE 0 END,
    'flashcards', COALESCE(SUM(flashcards_reviewed),0),
    'resources', COALESCE(SUM(resources_opened),0)
  ) INTO v_30d
  FROM public.student_analytics_daily
  WHERE user_id = v_uid AND day >= (CURRENT_DATE - INTERVAL '30 days')::date;

  RETURN jsonb_build_object(
    'user_id', v_uid,
    'from', _from,
    'to', _to,
    'daily', v_daily,
    'rollup_7d', v_7d,
    'rollup_30d', v_30d
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_student_analytics_today(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_analytics(UUID, DATE, DATE) TO authenticated;
