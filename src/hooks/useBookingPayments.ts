import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

        payments?.forEach(payment => {
          statusMap[payment.booking_id] = {
            bookingId: payment.booking_id,
            status: payment.status as PaymentStatus['status'],
            paymentId: payment.id,
          };
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

  return {
    paymentStatuses,
    loading,
    needsPayment,
    isPaid,
  };
};
