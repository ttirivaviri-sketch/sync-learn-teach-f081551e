/**
 * usePlanProposals
 *
 * Phase 3.2 hook. Loads study plan proposals staged by
 * `run_study_plan_optimizer` and exposes accept/dismiss actions.
 */
import { useCallback, useEffect, useState } from 'react';
import { logger } from '@/utils/logger';
import {
  PlanProposalSummary,
  loadPlanProposals,
  updatePlanProposalStatus,
} from '../lib/learningOps';

interface Args {
  workspaceId?: string | null;
  userId?: string | null;
  status?: 'proposed' | 'accepted' | 'dismissed' | 'applied';
}

export function usePlanProposals({ workspaceId = null, userId = null, status = 'proposed' }: Args) {
  const [proposals, setProposals] = useState<PlanProposalSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await loadPlanProposals({ workspaceId, userId, status, limit: 100 });
      setProposals(rows);
    } catch (err) {
      logger.warn('[usePlanProposals] load failed', err);
      setProposals([]);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, userId, status]);

  const accept = useCallback(async (proposalId: string) => {
    setBusyId(proposalId);
    try {
      await updatePlanProposalStatus({ proposalId, status: 'accepted' });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  const dismiss = useCallback(async (proposalId: string) => {
    setBusyId(proposalId);
    try {
      await updatePlanProposalStatus({ proposalId, status: 'dismissed' });
      await refresh();
    } finally {
      setBusyId(null);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { proposals, isLoading, busyId, refresh, accept, dismiss };
}
