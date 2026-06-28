
-- 1. Extend school_homework with remediation flags
ALTER TABLE public.school_homework
  ADD COLUMN IF NOT EXISTS is_remediation BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remediation_topic TEXT;

CREATE INDEX IF NOT EXISTS school_homework_is_remediation_idx
  ON public.school_homework (school_id, is_remediation, created_at DESC);

-- 2. kernel_alerts
CREATE TABLE IF NOT EXISTS public.kernel_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id UUID,
  topic TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  students_affected INT NOT NULL DEFAULT 0,
  avg_score NUMERIC,
  delta_students INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_homework_id UUID REFERENCES public.school_homework(id) ON DELETE SET NULL,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS kernel_alerts_school_status_idx
  ON public.kernel_alerts (school_id, status, detected_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS kernel_alerts_open_unique
  ON public.kernel_alerts (school_id, COALESCE(subject_id::text,''), lower(topic))
  WHERE status IN ('new','acknowledged');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kernel_alerts TO authenticated;
GRANT ALL ON public.kernel_alerts TO service_role;
ALTER TABLE public.kernel_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School staff read kernel alerts"
ON public.kernel_alerts FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.school_memberships m
  WHERE m.school_id = kernel_alerts.school_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.role IN ('school_admin','school_teacher')
));
CREATE POLICY "School staff manage kernel alerts"
ON public.kernel_alerts FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.school_memberships m
  WHERE m.school_id = kernel_alerts.school_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.role IN ('school_admin','school_teacher')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.school_memberships m
  WHERE m.school_id = kernel_alerts.school_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.role IN ('school_admin','school_teacher')
));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS kernel_alerts_updated_at ON public.kernel_alerts;
CREATE TRIGGER kernel_alerts_updated_at
BEFORE UPDATE ON public.kernel_alerts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. school_kernel_snapshots
CREATE TABLE IF NOT EXISTS public.school_kernel_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id UUID,
  topic TEXT NOT NULL,
  students_affected INT NOT NULL DEFAULT 0,
  avg_score NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS school_kernel_snapshots_unique
  ON public.school_kernel_snapshots (school_id, COALESCE(subject_id::text,''), lower(topic));

GRANT SELECT ON public.school_kernel_snapshots TO authenticated;
GRANT ALL ON public.school_kernel_snapshots TO service_role;
ALTER TABLE public.school_kernel_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "School staff read snapshots"
ON public.school_kernel_snapshots FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.school_memberships m
  WHERE m.school_id = school_kernel_snapshots.school_id
    AND m.user_id = auth.uid()
    AND m.status = 'active'
    AND m.role IN ('school_admin','school_teacher')
));

-- 4. Detector function — single school
CREATE OR REPLACE FUNCTION public.detect_kernel_alerts(_school_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_alert_count INT := 0;
  rec RECORD;
  prev_affected INT;
  alert_id UUID;
  severity TEXT;
BEGIN
  FOR rec IN
    SELECT
      ls.subject_id,
      ls.topic_name AS topic,
      COUNT(DISTINCT ls.user_id) AS students_affected,
      AVG(COALESCE(ls.ewma_score_pct, 0))::numeric AS avg_score
    FROM public.learner_state ls
    JOIN public.school_memberships m
      ON m.user_id = ls.user_id
     AND m.school_id = _school_id
     AND m.status = 'active'
     AND m.role = 'school_student'
    WHERE ls.topic_name IS NOT NULL
      AND ls.risk_level IN ('critical','warning')
    GROUP BY ls.subject_id, ls.topic_name
    HAVING COUNT(DISTINCT ls.user_id) >= 2
  LOOP
    SELECT students_affected INTO prev_affected
    FROM public.school_kernel_snapshots
    WHERE school_id = _school_id
      AND COALESCE(subject_id::text,'') = COALESCE(rec.subject_id::text,'')
      AND lower(topic) = lower(rec.topic);

    severity := CASE WHEN rec.avg_score < 40 THEN 'critical' ELSE 'warning' END;

    -- Emerging risk: previously unseen OR jumped by 2+ students
    IF prev_affected IS NULL OR rec.students_affected - prev_affected >= 2 THEN
      INSERT INTO public.kernel_alerts (
        school_id, subject_id, topic, severity, students_affected,
        avg_score, delta_students
      )
      VALUES (
        _school_id, rec.subject_id, rec.topic, severity, rec.students_affected,
        rec.avg_score, rec.students_affected - COALESCE(prev_affected, 0)
      )
      ON CONFLICT (school_id, COALESCE(subject_id::text,''), lower(topic))
      WHERE status IN ('new','acknowledged')
      DO UPDATE SET
        students_affected = EXCLUDED.students_affected,
        avg_score = EXCLUDED.avg_score,
        delta_students = EXCLUDED.delta_students,
        severity = EXCLUDED.severity,
        updated_at = now()
      RETURNING id INTO alert_id;

      IF alert_id IS NOT NULL THEN
        new_alert_count := new_alert_count + 1;
        -- Notify active teachers + admins
        INSERT INTO public.notifications (user_id, title, message, type)
        SELECT
          m.user_id,
          'New at-risk topic detected',
          format('"%s" is struggling for %s student(s) (avg %s%%)',
                 rec.topic, rec.students_affected, ROUND(rec.avg_score)),
          'kernel_alert'
        FROM public.school_memberships m
        WHERE m.school_id = _school_id
          AND m.status = 'active'
          AND m.role IN ('school_admin','school_teacher');
      END IF;
    END IF;

    -- Refresh snapshot
    INSERT INTO public.school_kernel_snapshots (school_id, subject_id, topic, students_affected, avg_score)
    VALUES (_school_id, rec.subject_id, rec.topic, rec.students_affected, rec.avg_score)
    ON CONFLICT (school_id, COALESCE(subject_id::text,''), lower(topic))
    DO UPDATE SET students_affected = EXCLUDED.students_affected,
                  avg_score = EXCLUDED.avg_score,
                  captured_at = now();
  END LOOP;

  RETURN new_alert_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_kernel_alerts(UUID) TO authenticated, service_role;

-- 5. Detector — all schools (cron entry point)
CREATE OR REPLACE FUNCTION public.detect_kernel_alerts_all()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD; total INT := 0;
BEGIN
  FOR s IN SELECT id FROM public.schools WHERE status = 'active'
  LOOP
    total := total + COALESCE(public.detect_kernel_alerts(s.id), 0);
  END LOOP;
  RETURN total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_kernel_alerts_all() TO service_role;

-- 6. Helper: list students in a class affected by a topic
CREATE OR REPLACE FUNCTION public.class_topic_affected_students(_class_id UUID, _topic TEXT)
RETURNS TABLE (
  student_id UUID,
  full_name TEXT,
  email TEXT,
  risk_level TEXT,
  ewma_score_pct NUMERIC,
  mastery_pct NUMERIC,
  attempts INT,
  last_event_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    ls.user_id,
    p.full_name,
    p.email,
    ls.risk_level,
    ls.ewma_score_pct,
    ls.mastery_pct,
    ls.attempts,
    ls.last_event_at
  FROM public.learner_state ls
  JOIN public.enrollments e
    ON e.student_id = ls.user_id
   AND e.class_id = _class_id
   AND e.status = 'active'
  LEFT JOIN public.profiles p ON p.id = ls.user_id
  WHERE lower(ls.topic_name) = lower(_topic)
  ORDER BY
    CASE ls.risk_level WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END,
    COALESCE(ls.ewma_score_pct, 0) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.class_topic_affected_students(UUID, TEXT) TO authenticated;

-- 7. Helper: school-wide students affected by topic
CREATE OR REPLACE FUNCTION public.school_topic_affected_students(_school_id UUID, _topic TEXT)
RETURNS TABLE (
  student_id UUID,
  full_name TEXT,
  email TEXT,
  risk_level TEXT,
  ewma_score_pct NUMERIC,
  mastery_pct NUMERIC,
  class_names TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    ls.user_id,
    p.full_name,
    p.email,
    ls.risk_level,
    ls.ewma_score_pct,
    ls.mastery_pct,
    string_agg(DISTINCT c.name, ', ') AS class_names
  FROM public.learner_state ls
  JOIN public.school_memberships m
    ON m.user_id = ls.user_id
   AND m.school_id = _school_id
   AND m.status = 'active'
   AND m.role = 'school_student'
  LEFT JOIN public.profiles p ON p.id = ls.user_id
  LEFT JOIN public.enrollments e ON e.student_id = ls.user_id AND e.status = 'active'
  LEFT JOIN public.classes c ON c.id = e.class_id AND c.school_id = _school_id
  WHERE lower(ls.topic_name) = lower(_topic)
  GROUP BY ls.user_id, p.full_name, p.email, ls.risk_level, ls.ewma_score_pct, ls.mastery_pct
  ORDER BY
    CASE ls.risk_level WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 WHEN 'watch' THEN 2 ELSE 3 END,
    COALESCE(ls.ewma_score_pct, 0) ASC;
$$;

GRANT EXECUTE ON FUNCTION public.school_topic_affected_students(UUID, TEXT) TO authenticated;

-- 8. Hourly pg_cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'detect-kernel-alerts-hourly') THEN
    PERFORM cron.unschedule('detect-kernel-alerts-hourly');
  END IF;
  PERFORM cron.schedule(
    'detect-kernel-alerts-hourly',
    '7 * * * *',
    $cron$SELECT public.detect_kernel_alerts_all();$cron$
  );
END $$;
