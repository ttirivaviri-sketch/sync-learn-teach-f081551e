/**
 * useTutorMessageHaptic — fires a soft `tutor.message` haptic whenever a new
 * inbound message arrives for the tutor. Distinct from `tutor.booking` so the
 * tutor can feel the difference between a new booking request and a chat
 * message from a student.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { studySyncHaptic } from "@/lib/haptics";

export function useTutorMessageHaptic(tutorUserId?: string) {
  useEffect(() => {
    if (!tutorUserId) return;

    const channel = supabase
      .channel(`tutor-messages-${tutorUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `to_user_id=eq.${tutorUserId}`,
        },
        (payload) => {
          const fromId = (payload.new as { from_user_id?: string } | null)?.from_user_id;
          // Don't buzz on echoes of our own outgoing messages.
          if (fromId && fromId === tutorUserId) return;
          studySyncHaptic("tutor.message");
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutorUserId]);
}
