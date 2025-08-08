-- Admin Panel MVP schema and policies
BEGIN;

-- 1) Roles
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','tutor','learner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
  );
$$;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Only admins can manage roles" ON public.user_roles;
CREATE POLICY "Only admins can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));


-- 2) Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL,
  learner_id uuid NOT NULL,
  subject text,
  mode text NOT NULL DEFAULT 'online',
  location jsonb,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_sessions_updated_at ON public.sessions;
CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.validate_session_times()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.end_at <= NEW.start_at THEN
    RAISE EXCEPTION 'end_at must be after start_at';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sessions_validate_times ON public.sessions;
CREATE TRIGGER trg_sessions_validate_times
BEFORE INSERT OR UPDATE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.validate_session_times();

DROP POLICY IF EXISTS "Admins can manage all sessions" ON public.sessions;
CREATE POLICY "Admins can manage all sessions"
ON public.sessions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Tutors can manage their sessions" ON public.sessions;
CREATE POLICY "Tutors can manage their sessions"
ON public.sessions
FOR SELECT, UPDATE, DELETE
TO authenticated
USING (auth.uid() = tutor_id);

DROP POLICY IF EXISTS "Tutors can insert their sessions" ON public.sessions;
CREATE POLICY "Tutors can insert their sessions"
ON public.sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = tutor_id);

DROP POLICY IF EXISTS "Learners can view their sessions" ON public.sessions;
CREATE POLICY "Learners can view their sessions"
ON public.sessions
FOR SELECT
TO authenticated
USING (auth.uid() = learner_id);


-- 3) Broadcasts
CREATE TABLE IF NOT EXISTS public.broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  audience text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage broadcasts" ON public.broadcasts;
CREATE POLICY "Admins can manage broadcasts"
ON public.broadcasts
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin'))
WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Users can read targeted broadcasts" ON public.broadcasts;
CREATE POLICY "Users can read targeted broadcasts"
ON public.broadcasts
FOR SELECT
TO authenticated
USING (
  audience = 'all'
  OR (audience = 'tutors' AND (public.has_role(auth.uid(),'tutor') OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'tutor')))
  OR (audience = 'learners' AND (public.has_role(auth.uid(),'learner') OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'learner')))
);


-- 4) Direct messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can read their messages" ON public.direct_messages;
CREATE POLICY "Participants can read their messages"
ON public.direct_messages
FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send messages" ON public.direct_messages;
CREATE POLICY "Users can send messages"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Senders can modify their messages" ON public.direct_messages;
CREATE POLICY "Senders can modify their messages"
ON public.direct_messages
FOR UPDATE, DELETE
TO authenticated
USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Admins can view all messages" ON public.direct_messages;
CREATE POLICY "Admins can view all messages"
ON public.direct_messages
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(),'admin'));


-- 5) Resources
CREATE TABLE IF NOT EXISTS public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  subject text,
  url text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_resources_updated_at ON public.resources;
CREATE TRIGGER trg_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP POLICY IF EXISTS "Everyone can read resources" ON public.resources;
CREATE POLICY "Everyone can read resources"
ON public.resources
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins and tutors can insert resources" ON public.resources;
CREATE POLICY "Admins and tutors can insert resources"
ON public.resources
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tutor')));

DROP POLICY IF EXISTS "Creators or admin can modify resources" ON public.resources;
CREATE POLICY "Creators or admin can modify resources"
ON public.resources
FOR UPDATE, DELETE
TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));


-- 6) Activity logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.log_activity(_action text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.activity_logs (actor_id, action, metadata)
  VALUES (auth.uid(), _action, _metadata);
END;
$$;

DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Authenticated users can create logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can create logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (true);


-- 7) Realtime for new tables
ALTER TABLE public.sessions REPLICA IDENTITY FULL;
ALTER TABLE public.broadcasts REPLICA IDENTITY FULL;
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.resources REPLICA IDENTITY FULL;
ALTER TABLE public.activity_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcasts';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.resources';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 8) Storage bucket + policies for study resources
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-resources','study-resources', true)
ON CONFLICT (id) DO NOTHING;

DO $policy$
BEGIN
  BEGIN
    CREATE POLICY "Public read study resources"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'study-resources');
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Admins and tutors can upload study resources"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'study-resources'
      AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'tutor'))
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Creators or admin can update study resources"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'study-resources'
      AND (public.has_role(auth.uid(),'admin') OR auth.uid()::text = (storage.foldername(name))[1])
    )
    WITH CHECK (bucket_id = 'study-resources');
  EXCEPTION WHEN duplicate_object THEN NULL; END;

  BEGIN
    CREATE POLICY "Creators or admin can delete study resources"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'study-resources'
      AND (public.has_role(auth.uid(),'admin') OR auth.uid()::text = (storage.foldername(name))[1])
    );
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END
$policy$;

COMMIT;