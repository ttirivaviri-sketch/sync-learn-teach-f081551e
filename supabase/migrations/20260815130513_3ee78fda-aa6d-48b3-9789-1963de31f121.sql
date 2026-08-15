-- 1. Reminder de-dup ledger -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_reminder_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id, user_id, kind)
);

GRANT SELECT ON public.session_reminder_sent TO authenticated;
GRANT ALL ON public.session_reminder_sent TO service_role;

ALTER TABLE public.session_reminder_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session reminders"
  ON public.session_reminder_sent FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_session_reminder_sent_booking
  ON public.session_reminder_sent (booking_id);

-- 2. Preference toggle -------------------------------------------------------
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS session_reminder_alerts boolean NOT NULL DEFAULT true;

-- 3. Reminder dispatcher -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_session_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_kind text;
  v_when text;
BEGIN
  FOR r IN
    SELECT b.id,
           b.learner_id,
           b.tutor_id,
           b.scheduled_at,
           b.duration_minutes,
           CASE
             WHEN b.scheduled_at BETWEEN now() + interval '45 minutes'
                                     AND now() + interval '75 minutes' THEN 'starting_soon'
             ELSE 'day_before'
           END AS kind
    FROM public.bookings b
    WHERE b.status = 'confirmed'
      AND (
        b.scheduled_at BETWEEN now() + interval '45 minutes' AND now() + interval '75 minutes'
        OR b.scheduled_at BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
      )
  LOOP
    v_kind := r.kind;
    v_when := to_char(r.scheduled_at AT TIME ZONE 'Africa/Johannesburg', 'Mon DD, HH24:MI');

    -- Learner
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    SELECT r.learner_id,
           CASE WHEN v_kind = 'starting_soon'
                THEN 'Your session starts in about an hour'
                ELSE 'Session tomorrow' END,
           'Tutoring session on ' || v_when || ' (' || r.duration_minutes || ' min). Be ready a few minutes early.',
           CASE WHEN v_kind = 'starting_soon' THEN 'warning' ELSE 'info' END,
           r.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.session_reminder_sent s
      WHERE s.booking_id = r.id AND s.user_id = r.learner_id AND s.kind = v_kind
    )
    AND COALESCE(
      (SELECT np.session_reminder_alerts FROM public.notification_preferences np
       WHERE np.user_id = r.learner_id), TRUE) = TRUE;

    -- Tutor
    INSERT INTO public.notifications (user_id, title, message, type, related_booking_id)
    SELECT r.tutor_id,
           CASE WHEN v_kind = 'starting_soon'
                THEN 'You have a session in about an hour'
                ELSE 'Session tomorrow' END,
           'Tutoring session on ' || v_when || ' (' || r.duration_minutes || ' min). Your learner is expecting you.',
           CASE WHEN v_kind = 'starting_soon' THEN 'warning' ELSE 'info' END,
           r.id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.session_reminder_sent s
      WHERE s.booking_id = r.id AND s.user_id = r.tutor_id AND s.kind = v_kind
    )
    AND COALESCE(
      (SELECT np.session_reminder_alerts FROM public.notification_preferences np
       WHERE np.user_id = r.tutor_id), TRUE) = TRUE;

    INSERT INTO public.session_reminder_sent (booking_id, user_id, kind)
    VALUES (r.id, r.learner_id, v_kind), (r.id, r.tutor_id, v_kind)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

-- 4. Double-booking guard ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_booking_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new tstzrange;
BEGIN
  IF NEW.status IN ('canceled', 'completed') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.scheduled_at = OLD.scheduled_at
     AND NEW.duration_minutes = OLD.duration_minutes
     AND NEW.tutor_id = OLD.tutor_id
     AND NEW.learner_id = OLD.learner_id
     AND OLD.status NOT IN ('canceled', 'completed') THEN
    RETURN NEW;
  END IF;

  v_new := tstzrange(
    NEW.scheduled_at,
    NEW.scheduled_at + make_interval(mins => NEW.duration_minutes),
    '[)'
  );

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id IS DISTINCT FROM NEW.id
      AND b.tutor_id = NEW.tutor_id
      AND b.status IN ('requested', 'confirmed')
      AND tstzrange(b.scheduled_at,
                    b.scheduled_at + make_interval(mins => b.duration_minutes),
                    '[)') && v_new
  ) THEN
    RAISE EXCEPTION 'TUTOR_SLOT_TAKEN: this tutor already has a session booked in that time slot'
      USING ERRCODE = '23P01';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.id IS DISTINCT FROM NEW.id
      AND b.learner_id = NEW.learner_id
      AND b.status IN ('requested', 'confirmed')
      AND tstzrange(b.scheduled_at,
                    b.scheduled_at + make_interval(mins => b.duration_minutes),
                    '[)') && v_new
  ) THEN
    RAISE EXCEPTION 'LEARNER_SLOT_TAKEN: you already have another session booked in that time slot'
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_booking_overlap ON public.bookings;
CREATE TRIGGER trg_prevent_booking_overlap
  BEFORE INSERT OR UPDATE OF scheduled_at, duration_minutes, status, tutor_id, learner_id
  ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_overlap();

CREATE INDEX IF NOT EXISTS idx_bookings_tutor_schedule
  ON public.bookings (tutor_id, scheduled_at) WHERE status IN ('requested', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_bookings_learner_schedule
  ON public.bookings (learner_id, scheduled_at) WHERE status IN ('requested', 'confirmed');

-- 5. Busy-slot lookup for the booking UI (no PII exposed) --------------------
CREATE OR REPLACE FUNCTION public.get_tutor_busy_slots(
  _tutor_id uuid,
  _from timestamptz,
  _to timestamptz
)
RETURNS TABLE (scheduled_at timestamptz, duration_minutes integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.scheduled_at, b.duration_minutes
  FROM public.bookings b
  WHERE b.tutor_id = _tutor_id
    AND b.status IN ('requested', 'confirmed')
    AND b.scheduled_at >= LEAST(_from, _to)
    AND b.scheduled_at <= GREATEST(_from, _to) + interval '1 day'
$$;

REVOKE ALL ON FUNCTION public.get_tutor_busy_slots(uuid, timestamptz, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.get_tutor_busy_slots(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tutor_busy_slots(uuid, timestamptz, timestamptz) TO service_role;