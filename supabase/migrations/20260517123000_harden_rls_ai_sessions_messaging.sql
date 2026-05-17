-- Harden RLS for AI credits/usage, tutor sessions, and messaging/email-related tables.

-- Helper: remove all existing policies for a table so we can define least-privilege rules.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_usage_daily'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_usage_daily', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view own AI usage"
  ON public.ai_usage_daily FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages AI usage"
  ON public.ai_usage_daily FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='topic_sessions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.topic_sessions', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users manage own topic sessions"
  ON public.topic_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages topic sessions"
  ON public.topic_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='conversations'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.conversations', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Participants can view conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = learner_id OR auth.uid() = tutor_id);

CREATE POLICY "Participants can create conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = learner_id OR auth.uid() = tutor_id);

CREATE POLICY "Participants can update own conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = learner_id OR auth.uid() = tutor_id)
  WITH CHECK (auth.uid() = learner_id OR auth.uid() = tutor_id);

CREATE POLICY "Admins can read all conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages conversations"
  ON public.conversations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='messages'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Participants can view messages"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (auth.uid() = c.learner_id OR auth.uid() = c.tutor_id)
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (auth.uid() = c.learner_id OR auth.uid() = c.tutor_id)
    )
  );

CREATE POLICY "Recipients can mark messages read"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() = c.learner_id
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND auth.uid() = c.tutor_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (auth.uid() = c.learner_id OR auth.uid() = c.tutor_id)
    )
  );

CREATE POLICY "Admins can read all messages"
  ON public.messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages messages"
  ON public.messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname='public' AND tablename='analytics_reports'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.analytics_reports', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Users can view own analytics reports"
  ON public.analytics_reports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages analytics reports"
  ON public.analytics_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);
