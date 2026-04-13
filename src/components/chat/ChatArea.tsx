import { useRef, useEffect, useState } from "react";
import { Send, MessageCircle, Menu, Smile, Paperclip, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChatTheme } from "./chatThemes";

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
}

interface ChatAreaProps {
  messages: Message[];
  loading: boolean;
  newMessage: string;
  currentUserId: string;
  otherUserName: string;
  userType: "tutor" | "learner";
  onNewMessageChange: (value: string) => void;
  onSendMessage: () => void;
  formatTime: (timestamp: string) => string;
  theme: ChatTheme;
  onToggleSidebar: () => void;
}

/** Group consecutive messages by the same sender within a 2-minute window. */
function shouldShowTimestamp(messages: Message[], idx: number): boolean {
  if (idx === 0) return true;
  const cur = messages[idx];
  const prev = messages[idx - 1];
  if (cur.sender_id !== prev.sender_id) return true;
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 120_000;
}

export function ChatArea({
  messages,
  loading,
  newMessage,
  currentUserId,
  otherUserName,
  userType,
  onNewMessageChange,
  onSendMessage,
  formatTime,
  theme,
  onToggleSidebar,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isTyping] = useState(false); // placeholder for future feature

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className={`flex flex-col h-full ${theme.chatBg}`}>
      {/* ── Chat Header ────────────────────────────────────── */}
      <div className={`${theme.chatHeaderBg} border-b ${theme.chatHeaderBorder} px-4 py-3 shrink-0`}>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="h-8 w-8 rounded-full p-0 md:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className={`bg-gradient-to-br ${theme.accentGradient} text-white text-sm font-semibold`}>
              {otherUserName?.[0]?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm ${theme.chatHeaderText}`}>{otherUserName}</h3>
            <p className="text-xs text-emerald-500 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
              {userType === "tutor" ? "Student" : "Tutor"} &middot; Online
            </p>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full p-0 opacity-50">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className="animate-spin h-8 w-8 border-2 border-current border-t-transparent rounded-full mx-auto opacity-40" />
              <p className={`text-sm ${theme.emptyText}`}>Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div className={`h-16 w-16 mx-auto rounded-full bg-gradient-to-br ${theme.accentGradient} flex items-center justify-center opacity-20`}>
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
              <p className={`text-sm ${theme.emptyText}`}>
                No messages yet. Say hello!
              </p>
            </div>
          </div>
        ) : (
          messages.map((message, idx) => {
            const isSelf = message.sender_id === currentUserId;
            const showTime = shouldShowTimestamp(messages, idx);
            const showAvatar = idx === messages.length - 1 || messages[idx + 1]?.sender_id !== message.sender_id;

            return (
              <div key={message.id}>
                {showTime && (
                  <div className={`text-center my-3 ${isSelf ? "" : ""}`}>
                    <span className="text-[10px] bg-black/5 rounded-full px-2.5 py-0.5 text-slate-400">
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isSelf ? "justify-end" : "justify-start"} mb-0.5`}>
                  {/* Other user avatar */}
                  {!isSelf && showAvatar && (
                    <Avatar className="h-7 w-7 mr-2 mt-auto shrink-0">
                      <AvatarFallback className="text-[10px] bg-slate-200 text-slate-500">
                        {otherUserName?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {!isSelf && !showAvatar && <div className="w-9 shrink-0" />}

                  <div
                    className={`
                      max-w-[75%] sm:max-w-[65%] rounded-2xl px-3.5 py-2 shadow-sm
                      ${isSelf
                        ? `${theme.bubbleSelf} ${theme.bubbleSelfText} rounded-br-md`
                        : `${theme.bubbleOther} ${theme.bubbleOtherText} rounded-bl-md`
                      }
                    `}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start mb-1">
            <div className={`${theme.bubbleOther} rounded-2xl rounded-bl-md px-4 py-2.5 shadow-sm`}>
              <div className="flex gap-1">
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ─────────────────────────────────────── */}
      <div className={`${theme.inputBg} border-t ${theme.inputBorder} px-3 py-3 shrink-0`}>
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <Button variant="ghost" size="sm" className="h-9 w-9 rounded-full p-0 opacity-40 shrink-0" tabIndex={-1}>
            <Paperclip className="h-4 w-4" />
          </Button>
          <div className={`flex-1 ${theme.inputFieldBg} rounded-2xl px-4 py-2.5 flex items-center gap-2`}>
            <input
              ref={inputRef}
              value={newMessage}
              onChange={(e) => onNewMessageChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
            <button className="opacity-40 hover:opacity-70 transition" tabIndex={-1}>
              <Smile className="h-4 w-4" />
            </button>
          </div>
          <Button
            onClick={onSendMessage}
            disabled={!newMessage.trim()}
            className={`h-10 w-10 rounded-full p-0 shrink-0 shadow-md ${theme.sendBtn} ${theme.sendBtnText}
                        disabled:opacity-40 disabled:shadow-none transition-all`}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function EmptyChatArea({ theme, onToggleSidebar }: { theme: ChatTheme; onToggleSidebar: () => void }) {
  return (
    <div className={`flex flex-col h-full ${theme.chatBg}`}>
      {/* Minimal header for mobile menu */}
      <div className={`${theme.chatHeaderBg} border-b ${theme.chatHeaderBorder} px-4 py-3 shrink-0 md:hidden`}>
        <Button variant="ghost" size="sm" onClick={onToggleSidebar} className="h-8 w-8 rounded-full p-0">
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className={`h-20 w-20 mx-auto rounded-full bg-gradient-to-br ${theme.accentGradient} flex items-center justify-center opacity-15`}>
            <MessageCircle className="h-10 w-10 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold text-lg ${theme.emptyText}`}>Your Messages</h3>
            <p className={`text-sm mt-1 ${theme.emptyText} opacity-70`}>
              Select a conversation to start messaging
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
