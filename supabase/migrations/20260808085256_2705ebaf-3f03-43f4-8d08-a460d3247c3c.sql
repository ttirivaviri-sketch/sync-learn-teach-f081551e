-- 1. Realtime for subject XP (user_progress is already published)
ALTER TABLE public.subject_xp REPLICA IDENTITY FULL;
ALTER TABLE public.user_progress REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'subject_xp'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subject_xp;
  END IF;
END $$;

-- 2. Founder welcome notification
CREATE OR REPLACE FUNCTION public.welcome_message_body()
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
'Hey fam, welcome to StudySync!

I''m Ashlie Potera, and on behalf of the whole StudySync team — thank you for joining us on this journey. We''re genuinely excited to have you here.

A little honesty up front: we''re still in our early stages. That means a bug may pop up here and there. When it does, our team is working tirelessly to fix things in real time, so you''re never stuck for long.

On payments: we''re currently running on EFT and bank deposit while we finish building a more reliable automated system. Once your payment is confirmed by our team, your access unlocks straight away.

In the meantime, please enjoy the app. If you hit a bug, or there''s a subject, book or past paper missing from the library that you''d like us to add, email us at supportstudysync@gmail.com — we''ll work on it swiftly.

Thanks for joining fam, and thank you for helping us build an app in sync with your future and the continent''s.

— Ashlie Potera & the StudySync team';
$$;

CREATE OR REPLACE FUNCTION public.send_welcome_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.user_type, 'learner') <> 'tutor' THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.id, 'Welcome to StudySync 🎉', public.welcome_message_body(), 'info');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_welcome_notification ON public.profiles;
CREATE TRIGGER trg_send_welcome_notification
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.send_welcome_notification();

-- Backfill for existing learners (once)
INSERT INTO public.notifications (user_id, title, message, type)
SELECT p.id, 'Welcome to StudySync 🎉', public.welcome_message_body(), 'info'
FROM public.profiles p
WHERE COALESCE(p.user_type, 'learner') <> 'tutor'
  AND NOT EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.user_id = p.id AND n.title = 'Welcome to StudySync 🎉'
  );