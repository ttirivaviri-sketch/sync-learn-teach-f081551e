/**
 * SAIL — StudySync Autonomous Intelligence Layer
 *
 * Type definitions for the entire SAIL system.
 *
 * Architecture:
 *   Frontend (React/App) -> Backend API (Supabase) -> Core AI (Lovable)
 *     -> SAIL (Agent System) -> Observability/Data -> Monetization Engine
 */

// ─── Task Engine Types ─────────────────────────────────────────────────────────

export type SAILTaskType =
  | 'bug_fix'
  | 'ui_improvement'
  | 'api_optimization'
  | 'learning_adaptation'
  | 'monetization_action'
  | 'performance_alert'
  | 'security_patch'
  | 'content_generation'
  | 'data_cleanup'
  | 'feature_request';

export type SAILTaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type SAILTaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'review'
  | 'approved'
  | 'deploying'
  | 'completed'
  | 'rejected'
  | 'failed';

export type SAILAgentType =
  | 'debug'
  | 'frontend'
  | 'backend'
  | 'learning'
  | 'monetization'
  | 'reviewer';

export type SAILRiskLevel = 'low' | 'medium' | 'high';

export interface SAILTask {
  id: string;
  type: SAILTaskType;
  priority: SAILTaskPriority;
  status: SAILTaskStatus;
  agent: SAILAgentType | null;
  risk_level: SAILRiskLevel;
  title: string;
  description: string;
  context: Record<string, unknown>;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  error_log: string | null;
  created_by: string; // 'system' | 'detection' | 'user' | agent name
  assigned_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  retry_count: number;
  max_retries: number;
  parent_task_id: string | null;
  branch_name: string | null;
  deployment_url: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Agent Types ────────────────────────────────────────────────────────────────

export interface SAILAgentConfig {
  type: SAILAgentType;
  name: string;
  purpose: string;
  capabilities: string[];
  risk_level_default: SAILRiskLevel;
  auto_deploy_threshold: SAILRiskLevel; // Tasks at or below this risk level auto-deploy
  inputs: string[];
  outputs: string[];
  enabled: boolean;
}

export interface SAILAgentResult {
  success: boolean;
  agent: SAILAgentType;
  taskId: string;
  output: Record<string, unknown>;
  patch?: string; // Code diff/patch
  testResults?: { passed: number; failed: number; total: number };
  riskAssessment: SAILRiskLevel;
  deployReady: boolean;
  reviewNotes: string;
  error?: string;
}

// ─── Detection System Types ─────────────────────────────────────────────────────

export type DetectionSource =
  | 'error_log'
  | 'user_behavior'
  | 'learning_performance'
  | 'revenue_metrics'
  | 'system_health'
  | 'ai_analysis';

export interface DetectionSignal {
  id: string;
  source: DetectionSource;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  description: string;
  data: Record<string, unknown>;
  suggested_task_type: SAILTaskType;
  suggested_priority: SAILTaskPriority;
  suggested_agent: SAILAgentType;
  auto_create_task: boolean;
  created_at: string;
}

// ─── Monetization Types ─────────────────────────────────────────────────────────

export type SubscriptionPlan = 'free' | 'trial' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'trial' | 'expired' | 'cancelled' | 'past_due';

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  trial_start: string | null;
  trial_end: string | null;
  current_period_start: string;
  current_period_end: string;
  price_monthly: number;
  currency: string;
  features: string[];
  payment_method: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionFeatures {
  study_mode: boolean;
  ai_tutor: boolean;
  daily_tasks: boolean;
  flashcards: boolean;
  exam_questions: boolean;
  adaptive_learning: boolean;
  document_upload: boolean;
  past_paper_analysis: boolean;
  progress_tracking: boolean;
  spaced_repetition: boolean;
  ai_study_plans: boolean;
  internet_enrichment: boolean;
  priority_support: boolean;
  max_subjects: number;
  max_documents: number;
  daily_ai_calls: number;
}

export const PLAN_FEATURES: Record<SubscriptionPlan, SubscriptionFeatures> = {
  free: {
    study_mode: false,
    ai_tutor: false,
    daily_tasks: false,
    flashcards: false,
    exam_questions: false,
    adaptive_learning: false,
    document_upload: false,
    past_paper_analysis: false,
    progress_tracking: false,
    spaced_repetition: false,
    ai_study_plans: false,
    internet_enrichment: false,
    priority_support: false,
    max_subjects: 0,
    max_documents: 0,
    daily_ai_calls: 0,
  },
  trial: {
    study_mode: true,
    ai_tutor: true,
    daily_tasks: true,
    flashcards: true,
    exam_questions: true,
    adaptive_learning: true,
    document_upload: true,
    past_paper_analysis: true,
    progress_tracking: true,
    spaced_repetition: true,
    ai_study_plans: true,
    internet_enrichment: true,
    priority_support: false,
    max_subjects: 10,
    max_documents: 20,
    daily_ai_calls: 50,
  },
  basic: {
    study_mode: true,
    ai_tutor: true,
    daily_tasks: true,
    flashcards: true,
    exam_questions: true,
    adaptive_learning: false,
    document_upload: true,
    past_paper_analysis: false,
    progress_tracking: true,
    spaced_repetition: true,
    ai_study_plans: false,
    internet_enrichment: false,
    priority_support: false,
    max_subjects: 5,
    max_documents: 10,
    daily_ai_calls: 20,
  },
  premium: {
    study_mode: true,
    ai_tutor: true,
    daily_tasks: true,
    flashcards: true,
    exam_questions: true,
    adaptive_learning: true,
    document_upload: true,
    past_paper_analysis: true,
    progress_tracking: true,
    spaced_repetition: true,
    ai_study_plans: true,
    internet_enrichment: true,
    priority_support: true,
    max_subjects: 20,
    max_documents: 100,
    daily_ai_calls: 200,
  },
  enterprise: {
    study_mode: true,
    ai_tutor: true,
    daily_tasks: true,
    flashcards: true,
    exam_questions: true,
    adaptive_learning: true,
    document_upload: true,
    past_paper_analysis: true,
    progress_tracking: true,
    spaced_repetition: true,
    ai_study_plans: true,
    internet_enrichment: true,
    priority_support: true,
    max_subjects: 999,
    max_documents: 999,
    daily_ai_calls: 999,
  },
};

export const PLAN_PRICING: Record<SubscriptionPlan, { monthly: number; annually: number; currency: string }> = {
  free: { monthly: 0, annually: 0, currency: 'ZAR' },
  trial: { monthly: 0, annually: 0, currency: 'ZAR' },
  basic: { monthly: 49, annually: 470, currency: 'ZAR' },
  premium: { monthly: 99, annually: 950, currency: 'ZAR' },
  enterprise: { monthly: 199, annually: 1900, currency: 'ZAR' },
};

export const TRIAL_DURATION_DAYS = 7;

// ─── Deployment Pipeline Types ──────────────────────────────────────────────────

export type PipelineStage =
  | 'branch_created'
  | 'patch_applied'
  | 'tests_running'
  | 'tests_passed'
  | 'tests_failed'
  | 'preview_deployed'
  | 'review_pending'
  | 'approved'
  | 'rejected'
  | 'merged'
  | 'production_deployed';

export interface DeploymentPipeline {
  id: string;
  task_id: string;
  agent: SAILAgentType;
  branch_name: string;
  stage: PipelineStage;
  preview_url: string | null;
  test_results: {
    passed: number;
    failed: number;
    total: number;
    duration_ms: number;
  } | null;
  diff_summary: string | null;
  risk_level: SAILRiskLevel;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ─── SAIL System State ──────────────────────────────────────────────────────────

export interface SAILSystemState {
  isRunning: boolean;
  activeAgents: SAILAgentType[];
  taskQueueSize: number;
  tasksInProgress: number;
  tasksCompletedToday: number;
  detectionSignalsToday: number;
  pendingApprovals: number;
  lastActivityAt: string | null;
  systemHealth: 'healthy' | 'degraded' | 'error';
  errorRate: number;
}
