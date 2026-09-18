/**
 * PublicSlotPicker — step 2 of the public booking flow.
 *
 * Shows the next 14 days of the tutor's real availability and offers 1-hour
 * start times, skipping times already taken by other bookings and any time in
 * the past. Works for anonymous visitors (anon-safe RPCs).
 */
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { usePublicTutorAvailability } from "@/hooks/usePublicTutorAvailability";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SESSION_MINUTES = 60;
const DAYS_AHEAD = 14;

const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

const label12 = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m.toString().padStart(2, "0")} ${suffix}`;
};

interface BusySlot {
  start: number;
  end: number;
}

interface PublicSlotPickerProps {
  tutorId: string;
  selectedStart: Date | null;
  onSelect: (start: Date) => void;
}

export function PublicSlotPicker({ tutorId, selectedStart, onSelect }: PublicSlotPickerProps) {
  const { slots, loading } = usePublicTutorAvailability(tutorId);
  const [busy, setBusy] = useState<BusySlot[]>([]);
  const [activeDay, setActiveDay] = useState<Date | null>(null);

  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(startOfDay(new Date()), i)),
    []
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const from = new Date();
        const to = addDays(from, DAYS_AHEAD);
        const { data, error } = await supabase.rpc("get_tutor_busy_slots", {
          _tutor_id: tutorId,
          _from: from.toISOString(),
          _to: to.toISOString(),
        });
        if (error) throw error;
        if (cancelled) return;
        setBusy(
          ((data || []) as Array<{ scheduled_at: string; duration_minutes: number }>).map((b) => {
            const start = new Date(b.scheduled_at).getTime();
            return { start, end: start + (b.duration_minutes || SESSION_MINUTES) * 60_000 };
          })
        );
      } catch (err) {
        logger.error("Error loading tutor busy slots:", err);
        if (!cancelled) setBusy([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tutorId]);

  const dayHasSlots = (date: Date) => slots.some((s) => s.day_of_week === date.getDay());

  // Auto-select the first day that has availability.
  useEffect(() => {
    if (loading || activeDay) return;
    const firstOpen = days.find((d) => dayHasSlots(d));
    if (firstOpen) setActiveDay(firstOpen);
  }, [loading, slots, days, activeDay]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedStart) setActiveDay(startOfDay(selectedStart));
  }, [selectedStart]);

  const startTimes = useMemo(() => {
    if (!activeDay) return [] as Date[];
    const windows = slots.filter((s) => s.day_of_week === activeDay.getDay());
    const now = Date.now();
    const result: Date[] = [];

    windows.forEach((w) => {
      const windowStart = toMinutes(w.start_time);
      const windowEnd = toMinutes(w.end_time);
      for (let m = windowStart; m + SESSION_MINUTES <= windowEnd; m += 60) {
        const start = new Date(activeDay);
        start.setHours(Math.floor(m / 60), m % 60, 0, 0);
        const startMs = start.getTime();
        const endMs = startMs + SESSION_MINUTES * 60_000;
        if (startMs <= now) continue;
        const overlaps = busy.some((b) => startMs < b.end && endMs > b.start);
        if (overlaps) continue;
        if (!result.some((existing) => existing.getTime() === startMs)) result.push(start);
      }
    });

    return result.sort((a, b) => a.getTime() - b.getTime());
  }, [activeDay, slots, busy]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-14 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
        <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
        <p className="font-medium">This tutor hasn't published times yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick another tutor, or message us and we'll arrange a session for you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CalendarDays className="h-4 w-4 text-primary" />
        Choose a day
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {days.map((date) => {
          const open = dayHasSlots(date);
          const isActive = activeDay && isSameDay(date, activeDay);
          return (
            <button
              key={date.toISOString()}
              type="button"
              disabled={!open}
              onClick={() => setActiveDay(date)}
              className={`flex min-w-[58px] flex-col items-center rounded-xl border p-2 transition-all ${
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : open
                    ? "border-border bg-card hover:bg-accent"
                    : "cursor-not-allowed border-transparent bg-muted text-muted-foreground opacity-50"
              }`}
            >
              <span className="text-xs font-medium">{DAY_LABELS[date.getDay()]}</span>
              <span className="text-lg font-bold">{format(date, "d")}</span>
              <span className="text-[10px]">{format(date, "MMM")}</span>
            </button>
          );
        })}
      </div>

      {activeDay && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4 text-primary" />
            Start time on {format(activeDay, "EEEE, d MMM")}
          </div>

          {startTimes.length === 0 ? (
            <p className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              No open 1-hour slots left on this day. Try another day.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {startTimes.map((start) => {
                const mins = start.getHours() * 60 + start.getMinutes();
                const isSelected =
                  selectedStart && selectedStart.getTime() === start.getTime();
                return (
                  <button
                    key={start.toISOString()}
                    type="button"
                    onClick={() => onSelect(start)}
                    className={`rounded-xl border px-2 py-2.5 text-sm font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:border-primary/50 hover:bg-accent"
                    }`}
                  >
                    {label12(mins)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
