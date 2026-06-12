import { Vibrate } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { studySyncHaptic } from "@/lib/haptics";
import { useHapticsSync } from "@/hooks/useHapticsSync";

interface HapticsToggleProps {
  userId?: string;
}

/**
 * Inline toggle row for enabling/disabling haptic feedback.
 * Persists across sessions and devices via `user_preferences` when a userId
 * is provided; falls back to localStorage otherwise.
 */
export function HapticsToggle({ userId }: HapticsToggleProps = {}) {
  const { enabled, setEnabled } = useHapticsSync(userId);

  const handle = (v: boolean) => {
    void setEnabled(v);
    if (v) studySyncHaptic("task.complete"); // preview when enabling
  };

  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-sm">
          <Vibrate className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Haptic feedback</p>
          <p className="text-[11px] text-muted-foreground">Vibration on milestones & achievements</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handle} />
    </div>
  );
}
