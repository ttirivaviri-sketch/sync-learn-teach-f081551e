/**
 * RemediationEffectivenessPanel — shows before/after EWMA per remediation
 * homework so admins/teachers can see which interventions actually moved
 * the needle.
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { useRemediationEffectiveness } from "@/hooks/useRemediationEffectiveness";
import { Skeleton } from "@/components/ui/skeleton";

export function RemediationEffectivenessPanel({ schoolId }: { schoolId: string }) {
  const { data, isLoading } = useRemediationEffectiveness(schoolId);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="font-medium">Remediation effectiveness</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">
          No remediation baselines yet. Generate remediation homework from the Kernel Alerts panel to start measuring impact.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.slice(0, 8).map((r) => {
            const delta = r.avg_delta ?? 0;
            const Icon = delta > 3 ? TrendingUp : delta < -3 ? TrendingDown : Minus;
            const tone = delta > 3 ? "text-emerald-600" : delta < -3 ? "text-destructive" : "text-muted-foreground";
            return (
              <li key={r.homework_id} className="flex items-center justify-between rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {r.topic} · {r.students_total} students · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className={`text-sm font-semibold flex items-center gap-1 justify-end ${tone}`}>
                      <Icon className="h-3.5 w-3.5" />
                      {delta > 0 ? "+" : ""}{delta?.toFixed(1) ?? "—"} pts
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.avg_ewma_before?.toFixed(0) ?? "—"}% → {r.avg_ewma_after?.toFixed(0) ?? "—"}%
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="text-[10px]">↑{r.students_improved}</Badge>
                    <Badge variant="outline" className="text-[10px]">↓{r.students_worsened}</Badge>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
