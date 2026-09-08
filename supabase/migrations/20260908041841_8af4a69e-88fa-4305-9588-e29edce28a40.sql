CREATE OR REPLACE FUNCTION public.conversation_parties_unchanged(_id uuid, _tutor_id uuid, _learner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _id AND c.tutor_id = _tutor_id AND c.learner_id = _learner_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.conversation_parties_unchanged(uuid, uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.conversation_parties_unchanged(uuid, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.message_body_unchanged(_id uuid, _conversation_id uuid, _sender_id uuid, _content text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = _id
      AND m.conversation_id = _conversation_id
      AND m.sender_id = _sender_id
      AND m.content = _content
  )
$$;
REVOKE EXECUTE ON FUNCTION public.message_body_unchanged(uuid, uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.message_body_unchanged(uuid, uuid, uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Participants can update conversation timestamps" ON public.conversations;
CREATE POLICY "Participants can update conversation timestamps"
ON public.conversations FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = tutor_id OR (SELECT auth.uid()) = learner_id)
WITH CHECK (
  ((SELECT auth.uid()) = tutor_id OR (SELECT auth.uid()) = learner_id)
  AND public.conversation_parties_unchanged(id, tutor_id, learner_id)
);

DROP POLICY IF EXISTS "Users can mark their own messages as read" ON public.messages;
CREATE POLICY "Users can mark their own messages as read"
ON public.messages FOR UPDATE TO authenticated
USING (public.has_conversation_access(conversation_id, (SELECT auth.uid())) AND (SELECT auth.uid()) <> sender_id)
WITH CHECK (
  public.has_conversation_access(conversation_id, (SELECT auth.uid()))
  AND (SELECT auth.uid()) <> sender_id
  AND public.message_body_unchanged(id, conversation_id, sender_id, content)
);