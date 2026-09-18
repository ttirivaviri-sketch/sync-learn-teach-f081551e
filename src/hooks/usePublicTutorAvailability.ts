/**
 * usePublicTutorAvailability — anon-safe weekly availability for one tutor.
 *
 * Reads the `get_public_tutor_availability` RPC so the public booking page can
 * show real open times before the visitor has an account.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export interface PublicAvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export const usePublicTutorAvailability = (tutorId?: string) => {
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(Boolean(tutorId));

  useEffect(() => {
    let cancelled = false;

    if (!tutorId) {
      setSlots([]);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_public_tutor_availability", {
          _tutor_id: tutorId,
        });
        if (error) throw error;
        if (cancelled) return;
        setSlots((data || []) as PublicAvailabilitySlot[]);
      } catch (err) {
        logger.error("Error loading tutor availability:", err);
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  return { slots, loading };
};
