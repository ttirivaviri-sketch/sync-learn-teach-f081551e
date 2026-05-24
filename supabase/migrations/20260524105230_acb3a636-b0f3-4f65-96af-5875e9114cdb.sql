
-- 1. Pre-confirm admin-allocated bookings so both apps see them immediately
CREATE OR REPLACE FUNCTION public.generate_allocation_bookings(p_allocation_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc public.tutor_allocations;
  v_slot jsonb;
  v_date date;
  v_dow_target int;
  v_time time;
  v_scheduled_at timestamptz;
  v_count int := 0;
  v_room text;
  v_dow_map jsonb := '{"sun":0,"mon":1,"tue":2,"wed":3,"thu":4,"fri":5,"sat":6}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_alloc FROM public.tutor_allocations WHERE id = p_allocation_id;
  IF v_alloc.id IS NULL THEN RAISE EXCEPTION 'Allocation not found'; END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(v_alloc.weekly_schedule)
  LOOP
    v_dow_target := (v_dow_map ->> lower(v_slot->>'day'))::int;
    v_time := (v_slot->>'time')::time;
    IF v_dow_target IS NULL OR v_time IS NULL THEN CONTINUE; END IF;

    v_date := v_alloc.start_date;
    WHILE v_date <= v_alloc.end_date LOOP
      IF EXTRACT(DOW FROM v_date)::int = v_dow_target THEN
        v_scheduled_at := (v_date::text || ' ' || v_time::text)::timestamptz;
        IF NOT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE (b.tutor_id = v_alloc.tutor_id OR b.learner_id = v_alloc.learner_id)
            AND b.scheduled_at = v_scheduled_at
            AND b.status IN ('requested','confirmed')
        ) THEN
          v_room := 'session-' || gen_random_uuid()::text;
          INSERT INTO public.bookings (
            learner_id, tutor_id, tutor_subject_id, scheduled_at,
            duration_minutes, price, status, room_name,
            allocation_id, source
          ) VALUES (
            v_alloc.learner_id, v_alloc.tutor_id, v_alloc.tutor_subject_id,
            v_scheduled_at, v_alloc.duration_minutes, v_alloc.price_per_session,
            'confirmed', v_room, v_alloc.id, 'admin_allocated'
          );
          v_count := v_count + 1;
        END IF;
      END IF;
      v_date := v_date + 1;
    END LOOP;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 2. Admin-callable notification helper for allocation events
CREATE OR REPLACE FUNCTION public.notify_allocation_event(
  p_allocation_id uuid,
  p_event text,
  p_extra text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alloc public.tutor_allocations;
  v_subject text;
  v_tutor_title text;
  v_tutor_msg text;
  v_learner_title text;
  v_learner_msg text;
  v_type text := 'info';
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  SELECT * INTO v_alloc FROM public.tutor_allocations WHERE id = p_allocation_id;
  IF v_alloc.id IS NULL THEN RAISE EXCEPTION 'Allocation not found'; END IF;

  SELECT subject INTO v_subject FROM public.tutor_subjects WHERE id = v_alloc.tutor_subject_id;
  v_subject := COALESCE(v_subject, 'a subject');

  IF p_event = 'created' THEN
    v_tutor_title  := 'New recurring student assigned';
    v_tutor_msg    := 'Admin has assigned you a recurring ' || v_subject || ' student. Sessions are now in your schedule.';
    v_learner_title := 'Your tutor has been assigned';
    v_learner_msg   := 'Admin has scheduled your recurring ' || v_subject || ' sessions. Check your lessons.';
    v_type := 'success';
  ELSIF p_event = 'paused' THEN
    v_tutor_title := 'Allocation paused';
    v_tutor_msg   := 'Your recurring ' || v_subject || ' sessions have been paused by admin.';
    v_learner_title := 'Sessions paused';
    v_learner_msg   := 'Your recurring ' || v_subject || ' sessions have been paused by admin.';
    v_type := 'warning';
  ELSIF p_event = 'resumed' THEN
    v_tutor_title := 'Allocation resumed';
    v_tutor_msg   := 'Your recurring ' || v_subject || ' sessions are active again.';
    v_learner_title := 'Sessions resumed';
    v_learner_msg   := 'Your recurring ' || v_subject || ' sessions are active again.';
    v_type := 'info';
  ELSIF p_event = 'ended' THEN
    v_tutor_title := 'Allocation ended';
    v_tutor_msg   := 'Your recurring ' || v_subject || ' allocation has ended.';
    v_learner_title := 'Allocation ended';
    v_learner_msg   := 'Your recurring ' || v_subject || ' allocation has ended.';
    v_type := 'warning';
  ELSIF p_event = 'regenerated' THEN
    v_tutor_title := 'New sessions added';
    v_tutor_msg   := COALESCE(p_extra, 'New') || ' sessions were added to your ' || v_subject || ' schedule.';
    v_learner_title := 'New sessions added';
    v_learner_msg   := COALESCE(p_extra, 'New') || ' sessions were added to your ' || v_subject || ' schedule.';
    v_type := 'info';
  ELSE
    RAISE EXCEPTION 'Unknown event %', p_event;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_alloc.tutor_id, v_tutor_title, v_tutor_msg, v_type);
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_alloc.learner_id, v_learner_title, v_learner_msg, v_type);
END;
$$;

-- 3. Auto-notify on allocation creation (in addition to per-booking notifications)
CREATE OR REPLACE FUNCTION public.fn_after_allocation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject text;
BEGIN
  PERFORM public.generate_allocation_bookings(NEW.id);

  SELECT subject INTO v_subject FROM public.tutor_subjects WHERE id = NEW.tutor_subject_id;
  v_subject := COALESCE(v_subject, 'a subject');

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NEW.tutor_id,
    'New recurring student assigned',
    'Admin has assigned you a recurring ' || v_subject || ' student. Sessions are now in your schedule.',
    'success'
  );
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    NEW.learner_id,
    'Your tutor has been assigned',
    'Admin has scheduled your recurring ' || v_subject || ' sessions. Check your lessons.',
    'success'
  );

  RETURN NEW;
END;
$$;
