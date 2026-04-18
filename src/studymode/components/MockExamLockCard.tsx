/**
 * MockExamLockCard
 *
 * Gamified per-paper card: shows trophy + progress ring while locked,
 * "Start Mock Exam" CTA + celebration once unlocked.
 */

import { Trophy, Lock, Sparkles, Clock, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MockExamUnlock } from "../hooks/useMockExamUnlock";

interface Props {
  paper: MockExamUnlock;
  onStart: () => void;
}

export function MockExamLockCard({ paper, onStart }: Props) {
  const progress = paper.topicsTotal
    ? Math.round((paper.topicsMastered / paper.topicsTotal) * 100)
    : 0;
  const radius = 28;
  const circ = 2 * Math.PI * radius;
  const dash = (progress / 100) * circ;

  const remaining = paper.topicsTotal - paper.topicsMastered;

  return (
    <Card
      className={cn(
        "rounded-2xl overflow-hidden border-2 transition-all",
        paper.unlocked
          ? "border-primary bg-gradient-to-br from-primary/10 via-card to-accent/10"
          : "border-border bg-card"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {/* Progress ring with trophy / lock */}
          <div className="relative shrink-0">
            <svg width={70} height={70} className="-rotate-90">
              <circle
                cx={35}
                cy={35}
                r={radius}
                stroke="hsl(var(--muted))"
                strokeWidth={5}
                fill="none"
              />
              <circle
                cx={35}
                cy={35}
                r={radius}
                stroke={paper.unlocked ? "hsl(var(--primary))" : "hsl(var(--accent))"}
                strokeWidth={5}
                fill="none"
                strokeDasharray={circ}
                strokeDashoffset={circ - dash}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {paper.unlocked ? (
                <Trophy className="h-7 w-7 text-primary animate-pulse" />
              ) : (
                <Lock className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-foreground truncate">
                {paper.subjectName} — {paper.paperCode}
              </p>
              {paper.unlocked && (
                <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px] gap-1">
                  <Sparkles className="h-3 w-3" /> Unlocked
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
              {paper.totalMarks ? (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {paper.totalMarks} marks
                </span>
              ) : null}
              {paper.durationMinutes ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {paper.durationMinutes} min
                </span>
              ) : null}
            </div>

            {paper.unlocked ? (
              <p className="text-xs text-primary font-medium mt-1">
                You're ready. Sit the full mock exam now.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {paper.topicsMastered}/{paper.topicsTotal} topics mastered ·{" "}
                {paper.readinessPercent}% ready
              </p>
            )}
          </div>
        </div>

        {!paper.unlocked && remaining > 0 && (
          <div className="rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">
              Master {remaining} more topic{remaining > 1 ? "s" : ""} to unlock:
            </p>
            <ul className="space-y-0.5">
              {paper.unmasteredTopics.slice(0, 3).map((t) => (
                <li key={t.topic} className="flex justify-between gap-2">
                  <span className="truncate">{t.topic}</span>
                  <span className="text-foreground/70 shrink-0">
                    {Math.round(t.mastery)}%
                  </span>
                </li>
              ))}
              {paper.unmasteredTopics.length > 3 && (
                <li className="text-[10px] opacity-70">
                  + {paper.unmasteredTopics.length - 3} more
                </li>
              )}
            </ul>
          </div>
        )}

        <Button
          onClick={onStart}
          disabled={!paper.unlocked}
          className="w-full"
          variant={paper.unlocked ? "default" : "outline"}
        >
          {paper.unlocked ? (
            <>
              <Trophy className="h-4 w-4 mr-1.5" /> Start Mock Exam
            </>
          ) : (
            <>
              <Lock className="h-4 w-4 mr-1.5" /> Locked
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
