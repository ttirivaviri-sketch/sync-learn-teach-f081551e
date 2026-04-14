import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';


export interface Subscription {
  id: string;
  user_id: string;
  plan: string;
  trial_start: string | null;
  trial_end: string | null;
  status: string;
  created_at: string;
}

export const useSubscription = () => {
  const { isDevMode } = useDevMode();

  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      if (isDevMode) {
        // Return a synthetic active premium subscription
        return {
          id: 'dev-sub',
          user_id: 'dev-user',
          plan: 'premium',
          trial_start: null,
          trial_end: null,
          status: 'active',
          created_at: new Date().toISOString(),
        } as Subscription;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Subscription | null;
    },
  });

  const isTrialActive = () => {
    if (isDevMode) return false; // premium in dev mode, not trial
    const sub = subscription.data;
    if (!sub) return false;
    if (sub.status !== 'trial') return false;
    return sub.trial_end ? new Date(sub.trial_end) > new Date() : false;
  };

  const isPremium = () => {
    if (isDevMode) return true;
    const sub = subscription.data;
    if (!sub) return false;
    return sub.plan === 'premium' && sub.status === 'active';
  };

  const hasAccess = () => {
    if (isDevMode) return true;
    return isTrialActive() || isPremium();
  };

  return { subscription, isTrialActive, isPremium, hasAccess };
};
