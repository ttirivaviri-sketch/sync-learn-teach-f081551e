/**
 * MockExamSection
 *
 * Dashboard widget that lists every paper with its unlock state and
 * orchestrates the runner + results flow.
 */

import { useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMockExamUnlock, type MockExamUnlock } from "../hooks/useMockExamUnlock";
import { useMockExam } from "../hooks/useMockExam";
import { MockExamLockCard } from "./MockExamLockCard";
import { MockExamRunner } from "./MockExamRunner";
import { MockExamResults } from "./MockExamResults";

export function MockExamSection() {
  const { papers, isLoading, refresh } = useMockExamUnlock();
  const exam = useMockExam();
  const [result, setResult] = useState<{
    graded: any[];
    marksAwarded: number;
    percent: number;
    band: string;
  } | null>(null);

  if (isLoading) {
    return <Skeleton className="h-32 rounded-2xl" />;
  }

  if (papers.length === 0) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="p-6 text-center">
          <Trophy className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Mock Exam Mode</p>
          <p className="text-xs text-muted-foreground mt-1">
            Upload past papers + mark schemes, then master all topics to unlock the full mock exam.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleStart = async (p: MockExamUnlock) => {
    try {
      await exam.startExam(p.subjectId, p.subjectName, p.paperCode);
    } catch {
      // toast already shown by hook
    }
  };

  const handleSubmit = async (answers: Record<string, string>, secs: number) => {
    const r = await exam.submitAndGrade(answers, secs);
    if (r) {
      setResult(r);
      refresh();
    }
  };

  const handleClose = () => {
    setResult(null);
    exam.reset();
  };

  return (
    <>
      <Card className="rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Mock Exam Mode</h3>
            <span className="text-[10px] text-muted-foreground ml-auto">
              Unlocked when all topics are mastered
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {papers.map((p) => (
              <MockExamLockCard
                key={`${p.subjectId}-${p.paperCode}`}
                paper={p}
                onStart={() => handleStart(p)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generating state */}
      {exam.isGenerating && (
        <div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-semibold">Building your mock paper…</p>
          <p className="text-xs text-muted-foreground">
            Matching the real blueprint and pulling past-paper exemplars.
          </p>
        </div>
      )}

      {/* Runner */}
      {exam.paper && !result && !exam.isGenerating && (
        <MockExamRunner
          paper={exam.paper}
          onSubmit={handleSubmit}
          isGrading={exam.isGrading}
          gradeProgress={exam.gradeProgress}
        />
      )}

      {/* Results */}
      {exam.paper && result && (
        <MockExamResults paper={exam.paper} result={result} onClose={handleClose} />
      )}
    </>
  );
}
