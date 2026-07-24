/**
 * FocusBadge — disclosed-monitoring indicator shown during study sessions,
 * plus a post-session focus score line. Students always see that focus
 * tracking is on and what it recorded; the same data feeds guardian/tutor/
 * school reporting.
 */
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IntegritySummary } from "../lib/integrity";

export function FocusTrackingIndicator({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        className,
      )}
      title="Focus tracking is on: switching away, copying the question, or pasting answers is recorded and shared in your progress reports."
    >
      <Eye className="h-3 w-3" />
      Focus tracking on
    </span>
  );
}

export function FocusScoreLine({
  summary,
  className,
}: {
  summary: IntegritySummary;
  className?: string;
}) {
  const good = summary.focusScore >= 80;
  return (
    <div className={cn("text-sm", className)}>
      <span className={cn("font-semibold", good ? "text-green-600" : "text-amber-600")}>
        Focus score: {summary.focusScore}%
      </span>
      <span className="text-muted-foreground">
        {" — "}
        {summary.questionsTotal - summary.questionsFlagged}/{summary.questionsTotal} questions answered without interruption
        {summary.tabSwitches > 0 && `, ${summary.tabSwitches} switch${summary.tabSwitches === 1 ? "" : "es"} away`}
        {summary.pasteEvents > 0 && `, ${summary.pasteEvents} pasted answer${summary.pasteEvents === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}
