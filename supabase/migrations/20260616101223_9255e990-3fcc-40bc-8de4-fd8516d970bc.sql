
CREATE OR REPLACE FUNCTION public.tg_sad_daily_task()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_day DATE := COALESCE(NEW.created_at, now())::date;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  PERFORM public._sad_upsert(NEW.user_id, v_day);
  UPDATE public.student_analytics_daily
    SET tasks_completed = tasks_completed + 1
  WHERE user_id = NEW.user_id AND day = v_day;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sad_daily_task_attempts_trg ON public.daily_task_attempts;
CREATE TRIGGER sad_daily_task_attempts_trg
  AFTER INSERT ON public.daily_task_attempts
  FOR EACH ROW EXECUTE FUNCTION public.tg_sad_daily_task();

-- Same fix in rebuild RPC
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
   WHERE user_id = v_uid AND created_at::date = v_day;
  SELECT COUNT(*) INTO v_hw FROM public.school_homework_responses
   WHERE student_id = v_uid AND status = 'released' AND released_at::date = v_day;
  SELECT COUNT(*),
         COALESCE(SUM(COALESCE(marks_awarded, CASE WHEN was_correct THEN 1 ELSE 0 END)), 0),
         COALESCE(SUM(COALESCE(marks_possible, 1)), 0)
    INTO v_quiz_count, v_quiz_sum, v_quiz_max
    FROM public.quiz_attempts
   WHERE user_id = v_uid AND created_at::date = v_day;
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
