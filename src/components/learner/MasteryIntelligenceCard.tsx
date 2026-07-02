/**
 * MasteryIntelligenceCard — condensed learner-state summary showing top
 * mastered topics and the biggest at-risk topics. Reads from `learner_state`
 * (populated by the learning-events trigger) so no extra ledger is required.
 * Adapted from the iScanner bundle to the LOS Phase 1-2 schema already in
 * production.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Row {
  topic: string;
  subject_name: string | null;
  mastery_pct: number | null;
  ewma_score_pct: number | null;
  risk_level: string | null;
}

export function MasteryIntelligenceCard() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["mastery-intelligence", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("learner_state" as any)
        .select("topic, subject_name, mastery_pct, ewma_score_pct, risk_level")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const { atRisk, strong } = useMemo(() => {
    const rows = data ?? [];
    const atRisk = rows
      .filter((r) => r.risk_level === "critical" || r.risk_level === "warning")
      .sort((a, b) => (a.ewma_score_pct ?? 0) - (b.ewma_score_pct ?? 0))
      .slice(0, 3);
    const strong = rows
      .filter((r) => (r.mastery_pct ?? 0) >= 70)
      .sort((a, b) => (b.mastery_pct ?? 0) - (a.mastery_pct ?? 0))
      .slice(0, 3);
    return { atRisk, strong };
  }, [data]);

  if (!userId) return null;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Mastery intelligence</h3>
        </div>

        {isLoading && <Skeleton className="h-16 w-full" />}

        {!isLoading && (data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Keep learning — mastery insights appear once you have a few sessions logged.
          </p>
        )}

        {!isLoading && (data ?? []).length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 mb-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> Strengths
              </div>
              {strong.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nothing mastered yet.</p>
              ) : (
                <ul className="space-y-1">
                  {strong.map((r) => (
                    <li key={r.topic} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{r.topic}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {Math.round(r.mastery_pct ?? 0)}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 mb-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Needs practice
              </div>
              {atRisk.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No at-risk topics — great work.</p>
              ) : (
                <ul className="space-y-1">
                  {atRisk.map((r) => (
                    <li key={r.topic} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate">{r.topic}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${r.risk_level === "critical" ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}
                      >
                        {Math.round(r.ewma_score_pct ?? 0)}%
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
