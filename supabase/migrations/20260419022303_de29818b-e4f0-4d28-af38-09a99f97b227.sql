
-- 1) Fix mutable search_path on functions
ALTER FUNCTION public.update_conversation_timestamp() SET search_path = public;
ALTER FUNCTION public.subject_canonical_name(text) SET search_path = public;
ALTER FUNCTION public.upsert_academic_profile(text, text, text[], integer, text, text, jsonb) SET search_path = public;

-- 2) Replace permissive RLS policies on SAIL tables (admin-only)
DROP POLICY IF EXISTS sail_tasks_all ON public.sail_tasks;
DROP POLICY IF EXISTS sail_signals_all ON public.sail_detection_signals;
DROP POLICY IF EXISTS sail_pipelines_all ON public.sail_pipelines;

CREATE POLICY "Only admin can manage SAIL signals"
  ON public.sail_detection_signals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admin can manage SAIL pipelines"
  ON public.sail_pipelines FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 3) Tighten INSERT policies on tutor_booking_insights and analytics_reports
DROP POLICY IF EXISTS tutor_booking_insights_insert ON public.tutor_booking_insights;
CREATE POLICY "Users insert own booking insights"
  ON public.tutor_booking_insights FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = tutor_id);

DROP POLICY IF EXISTS analytics_reports_insert ON public.analytics_reports;
CREATE POLICY "Users insert own analytics reports"
  ON public.analytics_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

-- 4) Restrict listing on public storage buckets.
-- Files remain accessible by direct URL (bucket is public), but listing is restricted to the owner/admin.
DO $$
DECLARE
  b TEXT;
  buckets TEXT[] := ARRAY['profile-photos','tutor-videos','question-diagrams','library-pdfs'];
BEGIN
  FOREACH b IN ARRAY buckets LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || '_public_list');
    EXECUTE format(
      'CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated USING (bucket_id = %L AND (owner = auth.uid() OR public.has_role(auth.uid(), ''admin''::public.app_role)))',
      b || '_owner_list', b
    );
  END LOOP;
END $$;
