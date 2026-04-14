/**
 * ChatInterface — Full-page messaging experience with theme selector.
 *
 * Takes over the entire viewport when open. On mobile the conversation
 * sidebar is hidden behind a toggle; on desktop it's a fixed column.
 * Theme choice is persisted in localStorage.
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { logger } from "@/utils/logger";

import { ConversationList, type Conversation } from "./chat/ConversationList";
import { ChatArea, EmptyChatArea } from "./chat/ChatArea";
import {
  getThemeById,
  CHAT_THEME_STORAGE_KEY,
  type ChatTheme,
} from "./chat/chatThemes";

// ── Types ──────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  read_at?: string;
  sender_name?: string;
}

interface ChatInterfaceProps {
  session: Session | null;
  userType: "tutor" | "learner";
  isOpen: boolean;
  onClose: () => void;
  initialConversationId?: string;
  otherUserId?: string;
  otherUserName?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Component ──────────────────────────────────────────────────────────────
const ChatInterface = ({
  session,
  userType,
  isOpen,
  onClose,
  initialConversationId,
  otherUserId,
  otherUserName,
}: ChatInterfaceProps) => {
  /* ── State ──────────────────────────────────────────────────── */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    initialConversationId || null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(true);
  const { toast } = useToast();

  const currentUserId = session?.user?.id;

  // Theme (persisted)
  const [theme, setTheme] = useState<ChatTheme>(() => {
    try {
      const saved = localStorage.getItem(CHAT_THEME_STORAGE_KEY);
      return saved ? getThemeById(saved) : getThemeById("studysync-blue");
    } catch {
      return getThemeById("studysync-blue");
    }
  });

  const handleThemeChange = useCallback((t: ChatTheme) => {
    setTheme(t);
    try {
      localStorage.setItem(CHAT_THEME_STORAGE_KEY, t.id);
    } catch {
      /* noop */
    }
  }, []);

  // ═════════════════════════════════════════════════════════════
  // Real-mode helpers (Supabase)
  // ═════════════════════════════════════════════════════════════
  const loadConversations = useCallback(async () => {
    if (!session?.user) return;
    try {
      const { data: convos, error } = await supabase
        .from("conversations")
        .select("*")
        .eq(userType === "tutor" ? "tutor_id" : "learner_id", session.user.id)
        .order("last_message_at", { ascending: false });
      if (error) throw error;

      const withUserInfo = await Promise.all(
        (convos || []).map(async (conv) => {
          const oId = userType === "tutor" ? conv.learner_id : conv.tutor_id;
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, id")
            .eq("id", oId)
            .maybeSingle();
          return {
            ...conv,
            other_user_name: profile?.full_name || "Unknown User",
          };
        }),
      );
      setConversations(withUserInfo);
    } catch (error) {
      logger.error("Error loading conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    }
  }, [session?.user, userType, toast]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      if (!session?.user) return;
      try {
        setLoading(true);
        const { data: msgs, error } = await supabase
          .from("messages")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });
        if (error) throw error;

        const withSenderInfo = await Promise.all(
          (msgs || []).map(async (msg) => {
            const { data: profile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", msg.sender_id)
              .maybeSingle();
            return { ...msg, sender_name: profile?.full_name || "Unknown User" };
          }),
        );
        setMessages(withSenderInfo);

        const unread = msgs?.filter(
          (m) => m.sender_id !== session.user.id && !m.read_at,
        );
        if (unread?.length) {
          await Promise.all(unread.map((m) => markMessageAsRead(m.id)));
        }
      } catch (error) {
        logger.error("Error loading messages:", error);
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [session?.user, toast],
  );

  const createOrGetConversation = useCallback(
    async (oUserId: string, _oUserName: string) => {
      if (!session?.user) return;
      try {
        const tutorId = userType === "tutor" ? session.user.id : oUserId;
        const learnerId = userType === "learner" ? session.user.id : oUserId;
        const { data: existing, error: existingError } = await supabase
          .from("conversations")
          .select("id")
          .eq("tutor_id", tutorId)
          .eq("learner_id", learnerId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing) {
          setActiveConversation(existing.id);
          return;
        }

        const { data, error } = await supabase
          .from("conversations")
          .insert({ tutor_id: tutorId, learner_id: learnerId })
          .select()
          .single();
        if (error) throw error;
        setActiveConversation(data.id);
        loadConversations();
      } catch (error) {
        logger.error("Error creating conversation:", error);
        toast({
          title: "Error",
          description: "Failed to create conversation",
          variant: "destructive",
        });
      }
    },
    [session?.user, userType, loadConversations, toast],
  );

  const sendMessage = useCallback(async () => {
    if (!newMessage.trim() || !activeConversation || !session?.user) return;
    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversation,
        sender_id: session.user.id,
        content: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      logger.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  }, [newMessage, activeConversation, session?.user, toast]);

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId);
    } catch (error) {
      logger.error("Error marking message as read:", error);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // Effects
  // ═════════════════════════════════════════════════════════════

  // Load conversations on open
  useEffect(() => {
    if (!isOpen || !session?.user) return;
    loadConversations();
  }, [isOpen, session?.user, loadConversations]);

  // Real-time channels
  useEffect(() => {
    if (!isOpen || !session?.user) return;
    const conversationChannel = supabase
      .channel("conversations-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter:
            userType === "tutor"
              ? `tutor_id=eq.${session.user.id}`
              : `learner_id=eq.${session.user.id}`,
        },
        () => loadConversations(),
      )
      .subscribe();

    const messageChannel = supabase
      .channel("messages-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const msg = payload.new as Message;
            if (msg.conversation_id === activeConversation) {
              setMessages((prev) => [...prev, msg]);
              markMessageAsRead(msg.id);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, session?.user, activeConversation, userType]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation || !session?.user) return;
    loadMessages(activeConversation);
  }, [activeConversation, session?.user, loadMessages]);

  // Auto-open / create conversation when otherUserId is provided
  useEffect(() => {
    if (!otherUserId || !otherUserName || activeConversation || !session?.user) return;
    createOrGetConversation(otherUserId, otherUserName);
  }, [otherUserId, otherUserName, activeConversation, session?.user, createOrGetConversation]);

  // ── Interaction handlers ────────────────────────────────────
  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setMobileSidebar(false);
  };

  const handleSendMessage = sendMessage;

  if (!isOpen) return null;
  if (!session?.user) return null;

  const activeConversationData = conversations.find(
    (c) => c.id === activeConversation,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex bg-background"
    >
      {/* Sidebar */}
      <div
        className={`${
          mobileSidebar ? "flex" : "hidden"
        } md:flex flex-col w-full md:w-80 border-r border-border/30 bg-background/95 backdrop-blur-lg`}
      >
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversation}
          onSelect={handleSelectConversation}
          onClose={onClose}
          formatTime={formatTime}
          theme={theme}
          onThemeChange={handleThemeChange}
          isMobileOpen={mobileSidebar}
        />
      </div>

      {/* Chat Area */}
      <div
        className={`${
          mobileSidebar ? "hidden" : "flex"
        } md:flex flex-1 flex-col`}
      >
        {activeConversation && activeConversationData ? (
          <ChatArea
            messages={messages}
            newMessage={newMessage}
            onNewMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
            currentUserId={currentUserId || ""}
            otherUserName={activeConversationData.other_user_name}
            loading={loading}
            theme={theme}
            onToggleSidebar={() => setMobileSidebar(true)}
            formatTime={formatTime}
          />
        ) : (
          <EmptyChatArea
            theme={theme}
            onToggleSidebar={() => setMobileSidebar(true)}
          />
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
