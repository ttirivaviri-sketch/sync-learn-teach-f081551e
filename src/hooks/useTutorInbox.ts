/**
 * useTutorInbox — compact message inbox for the tutor dashboard.
 *
 * Loads the tutor's most recent conversations with the last message preview
 * and an unread count. Learner names/avatars come from the safe
 * `get_public_profiles` RPC (no emails or phone numbers).
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";

export interface InboxItem {
  conversationId: string;
  learnerId: string;
  learnerName: string;
  avatarUrl?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
}

export const useTutorInbox = (tutorId?: string, limit = 4) => {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tutorId) return;
    try {
      const { data: convs } = await supabase
        .from("conversations")
        .select("id, learner_id, last_message_at")
        .eq("tutor_id", tutorId)
        .order("last_message_at", { ascending: false })
        .limit(limit);

      const list = convs ?? [];
      if (list.length === 0) {
        setItems([]);
        return;
      }

      const convIds = list.map((c) => c.id);
      const learnerIds = [...new Set(list.map((c) => c.learner_id))];

      const [{ data: msgs }, { data: profiles }] = await Promise.all([
        supabase
          .from("messages")
          .select("conversation_id, content, sender_id, read_at, created_at")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false })
          .limit(300),
        supabase.rpc("get_public_profiles", { _ids: learnerIds }),
      ]);

      const nameById = new Map<string, { name: string; avatar?: string | null }>();
      for (const p of (profiles as any[]) ?? []) {
        nameById.set(p.id, { name: p.full_name || "Student", avatar: p.avatar_url });
      }

      const latest = new Map<string, { content: string; created_at: string }>();
      const unread = new Map<string, number>();
      for (const m of (msgs as any[]) ?? []) {
        if (!latest.has(m.conversation_id)) {
          latest.set(m.conversation_id, { content: m.content, created_at: m.created_at });
        }
        if (m.sender_id !== tutorId && !m.read_at) {
          unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
        }
      }

      setItems(
        list.map((c) => ({
          conversationId: c.id,
          learnerId: c.learner_id,
          learnerName: nameById.get(c.learner_id)?.name ?? "Student",
          avatarUrl: nameById.get(c.learner_id)?.avatar,
          lastMessage: latest.get(c.id)?.content ?? "Say hello 👋",
          lastMessageAt: latest.get(c.id)?.created_at ?? c.last_message_at,
          unread: unread.get(c.id) ?? 0,
        })),
      );
    } catch (e) {
      logger.warn("useTutorInbox load failed", e);
    } finally {
      setLoading(false);
    }
  }, [tutorId, limit]);

  useEffect(() => {
    if (!tutorId) {
      setLoading(false);
      return;
    }
    load();
    const channel = supabase
      .channel(`tutor-inbox-${tutorId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tutorId, load]);

  return { items, loading, refresh: load };
};
