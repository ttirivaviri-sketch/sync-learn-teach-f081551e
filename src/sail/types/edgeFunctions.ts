/**
 * TypeScript types for StudySync Edge Function responses
 *
 * Covers:
 *   1. Real-time Payout System
 *   2. Video Upload & Copyright-Safe Handling
 *   3. Student Insights for Tutors
 */

// ─── 1. REAL-TIME PAYOUT SYSTEM ──────────────────────────────────────────────

export type PayoutStatus = 'processed' | 'already_processed' | 'rejected';
export type CommissionTier = 'standard' | 'verified' | 'premium' | 'enterprise';

export interface PayoutRequest {
  session_id: string;
  tutor_id: string;
}

export interface PayoutResponse {
  session_id: string;
  tutor_id: string;
  gross_amount: number;
  commission_rate: number;
  commission: number;
  net_payout: number;
  wallet_balance: number;
  status: PayoutStatus;
  reason: string | null;
  processed_at: string;
}

export interface TutorWallet {
  id: string;
  tutor_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  currency: string;
  last_payout_at: string | null;
  last_withdrawal_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TutorPayout {
  id: string;
  session_id: string;
  tutor_id: string;
  learner_id: string | null;
  payment_id: string | null;
  gross_amount: number;
  commission_rate: number;
  commission_tier: CommissionTier;
  commission: number;
  net_payout: number;
  currency: string;
  status: string;
  processed_at: string;
  created_at: string;
}

export interface PayoutAuditEntry {
  id: string;
  session_id: string | null;
  tutor_id: string | null;
  action: string;
  details: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
}

// Commission tier thresholds
export const COMMISSION_TIERS: Record<
  CommissionTier,
  { rate: number; minSessions: number; minRating: number; label: string }
> = {
  standard: { rate: 0.15, minSessions: 0, minRating: 0, label: 'Standard (15%)' },
  verified: { rate: 0.12, minSessions: 10, minRating: 0, label: 'Verified (12%)' },
  premium: { rate: 0.10, minSessions: 50, minRating: 4.5, label: 'Premium (10%)' },
  enterprise: { rate: 0.08, minSessions: 100, minRating: 0, label: 'Enterprise (8%)' },
};

// ─── 2. VIDEO UPLOAD & COPYRIGHT-SAFE HANDLING ───────────────────────────────

export type VideoType =
  | 'original_upload'
  | 'youtube_embed'
  | 'loom_embed'
  | 'vimeo_embed'
  | 'external_link';

export type VideoStatus =
  | 'approved'
  | 'pending_confirmation'
  | 'pending_review'
  | 'rejected'
  | 'archived';

export type VideoDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type VideoVisibility = 'public' | 'unlisted' | 'private';

export interface VideoUploadRequest {
  video_url: string;
  title?: string;
  description?: string;
  subject?: string;
  topic?: string;
  grade?: string;
  curriculum?: string;
  ownership_confirmed: boolean;
  tutor_id?: string;
}

export interface VideoUploadResponse {
  video_id: string;
  type: VideoType;
  status: VideoStatus;
  title: string;
  description: string;
  topic: string;
  subject: string;
  difficulty: VideoDifficulty;
  grade: string;
  curriculum: string;
  duration_estimate: string;
  tags: string[];
  visibility: VideoVisibility;
  embed_url: string | null;
  original_url: string;
  ownership_confirmed: boolean;
  copyright_flags: string[];
  rejection_reason: string | null;
}

export interface VideoContent {
  id: string;
  tutor_id: string;
  video_url: string;
  embed_url: string | null;
  video_type: VideoType;
  platform_video_id: string | null;
  title: string;
  description: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: VideoDifficulty;
  grade: string | null;
  curriculum: string;
  tags: string[];
  duration_estimate: string | null;
  ownership_confirmed: boolean;
  copyright_flags: string[];
  status: VideoStatus;
  rejection_reason: string | null;
  visibility: VideoVisibility;
  watch_count: number;
  like_count: number;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

// ─── 3. STUDENT INSIGHTS FOR TUTORS ─────────────────────────────────────────

export type StudyPatternType =
  | 'consistent'
  | 'irregular'
  | 'cramming'
  | 'spaced'
  | 'intensive'
  | 'minimal';

export type LearningBehaviorType =
  | 'visual_learner'
  | 'practice_oriented'
  | 'theory_focused'
  | 'mixed'
  | 'needs_guidance';

export type PerformanceTrend = 'improving' | 'stable' | 'declining' | 'variable';

export type FocusPriority = 'critical' | 'high' | 'medium' | 'low';

export type PacingType = 'slow_and_steady' | 'moderate' | 'accelerated';

export type RetryTendency = 'high' | 'medium' | 'low';

export type HelpSeeking = 'proactive' | 'reactive' | 'minimal';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface StudentInsightsRequest {
  student_id: string;
  tutor_id?: string;
}

export interface StudentInsightsResponse {
  student_id: string;
  profile_generated_at: string;
  data_coverage: {
    total_activities: number;
    date_range_days: number;
    subjects_covered: number;
    confidence_level: ConfidenceLevel;
  };
  study_pattern: {
    type: StudyPatternType;
    description: string;
    avg_daily_minutes: number;
    preferred_times: string[];
    weekly_frequency: number;
  };
  strengths: Array<{
    topic: string;
    subject: string;
    accuracy: number;
    evidence: string;
  }>;
  weaknesses: Array<{
    topic: string;
    subject: string;
    accuracy: number;
    common_mistakes: string[];
    evidence: string;
  }>;
  learning_behavior: {
    type: LearningBehaviorType;
    description: string;
    persistence_score: number;
    retry_tendency: RetryTendency;
    help_seeking: HelpSeeking;
  };
  performance_trajectory: {
    trend: PerformanceTrend;
    recent_change_pct: number;
    description: string;
  };
  focus_areas: Array<{
    topic: string;
    subject: string;
    priority: FocusPriority;
    reason: string;
    estimated_sessions: number;
    suggested_approach: string;
  }>;
  tutor_recommendations: {
    teaching_style: string;
    session_structure: string;
    motivation_approach: string;
    key_areas_to_address: string[];
    resources_suggested: string[];
    pacing: PacingType;
  };
}

export interface StudentInsightsCache {
  id: string;
  student_id: string;
  tutor_id: string;
  insights: StudentInsightsResponse;
  data_coverage_total: number;
  generated_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface LearningSignal {
  id: string;
  user_id: string;
  signal_type: string;
  data: Record<string, unknown>;
  context: Record<string, unknown>;
  processed: boolean;
  batch_id: string | null;
  created_at: string;
}
