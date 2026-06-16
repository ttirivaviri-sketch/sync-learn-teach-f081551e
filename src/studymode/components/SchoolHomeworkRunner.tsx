/**
 * SchoolHomeworkRunner — student-side homework UI inside StudyMode.
 * Renders questions, collects answers, submits, then shows AI feedback
 * (when released by teacher settings) and provisional grades.
 */
import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Lock, GraduationCap } from "lucide-react";
import { useHomeworkDetail, useSubmitHomework } from "@/hooks/useSchoolStudyMode";
import { useToast } from "@/hooks/use-toast";

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
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Seed with existing answers (resume flow).
  useEffect(() => {
    if (!data?.responses) return;
    const seed: Record<string, string> = {};
    for (const r of data.responses as any[]) {
      if (r.student_answer) seed[r.question_id] = r.student_answer;
    }
    setAnswers((prev) => ({ ...seed, ...prev }));
  }, [data?.responses]);

  const responseById = useMemo(() => {
    const m = new Map<string, any>();
    for (const r of (data?.responses ?? []) as any[]) m.set(r.question_id, r);
    return m;
  }, [data?.responses]);

  const allAnswered = data?.questions?.every((q: any) => (answers[q.id] ?? "").trim().length > 0);

  if (isLoading || !data?.homework) {
    return <div className="p-6 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }
  const hw = data.homework as any;

  const onSubmit = async () => {
    const payload = (data.questions as any[]).map((q) => ({
      question_id: q.id, answer: (answers[q.id] ?? "").trim(),
    }));
    try {
      const r = await submit.mutateAsync({ schoolId: hw.school_id, homeworkId, answers: payload });
      toast({
        title: r.grades_released ? "Submitted & graded" : "Submitted",
        description: r.feedback_visible ? "Feedback is available below." : "Your teacher will review and release grades.",
      });
      onDone?.();
    } catch (e) {
      toast({ title: "Submit failed", description: (e as Error).message, variant: "destructive" });
    }
  };

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
        {hw.instructions && <p className="text-sm mt-3 text-muted-foreground">{hw.instructions}</p>}
      </Card>

      {(data.questions as any[]).map((q, i) => {
        const resp = responseById.get(q.id);
        const released = resp?.status === "released";
        const feedback = resp?.ai_feedback;

        return (
          <Card key={q.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">
                <span className="text-muted-foreground mr-2">Q{i + 1}.</span>{q.prompt}
              </p>
              <Badge variant="secondary" className="shrink-0">{q.marks} mk</Badge>
            </div>

            {q.options && Array.isArray(q.options) ? (
              <div className="space-y-2">
                {(q.options as string[]).map((opt) => (
                  <Button
                    key={opt}
                    variant={answers[q.id] === opt ? "default" : "outline"}
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                  >{opt}</Button>
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
                <p><span className="font-medium">Examiner expects:</span> {feedback.examiner_expects}</p>
                <p><span className="font-medium">What you missed:</span> {feedback.what_you_missed}</p>
                <p><span className="font-medium">Concept fix:</span> {feedback.concept_fix}</p>
                {resp?.teacher_comment && (
                  <p className="pt-2 border-t border-border"><span className="font-medium">Teacher:</span> {resp.teacher_comment}</p>
                )}
              </div>
            )}
          </Card>
        );
      })}

      <Button onClick={onSubmit} disabled={!allAnswered || submit.isPending} className="w-full">
        {submit.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Submit homework
      </Button>
    </div>
  );
}
