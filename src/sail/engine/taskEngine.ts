/**
 * SAIL Task Engine
 *
 * Central task management system that:
 *  1. Creates, assigns, and tracks tasks through their lifecycle
 *  2. Routes tasks to the appropriate agent based on type and priority
 *  3. Manages task queues with priority ordering
 *  4. Enforces risk-level approval requirements
 *  5. Handles task retries and failure recovery
 *
 * Supabase Table: sail_tasks
 * Schema:
 *   id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
 *   type          text NOT NULL
 *   priority      text NOT NULL DEFAULT 'medium'
 *   status        text NOT NULL DEFAULT 'pending'
 *   agent         text
 *   risk_level    text NOT NULL DEFAULT 'low'
 *   title         text NOT NULL
 *   description   text
 *   context       jsonb DEFAULT '{}'
 *   input_data    jsonb DEFAULT '{}'
 *   output_data   jsonb
 *   error_log     text
 *   created_by    text NOT NULL DEFAULT 'system'
 *   assigned_at   timestamptz
 *   started_at    timestamptz
 *   completed_at  timestamptz
 *   reviewed_by   text
 *   review_notes  text
 *   retry_count   int DEFAULT 0
 *   max_retries   int DEFAULT 3
 *   parent_task_id uuid REFERENCES sail_tasks(id)
 *   branch_name   text
 *   deployment_url text
 *   created_at    timestamptz DEFAULT now()
 *   updated_at    timestamptz DEFAULT now()
 */

import { supabase } from '../../integrations/supabase/client';
import type {
  SAILTask,
  SAILTaskType,
  SAILTaskPriority,
  SAILTaskStatus,
  SAILAgentType,
  SAILRiskLevel,
} from '../types';

// ─── Priority ordering ──────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<SAILTaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// ─── Agent routing ──────────────────────────────────────────────────────────────

const TASK_AGENT_ROUTING: Record<SAILTaskType, SAILAgentType> = {
  bug_fix: 'debug',
  ui_improvement: 'frontend',
  api_optimization: 'backend',
  learning_adaptation: 'learning',
  monetization_action: 'monetization',
  performance_alert: 'debug',
  security_patch: 'backend',
  content_generation: 'learning',
  data_cleanup: 'backend',
  feature_request: 'frontend',
};

// ─── Risk assessment ────────────────────────────────────────────────────────────

const TASK_DEFAULT_RISK: Record<SAILTaskType, SAILRiskLevel> = {
  bug_fix: 'medium',
  ui_improvement: 'low',
  api_optimization: 'medium',
  learning_adaptation: 'low',
  monetization_action: 'high',
  performance_alert: 'medium',
  security_patch: 'high',
  content_generation: 'low',
  data_cleanup: 'high',
  feature_request: 'medium',
};

// ─── Task Engine Class ──────────────────────────────────────────────────────────

export class SAILTaskEngine {
  private static instance: SAILTaskEngine;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  static getInstance(): SAILTaskEngine {
    if (!SAILTaskEngine.instance) {
      SAILTaskEngine.instance = new SAILTaskEngine();
    }
    return SAILTaskEngine.instance;
  }

  // ── Create a new task ─────────────────────────────────────────────────────
  async createTask(params: {
    type: SAILTaskType;
    title: string;
    description: string;
    priority?: SAILTaskPriority;
    context?: Record<string, unknown>;
    input_data?: Record<string, unknown>;
    created_by?: string;
    parent_task_id?: string;
    risk_level?: SAILRiskLevel;
  }): Promise<SAILTask | null> {
    const agent = TASK_AGENT_ROUTING[params.type];
    const risk = params.risk_level || TASK_DEFAULT_RISK[params.type];

    const taskData = {
      type: params.type,
      title: params.title,
      description: params.description,
      priority: params.priority || 'medium',
      status: 'pending' as SAILTaskStatus,
      agent,
      risk_level: risk,
      context: params.context || {},
      input_data: params.input_data || {},
      output_data: null,
      error_log: null,
      created_by: params.created_by || 'system',
      assigned_at: null,
      started_at: null,
      completed_at: null,
      reviewed_by: null,
      review_notes: null,
      retry_count: 0,
      max_retries: 3,
      parent_task_id: params.parent_task_id || null,
      branch_name: null,
      deployment_url: null,
    };

    try {
      const { data, error } = await supabase
        .from('sail_tasks' as any)
        .insert(taskData as any)
        .select()
        .single();

      if (error) {
        console.warn('[SAIL TaskEngine] Failed to create task in DB:', error.message);
        // Return in-memory task
        return {
          id: `sail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          ...taskData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as SAILTask;
      }

      return data as unknown as SAILTask;
    } catch {
      // Fallback for missing table
      return {
        id: `sail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...taskData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as SAILTask;
    }
  }

  // ── Fetch pending tasks ordered by priority ───────────────────────────────
  async getPendingTasks(limit = 20): Promise<SAILTask[]> {
    try {
      const { data, error } = await supabase
        .from('sail_tasks' as any)
        .select('*')
        .in('status', ['pending', 'assigned'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) {
        console.warn('[SAIL TaskEngine] Error fetching tasks:', error.message);
        return [];
      }

      // Sort by priority order
      return ((data || []) as unknown as SAILTask[]).sort((a, b) => {
        return (PRIORITY_ORDER[a.priority] || 2) - (PRIORITY_ORDER[b.priority] || 2);
      });
    } catch {
      return [];
    }
  }

  // ── Fetch all tasks (with optional filters) ───────────────────────────────
  async getTasks(filters?: {
    status?: SAILTaskStatus[];
    agent?: SAILAgentType;
    risk_level?: SAILRiskLevel;
    limit?: number;
  }): Promise<SAILTask[]> {
    try {
      let query = supabase
        .from('sail_tasks' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(filters?.limit || 50);

      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters?.agent) {
        query = query.eq('agent', filters.agent);
      }
      if (filters?.risk_level) {
        query = query.eq('risk_level', filters.risk_level);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[SAIL TaskEngine] Error fetching tasks:', error.message);
        return [];
      }

      return (data || []) as unknown as SAILTask[];
    } catch {
      return [];
    }
  }

  // ── Update task status ────────────────────────────────────────────────────
  async updateTaskStatus(
    taskId: string,
    status: SAILTaskStatus,
    extra?: Partial<SAILTask>,
  ): Promise<boolean> {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'assigned') updates.assigned_at = new Date().toISOString();
    if (status === 'in_progress') updates.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed') updates.completed_at = new Date().toISOString();

    if (extra) {
      Object.assign(updates, extra);
    }

    try {
      const { error } = await supabase
        .from('sail_tasks' as any)
        .update(updates as any)
        .eq('id', taskId);

      if (error) {
        console.warn('[SAIL TaskEngine] Error updating task:', error.message);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  // ── Approve a task ────────────────────────────────────────────────────────
  async approveTask(taskId: string, reviewedBy: string, notes?: string): Promise<boolean> {
    return this.updateTaskStatus(taskId, 'approved', {
      reviewed_by: reviewedBy,
      review_notes: notes || 'Approved',
    } as Partial<SAILTask>);
  }

  // ── Reject a task ─────────────────────────────────────────────────────────
  async rejectTask(taskId: string, reviewedBy: string, reason: string): Promise<boolean> {
    return this.updateTaskStatus(taskId, 'rejected', {
      reviewed_by: reviewedBy,
      review_notes: reason,
    } as Partial<SAILTask>);
  }

  // ── Retry a failed task ───────────────────────────────────────────────────
  async retryTask(taskId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('sail_tasks' as any)
        .select('retry_count, max_retries')
        .eq('id', taskId)
        .single();

      const task = data as unknown as SAILTask;
      if (!task || task.retry_count >= task.max_retries) {
        return false;
      }

      return this.updateTaskStatus(taskId, 'pending', {
        retry_count: task.retry_count + 1,
        error_log: null,
        started_at: null,
        completed_at: null,
      } as Partial<SAILTask>);
    } catch {
      return false;
    }
  }

  // ── Get tasks pending approval ────────────────────────────────────────────
  async getPendingApprovals(): Promise<SAILTask[]> {
    return this.getTasks({ status: ['review'] });
  }

  // ── Get task counts by status ─────────────────────────────────────────────
  async getTaskCounts(): Promise<Record<SAILTaskStatus, number>> {
    const counts: Record<string, number> = {
      pending: 0,
      assigned: 0,
      in_progress: 0,
      review: 0,
      approved: 0,
      deploying: 0,
      completed: 0,
      rejected: 0,
      failed: 0,
    };

    try {
      const { data } = await supabase
        .from('sail_tasks' as any)
        .select('status');

      if (data) {
        for (const row of data as unknown as { status: string }[]) {
          if (counts[row.status] !== undefined) {
            counts[row.status]++;
          }
        }
      }
    } catch {
      // Table may not exist
    }

    return counts as Record<SAILTaskStatus, number>;
  }

  // ── Determine if a task needs approval ────────────────────────────────────
  needsApproval(task: SAILTask): boolean {
    // Safety rule: high risk MUST be approved
    if (task.risk_level === 'high') return true;
    // Medium risk needs quick approval
    if (task.risk_level === 'medium') return true;
    // Low risk can auto-deploy
    return false;
  }

  // ── Get the appropriate agent for a task type ─────────────────────────────
  getAgentForTask(taskType: SAILTaskType): SAILAgentType {
    return TASK_AGENT_ROUTING[taskType];
  }

  // ── Get default risk level for a task type ────────────────────────────────
  getDefaultRisk(taskType: SAILTaskType): SAILRiskLevel {
    return TASK_DEFAULT_RISK[taskType];
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────────

export const taskEngine = SAILTaskEngine.getInstance();
