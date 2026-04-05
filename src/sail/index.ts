/**
 * SAIL — StudySync Autonomous Intelligence Layer
 *
 * Public API for the SAIL system.
 *
 * Architecture:
 *   Frontend (React/App)
 *     -> Backend API (Supabase)
 *       -> Core AI (Lovable)
 *         -> SAIL (Agent System)
 *           -> Observability/Data
 *             -> Monetization Engine
 *
 * SAIL runs as background intelligence, triggered by events or periodic checks.
 *
 * Components:
 *   1. Task Engine        — Central task management with priority queue
 *   2. Agent System       — Six specialized AI agents
 *   3. Detection System   — Error, behavior, performance, revenue monitoring
 *   4. Monetization Engine — Subscriptions, trials, access control
 *   5. Deployment Pipeline — Branch -> Test -> Preview -> Approve -> Merge
 *
 * Safety Rules:
 *   - No direct production deployment
 *   - No DB changes without approval
 *   - All changes tested in isolation
 *   - High-risk tasks MUST be manually approved
 *
 * Phased Implementation:
 *   Phase 1: Task system, Debug agent, Approval system
 *   Phase 2: Frontend & Backend agents
 *   Phase 3: Learning agent
 *   Phase 4: Monetization agent
 */

// Types
export * from './types';
export * from './types/edgeFunctions';

// Engine
export { SAILTaskEngine, taskEngine } from './engine/taskEngine';

// Agents
export { AGENT_CONFIGS, processTask, getAgentConfig, getAllAgentConfigs, getEnabledAgents } from './agents';

// Detection
export { SAILDetectionSystem, detectionSystem } from './detection/detectionSystem';

// Monetization
export { SubscriptionEngine, subscriptionEngine } from './monetization/subscriptionEngine';

// Pipeline
export { SAILDeploymentPipeline, deploymentPipeline } from './pipeline/deploymentPipeline';

// System Prompts
export {
  PAYOUT_SYSTEM_PROMPT,
  VIDEO_SYSTEM_PROMPT,
  STUDENT_INSIGHTS_SYSTEM_PROMPT,
} from './prompts/systemPrompts';

// Hooks
export { useSAIL } from './hooks/useSAIL';

// Components
export { SAILApprovalDashboard } from './components/SAILApprovalDashboard';
export { SAILDashboard } from './components/SAILDashboard';
