import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { analytics } from '@/utils/analytics';

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

export const useTutorData = (userLocation?: { latitude: number; longitude: number } | null) => {
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
      
      // Fetch tutor profiles and subjects directly
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'tutor');

      if (profilesError) {
        console.error('Error fetching tutors:', profilesError);
        throw profilesError;
      }

      const tutorsData = profilesData || [];

      // For authenticated users, get subject pricing data
      const { data: { session } } = await supabase.auth.getSession();
      let subjectsData: any[] = [];
      
      if (session?.user) {
        const { data, error } = await supabase
          .from('tutor_subjects')
          .select('*');
        
        if (!error) {
          subjectsData = data || [];
        }
      }

      // Transform the data to match expected format
      const tutorsWithSubjects = tutorsData.map(tutor => {
        const tutorSubjects = session?.user 
          ? subjectsData.filter(subject => subject.user_id === tutor.id)
          : [];

        const distance = userLocation && tutor.location_lat && tutor.location_lng
          ? calculateRealDistance(tutor.location_lat, tutor.location_lng, userLocation)
          : null;

        return {
          id: tutor.id,
          full_name: tutor.full_name || 'Anonymous',
          email: session?.user ? tutor.email : '',
          online_status: tutor.online_status || false,
          last_seen: tutor.last_seen || new Date().toISOString(),
          bio: tutor.bio,
          avatar_url: tutor.avatar_url,
          location_lat: tutor.location_lat,
          location_lng: tutor.location_lng,
          subjects: tutorSubjects,
          rating: 4.8,
          distance: distance ? `${distance.toFixed(1)}km` : 'Unknown',
          distanceValue: distance
        };
      });

      // Sort by distance if user location is available
      if (userLocation) {
        tutorsWithSubjects.sort((a, b) => {
          if (a.distanceValue === null) return 1;
          if (b.distanceValue === null) return -1;
          return a.distanceValue - b.distanceValue;
        });
      }

      setTutors(tutorsWithSubjects);

      // Cache fresh result
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: tutorsWithSubjects, ts: Date.now() }));
      } catch {}
      
      // Track analytics
      analytics.track('tutors_loaded', { 
        count: tutorsWithSubjects.length,
        hasLocation: !!userLocation,
        authenticated: !!session?.user
      });
    } catch (error) {
      console.error('Error fetching tutors:', error);
      analytics.error(error as Error, 'fetch_tutors_failed');
      toast({
        title: "Error",
        description: "Failed to load tutors. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat?: number, lng?: number, userLocation?: { latitude: number; longitude: number } | null): string => {
    if (!lat || !lng || !userLocation) return "Unknown";
    
    // Calculate real distance using Haversine formula
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat - userLocation.latitude) * Math.PI / 180;
    const dLon = (lng - userLocation.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    }
    return `${distance.toFixed(1)}km`;
  };

  const calculateRealDistance = (lat: number, lng: number, userLocation: { latitude: number; longitude: number }): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat - userLocation.latitude) * Math.PI / 180;
    const dLon = (lng - userLocation.longitude) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
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