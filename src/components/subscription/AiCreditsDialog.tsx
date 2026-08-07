/**
 * AiCreditsDialog — global upgrade prompt shown whenever an AI request fails
 * because credits are exhausted or the daily free allowance is used up.
 *
 * Mounted once in App.tsx; it listens on the AI limit event bus so any AI
 * call site gets the upgrade flow for free.
 */
import { useEffect, useState } from "react";
import { Sparkles, Zap } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SubscriptionFlow } from "@/components/subscription/SubscriptionFlow";
import { onAiLimit, type AiLimitEvent } from "@/studymode/lib/aiLimitBus";

export function AiCreditsDialog() {
  const [event, setEvent] = useState<AiLimitEvent | null>(null);
  const [showPlans, setShowPlans] = useState(false);

  useEffect(
    () =>
      onAiLimit((e) => {
        setShowPlans(false);
        setEvent(e);
      }),
    [],
  );

  const open = event !== null;
  const isDaily = event?.reason === "daily_limit_reached";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setEvent(null);
          setShowPlans(false);
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {isDaily ? "Daily AI limit reached" : "You're out of AI credits"}
          </DialogTitle>
          <DialogDescription>
            {event?.message ??
              "Top up to keep generating tasks, quizzes and explanations."}
          </DialogDescription>
        </DialogHeader>

        {showPlans ? (
          <SubscriptionFlow
            mode="profile"
            onComplete={() => {
              setEvent(null);
              setShowPlans(false);
            }}
          />
        ) : (
          <div className="space-y-4">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Unlimited AI study tasks, quizzes and photo-solve
              </li>
              <li className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Priority generation with no daily cap
              </li>
              <li className="flex items-start gap-2">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                Cancel or change your plan any time
              </li>
            </ul>

            {isDaily && typeof event?.used === "number" && typeof event?.limit === "number" && (
              <p className="text-xs text-muted-foreground">
                Used {event.used} of {event.limit} free AI actions today.
              </p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => setShowPlans(true)}>
                Top up now
              </Button>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => setEvent(null)}
              >
                Not now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AiCreditsDialog;
