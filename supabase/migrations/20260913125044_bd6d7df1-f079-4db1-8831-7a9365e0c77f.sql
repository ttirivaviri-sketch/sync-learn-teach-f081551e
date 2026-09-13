-- 1. Harden any legacy permissive "service role" policies to the service role only.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN ('tutor_wallets','tutor_payouts','payout_audit_log','video_audit_log','student_insights_cache','learning_signals')
      AND p.policyname ILIKE 'Service role manages%'
      AND 'service_role' <> ALL (p.roles)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Revoke direct client privileges on these financial/audit tables where present.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tutor_payouts','payout_audit_log','video_audit_log','learning_signals','student_insights_cache']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t) THEN
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

-- 2. account_deletion_archive: explicit admin-only read, no client writes.
ALTER TABLE public.account_deletion_archive ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletion_archive FROM anon;
REVOKE ALL ON public.account_deletion_archive FROM authenticated;
GRANT SELECT ON public.account_deletion_archive TO authenticated;
GRANT ALL ON public.account_deletion_archive TO service_role;

DROP POLICY IF EXISTS "Admins can view deletion archive" ON public.account_deletion_archive;
CREATE POLICY "Admins can view deletion archive"
  ON public.account_deletion_archive FOR SELECT
  TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::app_role));

-- 3. payout_requests: keep bank details limited to owner + admins, signed-in only.
REVOKE ALL ON public.payout_requests FROM anon;

DROP POLICY IF EXISTS "Tutors view own payout requests" ON public.payout_requests;
CREATE POLICY "Tutors view own payout requests"
  ON public.payout_requests FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = tutor_id
    OR public.has_role((SELECT auth.uid()), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "payout_requests_update_4c9184_merged" ON public.payout_requests;
CREATE POLICY "payout_requests_update_4c9184_merged"
  ON public.payout_requests FOR UPDATE
  TO authenticated
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR ((SELECT auth.uid()) = tutor_id AND status = 'pending')
  )
  WITH CHECK (
    public.has_role((SELECT auth.uid()), 'admin'::app_role)
    OR ((SELECT auth.uid()) = tutor_id AND status = ANY (ARRAY['pending','cancelled']))
  );