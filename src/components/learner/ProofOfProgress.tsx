/**
 * ProofOfProgress — weekly "you improved X%" card.
 *
 * The #1 churn antidote from edtech retention research: students quit by
 * week 3 when the product never *shows* them they're improving. This card
 * compares the last 7 days of `learning_events` against the prior 7 days
 * and pushes the improvement story to the learner home screen:
 *
 *   - average score delta (this week vs last week)
 *   - sessions completed this week
 *   - most-improved topic (largest avg score gain, min 2 events each window)
 *   - corrections fixed via photo-solve practice (after >= before)
 *
 * Renders nothing until the student has at least 3 events this week so new
 * accounts aren't shown an empty comparison.
 */
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Flame, Camera, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface EventRow {
  source: string;
  topic_name: string | null;
  score_pct: number | null;
  occurred_at: string;
  payload: Record<string, unknown> | null;
}

interface WeeklyProgress {
  thisWeekCount: number;
  avgThis: number | null;
  avgPrior: number | null;
  delta: number | null;
  bestTopic: { name: string; gain: number } | null;
  correctionsFixed: number;
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function computeProgress(rows: EventRow[], now: Date): WeeklyProgress {
  const weekMs = 7 * 24 * 3600_000;
  const cutThis = now.getTime() - weekMs;
  const cutPrior = now.getTime() - 2 * weekMs;

  const thisWeek: EventRow[] = [];
  const priorWeek: EventRow[] = [];
  for (const r of rows) {
    const t = new Date(r.occurred_at).getTime();
    if (t >= cutThis) thisWeek.push(r);
    else if (t >= cutPrior) priorWeek.push(r);
  }

  const scoresThis = thisWeek.map((r) => r.score_pct).filter((n): n is number => n != null);
  const scoresPrior = priorWeek.map((r) => r.score_pct).filter((n): n is number => n != null);
  const avgThis = avg(scoresThis);
  const avgPrior = avg(scoresPrior);
  const delta = avgThis != null && avgPrior != null ? Math.round(avgThis - avgPrior) : null;

  // Most-improved topic: needs >=2 scored events in each window.
  const byTopic = (list: EventRow[]) => {
    const m = new Map<string, number[]>();
    for (const r of list) {
      if (!r.topic_name || r.score_pct == null) continue;
      const arr = m.get(r.topic_name) ?? [];
      arr.push(r.score_pct);
      m.set(r.topic_name, arr);
    }
    return m;
  };
  const tThis = byTopic(thisWeek);
  const tPrior = byTopic(priorWeek);
  let bestTopic: { name: string; gain: number } | null = null;
  for (const [name, scores] of tThis) {
    const prior = tPrior.get(name);
    if (!prior || scores.length < 2 || prior.length < 2) continue;
    const gain = Math.round((avg(scores) ?? 0) - (avg(prior) ?? 0));
    if (gain > 0 && (!bestTopic || gain > bestTopic.gain)) bestTopic = { name, gain };
  }

  // Corrections fixed: photo_solve practice events where after >= before.
  const correctionsFixed = thisWeek.filter((r) => {
    if (r.source !== "photo_solve") return false;
    const p = r.payload ?? {};
    const before = Number((p as Record<string, unknown>).before_pct);
    const after = Number((p as Record<string, unknown>).after_pct);
    return Number.isFinite(before) && Number.isFinite(after) && after >= before;
  }).length;

  return { thisWeekCount: thisWeek.length, avgThis, avgPrior, delta, bestTopic, correctionsFixed };
}

// Exported for unit testing.
export { computeProgress, type EventRow, type WeeklyProgress };

export function ProofOfProgress({ className }: { className?: string }) {
  const { data } = useQuery({
    queryKey: ["proof-of-progress"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<WeeklyProgress | null> => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) return null;
      const since = new Date(Date.now() - 14 * 24 * 3600_000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const { data: rows, error } = await sb
        .from("learning_events")
        .select("source, topic_name, score_pct, occurred_at, payload")
        .eq("user_id", userId)
        .gte("occurred_at", since)
        .order("occurred_at", { ascending: false })
        .limit(500);
      if (error || !rows) return null;
      return computeProgress(rows as EventRow[], new Date());
    },
  });

  // Hide until there is a real week of activity to talk about.
  if (!data || data.thisWeekCount < 3) return null;

  const { delta, avgThis, thisWeekCount, bestTopic, correctionsFixed } = data;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;

  return (
    <Card className={cn("overflow-hidden border-primary/20", className)}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Flame className="h-4 w-4 text-primary" />
            Your week in review
          </h3>
          <span className="text-[11px] text-muted-foreground">last 7 days</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">Sessions</p>
            <p className="text-lg font-bold tabular-nums">{thisWeekCount}</p>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">Avg score</p>
            <p className="text-lg font-bold tabular-nums">
              {avgThis != null ? `${Math.round(avgThis)}%` : "—"}
            </p>
          </div>
          <div
            className={cn(
              "rounded-xl p-2.5 text-center",
              up ? "bg-success/10" : down ? "bg-warning/10" : "bg-muted/50"
            )}
          >
            <p className="text-[10px] text-muted-foreground">vs last week</p>
            <p
              className={cn(
                "text-lg font-bold tabular-nums flex items-center justify-center gap-0.5",
                up ? "text-success" : down ? "text-warning" : "text-muted-foreground"
              )}
            >
              {up ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : down ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              {delta != null ? `${delta > 0 ? "+" : ""}${delta}%` : "—"}
            </p>
          </div>
        </div>

        {(bestTopic || correctionsFixed > 0) && (
          <div className="space-y-1.5">
            {bestTopic && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ArrowRight className="h-3 w-3 text-success shrink-0" />
                Most improved: <b className="text-foreground">{bestTopic.name}</b>
                <span className="text-success font-semibold">+{bestTopic.gain}%</span>
              </p>
            )}
            {correctionsFixed > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Camera className="h-3 w-3 text-primary shrink-0" />
                <b className="text-foreground">{correctionsFixed}</b>
                correction{correctionsFixed === 1 ? "" : "s"} fixed with photo-solve practice
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
