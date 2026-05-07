import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
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
  /** Should already be debounced by the caller (use useDebouncedValue). */
  searchQuery?: string;
  studyLevel?: string;
  maxActiveBookings?: number;
  /** Learner's selected subjects from academic profile */
  subjects?: string[];
  /** Learner's grade (e.g., "Form 4", "Grade 12", "A-Level") */
  grade?: string;
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

  // Tracks the in-flight fetch so we can abort it if a new one starts or the
  // component unmounts. Avoids stale `setTutors` calls and racey overlapping fetches.
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchTutors = useCallback(async () => {
    // Cancel any in-flight fetch
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_type', 'tutor')
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;
      if (profilesError) {
        logger.error('Error fetching tutors:', profilesError);
        throw profilesError;
      }

      const tutorsData = profilesData || [];

      const { data: { session } } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;

      const [subjectsResult, reviewsResult, activeBookingsResult, qualificationsResult] = await Promise.all([
        supabase.from('tutor_subjects').select('*').abortSignal(controller.signal),
        supabase.from('reviews').select('reviewed_id, rating').abortSignal(controller.signal),
        supabase
          .from('bookings')
          .select('tutor_id')
          .in('status', ['requested', 'confirmed'])
          .abortSignal(controller.signal),
        supabase
          .from('qualifications')
          .select('id, user_id, qualification_type, institution, year_obtained')
          .abortSignal(controller.signal),
      ]);

      if (controller.signal.aborted) return;

      const subjectsData = subjectsResult.data || [];
      const reviewsData = reviewsResult.data || [];
      const activeBookingsData = activeBookingsResult.data || [];
      const qualificationsData = qualificationsResult.data || [];

      const uniqueSubjects = [...new Set(subjectsData.map(s => s.subject))].sort();
      if (mountedRef.current) setAllSubjects(uniqueSubjects);

      const ratingsMap = new Map<string, { total: number; count: number }>();
      for (const review of reviewsData) {
        const existing = ratingsMap.get(review.reviewed_id) || { total: 0, count: 0 };
        existing.total += review.rating;
        existing.count += 1;
        ratingsMap.set(review.reviewed_id, existing);
      }

      const bookingsCountMap = new Map<string, number>();
      for (const booking of activeBookingsData) {
        bookingsCountMap.set(booking.tutor_id, (bookingsCountMap.get(booking.tutor_id) || 0) + 1);
      }

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

      let filtered = tutorsWithSubjects.filter(t => t.subjects.length > 0);
      // Don't hide fully-booked tutors anymore — surface them with a flag instead.
      // (consumers can read confirmedBookingsCount >= maxActive to render a "Fully booked" pill)

      // Match learner subjects from academic profile (case-insensitive exact)
      if (options?.subjects && options.subjects.length > 0) {
        const wanted = options.subjects.map(s => s.toLowerCase().trim());
        filtered = filtered.filter(t =>
          t.subjects.some(s => wanted.includes(s.subject.toLowerCase().trim()))
        );
      } else if (options?.subjectFilter) {
        const subjectLower = options.subjectFilter.toLowerCase();
        filtered = filtered.filter(t =>
          t.subjects.some(s => s.subject.toLowerCase().includes(subjectLower))
        );
      }

      // Grade matching: bidirectional Form ↔ Grade ↔ A-Level mapping
      if (options?.grade) {
        const gradeSynonyms: Record<string, string[]> = {
          'form 1': ['grade 7', 'grade 7-9', 'junior high'],
          'form 2': ['grade 8', 'grade 7-9', 'junior high'],
          'form 3': ['grade 9', 'grade 7-9', 'junior high'],
          'form 4': ['grade 10', 'grade 11', 'grade 10-12', 'o-level', 'senior high'],
          'form 5': ['grade 11', 'grade 12', 'grade 10-12', 'a-level', 'senior high'],
          'form 6': ['grade 12', 'a-level', 'grade 10-12', 'senior high'],
          'a-level': ['form 5', 'form 6', 'grade 12', 'grade 10-12', 'senior high'],
          'o-level': ['form 4', 'grade 10', 'grade 11', 'grade 10-12', 'senior high'],
          'grade 12': ['form 5', 'form 6', 'a-level', 'grade 10-12', 'senior high'],
          'grade 11': ['form 4', 'form 5', 'grade 10-12', 'senior high'],
          'grade 10': ['form 4', 'grade 10-12', 'senior high'],
        };
        const learnerGrade = options.grade.toLowerCase().trim();
        const acceptable = new Set([learnerGrade, ...(gradeSynonyms[learnerGrade] || [])]);
        filtered = filtered.filter(t =>
          t.subjects.some(s => {
            const lvl = s.level.toLowerCase().trim();
            return acceptable.has(lvl) || [...acceptable].some(a => lvl.includes(a) || a.includes(lvl));
          })
        );
      } else if (options?.studyLevel) {
        const levelMap: Record<string, string[]> = {
          junior_primary: ['grade 1-3'],
          senior_primary: ['grade 4-6'],
          junior_high: ['grade 7-9'],
          senior_high: ['grade 10-12'],
          tertiary: ['university', 'adult education'],
        };
        const matchLevels = levelMap[options.studyLevel.toLowerCase()] || [];
        if (matchLevels.length > 0) {
          filtered = filtered.filter(t =>
            t.subjects.some(s => matchLevels.includes(s.level.toLowerCase()))
          );
        }
      }

      if (options?.searchQuery) {
        const queryLower = options.searchQuery.toLowerCase();
        filtered = filtered.filter(t =>
          t.full_name.toLowerCase().includes(queryLower) ||
          t.subjects.some(s => s.subject.toLowerCase().includes(queryLower))
        );
      }

      filtered.sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating;
        if (userLocation) {
          if (a.distanceValue === null) return 1;
          if (b.distanceValue === null) return -1;
          return a.distanceValue - b.distanceValue;
        }
        return 0;
      });

      if (controller.signal.aborted || !mountedRef.current) return;
      setTutors(filtered);

      analytics.track('tutors_loaded', {
        count: filtered.length,
        hasLocation: !!userLocation,
        authenticated: !!session?.user,
        subjectFilter: options?.subjectFilter || null,
      });
    } catch (error: any) {
      // Aborts surface as DOMException / "AbortError" — silently ignore.
      if (controller.signal.aborted || error?.name === 'AbortError') return;
      logger.error('Error fetching tutors:', error);
      analytics.error(error as Error, 'fetch_tutors_failed');
      if (mountedRef.current) {
        toast({
          title: 'Error',
          description: 'Failed to load tutors. Please try again.',
          variant: 'destructive',
        });
      }
    } finally {
      if (!controller.signal.aborted && mountedRef.current) setLoading(false);
    }
  }, [
    userLocation?.latitude,
    userLocation?.longitude,
    maxActive,
    options?.subjectFilter,
    options?.searchQuery,
    options?.studyLevel,
    toast,
  ]);

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

  // Shared debounce — always calls the latest fetchTutors (no stale closures).
  const [debouncedFetch] = useDebouncedCallback(fetchTutors, 800);

  useEffect(() => {
    mountedRef.current = true;
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
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
      supabase.removeChannel(channel);
    };
    // fetchTutors and debouncedFetch are stable wrt the right deps via useCallback.
  }, [fetchTutors, debouncedFetch]);

  return {
    tutors,
    allSubjects,
    loading,
    refreshTutors: fetchTutors,
  };
};
