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
  const subscription = useQuery({
    queryKey: ['subscription'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('subscriptions' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Subscription | null;
    },
  });

  const isTrialActive = () => {
    const sub = subscription.data;
    if (!sub) return false;
    if (sub.status !== 'trial') return false;
    return sub.trial_end ? new Date(sub.trial_end) > new Date() : false;
  };

  const isPremium = () => {
    const sub = subscription.data;
    if (!sub) return false;
    return sub.plan === 'premium' && sub.status === 'active';
  };

  const hasAccess = () => isTrialActive() || isPremium();

  return { subscription, isTrialActive, isPremium, hasAccess };
};
