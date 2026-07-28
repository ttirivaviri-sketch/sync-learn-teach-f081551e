/**
 * DataSaverToggle — settings row to control Data Saver mode.
 *
 * Three states: Auto (follow the browser's Save-Data / 2g hints), On, Off.
 * Sits alongside ThemeToggle / HapticsToggle in the learner profile tab.
 */
import { useSyncExternalStore } from "react";
import { Signal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getDataSaverMode,
  setDataSaverMode,
  subscribeDataSaver,
  isDataSaverActive,
} from "@/lib/dataSaver";

const MODES = [
  { value: "auto", label: "Auto" },
  { value: "on", label: "On" },
  { value: "off", label: "Off" },
] as const;

export function DataSaverToggle({ className }: { className?: string }) {
  const mode = useSyncExternalStore(subscribeDataSaver, getDataSaverMode, () => "auto" as const);
  const active = useSyncExternalStore(
    subscribeDataSaver,
    isDataSaverActive,
    () => false
  );

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        <Signal className={cn("h-4 w-4 shrink-0", active ? "text-success" : "text-muted-foreground")} />
        <div className="min-w-0">
          <p className="text-sm font-medium">Data saver</p>
          <p className="text-xs text-muted-foreground truncate">
            {active ? "Active — smaller uploads, less data" : "Compress uploads on slow connections"}
          </p>
        </div>
      </div>
      <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setDataSaverMode(m.value)}
            className={cn(
              "px-2.5 py-1.5 text-xs transition-colors",
              mode === m.value
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
