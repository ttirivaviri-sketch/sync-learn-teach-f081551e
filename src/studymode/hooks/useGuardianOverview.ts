import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
import { losFrom } from '@/integrations/supabase/learning-os-types';

interface GuardianOverviewState {
  guardianEmail: string | null;
  latestReportWeek: string | null;
  latestReportSent: boolean;
  latestReportSentAt: string | null;
  openInterventionCount: number;
  highPriorityInterventionCount: number;
}

export function useGuardianOverview(userId?: string) {
  const [data, setData] = useState<GuardianOverviewState>({
    guardianEmail: null,
    latestReportWeek: null,
    latestReportSent: false,
    latestReportSentAt: null,
    openInterventionCount: 0,
    highPriorityInterventionCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [profileResp, reportResp, interventionsResp] = await Promise.all([
        supabase
          .from('academic_profiles')
          .select('guardian_email')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('analytics_reports')
          .select('week_start, email_sent, email_sent_at')
          .eq('user_id', userId)
          .eq('report_type', 'guardian_weekly')
          .order('week_start', { ascending: false })
          .limit(1)
          .maybeSingle(),
        losFrom('learning_intervention_queue')
          .select('priority, status')
          .eq('user_id', userId)
          .in('status', ['open', 'acknowledged']),
      ]);

      if (profileResp.error) throw profileResp.error;
      if (reportResp.error) throw reportResp.error;
      if (interventionsResp.error) throw interventionsResp.error;

      const interventions = interventionsResp.data ?? [];
      setData({
        guardianEmail: profileResp.data?.guardian_email ?? null,
        latestReportWeek: reportResp.data?.week_start ?? null,
        latestReportSent: !!reportResp.data?.email_sent,
        latestReportSentAt: reportResp.data?.email_sent_at ?? null,
        openInterventionCount: interventions.length,
        highPriorityInterventionCount: interventions.filter((item) => item.priority === 'high').length,
      });
    } catch (err) {
      logger.error('[useGuardianOverview] failed', err);
      setError(err instanceof Error ? err.message : 'Failed to load guardian overview');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...data,
    isLoading,
    error,
    refresh,
  };
}