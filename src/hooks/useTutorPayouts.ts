/**
 * useTutorPayouts — React hook for the Real-time Payout System
 *
 * Provides:
 *   - processPayout(): trigger payout for a completed session
 *   - wallet: current wallet balance and stats
 *   - payouts: list of recent payouts
 *   - isProcessing: loading state
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from "@/utils/logger";
import type {
  PayoutRequest,
  PayoutResponse,
  TutorWallet,
  TutorPayout,
} from '@/sail/types/edgeFunctions';

interface UseTutorPayoutsReturn {
  wallet: TutorWallet | null;
  payouts: TutorPayout[];
  isProcessing: boolean;
  isLoading: boolean;
  error: string | null;
  processPayout: (sessionId: string) => Promise<PayoutResponse | null>;
  refreshPayouts: () => Promise<void>;
  totalEarned: number;
  pendingBalance: number;
  commissionTier: string;
}

export function useTutorPayouts(tutorId?: string): UseTutorPayoutsReturn {
  const [wallet, setWallet] = useState<TutorWallet | null>(null);
  const [payouts, setPayouts] = useState<TutorPayout[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch wallet and payouts
  const refreshPayouts = useCallback(async () => {
    if (!tutorId) return;
    setIsLoading(true);

    try {
      // Fetch wallet — table may not exist yet (migration pending)
      const { data: walletData, error: walletError } = await (supabase as any)
        .from('tutor_wallets')
        .select('*')
        .eq('tutor_id', tutorId)
        .maybeSingle();

      if (walletError) {
        // Silently ignore "relation does not exist" for unmigrated DBs
        if (!walletError.message?.includes('does not exist')) {
          logger.warn('Wallet fetch error:', walletError.message);
        }
      } else if (walletData) {
        setWallet(walletData as unknown as TutorWallet);
      }

      // Fetch recent payouts — table may not exist yet
      const { data: payoutData, error: payoutError } = await (supabase as any)
        .from('tutor_payouts')
        .select('*')
        .eq('tutor_id', tutorId)
        .order('processed_at', { ascending: false })
        .limit(50);

      if (payoutError) {
        if (!payoutError.message?.includes('does not exist')) {
          logger.warn('Payouts fetch error:', payoutError.message);
        }
      } else if (payoutData) {
        setPayouts(payoutData as unknown as TutorPayout[]);
      }
    } catch (err) {
      // Non-critical: payout tables may not be deployed yet
      logger.warn('Error fetching payout data (tables may not exist yet):', err);
    } finally {
      setIsLoading(false);
    }
  }, [tutorId]);

  // Process a payout for a completed session
  const processPayout = useCallback(
    async (sessionId: string): Promise<PayoutResponse | null> => {
      if (!tutorId) {
        setError('No tutor ID provided');
        return null;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          throw new Error('Not authenticated');
        }

        const response = await supabase.functions.invoke('process-tutor-payout', {
          body: {
            session_id: sessionId,
            tutor_id: tutorId,
          } as PayoutRequest,
        });

        if (response.error) {
          throw new Error(response.error.message || 'Payout processing failed');
        }

        const result = response.data as PayoutResponse;

        if (result.status === 'rejected') {
          setError(result.reason || 'Payout rejected');
        } else {
          // Refresh data after successful payout
          await refreshPayouts();
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        logger.error('Payout processing error:', err);
        return null;
      } finally {
        setIsProcessing(false);
      }
    },
    [tutorId, refreshPayouts]
  );

  // Load initial data
  useEffect(() => {
    if (tutorId) {
      refreshPayouts();
    }
  }, [tutorId, refreshPayouts]);

  // Real-time subscription for wallet changes
  useEffect(() => {
    if (!tutorId) return;

    const channel = supabase
      .channel(`tutor-wallet-${tutorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tutor_wallets',
          filter: `tutor_id=eq.${tutorId}`,
        },
        () => {
          refreshPayouts();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tutor_payouts',
          filter: `tutor_id=eq.${tutorId}`,
        },
        () => {
          refreshPayouts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutorId, refreshPayouts]);

  // Derived values
  const totalEarned = useMemo(
    () => wallet?.total_earned ?? 0,
    [wallet]
  );

  const pendingBalance = useMemo(
    () => wallet?.balance ?? 0,
    [wallet]
  );

  const commissionTier = useMemo(() => {
    const completedCount = payouts.length;
    if (completedCount >= 100) return 'enterprise';
    if (completedCount >= 50) return 'premium';
    if (completedCount >= 10) return 'verified';
    return 'standard';
  }, [payouts]);

  return {
    wallet,
    payouts,
    isProcessing,
    isLoading,
    error,
    processPayout,
    refreshPayouts,
    totalEarned,
    pendingBalance,
    commissionTier,
  };
}
