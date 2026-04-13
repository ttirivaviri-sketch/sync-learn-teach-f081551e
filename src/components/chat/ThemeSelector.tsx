import { useState } from "react";
import { Palette, Check, ChevronDown } from "lucide-react";
import { CHAT_THEMES, type ChatTheme } from "./chatThemes";

interface ThemeSelectorProps {
  activeTheme: ChatTheme;
  onSelect: (theme: ChatTheme) => void;
}

export function ThemeSelector({ activeTheme, onSelect }: ThemeSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium
                   bg-white/15 hover:bg-white/25 text-inherit transition-colors"
        aria-label="Change chat theme"
      >
        <Palette className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{activeTheme.name}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 animate-fade-in">
            <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Chat Theme
            </p>
            {CHAT_THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => { onSelect(theme); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors
                  ${activeTheme.id === theme.id
                    ? "bg-slate-100 font-medium text-slate-900"
                    : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full shadow-inner border border-white/50"
                  style={{ background: theme.swatch }}
                />
                <span className="flex-1 text-left">{theme.name}</span>
                {activeTheme.id === theme.id && <Check className="h-3.5 w-3.5 text-blue-600" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
