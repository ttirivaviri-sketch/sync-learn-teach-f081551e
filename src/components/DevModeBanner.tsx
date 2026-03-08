import { useState } from "react";
import { useDevMode } from "@/contexts/DevModeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Code2, Video, CreditCard, Calendar, ChevronUp, ChevronDown, X, Zap
} from "lucide-react";

/**
 * DevModeBanner — floating overlay visible when dev mode is active.
 * Shows current role, bypass toggles, and a one-click "Launch Dev Session" button.
 * Collapsible to a small badge so it never blocks the UI.
 */
export const DevModeBanner = () => {
  const {
    isDevMode, devRole, devUserName,
    bypassPayments, bypassSchedule,
    toggleBypassPayments, toggleBypassSchedule,
    disableDevMode, launchDevSession,
  } = useDevMode();

  const [expanded, setExpanded] = useState(true);

  if (!isDevMode) return null;

  // Collapsed pill
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-24 right-3 z-[9999] flex items-center gap-1.5 bg-yellow-400 text-yellow-900 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg hover:bg-yellow-300 transition-colors"
      >
        <Code2 className="h-3.5 w-3.5" />
        DEV
        <ChevronUp className="h-3 w-3" />
      </button>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-24 right-3 z-[9999] w-64 rounded-2xl shadow-2xl border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-yellow-400 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-4 w-4 text-yellow-900" />
          <span className="text-xs font-bold text-yellow-900 uppercase tracking-wide">Dev Mode</span>
          <Badge className="bg-yellow-900 text-yellow-100 text-[10px] px-1.5 py-0 h-4">
            {devRole}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(false)} className="text-yellow-800 hover:text-yellow-900 p-0.5">
            <ChevronDown className="h-4 w-4" />
          </button>
          <button onClick={disableDevMode} className="text-yellow-800 hover:text-red-700 p-0.5">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* User info */}
        <div className="bg-yellow-100 dark:bg-yellow-900/40 rounded-lg px-3 py-2 text-xs">
          <p className="font-semibold text-yellow-900 dark:text-yellow-200">{devUserName}</p>
          <p className="text-yellow-700 dark:text-yellow-400">Testing as {devRole}</p>
        </div>

        {/* Bypass toggles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-yellow-900 dark:text-yellow-200">
              <CreditCard className="h-3.5 w-3.5" />
              Bypass Payments
            </div>
            <Switch
              checked={bypassPayments}
              onCheckedChange={toggleBypassPayments}
              className="scale-75 data-[state=checked]:bg-yellow-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-yellow-900 dark:text-yellow-200">
              <Calendar className="h-3.5 w-3.5" />
              Bypass Schedule
            </div>
            <Switch
              checked={bypassSchedule}
              onCheckedChange={toggleBypassSchedule}
              className="scale-75 data-[state=checked]:bg-yellow-500"
            />
          </div>
        </div>

        {/* Launch session button */}
        <Button
          size="sm"
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-bold text-xs gap-1.5"
          onClick={launchDevSession}
        >
          <Zap className="h-3.5 w-3.5" />
          Launch Dev Video Session
        </Button>

        <p className="text-[10px] text-yellow-700 dark:text-yellow-500 text-center leading-tight">
          Dev mode bypasses auth, payments & scheduling
        </p>
      </div>
    </div>
  );
};
