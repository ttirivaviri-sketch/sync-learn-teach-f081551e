/**
 * useTeacherCommandCenter
 *
 * Loads workspace-level operational data for teachers, admins, and owners.
 * - Surfaces students at risk, cohort rollups, and recent intervention events
 * - Provides actions to update intervention queue items at scale
 * - Resolves the active workspace from membership context
 */
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { losFrom } from '@/integrations/supabase/learning-os-types';
import { logger } from '@/utils/logger';
import {
  TeacherCommandCenterSnapshot,
  WorkspaceRole,
  loadTeacherCommandCenter,
  updateInterventionQueueItem,
} from '../lib/learningOps';

interface UseTeacherCommandCenterResult {
  isLoading: boolean;
  error: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  role: WorkspaceRole | null;
  snapshot: TeacherCommandCenterSnapshot | null;
  refresh: () => Promise<void>;
  resolveIntervention: (interventionId: string, note?: string) => Promise<void>;
  acknowledgeIntervention: (interventionId: string, note?: string) => Promise<void>;
  dismissIntervention: (interventionId: string, note?: string) => Promise<void>;
  reassignIntervention: (interventionId: string, role: WorkspaceRole, note?: string) => Promise<void>;
}

const STAFF_ROLES: WorkspaceRole[] = ['owner', 'admin', 'teacher'];

export function useTeacherCommandCenter(): UseTeacherCommandCenterResult {
  const [snapshot, setSnapshot] = useState<TeacherCommandCenterSnapshot | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string | null>(null);
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSnapshot(null);
        setWorkspaceId(null);
        setRole(null);
        return;
      }

      const { data: memberships, error: membershipError } = await losFrom('learning_workspace_memberships')
        .select('workspace_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .in('role', STAFF_ROLES)
        .order('role', { ascending: true })
        .limit(1);

      if (membershipError) {
        logger.warn('[useTeacherCommandCenter] membership lookup failed', membershipError);
      }

      const membership = memberships?.[0] ?? null;
      if (!membership?.workspace_id) {
        setSnapshot(null);
        setWorkspaceId(null);
        setRole(null);
        return;
      }

      setWorkspaceId(membership.workspace_id);
      setRole(membership.role as WorkspaceRole);

      const data = await loadTeacherCommandCenter(membership.workspace_id);
      setWorkspaceName(data.workspaceName);
      setSnapshot(data);
    } catch (err) {
      logger.error('[useTeacherCommandCenter] fatal', err);
      setError(err instanceof Error ? err.message : 'Failed to load command center');
      setSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resolveIntervention = useCallback(
    async (interventionId: string, note?: string) => {
      await updateInterventionQueueItem({
        interventionId,
        status: 'resolved',
        note: note ?? 'Resolved from teacher command center.',
      });
      await refresh();
    },
    [refresh],
  );

  const acknowledgeIntervention = useCallback(
    async (interventionId: string, note?: string) => {
      await updateInterventionQueueItem({
        interventionId,
        status: 'acknowledged',
        note: note ?? 'Acknowledged from teacher command center.',
      });
      await refresh();
    },
    [refresh],
  );

  const dismissIntervention = useCallback(
    async (interventionId: string, note?: string) => {
      await updateInterventionQueueItem({
        interventionId,
        status: 'dismissed',
        note: note ?? 'Dismissed from teacher command center.',
      });
      await refresh();
    },
    [refresh],
  );

  const reassignIntervention = useCallback(
    async (interventionId: string, nextRole: WorkspaceRole, note?: string) => {
      await updateInterventionQueueItem({
        interventionId,
        assignedRole: nextRole,
        note: note ?? `Reassigned to ${nextRole} from teacher command center.`,
      });
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    isLoading,
    error,
    workspaceId,
    workspaceName,
    role,
    snapshot,
    refresh,
    resolveIntervention,
    acknowledgeIntervention,
    dismissIntervention,
    reassignIntervention,
  };
}