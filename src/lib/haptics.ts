/**
 * Lightweight haptics helper.
 *
 * Uses Capacitor Haptics plugin when running inside a native shell;
 * falls back to the Web Vibration API on supported browsers (Android Chrome).
 * iOS Safari has no web vibration — calls are silently ignored there.
 *
 * Safe to call from any component; never throws.
 */

export type HapticStyle = "light" | "medium" | "heavy" | "selection" | "success" | "warning" | "error";

const PATTERNS: Record<HapticStyle, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  selection: 6,
  success: [10, 40, 18],
  warning: [16, 60, 16],
  error: [24, 50, 24, 50, 24],
};

type CapacitorHaptics = {
  impact?: (opts: { style: "LIGHT" | "MEDIUM" | "HEAVY" }) => Promise<void>;
  selectionChanged?: () => Promise<void>;
  notification?: (opts: { type: "SUCCESS" | "WARNING" | "ERROR" }) => Promise<void>;
};

function getCapacitorHaptics(): CapacitorHaptics | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { Plugins?: { Haptics?: CapacitorHaptics } } }).Capacitor;
  return cap?.Plugins?.Haptics ?? null;
}

let enabled = true;
export function setHapticsEnabled(value: boolean) {
  enabled = value;
  if (typeof window !== "undefined") {
    try { localStorage.setItem("haptics-enabled", value ? "1" : "0"); } catch { /* ignore */ }
  }
}

if (typeof window !== "undefined") {
  try {
    const stored = localStorage.getItem("haptics-enabled");
    if (stored === "0") enabled = false;
  } catch { /* ignore */ }
}

export function haptic(style: HapticStyle = "light") {
  if (!enabled) return;
  if (typeof window === "undefined") return;

  const plugin = getCapacitorHaptics();
  if (plugin) {
    try {
      if (style === "selection" && plugin.selectionChanged) {
        void plugin.selectionChanged();
        return;
      }
      if ((style === "success" || style === "warning" || style === "error") && plugin.notification) {
        void plugin.notification({ type: style.toUpperCase() as "SUCCESS" | "WARNING" | "ERROR" });
        return;
      }
      if (plugin.impact) {
        const impactStyle = style === "heavy" ? "HEAVY" : style === "medium" ? "MEDIUM" : "LIGHT";
        void plugin.impact({ style: impactStyle });
        return;
      }
    } catch { /* fall through to web vibration */ }
  }

  const nav = window.navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate === "function") {
    try { nav.vibrate(PATTERNS[style]); } catch { /* ignore */ }
  }
}
