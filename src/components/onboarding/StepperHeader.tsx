import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface StepperHeaderProps {
  steps: Step[];
  current: number; // 0-indexed
  className?: string;
}

/**
 * Compact horizontal stepper used by both tutor + learner onboarding wizards.
 * Shows segmented progress with check marks on completed steps.
 */
export function StepperHeader({ steps, current, className }: StepperHeaderProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2 text-xs">
        <span className="text-muted-foreground">Step {Math.min(current + 1, steps.length)} of {steps.length}</span>
        <span className="font-medium text-foreground">{steps[current]?.label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={i} className="flex-1 flex items-center gap-1.5">
              <div className={cn(
                "h-1.5 flex-1 rounded-full transition-all",
                done ? "bg-primary" : active ? "bg-primary/60" : "bg-muted",
              )} />
              {i === steps.length - 1 && (
                <div className={cn(
                  "h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-all",
                  done || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}>
                  {done ? <Check className="h-3 w-3" /> : <span className="text-[10px] font-bold">{steps.length}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
