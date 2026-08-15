/**
 * AiUsage — read-only dashboard of the signed-in learner's verified AI usage.
 *
 * Every AI endpoint now requires a server-verified session, so each request
 * here is attributed to this account. Shows today's remaining allowance per
 * feature plus a rolling history of past requests.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, Sparkles, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAiUsage } from "@/hooks/useAiUsage";
import { aiBucketLabel } from "@/lib/aiQuotas";

function formatDay(iso: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default function AiUsage() {
  const navigate = useNavigate();
  const {
    isLoading,
    error,
    refetch,
    isPremium,
    buckets,
    history,
    totalToday,
    totalRemaining,
    totalAllowance,
    historyDays,
  } = useAiUsage();

  useEffect(() => {
    document.title = "AI usage & quota | StudySync";
  }, []);

  const activeBuckets = buckets.filter((b) => b.used > 0);
  const idleBuckets = buckets.filter((b) => b.used === 0);

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold flex-1">AI usage</h1>
          <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Couldn't load your usage right now. Pull to refresh or try again shortly.
            </p>
          </Card>
        ) : (
          <>
            {/* Summary */}
            <Card className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
                  <p className="text-3xl font-semibold leading-tight">{totalRemaining}</p>
                  <p className="text-sm text-muted-foreground">
                    AI requests remaining of {totalAllowance}
                  </p>
                </div>
                <Badge variant={isPremium ? "default" : "secondary"} className="shrink-0">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {isPremium ? "Premium (3x)" : "Standard"}
                </Badge>
              </div>

              <Progress
                value={totalAllowance > 0 ? (totalToday / totalAllowance) * 100 : 0}
                aria-label="Share of today's AI allowance used"
              />

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span>
                  Verified usage — every request is signed in as you, so nothing else can spend
                  your allowance.
                </span>
              </div>
            </Card>

            {/* Per-feature quota */}
            <Card className="p-4 space-y-4">
              <div>
                <h2 className="text-sm font-semibold">Remaining quota by feature</h2>
                <p className="text-xs text-muted-foreground">Resets every day at midnight UTC.</p>
              </div>

              <div className="space-y-3">
                {[...activeBuckets, ...idleBuckets].map((b) => (
                  <div key={b.bucket} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{aiBucketLabel(b.bucket)}</span>
                      <span
                        className={`text-xs tabular-nums ${
                          b.remaining === 0 ? "text-destructive" : "text-muted-foreground"
                        }`}
                      >
                        {b.used} / {b.limit} used
                      </span>
                    </div>
                    <Progress value={b.percent} />
                    {b.remaining === 0 && (
                      <p className="text-[11px] text-destructive">
                        Daily limit reached — available again tomorrow.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* History */}
            <Card className="p-4 space-y-3">
              <div>
                <h2 className="text-sm font-semibold">Past requests</h2>
                <p className="text-xs text-muted-foreground">
                  Last {historyDays} days, grouped by day.
                </p>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No AI requests yet. Start a study session and they'll show up here.
                </p>
              ) : (
                <div className="divide-y divide-border/50">
                  {history.map((d) => (
                    <div key={d.date} className="py-3 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium">{formatDay(d.date)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {d.requests} request{d.requests === 1 ? "" : "s"}
                          {d.tokensIn + d.tokensOut > 0 &&
                            ` · ${formatTokens(d.tokensIn + d.tokensOut)} tokens`}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {d.buckets.map((b) => (
                          <Badge
                            key={`${d.date}-${b.bucket}`}
                            variant="secondary"
                            className="text-[11px] font-normal"
                          >
                            {aiBucketLabel(b.bucket)} · {b.requests}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <p className="text-[11px] text-muted-foreground px-1">
              Counts are per feature and reset daily. Premium plans get three times the standard
              allowance.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
