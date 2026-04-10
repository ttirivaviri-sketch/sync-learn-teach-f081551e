/**
 * useSAIL — Main React hook for the SAIL system
 *
 * Provides access to the entire SAIL system state and operations:
 *  - Task Engine (create, manage, track tasks)
 *  - Agent System (agent configs, processing status)
 *  - Detection System (signals, alerts)
 *  - Monetization (subscriptions, access control)
 *  - Deployment Pipeline (pipelines, approvals)
 *  - System-wide state and health
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { taskEngine } from '../engine/taskEngine';
import { detectionSystem } from '../detection/detectionSystem';
import { subscriptionEngine } from '../monetization/subscriptionEngine';
import { deploymentPipeline } from '../pipeline/deploymentPipeline';
import { AGENT_CONFIGS, processTask } from '../agents';
import { logger } from "@/utils/logger";
import type {
  SAILTask,
  SAILTaskType,
  SAILTaskPriority,
  SAILSystemState,
  SAILAgentType,
  SAILRiskLevel,
  DetectionSignal,
  Subscription,
  DeploymentPipeline,
} from '../types';

// ─── Hook Return Type ───────────────────────────────────────────────────────────

interface UseSAILReturn {
  // System state
  systemState: SAILSystemState;
  isInitialized: boolean;

  // Task operations
  tasks: SAILTask[];
  pendingApprovals: SAILTask[];
  createTask: (params: {
    type: SAILTaskType;
    title: string;
    description: string;
    priority?: SAILTaskPriority;
    context?: Record<string, unknown>;
  }) => Promise<SAILTask | null>;
  approveTask: (taskId: string, notes?: string) => Promise<boolean>;
  rejectTask: (taskId: string, reason: string) => Promise<boolean>;
  retryTask: (taskId: string) => Promise<boolean>;
  refreshTasks: () => Promise<void>;

  // Detection
  recentSignals: DetectionSignal[];

  // Monetization
  subscription: Subscription | null;
  canAccessStudyMode: boolean;
  accessMessage: string;
  startTrial: () => Promise<void>;
  upgradePlan: (plan: string) => Promise<boolean>;

  // Pipeline
  pipelines: DeploymentPipeline[];
  approvePipeline: (pipelineId: string) => Promise<boolean>;
  rejectPipeline: (pipelineId: string, reason: string) => Promise<boolean>;

  // Agents
  agentConfigs: typeof AGENT_CONFIGS;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSAIL(): UseSAILReturn {
  const [isInitialized, setIsInitialized] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<SAILTask[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<SAILTask[]>([]);
  const [recentSignals, setRecentSignals] = useState<DetectionSignal[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [canAccessStudyMode, setCanAccessStudyMode] = useState(true); // Default true until loaded
  const [accessMessage, setAccessMessage] = useState('');
  const [pipelines, setPipelines] = useState<DeploymentPipeline[]>([]);
  const [systemState, setSystemState] = useState<SAILSystemState>({
    isRunning: false,
    activeAgents: [],
    taskQueueSize: 0,
    tasksInProgress: 0,
    tasksCompletedToday: 0,
    detectionSignalsToday: 0,
    pendingApprovals: 0,
    lastActivityAt: null,
    systemHealth: 'healthy',
    errorRate: 0,
  });

  const initRef = useRef(false);

  // ── Initialize on mount ───────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Load initial data
        await Promise.all([
          loadTasks(),
          loadSubscription(user.id),
          loadPipelines(),
        ]);
      }

      // Register detection signal listener
      detectionSystem.onSignal((signal) => {
        setRecentSignals(prev => [...prev.slice(-49), signal]);
      });

      setIsInitialized(true);
      setSystemState(prev => ({
        ...prev,
        isRunning: true,
        activeAgents: Object.keys(AGENT_CONFIGS) as SAILAgentType[],
        lastActivityAt: new Date().toISOString(),
      }));
    };

    init().catch((e) => logger.warn(e));
  }, []);

  // ── Load tasks ────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    const allTasks = await taskEngine.getTasks({ limit: 50 });
    setTasks(allTasks);

    const approvals = await taskEngine.getPendingApprovals();
    setPendingApprovals(approvals);

    const counts = await taskEngine.getTaskCounts();
    setSystemState(prev => ({
      ...prev,
      taskQueueSize: counts.pending + counts.assigned,
      tasksInProgress: counts.in_progress,
      tasksCompletedToday: counts.completed,
      pendingApprovals: counts.review,
    }));
  }, []);

  // ── Load subscription ─────────────────────────────────────────────────────
  const loadSubscription = useCallback(async (uid: string) => {
    const sub = await subscriptionEngine.getSubscription(uid);
    setSubscription(sub);

    const access = await subscriptionEngine.canAccessStudyMode(uid);
    setCanAccessStudyMode(access.allowed);
    setAccessMessage(access.reason);
  }, []);

  // ── Load pipelines ────────────────────────────────────────────────────────
  const loadPipelines = useCallback(async () => {
    const pipes = await deploymentPipeline.getPipelines({ limit: 30 });
    setPipelines(pipes);
  }, []);

  // ── Create task ───────────────────────────────────────────────────────────
  const createTask = useCallback(async (params: {
    type: SAILTaskType;
    title: string;
    description: string;
    priority?: SAILTaskPriority;
    context?: Record<string, unknown>;
  }): Promise<SAILTask | null> => {
    const task = await taskEngine.createTask({
      ...params,
      created_by: userId ? `user:${userId}` : 'system',
    });

    if (task) {
      await loadTasks();
    }

    return task;
  }, [userId, loadTasks]);

  // ── Approve task ──────────────────────────────────────────────────────────
  const approveTask = useCallback(async (taskId: string, notes?: string): Promise<boolean> => {
    const success = await taskEngine.approveTask(taskId, userId || 'admin', notes);
    if (success) await loadTasks();
    return success;
  }, [userId, loadTasks]);

  // ── Reject task ───────────────────────────────────────────────────────────
  const rejectTask = useCallback(async (taskId: string, reason: string): Promise<boolean> => {
    const success = await taskEngine.rejectTask(taskId, userId || 'admin', reason);
    if (success) await loadTasks();
    return success;
  }, [userId, loadTasks]);

  // ── Retry task ────────────────────────────────────────────────────────────
  const retryTask = useCallback(async (taskId: string): Promise<boolean> => {
    const success = await taskEngine.retryTask(taskId);
    if (success) await loadTasks();
    return success;
  }, [loadTasks]);

  // ── Start trial ───────────────────────────────────────────────────────────
  const startTrial = useCallback(async () => {
    if (!userId) return;
    const sub = await subscriptionEngine.startTrial(userId);
    if (sub) {
      setSubscription(sub);
      setCanAccessStudyMode(true);
      setAccessMessage('Free trial started! 7 days of full access.');
    }
  }, [userId]);

  // ── Upgrade plan ──────────────────────────────────────────────────────────
  const upgradePlan = useCallback(async (plan: string): Promise<boolean> => {
    if (!userId) return false;
    const success = await subscriptionEngine.upgradePlan(
      userId,
      plan as any,
    );
    if (success) {
      await loadSubscription(userId);
    }
    return success;
  }, [userId, loadSubscription]);

  // ── Approve pipeline ──────────────────────────────────────────────────────
  const approvePipeline = useCallback(async (pipelineId: string): Promise<boolean> => {
    const success = await deploymentPipeline.approve(pipelineId, userId || 'admin');
    if (success) await loadPipelines();
    return success;
  }, [userId, loadPipelines]);

  // ── Reject pipeline ───────────────────────────────────────────────────────
  const rejectPipeline = useCallback(async (pipelineId: string, reason: string): Promise<boolean> => {
    const success = await deploymentPipeline.reject(pipelineId, reason);
    if (success) await loadPipelines();
    return success;
  }, [loadPipelines]);

  // ── Refresh tasks ─────────────────────────────────────────────────────────
  const refreshTasks = useCallback(async () => {
    await loadTasks();
  }, [loadTasks]);

  return {
    systemState,
    isInitialized,
    tasks,
    pendingApprovals,
    createTask,
    approveTask,
    rejectTask,
    retryTask,
    refreshTasks,
    recentSignals,
    subscription,
    canAccessStudyMode,
    accessMessage,
    startTrial,
    upgradePlan,
    pipelines,
    approvePipeline,
    rejectPipeline,
    agentConfigs: AGENT_CONFIGS,
  };
}
