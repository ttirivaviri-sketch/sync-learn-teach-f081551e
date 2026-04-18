/**
 * ExamReadinessWidget
 *
 * Per-paper readiness bars powered by paper_blueprints + get_exam_readiness RPC.
 * Shows readiness %, confidence band, and weakest topics / question types.
 */

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, AlertTriangle } from "lucide-react";
import { useExamReadiness } from "../hooks/useExamReadiness";
import { Skeleton } from "@/components/ui/skeleton";

const BAND_LABEL: Record<string, { label: string; tone: string }> = {
  ready: { label: "Ready", tone: "bg-success/15 text-success border-success/30" },
  building: { label: "Building", tone: "bg-warning/15 text-warning border-warning/30" },
  low: { label: "More practice", tone: "bg-destructive/15 text-destructive border-destructive/30" },
  unknown: { label: "Not enough data", tone: "bg-muted text-muted-foreground border-border" },
};

export function ExamReadinessWidget() {
  const { papers, isLoading } = useExamReadiness();

  if (isLoading) {
    return <Skeleton className="h-40 rounded-2xl" />;
  }

  if (papers.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="p-6 text-center">
          <Target className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Exam Readiness</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload past papers + their mark schemes to see per-paper readiness.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Exam Readiness</h3>
        </div>

        <div className="space-y-4">
          {papers.map((p) => {
            const band = BAND_LABEL[p.confidenceBand] || BAND_LABEL.unknown;
            return (
              <div
                key={`${p.subjectId}-${p.paperCode}`}
                className="rounded-xl border border-border p-3 space-y-2 bg-card"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {p.subjectName} — {p.paperCode}
                    </p>
                    {p.yearsAnalysed && p.yearsAnalysed.length > 0 && (
                      <p className="text-[10px] text-muted-foreground">
                        Based on {p.yearsAnalysed.join(", ")}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className={`${band.tone} text-xs shrink-0`}>
                    {band.label}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Progress value={p.readinessPercent} className="h-2 flex-1" />
                  <span className="text-sm font-bold text-foreground w-10 text-right">
                    {p.readinessPercent}%
                  </span>
                </div>

                {p.weakestTopics.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">
                      <span className="text-foreground font-medium">Weakest:</span>{" "}
                      {p.weakestTopics
                        .slice(0, 3)
                        .map((t) => t.topic)
                        .join(", ")}
                    </p>
                  </div>
                )}

                {p.weakestQuestionTypes.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs">
                    <TrendingUp className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                    <p className="text-muted-foreground">
                      Practice more:{" "}
                      {p.weakestQuestionTypes.map((q) => q.question_type).join(", ")}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
