/**
 * StudySync Haptics
 *
 * Two layers:
 *   1. Low-level primitive: `haptic(style)` — generic Capacitor / web vibration.
 *   2. Brand-aware: `studySyncHaptic(event)` — named events mapped to specific
 *      patterns that reinforce achievement, progress, consistency, and
 *      social interaction.
 *
 * Design rules:
 *   - Never fire on routine taps. Reserve for meaningful events.
 *   - Patterns ≤ ~350ms total so they feel like feedback, not alarms.
 *   - `signature.success` is the StudySync Success Pulse — reused identically
 *     across daily goal, weekly goal, exam-readiness, etc., to build brand
 *     recognition.
 *   - iOS Safari: no-op. iOS native (Capacitor): mapped to impact/notification
 *     since iOS does not support custom vibration patterns.
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
  vibrate?: (opts: { duration: number }) => Promise<void>;
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
export function getHapticsEnabled(): boolean {
  return enabled;
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

/* ───────────────────────── StudySync brand layer ───────────────────────── */

export type StudySyncEvent =
  // Learner — tasks & quiz
  | "task.checkbox"
  | "task.complete"
  | "quiz.wrong"
  | "quiz.correct"
  | "quiz.perfect"
  // Learner — streaks & progression
  | "streak.day2"
  | "streak.day7"
  | "streak.day30"
  | "ai.praise"
  | "unlock"
  | "timer.pomodoro"
  | "xp.levelup"
  // Signature StudySync Success Pulse — daily/weekly/exam goal hit
  | "signature.success"
  // Tutor
  | "tutor.booking"
  | "tutor.payment"
  | "tutor.review"
  | "tutor.scheduleMilestone"
  | "tutor.message"
  // Rare premium milestones (first booking, first payment, mastery, course done)
  | "premium.milestone";

interface EventSpec {
  /** Web Vibration API pattern (ms). */
  web: number | number[];
  /** Native fallback on Capacitor. */
  native: HapticStyle | HapticStyle[];
}

const EVENTS: Record<StudySyncEvent, EventSpec> = {
  "task.checkbox":          { web: 6,                          native: "selection" },
  "task.complete":          { web: [10, 40, 18],               native: "success" },
  "quiz.wrong":             { web: 4,                          native: "light" },
  "quiz.correct":           { web: 8,                          native: "light" },
  "quiz.perfect":           { web: [12, 40, 12, 40, 18, 60, 24], native: ["success", "heavy"] },
  "streak.day2":            { web: 12,                         native: "light" },
  "streak.day7":            { web: [14, 60, 14],               native: ["medium", "medium"] },
  "streak.day30":           { web: [18, 50, 18, 50, 22],       native: ["heavy", "heavy", "heavy"] },
  "ai.praise":              { web: [10, 40, 18],               native: "success" },
  "unlock":                 { web: [10, 120, 22],              native: ["light", "heavy"] },
  "timer.pomodoro":         { web: [10, 80, 10, 80, 10],       native: ["medium", "medium", "medium"] },
  "xp.levelup":             { web: [12, 40, 12, 40, 22],       native: "success" },
  "signature.success":      { web: [14, 50, 10, 50, 22, 80, 18], native: ["success", "medium", "heavy"] },
  "tutor.booking":          { web: [12, 140, 12],              native: ["medium", "medium"] },
  "tutor.payment":          { web: [16, 40, 22, 40, 26],       native: ["success", "heavy"] },
  "tutor.review":           { web: [14, 60, 18],               native: "success" },
  "tutor.scheduleMilestone":{ web: [14, 50, 14, 50, 18],       native: "success" },
  "tutor.message":          { web: 8,                          native: "light" },
  "premium.milestone":      { web: [18, 60, 14, 60, 24, 80, 28], native: ["heavy", "success"] },
};

/**
 * Fire a brand-named StudySync haptic.
 * Silently no-ops when disabled, when running on iOS Safari, or when the
 * environment lacks vibration support.
 */
/* ───────────────── Debug / QA log subscribers ───────────────── */

export interface HapticLogEntry {
  event: StudySyncEvent;
  at: number;
  fired: boolean;
  guard?: "once" | "day" | null;
  key?: string;
}

const logBuffer: HapticLogEntry[] = [];
const LOG_LIMIT = 200;
type LogListener = (entries: HapticLogEntry[]) => void;
const logListeners = new Set<LogListener>();

function pushLog(entry: HapticLogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_LIMIT) logBuffer.shift();
  for (const fn of logListeners) {
    try { fn(logBuffer.slice()); } catch { /* ignore */ }
  }
}

/** Subscribe to a live log of haptic events. Returns an unsubscribe fn. */
export function subscribeHapticLog(listener: LogListener): () => void {
  logListeners.add(listener);
  listener(logBuffer.slice());
  return () => { logListeners.delete(listener); };
}

export function getHapticLog(): HapticLogEntry[] {
  return logBuffer.slice();
}

export function studySyncHaptic(event: StudySyncEvent) {
  if (!enabled) {
    pushLog({ event, at: Date.now(), fired: false });
    return;
  }
  if (typeof window === "undefined") return;
  const spec = EVENTS[event];
  if (!spec) return;

  pushLog({ event, at: Date.now(), fired: true });

  const plugin = getCapacitorHaptics();
  if (plugin) {
    try {
      const native = Array.isArray(spec.native) ? spec.native : [spec.native];
      let delay = 0;
      for (const step of native) {
        const fire = () => haptic(step);
        if (delay === 0) fire();
        else window.setTimeout(fire, delay);
        delay += 90;
      }
      return;
    } catch { /* fall through */ }
  }

  const nav = window.navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  if (typeof nav.vibrate === "function") {
    try { nav.vibrate(spec.web); } catch { /* ignore */ }
  }
}

/* ───────────────── First-time / once-per-period guards ───────────────── */

/**
 * Fire `event` once per ISO calendar day (per browser).
 * Returns true if it fired.
 */
export function studySyncHapticOncePerDay(event: StudySyncEvent, key: string): boolean {
  if (typeof window === "undefined") return false;
  const today = new Date().toISOString().slice(0, 10);
  const storageKey = `haptic-day:${key}`;
  try {
    if (localStorage.getItem(storageKey) === today) {
      pushLog({ event, at: Date.now(), fired: false, guard: "day", key });
      return false;
    }
    localStorage.setItem(storageKey, today);
  } catch { /* ignore */ }
  studySyncHaptic(event);
  return true;
}

/** Fire `event` exactly once per browser for the given key. */
export function studySyncHapticOnce(event: StudySyncEvent, key: string): boolean {
  if (typeof window === "undefined") return false;
  const storageKey = `haptic-once:${key}`;
  try {
    if (localStorage.getItem(storageKey) === "1") {
      pushLog({ event, at: Date.now(), fired: false, guard: "once", key });
      return false;
    }
    localStorage.setItem(storageKey, "1");
  } catch { /* ignore */ }
  studySyncHaptic(event);
  return true;
}
