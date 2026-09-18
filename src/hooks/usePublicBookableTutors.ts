/**
 * usePublicBookableTutors — anon-safe tutor directory for the public booking page.
 *
 * Reads the `get_public_bookable_tutors` RPC (SECURITY DEFINER, granted to anon)
 * so visitors who are not signed in can still browse tutors, subjects and rates.
 * Never exposes tutor email / phone / location.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export interface PublicTutorSubject {
  id: string;
  subject: string;
  level: string;
  hourly_rate: number;
}

export interface PublicBookableTutor {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  online_status: boolean;
  last_seen: string | null;
  rating: number;
  total_reviews: number;
  subjects: PublicTutorSubject[];
}

export const usePublicBookableTutors = () => {
  const [tutors, setTutors] = useState<PublicBookableTutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("get_public_bookable_tutors");
      if (rpcError) throw rpcError;

      const rows = (data || []) as Array<{
        id: string;
        full_name: string | null;
        avatar_url: string | null;
        bio: string | null;
        online_status: boolean | null;
        last_seen: string | null;
        rating: number | string | null;
        total_reviews: number | null;
        subjects: unknown;
      }>;

      const mapped: PublicBookableTutor[] = rows
        .map((row) => {
          const rawSubjects = Array.isArray(row.subjects)
            ? (row.subjects as PublicTutorSubject[])
            : [];
          return {
            id: row.id,
            full_name: row.full_name || "StudySync tutor",
            avatar_url: row.avatar_url,
            bio: row.bio,
            online_status: Boolean(row.online_status),
            last_seen: row.last_seen,
            rating: Number(row.rating ?? 0),
            total_reviews: Number(row.total_reviews ?? 0),
            subjects: rawSubjects
              .filter((s) => s && s.id && s.subject)
              .map((s) => ({
                id: s.id,
                subject: s.subject,
                level: s.level,
                hourly_rate: Number(s.hourly_rate ?? 0),
              })),
          };
        })
        .filter((t) => t.subjects.length > 0)
        .sort((a, b) => {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.total_reviews - a.total_reviews;
        });

      setTutors(mapped);
    } catch (err) {
      logger.error("Error loading public tutor directory:", err);
      setError("We couldn't load tutors right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { tutors, loading, error, refresh: load };
};
