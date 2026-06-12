/**
 * usePremiumMilestones — fires the rare `premium.milestone` haptic for
 * StudySync's signature "first-time" achievements:
 *
 *   - Learner: first confirmed booking, first subject mastery
 *   - Tutor:   first confirmed booking, first completed (= paid) session
 *
 * Guarded by `studySyncHapticOnce` per user id so each event fires exactly
 * once per browser, regardless of remounts. Cheap one-shot queries; runs
 * once when `userId` becomes available.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { studySyncHapticOnce } from "@/lib/haptics";
import { logger } from "@/utils/logger";

type Role = "learner" | "tutor";

export function usePremiumMilestones(userId: string | undefined, role: Role) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const idCol = role === "learner" ? "learner_id" : "tutor_id";

        // First confirmed/completed booking → first lesson booked
        const { count: confirmedCount } = await supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq(idCol, userId)
          .in("status", ["confirmed", "completed"]);

        if (!cancelled && (confirmedCount ?? 0) > 0) {
          studySyncHapticOnce("premium.milestone", `${role}-first-booking:${userId}`);
        }

        if (role === "tutor") {
          // First completed booking on tutor side = first payment received
          const { count: paidCount } = await supabase
            .from("bookings")
            .select("id", { count: "exact", head: true })
            .eq("tutor_id", userId)
            .eq("status", "completed");
          if (!cancelled && (paidCount ?? 0) > 0) {
            studySyncHapticOnce("premium.milestone", `tutor-first-payment:${userId}`);
          }
        }

        if (role === "learner") {
          // First subject mastery — `topic_mastery` rows at ≥ 80%
          const { count: masteryCount } = await supabase
            .from("topic_mastery")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .gte("mastery_percentage", 80);
          if (!cancelled && (masteryCount ?? 0) > 0) {
            studySyncHapticOnce("premium.milestone", `learner-first-mastery:${userId}`);
          }
        }
      } catch (err) {
        logger.warn("usePremiumMilestones: check failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, role]);
}
