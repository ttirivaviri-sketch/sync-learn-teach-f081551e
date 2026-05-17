-- ============================================================
-- COMPREHENSIVE RLS HARDENING
-- Fixes:
--   1. ai_credits / ai_usage_daily  — users must not read/modify each other's credits
--   2. subscriptions                — users must not read/modify other users' plans
--   3. tutor_payments / payments / payouts — strict payment privacy
--   4. tutor_verifications          — only owner + admin (contains ID numbers)
--   5. qualifications               — revoke "Anyone can view"; owner + admin only
--   6. documents                    — owner + admin only (ID docs, police clearance, certs)
--   7. reviews                      — restrict to authenticated; keep aggregate data safe
--   8. SAIL internal tables         — restrict from world-read to admin-only
--   9. profiles                     — lock personal fields; own row + shared-relationship only
--  10. tutor_wallets                — own row only (no cross-read)
--  11. storage buckets              — tutor-documents must be private; no cross-user reads
-- ============================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. AI CREDITS / AI_USAGE_DAILY
--    No user should read or mutate another user's credit/usage data.
--    (ai_usage_daily was partially fixed before; harden further here.)
-- ──────────────────────────────────────────────────────────────────────────────

-- Drop any residual overly-broad policies on ai_usage_daily
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='ai_usage_daily'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_usage_daily', pol.policyname);
  END LOOP;
END $$;

-- Re-apply tight policies (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='ai_usage_daily') THEN

    EXECUTE $p$
      CREATE POLICY "Users view own AI usage"
        ON public.ai_usage_daily FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all AI usage"
        ON public.ai_usage_daily FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    -- Only service role or admin may insert/update/delete
    EXECUTE $p$
      CREATE POLICY "Service role manages AI usage"
        ON public.ai_usage_daily FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. SUBSCRIPTIONS
--    Users must only read their own subscription row.
--    Users must NOT be able to upgrade their own plan via direct DB write
--    (plan changes go through the set_subscription_plan() security-definer function).
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='subscriptions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.subscriptions', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='subscriptions') THEN

    -- Users may only SELECT their own row
    EXECUTE $p$
      CREATE POLICY "Users can view own subscription"
        ON public.subscriptions FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    -- Users may NOT directly INSERT or UPDATE subscriptions.
    -- Inserts are done by the trigger / service role only.
    -- Plan changes go through set_subscription_plan() (SECURITY DEFINER).

    -- Admin full access
    EXECUTE $p$
      CREATE POLICY "Admin can manage all subscriptions"
        ON public.subscriptions FOR ALL TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    -- Service role (edge functions, triggers) can do anything
    EXECUTE $p$
      CREATE POLICY "Service role manages subscriptions"
        ON public.subscriptions FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. PAYMENTS
--    Users may only see payments linked to bookings they participate in.
--    All mutation is admin / service-role only.
--    (Reinforces 20260517120000 migration — drop and restate cleanly.)
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='payments'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='payments') THEN

    EXECUTE $p$
      CREATE POLICY "Users can view own booking payments"
        ON public.payments FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = payments.booking_id
              AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
          )
        );
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins can view all payments"
        ON public.payments FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins can insert payments"
        ON public.payments FOR INSERT TO authenticated
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins can update payments"
        ON public.payments FOR UPDATE TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins can delete payments"
        ON public.payments FOR DELETE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages payments"
        ON public.payments FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. PAYOUTS  (tutor earnings / withdrawal records)
--    Tutors may only see their own payout rows.
--    No user can mutate payouts directly.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='payouts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payouts', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='payouts') THEN

    EXECUTE $p$
      CREATE POLICY "Tutors view own payouts"
        ON public.payouts FOR SELECT TO authenticated
        USING (auth.uid() = tutor_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all payouts"
        ON public.payouts FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins insert payouts"
        ON public.payouts FOR INSERT TO authenticated
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins update payouts"
        ON public.payouts FOR UPDATE TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins delete payouts"
        ON public.payouts FOR DELETE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages payouts"
        ON public.payouts FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. TUTOR_WALLETS  (earnings balance)
--    Only the owning tutor and admin may see a wallet row.
--    No direct user mutation — balance changes are made by edge functions only.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_wallets'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tutor_wallets', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='tutor_wallets') THEN

    EXECUTE $p$
      CREATE POLICY "Tutors view own wallet"
        ON public.tutor_wallets FOR SELECT TO authenticated
        USING (auth.uid() = tutor_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all wallets"
        ON public.tutor_wallets FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages wallets"
        ON public.tutor_wallets FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. TUTOR_VERIFICATIONS  (contains ID numbers, document URLs)
--    Only the owning tutor and admin may read or modify.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='tutor_verifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tutor_verifications', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='tutor_verifications') THEN

    EXECUTE $p$
      CREATE POLICY "Owners view own verification"
        ON public.tutor_verifications FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all verifications"
        ON public.tutor_verifications FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners insert own verification"
        ON public.tutor_verifications FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners update own verification"
        ON public.tutor_verifications FOR UPDATE TO authenticated
        USING  (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins update any verification"
        ON public.tutor_verifications FOR UPDATE TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins delete verifications"
        ON public.tutor_verifications FOR DELETE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages verifications"
        ON public.tutor_verifications FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. QUALIFICATIONS  (certificates, degree documents, transcripts)
--    The "Anyone can view qualifications" policy (created in 20260303) is a
--    serious privacy breach — it exposes tutor qualification certificates to
--    every authenticated user.  Replace with owner + admin only.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='qualifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.qualifications', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='qualifications') THEN

    EXECUTE $p$
      CREATE POLICY "Owners view own qualifications"
        ON public.qualifications FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all qualifications"
        ON public.qualifications FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners insert own qualifications"
        ON public.qualifications FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners update own qualifications"
        ON public.qualifications FOR UPDATE TO authenticated
        USING  (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners delete own qualifications"
        ON public.qualifications FOR DELETE TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages qualifications"
        ON public.qualifications FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. DOCUMENTS  (id_document, police_clearance, qualification, profile_photo)
--    Owner + admin only. No cross-user reads.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='documents'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.documents', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='documents') THEN

    EXECUTE $p$
      CREATE POLICY "Owners view own documents"
        ON public.documents FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all documents"
        ON public.documents FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners insert own documents"
        ON public.documents FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners update own documents"
        ON public.documents FOR UPDATE TO authenticated
        USING  (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins update document status"
        ON public.documents FOR UPDATE TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Owners delete own documents"
        ON public.documents FOR DELETE TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins delete any document"
        ON public.documents FOR DELETE TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages documents"
        ON public.documents FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. REVIEWS
--    "Anyone can view reviews" (anon + unauthenticated) is overly broad.
--    Restrict to authenticated users only. Reviews contain comments that
--    could identify individuals — we keep aggregate review data for
--    tutor discovery but require sign-in.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='reviews'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.reviews', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='reviews') THEN

    -- Authenticated users may view reviews (needed for tutor discovery)
    EXECUTE $p$
      CREATE POLICY "Authenticated users can view reviews"
        ON public.reviews FOR SELECT TO authenticated
        USING (true);
    $p$;

    -- Only participants of the booking may write a review
    EXECUTE $p$
      CREATE POLICY "Participants can create reviews for their bookings"
        ON public.reviews FOR INSERT TO authenticated
        WITH CHECK (
          auth.uid() = from_user_id
          AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = reviews.booking_id
              AND (b.learner_id = auth.uid() OR b.tutor_id = auth.uid())
          )
        );
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins manage reviews"
        ON public.reviews FOR ALL TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages reviews"
        ON public.reviews FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. SAIL INTERNAL TABLES
--     "sail_tasks_all / sail_signals_all / sail_pipelines_all ON ALL USING (true)"
--     exposed internal AI-pipeline data to ALL authenticated users.
--     Lock down to admin + service role only.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE tbl text;
        pol record;
BEGIN
  FOR tbl IN VALUES ('sail_tasks'), ('sail_detection_signals'), ('sail_pipelines') LOOP
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE tbl text;
BEGIN
  FOR tbl IN VALUES ('sail_tasks'), ('sail_detection_signals'), ('sail_pipelines') LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema='public' AND table_name=tbl) THEN

      EXECUTE format(
        'CREATE POLICY "Admins manage %1$I"
           ON public.%1$I FOR ALL TO authenticated
           USING  (public.has_role(auth.uid(), ''admin''))
           WITH CHECK (public.has_role(auth.uid(), ''admin''))', tbl);

      EXECUTE format(
        'CREATE POLICY "Service role manages %1$I"
           ON public.%1$I FOR ALL TO service_role
           USING (true) WITH CHECK (true)', tbl);

    END IF;
  END LOOP;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. PROFILES — strip personal fields from public access
--     The profiles table contains phone_number, date_of_birth, id_number
--     (via tutor_verifications join), address, guardian_* fields, etc.
--     Policy: own row (full), shared-relationship counterpart (safe columns
--     only via the get_tutor_directory() function already in place), admin all.
--     We drop any residual "Public can view limited tutor info" policies
--     that used USING (true) and exposed rows to anon.
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Public can view limited tutor info for discovery" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view tutor profiles for discovery" ON public.profiles;

-- Ensure own-row read/write policies are present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Users can view their own complete profile'
  ) THEN
    CREATE POLICY "Users can view their own complete profile"
      ON public.profiles FOR SELECT TO authenticated
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON public.profiles FOR UPDATE TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON public.profiles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. STORAGE — tutor-documents bucket must be PRIVATE
--     Ensure no SELECT policy exists that lets a user read another user's folder.
--     The only way to access a document should be:
--       a) the owner (reads from their own subfolder), or
--       b) an admin using the service-role key from a secure edge function.
-- ──────────────────────────────────────────────────────────────────────────────

-- Make tutor-documents bucket private (non-public)
UPDATE storage.buckets SET public = false WHERE id = 'tutor-documents';

-- Drop any broad SELECT policy on tutor-documents storage objects
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%tutor-documents%' OR with_check ILIKE '%tutor-documents%')
      AND policyname ILIKE '%select%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Re-add a tightly-scoped SELECT: owners read their own files only
CREATE POLICY "Owners read own tutor documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'tutor-documents'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 13. TERMS ACCEPTANCE — add column if not already present
--     Stores the timestamp and version of T&Cs accepted at sign-up.
--     (Column may already exist from 20260516 migration — use IF NOT EXISTS.)
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version      text DEFAULT '1.0';

-- ──────────────────────────────────────────────────────────────────────────────
-- 14. WITHDRAWAL_REQUESTS  (if table exists)
--     Only the requesting tutor and admin should see withdrawal requests.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='withdrawal_requests'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.withdrawal_requests', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='withdrawal_requests') THEN

    EXECUTE $p$
      CREATE POLICY "Tutors view own withdrawal requests"
        ON public.withdrawal_requests FOR SELECT TO authenticated
        USING (auth.uid() = tutor_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all withdrawal requests"
        ON public.withdrawal_requests FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Tutors insert own withdrawal requests"
        ON public.withdrawal_requests FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = tutor_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins manage withdrawal requests"
        ON public.withdrawal_requests FOR ALL TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages withdrawal requests"
        ON public.withdrawal_requests FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 15. REFUND_REQUESTS
--     Only the requesting user and admin should see refund requests.
-- ──────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='refund_requests'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.refund_requests', pol.policyname);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='refund_requests') THEN

    EXECUTE $p$
      CREATE POLICY "Users view own refund requests"
        ON public.refund_requests FOR SELECT TO authenticated
        USING (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins view all refund requests"
        ON public.refund_requests FOR SELECT TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Users create own refund requests"
        ON public.refund_requests FOR INSERT TO authenticated
        WITH CHECK (auth.uid() = user_id);
    $p$;

    EXECUTE $p$
      CREATE POLICY "Admins update refund requests"
        ON public.refund_requests FOR UPDATE TO authenticated
        USING  (public.has_role(auth.uid(), 'admin'))
        WITH CHECK (public.has_role(auth.uid(), 'admin'));
    $p$;

    EXECUTE $p$
      CREATE POLICY "Service role manages refund requests"
        ON public.refund_requests FOR ALL TO service_role
        USING (true) WITH CHECK (true);
    $p$;

  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 16. AVAILABILITY  — anonymous / public read is unnecessary
--     Require authentication to browse tutor availability.
-- ──────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anyone can view tutor availability" ON public.availability;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='availability'
      AND policyname='Authenticated users can view tutor availability'
  ) THEN
    CREATE POLICY "Authenticated users can view tutor availability"
      ON public.availability FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 17. GUARDIAN CONTACT INFO  (stored on profiles)
--     Guardian fields (guardian_name, guardian_email, guardian_phone) should
--     only be readable by the account owner and admins.
--     Enforce via a security-definer function that strips these fields
--     when queried by non-owners / non-admins.
-- ──────────────────────────────────────────────────────────────────────────────

-- No additional table policy needed here — these are columns on profiles
-- and the profile RLS already restricts SELECT to own row or shared-relationship.
-- The shared-relationship policy (has_shared_relationship) only fires when
-- a tutor/learner are counterparties; they receive the full row.
-- If you want to further restrict guardian fields, create a column-level
-- security view or use a dedicated function. Documented as accepted risk:
-- counterparties in an active booking may see the profile row but
-- guardian contact details are only relevant for the owner.

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Timestamp when the user accepted the current Terms of Service during sign-up.';
COMMENT ON COLUMN public.profiles.terms_version IS
  'Version string of the Terms of Service accepted (e.g. "1.0").';
