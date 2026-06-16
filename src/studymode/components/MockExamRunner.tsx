/**
 * MockExamRunner
 *
 * Full-screen mock exam: timer, question navigator, save-as-you-go,
 * auto-submit on timer expiry.
 */

import { useState, useEffect, useRef } from "react";
import { Clock, ChevronLeft, ChevronRight, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { MathMarkdown } from "./MathMarkdown";
import { cn } from "@/lib/utils";
import type { MockPaper } from "../hooks/useMockExam";

interface Props {
  paper: MockPaper;
  onSubmit: (answers: Record<string, string>, timeTakenSeconds: number) => void;
  isGrading: boolean;
  gradeProgress: number;
}

export function MockExamRunner({ paper, onSubmit, isGrading, gradeProgress }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState((paper.duration_minutes || 60) * 60);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timer);
          onSubmit(answers, Math.floor((Date.now() - startedAt.current) / 1000));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const q = paper.questions[idx];
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const lowTime = secondsLeft < 300;

  if (isGrading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-lg font-semibold">Examiner is grading your paper…</p>
        <div className="w-full max-w-sm">
          <Progress value={gradeProgress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center mt-2">
            {gradeProgress}% — checking each answer against the official mark scheme
          </p>
        </div>
      </div>
    );
  }

  const submit = () =>
    onSubmit(answers, Math.floor((Date.now() - startedAt.current) / 1000));

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top bar */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3 bg-card">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {paper.subject} · {paper.paper_code}
          </p>
          <p className="text-sm font-semibold truncate">
            Question {idx + 1} of {paper.questions.length}
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 font-mono text-sm font-bold px-3 py-1.5 rounded-lg",
            lowTime
              ? "bg-destructive/15 text-destructive animate-pulse"
              : "bg-muted text-foreground"
          )}
        >
          <Clock className="h-4 w-4" />
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{q.question_type}</Badge>
              <Badge>{q.marks} marks</Badge>
              {q.command_word && <Badge variant="secondary">{q.command_word}</Badge>}
            </div>

            <div className="prose prose-sm max-w-none dark:prose-invert">
              <MathMarkdown>{q.question}</MathMarkdown>
            </div>

            {q.question_type === "mcq" && q.options ? (
              <div className="space-y-2">
                {q.options.map((opt, i) => {
                  const letter = String.fromCharCode(65 + i);
                  const selected = answers[q.id] === letter;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswers({ ...answers, [q.id]: letter })}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border-2 transition-all text-sm",
                        selected
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <span className="font-bold mr-2">{letter}.</span>
                      <MathMarkdown>{opt.replace(/^[A-D]\)\s*/, "")}</MathMarkdown>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <PhotoAnswerButton
                    question={q.question}
                    totalMarks={q.marks}
                    onAnswer={(text) =>
                      setAnswers((a) => ({
                        ...a,
                        [q.id]: a[q.id] ? `${a[q.id]}\n\n${text}` : text,
                      }))
                    }
                  />
                </div>
                <Textarea
                  placeholder={`Write your answer here… (${q.marks} marks)`}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="min-h-[180px]"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border px-4 py-3 bg-card space-y-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {paper.questions.map((qq, i) => {
            const filled = !!answers[qq.id];
            return (
              <button
                key={qq.id}
                onClick={() => setIdx(i)}
                className={cn(
                  "shrink-0 w-8 h-8 rounded-lg text-xs font-semibold border-2 transition-all",
                  i === idx && "ring-2 ring-primary ring-offset-1",
                  filled
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-muted border-border text-muted-foreground"
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIdx(Math.max(0, idx - 1))}
            disabled={idx === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {idx < paper.questions.length - 1 ? (
            <Button
              className="flex-1"
              onClick={() => setIdx(idx + 1)}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={submit}>
              <Send className="h-4 w-4 mr-1" /> Submit Paper
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
