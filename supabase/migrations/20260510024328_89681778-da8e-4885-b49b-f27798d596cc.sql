
-- 1) Weekly insights schedule
ALTER TABLE public.academic_profiles
  ADD COLUMN IF NOT EXISTS weekly_report_dow smallint NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.scheduled_insight_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  sent_to_guardian boolean NOT NULL DEFAULT false,
  sent_to_tutors uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
ALTER TABLE public.scheduled_insight_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own runs" ON public.scheduled_insight_runs;
CREATE POLICY "Users can view their own runs"
  ON public.scheduled_insight_runs FOR SELECT
  USING (auth.uid() = user_id);

-- 2) Tighten RLS

-- profiles: drop public tutor SELECT; expose safe tutor info via view
DROP POLICY IF EXISTS "Anyone can view tutor profiles for discovery" ON public.profiles;
CREATE POLICY "Authenticated users can view tutor profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (user_type = 'tutor');

CREATE OR REPLACE VIEW public.tutors_public
WITH (security_invoker = on) AS
SELECT id, full_name, avatar_url, bio, online_status, last_seen,
       location_lat, location_lng, user_type, is_official
FROM public.profiles
WHERE user_type = 'tutor';

GRANT SELECT ON public.tutors_public TO anon, authenticated;

-- subject_exams: scope read to owner
DROP POLICY IF EXISTS "Allow all users to view exams" ON public.subject_exams;
CREATE POLICY "Users can view own subject exams"
  ON public.subject_exams FOR SELECT
  USING (auth.uid() = user_id);

-- learner_subjects: scope read to owner
DROP POLICY IF EXISTS "Anyone can view learner subjects" ON public.learner_subjects;
CREATE POLICY "Users can view own learner subjects"
  ON public.learner_subjects FOR SELECT
  USING (auth.uid() = user_id);

-- subject_xp: scope direct read to owner; leaderboards use SECURITY DEFINER RPCs
DROP POLICY IF EXISTS "Anyone authenticated can view subject xp" ON public.subject_xp;
CREATE POLICY "Users can view own subject xp"
  ON public.subject_xp FOR SELECT
  USING (auth.uid() = user_id);

-- 3) Storage: tutor-documents UPDATE & DELETE policies (owner-folder scoped)
CREATE POLICY "Tutors can update their own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'tutor-documents'
         AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'tutor-documents'
         AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Tutors can delete their own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'tutor-documents'
         AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 4) Remove sensitive tables from realtime broadcast
ALTER PUBLICATION supabase_realtime DROP TABLE public.academic_profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE public.subject_xp;
