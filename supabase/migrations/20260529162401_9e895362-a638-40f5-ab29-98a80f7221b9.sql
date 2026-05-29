
-- NOTE: Supabase migrations run inside a transaction, so CONCURRENTLY is not
-- usable here. Tables are small enough that brief ACCESS EXCLUSIVE locks during
-- index build are acceptable. IF NOT EXISTS makes the migration idempotent.

-- =========================================================================
-- 1. Missing indexes for RLS / hot read paths at 100k scale
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_payments_payer_created
  ON public.payments (payer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_patterns_user_subject
  ON public.exam_patterns (user_id, subject_id);

CREATE INDEX IF NOT EXISTS idx_documents_user_type_processed
  ON public.documents (user_id, type)
  WHERE is_processed = true;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_date_subject
  ON public.daily_tasks (task_date, subject_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_created
  ON public.quiz_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_landing_events_created
  ON public.landing_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_tutor_scheduled
  ON public.bookings (tutor_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_bookings_learner_scheduled
  ON public.bookings (learner_id, scheduled_at);

-- =========================================================================
-- 2. Drop duplicate / redundant indexes
-- =========================================================================

-- bookings: idx_bookings_learner duplicates idx_bookings_learner_id; same for tutor.
-- Keep the *_scheduled composites above + the plain *_id ones; drop the bare dupes.
DROP INDEX IF EXISTS public.idx_bookings_learner;
DROP INDEX IF EXISTS public.idx_bookings_tutor;

-- notifications: idx_notifications_user_id is fully covered by the (user_id, read)
-- and (user_id, created_at DESC) composites.
DROP INDEX IF EXISTS public.idx_notifications_user_id;

-- =========================================================================
-- 3. has_conversation_access helper + messages policy refactor
-- =========================================================================

CREATE OR REPLACE FUNCTION public.has_conversation_access(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations
    WHERE id = _conversation_id
      AND (_user_id = tutor_id OR _user_id = learner_id)
  );
$$;

REVOKE ALL ON FUNCTION public.has_conversation_access(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.has_conversation_access(uuid, uuid) TO authenticated, service_role;

-- Replace messages policies to route through the helper.
DROP POLICY IF EXISTS "Participants can view messages in their conversations" ON public.messages;
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can mark their own messages as read" ON public.messages;

CREATE POLICY "Participants can view messages in their conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (public.has_conversation_access(conversation_id, (select auth.uid())));

CREATE POLICY "Participants can send messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (select auth.uid()) = sender_id
  AND public.has_conversation_access(conversation_id, (select auth.uid()))
);

CREATE POLICY "Users can mark their own messages as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  public.has_conversation_access(conversation_id, (select auth.uid()))
  AND (select auth.uid()) <> sender_id
);
