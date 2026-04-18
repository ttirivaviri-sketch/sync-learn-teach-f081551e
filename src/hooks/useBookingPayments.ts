import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { logger } from '@/utils/logger';

interface PaymentStatus {
  bookingId: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded' | 'none';
  paymentId?: string;
}

export const useBookingPayments = (bookingIds: string[]) => {
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PaymentStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingIds.length) {
      setPaymentStatuses({});
      setLoading(false);
      return;
    }

    const fetchPayments = async () => {
      try {
        const { data: payments, error } = await supabase
          .from('payments')
          .select('id, booking_id, status')
          .in('booking_id', bookingIds);

        if (error) {
          logger.error('Error fetching payments:', error);
          return;
        }

        const statusMap: Record<string, PaymentStatus> = {};

        bookingIds.forEach(id => {
          statusMap[id] = { bookingId: id, status: 'none' };
        });

        // Priority: succeeded > pending > failed > none
        const priorityOrder: Record<string, number> = { succeeded: 4, pending: 3, failed: 2, refunded: 1 };

        payments?.forEach(payment => {
          const existing = statusMap[payment.booking_id];
          const existingPriority = priorityOrder[existing?.status || 'none'] || 0;
          const newPriority = priorityOrder[payment.status] || 0;

          if (newPriority > existingPriority) {
            statusMap[payment.booking_id] = {
              bookingId: payment.booking_id,
              status: payment.status as PaymentStatus['status'],
              paymentId: payment.id,
            };
          }
        });

        setPaymentStatuses(statusMap);
      } catch (error) {
        logger.error('Error in fetchPayments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();

    const channel = supabase
      .channel('payment-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        async (payload) => {
          const bookingId = (payload.new as any)?.booking_id;
          if (bookingId && bookingIds.includes(bookingId)) {
            const newPayment = payload.new as any;
            setPaymentStatuses(prev => ({
              ...prev,
              [bookingId]: {
                bookingId,
                status: newPayment.status,
                paymentId: newPayment.id,
              },
            }));

            // Fire instant toast on payment status change
            if (newPayment.status === 'succeeded') {
              toast.success('Payment confirmed!', { description: 'Your session is now secured.' });
            } else if (newPayment.status === 'failed') {
              toast.error('Payment failed', { description: 'Please try again or use a different card.' });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [JSON.stringify(bookingIds)]);

  const needsPayment = (bookingId: string) => {
    const status = paymentStatuses[bookingId];
    return !status || status.status === 'none' || status.status === 'pending';
  };

  const isPaid = (bookingId: string) => {
    return paymentStatuses[bookingId]?.status === 'succeeded';
  };

  /**
   * Charge a booking using a saved payment method.
   * Routes to paystack-charge-token or payfast-charge-token based on the
   * saved method's provider.
   */
  const chargeWithSavedMethod = async (
    bookingId: string,
    paymentMethodId: string,
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const { data: method, error } = await supabase
        .from('saved_payment_methods')
        .select('provider')
        .eq('id', paymentMethodId)
        .single();
      if (error || !method) throw new Error('Card not found');

      const fnName = method.provider === 'paystack'
        ? 'paystack-charge-token'
        : 'payfast-charge-token';

      const res = await supabase.functions.invoke(fnName, {
        body: { bookingId, paymentMethodId },
      });
      if (res.error) throw new Error(res.error.message);
      return { success: !!res.data?.success, message: res.data?.message };
    } catch (err) {
      logger.error('chargeWithSavedMethod failed:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Charge failed',
      };
    }
  };

  return {
    paymentStatuses,
    loading,
    needsPayment,
    isPaid,
    chargeWithSavedMethod,
  };
};
