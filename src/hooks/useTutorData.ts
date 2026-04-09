import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { analytics } from '@/utils/analytics';
import { logger } from "@/utils/logger";

export interface TutorSubject {
  id: string;
  subject: string;
  level: string;
  hourly_rate: number;
}

export interface TutorQualification {
  id: string;
  qualification_type: string;
  institution: string;
  year_obtained?: number;
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
  qualifications: TutorQualification[];
  rating: number;
  totalReviews: number;
  distance?: string;
  confirmedBookingsCount: number;
}

interface UseTutorDataOptions {
  subjectFilter?: string;
  searchQuery?: string;
  studyLevel?: string;
  maxActiveBookings?: number;
}

export const useTutorData = (
  userLocation?: { latitude: number; longitude: number } | null,
  options?: UseTutorDataOptions
) => {
  const [tutors, setTutors] = useState<TutorProfile[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const maxActive = options?.maxActiveBookings ?? 10;

  const fetchTutors = async () => {
    try {
      setLoading(true);

      // Fetch tutor profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'tutor');

      if (profilesError) {
        logger.error('Error fetching tutors:', profilesError);
        throw profilesError;
      }

      const tutorsData = profilesData || [];

      // Fetch subjects, reviews, and active booking counts in parallel
      const { data: { session } } = await supabase.auth.getSession();

      const [subjectsResult, reviewsResult, activeBookingsResult, qualificationsResult] = await Promise.all([
        supabase.from('tutor_subjects').select('*'),
        supabase.from('reviews').select('reviewed_id, rating'),
        supabase
          .from('bookings')
          .select('tutor_id')
          .in('status', ['requested', 'confirmed']),
        supabase.from('qualifications').select('id, user_id, qualification_type, institution, year_obtained'),
      ]);

      const subjectsData = subjectsResult.data || [];
      const reviewsData = reviewsResult.data || [];
      const activeBookingsData = activeBookingsResult.data || [];
      const qualificationsData = qualificationsResult.data || [];

      // Build unique subjects list
      const uniqueSubjects = [...new Set(subjectsData.map(s => s.subject))].sort();
      setAllSubjects(uniqueSubjects);

      // Build ratings map: tutor_id -> { total, count }
      const ratingsMap = new Map<string, { total: number; count: number }>();
      for (const review of reviewsData) {
        const existing = ratingsMap.get(review.reviewed_id) || { total: 0, count: 0 };
        existing.total += review.rating;
        existing.count += 1;
        ratingsMap.set(review.reviewed_id, existing);
      }

      // Build active bookings count map
      const bookingsCountMap = new Map<string, number>();
      for (const booking of activeBookingsData) {
        bookingsCountMap.set(booking.tutor_id, (bookingsCountMap.get(booking.tutor_id) || 0) + 1);
      }

      // Transform tutor data
      const tutorsWithSubjects = tutorsData.map(tutor => {
        const tutorSubjects = subjectsData.filter(s => s.user_id === tutor.id);
        const tutorQualifications = qualificationsData.filter(q => q.user_id === tutor.id);
        const ratingInfo = ratingsMap.get(tutor.id);
        const avgRating = ratingInfo ? Math.round((ratingInfo.total / ratingInfo.count) * 10) / 10 : 0;
        const totalReviews = ratingInfo?.count || 0;
        const confirmedBookingsCount = bookingsCountMap.get(tutor.id) || 0;

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
          qualifications: tutorQualifications,
          rating: avgRating,
          totalReviews,
          confirmedBookingsCount,
          distance: distance ? `${distance.toFixed(1)}km` : 'Unknown',
          distanceValue: distance,
        };
      });

      // Filter: only tutors who have at least one subject
      let filtered = tutorsWithSubjects.filter(t => t.subjects.length > 0);

      // Filter: exclude overbooked tutors
      filtered = filtered.filter(t => t.confirmedBookingsCount < maxActive);

      // Filter by subject if provided
      if (options?.subjectFilter) {
        const subjectLower = options.subjectFilter.toLowerCase();
        filtered = filtered.filter(t =>
          t.subjects.some(s => s.subject.toLowerCase().includes(subjectLower))
        );
      }

      // Filter by study level — only show tutors who teach at the learner's level
      if (options?.studyLevel) {
        const levelLower = options.studyLevel.toLowerCase();
        filtered = filtered.filter(t =>
          t.subjects.some(s => s.level.toLowerCase().includes(levelLower))
        );
      }

      // Filter by search query (name or subject)
      if (options?.searchQuery) {
        const queryLower = options.searchQuery.toLowerCase();
        filtered = filtered.filter(t =>
          t.full_name.toLowerCase().includes(queryLower) ||
          t.subjects.some(s => s.subject.toLowerCase().includes(queryLower))
        );
      }

      // Sort: highest rating first, then by distance
      filtered.sort((a, b) => {
        // Primary: rating descending
        if (b.rating !== a.rating) return b.rating - a.rating;
        // Secondary: distance ascending (if available)
        if (userLocation) {
          if (a.distanceValue === null) return 1;
          if (b.distanceValue === null) return -1;
          return a.distanceValue - b.distanceValue;
        }
        return 0;
      });

      setTutors(filtered);

      analytics.track('tutors_loaded', {
        count: filtered.length,
        hasLocation: !!userLocation,
        authenticated: !!session?.user,
        subjectFilter: options?.subjectFilter || null,
      });
    } catch (error) {
      logger.error('Error fetching tutors:', error);
      analytics.error(error as Error, 'fetch_tutors_failed');
      toast({
        title: 'Error',
        description: 'Failed to load tutors. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateRealDistance = (
    lat: number, lng: number,
    userLocation: { latitude: number; longitude: number }
  ): number => {
    const R = 6371;
    const dLat = (lat - userLocation.latitude) * Math.PI / 180;
    const dLon = (lng - userLocation.longitude) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(userLocation.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Debounced wrapper — collapses multiple rapid realtime events into one fetch
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetch = () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { fetchTutors(); }, 800);
  };

  useEffect(() => {
    fetchTutors();

    const channel = supabase
      .channel('tutor-status-changes')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'profiles',
        filter: 'user_type=eq.tutor',
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tutor_subjects',
      }, debouncedFetch)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'reviews',
      }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      supabase.removeChannel(channel);
    };
  }, [options?.subjectFilter, options?.searchQuery, options?.studyLevel]);

  return {
    tutors,
    allSubjects,
    loading,
    refreshTutors: fetchTutors,
  };
};
