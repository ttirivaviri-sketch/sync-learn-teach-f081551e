
-- 1. Track sent reminders to dedupe
CREATE TABLE IF NOT EXISTS public.homework_reminder_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  homework_id UUID NOT NULL,
  student_id UUID NOT NULL,
  kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (homework_id, student_id, kind)
);
GRANT SELECT ON public.homework_reminder_sent TO authenticated;
GRANT ALL ON public.homework_reminder_sent TO service_role;
ALTER TABLE public.homework_reminder_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages reminder log"
  ON public.homework_reminder_sent FOR ALL
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- 2. Trigger: notify enrolled students when new school_homework row is created
CREATE OR REPLACE FUNCTION public.notify_students_on_homework_release()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due_text TEXT;
  v_school_name TEXT;
BEGIN
  IF NEW.due_at IS NOT NULL THEN
    v_due_text := ' Due ' || to_char(NEW.due_at AT TIME ZONE 'UTC', 'Dy DD Mon HH24:MI') || ' UTC.';
  ELSE
    v_due_text := '';
  END IF;

  SELECT name INTO v_school_name FROM public.schools WHERE id = NEW.school_id;

  INSERT INTO public.notifications (user_id, title, message, type, read)
  SELECT
    e.student_id,
    'New homework: ' || NEW.title,
    COALESCE(v_school_name, 'Your school') || ' released "' || NEW.title || '".' || v_due_text,
    'info',
    false
  FROM public.enrollments e
  WHERE e.class_id = NEW.class_id
    AND e.school_id = NEW.school_id
    AND e.status = 'active';

  -- Log so the due-soon job won't re-notify as "new"
  INSERT INTO public.homework_reminder_sent (homework_id, student_id, kind)
  SELECT NEW.id, e.student_id, 'released'
  FROM public.enrollments e
  WHERE e.class_id = NEW.class_id AND e.school_id = NEW.school_id AND e.status = 'active'
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_students_on_homework_release ON public.school_homework;
CREATE TRIGGER trg_notify_students_on_homework_release
  AFTER INSERT ON public.school_homework
  FOR EACH ROW EXECUTE FUNCTION public.notify_students_on_homework_release();

-- 3. Function: due-soon reminders (~24h window). Runs hourly via pg_cron.
CREATE OR REPLACE FUNCTION public.notify_homework_due_soon()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH targets AS (
    SELECT
      hw.id AS homework_id, hw.title, hw.due_at, hw.school_id, hw.class_id,
      e.student_id,
      s.name AS school_name
    FROM public.school_homework hw
    JOIN public.enrollments e
      ON e.class_id = hw.class_id AND e.school_id = hw.school_id AND e.status = 'active'
    LEFT JOIN public.schools s ON s.id = hw.school_id
    WHERE hw.due_at IS NOT NULL
      AND hw.due_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
      AND NOT EXISTS (
        SELECT 1 FROM public.homework_reminder_sent r
        WHERE r.homework_id = hw.id AND r.student_id = e.student_id AND r.kind = 'due_soon'
      )
      AND NOT EXISTS (
        -- skip students who already have any released response for this homework
        SELECT 1 FROM public.school_homework_responses rsp
        WHERE rsp.homework_id = hw.id AND rsp.student_id = e.student_id
          AND rsp.status = 'released'
      )
  ),
  inserted_notifs AS (
    INSERT INTO public.notifications (user_id, title, message, type, read)
    SELECT
      t.student_id,
      'Homework due tomorrow: ' || t.title,
      COALESCE(t.school_name, 'Your school') || ' homework "' || t.title || '" is due ' ||
        to_char(t.due_at AT TIME ZONE 'UTC', 'Dy DD Mon HH24:MI') || ' UTC.',
      'warning',
      false
    FROM targets t
    RETURNING 1
  ),
  logged AS (
    INSERT INTO public.homework_reminder_sent (homework_id, student_id, kind)
    SELECT t.homework_id, t.student_id, 'due_soon' FROM targets t
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM inserted_notifs;
  RETURN v_count;
END;
$$;

-- 4. Schedule hourly
DO $$
BEGIN
  PERFORM cron.unschedule('homework-due-soon-hourly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'homework-due-soon-hourly',
  '0 * * * *',
  $$ SELECT public.notify_homework_due_soon(); $$
);
