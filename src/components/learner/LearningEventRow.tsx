/**
 * LearningEventRow — single visual unit for any learning_events row.
 * Used by LearnerActivityTab and (compact) in TutorBriefing.
 */
import { BookOpen, GraduationCap, Sparkles, FileText, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import type { LearningEventRow as LERow } from "@/hooks/useLearningTimeline";

interface Props {
  event: LERow;
  compact?: boolean;
  onClick?: (event: LERow) => void;
}

const SOURCE_META: Record<string, { label: string; Icon: typeof BookOpen }> = {
  topic_session: { label: "Topic session", Icon: BookOpen },
  school_homework: { label: "Homework", Icon: GraduationCap },
  lesson_reinforcement: { label: "Lesson recap", Icon: Sparkles },
  daily_task: { label: "Daily task", Icon: FileText },
  mock_exam: { label: "Mock exam", Icon: FileText },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function LearningEventRow({ event, compact = false, onClick }: Props) {
  const meta = SOURCE_META[event.source] ?? { label: event.source, Icon: FileText };
  const Icon = meta.Icon;
  const score = event.score_pct;
  const scoreColor =
    score == null
      ? "outline"
      : score >= 75
      ? "default"
      : score >= 50
      ? "secondary"
      : "destructive";
  const delta = event.mastery_delta ?? 0;

  const handle = () => {
    if (!onClick) return;
    haptic("light");
    onClick(event);
  };

  return (
    <button
      type="button"
      onClick={handle}
      disabled={!onClick}
      className={cn(
        "w-full flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left",
        "animate-fade-in transition-all",
        onClick && "hover:bg-accent/40 active:scale-[0.98] cursor-pointer",
        !onClick && "cursor-default",
        compact && "p-2"
      )}
    >
      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-medium text-foreground truncate", compact ? "text-xs" : "text-sm")}>
            {event.topic_name || meta.label}
          </p>
          {score != null && (
            <Badge variant={scoreColor as any} className="text-[10px] shrink-0">
              {Math.round(score)}%
            </Badge>
          )}
        </div>
        <div className={cn("flex items-center gap-2 text-muted-foreground mt-0.5", compact ? "text-[10px]" : "text-xs")}>
          <span>{meta.label}</span>
          <span>·</span>
          <span>{relativeTime(event.occurred_at)}</span>
          {delta !== 0 && (
            <span className={cn("inline-flex items-center gap-0.5", delta > 0 ? "text-emerald-500" : "text-destructive")}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(Math.round(delta * 100))}%
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
