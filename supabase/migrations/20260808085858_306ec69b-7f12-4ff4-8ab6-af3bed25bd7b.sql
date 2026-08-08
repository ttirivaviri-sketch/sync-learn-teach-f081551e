
CREATE OR REPLACE FUNCTION public.ensure_studysync_team_conversation(_learner_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team uuid := '00000000-0000-0000-0000-000000000001';
  _conv uuid;
  _welcome text;
BEGIN
  IF _learner_id IS NULL OR _learner_id = _team THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _conv
  FROM public.conversations
  WHERE tutor_id = _team AND learner_id = _learner_id
  LIMIT 1;

  IF _conv IS NULL THEN
    INSERT INTO public.conversations (tutor_id, learner_id, last_message_at)
    VALUES (_team, _learner_id, now())
    RETURNING id INTO _conv;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id = _conv) THEN
    _welcome :=
'Hi, and welcome to StudySync! 👋

I''m Ashlie Potera, founder of StudySync, and I''m genuinely glad you''re here.

StudySync is still in its early stages. That means you may run into the odd bug or something that doesn''t work perfectly yet — if that happens, please tell us. Every report helps us fix things faster and build the learning tool you actually need.

A few honest notes:
• Payments are handled manually for now (EFT, bank deposit or EcoCash). Once your proof of payment is confirmed by our team, Study Mode unlocks for you.
• We are adding features and improvements every week.
• You can reply right here in this chat — this is a direct line to our team.

Thank you for trusting us this early. Let''s get studying.

— Ashlie Potera & the StudySync Team';

    INSERT INTO public.messages (conversation_id, sender_id, content)
    VALUES (_conv, _team, _welcome);

    UPDATE public.conversations SET last_message_at = now() WHERE id = _conv;
  END IF;

  RETURN _conv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_studysync_team_conversation(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.send_studysync_team_message(_learner_id uuid, _content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _team uuid := '00000000-0000-0000-0000-000000000001';
  _conv uuid;
  _msg uuid;
BEGIN
  _conv := public.ensure_studysync_team_conversation(_learner_id);
  IF _conv IS NULL THEN RETURN NULL; END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (_conv, _team, _content)
  RETURNING id INTO _msg;

  UPDATE public.conversations SET last_message_at = now() WHERE id = _conv;
  RETURN _msg;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_studysync_team_message(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.send_studysync_team_message(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_studysync_team_message(uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.send_studysync_team_message(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_create_studysync_team_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id <> '00000000-0000-0000-0000-000000000001' AND NEW.user_type = 'learner' THEN
    PERFORM public.ensure_studysync_team_conversation(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_studysync_team_conversation ON public.profiles;
CREATE TRIGGER trg_create_studysync_team_conversation
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_create_studysync_team_conversation();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE user_type = 'learner' LOOP
    PERFORM public.ensure_studysync_team_conversation(r.id);
  END LOOP;
END $$;
