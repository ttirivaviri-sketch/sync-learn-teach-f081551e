-- ============================================================================
-- StudySync Edge Function Tables Migration
-- Date: 2026-04-05
--
-- Creates tables for:
--   1. Real-time Payout System (tutor_wallets, tutor_payouts, payout_audit_log)
--   2. Video Upload & Copyright-Safe Handling (video_content, video_audit_log)
--   3. Student Insights for Tutors (student_insights_cache, learning_signals)
-- ============================================================================

-- ─── 1. REAL-TIME PAYOUT SYSTEM ─────────────────────────────────────────────

-- Tutor wallet: running balance and lifetime earnings
CREATE TABLE IF NOT EXISTS tutor_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_withdrawn NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  last_payout_at TIMESTAMPTZ,
  last_withdrawal_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT tutor_wallets_tutor_unique UNIQUE (tutor_id),
  CONSTRAINT tutor_wallets_balance_non_negative CHECK (balance >= 0),
  CONSTRAINT tutor_wallets_total_earned_non_negative CHECK (total_earned >= 0)
);

-- Individual payout records (one per completed session)
CREATE TABLE IF NOT EXISTS tutor_payouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,  -- references bookings(id)
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id UUID,
  payment_id UUID,  -- references payments(id)
  gross_amount NUMERIC(12, 2) NOT NULL,
  commission_rate NUMERIC(5, 4) NOT NULL,  -- e.g. 0.1500 for 15%
  commission_tier TEXT NOT NULL DEFAULT 'standard',
  commission NUMERIC(12, 2) NOT NULL,
  net_payout NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'processed',
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Idempotency: one payout per session per tutor
  CONSTRAINT tutor_payouts_session_tutor_unique UNIQUE (session_id, tutor_id),
  CONSTRAINT tutor_payouts_amounts_non_negative CHECK (
    gross_amount >= 0 AND commission >= 0 AND net_payout >= 0
  )
);

-- Payout audit log for compliance and debugging
CREATE TABLE IF NOT EXISTS payout_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID,
  tutor_id UUID,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for payout system
CREATE INDEX IF NOT EXISTS idx_tutor_wallets_tutor_id ON tutor_wallets(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_payouts_session_id ON tutor_payouts(session_id);
CREATE INDEX IF NOT EXISTS idx_tutor_payouts_tutor_id ON tutor_payouts(tutor_id);
CREATE INDEX IF NOT EXISTS idx_tutor_payouts_status ON tutor_payouts(status);
CREATE INDEX IF NOT EXISTS idx_tutor_payouts_processed_at ON tutor_payouts(processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_session_id ON payout_audit_log(session_id);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_tutor_id ON payout_audit_log(tutor_id);

-- RLS for payout tables
ALTER TABLE tutor_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tutor_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_audit_log ENABLE ROW LEVEL SECURITY;

-- Tutors can view their own wallet
DO $$ BEGIN
  CREATE POLICY "Tutors can view own wallet"
    ON tutor_wallets FOR SELECT
    USING (auth.uid() = tutor_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tutors can view their own payouts
DO $$ BEGIN
  CREATE POLICY "Tutors can view own payouts"
    ON tutor_payouts FOR SELECT
    USING (auth.uid() = tutor_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role can insert/update (edge functions use service role)
DO $$ BEGIN
  CREATE POLICY "Service role manages wallets"
    ON tutor_wallets FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages payouts"
    ON tutor_payouts FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages payout audit"
    ON payout_audit_log FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 2. VIDEO UPLOAD & COPYRIGHT-SAFE HANDLING ─────────────────────────────

CREATE TABLE IF NOT EXISTS video_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  embed_url TEXT,
  video_type TEXT NOT NULL DEFAULT 'external_link',
  platform_video_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  subject TEXT,
  topic TEXT,
  difficulty TEXT DEFAULT 'intermediate',
  grade TEXT,
  curriculum TEXT DEFAULT 'ZIMSEC',
  tags TEXT[] DEFAULT '{}',
  duration_estimate TEXT,
  ownership_confirmed BOOLEAN NOT NULL DEFAULT false,
  copyright_flags TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  rejection_reason TEXT,
  visibility TEXT NOT NULL DEFAULT 'private',
  watch_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  rating NUMERIC(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT video_content_status_check CHECK (
    status IN ('approved', 'pending_confirmation', 'pending_review', 'rejected', 'archived')
  ),
  CONSTRAINT video_content_visibility_check CHECK (
    visibility IN ('public', 'unlisted', 'private')
  ),
  CONSTRAINT video_content_difficulty_check CHECK (
    difficulty IN ('beginner', 'intermediate', 'advanced')
  )
);

-- Video audit log for compliance
CREATE TABLE IF NOT EXISTS video_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID REFERENCES video_content(id) ON DELETE SET NULL,
  tutor_id UUID,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for video system
CREATE INDEX IF NOT EXISTS idx_video_content_tutor_id ON video_content(tutor_id);
CREATE INDEX IF NOT EXISTS idx_video_content_status ON video_content(status);
CREATE INDEX IF NOT EXISTS idx_video_content_subject ON video_content(subject);
CREATE INDEX IF NOT EXISTS idx_video_content_visibility ON video_content(visibility);
CREATE INDEX IF NOT EXISTS idx_video_content_curriculum ON video_content(curriculum);
CREATE INDEX IF NOT EXISTS idx_video_content_created_at ON video_content(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_audit_log_video_id ON video_audit_log(video_id);

-- RLS for video tables
ALTER TABLE video_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_audit_log ENABLE ROW LEVEL SECURITY;

-- Tutors can view/manage their own videos
DO $$ BEGIN
  CREATE POLICY "Tutors can manage own videos"
    ON video_content FOR ALL
    USING (auth.uid() = tutor_id)
    WITH CHECK (auth.uid() = tutor_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- All authenticated users can view approved+public videos
DO $$ BEGIN
  CREATE POLICY "Users can view public approved videos"
    ON video_content FOR SELECT
    USING (status = 'approved' AND visibility = 'public');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages video audit"
    ON video_audit_log FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 3. STUDENT INSIGHTS FOR TUTORS ────────────────────────────────────────

-- Learning signals table (if it doesn't exist from SAIL migration)
CREATE TABLE IF NOT EXISTS learning_signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  context JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cached student insights (tutor-specific view)
CREATE TABLE IF NOT EXISTS student_insights_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insights JSONB NOT NULL DEFAULT '{}',
  data_coverage_total INTEGER DEFAULT 0,
  generated_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- One cache entry per student-tutor pair
  CONSTRAINT student_insights_cache_student_tutor_unique UNIQUE (student_id, tutor_id)
);

-- Indexes for insights system
CREATE INDEX IF NOT EXISTS idx_learning_signals_user_id ON learning_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_signals_type ON learning_signals(signal_type);
CREATE INDEX IF NOT EXISTS idx_learning_signals_processed ON learning_signals(processed);
CREATE INDEX IF NOT EXISTS idx_learning_signals_created_at ON learning_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_student_insights_cache_student ON student_insights_cache(student_id);
CREATE INDEX IF NOT EXISTS idx_student_insights_cache_tutor ON student_insights_cache(tutor_id);
CREATE INDEX IF NOT EXISTS idx_student_insights_cache_expires ON student_insights_cache(expires_at);

-- RLS for insights tables
ALTER TABLE learning_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_insights_cache ENABLE ROW LEVEL SECURITY;

-- Users can insert their own learning signals
DO $$ BEGIN
  CREATE POLICY "Users can insert own signals"
    ON learning_signals FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can view own signals"
    ON learning_signals FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tutors can view insights for their students
DO $$ BEGIN
  CREATE POLICY "Tutors can view student insights"
    ON student_insights_cache FOR SELECT
    USING (auth.uid() = tutor_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role manages insights cache
DO $$ BEGIN
  CREATE POLICY "Service role manages insights cache"
    ON student_insights_cache FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages learning signals"
    ON learning_signals FOR ALL
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 4. HELPER FUNCTIONS ────────────────────────────────────────────────────

-- Function to atomically increment wallet balance (prevents race conditions)
CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_tutor_id UUID,
  p_amount NUMERIC(12, 2)
)
RETURNS NUMERIC(12, 2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance NUMERIC(12, 2);
BEGIN
  UPDATE tutor_wallets
  SET
    balance = balance + p_amount,
    total_earned = total_earned + p_amount,
    last_payout_at = now(),
    updated_at = now()
  WHERE tutor_id = p_tutor_id
  RETURNING balance INTO new_balance;

  -- If no wallet exists, create one
  IF new_balance IS NULL THEN
    INSERT INTO tutor_wallets (tutor_id, balance, total_earned, currency)
    VALUES (p_tutor_id, p_amount, p_amount, 'ZAR')
    RETURNING balance INTO new_balance;
  END IF;

  RETURN new_balance;
END;
$$;

-- Function to clean up expired insights cache
CREATE OR REPLACE FUNCTION cleanup_expired_insights()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM student_insights_cache
  WHERE expires_at < now()
  RETURNING count(*) INTO deleted_count;

  RETURN COALESCE(deleted_count, 0);
END;
$$;

-- Function to get tutor commission tier
CREATE OR REPLACE FUNCTION get_tutor_commission_tier(p_tutor_id UUID)
RETURNS TABLE(rate NUMERIC(5, 4), tier TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  completed_sessions INTEGER;
  avg_rating NUMERIC(3, 2);
BEGIN
  SELECT count(*)
  INTO completed_sessions
  FROM bookings
  WHERE tutor_id = p_tutor_id AND status = 'completed';

  SELECT COALESCE(avg(rating), 0)
  INTO avg_rating
  FROM reviews
  WHERE reviewed_id = p_tutor_id;

  IF completed_sessions >= 100 THEN
    RETURN QUERY SELECT 0.0800::NUMERIC(5,4), 'enterprise'::TEXT;
  ELSIF completed_sessions >= 50 AND avg_rating >= 4.5 THEN
    RETURN QUERY SELECT 0.1000::NUMERIC(5,4), 'premium'::TEXT;
  ELSIF completed_sessions >= 10 THEN
    RETURN QUERY SELECT 0.1200::NUMERIC(5,4), 'verified'::TEXT;
  ELSE
    RETURN QUERY SELECT 0.1500::NUMERIC(5,4), 'standard'::TEXT;
  END IF;
END;
$$;
