-- ============================================================================
-- SAIL — StudySync Autonomous Intelligence Layer
-- Database Schema
-- ============================================================================

-- ─── Task Engine ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sail_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type            text NOT NULL,
  priority        text NOT NULL DEFAULT 'medium',
  status          text NOT NULL DEFAULT 'pending',
  agent           text,
  risk_level      text NOT NULL DEFAULT 'low',
  title           text NOT NULL,
  description     text,
  context         jsonb DEFAULT '{}',
  input_data      jsonb DEFAULT '{}',
  output_data     jsonb,
  error_log       text,
  created_by      text NOT NULL DEFAULT 'system',
  assigned_at     timestamptz,
  started_at      timestamptz,
  completed_at    timestamptz,
  reviewed_by     text,
  review_notes    text,
  retry_count     int DEFAULT 0,
  max_retries     int DEFAULT 3,
  parent_task_id  uuid REFERENCES sail_tasks(id),
  branch_name     text,
  deployment_url  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Indexes for task engine queries
CREATE INDEX IF NOT EXISTS idx_sail_tasks_status ON sail_tasks(status);
CREATE INDEX IF NOT EXISTS idx_sail_tasks_agent ON sail_tasks(agent);
CREATE INDEX IF NOT EXISTS idx_sail_tasks_priority ON sail_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_sail_tasks_created_at ON sail_tasks(created_at DESC);

-- ─── Detection Signals ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sail_detection_signals (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source              text NOT NULL,
  severity            text NOT NULL DEFAULT 'info',
  title               text NOT NULL,
  description         text,
  data                jsonb DEFAULT '{}',
  suggested_task_type text,
  suggested_priority  text DEFAULT 'medium',
  suggested_agent     text,
  auto_create_task    boolean DEFAULT false,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sail_signals_source ON sail_detection_signals(source);
CREATE INDEX IF NOT EXISTS idx_sail_signals_severity ON sail_detection_signals(severity);
CREATE INDEX IF NOT EXISTS idx_sail_signals_created_at ON sail_detection_signals(created_at DESC);

-- ─── Deployment Pipeline ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sail_pipelines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid REFERENCES sail_tasks(id),
  agent            text NOT NULL,
  branch_name      text NOT NULL,
  stage            text NOT NULL DEFAULT 'branch_created',
  preview_url      text,
  test_results     jsonb,
  diff_summary     text,
  risk_level       text NOT NULL DEFAULT 'low',
  approved_by      text,
  approved_at      timestamptz,
  rejection_reason text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sail_pipelines_stage ON sail_pipelines(stage);
CREATE INDEX IF NOT EXISTS idx_sail_pipelines_task_id ON sail_pipelines(task_id);

-- ─── Subscriptions (Monetization Engine) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL,
  plan                  text NOT NULL DEFAULT 'trial',
  status                text NOT NULL DEFAULT 'trial',
  trial_start           timestamptz,
  trial_end             timestamptz,
  current_period_start  timestamptz DEFAULT now(),
  current_period_end    timestamptz,
  price_monthly         numeric DEFAULT 0,
  currency              text DEFAULT 'ZAR',
  features              jsonb DEFAULT '[]',
  payment_method        text,
  cancelled_at          timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan);

-- ─── Enable RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE sail_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sail_detection_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sail_pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own data
CREATE POLICY "sail_tasks_all" ON sail_tasks FOR ALL USING (true);
CREATE POLICY "sail_signals_all" ON sail_detection_signals FOR ALL USING (true);
CREATE POLICY "sail_pipelines_all" ON sail_pipelines FOR ALL USING (true);
CREATE POLICY "subscriptions_own" ON subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
