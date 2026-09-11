CREATE OR REPLACE FUNCTION public.enforce_booking_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin'::app_role);
BEGIN
  IF NOT v_is_admin THEN
    IF (NEW.learner_id IS DISTINCT FROM OLD.learner_id)
       OR (NEW.tutor_id IS DISTINCT FROM OLD.tutor_id)
       OR (NEW.tutor_subject_id IS DISTINCT FROM OLD.tutor_subject_id)
       OR (NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at)
       OR (NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes)
       OR (NEW.price IS DISTINCT FROM OLD.price)
    THEN
      RAISE EXCEPTION 'Only status may be modified by participants';
    END IF;

    -- A tutor must not be able to self-certify completion before the session
    -- has actually taken place (that would unlock an immediate payout).
    IF NEW.status = 'completed'::booking_status
       AND OLD.status IS DISTINCT FROM 'completed'::booking_status
       AND auth.uid() IS DISTINCT FROM NEW.learner_id
    THEN
      IF NEW.scheduled_at IS NULL
         OR now() < (NEW.scheduled_at
                     + make_interval(mins => COALESCE(NEW.duration_minutes, 0))
                     - interval '5 minutes')
      THEN
        RAISE EXCEPTION 'A session can only be marked completed after it has taken place';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;