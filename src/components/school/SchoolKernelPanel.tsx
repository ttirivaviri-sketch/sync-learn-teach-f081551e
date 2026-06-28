/**
 * SchoolKernelPanel — school-wide rollup of the Learning Kernel for admins.
 * Same risk-distribution + struggle/mastery view as the ClassKernelPanel,
 * but scoped to every active student in the school. Clicking a struggling
 * topic opens a drill-down showing exactly which students need follow-up.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, Users, Sparkles } from "lucide-react";
import { useSchoolKernel } from "@/hooks/useSchoolKernel";
import { TopicStudentsDialog } from "./TopicStudentsDialog";

export function SchoolKernelPanel({ schoolId }: { schoolId: string }) {
  const [drillTopic, setDrillTopic] = useState<string | null>(null);
  const { data, isLoading } = useSchoolKernel(schoolId);

  if (isLoading) {
    return (
      <Card><CardContent className="p-4 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full" />
      </CardContent></Card>
    );
  }
  if (!data) return null;
  const { studentCount, riskCounts, topStruggles, topMasteries } = data;
  const total = riskCounts.critical + riskCounts.warning + riskCounts.watch + riskCounts.mastered + riskCounts.on_track;

  return (
    <Card className="bg-gradient-to-br from-primary/10 to-background border-primary/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">School Learning Kernel</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">
            <Users className="h-3 w-3 mr-1" />{studentCount} students
          </Badge>
        </div>

        {total === 0 ? (
          <p className="text-xs text-muted-foreground">
            No learner activity yet. Once students engage with homework or study sessions across classes, the kernel will surface school-wide risk patterns here.
          </p>
        ) : (
          <>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-1.5">Risk distribution</div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {([
                  ["critical", "bg-destructive"],
                  ["warning", "bg-amber-500"],
                  ["watch", "bg-yellow-400"],
                  ["on_track", "bg-emerald-400"],
                  ["mastered", "bg-emerald-600"],
                ] as const).map(([k, cls]) => {
                  const pct = (riskCounts[k] / total) * 100;
                  return pct > 0 ? <div key={k} className={cls} style={{ width: `${pct}%` }} title={`${k}: ${riskCounts[k]}`} /> : null;
                })}
              </div>
              <div className="grid grid-cols-5 gap-1 mt-1.5 text-[10px] text-center">
                <div><span className="text-destructive font-semibold">{riskCounts.critical}</span><div className="text-muted-foreground">Critical</div></div>
                <div><span className="text-amber-600 font-semibold">{riskCounts.warning}</span><div className="text-muted-foreground">Warning</div></div>
                <div><span className="text-yellow-600 font-semibold">{riskCounts.watch}</span><div className="text-muted-foreground">Watch</div></div>
                <div><span className="text-emerald-600 font-semibold">{riskCounts.on_track}</span><div className="text-muted-foreground">On track</div></div>
                <div><span className="text-emerald-700 font-semibold">{riskCounts.mastered}</span><div className="text-muted-foreground">Mastered</div></div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              {topStruggles.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">School-wide struggles</div>
                  </div>
                  <ul className="space-y-1">
                    {topStruggles.map((t) => (
                      <li key={`${t.subject_id}-${t.topic}`} className="flex items-center justify-between gap-2 text-xs rounded-md bg-background/60 px-2 py-1.5">
                        <button
                          type="button"
                          onClick={() => setDrillTopic(t.topic)}
                          className="truncate font-medium text-left hover:underline flex-1 min-w-0"
                          title="See affected students across the school"
                        >
                          {t.topic}
                        </button>
                        <span className="text-muted-foreground whitespace-nowrap">{t.studentsAffected} · {Math.round(t.avgScore)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {topMasteries.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">School is mastering</div>
                  </div>
                  <ul className="space-y-1">
                    {topMasteries.map((t) => (
                      <li key={`${t.subject_id}-${t.topic}`} className="flex items-center justify-between gap-2 text-xs rounded-md bg-background/60 px-2 py-1.5">
                        <span className="truncate font-medium">{t.topic}</span>
                        <span className="text-muted-foreground whitespace-nowrap">{t.studentsAffected} · {Math.round(t.avgMastery)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
