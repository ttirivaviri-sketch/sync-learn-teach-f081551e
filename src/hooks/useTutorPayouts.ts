/**
 * useTutorPayouts — Tutor wallet & payout history.
 *
 * Derives wallet balance and earnings from existing tables:
 *   - `bookings` (status='completed') for gross earnings
 *   - `payout_requests` for withdrawals (locks any pending/approved/paid amounts)
 *
 * Real-time updates: subscribes to bookings and payout_requests for the tutor.
 *
 * processPayout(sessionId) still invokes the `process-tutor-payout` edge
 * function which performs the authoritative payout transaction server-side.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/utils/logger';
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

  const refreshPayouts = useCallback(async () => {
    if (!tutorId) return;
    setIsLoading(true);

    try {
      const [bookingsRes, payoutsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, price, status, scheduled_at')
          .eq('tutor_id', tutorId)
          .eq('status', 'completed'),
        supabase
          .from('payout_requests')
          .select('id, amount, currency, status, created_at, processed_at')
          .eq('tutor_id', tutorId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (bookingsRes.error) logger.warn('Bookings fetch error:', bookingsRes.error.message);
      if (payoutsRes.error) logger.warn('Payouts fetch error:', payoutsRes.error.message);

      const completed = bookingsRes.data || [];
      const payoutRequests = payoutsRes.data || [];

      const totalEarned = completed.reduce((sum, b) => sum + Number(b.price || 0), 0);
      const lockedOrPaid = payoutRequests
        .filter(p => ['pending', 'approved', 'paid'].includes(p.status))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);

      const balance = Math.max(0, totalEarned - lockedOrPaid);

      setWallet({
        tutor_id: tutorId,
        balance,
        total_earned: totalEarned,
        currency: payoutRequests[0]?.currency || 'ZAR',
        updated_at: new Date().toISOString(),
      } as unknown as TutorWallet);

      setPayouts(
        payoutRequests.map(p => ({
          id: p.id,
          tutor_id: tutorId,
          amount: Number(p.amount),
          currency: p.currency,
          status: p.status,
          processed_at: p.processed_at,
          created_at: p.created_at,
        })) as unknown as TutorPayout[],
      );
    } catch (err) {
      logger.warn('Error deriving tutor payout data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tutorId]);

  const processPayout = useCallback(
    async (sessionId: string): Promise<PayoutResponse | null> => {
      if (!tutorId) {
        setError('No tutor ID provided');
        return null;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');

        const response = await supabase.functions.invoke('process-tutor-payout', {
          body: { session_id: sessionId, tutor_id: tutorId } as PayoutRequest,
        });

        if (response.error) throw new Error(response.error.message || 'Payout processing failed');

        const result = response.data as PayoutResponse;
        if (result.status === 'rejected') {
          setError(result.reason || 'Payout rejected');
        } else {
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
    [tutorId, refreshPayouts],
  );

  useEffect(() => {
    if (tutorId) refreshPayouts();
  }, [tutorId, refreshPayouts]);

  // Real-time: refresh when a completed booking or payout_request changes.
  useEffect(() => {
    if (!tutorId) return;

    const channel = supabase
      .channel(`tutor-wallet-${tutorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `tutor_id=eq.${tutorId}` },
        () => refreshPayouts(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payout_requests', filter: `tutor_id=eq.${tutorId}` },
        () => refreshPayouts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutorId, refreshPayouts]);

  const totalEarned = useMemo(() => wallet?.total_earned ?? 0, [wallet]);
  const pendingBalance = useMemo(() => wallet?.balance ?? 0, [wallet]);

  const commissionTier = useMemo(() => {
    const paidCount = payouts.filter(p => (p as any).status === 'paid').length;
    if (paidCount >= 100) return 'enterprise';
    if (paidCount >= 50) return 'premium';
    if (paidCount >= 10) return 'verified';
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
