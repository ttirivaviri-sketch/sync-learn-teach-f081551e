/**
 * ChatInterface — Full-page messaging experience with theme selector.
 *
 * Takes over the entire viewport when open. On mobile the conversation
 * sidebar is hidden behind a toggle; on desktop it's a fixed column.
 * Theme choice is persisted in localStorage.
 *
 * **Dev-mode aware**: when `session` is null (dev mode) the component
 * renders with mock conversations & messages so the full UI is exercisable.
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

// ── Dev-mode mock data ─────────────────────────────────────────────────────
const DEV_USER_ID = "dev-user";
const DEV_TUTOR_USER_ID = "dev-tutor";

function buildDevConversations(userType: "tutor" | "learner"): Conversation[] {
  const now = new Date();
  const peers =
    userType === "learner"
      ? [
          { name: "Ms. Naledi Mbeki", id: "dev-tutor-1" },
          { name: "Mr. James Oduro", id: "dev-tutor-2" },
          { name: "Dr. Priya Naidoo", id: "dev-tutor-3" },
        ]
      : [
          { name: "Sipho Mokoena", id: "dev-learner-1" },
          { name: "Amara Dlamini", id: "dev-learner-2" },
          { name: "Lerato Khumalo", id: "dev-learner-3" },
        ];

  return peers.map((peer, i) => ({
    id: `dev-conv-${i + 1}`,
    tutor_id: userType === "tutor" ? DEV_TUTOR_USER_ID : peer.id,
    learner_id: userType === "learner" ? DEV_USER_ID : peer.id,
    last_message_at: new Date(now.getTime() - i * 3600_000).toISOString(),
    other_user_name: peer.name,
    unread_count: i === 0 ? 2 : 0,
  }));
}

function buildDevMessages(
  conversationId: string,
  currentUserId: string,
  otherName: string,
): Message[] {
  const now = new Date();
  const scripts: Record<string, Array<[boolean, string]>> = {
    "dev-conv-1": [
      [false, `Hi there! Ready for our session on quadratics?`],
      [true, `Yes! I've been practising the homework problems.`],
      [false, `Great, let's review the factoring method first.`],
      [true, `Sounds good. I got stuck on question 4.`],
      [false, `That's a common one — we'll tackle it together. See you at 3pm!`],
    ],
    "dev-conv-2": [
      [false, `Your essay draft looks much better!`],
      [true, `Thanks! I rewrote the introduction like you suggested.`],
      [false, `I'll send detailed feedback by tomorrow morning.`],
    ],
    "dev-conv-3": [
      [false, `Don't forget — exam prep starts next week.`],
      [true, `I'll be ready. Should I review past papers?`],
      [false, `Yes, focus on the 2024 and 2025 papers first.`],
      [true, `Got it, thank you!`],
    ],
  };

  const lines = scripts[conversationId] ?? [
    [false, "Hey, how's your studying going?"],
    [true, "Pretty well, thanks!"],
  ];

  return lines.map(([isSelf, content], i) => ({
    id: `dev-msg-${conversationId}-${i}`,
    content: content as string,
    sender_id: isSelf ? currentUserId : `other-${conversationId}`,
    conversation_id: conversationId,
    created_at: new Date(now.getTime() - (lines.length - i) * 60_000).toISOString(),
    sender_name: isSelf ? "You" : otherName,
  }));
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
  const isDevMode = !session?.user;

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

  // Effective user id (real or dev)
  const currentUserId = session?.user?.id ?? (userType === "tutor" ? DEV_TUTOR_USER_ID : DEV_USER_ID);

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
  // Dev-mode helpers (local-only, no Supabase)
  // ═════════════════════════════════════════════════════════════
  const loadDevConversations = useCallback(() => {
    setConversations(buildDevConversations(userType));
  }, [userType]);

  const loadDevMessages = useCallback(
    (conversationId: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const name = conv?.other_user_name ?? "Dev Peer";
      setMessages(buildDevMessages(conversationId, currentUserId, name));
    },
    [conversations, currentUserId],
  );

  const sendDevMessage = useCallback(() => {
    if (!newMessage.trim() || !activeConversation) return;
    const msg: Message = {
      id: `dev-msg-${Date.now()}`,
      content: newMessage.trim(),
      sender_id: currentUserId,
      conversation_id: activeConversation,
      created_at: new Date().toISOString(),
      sender_name: "You",
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");

    // Simulate a reply after a short delay
    setTimeout(() => {
      const conv = conversations.find((c) => c.id === activeConversation);
      const replies = [
        "That makes sense!",
        "Let me think about that...",
        "Good question — let's discuss it in our next session.",
        "I agree, keep up the great work!",
        "Can you elaborate a bit more?",
      ];
      const reply: Message = {
        id: `dev-msg-reply-${Date.now()}`,
        content: replies[Math.floor(Math.random() * replies.length)],
        sender_id: `other-${activeConversation}`,
        conversation_id: activeConversation,
        created_at: new Date().toISOString(),
        sender_name: conv?.other_user_name ?? "Dev Peer",
      };
      setMessages((prev) => [...prev, reply]);
    }, 1200);
  }, [newMessage, activeConversation, currentUserId, conversations]);

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
  // Effects — branch on dev vs real mode
  // ═════════════════════════════════════════════════════════════

  // Load conversations on open
  useEffect(() => {
    if (!isOpen) return;
    if (isDevMode) {
      loadDevConversations();
    } else {
      loadConversations();
    }
  }, [isOpen, isDevMode, loadDevConversations, loadConversations]);

  // Real-time channels (real mode only)
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
    if (!activeConversation) return;
    if (isDevMode) {
      loadDevMessages(activeConversation);
    } else {
      loadMessages(activeConversation);
    }
  }, [activeConversation, isDevMode, loadDevMessages, loadMessages]);

  // Auto-open / create conversation when otherUserId is provided
  useEffect(() => {
    if (!otherUserId || !otherUserName || activeConversation) return;
    if (isDevMode) {
      // In dev mode, find or create a mock conversation for this user
      const existing = conversations.find(
        (c) => c.other_user_name === otherUserName,
      );
      if (existing) {
        setActiveConversation(existing.id);
      } else {
        const newConv: Conversation = {
          id: `dev-conv-custom-${Date.now()}`,
          tutor_id: userType === "tutor" ? currentUserId : otherUserId,
          learner_id: userType === "learner" ? currentUserId : otherUserId,
          last_message_at: new Date().toISOString(),
          other_user_name: otherUserName,
          unread_count: 0,
        };
        setConversations((prev) => [newConv, ...prev]);
        setActiveConversation(newConv.id);
      }
    } else {
      createOrGetConversation(otherUserId, otherUserName);
    }
  }, [
    otherUserId,
    otherUserName,
    activeConversation,
    isDevMode,
    conversations,
    userType,
    currentUserId,
    createOrGetConversation,
  ]);

  // ── Interaction handlers ────────────────────────────────────
  const handleSelectConversation = (id: string) => {
    setActiveConversation(id);
    setMobileSidebar(false);
  };

  const handleSendMessage = isDevMode ? sendDevMessage : sendMessage;

  // ── Render ─────────────────────────────────────────────────
  if (!isOpen) return null;

  const activeConvName =
    conversations.find((c) => c.id === activeConversation)?.other_user_name ||
    otherUserName ||
    "User";

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen overflow-hidden">
      {/* Mobile backdrop when sidebar is open */}
      {mobileSidebar && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      )}

      {/* Sidebar */}
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {activeConversation ? (
          <ChatArea
            messages={messages}
            loading={loading}
            newMessage={newMessage}
            currentUserId={currentUserId}
            otherUserName={activeConvName}
            userType={userType}
            onNewMessageChange={setNewMessage}
            onSendMessage={handleSendMessage}
            formatTime={formatTime}
            theme={theme}
            onToggleSidebar={() => setMobileSidebar((v) => !v)}
          />
        ) : (
          <EmptyChatArea
            theme={theme}
            onToggleSidebar={() => setMobileSidebar((v) => !v)}
          />
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
export { ChatInterface };
