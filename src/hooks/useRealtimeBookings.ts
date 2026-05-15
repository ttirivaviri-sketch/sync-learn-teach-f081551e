import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { security } from '@/utils/security';
import { logger } from "@/utils/logger";

export interface BookingRequest {
  id: string;
  learner_id: string;
  tutor_id: string;
  tutor_subject_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: 'requested' | 'confirmed' | 'completed' | 'canceled';
  price: number;
  created_at: string;
  updated_at: string;
  learner_profile?: {
    full_name: string;
    email: string;
    study_level?: string;
  };
  tutor_profile?: {
    full_name: string;
    email: string;
  };
  tutor_subjects?: {
    subject: string;
    level: string;
  };
}

type SyncStatus = 'connecting' | 'synced' | 'degraded' | 'error';

const bookingTransitions: Record<BookingRequest['status'], BookingRequest['status'][]> = {
  requested: ['confirmed', 'canceled'],
  confirmed: ['completed', 'canceled'],
  completed: [],
  canceled: [],
};

export const useRealtimeBookings = (userType: 'learner' | 'tutor', userId?: string) => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const failureCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  const bookingSelect = `
    *,
    learner_profile:profiles!bookings_learner_id_fkey(full_name, email, study_level),
    tutor_profile:profiles!bookings_tutor_id_fkey(full_name, email),
    tutor_subjects(subject, level)
  `;

  const mergeBooking = useCallback((booking: BookingRequest) => {
    setBookings((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === booking.id);
      if (existingIndex === -1) {
        return [booking, ...prev];
      }
      const next = [...prev];
      next[existingIndex] = booking;
      return next;
    });
  }, []);

  const fetchBookingById = useCallback(async (bookingId: string) => {
    const { data, error } = await supabase
      .from('bookings')
      .select(bookingSelect)
      .eq('id', bookingId)
      .single();

    if (error) {
      logger.error('Error fetching booking details:', error);
      return null;
    }

    return data as BookingRequest;
  }, [bookingSelect]);

  const loadBookings = useCallback(async () => {
    if (!userId) return;

    try {
      setSyncStatus('connecting');

      const validation = await security.validateSession();
      if (!validation.valid) {
        logger.error('Invalid session for booking access');
        setSyncStatus('error');
        return;
      }

      const query = supabase
        .from('bookings')
        .select(bookingSelect);

      if (userType === 'learner') {
        query.eq('learner_id', userId);
      } else {
        query.eq('tutor_id', userId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        logger.error('Error loading bookings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load bookings',
          variant: 'destructive',
        });
        setSyncStatus('error');
        return;
      }

      setBookings((data || []) as BookingRequest[]);
      setLastSyncedAt(new Date());
      setSyncStatus('synced');
    } catch (error) {
      logger.error('Error in loadBookings:', error);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  }, [bookingSelect, toast, userId, userType]);

  // Load initial bookings
  useEffect(() => {
    if (!userId) return;
    loadBookings();
  }, [loadBookings, userId]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    let reconnectAttempts = 0;

    const channel = supabase
      .channel(`booking-changes-${userType}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: userType === 'learner' ? `learner_id=eq.${userId}` : `tutor_id=eq.${userId}`,
        },
        async (payload) => {
          logger.info('New booking received:', payload);

          const newBooking = await fetchBookingById(payload.new.id as string);
          if (!newBooking) return;

          mergeBooking(newBooking);
          setLastSyncedAt(new Date());
          setSyncStatus('synced');

          if (userType === 'tutor' && payload.new.status === 'requested') {
            toast({
              title: 'New Booking Request!',
              description: `${newBooking.learner_profile?.full_name} wants to book a session`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: userType === 'learner' ? `learner_id=eq.${userId}` : `tutor_id=eq.${userId}`,
        },
        async (payload) => {
          logger.info('Booking updated:', payload);

          const updatedBooking = await fetchBookingById(payload.new.id as string);
          if (!updatedBooking) return;

          mergeBooking(updatedBooking);
          setLastSyncedAt(new Date());
          setSyncStatus('synced');

          if (payload.old.status !== payload.new.status) {
            const statusMessages = {
              confirmed: 'Your booking has been confirmed!',
              completed: 'Session completed',
              canceled: 'Session cancelled',
            };

            const message = statusMessages[payload.new.status as keyof typeof statusMessages];
            if (message) {
              toast({
                title: 'Booking Update',
                description: message,
                variant: payload.new.status === 'canceled' ? 'destructive' : 'default',
              });
            }
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttempts = 0;
          setSyncStatus('synced');
          return;
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          reconnectAttempts += 1;
          setSyncStatus(reconnectAttempts >= 3 ? 'error' : 'degraded');
          await loadBookings();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBookingById, loadBookings, mergeBooking, toast, userId, userType]);

  const createBooking = async (bookingData: {
    tutor_id: string;
    tutor_subject_id: string;
    scheduled_at: string;
    duration_minutes: number;
    price: number;
  }) => {
    if (!userId) throw new Error('User not authenticated');

    const validation = await security.validateSession();
    if (!validation.valid) {
      throw new Error('Authentication required');
    }

    if (!security.checkRateLimit(`booking_${userId}`, 10, 60000)) {
      throw new Error('Too many booking requests. Please wait a moment.');
    }

    const roomName = `session-${crypto.randomUUID()}`;
    logger.info('🎯 Generated unique room name:', roomName);

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        learner_id: userId,
        room_name: roomName,
        ...bookingData,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating booking:', error);
      security.logSecurityEvent('booking_creation_failed', { error: error.message, userId });
      throw error;
    }

    logger.info('✅ Booking created with room:', { bookingId: data.id, roomName: data.room_name });
    security.logSecurityEvent('booking_created', { bookingId: data.id, userId, roomName: data.room_name });
    return data;
  };

  const updateBookingStatus = async (bookingId: string, status: BookingRequest['status']) => {
    const currentBooking = bookings.find((booking) => booking.id === bookingId);

    if (currentBooking) {
      const allowedNextStatus = bookingTransitions[currentBooking.status];
      if (!allowedNextStatus.includes(status)) {
        throw new Error(`Invalid status transition: ${currentBooking.status} -> ${status}`);
      }
    }

    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) {
      logger.error('Error updating booking status:', error);
      throw error;
    }
  };

  const getIncomingRequests = () => {
    return bookings.filter((booking) => booking.status === 'requested');
  };

  const getUpcomingSessions = () => {
    const now = new Date();
    return bookings.filter((booking) => {
      const isConfirmed = booking.status === 'confirmed';
      const sessionTime = new Date(booking.scheduled_at);
      const sessionEnd = new Date(sessionTime.getTime() + booking.duration_minutes * 60 * 1000);
      // Show sessions that haven't ended yet (including ones currently in progress)
      return isConfirmed && sessionEnd > now;
    });
  };

  return {
    bookings,
    loading,
    syncStatus,
    lastSyncedAt,
    createBooking,
    updateBookingStatus,
    getIncomingRequests,
    getUpcomingSessions,
    refreshBookings: loadBookings,
  };
};
