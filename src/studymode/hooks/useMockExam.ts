/**
 * useMockExam
 *
 * Orchestrates a mock exam attempt: generate paper, persist attempt,
 * grade each answer via grade-answer, save final result.
 */

import { useState, useCallback } from "react";
import { supabase } from "../../integrations/supabase/client";
import { logger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";

export interface MockQuestion {
  id: string;
  number: string;
  question_type: string;
  question: string;
  options?: string[];
  correct_option?: string;
  marks: number;
  command_word: string;
  topic: string;
  model_answer: string;
  marking_scheme: string[];
}

export interface MockPaper {
  paper_code: string;
  subject: string;
  subject_id: string;
  total_marks: number;
  duration_minutes: number;
  instructions: string;
  questions: MockQuestion[];
}

export interface GradedQuestion {
  question_id: string;
  marks_awarded: number;
  marks_possible: number;
  per_point: { point: string; awarded: number; max: number; feedback: string }[];
  overall_feedback: string;
  missed_keywords: string[];
  improvement_tips: string[];
  topic: string;
}

function gradeBand(percent: number): string {
  if (percent >= 90) return "A*";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  if (percent >= 40) return "E";
  return "U";
}

export function useMockExam() {
  const { toast } = useToast();
  const [paper, setPaper] = useState<MockPaper | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [isGenerating, setGenerating] = useState(false);
  const [isGrading, setGrading] = useState(false);
  const [gradeProgress, setGradeProgress] = useState(0);

  const startExam = useCallback(
    async (subjectId: string, subjectName: string, paperCode: string) => {
      setGenerating(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-mock-paper",
          { body: { subject_id: subjectId, paper_code: paperCode } }
        );
        if (error) throw error;

        const p = data as MockPaper;
        setPaper(p);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: row, error: insErr } = await supabase
          .from("mock_exam_attempts" as any)
          .insert({
            user_id: user.id,
            subject_id: subjectId,
            subject_name: subjectName,
            paper_code: paperCode,
            total_marks: p.total_marks,
            duration_minutes: p.duration_minutes,
            paper_json: p as any,
            status: "in_progress",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        setAttemptId((row as any).id);
        return p;
      } catch (e: any) {
        logger.error("[useMockExam.startExam]", e);
        toast({
          title: "Couldn't generate mock paper",
          description: e.message || "Please try again.",
          variant: "destructive",
        });
        throw e;
      } finally {
        setGenerating(false);
      }
    },
    [toast]
  );

  const submitAndGrade = useCallback(
    async (
      answers: Record<string, string>,
      timeTakenSeconds: number
    ): Promise<{
      graded: GradedQuestion[];
      marksAwarded: number;
      percent: number;
      band: string;
    } | null> => {
      if (!paper || !attemptId) return null;
      setGrading(true);
      setGradeProgress(0);

      const graded: GradedQuestion[] = [];
      let marksAwarded = 0;

      try {
        for (let i = 0; i < paper.questions.length; i++) {
          const q = paper.questions[i];
          const ans = (answers[q.id] || "").trim();

          if (q.question_type === "mcq" && q.correct_option) {
            const correct =
              ans.toUpperCase().startsWith(q.correct_option.toUpperCase());
            const m = correct ? q.marks : 0;
            marksAwarded += m;
            graded.push({
              question_id: q.id,
              marks_awarded: m,
              marks_possible: q.marks,
              per_point: [
                {
                  point: `Correct answer: ${q.correct_option}`,
                  awarded: m,
                  max: q.marks,
                  feedback: correct
                    ? "Correct."
                    : `You chose ${ans || "nothing"}. Correct: ${q.correct_option}.`,
                },
              ],
              overall_feedback: correct ? "Correct." : "Incorrect.",
              missed_keywords: [],
              improvement_tips: correct ? [] : [`Review ${q.topic}`],
              topic: q.topic,
            });
          } else {
            // AI grading via grade-answer
            const { data, error } = await supabase.functions.invoke(
              "grade-answer",
              {
                body: {
                  question: q.question,
                  student_answer: ans,
                  marking_scheme: q.marking_scheme,
                  model_answer: q.model_answer,
                  marks: q.marks,
                  command_word: q.command_word,
                  subject: paper.subject,
                  topic: q.topic,
                },
              }
            );
            if (error || !data) {
              graded.push({
                question_id: q.id,
                marks_awarded: 0,
                marks_possible: q.marks,
                per_point: [],
                overall_feedback: "Could not grade — try again later.",
                missed_keywords: [],
                improvement_tips: [],
                topic: q.topic,
              });
            } else {
              const d = data as any;
              marksAwarded += Number(d.marks_awarded || 0);
              graded.push({
                question_id: q.id,
                marks_awarded: Number(d.marks_awarded || 0),
                marks_possible: Number(d.marks_possible || q.marks),
                per_point: Array.isArray(d.per_point) ? d.per_point : [],
                overall_feedback: d.overall_feedback || "",
                missed_keywords: d.missed_keywords || [],
                improvement_tips: d.improvement_tips || [],
                topic: q.topic,
              });
            }
          }
          setGradeProgress(Math.round(((i + 1) / paper.questions.length) * 100));
        }

        const percent = paper.total_marks
          ? Math.round((marksAwarded / paper.total_marks) * 100)
          : 0;
        const band = gradeBand(percent);

        await supabase
          .from("mock_exam_attempts" as any)
          .update({
            answers_json: answers as any,
            grading_json: { graded } as any,
            marks_awarded: marksAwarded,
            percent,
            grade_band: band,
            time_taken_seconds: timeTakenSeconds,
            status: "submitted",
            submitted_at: new Date().toISOString(),
          })
          .eq("id", attemptId);

        return { graded, marksAwarded, percent, band };
      } catch (e: any) {
        logger.error("[useMockExam.submitAndGrade]", e);
        toast({
          title: "Grading failed",
          description: e.message || "Please try again.",
          variant: "destructive",
        });
        return null;
      } finally {
        setGrading(false);
      }
    },
    [paper, attemptId, toast]
  );

  return {
    paper,
    attemptId,
    isGenerating,
    isGrading,
    gradeProgress,
    startExam,
    submitAndGrade,
    reset: () => {
      setPaper(null);
      setAttemptId(null);
      setGradeProgress(0);
    },
  };
}
