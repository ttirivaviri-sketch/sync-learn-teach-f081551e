/**
 * ContinueLearningBanner — Study Mode "pick up where you left off".
 * Reads the most recent topic_session from the unified learning timeline.
 */
import { useEffect, useState } from "react";
import { Play, BookOpen } from "lucide-react";
import { useLearningTimeline } from "@/hooks/useLearningTimeline";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

interface Props {
  onResume: (payload: { topic: string; subject?: string; curriculum?: string }) => void;
  className?: string;
}

export function ContinueLearningBanner({ onResume, className }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const { data: events } = useLearningTimeline({
    userId,
    sources: ["topic_session"],
    limit: 1,
  });

  const last = events?.[0];
  if (!last || !last.topic_name) return null;

  const payload = last.payload as { subject?: string; curriculum?: string } | null;
  const ageHours = (Date.now() - new Date(last.occurred_at).getTime()) / 3_600_000;
  if (ageHours > 72) return null; // only nudge for the last 3 days

  const handleClick = () => {
    haptic("light");
    onResume({
      topic: last.topic_name as string,
      subject: payload?.subject,
      curriculum: payload?.curriculum,
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-2xl text-left",
        "bg-gradient-to-r from-accent/15 to-primary/10 border border-accent/30",
        "animate-fade-in transition-all hover:shadow-md active:scale-[0.99]",
        className
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
        <BookOpen className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
          Continue where you left off
        </p>
        <p className="text-sm font-semibold text-foreground truncate">{last.topic_name}</p>
        {payload?.subject && (
          <p className="text-xs text-muted-foreground truncate">{payload.subject}</p>
        )}
      </div>
      <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow">
        <Play className="h-4 w-4 ml-0.5" />
      </div>
    </button>
  );
}
