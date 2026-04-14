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

// ── Dev-mode mock bookings ──────────────────────────────────────────────────
const isDevUserId = (id?: string) => id?.startsWith('dev-') ?? false;

function buildDevBookings(userType: 'learner' | 'tutor', userId: string): BookingRequest[] {
  const now = new Date();
  // Confirmed session starting in 5 minutes (joinable)
  const soonSession: BookingRequest = {
    id: 'dev-booking-001',
    learner_id: userType === 'learner' ? userId : 'dev-learner-peer',
    tutor_id: userType === 'tutor' ? userId : 'dev-tutor-peer',
    tutor_subject_id: 'dev-subject-math',
    scheduled_at: new Date(now.getTime() + 5 * 60_000).toISOString(),
    duration_minutes: 60,
    status: 'confirmed',
    price: 300,
    created_at: new Date(now.getTime() - 86400_000).toISOString(),
    updated_at: new Date(now.getTime() - 3600_000).toISOString(),
    learner_profile: { full_name: 'Sipho Mokoena', email: 'sipho@test.co.za', study_level: 'O Level' },
    tutor_profile: { full_name: 'Ms. Naledi Mbeki', email: 'naledi@test.co.za' },
    tutor_subjects: { subject: 'Mathematics', level: 'O Level' },
  };

  // Requested session (pending acceptance)
  const pendingSession: BookingRequest = {
    id: 'dev-booking-002',
    learner_id: userType === 'learner' ? userId : 'dev-learner-peer-2',
    tutor_id: userType === 'tutor' ? userId : 'dev-tutor-peer-2',
    tutor_subject_id: 'dev-subject-physics',
    scheduled_at: new Date(now.getTime() + 86400_000).toISOString(),
    duration_minutes: 45,
    status: 'requested',
    price: 200,
    created_at: new Date(now.getTime() - 3600_000).toISOString(),
    updated_at: new Date(now.getTime() - 3600_000).toISOString(),
    learner_profile: { full_name: 'Amara Dlamini', email: 'amara@test.co.za', study_level: 'A Level' },
    tutor_profile: { full_name: 'Mr. James Oduro', email: 'james@test.co.za' },
    tutor_subjects: { subject: 'Physics', level: 'A Level' },
  };

  // Completed session (history)
  const pastSession: BookingRequest = {
    id: 'dev-booking-003',
    learner_id: userType === 'learner' ? userId : 'dev-learner-peer-3',
    tutor_id: userType === 'tutor' ? userId : 'dev-tutor-peer-3',
    tutor_subject_id: 'dev-subject-english',
    scheduled_at: new Date(now.getTime() - 86400_000).toISOString(),
    duration_minutes: 60,
    status: 'completed',
    price: 250,
    created_at: new Date(now.getTime() - 2 * 86400_000).toISOString(),
    updated_at: new Date(now.getTime() - 86400_000).toISOString(),
    learner_profile: { full_name: 'Lerato Khumalo', email: 'lerato@test.co.za', study_level: 'IGCSE' },
    tutor_profile: { full_name: 'Dr. Priya Naidoo', email: 'priya@test.co.za' },
    tutor_subjects: { subject: 'English Literature', level: 'IGCSE' },
  };

  return [soonSession, pendingSession, pastSession];
}

// ─────────────────────────────────────────────────────────────────────────────
export const useRealtimeBookings = (userType: 'learner' | 'tutor', userId?: string) => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const { toast } = useToast();
  const devMode = isDevUserId(userId);
  const devInitRef = useRef(false);

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

      // Validate session before loading sensitive data
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

  // ── Dev-mode: seed mock bookings once ────────────────────────────────────
  useEffect(() => {
    if (!devMode || !userId || devInitRef.current) return;
    devInitRef.current = true;
    setBookings(buildDevBookings(userType, userId));
    setLoading(false);
    setSyncStatus('synced');
    setLastSyncedAt(new Date());
    logger.info('[DEV] Seeded mock bookings for', userType, userId);
  }, [devMode, userId, userType]);

  // Load initial bookings (real mode only)
  useEffect(() => {
    if (!userId || devMode) return;

    loadBookings();
  }, [loadBookings, userId, devMode]);

  // Set up real-time subscriptions with fallback resync (real mode only)
  useEffect(() => {
    if (!userId || devMode) return;

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

          // Always trigger a reload, even if realtime is unstable.
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

    // Dev-mode: create a mock booking locally
    if (devMode) {
      const mockBooking: BookingRequest = {
        id: `dev-booking-${Date.now()}`,
        learner_id: userType === 'learner' ? userId : bookingData.tutor_id,
        tutor_id: userType === 'tutor' ? userId : bookingData.tutor_id,
        tutor_subject_id: bookingData.tutor_subject_id,
        scheduled_at: bookingData.scheduled_at,
        duration_minutes: bookingData.duration_minutes,
        status: 'confirmed',
        price: bookingData.price,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tutor_profile: { full_name: 'Dev Tutor', email: 'dev@test.co.za' },
        learner_profile: { full_name: 'Dev Learner', email: 'dev@test.co.za' },
        tutor_subjects: { subject: 'Dev Subject', level: 'Test' },
      };
      setBookings((prev) => [mockBooking, ...prev]);
      toast({ title: 'Dev Mode', description: 'Mock booking created (local only).' });
      return mockBooking as unknown as Record<string, unknown>;
    }

    // Validate session and rate limit
    const validation = await security.validateSession();
    if (!validation.valid) {
      throw new Error('Authentication required');
    }

    if (!security.checkRateLimit(`booking_${userId}`, 10, 60000)) {
      throw new Error('Too many booking requests. Please wait a moment.');
    }

    // Generate unique room name for Jitsi session
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

    // Dev-mode: update locally only
    if (devMode) {
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status, updated_at: new Date().toISOString() } : b)),
      );
      logger.info('[DEV] Booking status updated locally:', bookingId, status);
      return;
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
    const upcoming = bookings.filter((booking) => {
      const isConfirmed = booking.status === 'confirmed';
      const sessionTime = new Date(booking.scheduled_at);
      const isUpcoming = sessionTime > now;

      logger.info('📅 Session check:', {
        id: booking.id,
        scheduled_at: booking.scheduled_at,
        sessionTime: sessionTime.toISOString(),
        now: now.toISOString(),
        isConfirmed,
        isUpcoming,
        willShow: isConfirmed && isUpcoming,
      });

      return isConfirmed && isUpcoming;
    });

    logger.info('📊 Total bookings:', bookings.length, 'Upcoming sessions:', upcoming.length);
    return upcoming;
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
