/**
 * SAIL Deployment Pipeline
 *
 * Manages the lifecycle of agent-generated changes:
 *
 * Flow:
 *   1. Agent creates branch -> 
 *   2. Apply patch ->
 *   3. Run tests ->
 *   4. Preview deploy (Vercel) ->
 *   5. Manual approval (for medium/high risk) ->
 *   6. Merge to production
 *
 * Safety Rules:
 *   - No direct production deployment
 *   - No DB changes without approval
 *   - All changes tested in isolation
 *   - High-risk tasks MUST be manually approved
 *   - Medium-risk tasks need quick approval
 *   - Low-risk tasks can auto-deploy after tests pass
 *
 * Supabase Table: sail_pipelines
 * Schema:
 *   id             uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *   task_id        uuid REFERENCES sail_tasks(id)
 *   agent          text NOT NULL
 *   branch_name    text NOT NULL
 *   stage          text NOT NULL DEFAULT 'branch_created'
 *   preview_url    text
 *   test_results   jsonb
 *   diff_summary   text
 *   risk_level     text NOT NULL DEFAULT 'low'
 *   approved_by    text
 *   approved_at    timestamptz
 *   rejection_reason text
 *   created_at     timestamptz DEFAULT now()
 *   updated_at     timestamptz DEFAULT now()
 */

import { supabase } from '../../integrations/supabase/client';
import type {
  DeploymentPipeline,
  PipelineStage,
  SAILRiskLevel,
  SAILAgentType,
} from '../types';

// ─── Pipeline Stage Flow ────────────────────────────────────────────────────────

const STAGE_ORDER: PipelineStage[] = [
  'branch_created',
  'patch_applied',
  'tests_running',
  'tests_passed',
  'preview_deployed',
  'review_pending',
  'approved',
  'merged',
  'production_deployed',
];

const FAILURE_STAGES: PipelineStage[] = ['tests_failed', 'rejected'];

// ─── Pipeline Engine ────────────────────────────────────────────────────────────

export class SAILDeploymentPipeline {
  private static instance: SAILDeploymentPipeline;

  static getInstance(): SAILDeploymentPipeline {
    if (!SAILDeploymentPipeline.instance) {
      SAILDeploymentPipeline.instance = new SAILDeploymentPipeline();
    }
    return SAILDeploymentPipeline.instance;
  }

  // ── Create a new pipeline for a task ──────────────────────────────────────
  async createPipeline(params: {
    taskId: string;
    agent: SAILAgentType;
    riskLevel: SAILRiskLevel;
    diffSummary?: string;
  }): Promise<DeploymentPipeline | null> {
    const branchName = `sail/${params.agent}/${params.taskId.slice(0, 8)}`;

    const pipelineData = {
      task_id: params.taskId,
      agent: params.agent,
      branch_name: branchName,
      stage: 'branch_created' as PipelineStage,
      preview_url: null,
      test_results: null,
      diff_summary: params.diffSummary || null,
      risk_level: params.riskLevel,
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    };

    try {
      const { data, error } = await supabase
        .from('sail_pipelines' as any)
        .insert(pipelineData as any)
        .select()
        .single();

      if (error) {
        console.warn('[SAIL Pipeline] Error creating pipeline:', error.message);
        return {
          id: `pipe-${Date.now()}`,
          ...pipelineData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as DeploymentPipeline;
      }

      return data as unknown as DeploymentPipeline;
    } catch {
      return {
        id: `pipe-${Date.now()}`,
        ...pipelineData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as DeploymentPipeline;
    }
  }

  // ── Advance pipeline to next stage ────────────────────────────────────────
  async advanceStage(
    pipelineId: string,
    stage: PipelineStage,
    extra?: Partial<DeploymentPipeline>,
  ): Promise<boolean> {
    const updates: Record<string, unknown> = {
      stage,
      updated_at: new Date().toISOString(),
    };

    if (extra) {
      if (extra.preview_url) updates.preview_url = extra.preview_url;
      if (extra.test_results) updates.test_results = extra.test_results;
      if (extra.diff_summary) updates.diff_summary = extra.diff_summary;
      if (extra.approved_by) {
        updates.approved_by = extra.approved_by;
        updates.approved_at = new Date().toISOString();
      }
      if (extra.rejection_reason) updates.rejection_reason = extra.rejection_reason;
    }

    try {
      const { error } = await supabase
        .from('sail_pipelines' as any)
        .update(updates as any)
        .eq('id', pipelineId);

      if (error) {
        console.warn('[SAIL Pipeline] Error advancing stage:', error.message);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // ── Record test results ───────────────────────────────────────────────────
  async recordTestResults(
    pipelineId: string,
    results: { passed: number; failed: number; total: number; duration_ms: number },
  ): Promise<boolean> {
    const stage: PipelineStage = results.failed > 0 ? 'tests_failed' : 'tests_passed';

    return this.advanceStage(pipelineId, stage, {
      test_results: results,
    } as any);
  }

  // ── Approve a pipeline ────────────────────────────────────────────────────
  async approve(pipelineId: string, approvedBy: string): Promise<boolean> {
    return this.advanceStage(pipelineId, 'approved', {
      approved_by: approvedBy,
    } as any);
  }

  // ── Reject a pipeline ─────────────────────────────────────────────────────
  async reject(pipelineId: string, reason: string): Promise<boolean> {
    return this.advanceStage(pipelineId, 'rejected', {
      rejection_reason: reason,
    } as any);
  }

  // ── Check if pipeline can auto-deploy ─────────────────────────────────────
  canAutoDeploy(pipeline: DeploymentPipeline): boolean {
    // Safety: never auto-deploy high risk
    if (pipeline.risk_level === 'high') return false;
    // Medium risk needs approval
    if (pipeline.risk_level === 'medium') return false;
    // Low risk can auto-deploy if tests passed
    return pipeline.stage === 'tests_passed';
  }

  // ── Get all pipelines ─────────────────────────────────────────────────────
  async getPipelines(filters?: {
    stage?: PipelineStage[];
    agent?: SAILAgentType;
    limit?: number;
  }): Promise<DeploymentPipeline[]> {
    try {
      let query = supabase
        .from('sail_pipelines' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50);

      if (filters?.stage && filters.stage.length > 0) {
        query = query.in('stage', filters.stage);
      }
      if (filters?.agent) {
        query = query.eq('agent', filters.agent);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[SAIL Pipeline] Error fetching pipelines:', error.message);
        return [];
      }

      return (data || []) as unknown as DeploymentPipeline[];
    } catch {
      return [];
    }
  }

  // ── Get pending approvals ─────────────────────────────────────────────────
  async getPendingApprovals(): Promise<DeploymentPipeline[]> {
    return this.getPipelines({ stage: ['review_pending', 'tests_passed'] });
  }

  // ── Get pipeline stage info ───────────────────────────────────────────────
  getStageInfo(stage: PipelineStage): {
    label: string;
    description: string;
    color: string;
    isTerminal: boolean;
    isFailure: boolean;
  } {
    const stageMap: Record<PipelineStage, ReturnType<typeof this.getStageInfo>> = {
      branch_created: { label: 'Branch Created', description: 'New branch has been created', color: 'blue', isTerminal: false, isFailure: false },
      patch_applied: { label: 'Patch Applied', description: 'Code changes have been applied', color: 'blue', isTerminal: false, isFailure: false },
      tests_running: { label: 'Testing', description: 'Running automated tests', color: 'yellow', isTerminal: false, isFailure: false },
      tests_passed: { label: 'Tests Passed', description: 'All tests passed', color: 'green', isTerminal: false, isFailure: false },
      tests_failed: { label: 'Tests Failed', description: 'Some tests failed', color: 'red', isTerminal: true, isFailure: true },
      preview_deployed: { label: 'Preview Ready', description: 'Preview deployment available', color: 'green', isTerminal: false, isFailure: false },
      review_pending: { label: 'Review Pending', description: 'Awaiting manual approval', color: 'yellow', isTerminal: false, isFailure: false },
      approved: { label: 'Approved', description: 'Changes approved for merge', color: 'green', isTerminal: false, isFailure: false },
      rejected: { label: 'Rejected', description: 'Changes rejected', color: 'red', isTerminal: true, isFailure: true },
      merged: { label: 'Merged', description: 'Changes merged to main', color: 'green', isTerminal: false, isFailure: false },
      production_deployed: { label: 'Production', description: 'Deployed to production', color: 'green', isTerminal: true, isFailure: false },
    };

    return stageMap[stage] || { label: stage, description: '', color: 'gray', isTerminal: false, isFailure: false };
  }

  // ── Get pipeline progress percentage ──────────────────────────────────────
  getProgress(stage: PipelineStage): number {
    const idx = STAGE_ORDER.indexOf(stage);
    if (idx < 0) {
      return FAILURE_STAGES.includes(stage) ? -1 : 0;
    }
    return Math.round(((idx + 1) / STAGE_ORDER.length) * 100);
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────────

export const deploymentPipeline = SAILDeploymentPipeline.getInstance();
