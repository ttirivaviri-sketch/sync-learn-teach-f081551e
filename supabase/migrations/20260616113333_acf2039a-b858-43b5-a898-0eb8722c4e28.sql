
-- 1. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  homework_release_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  due_soon_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own notification prefs" ON public.notification_preferences;
CREATE POLICY "Users manage their own notification prefs"
  ON public.notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_notification_preferences_updated ON public.notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. device_push_tokens
CREATE TABLE IF NOT EXISTS public.device_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android','ios','web')),
  device_label TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, token)
);
CREATE INDEX IF NOT EXISTS idx_device_push_tokens_user ON public.device_push_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_push_tokens TO authenticated;
GRANT ALL ON public.device_push_tokens TO service_role;

ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own device tokens" ON public.device_push_tokens;
CREATE POLICY "Users manage their own device tokens"
  ON public.device_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Reschedule-aware dedupe
CREATE OR REPLACE FUNCTION public.reset_due_soon_on_reschedule()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
    DELETE FROM public.homework_reminder_sent
    WHERE homework_id = NEW.id AND kind = 'due_soon';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_due_soon_on_reschedule ON public.school_homework;
CREATE TRIGGER trg_reset_due_soon_on_reschedule
  AFTER UPDATE OF due_at ON public.school_homework
  FOR EACH ROW EXECUTE FUNCTION public.reset_due_soon_on_reschedule();

-- 4. Release trigger respects prefs
CREATE OR REPLACE FUNCTION public.notify_students_on_homework_release()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school_name TEXT; v_class_name TEXT;
BEGIN
  SELECT s.name, c.name INTO v_school_name, v_class_name
  FROM public.classes c JOIN public.schools s ON s.id = c.school_id
  WHERE c.id = NEW.class_id;

  INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
  SELECT e.student_id,
         'New homework: ' || COALESCE(NEW.title, 'Untitled'),
         COALESCE(v_school_name,'Your school') ||
           CASE WHEN NEW.due_at IS NOT NULL
                THEN ' · due ' || to_char(NEW.due_at, 'Mon DD HH24:MI')
                ELSE '' END,
         'info', NULL
  FROM public.enrollments e
  LEFT JOIN public.notification_preferences np ON np.user_id = e.student_id
  WHERE e.class_id = NEW.class_id AND e.status = 'active'
    AND COALESCE(np.homework_release_alerts, TRUE) = TRUE;

  INSERT INTO public.homework_reminder_sent (homework_id, student_id, kind)
  SELECT NEW.id, e.student_id, 'released'
  FROM public.enrollments e
  WHERE e.class_id = NEW.class_id AND e.status = 'active'
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Due-soon job respects prefs
DROP FUNCTION IF EXISTS public.notify_homework_due_soon();
CREATE OR REPLACE FUNCTION public.notify_homework_due_soon()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_school_name TEXT; r RECORD;
BEGIN
  FOR r IN
    SELECT h.id AS homework_id, h.title, h.due_at, h.class_id, c.school_id
    FROM public.school_homework h
    JOIN public.classes c ON c.id = h.class_id
    WHERE h.due_at IS NOT NULL
      AND h.due_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
  LOOP
    SELECT name INTO v_school_name FROM public.schools WHERE id = r.school_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT e.student_id,
           'Due tomorrow: ' || COALESCE(r.title,'Homework'),
           COALESCE(v_school_name,'Your school') || ' · due ' || to_char(r.due_at,'Mon DD HH24:MI'),
           'warning'
    FROM public.enrollments e
    LEFT JOIN public.notification_preferences np ON np.user_id = e.student_id
    LEFT JOIN public.homework_reminder_sent hrs
      ON hrs.homework_id = r.homework_id AND hrs.student_id = e.student_id AND hrs.kind = 'due_soon'
    WHERE e.class_id = r.class_id AND e.status = 'active'
      AND hrs.id IS NULL
      AND COALESCE(np.due_soon_alerts, TRUE) = TRUE;

    INSERT INTO public.homework_reminder_sent (homework_id, student_id, kind)
    SELECT r.homework_id, e.student_id, 'due_soon'
    FROM public.enrollments e
    WHERE e.class_id = r.class_id AND e.status = 'active'
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;
