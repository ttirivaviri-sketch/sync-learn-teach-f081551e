/**
 * Hand-maintained typed contract for Learning Operating System tables.
 *
 * The generated `types.ts` file does not yet include the LOS tables
 * introduced in `20260623113000_learning_operating_system_foundations.sql`
 * and `20260627143000_learning_ops_workflows_and_guardian_views.sql`.
 *
 * This file declares typed table shapes and a `losSupabase` accessor that
 * removes the need for `as any` casts throughout the LOS layer.
 *
 * Once the Supabase type generator catches up, this file can be replaced
 * by direct imports from `./types`.
 */
import type { Json } from './types';
import { supabase } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Shared LOS unions ──────────────────────────────────────────────────────

export type LosWorkspaceRole =
  | 'owner'
  | 'admin'
  | 'teacher'
  | 'tutor'
  | 'student'
  | 'guardian';

export type LosWorkspaceType = 'school' | 'tutoring_org' | 'family' | 'personal';

export type LosMembershipStatus = 'active' | 'invited' | 'suspended';

export type LosInvitationStatus = 'invited' | 'accepted' | 'revoked' | 'expired';

export type LosObjectiveType =
  | 'knowledge'
  | 'application'
  | 'skill'
  | 'assessment';

export type LosMasteryEvidenceType =
  | 'task'
  | 'quiz'
  | 'mock_exam'
  | 'tutor_note'
  | 'flashcard'
  | 'recall'
  | 'manual';

export type LosInterventionType =
  | 'concept-reteach'
  | 'guided-practice'
  | 'prerequisite-repair'
  | 'exam-sprint'
  | 'consistency-recovery'
  | 'tutor-escalation'
  | 'guardian-alert';

export type LosInterventionPriority = 'high' | 'medium' | 'low';

export type LosInterventionStatus =
  | 'open'
  | 'acknowledged'
  | 'resolved'
  | 'dismissed';

export type LosInterventionEventType =
  | 'created'
  | 'acknowledged'
  | 'resolved'
  | 'dismissed'
  | 'reassigned'
  | 'noted';

// ─── Row / Insert / Update types ────────────────────────────────────────────

export interface LosWorkspaceRow {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string;
  workspace_type: LosWorkspaceType;
  school_name: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type LosWorkspaceInsert = Partial<LosWorkspaceRow> & {
  owner_user_id: string;
  name: string;
  slug: string;
};

export interface LosWorkspaceMembershipRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: LosWorkspaceRole;
  status: LosMembershipStatus;
  campus: string | null;
  grade_level: string | null;
  cohort_name: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type LosWorkspaceMembershipInsert = Partial<LosWorkspaceMembershipRow> & {
  workspace_id: string;
  user_id: string;
};

export interface LosWorkspaceCohortRow {
  id: string;
  workspace_id: string;
  name: string;
  curriculum: string | null;
  grade_level: string | null;
  subject_names: string[];
  lead_user_id: string | null;
  is_active: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type LosWorkspaceCohortInsert = Partial<LosWorkspaceCohortRow> & {
  workspace_id: string;
  name: string;
};

export interface LosConceptCatalogRow {
  id: string;
  subject_id: string | null;
  curriculum: string;
  subject_name: string;
  topic_name: string;
  subtopic_name: string | null;
  concept_name: string;
  objective_type: LosObjectiveType;
  command_words: string[];
  prerequisites: string[];
  metadata: Json;
  created_at: string;
  updated_at: string;
  source_document_id: string | null;
  source_kind: 'syllabus' | 'past_paper' | 'notes' | 'manual' | 'topic_seed' | null;
  ingested_at: string | null;
  confidence: number | null;
}

export type LosConceptCatalogInsert = Partial<LosConceptCatalogRow> & {
  curriculum: string;
  subject_name: string;
  topic_name: string;
  concept_name: string;
};

export interface LosMasteryLedgerRow {
  id: string;
  user_id: string;
  subject_id: string | null;
  concept_id: string | null;
  subject_name: string;
  topic_name: string;
  concept_name: string;
  evidence_type: LosMasteryEvidenceType;
  evidence_source: string | null;
  score_delta: number;
  confidence: number;
  metadata: Json;
  recorded_at: string;
  created_at: string;
}

export type LosMasteryLedgerInsert = Partial<LosMasteryLedgerRow> & {
  user_id: string;
  subject_name: string;
  topic_name: string;
  concept_name: string;
  evidence_type: LosMasteryEvidenceType;
};

export interface LosInterventionQueueRow {
  id: string;
  user_id: string;
  workspace_id: string | null;
  subject_id: string | null;
  intervention_type: LosInterventionType;
  priority: LosInterventionPriority;
  status: LosInterventionStatus;
  reason: string;
  recommended_action: string;
  supporting_evidence: Json;
  due_at: string | null;
  resolved_at: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  assigned_to_user_id: string | null;
  assigned_role: LosWorkspaceRole | null;
  acknowledged_at: string | null;
  action_note: string | null;
  last_action_at: string | null;
  resolved_by_user_id: string | null;
}

export type LosInterventionQueueInsert = Partial<LosInterventionQueueRow> & {
  user_id: string;
  intervention_type: LosInterventionType;
  reason: string;
  recommended_action: string;
};

export type LosInterventionQueueUpdate = Partial<LosInterventionQueueRow>;

export interface LosInterventionEventRow {
  id: string;
  intervention_id: string;
  actor_user_id: string;
  action_type: LosInterventionEventType;
  note: string | null;
  metadata: Json;
  created_at: string;
}

export type LosInterventionEventInsert = Partial<LosInterventionEventRow> & {
  intervention_id: string;
  actor_user_id: string;
  action_type: LosInterventionEventType;
};

export interface LosWorkspaceInvitationRow {
  id: string;
  workspace_id: string;
  invited_by_user_id: string;
  email: string;
  role: LosWorkspaceRole;
  status: LosInvitationStatus;
  cohort_ids: string[];
  invite_note: string | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
  token: string | null;
  token_hash: string | null;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  expires_at: string | null;
}

export type LosWorkspaceInvitationInsert = Partial<LosWorkspaceInvitationRow> & {
  workspace_id: string;
  invited_by_user_id: string;
  email: string;
  role: LosWorkspaceRole;
};

export interface LosWorkspaceMemberCohortRow {
  id: string;
  workspace_id: string;
  cohort_id: string;
  membership_id: string;
  user_id: string;
  status: 'active' | 'removed';
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export type LosWorkspaceMemberCohortInsert = Partial<LosWorkspaceMemberCohortRow> & {
  workspace_id: string;
  cohort_id: string;
  membership_id: string;
  user_id: string;
};

export interface LosAutomationRunRow {
  id: string;
  job_name: string;
  status: 'started' | 'succeeded' | 'failed' | 'partial';
  rows_processed: number;
  details: Json;
  workspace_id: string | null;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
}

export type LosAutomationRunInsert = Partial<LosAutomationRunRow> & {
  job_name: string;
};

export interface LosConceptTrendRow {
  user_id: string;
  subject_id: string | null;
  subject_name: string;
  topic_name: string;
  concept_name: string;
  day: string;
  evidence_count: number;
  avg_confidence: number | null;
  total_score_delta: number | null;
}

export interface LosInterventionOutcomeRow {
  intervention_id: string;
  user_id: string;
  workspace_id: string | null;
  subject_id: string | null;
  intervention_type: LosInterventionType;
  priority: LosInterventionPriority;
  status: LosInterventionStatus;
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  hours_open: number | null;
  post_score_delta: number | null;
  post_evidence_count: number | null;
}

export interface LearningOpsViews {
  learning_concept_trends: {
    Row: LosConceptTrendRow;
  };
  learning_intervention_outcomes: {
    Row: LosInterventionOutcomeRow;
  };
}

export interface LearningOpsFunctions {
  generate_workspace_invite_token: {
    Args: { p_invitation_id: string };
    Returns: string;
  };
  accept_workspace_invitation: {
    Args: { p_token: string };
    Returns: string;
  };
}

// ─── Typed accessor ─────────────────────────────────────────────────────────

/**
 * Tables that exist in Postgres but are not yet present in the auto-generated
 * Supabase `Database` interface. We cast through `unknown` once here, and
 * everywhere else in the LOS layer we get full type safety against this map.
 */
export interface LearningOpsTables {
  learning_workspaces: {
    Row: LosWorkspaceRow;
    Insert: LosWorkspaceInsert;
    Update: Partial<LosWorkspaceRow>;
  };
  learning_workspace_memberships: {
    Row: LosWorkspaceMembershipRow;
    Insert: LosWorkspaceMembershipInsert;
    Update: Partial<LosWorkspaceMembershipRow>;
  };
  learning_workspace_cohorts: {
    Row: LosWorkspaceCohortRow;
    Insert: LosWorkspaceCohortInsert;
    Update: Partial<LosWorkspaceCohortRow>;
  };
  learning_concept_catalog: {
    Row: LosConceptCatalogRow;
    Insert: LosConceptCatalogInsert;
    Update: Partial<LosConceptCatalogRow>;
  };
  learning_concept_mastery_ledger: {
    Row: LosMasteryLedgerRow;
    Insert: LosMasteryLedgerInsert;
    Update: Partial<LosMasteryLedgerRow>;
  };
  learning_intervention_queue: {
    Row: LosInterventionQueueRow;
    Insert: LosInterventionQueueInsert;
    Update: LosInterventionQueueUpdate;
  };
  learning_intervention_events: {
    Row: LosInterventionEventRow;
    Insert: LosInterventionEventInsert;
    Update: Partial<LosInterventionEventRow>;
  };
  learning_workspace_invitations: {
    Row: LosWorkspaceInvitationRow;
    Insert: LosWorkspaceInvitationInsert;
    Update: Partial<LosWorkspaceInvitationRow>;
  };
  learning_workspace_member_cohorts: {
    Row: LosWorkspaceMemberCohortRow;
    Insert: LosWorkspaceMemberCohortInsert;
    Update: Partial<LosWorkspaceMemberCohortRow>;
  };
  learning_ops_automation_runs: {
    Row: LosAutomationRunRow;
    Insert: LosAutomationRunInsert;
    Update: Partial<LosAutomationRunRow>;
  };
}

export type LosTableName = keyof LearningOpsTables;
export type LosViewName = keyof LearningOpsViews;

/**
 * Wide-typed Supabase client that knows about the LOS tables.
 * Internally we cast `supabase` through `unknown` once, here, so the rest of
 * the LOS code can keep static type safety and avoid `as any` casts.
 */
type LosDatabase = {
  public: {
    Tables: LearningOpsTables;
    Views: LearningOpsViews;
    Functions: LearningOpsFunctions;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export const losSupabase = supabase as unknown as SupabaseClient<LosDatabase>;

/** Typed `from()` helper for LOS tables — full Postgrest typing, no `as any`. */
export function losFrom<T extends LosTableName>(table: T) {
  return losSupabase.from(table);
}

/** Typed `from()` helper for LOS views. */
export function losView<T extends LosViewName>(view: T) {
  return losSupabase.from(view);
}
