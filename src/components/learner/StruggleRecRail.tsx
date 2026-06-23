/**
 * StruggleRecRail — surfaces the 3 most recent low-score topics from the
 * unified learning timeline. Tapping a chip triggers a search inside the
 * library (handled by parent via onTopic).
 */
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useLearningTimeline } from "@/hooks/useLearningTimeline";
import { supabase } from "@/integrations/supabase/client";
import { haptic } from "@/lib/haptics";
import { Badge } from "@/components/ui/badge";

interface Props {
  onTopic?: (topic: string) => void;
}

export function StruggleRecRail({ onTopic }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
  }, []);

  const { data: timeline = [] } = useLearningTimeline({ userId, limit: 30 });

  const topics = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    const seen = new Map<string, number>();
    for (const e of timeline) {
      if (!e.topic_name) continue;
      if (e.score_pct == null || e.score_pct >= 60) continue;
      if (new Date(e.occurred_at).getTime() < cutoff) continue;
      if (!seen.has(e.topic_name)) seen.set(e.topic_name, e.score_pct);
    }
    return Array.from(seen.entries()).slice(0, 3);
  }, [timeline]);

  if (topics.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent p-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-medium text-foreground">Recommended because you struggled</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {topics.map(([topic, score]) => (
          <Badge
            key={topic}
            variant="outline"
            className="cursor-pointer whitespace-nowrap shrink-0 active:scale-95 transition-transform gap-1"
            onClick={() => { haptic("light"); onTopic?.(topic); }}
          >
            {topic}
            <span className="text-[10px] text-muted-foreground">{Math.round(score)}%</span>
            <ArrowRight className="h-3 w-3 ml-0.5" />
          </Badge>
        ))}
      </div>
    </div>
  );
}
