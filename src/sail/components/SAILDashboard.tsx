/**
 * SAIL Dashboard — Main UI for the StudySync Autonomous Intelligence Layer
 *
 * Shows:
 *  1. System health and active agents
 *  2. Task queue with priority ordering
 *  3. Detection signals feed
 *  4. Approval dashboard
 *  5. Deployment pipeline status
 *  6. Monetization metrics
 */

import { useState } from 'react';
import {
  Bot, Shield, Activity, Zap, DollarSign,
  GitBranch, AlertCircle, CheckCircle, Clock,
  Bug, Layout, Server, Brain, Eye,
  BarChart3, Bell, Settings, ChevronRight,
  Rocket, TrendingUp,
} from 'lucide-react';
import { SAILApprovalDashboard } from './SAILApprovalDashboard';
import type {
  SAILTask,
  SAILSystemState,
  SAILAgentConfig,
  SAILAgentType,
  DetectionSignal,
  DeploymentPipeline,
  Subscription,
} from '../types';

interface SAILDashboardProps {
  systemState: SAILSystemState;
  tasks: SAILTask[];
  pendingApprovals: SAILTask[];
  recentSignals: DetectionSignal[];
  pipelines: DeploymentPipeline[];
  subscription: Subscription | null;
  agentConfigs: Record<SAILAgentType, SAILAgentConfig>;
  canAccessStudyMode: boolean;
  accessMessage: string;
  onApproveTask: (taskId: string, notes?: string) => Promise<boolean>;
  onRejectTask: (taskId: string, reason: string) => Promise<boolean>;
  onRetryTask: (taskId: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onApprovePipeline: (pipelineId: string) => Promise<boolean>;
  onRejectPipeline: (pipelineId: string, reason: string) => Promise<boolean>;
  onStartTrial: () => Promise<void>;
}

const AGENT_ICONS: Record<string, typeof Bot> = {
  debug: Bug,
  frontend: Layout,
  backend: Server,
  learning: Brain,
  monetization: DollarSign,
  reviewer: Eye,
};

type TabId = 'overview' | 'tasks' | 'approvals' | 'detection' | 'pipeline' | 'monetization';

export function SAILDashboard({
  systemState,
  tasks,
  pendingApprovals,
  recentSignals,
  pipelines,
  subscription,
  agentConfigs,
  canAccessStudyMode,
  accessMessage,
  onApproveTask,
  onRejectTask,
  onRetryTask,
  onRefresh,
  onApprovePipeline,
  onRejectPipeline,
  onStartTrial,
}: SAILDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string; icon: typeof Bot; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'tasks', label: 'Tasks', icon: Zap, badge: systemState.taskQueueSize },
    { id: 'approvals', label: 'Approvals', icon: Shield, badge: systemState.pendingApprovals },
    { id: 'detection', label: 'Detection', icon: Bell, badge: systemState.detectionSignalsToday },
    { id: 'pipeline', label: 'Pipeline', icon: GitBranch, badge: pipelines.filter(p => p.stage === 'review_pending').length },
    { id: 'monetization', label: 'Revenue', icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      {/* SAIL Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Rocket className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">SAIL</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">StudySync Autonomous Intelligence Layer</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            systemState.systemHealth === 'healthy'
              ? 'bg-green-100 text-green-700'
              : systemState.systemHealth === 'degraded'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${
              systemState.systemHealth === 'healthy' ? 'bg-green-500' :
              systemState.systemHealth === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            {systemState.systemHealth}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === id
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className={`inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-bold ${
                activeTab === id
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-destructive text-destructive-foreground'
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewTab
          systemState={systemState}
          agentConfigs={agentConfigs}
          tasks={tasks}
          subscription={subscription}
          canAccessStudyMode={canAccessStudyMode}
          accessMessage={accessMessage}
          onStartTrial={onStartTrial}
        />
      )}

      {activeTab === 'tasks' && (
        <TasksTab tasks={tasks} />
      )}

      {activeTab === 'approvals' && (
        <SAILApprovalDashboard
          tasks={pendingApprovals.length > 0 ? pendingApprovals : tasks.filter(t =>
            ['review', 'pending', 'failed', 'rejected'].includes(t.status)
          )}
          onApprove={onApproveTask}
          onReject={onRejectTask}
          onRetry={onRetryTask}
          onRefresh={onRefresh}
        />
      )}

      {activeTab === 'detection' && (
        <DetectionTab signals={recentSignals} />
      )}

      {activeTab === 'pipeline' && (
        <PipelineTab
          pipelines={pipelines}
          onApprove={onApprovePipeline}
          onReject={onRejectPipeline}
        />
      )}

      {activeTab === 'monetization' && (
        <MonetizationTab
          subscription={subscription}
          canAccessStudyMode={canAccessStudyMode}
          accessMessage={accessMessage}
          onStartTrial={onStartTrial}
        />
      )}
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────────

function OverviewTab({
  systemState,
  agentConfigs,
  tasks,
  subscription,
  canAccessStudyMode,
  accessMessage,
  onStartTrial,
}: {
  systemState: SAILSystemState;
  agentConfigs: Record<SAILAgentType, SAILAgentConfig>;
  tasks: SAILTask[];
  subscription: Subscription | null;
  canAccessStudyMode: boolean;
  accessMessage: string;
  onStartTrial: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Queue', value: systemState.taskQueueSize, icon: Clock, color: 'text-blue-500' },
          { label: 'In Progress', value: systemState.tasksInProgress, icon: Activity, color: 'text-indigo-500' },
          { label: 'Completed', value: systemState.tasksCompletedToday, icon: CheckCircle, color: 'text-green-500' },
          { label: 'Approvals', value: systemState.pendingApprovals, icon: Shield, color: 'text-yellow-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Active Agents */}
      <div className="p-4 rounded-lg border bg-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Bot className="h-4 w-4 text-primary" />
          Active Agents
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.values(agentConfigs).map((config) => {
            const AgentIcon = AGENT_ICONS[config.type] || Bot;
            const agentTasks = tasks.filter(t => t.agent === config.type);
            return (
              <div
                key={config.type}
                className={`p-2.5 rounded-lg border text-xs ${
                  config.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <AgentIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{config.name}</span>
                  {config.enabled && (
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 ml-auto" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-1">{config.purpose.split(',')[0]}</p>
                {agentTasks.length > 0 && (
                  <p className="text-[10px] text-primary mt-1 font-medium">
                    {agentTasks.length} task{agentTasks.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscription Status */}
      {!canAccessStudyMode && !subscription && (
        <div className="p-4 rounded-lg border border-accent/30 bg-accent/5 text-center">
          <Zap className="h-8 w-8 mx-auto text-accent-foreground mb-2" />
          <h3 className="font-semibold text-sm mb-1">Start Your Free Trial</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Get 7 days of full access to Study Mode, AI tutoring, and all premium features.
          </p>
          <button
            onClick={onStartTrial}
            className="px-4 py-2 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:bg-accent/90"
          >
            Start 7-Day Free Trial
          </button>
        </div>
      )}

      {/* Recent Tasks */}
      <div className="p-4 rounded-lg border bg-card">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-primary" />
          Recent Tasks
        </h3>
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No tasks yet. SAIL is monitoring...</p>
        ) : (
          <div className="space-y-2">
            {tasks.slice(0, 5).map((task) => {
              const AgentIcon = AGENT_ICONS[task.agent || 'debug'] || Bot;
              return (
                <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50">
                  <AgentIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{task.title}</p>
                    <p className="text-[10px] text-muted-foreground">{task.type} · {task.status}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tasks Tab ──────────────────────────────────────────────────────────────────

function TasksTab({ tasks }: { tasks: SAILTask[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Zap className="h-4 w-4 text-primary" />
        Task Queue ({tasks.length})
      </h3>
      {tasks.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed">
          <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Task queue is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const AgentIcon = AGENT_ICONS[task.agent || 'debug'] || Bot;
            return (
              <div key={task.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-start gap-2">
                  <AgentIcon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      <span className={`inline-block px-1.5 py-0 text-[10px] font-medium rounded ${
                        task.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                        task.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {task.risk_level}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{task.type}</span>
                      <span>·</span>
                      <span>{task.priority}</span>
                      <span>·</span>
                      <span>{task.status}</span>
                      <span>·</span>
                      <span>{new Date(task.created_at).toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Detection Tab ──────────────────────────────────────────────────────────────

function DetectionTab({ signals }: { signals: DetectionSignal[] }) {
  const severityColors: Record<string, string> = {
    info: 'border-l-blue-400',
    warning: 'border-l-yellow-400',
    error: 'border-l-red-400',
    critical: 'border-l-red-600',
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <Bell className="h-4 w-4 text-primary" />
        Detection Signals ({signals.length})
      </h3>
      {signals.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed">
          <Activity className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No signals detected yet. System is monitoring...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {signals.slice().reverse().map((signal) => (
            <div key={signal.id} className={`p-3 rounded-lg border border-l-4 bg-card ${severityColors[signal.severity] || ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium">{signal.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{signal.description}</p>
                </div>
                <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded ${
                  signal.severity === 'critical' ? 'bg-red-100 text-red-700' :
                  signal.severity === 'error' ? 'bg-red-50 text-red-600' :
                  signal.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  {signal.severity}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                <span>{signal.source}</span>
                <span>→</span>
                <span>{signal.suggested_agent}</span>
                {signal.auto_create_task && <span className="text-primary font-medium">• Task auto-created</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pipeline Tab ───────────────────────────────────────────────────────────────

function PipelineTab({
  pipelines,
  onApprove,
  onReject,
}: {
  pipelines: DeploymentPipeline[];
  onApprove: (id: string) => Promise<boolean>;
  onReject: (id: string, reason: string) => Promise<boolean>;
}) {
  const stageLabels: Record<string, { label: string; color: string }> = {
    branch_created: { label: 'Branch', color: 'bg-blue-100 text-blue-700' },
    patch_applied: { label: 'Patched', color: 'bg-blue-100 text-blue-700' },
    tests_running: { label: 'Testing', color: 'bg-yellow-100 text-yellow-700' },
    tests_passed: { label: 'Passed', color: 'bg-green-100 text-green-700' },
    tests_failed: { label: 'Failed', color: 'bg-red-100 text-red-700' },
    preview_deployed: { label: 'Preview', color: 'bg-purple-100 text-purple-700' },
    review_pending: { label: 'Review', color: 'bg-yellow-100 text-yellow-700' },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
    merged: { label: 'Merged', color: 'bg-green-200 text-green-800' },
    production_deployed: { label: 'Production', color: 'bg-green-300 text-green-900' },
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <GitBranch className="h-4 w-4 text-primary" />
        Deployment Pipeline ({pipelines.length})
      </h3>
      {pipelines.length === 0 ? (
        <div className="p-8 text-center rounded-lg border border-dashed">
          <GitBranch className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No deployments in pipeline</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pipelines.map((pipeline) => {
            const stage = stageLabels[pipeline.stage] || { label: pipeline.stage, color: '' };
            return (
              <div key={pipeline.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                    <code className="text-xs font-mono">{pipeline.branch_name}</code>
                  </div>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${stage.color}`}>
                    {stage.label}
                  </span>
                </div>
                {pipeline.diff_summary && (
                  <p className="text-[10px] text-muted-foreground line-clamp-1 mb-1">{pipeline.diff_summary}</p>
                )}
                {pipeline.test_results && (
                  <p className="text-[10px] text-muted-foreground">
                    Tests: {pipeline.test_results.passed} passed, {pipeline.test_results.failed} failed ({pipeline.test_results.duration_ms}ms)
                  </p>
                )}
                {pipeline.stage === 'review_pending' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => onApprove(pipeline.id)}
                      className="px-2 py-1 text-[10px] font-medium bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(pipeline.id, 'Rejected from dashboard')}
                      className="px-2 py-1 text-[10px] font-medium bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Monetization Tab ───────────────────────────────────────────────────────────

function MonetizationTab({
  subscription,
  canAccessStudyMode,
  accessMessage,
  onStartTrial,
}: {
  subscription: Subscription | null;
  canAccessStudyMode: boolean;
  accessMessage: string;
  onStartTrial: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-1.5">
        <DollarSign className="h-4 w-4 text-primary" />
        Monetization & Subscription
      </h3>

      {/* Current Plan */}
      <div className="p-4 rounded-lg border bg-card">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium">Current Plan</h4>
          {subscription ? (
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
              subscription.status === 'active' ? 'bg-green-100 text-green-700' :
              subscription.status === 'trial' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
            </span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
              No Plan
            </span>
          )}
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            {canAccessStudyMode ? (
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
            )}
            <span className="text-muted-foreground">{accessMessage}</span>
          </div>

          {subscription?.trial_end && subscription.status === 'trial' && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-yellow-500" />
              <span className="text-muted-foreground">
                Trial ends: {new Date(subscription.trial_end).toLocaleDateString()}
              </span>
            </div>
          )}

          {subscription?.price_monthly !== undefined && subscription.price_monthly > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-green-500" />
              <span className="text-muted-foreground">
                R{subscription.price_monthly}/month
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { plan: 'basic', price: 'R49/mo', features: ['Study Mode', 'AI Tutor', '5 subjects', 'Daily tasks'] },
          { plan: 'premium', price: 'R99/mo', features: ['Everything in Basic', 'Adaptive learning', 'Past paper analysis', 'Internet enrichment', 'AI study plans'], recommended: true },
          { plan: 'enterprise', price: 'R199/mo', features: ['Everything in Premium', 'Priority support', 'Unlimited subjects', 'Unlimited AI calls'] },
        ].map(({ plan, price, features, recommended }) => (
          <div
            key={plan}
            className={`p-3 rounded-lg border ${
              recommended ? 'border-primary ring-1 ring-primary/20' : ''
            }`}
          >
            {recommended && (
              <span className="inline-block px-1.5 py-0.5 mb-2 text-[10px] font-medium bg-primary text-primary-foreground rounded">
                RECOMMENDED
              </span>
            )}
            <h4 className="text-sm font-bold capitalize">{plan}</h4>
            <p className="text-lg font-bold text-primary mt-0.5">{price}</p>
            <ul className="mt-2 space-y-1">
              {features.map(f => (
                <li key={f} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Start Trial CTA */}
      {!subscription && (
        <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-center">
          <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
          <h3 className="font-bold text-sm mb-1">Start Your Journey</h3>
          <p className="text-xs text-muted-foreground mb-3">
            7 days free. Full access. No credit card needed.
          </p>
          <button
            onClick={onStartTrial}
            className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Start Free Trial
          </button>
        </div>
      )}
    </div>
  );
}
