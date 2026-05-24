
-- 1. qualifications: replace anonymous public SELECT with authenticated-only
DROP POLICY IF EXISTS "Anyone can view qualifications" ON public.qualifications;
CREATE POLICY "Authenticated users can view qualifications"
  ON public.qualifications FOR SELECT
  TO authenticated
  USING (true);

-- 2. payout_requests: ownership-enforced INSERT
CREATE POLICY "Tutors insert own payout requests"
  ON public.payout_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = tutor_id);

-- 3. library_access_log: ownership-enforced INSERT
CREATE POLICY "Users insert own access log"
  ON public.library_access_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 4. study_memory_daily: ownership-enforced INSERT/UPDATE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='study_memory_daily') THEN
    EXECUTE 'CREATE POLICY "smd_insert_own" ON public.study_memory_daily FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "smd_update_own" ON public.study_memory_daily FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;

-- 5. study_memory_summary: ownership-enforced INSERT/UPDATE
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='study_memory_summary') THEN
    EXECUTE 'CREATE POLICY "sms_insert_own" ON public.study_memory_summary FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "sms_update_own" ON public.study_memory_summary FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;
END$$;
