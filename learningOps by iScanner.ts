/**
 * Learning Operating System (LOS) service layer.
 *
 * This module is the single typed entry point for everything that talks to
 * the LOS tables (workspaces, memberships, cohorts, concept catalog,
 * mastery ledger, intervention queue, intervention events, invitations,
 * member-cohort assignments).
 *
 * Implementation notes
 * - All Postgrest access goes through `losFrom()` from
 *   `@/integrations/supabase/learning-os-types`, so there are no `as any`
 *   casts on the LOS surface anymore.
 * - Re-exports the canonical LOS unions so callsites can import them from
 *   this file (`WorkspaceRole`, `InterventionStatus`, etc.).
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import {
  losFrom,
  losSupabase,
  type LosInterventionQueueRow,
  type LosInterventionStatus,
  type LosInterventionType,
  type LosInvitationStatus,
  type LosMasteryEvidenceType,
  type LosMasteryLedgerRow,
  type LosObjectiveType,
  type LosWorkspaceCohortRow,
  type LosWorkspaceInvitationRow,
  type LosWorkspaceMemberCohortRow,
  type LosWorkspaceMembershipRow,
  type LosWorkspaceRole,
  type LosWorkspaceRow,
  type LosWorkspaceType,
} from '@/integrations/supabase/learning-os-types';

// Re-export the canonical LOS types so consumers can import everything from one place.
export type WorkspaceRole = LosWorkspaceRole;
export type WorkspaceType = LosWorkspaceType;
export type MasteryEvidenceType = LosMasteryEvidenceType;
export type InterventionQueueType = LosInterventionType;
export type InterventionStatus = LosInterventionStatus;
export type InvitationStatus = LosInvitationStatus;
export type ObjectiveType = LosObjectiveType;

// ─── Input types ─────────────────────────────────────────────────────────────

export interface MasteryEvidenceInput {
  userId: string;
  subjectId?: string | null;
  subjectName: string;
  topicName: string;
  concepts: string[];
  evidenceType: MasteryEvidenceType;
  evidenceSource?: string | null;
  scoreDelta?: number;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface InterventionQueueItem {
  type: Exclude<InterventionQueueType, 'tutor-escalation' | 'guardian-alert'>;
  severity: 'high' | 'medium' | 'low';
  reason: string;
  recommendation: string;
  evidence: string[];
}

// ─── Output summary types ────────────────────────────────────────────────────

export interface WorkspaceMemberSummary {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null;
  role: WorkspaceRole;
  status: string;
  gradeLevel?: string | null;
  cohortName?: string | null;
  cohortIds: string[];
  cohortNames: string[];
}

export interface WorkspaceInvitationSummary {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  inviteNote?: string | null;
  cohortIds: string[];
  cohortNames: string[];
  createdAt: string;
}

export interface InterventionQueueRecord {
  id: string;
  type: InterventionQueueType;
  priority: 'high' | 'medium' | 'low';
  status: InterventionStatus;
  reason: string;
  recommendedAction: string;
  supportingEvidence: string[];
  assignedRole?: WorkspaceRole | null;
  assignedToUserId?: string | null;
  actionNote?: string | null;
  dueAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface ConceptMasteryRollup {
  conceptName: string;
  subjectName: string;
  topicName: string;
  evidenceCount: number;
  latestEvidenceType: MasteryEvidenceType;
  avgConfidence: number;
  totalScoreDelta: number;
  confidenceScore: number;
  lastRecordedAt: string;
}

// ─── Local helpers ───────────────────────────────────────────────────────────

function dedupe(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const cleaned = (value || '').trim();
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface AcademicContext {
  workspaceId: string | null;
  curriculum: string | null;
  schoolName: string | null;
}

async function getAcademicContext(userId: string): Promise<AcademicContext> {
  try {
    const [{ data: memberships }, { data: profile }] = await Promise.all([
      losFrom('learning_workspace_memberships')
        .select('workspace_id, role, status')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1),
      supabase
        .from('academic_profiles')
        .select('curriculum, school_name')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    return {
      workspaceId: memberships?.[0]?.workspace_id ?? null,
      curriculum: profile?.curriculum ?? null,
      schoolName: profile?.school_name ?? null,
    };
  } catch (error) {
    logger.warn('[learningOps] Failed to load academic context', error);
    return { workspaceId: null, curriculum: null, schoolName: null };
  }
}

// ─── Mastery ledger ──────────────────────────────────────────────────────────

export async function logMasteryEvidence(input: MasteryEvidenceInput): Promise<void> {
  const concepts = dedupe(input.concepts);
  if (concepts.length === 0) return;

  try {
    const context = await getAcademicContext(input.userId);
    let conceptRows: Array<{ id: string; concept_name: string }> = [];

    try {
      const { data } = await losFrom('learning_concept_catalog')
        .select('id, concept_name')
        .eq('subject_name', input.subjectName)
        .eq('topic_name', input.topicName)
        .in('concept_name', concepts);
      conceptRows = data ?? [];
    } catch (catalogError) {
      logger.warn('[learningOps] concept catalog lookup failed', catalogError);
    }

    const rows = concepts.map((concept) => {
      const matched = conceptRows.find(
        (row) => row.concept_name.toLowerCase() === concept.toLowerCase(),
      );
      return {
        user_id: input.userId,
        subject_id: input.subjectId ?? null,
        concept_id: matched?.id ?? null,
        subject_name: input.subjectName,
        topic_name: input.topicName,
        concept_name: concept,
        evidence_type: input.evidenceType,
        evidence_source: input.evidenceSource ?? null,
        score_delta: input.scoreDelta ?? 0,
        confidence: input.confidence ?? 0.5,
        metadata: {
          ...(input.metadata ?? {}),
          curriculum: context.curriculum,
          school_name: context.schoolName,
          workspace_id: context.workspaceId,
        },
      };
    });

    const { error } = await losFrom('learning_concept_mastery_ledger').insert(rows);
    if (error) {
      logger.warn('[learningOps] mastery ledger insert failed', error.message);
    }
  } catch (error) {
    logger.warn('[learningOps] mastery evidence failed', error);
  }
}

export function buildMasteryRollups(rows: LosMasteryLedgerRow[]): ConceptMasteryRollup[] {
  const grouped = new Map<string, ConceptMasteryRollup>();

  for (const row of rows) {
    const key = `${row.subject_name}::${row.topic_name}::${row.concept_name}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        conceptName: row.concept_name,
        subjectName: row.subject_name,
        topicName: row.topic_name,
        evidenceCount: 1,
        latestEvidenceType: row.evidence_type,
        avgConfidence: Number(row.confidence ?? 0),
        totalScoreDelta: Number(row.score_delta ?? 0),
        confidenceScore: 50,
        lastRecordedAt: row.recorded_at,
      });
      continue;
    }

    const evidenceCount = existing.evidenceCount + 1;
    existing.evidenceCount = evidenceCount;
    existing.totalScoreDelta += Number(row.score_delta ?? 0);
    existing.avgConfidence = Number(
      (
        (existing.avgConfidence * (evidenceCount - 1) + Number(row.confidence ?? 0)) /
        evidenceCount
      ).toFixed(2),
    );
    if (new Date(row.recorded_at).getTime() >= new Date(existing.lastRecordedAt).getTime()) {
      existing.lastRecordedAt = row.recorded_at;
      existing.latestEvidenceType = row.evidence_type;
    }
  }

  return Array.from(grouped.values())
    .map((item) => {
      const confidenceScore = clamp(
        Math.round(
          50 +
            item.totalScoreDelta * 1.8 +
            item.avgConfidence * 20 +
            Math.min(item.evidenceCount, 8) * 2,
        ),
        0,
        100,
      );
      return { ...item, confidenceScore };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

export async function loadMasteryIntelligence(args: {
  userId: string;
  subjectId?: string | null;
  subjectName?: string;
  limit?: number;
}) {
  const { userId, subjectId, subjectName, limit = 300 } = args;
  let query = losFrom('learning_concept_mastery_ledger')
    .select(
      'concept_name, subject_name, topic_name, evidence_type, confidence, score_delta, recorded_at',
    )
    .eq('user_id', userId)
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (subjectId) query = query.eq('subject_id', subjectId);
  if (subjectName) query = query.eq('subject_name', subjectName);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as LosMasteryLedgerRow[];
  const rollups = buildMasteryRollups(rows);
  return {
    rollups,
    strongest: rollups.slice(0, 5),
    weakest: [...rollups].sort((a, b) => a.confidenceScore - b.confidenceScore).slice(0, 5),
    recentEvidence: rows.slice(0, 12),
  };
}

// ─── Intervention queue ──────────────────────────────────────────────────────

export async function syncInterventionQueue(args: {
  userId: string;
  subjectId?: string | null;
  subjectName: string;
  topicName: string;
  interventions: InterventionQueueItem[];
}): Promise<void> {
  try {
    const context = await getAcademicContext(args.userId);
    const { data: existing, error: existingError } = await losFrom('learning_intervention_queue')
      .select('id, intervention_type, status')
      .eq('user_id', args.userId)
      .eq('subject_id', args.subjectId ?? null)
      .in('status', ['open', 'acknowledged']);

    if (existingError) {
      logger.warn('[learningOps] intervention queue lookup failed', existingError.message);
      return;
    }

    const existingRows = existing ?? [];
    const activeTypes = new Set(args.interventions.map((item) => item.type));

    for (const intervention of args.interventions) {
      const match = existingRows.find((row) => row.intervention_type === intervention.type);
      const payload = {
        workspace_id: context.workspaceId,
        subject_id: args.subjectId ?? null,
        intervention_type: intervention.type,
        priority: intervention.severity,
        status: match?.status === 'acknowledged' ? 'acknowledged' : 'open',
        reason: intervention.reason,
        recommended_action: intervention.recommendation,
        supporting_evidence: intervention.evidence,
        metadata: {
          subject_name: args.subjectName,
          topic_name: args.topicName,
          curriculum: context.curriculum,
          school_name: context.schoolName,
        },
      } satisfies Partial<LosInterventionQueueRow>;

      if (match?.id) {
        await losFrom('learning_intervention_queue')
          .update({
            ...payload,
            last_action_at: new Date().toISOString(),
          })
          .eq('id', match.id);
      } else {
        const { data: inserted } = await losFrom('learning_intervention_queue')
          .insert({ user_id: args.userId, ...payload })
          .select('id')
          .single();

        if (inserted?.id) {
          await losFrom('learning_intervention_events').insert({
            intervention_id: inserted.id,
            actor_user_id: args.userId,
            action_type: 'created',
            note: intervention.recommendation,
            metadata: {
              type: intervention.type,
              evidence: intervention.evidence,
            },
          });
        }
      }
    }

    const staleRows = existingRows.filter((row) => !activeTypes.has(row.intervention_type));
    if (staleRows.length > 0) {
      await losFrom('learning_intervention_queue')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by_user_id: args.userId,
          last_action_at: new Date().toISOString(),
          action_note: 'Resolved automatically because the triggering learning signal cleared.',
        })
        .in(
          'id',
          staleRows.map((row) => row.id),
        );
    }
  } catch (error) {
    logger.warn('[learningOps] intervention queue sync failed', error);
  }
}

export async function loadInterventionQueue(args: {
  userId: string;
  subjectId?: string | null;
}): Promise<InterventionQueueRecord[]> {
  let query = losFrom('learning_intervention_queue')
    .select(
      'id, intervention_type, priority, status, reason, recommended_action, supporting_evidence, assigned_role, assigned_to_user_id, action_note, due_at, created_at, updated_at',
    )
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (args.subjectId) query = query.eq('subject_id', args.subjectId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.intervention_type,
    priority: row.priority,
    status: row.status,
    reason: row.reason,
    recommendedAction: row.recommended_action,
    supportingEvidence: Array.isArray(row.supporting_evidence)
      ? (row.supporting_evidence as string[])
      : [],
    assignedRole: row.assigned_role,
    assignedToUserId: row.assigned_to_user_id,
    actionNote: row.action_note,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function updateInterventionQueueItem(args: {
  interventionId: string;
  status?: InterventionStatus;
  assignedRole?: WorkspaceRole | null;
  assignedToUserId?: string | null;
  note?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const updates: Partial<LosInterventionQueueRow> = {
    last_action_at: new Date().toISOString(),
  };

  if (args.status) {
    updates.status = args.status;
    if (args.status === 'acknowledged') updates.acknowledged_at = new Date().toISOString();
    if (args.status === 'resolved' || args.status === 'dismissed') {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by_user_id = user.id;
    }
  }
  if (args.assignedRole !== undefined) updates.assigned_role = args.assignedRole;
  if (args.assignedToUserId !== undefined) updates.assigned_to_user_id = args.assignedToUserId;
  if (args.note !== undefined) updates.action_note = args.note;

  const { error } = await losFrom('learning_intervention_queue')
    .update(updates)
    .eq('id', args.interventionId);

  if (error) throw error;

  const actionType = args.status === 'acknowledged'
    ? 'acknowledged'
    : args.status === 'resolved'
    ? 'resolved'
    : args.status === 'dismissed'
    ? 'dismissed'
    : args.assignedRole !== undefined || args.assignedToUserId !== undefined
    ? 'reassigned'
    : 'noted';

  await losFrom('learning_intervention_events').insert({
    intervention_id: args.interventionId,
    actor_user_id: user.id,
    action_type: actionType,
    note: args.note ?? null,
    metadata: {
      assignedRole: args.assignedRole,
      assignedToUserId: args.assignedToUserId,
      status: args.status,
    },
  });
}

// ─── Workspaces, cohorts, invites ────────────────────────────────────────────

export async function createLearningWorkspace(args: {
  userId: string;
  name: string;
  schoolName?: string | null;
  workspaceType?: WorkspaceType;
}) {
  const baseSlug = slugify(args.name || args.schoolName || 'workspace');
  const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

  const { data: workspace, error } = await losFrom('learning_workspaces')
    .insert({
      owner_user_id: args.userId,
      name: args.name,
      slug,
      school_name: args.schoolName ?? null,
      workspace_type: args.workspaceType ?? 'school',
    })
    .select('id, name, slug, school_name, workspace_type')
    .single();

  if (error) throw error;

  const { error: membershipError } = await losFrom('learning_workspace_memberships').insert({
    workspace_id: workspace.id,
    user_id: args.userId,
    role: 'owner',
    status: 'active',
  });

  if (membershipError) throw membershipError;
  return workspace as Pick<
    LosWorkspaceRow,
    'id' | 'name' | 'slug' | 'school_name' | 'workspace_type'
  >;
}

export async function createWorkspaceCohort(args: {
  workspaceId: string;
  name: string;
  gradeLevel?: string | null;
  curriculum?: string | null;
  subjectNames?: string[];
}) {
  const { data, error } = await losFrom('learning_workspace_cohorts')
    .insert({
      workspace_id: args.workspaceId,
      name: args.name,
      grade_level: args.gradeLevel ?? null,
      curriculum: args.curriculum ?? null,
      subject_names: dedupe(args.subjectNames ?? []),
      is_active: true,
    })
    .select('id, name, grade_level, curriculum, subject_names')
    .single();

  if (error) throw error;
  return data;
}

export async function createWorkspaceInvitation(args: {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  cohortIds?: string[];
  inviteNote?: string | null;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await losFrom('learning_workspace_invitations')
    .insert({
      workspace_id: args.workspaceId,
      invited_by_user_id: user.id,
      email: args.email.trim().toLowerCase(),
      role: args.role,
      status: 'invited',
      cohort_ids: dedupe(args.cohortIds ?? []),
      invite_note: args.inviteNote ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
}

export async function setWorkspaceInvitationStatus(args: {
  invitationId: string;
  status: InvitationStatus;
}) {
  const { error } = await losFrom('learning_workspace_invitations')
    .update({ status: args.status })
    .eq('id', args.invitationId);

  if (error) throw error;
}

export async function updateWorkspaceMemberRole(args: {
  membershipId: string;
  role: WorkspaceRole;
}) {
  const { error } = await losFrom('learning_workspace_memberships')
    .update({ role: args.role })
    .eq('id', args.membershipId);

  if (error) throw error;
}

export async function assignMemberToCohort(args: {
  workspaceId: string;
  cohortId: string;
  membershipId: string;
  userId: string;
}) {
  const { error } = await losFrom('learning_workspace_member_cohorts').upsert(
    {
      workspace_id: args.workspaceId,
      cohort_id: args.cohortId,
      membership_id: args.membershipId,
      user_id: args.userId,
      status: 'active',
    },
    { onConflict: 'cohort_id,user_id' },
  );

  if (error) throw error;
}

export async function upsertConceptCatalogEntries(args: {
  subjectId?: string | null;
  subjectName: string;
  topicName: string;
  curriculum: string;
  concepts: string[];
  objectiveType?: ObjectiveType;
}) {
  const concepts = dedupe(args.concepts);
  if (concepts.length === 0) return 0;

  const rows = concepts.map((concept) => ({
    subject_id: args.subjectId ?? null,
    curriculum: args.curriculum,
    subject_name: args.subjectName,
    topic_name: args.topicName,
    subtopic_name: concept,
    concept_name: concept,
    objective_type: args.objectiveType ?? 'knowledge',
    command_words: [],
    prerequisites: [],
  }));

  const { error } = await losFrom('learning_concept_catalog').upsert(rows, {
    onConflict: 'curriculum,subject_name,topic_name,subtopic_name,concept_name',
    ignoreDuplicates: false,
  });

  if (error) throw error;
  return rows.length;
}

// ─── Workspace operations summary ────────────────────────────────────────────

export async function loadWorkspaceOperations(workspaceId: string) {
  const [membersResp, invitesResp, cohortsResp, assignmentsResp] = await Promise.all([
    losFrom('learning_workspace_memberships')
      .select('id, user_id, role, status, grade_level, cohort_name, metadata, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true }),
    losFrom('learning_workspace_invitations')
      .select('id, email, role, status, cohort_ids, invite_note, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }),
    losFrom('learning_workspace_cohorts')
      .select('id, name, grade_level, curriculum, subject_names')
      .eq('workspace_id', workspaceId)
      .eq('is_active', true)
      .order('name', { ascending: true }),
    losFrom('learning_workspace_member_cohorts')
      .select('id, cohort_id, membership_id, user_id, status')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active'),
  ]);

  if (membersResp.error) throw membersResp.error;
  if (invitesResp.error) throw invitesResp.error;
  if (cohortsResp.error) throw cohortsResp.error;
  if (assignmentsResp.error) throw assignmentsResp.error;

  const memberRows = (membersResp.data ?? []) as LosWorkspaceMembershipRow[];
  const inviteRows = (invitesResp.data ?? []) as LosWorkspaceInvitationRow[];
  const cohortRows = (cohortsResp.data ?? []) as LosWorkspaceCohortRow[];
  const assignmentRows = (assignmentsResp.data ?? []) as LosWorkspaceMemberCohortRow[];
  const cohortNameMap = new Map(cohortRows.map((cohort) => [cohort.id, cohort.name]));

  const userIds = dedupe(memberRows.map((member) => member.user_id));
  const { data: profiles } =
    userIds.length > 0
      ? await supabase.from('profiles').select('id, full_name, email').in('id', userIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string | null }> };
  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  const members: WorkspaceMemberSummary[] = memberRows.map((member) => {
    const profile = profileMap.get(member.user_id);
    const memberAssignments = assignmentRows.filter(
      (assignment) => assignment.membership_id === member.id,
    );
    const cohortIds = memberAssignments.map((assignment) => assignment.cohort_id);
    const cohortNames = cohortIds
      .map((id) => cohortNameMap.get(id))
      .filter((name): name is string => !!name);

    return {
      membershipId: member.id,
      userId: member.user_id,
      fullName: profile?.full_name || profile?.email || 'Workspace member',
      email: profile?.email ?? null,
      role: member.role,
      status: member.status,
      gradeLevel: member.grade_level,
      cohortName: member.cohort_name,
      cohortIds,
      cohortNames,
    };
  });

  const invitations: WorkspaceInvitationSummary[] = inviteRows.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    inviteNote: invite.invite_note,
    cohortIds: Array.isArray(invite.cohort_ids) ? invite.cohort_ids : [],
    cohortNames: (Array.isArray(invite.cohort_ids) ? invite.cohort_ids : [])
      .map((id) => cohortNameMap.get(id))
      .filter((name): name is string => !!name),
    createdAt: invite.created_at,
  }));

  const cohorts = cohortRows.map((cohort) => ({
    id: cohort.id,
    name: cohort.name,
    gradeLevel: cohort.grade_level,
    curriculum: cohort.curriculum,
    subjectNames: cohort.subject_names ?? [],
  }));

  return { members, invitations, cohorts };
}

// ─── Cohort & teacher rollups ────────────────────────────────────────────────

export interface CohortLearnerSnapshot {
  userId: string;
  fullName: string;
  email: string | null;
  cohortIds: string[];
  cohortNames: string[];
  membershipId: string;
  openInterventionCount: number;
  highPriorityInterventionCount: number;
  recentMasteryScoreDelta: number;
  lastEvidenceAt: string | null;
}

export interface CohortRollup {
  cohortId: string;
  cohortName: string;
  studentCount: number;
  openInterventionCount: number;
  highPriorityInterventionCount: number;
  averageMasteryScoreDelta: number;
}

export interface CommandCenterInterventionRow {
  id: string;
  studentUserId: string;
  studentName: string;
  interventionType: InterventionQueueType;
  priority: 'high' | 'medium' | 'low';
  status: InterventionStatus;
  reason: string;
  createdAt: string;
}

export interface TeacherCommandCenterSnapshot {
  workspaceId: string;
  workspaceName: string;
  totalStudents: number;
  totalOpenInterventions: number;
  totalHighPriorityInterventions: number;
  studentsAtRisk: CohortLearnerSnapshot[];
  cohortRollups: CohortRollup[];
  openInterventions: CommandCenterInterventionRow[];
  recentInterventionEvents: Array<{
    id: string;
    interventionId: string;
    actionType: string;
    note: string | null;
    createdAt: string;
  }>;
}

export async function loadTeacherCommandCenter(workspaceId: string): Promise<TeacherCommandCenterSnapshot> {
  // 1. workspace + members + assignments
  const [{ data: workspace }, ops] = await Promise.all([
    losFrom('learning_workspaces')
      .select('id, name')
      .eq('id', workspaceId)
      .maybeSingle(),
    loadWorkspaceOperations(workspaceId),
  ]);

  const students = ops.members.filter((member) => member.role === 'student');
  const studentIds = students.map((student) => student.userId);

  if (studentIds.length === 0) {
    return {
      workspaceId,
      workspaceName: workspace?.name ?? 'Workspace',
      totalStudents: 0,
      totalOpenInterventions: 0,
      totalHighPriorityInterventions: 0,
      studentsAtRisk: [],
      cohortRollups: ops.cohorts.map((cohort) => ({
        cohortId: cohort.id,
        cohortName: cohort.name,
        studentCount: 0,
        openInterventionCount: 0,
        highPriorityInterventionCount: 0,
        averageMasteryScoreDelta: 0,
      })),
      openInterventions: [],
      recentInterventionEvents: [],
    };
  }

  // 2. all open/ack interventions for students
  const { data: interventions } = await losFrom('learning_intervention_queue')
    .select('id, user_id, priority, status, intervention_type, reason, created_at')
    .in('user_id', studentIds)
    .in('status', ['open', 'acknowledged']);

  const interventionRows = interventions ?? [];

  // 3. recent mastery activity per student (last 60 days approximate via limit)
  const { data: mastery } = await losFrom('learning_concept_mastery_ledger')
    .select('user_id, score_delta, recorded_at')
    .in('user_id', studentIds)
    .order('recorded_at', { ascending: false })
    .limit(500);

  const masteryByUser = new Map<string, { delta: number; latest: string | null }>();
  for (const row of mastery ?? []) {
    const current = masteryByUser.get(row.user_id) ?? { delta: 0, latest: null };
    current.delta += Number(row.score_delta ?? 0);
    if (!current.latest || new Date(row.recorded_at).getTime() > new Date(current.latest).getTime()) {
      current.latest = row.recorded_at;
    }
    masteryByUser.set(row.user_id, current);
  }

  // 4. per-student snapshot
  const studentsAtRisk: CohortLearnerSnapshot[] = students.map((student) => {
    const open = interventionRows.filter((row) => row.user_id === student.userId);
    const high = open.filter((row) => row.priority === 'high');
    const masteryEntry = masteryByUser.get(student.userId);
    return {
      userId: student.userId,
      fullName: student.fullName,
      email: student.email,
      cohortIds: student.cohortIds,
      cohortNames: student.cohortNames,
      membershipId: student.membershipId,
      openInterventionCount: open.length,
      highPriorityInterventionCount: high.length,
      recentMasteryScoreDelta: Math.round(masteryEntry?.delta ?? 0),
      lastEvidenceAt: masteryEntry?.latest ?? null,
    };
  });

  studentsAtRisk.sort((a, b) => {
    if (b.highPriorityInterventionCount !== a.highPriorityInterventionCount) {
      return b.highPriorityInterventionCount - a.highPriorityInterventionCount;
    }
    if (b.openInterventionCount !== a.openInterventionCount) {
      return b.openInterventionCount - a.openInterventionCount;
    }
    return a.recentMasteryScoreDelta - b.recentMasteryScoreDelta;
  });

  // 5. cohort rollups
  const cohortRollups: CohortRollup[] = ops.cohorts.map((cohort) => {
    const cohortStudents = studentsAtRisk.filter((student) => student.cohortIds.includes(cohort.id));
    const open = cohortStudents.reduce((acc, s) => acc + s.openInterventionCount, 0);
    const high = cohortStudents.reduce((acc, s) => acc + s.highPriorityInterventionCount, 0);
    const deltas = cohortStudents.map((s) => s.recentMasteryScoreDelta);
    const avgDelta = deltas.length > 0
      ? Math.round(deltas.reduce((sum, value) => sum + value, 0) / deltas.length)
      : 0;
    return {
      cohortId: cohort.id,
      cohortName: cohort.name,
      studentCount: cohortStudents.length,
      openInterventionCount: open,
      highPriorityInterventionCount: high,
      averageMasteryScoreDelta: avgDelta,
    };
  });

  // 6. recent intervention events (last 12) for transparency
  const interventionIds = interventionRows.map((row) => row.id);
  let eventRows: Array<{
    id: string;
    intervention_id: string;
    action_type: string;
    note: string | null;
    created_at: string;
  }> = [];
  if (interventionIds.length > 0) {
    const { data } = await losFrom('learning_intervention_events')
      .select('id, intervention_id, action_type, note, created_at')
      .in('intervention_id', interventionIds)
      .order('created_at', { ascending: false })
      .limit(12);
    eventRows = data ?? [];
  }

  const studentNameById = new Map(students.map((student) => [student.userId, student.fullName]));
  const openInterventions: CommandCenterInterventionRow[] = interventionRows.map((row) => ({
    id: row.id,
    studentUserId: row.user_id,
    studentName: studentNameById.get(row.user_id) ?? 'Student',
    interventionType: row.intervention_type,
    priority: row.priority,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
  }));

  return {
    workspaceId,
    workspaceName: workspace?.name ?? 'Workspace',
    totalStudents: students.length,
    totalOpenInterventions: interventionRows.length,
    totalHighPriorityInterventions: interventionRows.filter((row) => row.priority === 'high').length,
    studentsAtRisk,
    cohortRollups,
    openInterventions,
    recentInterventionEvents: eventRows.map((row) => ({
      id: row.id,
      interventionId: row.intervention_id,
      actionType: row.action_type,
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}

// Re-export the typed client for advanced callsites if they need it.
export { losSupabase };
