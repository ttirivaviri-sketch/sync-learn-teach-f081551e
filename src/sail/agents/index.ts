/**
 * SAIL Agent System
 *
 * Six specialized AI agents that process tasks from the Task Engine:
 *
 * 1. Debug Agent     — Fixes bugs from error logs and user reports
 * 2. Frontend Agent  — UI improvements, accessibility, UX optimizations
 * 3. Backend Agent   — API/DB optimization, data integrity, performance
 * 4. Learning Agent  — Adaptive learning, content quality, study plans
 * 5. Monetization Agent — Subscription management, revenue optimization
 * 6. Reviewer Agent  — Risk assessment, code review, approval decisions
 *
 * Each agent:
 *  - Receives a task with context and input data
 *  - Processes it using AI + domain logic
 *  - Returns results with risk assessment
 *  - Optionally generates code patches
 *
 * Safety Rules:
 *  - No direct production deployment
 *  - No DB changes without approval
 *  - All changes tested in isolation
 */

import { aiRequestJSON } from '../../studymode/lib/aiClient';
import type {
  SAILTask,
  SAILAgentType,
  SAILAgentConfig,
  SAILAgentResult,
  SAILRiskLevel,
} from '../types';

// ─── Agent Configurations ───────────────────────────────────────────────────────

export const AGENT_CONFIGS: Record<SAILAgentType, SAILAgentConfig> = {
  debug: {
    type: 'debug',
    name: 'Debug Agent',
    purpose: 'Identify, diagnose, and fix bugs from error logs, user reports, and system monitoring',
    capabilities: [
      'Error log analysis',
      'Stack trace interpretation',
      'Root cause identification',
      'Fix suggestion generation',
      'Regression detection',
    ],
    risk_level_default: 'medium',
    auto_deploy_threshold: 'low',
    inputs: ['error_logs', 'user_reports', 'system_metrics', 'stack_traces'],
    outputs: ['diagnosis', 'fix_patch', 'test_cases', 'prevention_suggestions'],
    enabled: true,
  },
  frontend: {
    type: 'frontend',
    name: 'Frontend Agent',
    purpose: 'Improve UI/UX, fix layout issues, optimize rendering, enhance accessibility',
    capabilities: [
      'UI bug detection',
      'Accessibility analysis',
      'Performance optimization',
      'Component refactoring',
      'Responsive design fixes',
    ],
    risk_level_default: 'low',
    auto_deploy_threshold: 'low',
    inputs: ['component_code', 'user_feedback', 'accessibility_reports', 'performance_data'],
    outputs: ['ui_patch', 'component_updates', 'style_changes', 'a11y_fixes'],
    enabled: true,
  },
  backend: {
    type: 'backend',
    name: 'Backend Agent',
    purpose: 'Optimize APIs, manage database changes, improve data integrity and security',
    capabilities: [
      'API optimization',
      'Database query tuning',
      'Security patch generation',
      'Data migration scripts',
      'Performance profiling',
    ],
    risk_level_default: 'high',
    auto_deploy_threshold: 'low',
    inputs: ['api_logs', 'slow_queries', 'security_alerts', 'data_issues'],
    outputs: ['api_patch', 'migration_script', 'security_fix', 'performance_report'],
    enabled: true,
  },
  learning: {
    type: 'learning',
    name: 'Learning Agent',
    purpose: 'Adapt study content, improve AI recommendations, optimize learning paths',
    capabilities: [
      'Content quality analysis',
      'Study plan optimization',
      'Difficulty calibration',
      'Engagement pattern analysis',
      'Curriculum alignment checking',
    ],
    risk_level_default: 'low',
    auto_deploy_threshold: 'medium',
    inputs: ['student_performance', 'content_metrics', 'engagement_data', 'curriculum_data'],
    outputs: ['content_updates', 'plan_adjustments', 'difficulty_recalibration', 'new_content'],
    enabled: true,
  },
  monetization: {
    type: 'monetization',
    name: 'Monetization Agent',
    purpose: 'Manage subscriptions, optimize pricing, track revenue, handle trial conversions',
    capabilities: [
      'Trial expiry monitoring',
      'Churn prediction',
      'Pricing optimization',
      'Feature gate management',
      'Revenue analytics',
    ],
    risk_level_default: 'high',
    auto_deploy_threshold: 'low',
    inputs: ['subscription_data', 'revenue_metrics', 'user_engagement', 'churn_signals'],
    outputs: ['pricing_changes', 'feature_gates', 'retention_actions', 'revenue_reports'],
    enabled: true,
  },
  reviewer: {
    type: 'reviewer',
    name: 'Reviewer Agent',
    purpose: 'Assess risk, review agent outputs, approve or reject changes before deployment',
    capabilities: [
      'Code review',
      'Risk assessment',
      'Impact analysis',
      'Regression prediction',
      'Approval/rejection decisions',
    ],
    risk_level_default: 'low',
    auto_deploy_threshold: 'low',
    inputs: ['agent_output', 'code_diff', 'test_results', 'risk_data'],
    outputs: ['approval_decision', 'risk_report', 'review_comments', 'improvement_suggestions'],
    enabled: true,
  },
};

// ─── Base Agent Processor ───────────────────────────────────────────────────────

export async function processTask(task: SAILTask): Promise<SAILAgentResult> {
  const agentType = task.agent || 'debug';
  const config = AGENT_CONFIGS[agentType];

  if (!config.enabled) {
    return {
      success: false,
      agent: agentType,
      taskId: task.id,
      output: {},
      riskAssessment: task.risk_level,
      deployReady: false,
      reviewNotes: `Agent ${config.name} is currently disabled.`,
      error: 'Agent disabled',
    };
  }

  try {
    // Build the AI prompt based on agent type
    const prompt = buildAgentPrompt(task, config);

    // Call AI with the agent's context
    const result = await aiRequestJSON<{
      analysis: string;
      actions: string[];
      risk_assessment: string;
      recommendations: string[];
      patch?: string;
    }>('ai-study-intelligence', {
      mode: 'sail-agent',
      agent: agentType,
      task: {
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        context: task.context,
        input_data: task.input_data,
      },
      prompt,
      internetAccess: true,
    });

    // Assess risk from the result
    const riskAssessment = assessRisk(task, result);
    const deployReady = riskAssessment === 'low' && !task.risk_level.match(/high/);

    return {
      success: true,
      agent: agentType,
      taskId: task.id,
      output: {
        analysis: result.analysis,
        actions: result.actions,
        recommendations: result.recommendations,
      },
      patch: result.patch,
      riskAssessment,
      deployReady,
      reviewNotes: `${config.name} completed analysis. Risk: ${riskAssessment}. ${result.actions?.length || 0} actions proposed.`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      agent: agentType,
      taskId: task.id,
      output: {},
      riskAssessment: 'high',
      deployReady: false,
      reviewNotes: `Agent failed: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

// ─── Build agent-specific prompts ───────────────────────────────────────────────

function buildAgentPrompt(task: SAILTask, config: SAILAgentConfig): string {
  const parts: string[] = [];

  parts.push(`=== SAIL ${config.name} ===`);
  parts.push(`Purpose: ${config.purpose}`);
  parts.push(`Capabilities: ${config.capabilities.join(', ')}`);
  parts.push('');
  parts.push(`=== TASK ===`);
  parts.push(`Type: ${task.type}`);
  parts.push(`Priority: ${task.priority}`);
  parts.push(`Title: ${task.title}`);
  parts.push(`Description: ${task.description}`);
  parts.push('');

  if (Object.keys(task.context).length > 0) {
    parts.push(`=== CONTEXT ===`);
    parts.push(JSON.stringify(task.context, null, 2));
    parts.push('');
  }

  if (Object.keys(task.input_data).length > 0) {
    parts.push(`=== INPUT DATA ===`);
    parts.push(JSON.stringify(task.input_data, null, 2));
    parts.push('');
  }

  parts.push(`=== SAFETY RULES ===`);
  parts.push(`1. Never deploy directly to production`);
  parts.push(`2. Never modify database without approval`);
  parts.push(`3. Always test changes in isolation`);
  parts.push(`4. Assess risk level: low (auto-deploy), medium (quick approval), high (must approve)`);
  parts.push('');
  parts.push(`=== INSTRUCTIONS ===`);
  parts.push(`Analyze this task and provide:`);
  parts.push(`1. analysis: Detailed analysis of the issue/request`);
  parts.push(`2. actions: Array of specific actions to take`);
  parts.push(`3. risk_assessment: "low", "medium", or "high"`);
  parts.push(`4. recommendations: Array of recommendations`);
  parts.push(`5. patch: (optional) Code patch if applicable`);
  parts.push(`Return as JSON.`);

  return parts.join('\n');
}

// ─── Risk assessment ────────────────────────────────────────────────────────────

function assessRisk(task: SAILTask, _result: Record<string, unknown>): SAILRiskLevel {
  // DB changes are always high risk
  if (task.type === 'data_cleanup' || task.type === 'security_patch') return 'high';
  // Monetization changes are always high risk
  if (task.type === 'monetization_action') return 'high';
  // Bug fixes with patches are medium risk
  if (task.type === 'bug_fix') return 'medium';
  // Content and learning adaptations are low risk
  if (task.type === 'content_generation' || task.type === 'learning_adaptation') return 'low';
  // UI improvements are low risk
  if (task.type === 'ui_improvement') return 'low';
  // Default to the task's risk level
  return task.risk_level;
}

// ─── Export convenience functions ────────────────────────────────────────────────

export function getAgentConfig(agentType: SAILAgentType): SAILAgentConfig {
  return AGENT_CONFIGS[agentType];
}

export function getAllAgentConfigs(): SAILAgentConfig[] {
  return Object.values(AGENT_CONFIGS);
}

export function getEnabledAgents(): SAILAgentConfig[] {
  return Object.values(AGENT_CONFIGS).filter(a => a.enabled);
}
