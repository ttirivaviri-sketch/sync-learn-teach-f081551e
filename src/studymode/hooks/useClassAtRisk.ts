// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
/**
 * useClassAtRisk
 *
 * Phase 3.2 hook. Loads the per-cohort at-risk view (projected risk +
 * intervention pressure) for a workspace, optionally filtered by cohort.
 */
import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import { ClassAtRiskRow, loadClassAtRisk, routeInterventionsToTeachers, runStudyPlanOptimizer } from '../lib/learningOps';

interface Args {
  workspaceId: string | null;
  cohortId?: string;
}

export function useClassAtRisk({ workspaceId, cohortId }: Args) {
  const [rows, setRows] = useState<ClassAtRiskRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'route' | 'optimize'>(null);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setRows([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await loadClassAtRisk(workspaceId, cohortId);
      setRows(data);
    } catch (err) {
      logger.warn('[useClassAtRisk] load failed', err);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, cohortId]);

  const routeToTeachers = useCallback(async () => {
    if (!workspaceId) return 0;
    setBusy('route');
    try {
      const routed = await routeInterventionsToTeachers(workspaceId);
      await refresh();
      return routed;
    } finally {
      setBusy(null);
    }
  }, [workspaceId, refresh]);

  const runOptimizer = useCallback(async () => {
    if (!workspaceId) return null;
    setBusy('optimize');
    try {
      const result = await runStudyPlanOptimizer(workspaceId);
      await refresh();
      return result;
    } finally {
      setBusy(null);
    }
  }, [workspaceId, refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { rows, isLoading, busy, refresh, routeToTeachers, runOptimizer };
}