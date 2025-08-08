BEGIN;
-- Fix sessions tutor policies by splitting commands
DROP POLICY IF EXISTS "Tutors can manage their sessions" ON public.sessions;
DROP POLICY IF EXISTS "Tutors can manage their sessions - select" ON public.sessions;
DROP POLICY IF EXISTS "Tutors can view their sessions" ON public.sessions;
DROP POLICY IF EXISTS "Tutors can update their sessions" ON public.sessions;
DROP POLICY IF EXISTS "Tutors can delete their sessions" ON public.sessions;

CREATE POLICY "Tutors can view their sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (auth.uid() = tutor_id);

CREATE POLICY "Tutors can update their sessions"
ON public.sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = tutor_id);

CREATE POLICY "Tutors can delete their sessions"
ON public.sessions
FOR DELETE
TO authenticated
USING (auth.uid() = tutor_id);

-- Fix direct_messages modify policy by splitting
DROP POLICY IF EXISTS "Senders can modify their messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Senders can update their messages" ON public.direct_messages;
DROP POLICY IF EXISTS "Senders can delete their messages" ON public.direct_messages;

CREATE POLICY "Senders can update their messages"
ON public.direct_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id);

CREATE POLICY "Senders can delete their messages"
ON public.direct_messages
FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Fix resources modify policy by splitting
DROP POLICY IF EXISTS "Creators or admin can modify resources" ON public.resources;
DROP POLICY IF EXISTS "Creators or admin can update resources" ON public.resources;
DROP POLICY IF EXISTS "Creators or admin can delete resources" ON public.resources;

CREATE POLICY "Creators or admin can update resources"
ON public.resources
FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Creators or admin can delete resources"
ON public.resources
FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

COMMIT;