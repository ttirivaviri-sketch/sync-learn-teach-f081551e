/**
 * useAutomationRuntime
 *
 * Phase 3.1 hook for the Teacher Command Center automation panel.
 * Loads the current workspace's automation schedule and lets staff:
 *   - toggle cadence per job (daily / weekly / manual)
 *   - trigger a job on-demand
 * Delegates execution to the `run-learning-ops-automation` edge function.
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import {
  AutomationCadence,
  AutomationJobName,
  AutomationScheduleSummary,
  loadAutomationSchedule,
  routeInterventionsToTeachers,
  runNightlyInterventionSweep,
  runStudyPlanOptimizer,
  runWeeklyCohortRollup,
  upsertAutomationSchedule,
} from '../lib/learningOps';

interface Args {
  workspaceId: string | null;
}

interface RunResult {
  jobName: AutomationJobName;
  status: 'succeeded' | 'failed' | 'skipped';
  rowsProcessed: number;
  error?: string;
}

export function useAutomationRuntime({ workspaceId }: Args) {
  const [schedule, setSchedule] = useState<AutomationScheduleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyJob, setBusyJob] = useState<AutomationJobName | null>(null);
  const [lastResult, setLastResult] = useState<RunResult | null>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setSchedule([]);
      return;
    }
    setIsLoading(true);
    try {
      const rows = await loadAutomationSchedule(workspaceId);
      setSchedule(rows);
    } catch (err) {
      logger.warn('[useAutomationRuntime] load failed', err);
      setSchedule([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  const setCadence = useCallback(async (jobName: AutomationJobName, cadence: AutomationCadence) => {
    if (!workspaceId) return;
    setBusyJob(jobName);
    try {
      await upsertAutomationSchedule({ workspaceId, jobName, cadence, enabled: cadence !== 'manual' });
      await refresh();
    } finally {
      setBusyJob(null);
    }
  }, [workspaceId, refresh]);

  const toggleEnabled = useCallback(async (jobName: AutomationJobName, enabled: boolean) => {
    if (!workspaceId) return;
    setBusyJob(jobName);
    try {
      const current = schedule.find((row) => row.jobName === jobName);
      const cadence: AutomationCadence = current?.cadence ?? 'daily';
      await upsertAutomationSchedule({ workspaceId, jobName, cadence, enabled });
      await refresh();
    } finally {
      setBusyJob(null);
    }
  }, [workspaceId, schedule, refresh]);

  const runJob = useCallback(async (jobName: AutomationJobName) => {
    if (!workspaceId) return;
    setBusyJob(jobName);
    setLastResult(null);
    try {
      if (jobName === 'nightly_intervention_sweep') {
        const data = (await runNightlyInterventionSweep(workspaceId)) as { auto_resolved?: number } | null;
        setLastResult({
          jobName,
          status: 'succeeded',
          rowsProcessed: Number(data?.auto_resolved ?? 0),
        });
      } else if (jobName === 'weekly_cohort_rollup') {
        const data = (await runWeeklyCohortRollup(workspaceId)) as { cohorts?: unknown[] } | null;
        setLastResult({
          jobName,
          status: 'succeeded',
          rowsProcessed: Array.isArray(data?.cohorts) ? data!.cohorts!.length : 0,
        });
      } else if (jobName === 'study_plan_optimizer') {
        const data = (await runStudyPlanOptimizer(workspaceId)) as { proposals_created?: number } | null;
        setLastResult({
          jobName,
          status: 'succeeded',
          rowsProcessed: Number(data?.proposals_created ?? 0),
        });
      } else if (jobName === 'route_interventions_to_teachers') {
        const routed = await routeInterventionsToTeachers(workspaceId);
        setLastResult({
          jobName,
          status: 'succeeded',
          rowsProcessed: routed,
        });
      } else {
        // guardian_digest and concept_ingestion are dispatched through the edge
        // function so the schedule + audit log stay in one place.
        const { data, error } = await supabase.functions.invoke('run-learning-ops-automation', {
          body: { workspace_id: workspaceId, job: jobName },
        });
        if (error) throw error;
        const first = ((data as { results?: RunResult[] } | null)?.results ?? [])[0];
        setLastResult(first ?? { jobName, status: 'succeeded', rowsProcessed: 0 });
      }
      await refresh();
    } catch (err) {
      logger.warn('[useAutomationRuntime] run failed', err);
      setLastResult({
        jobName,
        status: 'failed',
        rowsProcessed: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusyJob(null);
    }
  }, [workspaceId, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    schedule,
    isLoading,
    busyJob,
    lastResult,
    refresh,
    setCadence,
    toggleEnabled,
    runJob,
  };
}