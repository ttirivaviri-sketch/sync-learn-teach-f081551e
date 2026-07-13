/**
 * PredictedGradeCard
 *
 * Surfaces the learner-model prediction per subject: grade band,
 * predicted %, confidence ring, signal breakdown, and a syllabus
 * coverage strip. Pure read-only — driven by usePredictedGrade.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Sparkles } from "lucide-react";
import { usePredictedGrade } from "../hooks/usePredictedGrade";
import { cn } from "@/lib/utils";

interface Props {
  subjects: { id: string; name: string }[];
}

const bandColor = (band: string) => {
  switch (band) {
    case "A*":
    case "A": return "bg-emerald-500/15 text-emerald-600 border-emerald-500/30";
    case "B": return "bg-sky-500/15 text-sky-600 border-sky-500/30";
    case "C": return "bg-amber-500/15 text-amber-600 border-amber-500/30";
    case "D":
    case "E": return "bg-orange-500/15 text-orange-600 border-orange-500/30";
    default:  return "bg-destructive/15 text-destructive border-destructive/30";
  }
};

export function PredictedGradeCard({ subjects }: Props) {
  const { data, isLoading } = usePredictedGrade(subjects);

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  if (!data.length) return null;

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">Predicted grades</h3>
          <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">Learner model</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Blends mock scores, task accuracy, and topic mastery.
        </p>

        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.subjectId} className="rounded-xl border border-border/60 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{d.subjectName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.signals.sampleSize} attempts · {d.signals.topicsCovered}/{d.signals.topicsTotal || "—"} topics mastered
                  </p>
                </div>
                {/* Square "Predicted" chip — spec p.7: not circular, so it never reads as an avatar */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">Predicted</span>
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-md border text-sm font-bold", bandColor(d.band))}>
                    {d.band}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Confidence in this prediction</span>
                  <span className="font-semibold text-primary">{Math.round(d.confidence * 100)}%</span>
                </div>
                <Progress value={d.confidence * 100} className="h-1" />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <Signal label="Mock" value={d.signals.mockExamPercent} icon={<Target className="h-3 w-3" />} />
                <Signal label="Recent" value={d.signals.recentAccuracy} icon={<TrendingUp className="h-3 w-3" />} />
                <Signal label="Mastery" value={d.signals.avgMastery} icon={<Sparkles className="h-3 w-3" />} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Signal({ label, value, icon }: { label: string; value: number | null; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {icon}{label}
      </div>
      <p className="text-xs font-semibold mt-0.5">
        {value == null ? <span className="text-muted-foreground">—</span> : `${value}%`}
      </p>
    </div>
  );
}
