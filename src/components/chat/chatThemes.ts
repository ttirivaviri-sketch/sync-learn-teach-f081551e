/**
 * Chat palette / theme definitions.
 *
 * Each theme supplies Tailwind utility-class tokens so the UI never
 * has to hard-code colours — it simply reads the active theme object.
 */

export interface ChatTheme {
  /** Display name shown in the selector */
  name: string;
  /** Unique slug (persisted in localStorage) */
  id: string;
  /** Preview swatch — a CSS gradient or solid colour for the selector pill */
  swatch: string;

  /* ── Sidebar (conversation list) ─────────────────────── */
  sidebarBg: string;
  sidebarHeaderBg: string;
  sidebarHeaderText: string;
  sidebarItemHover: string;
  sidebarItemActive: string;
  sidebarItemActiveText: string;
  sidebarText: string;
  sidebarMuted: string;
  sidebarBorder: string;
  sidebarSearchBg: string;

  /* ── Chat area ──────────────────────────────────────── */
  chatBg: string;
  chatHeaderBg: string;
  chatHeaderText: string;
  chatHeaderBorder: string;

  /* ── Message bubbles ────────────────────────────────── */
  bubbleSelf: string;
  bubbleSelfText: string;
  bubbleSelfTime: string;
  bubbleOther: string;
  bubbleOtherText: string;
  bubbleOtherTime: string;

  /* ── Input area ─────────────────────────────────────── */
  inputBg: string;
  inputBorder: string;
  inputFieldBg: string;
  sendBtn: string;
  sendBtnText: string;

  /* ── Empty state / accent ───────────────────────────── */
  emptyIcon: string;
  emptyText: string;
  accentGradient: string;
}

// ── Theme definitions ──────────────────────────────────────────────────────

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: "studysync-blue",
    name: "StudySync Blue",
    swatch: "linear-gradient(135deg, #3b63f5, #2d52e0)",
    sidebarBg: "bg-slate-50",
    sidebarHeaderBg: "bg-gradient-to-r from-[#1a3fc4] to-[#3b63f5]",
    sidebarHeaderText: "text-white",
    sidebarItemHover: "hover:bg-blue-50",
    sidebarItemActive: "bg-blue-100",
    sidebarItemActiveText: "text-blue-900",
    sidebarText: "text-slate-800",
    sidebarMuted: "text-slate-500",
    sidebarBorder: "border-slate-200",
    sidebarSearchBg: "bg-white/80",
    chatBg: "bg-gradient-to-b from-blue-50/40 to-white",
    chatHeaderBg: "bg-white/90 backdrop-blur-md",
    chatHeaderText: "text-slate-900",
    chatHeaderBorder: "border-slate-200",
    bubbleSelf: "bg-gradient-to-br from-[#3b63f5] to-[#2d52e0]",
    bubbleSelfText: "text-white",
    bubbleSelfTime: "text-white/70",
    bubbleOther: "bg-white",
    bubbleOtherText: "text-slate-800",
    bubbleOtherTime: "text-slate-400",
    inputBg: "bg-white/95 backdrop-blur-md",
    inputBorder: "border-slate-200",
    inputFieldBg: "bg-slate-100",
    sendBtn: "bg-gradient-to-r from-[#3b63f5] to-[#2d52e0] hover:from-[#2d52e0] hover:to-[#1a3fc4]",
    sendBtnText: "text-white",
    emptyIcon: "text-blue-300",
    emptyText: "text-slate-400",
    accentGradient: "from-[#3b63f5] to-[#2d52e0]",
  },
  {
    id: "tutor-teal",
    name: "Tutor Teal",
    swatch: "linear-gradient(135deg, #0d9488, #14b8a6)",
    sidebarBg: "bg-teal-50/60",
    sidebarHeaderBg: "bg-gradient-to-r from-teal-700 to-teal-500",
    sidebarHeaderText: "text-white",
    sidebarItemHover: "hover:bg-teal-100",
    sidebarItemActive: "bg-teal-200/70",
    sidebarItemActiveText: "text-teal-900",
    sidebarText: "text-slate-800",
    sidebarMuted: "text-slate-500",
    sidebarBorder: "border-teal-200",
    sidebarSearchBg: "bg-white/80",
    chatBg: "bg-gradient-to-b from-teal-50/30 to-white",
    chatHeaderBg: "bg-white/90 backdrop-blur-md",
    chatHeaderText: "text-slate-900",
    chatHeaderBorder: "border-teal-200",
    bubbleSelf: "bg-gradient-to-br from-teal-500 to-teal-600",
    bubbleSelfText: "text-white",
    bubbleSelfTime: "text-white/70",
    bubbleOther: "bg-white",
    bubbleOtherText: "text-slate-800",
    bubbleOtherTime: "text-slate-400",
    inputBg: "bg-white/95 backdrop-blur-md",
    inputBorder: "border-teal-200",
    inputFieldBg: "bg-teal-50",
    sendBtn: "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700",
    sendBtnText: "text-white",
    emptyIcon: "text-teal-300",
    emptyText: "text-slate-400",
    accentGradient: "from-teal-500 to-teal-600",
  },
  {
    id: "midnight",
    name: "Midnight",
    swatch: "linear-gradient(135deg, #1e1b4b, #312e81)",
    sidebarBg: "bg-indigo-950",
    sidebarHeaderBg: "bg-gradient-to-r from-indigo-950 to-violet-900",
    sidebarHeaderText: "text-indigo-100",
    sidebarItemHover: "hover:bg-indigo-900/50",
    sidebarItemActive: "bg-indigo-800/60",
    sidebarItemActiveText: "text-indigo-100",
    sidebarText: "text-indigo-200",
    sidebarMuted: "text-indigo-400",
    sidebarBorder: "border-indigo-800",
    sidebarSearchBg: "bg-indigo-900/60",
    chatBg: "bg-gradient-to-b from-slate-900 to-indigo-950",
    chatHeaderBg: "bg-slate-900/90 backdrop-blur-md",
    chatHeaderText: "text-indigo-100",
    chatHeaderBorder: "border-indigo-800",
    bubbleSelf: "bg-gradient-to-br from-violet-600 to-indigo-600",
    bubbleSelfText: "text-white",
    bubbleSelfTime: "text-white/60",
    bubbleOther: "bg-indigo-900/80",
    bubbleOtherText: "text-indigo-100",
    bubbleOtherTime: "text-indigo-400",
    inputBg: "bg-slate-900/90 backdrop-blur-md",
    inputBorder: "border-indigo-800",
    inputFieldBg: "bg-indigo-900/50",
    sendBtn: "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500",
    sendBtnText: "text-white",
    emptyIcon: "text-indigo-600",
    emptyText: "text-indigo-500",
    accentGradient: "from-violet-600 to-indigo-600",
  },
  {
    id: "sunset",
    name: "Sunset",
    swatch: "linear-gradient(135deg, #f97316, #ec4899)",
    sidebarBg: "bg-orange-50/60",
    sidebarHeaderBg: "bg-gradient-to-r from-orange-500 to-pink-500",
    sidebarHeaderText: "text-white",
    sidebarItemHover: "hover:bg-orange-100",
    sidebarItemActive: "bg-orange-200/60",
    sidebarItemActiveText: "text-orange-900",
    sidebarText: "text-slate-800",
    sidebarMuted: "text-slate-500",
    sidebarBorder: "border-orange-200",
    sidebarSearchBg: "bg-white/80",
    chatBg: "bg-gradient-to-b from-orange-50/30 to-rose-50/20",
    chatHeaderBg: "bg-white/90 backdrop-blur-md",
    chatHeaderText: "text-slate-900",
    chatHeaderBorder: "border-orange-200",
    bubbleSelf: "bg-gradient-to-br from-orange-500 to-pink-500",
    bubbleSelfText: "text-white",
    bubbleSelfTime: "text-white/70",
    bubbleOther: "bg-white",
    bubbleOtherText: "text-slate-800",
    bubbleOtherTime: "text-slate-400",
    inputBg: "bg-white/95 backdrop-blur-md",
    inputBorder: "border-orange-200",
    inputFieldBg: "bg-orange-50",
    sendBtn: "bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600",
    sendBtnText: "text-white",
    emptyIcon: "text-orange-300",
    emptyText: "text-slate-400",
    accentGradient: "from-orange-500 to-pink-500",
  },
  {
    id: "forest",
    name: "Forest",
    swatch: "linear-gradient(135deg, #166534, #15803d)",
    sidebarBg: "bg-emerald-50/60",
    sidebarHeaderBg: "bg-gradient-to-r from-green-800 to-emerald-600",
    sidebarHeaderText: "text-white",
    sidebarItemHover: "hover:bg-emerald-100",
    sidebarItemActive: "bg-emerald-200/60",
    sidebarItemActiveText: "text-emerald-900",
    sidebarText: "text-slate-800",
    sidebarMuted: "text-slate-500",
    sidebarBorder: "border-emerald-200",
    sidebarSearchBg: "bg-white/80",
    chatBg: "bg-gradient-to-b from-emerald-50/30 to-green-50/20",
    chatHeaderBg: "bg-white/90 backdrop-blur-md",
    chatHeaderText: "text-slate-900",
    chatHeaderBorder: "border-emerald-200",
    bubbleSelf: "bg-gradient-to-br from-green-600 to-emerald-600",
    bubbleSelfText: "text-white",
    bubbleSelfTime: "text-white/70",
    bubbleOther: "bg-white",
    bubbleOtherText: "text-slate-800",
    bubbleOtherTime: "text-slate-400",
    inputBg: "bg-white/95 backdrop-blur-md",
    inputBorder: "border-emerald-200",
    inputFieldBg: "bg-emerald-50",
    sendBtn: "bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700",
    sendBtnText: "text-white",
    emptyIcon: "text-emerald-300",
    emptyText: "text-slate-400",
    accentGradient: "from-green-600 to-emerald-600",
  },
];

/** Resolve a theme by id (falls back to StudySync Blue). */
export function getThemeById(id: string): ChatTheme {
  return CHAT_THEMES.find((t) => t.id === id) ?? CHAT_THEMES[0];
}

/** localStorage key for persisted theme choice */
export const CHAT_THEME_STORAGE_KEY = "studysync-chat-theme";
