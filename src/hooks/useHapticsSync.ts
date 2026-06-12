/**
 * useHapticsSync — keeps the user's haptic-feedback preference consistent
 * across sessions and devices by syncing with `public.user_preferences`.
 *
 * Strategy:
 *  - On mount (with a userId), read the remote `haptics_enabled` value and
 *    push it into the local in-memory + localStorage flag via setHapticsEnabled.
 *  - Subscribes to realtime updates so a change on another device propagates.
 *  - Exposes `setEnabled(value)` that writes both local + remote (upsert).
 *
 * Safe to call anywhere; degrades to local-only when offline or signed out.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getHapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import { logger } from "@/utils/logger";

export function useHapticsSync(userId?: string) {
  const [enabled, setEnabledState] = useState<boolean>(() => getHapticsEnabled());
  const [synced, setSynced] = useState(false);

  // Initial fetch + realtime sync.
  useEffect(() => {
    if (!userId) {
      setSynced(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("haptics_enabled")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        logger.warn("useHapticsSync: load failed", error);
      } else if (data) {
        setHapticsEnabled(data.haptics_enabled);
        setEnabledState(data.haptics_enabled);
      } else {
        // First time on this account — persist current local pref as the seed.
        const current = getHapticsEnabled();
        await supabase
          .from("user_preferences")
          .upsert({ user_id: userId, haptics_enabled: current }, { onConflict: "user_id" });
      }
      setSynced(true);
    })();

    const channel = supabase
      .channel(`user-prefs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences", filter: `user_id=eq.${userId}` },
        (payload) => {
          const next = (payload.new as { haptics_enabled?: boolean } | null)?.haptics_enabled;
          if (typeof next === "boolean") {
            setHapticsEnabled(next);
            setEnabledState(next);
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const setEnabled = useCallback(
    async (value: boolean) => {
      setHapticsEnabled(value);
      setEnabledState(value);
      if (!userId) return;
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: userId, haptics_enabled: value }, { onConflict: "user_id" });
      if (error) logger.warn("useHapticsSync: save failed", error);
    },
    [userId],
  );

  return { enabled, setEnabled, synced };
}
