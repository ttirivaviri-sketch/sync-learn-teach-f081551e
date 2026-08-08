import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from '@/hooks/useSubscription';

export type StudyAccessState = 'loading' | 'trial_task' | 'active' | 'pending_review' | 'locked';

export interface ManualPaymentRequest {
  id: string;
  user_id: string;
  method: 'deposit' | 'eft' | 'ecocash';
  reference: string;
  amount: number;
  currency: string;
  proof_path: string | null;
  access_days: number;
  status: 'pending' | 'approved' | 'rejected';
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

/**
 * Single source of truth for whether a learner may use Study Mode.
 *
 * trial_task     → no paid access yet, but the free daily task hasn't been used
 * active         → paid/trial access is valid
 * pending_review → payment proof submitted, waiting for admin confirmation
 * locked         → free task used and no confirmed payment
 */
export function useStudyAccess() {
  const { subscription, hasAccess } = useSubscription();

  const latestRequest = useQuery({
    queryKey: ['manual-payment-request', 'latest'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from('manual_payment_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ManualPaymentRequest | null;
    },
  });

  const taskCount = useQuery({
    queryKey: ['daily-tasks', 'lifetime-count'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { count, error } = await supabase
        .from('daily_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const sub = subscription.data as (null | { access_until?: string | null });
  const manualActive = !!sub?.access_until && new Date(sub.access_until) > new Date();

  const isLoading = subscription.isLoading || latestRequest.isLoading || taskCount.isLoading;

  let state: StudyAccessState = 'locked';
  if (isLoading) {
    state = 'loading';
  } else if (manualActive || hasAccess()) {
    state = 'active';
  } else if (latestRequest.data?.status === 'pending') {
    state = 'pending_review';
  } else if ((taskCount.data ?? 0) < 1) {
    state = 'trial_task';
  }

  return {
    state,
    isLoading,
    /** Study Mode is usable right now (paid, on trial, or on the free task). */
    canUseStudyMode: state === 'active' || state === 'trial_task',
    freeTasksRemaining: state === 'trial_task' ? 1 : 0,
    accessUntil: sub?.access_until ?? null,
    latestRequest: latestRequest.data ?? null,
    refetch: () => {
      subscription.refetch();
      latestRequest.refetch();
      taskCount.refetch();
    },
  };
}
