/**
 * FeedbackWidget — compact thumbs up/down for AI outputs.
 *
 * Drop next to any AI-generated result (marking, quiz results, photo solve
 * grading). Thumbs-up submits immediately; thumbs-down reveals reason chips
 * plus an optional short comment. One-shot per mount: collapses to a
 * "Thanks" line after submission.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  sendOutputFeedback,
  REASON_LABELS,
  type FeedbackSurface,
  type FeedbackReason,
} from "@/lib/feedback";

interface Props {
  surface: FeedbackSurface;
  subjectName?: string | null;
  topicName?: string | null;
  /** Extra context saved with the row, e.g. { attempt_id, score_pct } */
  context?: Record<string, unknown>;
  /** Question shown above the thumbs. Default: "Was this helpful?" */
  prompt?: string;
  className?: string;
}

const REASONS: FeedbackReason[] = [
  "wrong_answer",
  "too_easy",
  "too_hard",
  "confusing",
  "off_syllabus",
  "other",
];

export function FeedbackWidget({
  surface,
  subjectName,
  topicName,
  context,
  prompt = "Was this helpful?",
  className,
}: Props) {
  const [state, setState] = useState<"idle" | "reason" | "done">("idle");
  const [reason, setReason] = useState<FeedbackReason | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (
    sentiment: "up" | "down",
    r?: FeedbackReason,
    c?: string
  ) => {
    setBusy(true);
    await sendOutputFeedback({
      surface,
      sentiment,
      reason: r,
      comment: c?.trim() || undefined,
      subjectName,
      topicName,
      context,
    });
    setBusy(false);
    setState("done");
  };

  if (state === "done") {
    return (
      <div
        className={cn(
          "flex items-center gap-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Check className="h-3.5 w-3.5 text-success" />
        Thanks — your feedback improves StudySync.
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{prompt}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={busy}
          aria-label="Helpful"
          onClick={() => submit("up")}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={busy}
          aria-label="Not helpful"
          onClick={() => setState("reason")}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {state === "reason" && (
        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-2.5">
          <p className="text-xs font-medium">What went wrong?</p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                  reason === r
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {REASON_LABELS[r]}
              </button>
            ))}
          </div>
          {reason === "other" && (
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us more (optional)"
              rows={2}
              maxLength={500}
              className="text-xs"
            />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 text-xs"
              disabled={busy || !reason}
              onClick={() => submit("down", reason ?? undefined, comment)}
            >
              Send
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              disabled={busy}
              onClick={() => submit("down")}
            >
              Skip
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
