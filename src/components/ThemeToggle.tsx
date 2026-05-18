import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

export const ThemeToggle = () => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  // next-themes needs a mounted check to avoid hydration mismatch on SSR/CSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options: { value: string; label: string; icon: React.ReactNode }[] = [
    { value: "light", label: "Light", icon: <Sun className="h-4 w-4" /> },
    { value: "dark",  label: "Dark",  icon: <Moon className="h-4 w-4" /> },
    { value: "system",label: "Auto",  icon: <Monitor className="h-4 w-4" /> },
  ];

  // Active = the stored preference (not resolved), so the button highlights correctly.
  const active = mounted ? (theme ?? "system") : "system";

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50">
      <div className="flex items-center gap-2">
        {mounted && resolvedTheme === "dark"
          ? <Moon className="h-4 w-4 text-muted-foreground" />
          : <Sun  className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-medium text-foreground">Appearance</span>
      </div>
      <div className="inline-flex rounded-full bg-muted p-1 gap-0.5">
        {options.map((opt) => {
          const isActive = active === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={`${opt.label} mode`}
              aria-pressed={isActive}
            >
              {opt.icon}
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── Compact toggle (Sun/Moon only) — used in headers ─────────────────────────
export const CompactThemeToggle = ({ className }: { className?: string }) => {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-full",
        "text-white/80 hover:text-white hover:bg-white/15 transition-colors",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Sun  className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </button>
  );
};
