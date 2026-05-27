
-- =====================================================================
-- 1. Admin Study Analytics RPCs
-- =====================================================================

-- Completion rate per subject over last N days
CREATE OR REPLACE FUNCTION public.admin_study_completion_rate(p_days integer DEFAULT 30)
RETURNS TABLE(subject_id uuid, subject_name text, total bigint, completed bigint, completion_rate numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  RETURN QUERY
  SELECT
    dt.subject_id,
    COALESCE(MAX(s.name), 'Unknown') AS subject_name,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE dt.is_completed)::bigint AS completed,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(100.0 * COUNT(*) FILTER (WHERE dt.is_completed) / COUNT(*), 1)
      ELSE 0 END AS completion_rate
  FROM public.daily_tasks dt
  LEFT JOIN public.subjects s ON s.id = dt.subject_id
  WHERE dt.task_date >= (CURRENT_DATE - p_days)
  GROUP BY dt.subject_id
  ORDER BY total DESC;
END;
$$;

-- Regenerate usage per subject
CREATE OR REPLACE FUNCTION public.admin_study_regen_usage(p_days integer DEFAULT 30)
RETURNS TABLE(subject_id uuid, subject_name text, tasks_with_regen bigint, total_regens bigint, avg_regens numeric, max_regens integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  RETURN QUERY
  SELECT
    dt.subject_id,
    COALESCE(MAX(s.name), 'Unknown') AS subject_name,
    COUNT(*) FILTER (WHERE COALESCE((dt.task_payload->'__meta'->>'regen_count')::int, 0) > 0)::bigint AS tasks_with_regen,
    COALESCE(SUM(COALESCE((dt.task_payload->'__meta'->>'regen_count')::int, 0)), 0)::bigint AS total_regens,
    ROUND(COALESCE(AVG(COALESCE((dt.task_payload->'__meta'->>'regen_count')::int, 0)), 0)::numeric, 2) AS avg_regens,
    COALESCE(MAX(COALESCE((dt.task_payload->'__meta'->>'regen_count')::int, 0)), 0)::int AS max_regens
  FROM public.daily_tasks dt
  LEFT JOIN public.subjects s ON s.id = dt.subject_id
  WHERE dt.task_date >= (CURRENT_DATE - p_days)
    AND dt.task_type = 'structured-bundle'
  GROUP BY dt.subject_id
  ORDER BY total_regens DESC;
END;
$$;

-- Mastery progression per subject (current avg + 7-day delta)
CREATE OR REPLACE FUNCTION public.admin_study_mastery_progression()
RETURNS TABLE(subject_id uuid, subject_name text, learners bigint, avg_mastery numeric, avg_mastery_7d_ago numeric, delta numeric)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  RETURN QUERY
  WITH now_m AS (
    SELECT tm.subject_id,
           COUNT(DISTINCT tm.user_id) AS learners,
           AVG(tm.mastery_percentage) AS avg_now
    FROM public.topic_mastery tm
    GROUP BY tm.subject_id
  ),
  past_m AS (
    SELECT tm.subject_id,
           AVG(tm.mastery_percentage) AS avg_past
    FROM public.topic_mastery tm
    WHERE tm.last_reviewed_at < (now() - interval '7 days')
       OR tm.last_reviewed_at IS NULL
    GROUP BY tm.subject_id
  )
  SELECT
    n.subject_id,
    COALESCE(MAX(s.name), 'Unknown') AS subject_name,
    n.learners,
    ROUND(n.avg_now::numeric, 1) AS avg_mastery,
    ROUND(COALESCE(p.avg_past, n.avg_now)::numeric, 1) AS avg_mastery_7d_ago,
    ROUND((n.avg_now - COALESCE(p.avg_past, n.avg_now))::numeric, 1) AS delta
  FROM now_m n
  LEFT JOIN past_m p ON p.subject_id = n.subject_id
  LEFT JOIN public.subjects s ON s.id = n.subject_id
  GROUP BY n.subject_id, n.learners, n.avg_now, p.avg_past
  ORDER BY n.learners DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_study_completion_rate(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_study_regen_usage(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_study_mastery_progression() TO authenticated;

-- =====================================================================
-- 2. Backfill quiz_attempts from daily_task_attempts
-- Only inserts rows where no matching quiz_attempt already exists
-- (matched on user_id + question + created_at within 5 seconds).
-- =====================================================================

INSERT INTO public.quiz_attempts (
  user_id, subject_id, topic_name, question, user_answer, model_answer,
  was_correct, marks_awarded, marks_possible, concepts_tested,
  difficulty_rating, created_at, ease_factor, interval_days,
  review_count, next_review_date
)
SELECT
  dta.user_id,
  dta.subject_id,
  dta.topic,
  dta.question,
  dta.user_answer,
  dta.model_answer,
  dta.was_correct,
  dta.marks_awarded,
  dta.marks_possible,
  CASE WHEN dta.concept IS NOT NULL THEN ARRAY[dta.concept] ELSE NULL END,
  CASE dta.difficulty
    WHEN 'easy' THEN 1
    WHEN 'hard' THEN 3
    ELSE 2
  END,
  dta.created_at,
  2.5,
  1,
  0,
  dta.created_at::date
FROM public.daily_task_attempts dta
WHERE NOT EXISTS (
  SELECT 1 FROM public.quiz_attempts qa
  WHERE qa.user_id = dta.user_id
    AND qa.question = dta.question
    AND qa.created_at BETWEEN dta.created_at - interval '5 seconds'
                          AND dta.created_at + interval '5 seconds'
);
