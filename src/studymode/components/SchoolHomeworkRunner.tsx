/**
 * SchoolHomeworkRunner — student-side homework UI inside StudyMode.
 * Renders questions (KaTeX math + AI-authored visuals), collects answers,
 * submits, then shows AI feedback (when released by teacher settings) and
 * provisional grades.
 *
 * Draft answers are persisted to localStorage per homework+student so a
 * closed dialog doesn't lose typed work before submission.
 */
import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Lock, GraduationCap, AlertTriangle, CalendarClock, ListChecks } from "lucide-react";
import { useHomeworkDetail, useSubmitHomework } from "@/hooks/useSchoolStudyMode";
import { useToast } from "@/hooks/use-toast";
import { MathMarkdown } from "./MathMarkdown";
import { QuestionVisual, type QuestionVisualSpec } from "./QuestionVisual";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";

const draftKey = (homeworkId: string, studentId: string) =>
  `ss-hw-draft:${homeworkId}:${studentId}`;

function loadDraft(homeworkId: string, studentId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(draftKey(homeworkId, studentId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function SchoolHomeworkRunner({
  homeworkId,
  studentId,
  onDone,
}: {
  homeworkId: string;
  studentId: string;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const { data, isLoading } = useHomeworkDetail(homeworkId, studentId);
  const submit = useSubmitHomework();
  const [answers, setAnswers] = useState<Record<string, string>>(() => loadDraft(homeworkId, studentId));

  // Seed with existing answers (resume flow) — server answers win over drafts.
  useEffect(() => {
    if (!data?.responses) return;
    const seed: Record<string, string> = {};
    for (const r of data.responses as any[]) {
      if (r.student_answer) seed[r.question_id] = r.student_answer;
    }
    setAnswers((prev) => ({ ...prev, ...seed }));
  }, [data?.responses]);

  // Persist draft answers so closing the dialog doesn't lose typed work.
  useEffect(() => {
    try {
      if (Object.keys(answers).length > 0) {
        localStorage.setItem(draftKey(homeworkId, studentId), JSON.stringify(answers));
      }
    } catch { /* storage full/unavailable — non-fatal */ }
  }, [answers, homeworkId, studentId]);

  const responseById = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of (data?.responses ?? []) as any[]) m.set(r.question_id, r);
    return m;
  }, [data?.responses]);

  const questions = (data?.questions ?? []) as any[];
  const answeredCount = questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length;
  const allAnswered = questions.length > 0 && answeredCount === questions.length;

  if (isLoading || !data?.homework) {
    return <div className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  const hw = data.homework as any;

  const onSubmit = async () => {
    const payload = questions.map((q) => ({
      question_id: q.id, answer: (answers[q.id] ?? "").trim(),
    }));
    try {
      const r = await submit.mutateAsync({ schoolId: hw.school_id, homeworkId, answers: payload });
      try { localStorage.removeItem(draftKey(homeworkId, studentId)); } catch { /* ignore */ }
      const unmarked = Number((r as any).unmarked_count ?? 0);
      toast({
        title: r.grades_released ? "Submitted & graded" : "Submitted",
        description: unmarked > 0
          ? `${unmarked} answer(s) will be marked by your teacher directly.`
          : r.feedback_visible ? "Feedback is available below." : "Your teacher will review and release grades.",
      });
      onDone?.();
    } catch (e) {
      toast({ title: "Submit failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const isChoice = (q: any) =>
    Array.isArray(q.options) && q.options.length > 0;

  const dueMs = hw.due_at ? new Date(hw.due_at).getTime() - Date.now() : null;
  const dueText = hw.due_at
    ? (dueMs! < 0 ? "Overdue" : `Due ${new Date(hw.due_at).toLocaleString()}`)
    : "No due date";

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> {hw.title}
            </h2>
            {hw.topic && <p className="text-sm text-muted-foreground">{hw.topic}</p>}
          </div>
          <Badge variant="outline">{hw.total_marks} marks</Badge>
        </div>

        <div className={`mt-3 inline-flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 ${
          dueMs !== null && dueMs < 0
            ? "bg-destructive/10 text-destructive"
            : dueMs !== null && dueMs < 3 * 86400000
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "bg-muted text-muted-foreground"}`}>
          <CalendarClock className="h-3.5 w-3.5" /> {dueText}
        </div>

        {hw.instructions && <p className="text-sm mt-3 text-muted-foreground">{hw.instructions}</p>}

        {/* Marking rubric — how the marks are split across questions. */}
        {questions.length > 0 && (
          <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ListChecks className="h-4 w-4 text-primary" /> Marking rubric
            </div>
            <ul className="mt-2 space-y-1">
              {questions.map((q, i) => (
                <li key={q.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">
                    Q{i + 1} · {isChoice(q) ? "Multiple choice" : (q.question_type ?? "Written answer")}
                  </span>
                  <span className="shrink-0">{q.marks} mk</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-2">
              Marks are awarded per marking point. Show your working for multi-mark questions —
              full detailed feedback appears once your teacher releases it.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {answeredCount}/{questions.length} answered
          </span>
        </div>
      </Card>


      {questions.map((q, i) => {
        const resp = responseById.get(q.id);
        const released = resp?.status === "released";
        const needsTeacher = resp?.status === "submitted";
        const feedback = resp?.ai_feedback;
        const visual = (q.visual ?? null) as QuestionVisualSpec | null;

        return (
          <Card key={q.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium prose prose-sm dark:prose-invert max-w-none flex-1">
                <span className="text-muted-foreground mr-2">Q{i + 1}.</span>
                <MathMarkdown>{q.prompt}</MathMarkdown>
              </div>
              <Badge variant="secondary" className="shrink-0">{q.marks} mk</Badge>
            </div>

            {visual && <QuestionVisual visual={visual} />}

            {isChoice(q) ? (
              <div className="space-y-2">
                {(q.options as string[]).map((opt) => (
                  <Button
                    key={opt}
                    variant={answers[q.id] === opt ? "default" : "outline"}
                    className="w-full justify-start text-left h-auto py-2 whitespace-normal"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  >
                    <span className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0">
                      <MathMarkdown>{opt}</MathMarkdown>
                    </span>
                  </Button>
                ))}
              </div>
            ) : (
              <Textarea
                placeholder="Type your answer…"
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                rows={3}
              />
            )}

            {needsTeacher && (
              <div className="rounded-lg bg-muted/40 p-3 flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                Automatic marking wasn't available for this answer — your teacher will mark it.
              </div>
            )}

            {feedback && (
              <div className="rounded-lg bg-muted/40 p-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {feedback.correct
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    : <Lock className="h-4 w-4 text-amber-500" />}
                  {released
                    ? <>Score: {resp.teacher_score ?? resp.ai_score} / {q.marks}</>
                    : <span className="text-muted-foreground">Grade held until teacher releases</span>}
                </div>
                <div><span className="font-medium">Examiner expects:</span> <MathMarkdown>{feedback.examiner_expects}</MathMarkdown></div>
                <div><span className="font-medium">What you missed:</span> <MathMarkdown>{feedback.what_you_missed}</MathMarkdown></div>
                <div><span className="font-medium">Concept fix:</span> <MathMarkdown>{feedback.concept_fix}</MathMarkdown></div>
                {resp?.teacher_comment && (
                  <p className="pt-2 border-t border-border"><span className="font-medium">Teacher:</span> {resp.teacher_comment}</p>
                )}
              </div>
            )}
          </Card>
        );
      })}

      {questions.some((q) => responseById.get(q.id)?.ai_feedback) && (
        <FeedbackWidget
          surface="school_homework"
          prompt="Was the homework feedback helpful?"
          topicName={hw.topic ?? null}
          context={{ homework_id: homeworkId }}
          className="px-1"
        />
      )}

      <Button onClick={onSubmit} disabled={!allAnswered || submit.isPending} className="w-full">
        {submit.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {allAnswered ? "Submit homework" : `Answer all questions to submit (${answeredCount}/${questions.length})`}
      </Button>
    </div>
  );
}
