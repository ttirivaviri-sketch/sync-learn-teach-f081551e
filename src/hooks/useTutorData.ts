import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TutorSubject {
  id: string;
  subject: string;
  level: string;
  hourly_rate: number;
}

export interface TutorProfile {
  id: string;
  full_name: string;
  email: string;
  online_status: boolean;
  last_seen: string;
  bio?: string;
  avatar_url?: string;
  location_lat?: number;
  location_lng?: number;
  subjects: TutorSubject[];
  rating?: number;
  distance?: string;
}

export const useTutorData = () => {
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchTutors = async () => {
    try {
      const cacheKey = 'tutors_cache_v1';
      const cacheTTL = 2 * 60 * 1000; // 2 minutes
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        try {
          const { data, ts } = JSON.parse(cached);
          if (Date.now() - ts < cacheTTL && Array.isArray(data)) {
            setTutors(data);
            setLoading(false); // show cached immediately
          }
        } catch {}
      }

      setLoading(true);
      
      // Fetch tutors with their subjects
      const { data: tutorsData, error: tutorsError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          online_status,
          last_seen,
          bio,
          avatar_url,
          location_lat,
          location_lng
        `)
        .eq('user_type', 'tutor')
        .order('online_status', { ascending: false })
        .order('last_seen', { ascending: false, nullsFirst: false });

      if (tutorsError) throw tutorsError;

      // Fetch all tutor subjects
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('tutor_subjects')
        .select('*');

      if (subjectsError) throw subjectsError;

      // Combine tutor data with their subjects
      const tutorsWithSubjects = tutorsData?.map(tutor => ({
        ...tutor,
        subjects: subjectsData?.filter(subject => subject.user_id === tutor.id) || [],
        rating: 4.8, // Mock rating for now
        distance: calculateDistance(tutor.location_lat, tutor.location_lng)
      })) || [];

      setTutors(tutorsWithSubjects);

      // Cache fresh result
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: tutorsWithSubjects, ts: Date.now() }));
      } catch {}
    } catch (error) {
      console.error('Error fetching tutors:', error);
      toast({
        title: "Error",
        description: "Failed to load tutors. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat?: number, lng?: number): string => {
    // Simple mock distance calculation - in real app would use geolocation
    if (!lat || !lng) return "Unknown";
    return `${(Math.random() * 5 + 0.5).toFixed(1)} km`;
  };

  const updateOnlineStatus = async (isOnline: boolean) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          online_status: isOnline,
          last_seen: new Date().toISOString()
        })
        .eq('id', (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      // Refresh tutors data to reflect the change
      fetchTutors();

      toast({
        title: isOnline ? "You're now online" : "You're now offline",
        description: isOnline ? "Students can see you're available" : "Students won't see you as available",
      });
    } catch (error) {
      console.error('Error updating online status:', error);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const addTutorSubject = async (subject: string, level: string, hourlyRate: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('tutor_subjects')
        .insert({
          user_id: user.id,
          subject,
          level,
          hourly_rate: hourlyRate
        });

      if (error) throw error;

      toast({
        title: "Subject added",
        description: `${subject} (${level}) added to your profile`,
      });

      // Refresh tutors data
      fetchTutors();
    } catch (error) {
      console.error('Error adding subject:', error);
      toast({
        title: "Error",
        description: "Failed to add subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  const removeTutorSubject = async (subjectId: string) => {
    try {
      const { error } = await supabase
        .from('tutor_subjects')
        .delete()
        .eq('id', subjectId);

      if (error) throw error;

      toast({
        title: "Subject removed",
        description: "Subject has been removed from your profile",
      });

      // Refresh tutors data
      fetchTutors();
    } catch (error) {
      console.error('Error removing subject:', error);
      toast({
        title: "Error",
        description: "Failed to remove subject. Please try again.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchTutors();

    // Set up real-time subscription for tutor status changes
    const channel = supabase
      .channel('tutor-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: 'user_type=eq.tutor'
        },
        (payload) => {
          setTutors(prev => prev.map(tutor => 
            tutor.id === payload.new.id 
              ? { ...tutor, ...payload.new }
              : tutor
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tutor_subjects'
        },
        () => {
          // Refresh data when new subjects are added
          fetchTutors();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'tutor_subjects'
        },
        () => {
          // Refresh data when subjects are removed
          fetchTutors();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    tutors,
    loading,
    updateOnlineStatus,
    addTutorSubject,
    removeTutorSubject,
    refreshTutors: fetchTutors
  };
};