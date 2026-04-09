import { useState, useEffect, useRef } from "react";
import { Send, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { logger } from "@/utils/logger";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  conversation_id: string;
  created_at: string;
  read_at?: string;
  sender_name?: string;
  sender_avatar?: string;
  profiles?: {
    full_name: string;
  };
}

interface Conversation {
  id: string;
  tutor_id: string;
  learner_id: string;
  last_message_at: string;
  other_user_name?: string;
  other_user_avatar?: string;
  unread_count?: number;
  profiles?: {
    full_name: string;
    id: string;
  };
}

interface ChatInterfaceProps {
  session: Session;
  userType: 'tutor' | 'learner';
  isOpen: boolean;
  onClose: () => void;
  initialConversationId?: string;
  otherUserId?: string;
  otherUserName?: string;
}

const ChatInterface = ({ 
  session, 
  userType, 
  isOpen, 
  onClose, 
  initialConversationId,
  otherUserId,
  otherUserName 
}: ChatInterfaceProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(initialConversationId || null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load conversations
  useEffect(() => {
    if (isOpen && session?.user) {
      loadConversations();
    }
  }, [isOpen, session?.user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!isOpen || !session?.user) return;

    const conversationChannel = supabase
      .channel('conversations-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: userType === 'tutor' 
            ? `tutor_id=eq.${session.user.id}` 
            : `learner_id=eq.${session.user.id}`
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    const messageChannel = supabase
      .channel('messages-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            if (newMessage.conversation_id === activeConversation) {
              setMessages(prev => [...prev, newMessage]);
              markMessageAsRead(newMessage.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [isOpen, session?.user, activeConversation, userType]);

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversation) {
      loadMessages(activeConversation);
    }
  }, [activeConversation]);

  // Handle initial conversation setup
  useEffect(() => {
    if (otherUserId && otherUserName && !activeConversation) {
      createOrGetConversation(otherUserId, otherUserName);
    }
  }, [otherUserId, otherUserName, activeConversation]);

  const loadConversations = async () => {
    try {
      // Get conversations and fetch profile data separately to avoid relation issues
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select('*')
        .eq(userType === 'tutor' ? 'tutor_id' : 'learner_id', session.user.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Fetch profile data for each conversation
      const conversationsWithUserInfo = await Promise.all(
        (conversations || []).map(async (conv) => {
          const otherUserId = userType === 'tutor' ? conv.learner_id : conv.tutor_id;
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, id')
            .eq('id', otherUserId)
            .maybeSingle();

          return {
            ...conv,
            other_user_name: profile?.full_name || 'Unknown User',
            other_user_id: profile?.id
          };
        })
      );

      setConversations(conversationsWithUserInfo);
    } catch (error) {
      logger.error('Error loading conversations:', error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      setLoading(true);
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender names separately
      const messagesWithSenderInfo = await Promise.all(
        (messages || []).map(async (msg) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', msg.sender_id)
            .maybeSingle();

          return {
            ...msg,
            sender_name: profile?.full_name || 'Unknown User'
          };
        })
      );

      setMessages(messagesWithSenderInfo);
      
      // Mark unread messages as read
      const unreadMessages = messages?.filter(msg => 
        msg.sender_id !== session.user.id && !msg.read_at
      );
      
      if (unreadMessages?.length) {
        await Promise.all(
          unreadMessages.map(msg => markMessageAsRead(msg.id))
        );
      }
    } catch (error) {
      logger.error('Error loading messages:', error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createOrGetConversation = async (otherUserId: string, otherUserName: string) => {
    try {
      const tutorId = userType === 'tutor' ? session.user.id : otherUserId;
      const learnerId = userType === 'learner' ? session.user.id : otherUserId;

      // Check if conversation already exists
      const { data: existing, error: existingError } = await supabase
        .from('conversations')
        .select('id')
        .eq('tutor_id', tutorId)
        .eq('learner_id', learnerId)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existing) {
        setActiveConversation(existing.id);
        return;
      }

      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          tutor_id: tutorId,
          learner_id: learnerId
        })
        .select()
        .single();

      if (error) throw error;

      setActiveConversation(data.id);
      loadConversations();
    } catch (error) {
      logger.error('Error creating conversation:', error);
      toast({
        title: "Error",
        description: "Failed to create conversation",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation,
          sender_id: session.user.id,
          content: newMessage.trim()
        });

      if (error) throw error;

      setNewMessage("");
    } catch (error) {
      logger.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);
    } catch (error) {
      logger.error('Error marking message as read:', error);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background z-50 flex">
      {/* Conversations List */}
      <div className="w-80 border-r bg-muted/30">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Messages
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="overflow-y-auto h-[calc(100vh-80px)]">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 ${
                  activeConversation === conv.id ? 'bg-muted' : ''
                }`}
                onClick={() => setActiveConversation(conv.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={conv.other_user_avatar} />
                    <AvatarFallback>
                      {conv.other_user_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{conv.other_user_name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(conv.last_message_at)}
                    </p>
                  </div>
                  {conv.unread_count && conv.unread_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>
                    {conversations.find(c => c.id === activeConversation)?.other_user_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">
                    {conversations.find(c => c.id === activeConversation)?.other_user_name || otherUserName}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {userType === 'tutor' ? 'Student' : 'Tutor'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loading ? (
                <div className="text-center text-muted-foreground">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.sender_id === session.user.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        message.sender_id === session.user.id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender_id === session.user.id
                          ? 'text-primary-foreground/70'
                          : 'text-muted-foreground'
                      }`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                />
                <Button onClick={sendMessage} disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;

// Explicit named export as well to resolve any module issues
export { ChatInterface };