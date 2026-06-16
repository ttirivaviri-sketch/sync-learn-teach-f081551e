-- supabase/tests/homework_reminder_dedupe_test.sql
--
-- Manual / CI verification that homework "due soon" reminders dedupe correctly
-- across:
--   1. Multiple distinct homework rows for the same student (each should
--      independently produce exactly one reminder).
--   2. Repeated cron runs against the same homework (second run is a no-op).
--   3. A teacher rescheduling due_at — the trg_reset_due_soon_on_reschedule
--      trigger clears the dedupe so the next cron run fires a fresh reminder.
--
-- Run inside a transaction; ROLLBACK at the end so no test data persists.
--   psql "$DATABASE_URL" -f supabase/tests/homework_reminder_dedupe_test.sql
--
-- Exits non-zero if any RAISE EXCEPTION fires.

BEGIN;

SET LOCAL client_min_messages = WARNING;

DO $$
DECLARE
  v_student UUID := gen_random_uuid();
  v_teacher UUID := gen_random_uuid();
  v_school  UUID;
  v_class   UUID;
  v_hw1     UUID;
  v_hw2     UUID;
  v_count   INT;
BEGIN
  -- Seed minimal fixtures. We use service-role context (SECURITY DEFINER
  -- functions run with privileges; the test runs as a superuser via psql).
  INSERT INTO auth.users (id, email, created_at, updated_at, raw_user_meta_data, instance_id, aud, role)
  VALUES
    (v_student, 'student-' || v_student || '@test.local', now(), now(), '{}'::jsonb, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated'),
    (v_teacher, 'teacher-' || v_teacher || '@test.local', now(), now(), '{}'::jsonb, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated');

  INSERT INTO public.schools (name, status, created_by)
  VALUES ('Dedupe Test School', 'active', v_teacher)
  RETURNING id INTO v_school;

  INSERT INTO public.classes (school_id, name, created_by)
  VALUES (v_school, 'Dedupe Test Class', v_teacher)
  RETURNING id INTO v_class;

  INSERT INTO public.enrollments (class_id, student_id, status)
  VALUES (v_class, v_student, 'active');

  -- Insert turns notifications on by default via NULL prefs (COALESCE true).

  ------------------------------------------------------------------------
  -- Case 1: two distinct homeworks, each in the 24h window → 2 reminders.
  ------------------------------------------------------------------------
  INSERT INTO public.school_homework (class_id, title, due_at, created_by)
  VALUES (v_class, 'HW Quiz A', now() + interval '24 hours', v_teacher)
  RETURNING id INTO v_hw1;

  INSERT INTO public.school_homework (class_id, title, due_at, created_by)
  VALUES (v_class, 'HW Quiz B', now() + interval '24 hours 30 minutes', v_teacher)
  RETURNING id INTO v_hw2;

  -- Clear any release-time notifications so we're only measuring due_soon.
  DELETE FROM public.notifications WHERE user_id = v_student;
  DELETE FROM public.homework_reminder_sent WHERE student_id = v_student;

  PERFORM public.notify_homework_due_soon();

  SELECT count(*) INTO v_count FROM public.notifications
   WHERE user_id = v_student AND title LIKE 'Due tomorrow:%';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Case 1 failed: expected 2 due-soon notifications, got %', v_count;
  END IF;

  ------------------------------------------------------------------------
  -- Case 2: second cron run is a no-op (dedupe).
  ------------------------------------------------------------------------
  PERFORM public.notify_homework_due_soon();
  SELECT count(*) INTO v_count FROM public.notifications
   WHERE user_id = v_student AND title LIKE 'Due tomorrow:%';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Case 2 failed: duplicate sent; count=%', v_count;
  END IF;

  ------------------------------------------------------------------------
  -- Case 3: reschedule HW1 to a new time still in window → reminder reset
  --         triggers a third notification on next cron run.
  ------------------------------------------------------------------------
  UPDATE public.school_homework
     SET due_at = now() + interval '24 hours 15 minutes'
   WHERE id = v_hw1;

  -- Trigger should have wiped the due_soon row for v_hw1/v_student.
  SELECT count(*) INTO v_count FROM public.homework_reminder_sent
   WHERE homework_id = v_hw1 AND student_id = v_student AND kind = 'due_soon';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Case 3a failed: reschedule did not reset dedupe; count=%', v_count;
  END IF;

  PERFORM public.notify_homework_due_soon();
  SELECT count(*) INTO v_count FROM public.notifications
   WHERE user_id = v_student AND title LIKE 'Due tomorrow:%';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Case 3b failed: expected 3 total after reschedule, got %', v_count;
  END IF;

  ------------------------------------------------------------------------
  -- Case 4: user opts out of due_soon alerts → next reschedule should NOT
  --         produce a new notification, even though dedupe is cleared.
  ------------------------------------------------------------------------
  INSERT INTO public.notification_preferences (user_id, due_soon_alerts)
  VALUES (v_student, FALSE)
  ON CONFLICT (user_id) DO UPDATE SET due_soon_alerts = FALSE;

  UPDATE public.school_homework
     SET due_at = now() + interval '24 hours 20 minutes'
   WHERE id = v_hw1;

  PERFORM public.notify_homework_due_soon();
  SELECT count(*) INTO v_count FROM public.notifications
   WHERE user_id = v_student AND title LIKE 'Due tomorrow:%';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Case 4 failed: opt-out ignored; count=%', v_count;
  END IF;

  RAISE NOTICE 'All homework_reminder dedupe cases passed.';
END $$;

ROLLBACK;
