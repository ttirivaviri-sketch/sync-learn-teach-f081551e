import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

/**
 * Persistent per-learner resource engagement: saves (bookmarks), likes,
 * and open history — backed by `learner_resource_engagement`.
 *
 * Replaces the old in-memory Saved list that evaporated on refresh.
 * All writes are optimistic; failures roll back and log.
 */

export interface EngagementState {
  savedIds: string[];
  likedIds: string[];
  /** resource_id → last_opened_at (ISO) for "Continue reading". */
  lastOpened: Record<string, string>;
  /** resource_id → watch count (clips actively viewed). */
  watchCounts: Record<string, number>;
}

const EMPTY: EngagementState = { savedIds: [], likedIds: [], lastOpened: {}, watchCounts: {} };

async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export function useResourceEngagement() {
  const [state, setState] = useState<EngagementState>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const userId = await getUserId();
        if (!userId) {
          if (!cancelled) setLoaded(true);
          return;
        }
        const { data, error } = await supabase
          .from("learner_resource_engagement" as never)
          .select("resource_id, saved, liked, last_opened_at, watch_count")
          .eq("user_id", userId)
          .limit(1000);
        if (error) throw error;
        if (cancelled) return;
        const rows = (data ?? []) as Array<{
          resource_id: string;
          saved: boolean;
          liked: boolean;
          last_opened_at: string | null;
          watch_count: number | null;
        }>;
        const savedIds: string[] = [];
        const likedIds: string[] = [];
        const lastOpened: Record<string, string> = {};
        const watchCounts: Record<string, number> = {};
        for (const r of rows) {
          if (r.saved) savedIds.push(r.resource_id);
          if (r.liked) likedIds.push(r.resource_id);
          if (r.last_opened_at) lastOpened[r.resource_id] = r.last_opened_at;
          if (r.watch_count) watchCounts[r.resource_id] = r.watch_count;
        }
        setState({ savedIds, likedIds, lastOpened, watchCounts });
      } catch (err) {
        // Table may not exist yet (migration pending) — degrade gracefully.
        logger.warn("[useResourceEngagement] load failed", err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const upsert = useCallback(
    async (
      resourceId: string,
      source: "system" | "tutorial",
      patch: Partial<{ saved: boolean; liked: boolean; opened: boolean }>,
    ) => {
      try {
        const userId = await getUserId();
        if (!userId) return;
        const row: Record<string, unknown> = {
          user_id: userId,
          resource_id: resourceId,
          resource_source: source,
        };
        if (patch.saved !== undefined) row.saved = patch.saved;
        if (patch.liked !== undefined) row.liked = patch.liked;
        if (patch.opened) row.last_opened_at = new Date().toISOString();
        const { error } = await supabase
          .from("learner_resource_engagement" as never)
          .upsert(row as never, { onConflict: "user_id,resource_id" });
        if (error) throw error;
      } catch (err) {
        logger.warn("[useResourceEngagement] write failed", err);
        throw err;
      }
    },
    [],
  );

  const toggleSave = useCallback(
    (resourceId: string, source: "system" | "tutorial" = "system") => {
      const isSaved = state.savedIds.includes(resourceId);
      // Optimistic update
      setState((s) => ({
        ...s,
        savedIds: isSaved
          ? s.savedIds.filter((id) => id !== resourceId)
          : [...s.savedIds, resourceId],
      }));
      upsert(resourceId, source, { saved: !isSaved }).catch(() => {
        // Roll back
        setState((s) => ({
          ...s,
          savedIds: isSaved
            ? [...s.savedIds, resourceId]
            : s.savedIds.filter((id) => id !== resourceId),
        }));
      });
      return !isSaved;
    },
    [state.savedIds, upsert],
  );

  const toggleLike = useCallback(
    (resourceId: string, source: "system" | "tutorial" = "system") => {
      const isLiked = state.likedIds.includes(resourceId);
      setState((s) => ({
        ...s,
        likedIds: isLiked
          ? s.likedIds.filter((id) => id !== resourceId)
          : [...s.likedIds, resourceId],
      }));
      upsert(resourceId, source, { liked: !isLiked }).catch(() => {
        setState((s) => ({
          ...s,
          likedIds: isLiked
            ? [...s.likedIds, resourceId]
            : s.likedIds.filter((id) => id !== resourceId),
        }));
      });
      return !isLiked;
    },
    [state.likedIds, upsert],
  );

  const recordOpen = useCallback(
    (resourceId: string, source: "system" | "tutorial" = "system") => {
      setState((s) => ({
        ...s,
        lastOpened: { ...s.lastOpened, [resourceId]: new Date().toISOString() },
      }));
      // Fire-and-forget; open history is best-effort.
      upsert(resourceId, source, { opened: true }).catch(() => {});
    },
    [upsert],
  );

  const recordWatch = useCallback(
    (resourceId: string, source: "system" | "tutorial" = "system") => {
      setState((s) => ({
        ...s,
        watchCounts: {
          ...s.watchCounts,
          [resourceId]: (s.watchCounts[resourceId] ?? 0) + 1,
        },
      }));
      // Atomic server-side increment; best-effort (RPC absent pre-migration).
      supabase
        .rpc("record_clip_watch" as never, {
          p_resource_id: resourceId,
          p_source: source,
        } as never)
        .then(({ error }) => {
          if (error) logger.warn("[useResourceEngagement] watch rpc failed", error.message);
        });
    },
    [],
  );

  return {
    savedIds: state.savedIds,
    likedIds: state.likedIds,
    lastOpened: state.lastOpened,
    watchCounts: state.watchCounts,
    loaded,
    toggleSave,
    toggleLike,
    recordOpen,
    recordWatch,
  };
}
