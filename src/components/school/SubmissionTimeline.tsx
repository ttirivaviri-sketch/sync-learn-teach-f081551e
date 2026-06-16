/**
 * Visual status timeline for an assignment submission.
 * Stages: Not started → Draft saved → Submitted → Graded → Feedback provided
 */
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Submission } from "@/hooks/useSchoolAcademics";

interface Props {
  submission: Pick<Submission, "status" | "submitted_at" | "graded_at" | "feedback" | "updated_at" | "created_at"> | null | undefined;
}

export function SubmissionTimeline({ submission }: Props) {
  const status = submission?.status ?? "not_started";
  const submittedAt = submission?.submitted_at ?? null;
  const gradedAt = submission?.graded_at ?? null;
  const hasFeedback = !!submission?.feedback?.trim();

  const steps: Array<{ label: string; done: boolean; at?: string | null }> = [
    { label: "Started", done: !!submission, at: submission?.created_at },
    { label: "Draft saved", done: ["draft", "submitted", "late", "graded"].includes(status), at: status === "draft" ? submission?.updated_at : submittedAt },
    { label: "Submitted", done: ["submitted", "late", "graded"].includes(status), at: submittedAt },
    { label: "Graded", done: status === "graded", at: gradedAt },
    { label: "Feedback provided", done: status === "graded" && hasFeedback, at: hasFeedback ? gradedAt : null },
  ];

  return (
    <ol className="space-y-2">
      {steps.map((s, i) => {
        const Icon = s.done ? CheckCircle2 : i === steps.findIndex((x) => !x.done) ? Clock : Circle;
        return (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <Icon className={cn("h-4 w-4 shrink-0", s.done ? "text-primary" : "text-muted-foreground")} />
            <span className={cn(s.done ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
            {s.at && <span className="text-xs text-muted-foreground ml-auto">{new Date(s.at).toLocaleString()}</span>}
          </li>
        );
      })}
    </ol>
  );
}
