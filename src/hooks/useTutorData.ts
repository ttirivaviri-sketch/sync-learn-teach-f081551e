import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useDebouncedCallback } from '@/hooks/useDebouncedCallback';
import { analytics } from '@/utils/analytics';
import { logger } from "@/utils/logger";
import { gradeMatches as gradeMatchesShared, curriculumMatches, subjectOverlapCount, subjectMatches } from '@/lib/personalization';

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
  curriculums?: string[];
  grades?: string[];
  profileIncomplete?: boolean;
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
  /** Learner's curriculum (ZIMSEC, CAPS, IEB, Cambridge) */
  curriculum?: string;
  /**
   * When false, skips fetching and realtime subscriptions entirely (and tears
   * down existing channels). Lets shell components gate this hook to the tab
   * that actually renders tutor data instead of paying for it on every mount.
   * Defaults to true so existing callers are unaffected.
   */
  enabled?: boolean;
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
  const enabled = options?.enabled ?? true;

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

      // Skip silently when unauthenticated — RLS will reject these reads and
      // we'd surface a confusing toast on public/auth screens while the
      // learner app briefly mounts before redirecting.
      const { data: { session: preSession } } = await supabase.auth.getSession();
      if (!preSession?.user) {
        if (mountedRef.current) setTutors([]);
        return;
      }

      // Use directory RPC — never exposes email/phone of other tutors.
      const { data: profilesData, error: profilesError } = await supabase
        .rpc('get_tutor_directory')
        .abortSignal(controller.signal);

      if (controller.signal.aborted) return;
      if (profilesError) {
        logger.error('Error fetching tutors:', profilesError);
        throw profilesError;
      }

      const tutorsData = profilesData || [];

      const { data: { session } } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;

      const [subjectsResult, reviewsResult, activeBookingsResult, qualificationsResult, teachingResult] = await Promise.all([
        supabase.from('tutor_subjects').select('*').abortSignal(controller.signal),
        // Ratings RPC — exposes only tutor id + rating, never reviewer identity or comments.
        supabase.rpc('get_tutor_ratings').abortSignal(controller.signal),
        supabase
          .from('bookings')
          .select('tutor_id')
          .in('status', ['requested', 'confirmed'])
          .abortSignal(controller.signal),
        // Directory RPC — never exposes document_url of tutor certificates.
        supabase.rpc('get_public_qualifications').abortSignal(controller.signal),
        supabase
          .from('tutor_teaching_profile')
          .select('user_id, curriculums, grades')
          .abortSignal(controller.signal),
      ]);

      if (controller.signal.aborted) return;

      const subjectsData = subjectsResult.data || [];
      const reviewsData = reviewsResult.data || [];
      const activeBookingsData = activeBookingsResult.data || [];
      const qualificationsData = qualificationsResult.data || [];
      const teachingData = teachingResult.data || [];

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

      const teachingMap = new Map<string, { curriculums: string[]; grades: string[] }>();
      for (const t of teachingData) {
        teachingMap.set(t.user_id, { curriculums: t.curriculums || [], grades: t.grades || [] });
      }

      const tutorsWithSubjects = tutorsData.map(tutor => {
        const tutorSubjects = subjectsData.filter(s => s.user_id === tutor.id);
        const tutorQualifications = qualificationsData.filter(q => q.user_id === tutor.id);
        const ratingInfo = ratingsMap.get(tutor.id);
        const avgRating = ratingInfo ? Math.round((ratingInfo.total / ratingInfo.count) * 10) / 10 : 0;
        const totalReviews = ratingInfo?.count || 0;
        const confirmedBookingsCount = bookingsCountMap.get(tutor.id) || 0;
        const teaching = teachingMap.get(tutor.id);

        const distance = userLocation && tutor.location_lat && tutor.location_lng
          ? calculateRealDistance(tutor.location_lat, tutor.location_lng, userLocation)
          : null;

        return {
          id: tutor.id,
          full_name: tutor.full_name || 'Anonymous',
          email: '', // intentionally hidden — never exposed in tutor directory
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
          curriculums: teaching?.curriculums || [],
          grades: teaching?.grades || [],
          profileIncomplete: tutorSubjects.length === 0,
          distance: distance ? `${distance.toFixed(1)}km` : 'Unknown',
          distanceValue: distance,
        };
      });

      // Score-and-rank: keep tutors who match on subject, grade, or curriculum.
      // Tutors with incomplete profiles can still surface when grade+curriculum align.
      const learnerSubjects = options?.subjects && options.subjects.length > 0
        ? options.subjects
        : (options?.subjectFilter ? [options.subjectFilter] : []);
      const learnerGrade = options?.grade;
      const learnerCurriculum = options?.curriculum;
      const queryLower = options?.searchQuery?.toLowerCase().trim();

      const scored = tutorsWithSubjects.map(t => {
        const tutorSubjectNames = t.subjects.map(s => s.subject);
        const subjectScore = learnerSubjects.length
          ? subjectOverlapCount(tutorSubjectNames, learnerSubjects)
          : (t.subjects.length > 0 ? 1 : 0);

        const gradeLabels = [
          ...t.subjects.map(s => s.level),
          ...(t.grades || []),
        ];
        const gradeScore = learnerGrade
          ? (gradeMatchesShared(gradeLabels, learnerGrade) ? 1 : 0)
          : 1;

        const curriculumScore = learnerCurriculum && t.curriculums.length
          ? (t.curriculums.some(c => curriculumMatches(c, learnerCurriculum)) ? 1 : 0)
          : 1;

        const queryScore = queryLower
          ? ((t.full_name.toLowerCase().includes(queryLower) ||
              tutorSubjectNames.some(s => s.toLowerCase().includes(queryLower)) ||
              (t.bio || '').toLowerCase().includes(queryLower)) ? 1 : 0)
          : 1;

        return { tutor: t, subjectScore, gradeScore, curriculumScore, queryScore };
      });

      const filtered = scored
        .filter(s => s.queryScore > 0)
        .filter(s => {
          if (!learnerSubjects.length) return true;
          if (s.subjectScore > 0) return true;
          // Profile-incomplete tutors slip through when grade+curriculum align.
          return s.tutor.profileIncomplete && s.gradeScore > 0 && s.curriculumScore > 0;
        });

      filtered.sort((a, b) => {
        const ascore =
          a.subjectScore * 10 + a.gradeScore * 3 + a.curriculumScore * 2 +
          (a.tutor.profileIncomplete ? 0 : 1);
        const bscore =
          b.subjectScore * 10 + b.gradeScore * 3 + b.curriculumScore * 2 +
          (b.tutor.profileIncomplete ? 0 : 1);
        if (bscore !== ascore) return bscore - ascore;
        if (b.tutor.rating !== a.tutor.rating) return b.tutor.rating - a.tutor.rating;
        if (userLocation) {
          if (a.tutor.distanceValue === null) return 1;
          if (b.tutor.distanceValue === null) return -1;
          return (a.tutor.distanceValue ?? 0) - (b.tutor.distanceValue ?? 0);
        }
        return 0;
      });

      const finalTutors = filtered.map(s => s.tutor);

      if (controller.signal.aborted || !mountedRef.current) return;
      setTutors(finalTutors);

      analytics.track('tutors_loaded', {
        count: finalTutors.length,
        hasLocation: !!userLocation,
        authenticated: !!session?.user,
        subjectFilter: options?.subjectFilter || null,
      });
    } catch (error: any) {
      // Aborts surface as DOMException / "AbortError" — silently ignore.
      if (controller.signal.aborted || error?.name === 'AbortError') return;

      // Safari over flaky networks throws "TypeError: Load failed" for any
      // dropped fetch. Treat these as transient: retry quietly, do not toast.
      const msg = (error?.message || '').toLowerCase();
      const isTransient =
        msg.includes('load failed') ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('timeout');

      if (isTransient) {
        logger.warn('Transient network error fetching tutors, will retry:', error?.message);
        if (mountedRef.current) {
          // Single silent retry after a short backoff.
          setTimeout(() => {
            if (mountedRef.current) fetchTutors();
          }, 2500);
        }
        return;
      }

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
    options?.grade,
    options?.curriculum,
    JSON.stringify(options?.subjects || []),
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

    // Gated off (e.g. Home tab not active): skip the fetch and the three
    // realtime subscriptions entirely. Previously-loaded tutors stay in state
    // so returning to the tab shows data instantly while a refresh runs.
    if (!enabled) {
      return () => {
        mountedRef.current = false;
        if (abortRef.current) abortRef.current.abort();
      };
    }

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
  }, [enabled, fetchTutors, debouncedFetch]);

  return {
    tutors,
    allSubjects,
    loading,
    refreshTutors: fetchTutors,
  };
};
