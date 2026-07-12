/**
 * WeakTopicReport — school-context weak topic panel powered by detect-gaps.
 * Fuses evidence from quizzes, daily tasks and school homework.
 */
import { useState } from "react";
import { AlertTriangle, ShieldAlert, Eye, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLearningGaps, type WeakTopic } from "@/hooks/useLearningGaps";

const sevConfig: Record<WeakTopic["severity"], { icon: any; label: string; cls: string }> = {
  critical: { icon: ShieldAlert, label: "Critical", cls: "text-destructive bg-destructive/10 border-destructive/30" },
  warning: { icon: AlertTriangle, label: "Needs work", cls: "text-warning bg-warning/10 border-warning/30" },
  watch: { icon: Eye, label: "Watch", cls: "text-accent-foreground bg-accent/10 border-accent/30" },
};

export function WeakTopicReport({
  userId,
  onStartPractice,
}: {
  userId: string | null;
  onStartPractice?: (topic: string, subjectId: string | null) => void;
}) {
  const { data, isLoading, isFetching, refetch, error } = useLearningGaps(userId);
  const [refreshing, setRefreshing] = useState(false);

  if (!userId) return null;

  if (isLoading) {
    return (
      <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-accent-foreground" />
        <p className="text-sm text-muted-foreground">Scanning your school work for weak topics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
        <p className="text-sm text-destructive mb-2">Couldn't analyse your gaps.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }

  if (!data || data.weak_topics.length === 0) {
    return (
      <div className="p-3 rounded-xl bg-success/10 border border-success/30 text-center">
        <p className="text-sm text-success font-medium">No weak topics across your school work 🎉</p>
        <p className="text-xs text-muted-foreground mt-1">Keep going — last 30 days look solid.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Learning gap report</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1"
            disabled={isFetching || refreshing}
            onClick={async () => {
              setRefreshing(true);
              await refetch();
              setRefreshing(false);
            }}
          >
            <RefreshCw className={cn("h-3 w-3", (isFetching || refreshing) && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Built from your quizzes, daily tasks and school homework (last {data.window_days} days).
        </p>
      </div>

      <div className="space-y-2">
        {data.weak_topics.map((w, i) => {
          const cfg = sevConfig[w.severity];
          const Icon = cfg.icon;
          return (
            <div key={`${w.topic}-${i}`} className={cn("p-3 rounded-xl border", cfg.cls)}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{w.topic}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {w.accuracy}% accuracy across {w.attempts} attempts · {w.evidence_source.join(", ")}
                    </p>
                  </div>
                </div>
                {onStartPractice && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 shrink-0"
                    onClick={() => onStartPractice(w.topic, w.subject_id)}
                  >
                    Practice
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
