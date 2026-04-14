import { useState } from "react";
import { useDevMode } from "@/contexts/DevModeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Code2, CreditCard, Calendar, ChevronUp, ChevronDown, X, Zap,
  AlertTriangle, Wifi, RotateCcw, ShieldCheck, Bug
} from "lucide-react";

export const DevModeBanner = () => {
  const {
    isDevMode, devRole, devUserName, config, updateConfig,
    disableDevMode, launchDevSession, resetDevState,
  } = useDevMode();

  const [expanded, setExpanded] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isDevMode) return null;

  // Collapsed pill
  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="fixed bottom-24 right-3 z-[9999] flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold shadow-lg transition-colors text-white"
        style={{ background: "linear-gradient(135deg, hsl(280 80% 55%), hsl(260 70% 50%))" }}
      >
        <Code2 className="h-3.5 w-3.5" />
        🧪 DEV
        <ChevronUp className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-24 right-3 z-[9999] w-72 rounded-2xl shadow-2xl border overflow-hidden"
      style={{
        borderColor: "hsl(280 80% 55% / 0.6)",
        backgroundColor: "hsl(280 40% 98%)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ background: "linear-gradient(135deg, hsl(280 80% 55%), hsl(260 70% 50%))" }}
      >
        <div className="flex items-center gap-1.5">
          <Code2 className="h-4 w-4 text-white" />
          <span className="text-xs font-bold uppercase tracking-wide text-white">
            🧪 Dev Mode
          </span>
          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-white/20 text-white border-0">
            {devRole}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setExpanded(false)} className="p-0.5 opacity-80 hover:opacity-100">
            <ChevronDown className="h-4 w-4 text-white" />
          </button>
          <button onClick={disableDevMode} className="p-0.5 opacity-80 hover:opacity-100">
            <X className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3 space-y-3">
        {/* User info */}
        <div className="rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: "hsl(280 40% 93%)" }}>
          <p className="font-semibold" style={{ color: "hsl(280 50% 25%)" }}>{devUserName}</p>
          <p style={{ color: "hsl(280 30% 45%)" }}>Testing as {devRole}</p>
        </div>

        {/* Core toggles */}
        <div className="space-y-2">
          <ToggleRow
            icon={<ShieldCheck className="h-3.5 w-3.5" />}
            label="Bypass Auth"
            checked={config.bypassAuth}
            onChange={(v) => updateConfig({ bypassAuth: v })}
          />
          <ToggleRow
            icon={<CreditCard className="h-3.5 w-3.5" />}
            label="Bypass Payments"
            checked={config.bypassPayments}
            onChange={(v) => updateConfig({ bypassPayments: v, forcePaidBookings: v })}
          />
          <ToggleRow
            icon={<Calendar className="h-3.5 w-3.5" />}
            label="Bypass Schedule"
            checked={config.bypassSchedule}
            onChange={(v) => updateConfig({ bypassSchedule: v })}
          />
        </div>

        {/* Advanced toggles */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider w-full"
          style={{ color: "hsl(40 40% 40%)" }}
        >
          <Bug className="h-3 w-3" />
          Advanced
          {showAdvanced ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
        </button>

        {showAdvanced && (
          <div className="space-y-2 pt-1">
            <ToggleRow
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Simulate Failures"
              checked={config.simulateFailures}
              onChange={(v) => updateConfig({ simulateFailures: v })}
              destructive
            />
            <ToggleRow
              icon={<Wifi className="h-3.5 w-3.5" />}
              label="Slow Network"
              checked={config.simulateSlowNetwork}
              onChange={(v) => updateConfig({ simulateSlowNetwork: v })}
              destructive
            />
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs gap-1.5"
              onClick={resetDevState}
            >
              <RotateCcw className="h-3 w-3" />
              Reset All Toggles
            </Button>
          </div>
        )}

        {/* Launch session button */}
        <Button
          size="sm"
          className="w-full font-bold text-xs gap-1.5 text-white"
          style={{ background: "linear-gradient(135deg, hsl(280 80% 55%), hsl(260 70% 50%))" }}
          onClick={launchDevSession}
        >
          <Zap className="h-3.5 w-3.5" />
          Launch Dev Video Session
        </Button>

        <p className="text-[10px] text-center leading-tight" style={{ color: "hsl(280 30% 50%)" }}>
          🧪 Simulation layer active — no real APIs called.
        </p>
      </div>
    </div>
  );
};

// ── Toggle row sub-component ────────────────────────────────────────────────
function ToggleRow({
  icon, label, checked, onChange, destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs" style={{ color: destructive ? "hsl(0 60% 45%)" : "hsl(280 50% 25%)" }}>
        {icon}
        {label}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        className="scale-75"
      />
    </div>
  );
}
