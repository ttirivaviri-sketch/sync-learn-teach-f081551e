/**
 * ClassKernelPanel — teacher-facing view of the shared Learning Kernel
 * (learner_state). Shows class-wide risk distribution and the topics most
 * students are struggling with, lets the teacher drill into the affected
 * students for any topic, and bulk-assigns remediation across multiple
 * topics in a single click.
 */
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, TrendingUp, Users, Sparkles, Wand2 } from "lucide-react";
import { useClassKernel } from "@/hooks/useClassKernel";
import { TopicStudentsDialog } from "./TopicStudentsDialog";

interface Props {
  classId: string;
  /** Called with a single topic when teacher clicks "Assign" on a row. */
  onAssignRemediation?: (topic: string) => void;
  /** Called with multiple topics when teacher uses the bulk "Assign selected" button. */
  onBulkAssignRemediation?: (topics: string[]) => void;
}

export function ClassKernelPanel({ classId, onAssignRemediation, onBulkAssignRemediation }: Props) {
  const { data, isLoading } = useClassKernel(classId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drillTopic, setDrillTopic] = useState<string | null>(null);

  const toggle = (topic: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(topic)) next.delete(topic); else next.add(topic);
      return next;
    });
  };

  const selectedList = useMemo(() => Array.from(selected), [selected]);

  if (isLoading) {
    return (
      <Card><CardContent className="p-4 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full" />
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
          <h3 className="font-semibold text-sm">Class Learning Kernel</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">
            <Users className="h-3 w-3 mr-1" />{studentCount} students
          </Badge>
        </div>

        {total === 0 ? (
          <p className="text-xs text-muted-foreground">No learner activity yet. Once students attempt homework or study sessions, the kernel will surface risk patterns here.</p>
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

            {topStruggles.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Most-struggling topics</div>
                  {onBulkAssignRemediation && selectedList.length > 0 && (
                    <Button
                      size="sm"
                      className="ml-auto h-6 px-2 text-[10px]"
                      onClick={() => { onBulkAssignRemediation(selectedList); setSelected(new Set()); }}
                    >
                      <Wand2 className="h-3 w-3 mr-1" />Assign {selectedList.length} selected
                    </Button>
                  )}
                </div>
                <ul className="space-y-1">
                  {topStruggles.map((t) => (
                    <li key={`${t.subject_id}-${t.topic}`} className="flex items-center gap-2 text-xs rounded-md bg-background/60 px-2 py-1.5">
                      {onBulkAssignRemediation && (
                        <Checkbox
                          checked={selected.has(t.topic)}
                          onCheckedChange={() => toggle(t.topic)}
                          aria-label={`Select ${t.topic}`}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setDrillTopic(t.topic)}
                        className="truncate font-medium flex-1 min-w-0 text-left hover:underline"
                        title="See affected students"
                      >
                        {t.topic}
                      </button>
                      <span className="text-muted-foreground whitespace-nowrap">{t.studentsAffected} · {Math.round(t.avgScore)}%</span>
                      {onAssignRemediation && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => onAssignRemediation(t.topic)}
                          title="Generate AI remediation homework for this topic"
                        >
                          <Wand2 className="h-3 w-3 mr-1" />Assign
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {topMasteries.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Class is mastering</div>
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
          </>
        )}
      </CardContent>

      <TopicStudentsDialog
        open={!!drillTopic}
        onOpenChange={(v) => !v && setDrillTopic(null)}
        scope="class"
        scopeId={classId}
        topic={drillTopic}
        onAssign={onAssignRemediation ? () => { if (drillTopic) onAssignRemediation(drillTopic); setDrillTopic(null); } : undefined}
      />
    </Card>
  );
}
