/**
 * SessionPulse — 1-question "Did this session help you learn?" (1-5).
 *
 * Frequency-capped per surface via `shouldShowPulse` (72h cooldown stored
 * in localStorage) so students are never nagged. Renders nothing when the
 * cooldown is active. Dismissal also starts the cooldown.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  sendPulseFeedback,
  shouldShowPulse,
  markPulseShown,
  type FeedbackSurface,
} from "@/lib/feedback";

interface Props {
  surface: FeedbackSurface;
  subjectName?: string | null;
  topicName?: string | null;
  context?: Record<string, unknown>;
  question?: string;
  className?: string;
}

const LABELS = ["Not at all", "A little", "Somewhat", "A lot", "Hugely"];

export function SessionPulse({
  surface,
  subjectName,
  topicName,
  context,
  question = "Did this session help you learn?",
  className,
}: Props) {
  // Evaluate the cooldown once on mount.
  const [visible] = useState(() => shouldShowPulse(surface));
  const [state, setState] = useState<"idle" | "done" | "dismissed">("idle");
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState(0);

  if (!visible || state === "dismissed") return null;

  if (state === "done") {
    return (
      <p className={cn("text-xs text-center text-muted-foreground", className)}>
        Thanks — this helps us make StudySync better for you.
      </p>
    );
  }

  const rate = async (rating: number) => {
    setBusy(true);
    await sendPulseFeedback({ surface, rating, subjectName, topicName, context });
    setBusy(false);
    setState("done");
  };

  const dismiss = () => {
    markPulseShown(surface);
    setState("dismissed");
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border bg-muted/40 p-3 space-y-2",
        className
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1 h-6 w-6"
        aria-label="Dismiss"
        onClick={dismiss}
      >
        <X className="h-3 w-3" />
      </Button>
      <p className="text-xs font-medium pr-6">{question}</p>
      <div
        className="flex items-center justify-center gap-1"
        onMouseLeave={() => setHover(0)}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={busy}
            aria-label={`${n} of 5 — ${LABELS[n - 1]}`}
            onMouseEnter={() => setHover(n)}
            onClick={() => rate(n)}
            className={cn(
              "h-9 w-9 rounded-lg border text-sm font-semibold transition-colors",
              hover >= n
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-center text-muted-foreground h-3">
        {hover > 0 ? LABELS[hover - 1] : "1 = not at all · 5 = hugely"}
      </p>
    </div>
  );
}
