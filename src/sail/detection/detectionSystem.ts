/**
 * SAIL Detection System
 *
 * Ingests signals from multiple sources and generates tasks:
 *
 * Sources:
 *  1. Error logs       — Frontend JS errors, API failures, unhandled exceptions
 *  2. User behavior    — Session duration, feature usage, drop-off points
 *  3. Learning perf    — Accuracy drops, topic avoidance, engagement decline
 *  4. Revenue metrics  — Churn signals, trial expirations, payment failures
 *  5. System health    — API latency, DB slow queries, high error rates
 *  6. AI analysis      — AI-detected content quality issues, curriculum gaps
 *
 * Each detection generates a signal that may auto-create a task in the Task Engine.
 */

import { supabase } from '../../integrations/supabase/client';
import { taskEngine } from '../engine/taskEngine';
import type {
  DetectionSignal,
  DetectionSource,
  SAILTaskType,
  SAILTaskPriority,
  SAILAgentType,
} from '../types';

// ─── Detection Rules ────────────────────────────────────────────────────────────

interface DetectionRule {
  id: string;
  source: DetectionSource;
  condition: string;
  threshold?: number;
  suggested_task_type: SAILTaskType;
  suggested_priority: SAILTaskPriority;
  suggested_agent: SAILAgentType;
  auto_create: boolean;
  cooldown_minutes: number; // Don't re-trigger within this window
}

const DETECTION_RULES: DetectionRule[] = [
  // Error detection rules
  {
    id: 'high_error_rate',
    source: 'error_log',
    condition: 'Error rate exceeds 5% in last hour',
    threshold: 0.05,
    suggested_task_type: 'bug_fix',
    suggested_priority: 'critical',
    suggested_agent: 'debug',
    auto_create: true,
    cooldown_minutes: 30,
  },
  {
    id: 'recurring_error',
    source: 'error_log',
    condition: 'Same error occurs 10+ times in 24 hours',
    threshold: 10,
    suggested_task_type: 'bug_fix',
    suggested_priority: 'high',
    suggested_agent: 'debug',
    auto_create: true,
    cooldown_minutes: 60,
  },
  // Learning performance rules
  {
    id: 'accuracy_drop',
    source: 'learning_performance',
    condition: 'Student accuracy drops more than 20% in a week',
    threshold: -0.20,
    suggested_task_type: 'learning_adaptation',
    suggested_priority: 'high',
    suggested_agent: 'learning',
    auto_create: true,
    cooldown_minutes: 120,
  },
  {
    id: 'topic_avoidance',
    source: 'learning_performance',
    condition: 'Student skips same topic 3+ times',
    threshold: 3,
    suggested_task_type: 'learning_adaptation',
    suggested_priority: 'medium',
    suggested_agent: 'learning',
    auto_create: true,
    cooldown_minutes: 240,
  },
  {
    id: 'content_quality_low',
    source: 'ai_analysis',
    condition: 'AI-generated content rated below 3/5 by students',
    threshold: 3,
    suggested_task_type: 'content_generation',
    suggested_priority: 'medium',
    suggested_agent: 'learning',
    auto_create: true,
    cooldown_minutes: 360,
  },
  // Revenue detection rules
  {
    id: 'trial_expiring',
    source: 'revenue_metrics',
    condition: 'Trial expires within 48 hours with low engagement',
    suggested_task_type: 'monetization_action',
    suggested_priority: 'high',
    suggested_agent: 'monetization',
    auto_create: true,
    cooldown_minutes: 720,
  },
  {
    id: 'churn_risk',
    source: 'revenue_metrics',
    condition: 'Premium user inactive for 7+ days',
    suggested_task_type: 'monetization_action',
    suggested_priority: 'medium',
    suggested_agent: 'monetization',
    auto_create: true,
    cooldown_minutes: 1440,
  },
  {
    id: 'payment_failed',
    source: 'revenue_metrics',
    condition: 'Payment processing failure',
    suggested_task_type: 'monetization_action',
    suggested_priority: 'critical',
    suggested_agent: 'monetization',
    auto_create: true,
    cooldown_minutes: 15,
  },
  // User behavior rules
  {
    id: 'session_drop_off',
    source: 'user_behavior',
    condition: 'Average session duration drops below 2 minutes',
    threshold: 120,
    suggested_task_type: 'ui_improvement',
    suggested_priority: 'medium',
    suggested_agent: 'frontend',
    auto_create: false,
    cooldown_minutes: 1440,
  },
  {
    id: 'feature_unused',
    source: 'user_behavior',
    condition: 'Feature has less than 5% adoption rate',
    threshold: 0.05,
    suggested_task_type: 'ui_improvement',
    suggested_priority: 'low',
    suggested_agent: 'frontend',
    auto_create: false,
    cooldown_minutes: 10080, // 1 week
  },
  // System health rules
  {
    id: 'api_latency_high',
    source: 'system_health',
    condition: 'API p95 latency exceeds 3 seconds',
    threshold: 3000,
    suggested_task_type: 'api_optimization',
    suggested_priority: 'high',
    suggested_agent: 'backend',
    auto_create: true,
    cooldown_minutes: 60,
  },
  {
    id: 'db_slow_queries',
    source: 'system_health',
    condition: 'Database query takes more than 5 seconds',
    threshold: 5000,
    suggested_task_type: 'api_optimization',
    suggested_priority: 'high',
    suggested_agent: 'backend',
    auto_create: true,
    cooldown_minutes: 120,
  },
];

// ─── Signal history (for cooldown tracking) ──────────────────────────────────────

const signalHistory = new Map<string, number>(); // ruleId -> lastTriggeredAt (ms)

// ─── Detection System Class ─────────────────────────────────────────────────────

export class SAILDetectionSystem {
  private static instance: SAILDetectionSystem;
  private signals: DetectionSignal[] = [];
  private listeners: ((signal: DetectionSignal) => void)[] = [];

  static getInstance(): SAILDetectionSystem {
    if (!SAILDetectionSystem.instance) {
      SAILDetectionSystem.instance = new SAILDetectionSystem();
    }
    return SAILDetectionSystem.instance;
  }

  // ── Register a signal listener ────────────────────────────────────────────
  onSignal(listener: (signal: DetectionSignal) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // ── Emit a detection signal ───────────────────────────────────────────────
  async emitSignal(params: {
    source: DetectionSource;
    severity: DetectionSignal['severity'];
    title: string;
    description: string;
    data: Record<string, unknown>;
    ruleId?: string;
  }): Promise<DetectionSignal | null> {
    // Check cooldown if a rule is specified
    if (params.ruleId) {
      const rule = DETECTION_RULES.find(r => r.id === params.ruleId);
      if (rule) {
        const lastTriggered = signalHistory.get(rule.id);
        if (lastTriggered) {
          const cooldownMs = rule.cooldown_minutes * 60_000;
          if (Date.now() - lastTriggered < cooldownMs) {
            return null; // Still in cooldown
          }
        }
      }
    }

    // Find matching rule
    const rule = params.ruleId
      ? DETECTION_RULES.find(r => r.id === params.ruleId)
      : DETECTION_RULES.find(r => r.source === params.source);

    const signal: DetectionSignal = {
      id: `det-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: params.source,
      severity: params.severity,
      title: params.title,
      description: params.description,
      data: params.data,
      suggested_task_type: rule?.suggested_task_type || 'bug_fix',
      suggested_priority: rule?.suggested_priority || 'medium',
      suggested_agent: rule?.suggested_agent || 'debug',
      auto_create_task: rule?.auto_create || false,
      created_at: new Date().toISOString(),
    };

    // Track in history
    if (params.ruleId) {
      signalHistory.set(params.ruleId, Date.now());
    }

    // Store the signal
    this.signals.push(signal);
    if (this.signals.length > 1000) {
      this.signals = this.signals.slice(-500);
    }

    // Persist to Supabase (best effort)
    try {
      await supabase
        .from('sail_detection_signals')
        .insert([{
          source: signal.source,
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          data: signal.data,
          suggested_task_type: signal.suggested_task_type,
          suggested_priority: signal.suggested_priority,
          suggested_agent: signal.suggested_agent,
          auto_create_task: signal.auto_create_task,
        });
    } catch {
      // Table may not exist yet
    }

    // Auto-create task if rule says so
    if (signal.auto_create_task) {
      await taskEngine.createTask({
        type: signal.suggested_task_type,
        title: signal.title,
        description: signal.description,
        priority: signal.suggested_priority,
        context: { detection_signal_id: signal.id, ...signal.data },
        created_by: `detection:${signal.source}`,
      });
    }

    // Notify listeners
    this.listeners.forEach(l => {
      try { l(signal); } catch { /* ignore */ }
    });

    return signal;
  }

  // ── Error detection ───────────────────────────────────────────────────────
  async detectError(error: {
    message: string;
    stack?: string;
    component?: string;
    url?: string;
    userId?: string;
  }): Promise<void> {
    await this.emitSignal({
      source: 'error_log',
      severity: 'error',
      title: `Error: ${error.message.substring(0, 100)}`,
      description: `Error in ${error.component || 'unknown'}: ${error.message}`,
      data: error,
      ruleId: 'recurring_error',
    });
  }

  // ── Learning performance detection ────────────────────────────────────────
  async detectLearningIssue(params: {
    userId: string;
    type: 'accuracy_drop' | 'topic_avoidance' | 'burnout_risk' | 'rapid_improvement';
    subject: string;
    topic?: string;
    details: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    const ruleMap: Record<string, string> = {
      accuracy_drop: 'accuracy_drop',
      topic_avoidance: 'topic_avoidance',
      burnout_risk: 'topic_avoidance',
      rapid_improvement: 'content_quality_low',
    };

    await this.emitSignal({
      source: 'learning_performance',
      severity: params.type === 'accuracy_drop' ? 'warning' : 'info',
      title: `Learning: ${params.type} — ${params.subject}`,
      description: params.details,
      data: { userId: params.userId, subject: params.subject, topic: params.topic, ...params.data },
      ruleId: ruleMap[params.type],
    });
  }

  // ── Revenue metric detection ──────────────────────────────────────────────
  async detectRevenueEvent(params: {
    type: 'trial_expiring' | 'churn_risk' | 'payment_failed' | 'conversion';
    userId: string;
    details: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    await this.emitSignal({
      source: 'revenue_metrics',
      severity: params.type === 'payment_failed' ? 'critical' : 'warning',
      title: `Revenue: ${params.type}`,
      description: params.details,
      data: { userId: params.userId, ...params.data },
      ruleId: params.type,
    });
  }

  // ── User behavior detection ───────────────────────────────────────────────
  async detectBehaviorAnomaly(params: {
    type: 'session_drop_off' | 'feature_unused' | 'high_engagement';
    details: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    await this.emitSignal({
      source: 'user_behavior',
      severity: 'info',
      title: `Behavior: ${params.type}`,
      description: params.details,
      data: params.data,
      ruleId: params.type,
    });
  }

  // ── System health detection ───────────────────────────────────────────────
  async detectSystemIssue(params: {
    type: 'api_latency_high' | 'db_slow_queries' | 'memory_pressure';
    details: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    await this.emitSignal({
      source: 'system_health',
      severity: 'warning',
      title: `System: ${params.type}`,
      description: params.details,
      data: params.data,
      ruleId: params.type,
    });
  }

  // ── Get recent signals ────────────────────────────────────────────────────
  getRecentSignals(limit = 50): DetectionSignal[] {
    return this.signals.slice(-limit);
  }

  // ── Get signals by source ─────────────────────────────────────────────────
  getSignalsBySource(source: DetectionSource, limit = 20): DetectionSignal[] {
    return this.signals.filter(s => s.source === source).slice(-limit);
  }

  // ── Get all detection rules ───────────────────────────────────────────────
  getRules(): DetectionRule[] {
    return [...DETECTION_RULES];
  }

  // ── Get signal counts by source (today) ───────────────────────────────────
  getTodaySignalCounts(): Record<DetectionSource, number> {
    const today = new Date().toISOString().split('T')[0];
    const counts: Record<string, number> = {
      error_log: 0,
      user_behavior: 0,
      learning_performance: 0,
      revenue_metrics: 0,
      system_health: 0,
      ai_analysis: 0,
    };

    for (const signal of this.signals) {
      if (signal.created_at.startsWith(today)) {
        counts[signal.source] = (counts[signal.source] || 0) + 1;
      }
    }

    return counts as Record<DetectionSource, number>;
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────────

export const detectionSystem = SAILDetectionSystem.getInstance();
