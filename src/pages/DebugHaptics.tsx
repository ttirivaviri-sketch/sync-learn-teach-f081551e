/**
 * /debug/haptics — internal QA view for the StudySync haptic vocabulary.
 *
 * - Lists every named StudySync haptic event with a "Fire" button.
 * - Streams a live log of fires (event + timestamp + source) so you can
 *   confirm Once / OncePerDay guards prevent re-fires.
 * - Lets you reset the guard storage and toggle the global haptics flag.
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  StudySyncEvent,
  studySyncHaptic,
  studySyncHapticOnce,
  studySyncHapticOncePerDay,
  subscribeHapticLog,
  HapticLogEntry,
  getHapticsEnabled,
  setHapticsEnabled,
} from "@/lib/haptics";

const ALL_EVENTS: StudySyncEvent[] = [
  "task.checkbox",
  "task.complete",
  "quiz.wrong",
  "quiz.correct",
  "quiz.perfect",
  "streak.day2",
  "streak.day7",
  "streak.day30",
  "ai.praise",
  "unlock",
  "timer.pomodoro",
  "xp.levelup",
  "signature.success",
  "tutor.booking",
  "tutor.payment",
  "tutor.review",
  "tutor.scheduleMilestone",
  "tutor.message",
  "premium.milestone",
];

const clearGuardKeys = () => {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("haptic-once:") || k.startsWith("haptic-day:"))) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    return toRemove.length;
  } catch {
    return 0;
  }
};

const DebugHaptics = () => {
  const [log, setLog] = useState<HapticLogEntry[]>([]);
  const [enabled, setEnabled] = useState(getHapticsEnabled());

  useEffect(() => subscribeHapticLog(setLog), []);

  const guards = useMemo(() => {
    if (typeof localStorage === "undefined") return { once: 0, day: 0 };
    let once = 0;
    let day = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("haptic-once:")) once++;
      else if (k.startsWith("haptic-day:")) day++;
    }
    return { once, day };
  }, [log]);

  const handleToggle = (v: boolean) => {
    setHapticsEnabled(v);
    setEnabled(v);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Haptics QA</h1>
        <p className="text-sm text-muted-foreground">
          Fire each StudySync haptic event and verify guards. Native vibration is
          required (mobile / Capacitor); iOS Safari is a no-op.
        </p>
      </header>

      <section className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">Haptics enabled</p>
          <p className="text-xs text-muted-foreground">
            Once-guards: {guards.once} · Day-guards: {guards.day}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => clearGuardKeys()}>
            Reset guards
          </Button>
          <Switch checked={enabled} onCheckedChange={handleToggle} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ALL_EVENTS.map((evt) => (
          <div key={evt} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
            <code className="text-xs">{evt}</code>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => studySyncHaptic(evt)}>
                Fire
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => studySyncHapticOnce(evt, `qa:${evt}`)}
                title="Fires only once per browser for key qa:<event>"
              >
                Once
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => studySyncHapticOncePerDay(evt, `qa:${evt}`)}
                title="Fires only once per calendar day"
              >
                Daily
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Live log ({log.length})</h2>
          <Button size="sm" variant="ghost" onClick={() => setLog([])}>
            Clear
          </Button>
        </div>
        <div className="max-h-80 overflow-auto rounded-xl border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {log.length === 0 ? (
            <p className="text-muted-foreground">No haptics fired yet.</p>
          ) : (
            log
              .slice()
              .reverse()
              .map((entry, i) => (
                <div key={`${entry.at}-${i}`} className="grid grid-cols-[80px_1fr_auto] gap-2">
                  <span className="text-muted-foreground">
                    {new Date(entry.at).toISOString().slice(11, 23)}
                  </span>
                  <span className="text-foreground">{entry.event}</span>
                  <span className="text-muted-foreground">{entry.fired ? "fired" : "blocked"}</span>
                </div>
              ))
          )}
        </div>
      </section>
    </div>
  );
};

export default DebugHaptics;
