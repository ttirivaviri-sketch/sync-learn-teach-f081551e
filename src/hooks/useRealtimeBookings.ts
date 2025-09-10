import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  };
  tutor_subjects?: {
    subject: string;
    level: string;
  };
}

export const useRealtimeBookings = (userType: 'learner' | 'tutor', userId?: string) => {
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load initial bookings
  useEffect(() => {
    if (!userId) return;

    const loadBookings = async () => {
      try {
        const query = supabase
          .from('bookings')
          .select(`
            *,
            learner_profile:profiles!bookings_learner_id_fkey(full_name, email),
            tutor_subjects(subject, level)
          `);

        if (userType === 'learner') {
          query.eq('learner_id', userId);
        } else {
          query.eq('tutor_id', userId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
          console.error('Error loading bookings:', error);
          toast({
            title: 'Error',
            description: 'Failed to load bookings',
            variant: 'destructive',
          });
          return;
        }

        setBookings(data || []);
      } catch (error) {
        console.error('Error in loadBookings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadBookings();
  }, [userId, userType, toast]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('booking-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: userType === 'learner' ? `learner_id=eq.${userId}` : `tutor_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('New booking received:', payload);
          
          // Fetch the complete booking with relations
          const { data: newBooking } = await supabase
            .from('bookings')
            .select(`
              *,
              learner_profile:profiles!bookings_learner_id_fkey(full_name, email),
              tutor_subjects(subject, level)
            `)
            .eq('id', payload.new.id)
            .single();

          if (newBooking) {
            setBookings(prev => [newBooking, ...prev]);
            
            if (userType === 'tutor' && payload.new.status === 'requested') {
              toast({
                title: 'New Booking Request!',
                description: `${newBooking.learner_profile?.full_name} wants to book a session`,
              });
            }
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
          console.log('Booking updated:', payload);
          
          // Fetch the updated booking with relations
          const { data: updatedBooking } = await supabase
            .from('bookings')
            .select(`
              *,
              learner_profile:profiles!bookings_learner_id_fkey(full_name, email),
              tutor_subjects(subject, level)
            `)
            .eq('id', payload.new.id)
            .single();

          if (updatedBooking) {
            setBookings(prev => 
              prev.map(booking => 
                booking.id === payload.new.id ? updatedBooking : booking
              )
            );

            // Show notification for status changes
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, userType, toast]);

  const createBooking = async (bookingData: {
    tutor_id: string;
    tutor_subject_id: string;
    scheduled_at: string;
    duration_minutes: number;
    price: number;
  }) => {
    if (!userId) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        learner_id: userId,
        ...bookingData,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      throw error;
    }

    return data;
  };

  const updateBookingStatus = async (bookingId: string, status: BookingRequest['status']) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }
  };

  const getIncomingRequests = () => {
    return bookings.filter(booking => booking.status === 'requested');
  };

  const getUpcomingSessions = () => {
    return bookings.filter(booking => 
      booking.status === 'confirmed' && 
      new Date(booking.scheduled_at) > new Date()
    );
  };

  return {
    bookings,
    loading,
    createBooking,
    updateBookingStatus,
    getIncomingRequests,
    getUpcomingSessions,
  };
};