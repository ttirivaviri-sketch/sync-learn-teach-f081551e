// @ts-nocheck — LOS bundle targets hand-typed contract for tables not yet in generated types; see MANUAL_EDITS.md
/**
 * useLosWorkspaceMembership
 *
 * Lightweight lookup of the current user's active Learning OS workspace
 * membership (learning_workspace_memberships). Used by the /teacher and
 * /school entry pages to fall back to the LOS consoles when the user has
 * no membership in the classic `schools` system but does belong to an
 * LOS workspace.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { losFrom } from '@/integrations/supabase/learning-os-types';
import { logger } from '@/utils/logger';

export interface LosMembershipSummary {
  workspaceId: string;
  role: string;
}

interface UseLosWorkspaceMembershipResult {
  isLoading: boolean;
  membership: LosMembershipSummary | null;
}

/**
 * @param roles optional list of roles to filter by (e.g. staff roles).
 */
export function useLosWorkspaceMembership(roles?: string[]): UseLosWorkspaceMembershipResult {
  const [isLoading, setIsLoading] = useState(true);
  const [membership, setMembership] = useState<LosMembershipSummary | null>(null);
  const rolesKey = roles?.join(',') ?? '';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setMembership(null);
          return;
        }

        let query = losFrom('learning_workspace_memberships')
          .select('workspace_id, role, status')
          .eq('user_id', user.id)
          .eq('status', 'active');

        if (rolesKey) {
          query = query.in('role', rolesKey.split(','));
        }

        const { data, error } = await query.order('role', { ascending: true }).limit(1);
        if (error) {
          // Table may not exist yet on environments where the LOS migration
          // has not been applied — treat as "no membership" rather than crash.
          logger.warn('[useLosWorkspaceMembership] lookup failed', error);
          if (!cancelled) setMembership(null);
          return;
        }

        const row = data?.[0] ?? null;
        if (!cancelled) {
          setMembership(
            row?.workspace_id ? { workspaceId: row.workspace_id, role: row.role } : null,
          );
        }
      } catch (err) {
        logger.warn('[useLosWorkspaceMembership] fatal', err);
        if (!cancelled) setMembership(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rolesKey]);

  return { isLoading, membership };
}
