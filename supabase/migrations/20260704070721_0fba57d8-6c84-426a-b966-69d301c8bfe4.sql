
CREATE TABLE IF NOT EXISTS public.remediation_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  homework_id UUID NOT NULL REFERENCES public.school_homework(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  topic TEXT NOT NULL,
  baseline_ewma NUMERIC,
  baseline_risk TEXT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (homework_id, student_id)
);
GRANT SELECT ON public.remediation_baselines TO authenticated;
GRANT ALL ON public.remediation_baselines TO service_role;
ALTER TABLE public.remediation_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School staff read remediation baselines"
ON public.remediation_baselines FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.school_memberships m
  WHERE m.school_id = remediation_baselines.school_id
    AND m.user_id = auth.uid() AND m.status = 'active'
    AND m.role IN ('school_admin','school_teacher')
));

CREATE OR REPLACE FUNCTION public.capture_remediation_baseline()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_remediation = true AND NEW.remediation_topic IS NOT NULL AND NEW.class_id IS NOT NULL THEN
    INSERT INTO public.remediation_baselines (homework_id, school_id, student_id, topic, baseline_ewma, baseline_risk)
    SELECT NEW.id, NEW.school_id, e.student_id, NEW.remediation_topic, ls.ewma_score_pct, ls.risk_level
    FROM public.enrollments e
    LEFT JOIN public.learner_state ls
      ON ls.user_id = e.student_id AND lower(ls.topic_name) = lower(NEW.remediation_topic)
    WHERE e.class_id = NEW.class_id AND e.status = 'active'
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS school_homework_capture_baseline ON public.school_homework;
CREATE TRIGGER school_homework_capture_baseline
AFTER INSERT ON public.school_homework
FOR EACH ROW EXECUTE FUNCTION public.capture_remediation_baseline();

CREATE OR REPLACE FUNCTION public.remediation_effectiveness(_school_id UUID)
RETURNS TABLE (
  homework_id UUID, title TEXT, topic TEXT, class_id UUID, created_at TIMESTAMPTZ,
  students_total INT, students_improved INT, students_worsened INT,
  avg_ewma_before NUMERIC, avg_ewma_after NUMERIC, avg_delta NUMERIC
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  WITH pairs AS (
    SELECT rb.homework_id, hw.title, rb.topic, hw.class_id, hw.created_at,
           rb.student_id, rb.baseline_ewma, ls.ewma_score_pct AS current_ewma
    FROM public.remediation_baselines rb
    JOIN public.school_homework hw ON hw.id = rb.homework_id
    LEFT JOIN public.learner_state ls
      ON ls.user_id = rb.student_id AND lower(ls.topic_name) = lower(rb.topic)
    WHERE rb.school_id = _school_id
  )
  SELECT homework_id, title, topic, class_id, created_at,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE current_ewma IS NOT NULL AND baseline_ewma IS NOT NULL AND current_ewma - baseline_ewma > 5)::int,
    COUNT(*) FILTER (WHERE current_ewma IS NOT NULL AND baseline_ewma IS NOT NULL AND baseline_ewma - current_ewma > 5)::int,
    AVG(baseline_ewma), AVG(current_ewma), AVG(current_ewma - baseline_ewma)
  FROM pairs
  GROUP BY homework_id, title, topic, class_id, created_at
  ORDER BY created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.remediation_effectiveness(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.auto_resolve_kernel_alerts()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE resolved_count INT := 0; a RECORD; current_affected INT;
BEGIN
  FOR a IN SELECT * FROM public.kernel_alerts WHERE status IN ('new','acknowledged','assigned') LOOP
    SELECT COUNT(DISTINCT ls.user_id) INTO current_affected
    FROM public.learner_state ls
    JOIN public.school_memberships m
      ON m.user_id = ls.user_id AND m.school_id = a.school_id
     AND m.status = 'active' AND m.role = 'school_student'
    WHERE lower(ls.topic_name) = lower(a.topic)
      AND ls.risk_level IN ('critical','warning')
      AND (a.subject_id IS NULL OR ls.subject_id = a.subject_id);

    IF current_affected <= GREATEST(1, a.students_affected / 2) THEN
      UPDATE public.kernel_alerts
      SET status = 'resolved', resolved_at = now(), students_affected = current_affected
      WHERE id = a.id;
      resolved_count := resolved_count + 1;
    ELSIF current_affected <> a.students_affected THEN
      UPDATE public.kernel_alerts SET students_affected = current_affected WHERE id = a.id;
    END IF;
  END LOOP;
  RETURN resolved_count;
END; $$;
GRANT EXECUTE ON FUNCTION public.auto_resolve_kernel_alerts() TO service_role, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-resolve-kernel-alerts-hourly') THEN
    PERFORM cron.unschedule('auto-resolve-kernel-alerts-hourly');
  END IF;
  PERFORM cron.schedule('auto-resolve-kernel-alerts-hourly','23 * * * *',
    $cron$SELECT public.auto_resolve_kernel_alerts();$cron$);
END $$;

CREATE OR REPLACE FUNCTION public.learner_weekly_digest(_user_id UUID)
RETURNS TABLE (
  events_7d INT, avg_score_7d NUMERIC, topics_mastered INT, topics_at_risk INT,
  top_strength TEXT, top_struggle TEXT
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT
    (SELECT COUNT(*)::int FROM public.learning_events WHERE user_id = _user_id AND occurred_at > now() - interval '7 days'),
    (SELECT AVG(score_pct) FROM public.learning_events WHERE user_id = _user_id AND occurred_at > now() - interval '7 days' AND score_pct IS NOT NULL),
    (SELECT COUNT(*)::int FROM public.learner_state WHERE user_id = _user_id AND risk_level = 'mastered'),
    (SELECT COUNT(*)::int FROM public.learner_state WHERE user_id = _user_id AND risk_level IN ('critical','warning')),
    (SELECT topic_name FROM public.learner_state WHERE user_id = _user_id AND topic_name IS NOT NULL ORDER BY mastery_pct DESC NULLS LAST LIMIT 1),
    (SELECT topic_name FROM public.learner_state WHERE user_id = _user_id AND topic_name IS NOT NULL AND risk_level IN ('critical','warning') ORDER BY ewma_score_pct ASC NULLS LAST LIMIT 1);
$$;
GRANT EXECUTE ON FUNCTION public.learner_weekly_digest(UUID) TO authenticated;
