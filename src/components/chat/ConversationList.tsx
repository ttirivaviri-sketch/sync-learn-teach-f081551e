import { useState } from "react";
import { MessageCircle, X, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeSelector } from "./ThemeSelector";
import type { ChatTheme } from "./chatThemes";

export interface Conversation {
  id: string;
  tutor_id: string;
  learner_id: string;
  last_message_at: string;
  other_user_name?: string;
  other_user_avatar?: string;
  unread_count?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  formatTime: (timestamp: string) => string;
  theme: ChatTheme;
  onThemeChange: (theme: ChatTheme) => void;
  /** Mobile: whether the sidebar is visible */
  isMobileOpen: boolean;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  onClose,
  formatTime,
  theme,
  onThemeChange,
  isMobileOpen,
}: ConversationListProps) {
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? conversations.filter((c) =>
        c.other_user_name?.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  return (
    <aside
      className={`
        ${theme.sidebarBg} ${theme.sidebarBorder}
        flex flex-col border-r h-full
        transition-transform duration-300 ease-in-out
        /* mobile: absolute overlay; desktop: fixed column */
        fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[340px]
        md:static md:w-80 md:translate-x-0
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <div className={`${theme.sidebarHeaderBg} ${theme.sidebarHeaderText} px-4 py-3.5 shrink-0`}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5" />
            Messages
          </h2>
          <div className="flex items-center gap-1.5">
            <ThemeSelector activeTheme={theme} onSelect={onThemeChange} />
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 rounded-full p-0 text-inherit hover:bg-white/15"
            >
              <ArrowLeft className="h-4 w-4 md:hidden" />
              <X className="h-4 w-4 hidden md:block" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className={`w-full rounded-lg ${theme.sidebarSearchBg} pl-9 pr-3 py-2 text-sm
                        placeholder:opacity-60 outline-none border-0
                        focus:ring-2 focus:ring-white/30 transition`}
          />
        </div>
      </div>

      {/* ── Conversation list ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className={`p-6 text-center ${theme.sidebarMuted} text-sm`}>
            {search ? "No matches found" : "No conversations yet"}
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = activeConversationId === conv.id;
            return (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                className={`
                  px-4 py-3.5 cursor-pointer transition-colors border-b ${theme.sidebarBorder}
                  ${isActive
                    ? `${theme.sidebarItemActive} ${theme.sidebarItemActiveText}`
                    : `${theme.sidebarItemHover}`
                  }
                `}
                onClick={() => onSelect(conv.id)}
                onKeyDown={(e) => e.key === "Enter" && onSelect(conv.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={conv.other_user_avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-slate-200 to-slate-300 text-slate-600 text-sm font-semibold">
                        {conv.other_user_name?.[0]?.toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online dot placeholder */}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium truncate text-sm ${isActive ? "" : theme.sidebarText}`}>
                      {conv.other_user_name}
                    </h4>
                    <p className={`text-xs ${theme.sidebarMuted} truncate`}>
                      {formatTime(conv.last_message_at)}
                    </p>
                  </div>
                  {conv.unread_count != null && conv.unread_count > 0 && (
                    <Badge
                      className="bg-red-500 text-white text-[10px] h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5"
                    >
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
