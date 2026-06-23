/**
 * SmartSuggestionStrip — contextual "next best action" pulled from
 * useLearningGaps. Renders on Home tab; tapping pre-fills the search.
 * Dismissable for the day (per-browser localStorage key).
 */
import { useEffect, useMemo, useState } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { useLearningGaps } from "@/hooks/useLearningGaps";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";

interface Props {
  onSuggest: (subjectOrTopic: string) => void;
  className?: string;
}

function todayKey() {
  return `smart-suggest-dismissed:${new Date().toISOString().slice(0, 10)}`;
}

export function SmartSuggestionStrip({ onSuggest, className }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    try {
      if (localStorage.getItem(todayKey()) === "1") setDismissed(true);
    } catch { /* ignore */ }
  }, []);

  const { data } = useLearningGaps(userId);

  const top = useMemo(() => {
    const weak = data?.weak_topics ?? [];
    return weak.find((w) => w.severity === "critical") || weak[0] || null;
  }, [data]);

  if (dismissed || !top) return null;

  const handleTap = () => {
    haptic("light");
    onSuggest(top.topic);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic("selection");
    try { localStorage.setItem(todayKey(), "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <button
      type="button"
      onClick={handleTap}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-2xl text-left",
        "bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5",
        "border border-primary/20 shadow-sm",
        "animate-fade-in transition-all hover:shadow-md active:scale-[0.99]",
        className
      )}
    >
      <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          Suggested for you
        </p>
        <p className="text-sm font-medium text-foreground truncate">
          Struggling with <span className="text-primary">{top.topic}</span>? Find a tutor
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss suggestion"
        className="ml-1 h-7 w-7 rounded-full flex items-center justify-center hover:bg-background/60 shrink-0"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </button>
  );
}
