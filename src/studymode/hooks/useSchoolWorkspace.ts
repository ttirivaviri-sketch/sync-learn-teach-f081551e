import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { losFrom } from '@/integrations/supabase/learning-os-types';
import {
  WorkspaceInvitationSummary,
  WorkspaceMemberSummary,
  WorkspaceRole,
  WorkspaceType,
  assignMemberToCohort,
  createLearningWorkspace,
  createWorkspaceCohort,
  createWorkspaceInvitation,
  generateWorkspaceInvitationToken,
  loadWorkspaceOperations,
  setWorkspaceInvitationStatus,
  updateWorkspaceMemberRole,
} from '../lib/learningOps';

export interface LearningWorkspace {
  id: string;
  name: string;
  slug: string;
  workspaceType: WorkspaceType;
  schoolName?: string | null;
  role?: WorkspaceRole | null;
}

export interface WorkspaceCohort {
  id: string;
  name: string;
  gradeLevel?: string | null;
  curriculum?: string | null;
  subjectNames: string[];
}

export function useSchoolWorkspace() {
  const [workspace, setWorkspace] = useState<LearningWorkspace | null>(null);
  const [cohorts, setCohorts] = useState<WorkspaceCohort[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationSummary[]>([]);
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
        setWorkspace(null);
        setCohorts([]);
        setMembers([]);
        setInvitations([]);
        return;
      }

      const { data: memberships, error: membershipError } = await losFrom('learning_workspace_memberships')
        .select('workspace_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(10);

      if (membershipError) {
        logger.warn('[useSchoolWorkspace] membership lookup failed', membershipError);
      }

      const activeMembership = memberships?.[0] ?? null;

      if (activeMembership?.workspace_id) {
        const [workspaceResp, ops] = await Promise.all([
          losFrom('learning_workspaces')
            .select('id, name, slug, workspace_type, school_name')
            .eq('id', activeMembership.workspace_id)
            .maybeSingle(),
          loadWorkspaceOperations(activeMembership.workspace_id),
        ]);

        if (workspaceResp.error) {
          logger.warn('[useSchoolWorkspace] workspace lookup failed', workspaceResp.error);
        }

        const ws = workspaceResp.data;
        if (ws) {
          setWorkspace({
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            workspaceType: ws.workspace_type,
            schoolName: ws.school_name,
            role: activeMembership.role,
          });
          setCohorts(ops.cohorts);
          setMembers(ops.members);
          setInvitations(ops.invitations);
          return;
        }
      }

      const { data: profile, error: profileError } = await supabase
        .from('academic_profiles')
        .select('school_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        logger.warn('[useSchoolWorkspace] academic profile lookup failed', profileError);
      }

      const schoolName = (profile as { school_name?: string | null } | null)?.school_name ?? null;
      if (schoolName) {
        setWorkspace({
          id: 'personal-school-context',
          name: schoolName,
          slug: 'personal-school-context',
          workspaceType: 'personal',
          schoolName,
          role: 'student',
        });
      } else {
        setWorkspace(null);
      }

      setCohorts([]);
      setMembers([]);
      setInvitations([]);
    } catch (e) {
      logger.error('[useSchoolWorkspace] fatal', e);
      setError(e instanceof Error ? e.message : 'Failed to load workspace');
      setWorkspace(null);
      setCohorts([]);
      setMembers([]);
      setInvitations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createWorkspace = useCallback(async (args: { name: string; schoolName?: string | null; workspaceType?: WorkspaceType }) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    await createLearningWorkspace({ userId: user.id, ...args });
    await refresh();
  }, [refresh]);

  const createCohort = useCallback(async (args: { name: string; gradeLevel?: string | null; curriculum?: string | null; subjectNames?: string[] }) => {
    if (!workspace || workspace.id === 'personal-school-context') {
      throw new Error('Create or connect a real workspace first');
    }
    await createWorkspaceCohort({ workspaceId: workspace.id, ...args });
    await refresh();
  }, [refresh, workspace]);

  const inviteMember = useCallback(async (args: { email: string; role: WorkspaceRole; cohortIds?: string[]; inviteNote?: string | null }) => {
    if (!workspace || workspace.id === 'personal-school-context') {
      throw new Error('Create or connect a real workspace first');
    }
    await createWorkspaceInvitation({ workspaceId: workspace.id, ...args });
    await refresh();
  }, [refresh, workspace]);

  const changeMemberRole = useCallback(async (membershipId: string, role: WorkspaceRole) => {
    await updateWorkspaceMemberRole({ membershipId, role });
    await refresh();
  }, [refresh]);

  const assignMembershipToCohort = useCallback(async (args: { membershipId: string; userId: string; cohortId: string }) => {
    if (!workspace || workspace.id === 'personal-school-context') {
      throw new Error('Create or connect a real workspace first');
    }
    await assignMemberToCohort({ workspaceId: workspace.id, ...args });
    await refresh();
  }, [refresh, workspace]);

  const changeInvitationStatus = useCallback(async (invitationId: string, status: 'accepted' | 'revoked' | 'expired') => {
    await setWorkspaceInvitationStatus({ invitationId, status });
    await refresh();
  }, [refresh]);

  /** Generates a one-time invite token and returns a shareable join URL. */
  const issueInvitationLink = useCallback(async (invitationId: string) => {
    const token = await generateWorkspaceInvitationToken(invitationId);
    if (!token) throw new Error('Could not generate an invitation token');
    return `${window.location.origin}/invite/${token}`;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    workspace,
    cohorts,
    members,
    invitations,
    isLoading,
    error,
    refresh,
    createWorkspace,
    createCohort,
    inviteMember,
    issueInvitationLink,
    changeMemberRole,
    assignMembershipToCohort,
    changeInvitationStatus,
  };
}