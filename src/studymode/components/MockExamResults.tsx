/**
 * MockExamResults
 *
 * Animated grade reveal + per-question feedback breakdown.
 */

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, AlertCircle, CheckCircle2, XCircle, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { MathMarkdown } from "./MathMarkdown";
import type { MockPaper, GradedQuestion } from "../hooks/useMockExam";

interface Props {
  paper: MockPaper;
  result: {
    graded: GradedQuestion[];
    marksAwarded: number;
    percent: number;
    band: string;
  };
  onClose: () => void;
}

const BAND_COLOR: Record<string, string> = {
  "A*": "text-amber-500",
  A: "text-primary",
  B: "text-success",
  C: "text-success",
  D: "text-warning",
  E: "text-warning",
  U: "text-destructive",
};

export function MockExamResults({ paper, result, onClose }: Props) {
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    let cur = 0;
    const target = result.percent;
    const step = Math.max(1, Math.round(target / 30));
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) {
        cur = target;
        clearInterval(t);
      }
      setAnimatedPercent(cur);
    }, 30);
    return () => clearInterval(t);
  }, [result.percent]);

  // Per-topic breakdown
  const byTopic = result.graded.reduce<Record<string, { awarded: number; possible: number }>>(
    (acc, g) => {
      if (!acc[g.topic]) acc[g.topic] = { awarded: 0, possible: 0 };
      acc[g.topic].awarded += g.marks_awarded;
      acc[g.topic].possible += g.marks_possible;
      return acc;
    },
    {}
  );

  const distinction = result.percent >= 80;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Hero grade reveal */}
        <Card
          className={cn(
            "rounded-2xl border-2 overflow-hidden",
            distinction
              ? "border-primary bg-gradient-to-br from-primary/15 via-card to-accent/15"
              : "border-border"
          )}
        >
          <CardContent className="p-6 text-center space-y-3">
            <div className="flex justify-center">
              <div className="relative">
                <Trophy
                  className={cn(
                    "h-16 w-16",
                    distinction ? "text-primary animate-bounce" : "text-muted-foreground"
                  )}
                />
              </div>
            </div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {paper.subject} · {paper.paper_code}
            </p>
            <div className="space-y-1">
              <p className={cn("text-7xl font-black tabular-nums", BAND_COLOR[result.band] || "text-foreground")}>
                {result.band}
              </p>
              <p className="text-3xl font-bold tabular-nums">{animatedPercent}%</p>
              <p className="text-sm text-muted-foreground">
                {result.marksAwarded} / {paper.total_marks} marks
              </p>
            </div>
            {distinction && (
              <Badge className="bg-primary text-primary-foreground gap-1">
                <Trophy className="h-3 w-3" /> Distinction earned
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Per-topic breakdown */}
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Performance by topic</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(byTopic).map(([topic, m]) => {
                const pct = m.possible ? Math.round((m.awarded / m.possible) * 100) : 0;
                return (
                  <div key={topic} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium truncate pr-2">{topic || "Unknown"}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {m.awarded}/{m.possible} ({pct}%)
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Per-question feedback */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2 px-1">
            <AlertCircle className="h-4 w-4 text-primary" /> Examiner feedback
          </h3>
          {result.graded.map((g, i) => {
            const q = paper.questions.find((qq) => qq.id === g.question_id);
            if (!q) return null;
            const full = g.marks_awarded === g.marks_possible;
            const zero = g.marks_awarded === 0;
            return (
              <Card key={g.question_id} className="rounded-xl">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {full ? (
                        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                      ) : zero ? (
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning shrink-0" />
                      )}
                      <span className="text-sm font-semibold">Q{q.number}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {q.topic}
                      </Badge>
                    </div>
                    <span className="text-sm font-bold tabular-nums shrink-0">
                      {g.marks_awarded}/{g.marks_possible}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground line-clamp-2">
                    <MathMarkdown>{q.question}</MathMarkdown>
                  </div>

                  {g.overall_feedback && (
                    <p className="text-xs italic text-foreground/80">
                      {g.overall_feedback}
                    </p>
                  )}

                  {g.per_point.length > 0 && (
                    <ul className="space-y-1">
                      {g.per_point.map((p, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                          {p.awarded === p.max ? (
                            <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />
                          ) : p.awarded === 0 ? (
                            <XCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                          )}
                          <span className="text-muted-foreground">
                            <span className="text-foreground">{p.point}</span>
                            {p.feedback ? ` — ${p.feedback}` : ""}
                            <span className="ml-1 font-mono text-foreground/60">
                              ({p.awarded}/{p.max})
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {g.improvement_tips.length > 0 && (
                    <div className="rounded bg-muted/50 p-2 text-[11px]">
                      <p className="font-medium text-foreground mb-0.5">Improve:</p>
                      <ul className="space-y-0.5 text-muted-foreground">
                        {g.improvement_tips.map((t, idx) => (
                          <li key={idx}>• {t}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
