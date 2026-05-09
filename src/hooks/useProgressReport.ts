/**
 * useProgressReport — Aggregates a learner's full study activity, asks the
 * AI for an improvement plan, and downloads a comprehensive PDF report.
 *
 * Two flavours:
 *   • audience: 'self'   — for the learner
 *   • audience: 'tutor'  — for sharing with a tutor; persists to
 *     `progress_reports` so the tutor's BookingCard can auto-attach it.
 */
import { useCallback, useState } from "react";
import { saveAs } from "file-saver";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/utils/logger";
import { useToast } from "@/hooks/use-toast";
import {
  generateProgressReportPdf,
  type ProgressReportData,
} from "@/lib/generateProgressReport";

export type ReportAudience = "self" | "tutor";

interface GenerateOptions {
  audience: ReportAudience;
  /** When audience='tutor' and provided, persists the report so the tutor
   *  can see it on their next booking with this learner. */
  tutorId?: string | null;
  /** Days of history to summarise (default 60) */
  windowDays?: number;
  /** When true, also email the PDF (to tutor + guardian as configured) */
  email?: boolean;
  /** Optional override for tutor email recipient */
  tutorEmail?: string | null;
  /** Optional override for guardian email recipient */
  guardianEmail?: string | null;
  /** Optional message from the student */
  message?: string;
}

export function useProgressReport(learnerId: string | null | undefined) {
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generate = useCallback(
    async (opts: GenerateOptions) => {
      if (!learnerId) {
        toast({
          title: "Not signed in",
          description: "Please sign in to generate your report.",
          variant: "destructive",
        });
        return;
      }
      setGenerating(true);
      try {
        const windowDays = opts.windowDays ?? 60;
        const since = new Date(
          Date.now() - windowDays * 24 * 60 * 60 * 1000
        ).toISOString();

        // Parallel fetch — every source is read-only, so no ordering needed
        const [
          profileRes,
          academicRes,
          activityRes,
          mockRes,
          dailyTasksRes,
          quizRes,
          subjectsRes,
          xpRes,
          tutorProfileRes,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, email")
            .eq("id", learnerId)
            .maybeSingle(),
          supabase
            .from("academic_profiles")
            .select(
              "curriculum, grade, subjects, exam_year, target_grade, school_name, exam_dates, goals, learning_style"
            )
            .eq("user_id", learnerId)
            .maybeSingle(),
          supabase
            .from("study_activity")
            .select(
              "subject, topic, activity_type, task_completed, score, duration_minutes, date, created_at"
            )
            .eq("user_id", learnerId)
            .gte("created_at", since)
            .order("created_at", { ascending: true })
            .limit(2000),
          supabase
            .from("mock_exam_attempts")
            .select(
              "id, subject_name, paper_code, total_marks, marks_awarded, percent, grade_band, time_taken_seconds, status, submitted_at, created_at"
            )
            .eq("user_id", learnerId)
            .order("created_at", { ascending: true })
            .limit(50),
          supabase
            .from("daily_tasks")
            .select("task_type, is_completed, completed_at, task_date, subject_id")
            .eq("user_id", learnerId)
            .gte("task_date", since.slice(0, 10))
            .limit(1000),
          supabase
            .from("quiz_attempts")
            .select(
              "topic_name, was_correct, marks_awarded, marks_possible, created_at"
            )
            .eq("user_id", learnerId)
            .gte("created_at", since)
            .order("created_at", { ascending: true })
            .limit(2000),
          supabase
            .from("learner_subjects")
            .select("subject")
            .eq("user_id", learnerId),
          (supabase as any)
            .from("subject_xp")
            .select("subject, xp, streak")
            .eq("user_id", learnerId),
          opts.tutorId
            ? supabase
                .from("profiles")
                .select("full_name")
                .eq("id", opts.tutorId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        const profile = profileRes.data;
        const academic = academicRes.data;
        const activity = activityRes.data ?? [];
        const mocks = mockRes.data ?? [];
        const tasks = dailyTasksRes.data ?? [];
        const quizzes = quizRes.data ?? [];
        const subjects = (subjectsRes.data ?? []).map((s: any) => s.subject);
        const xpRows = (xpRes.data ?? []) as Array<{
          subject: string;
          xp: number;
          streak: number;
        }>;
        const tutorName =
          (tutorProfileRes as any)?.data?.full_name || undefined;

        // ── Aggregations ──────────────────────────────────────────────────────
        const totalMinutes = activity.reduce(
          (sum, a: any) => sum + (a.duration_minutes ?? 0),
          0
        );
        const tasksCompleted = activity.filter(
          (a: any) => a.task_completed
        ).length;
        const totalXp = xpRows.reduce((s, r) => s + (r.xp || 0), 0);
        const bestStreak = xpRows.reduce(
          (s, r) => Math.max(s, r.streak || 0),
          0
        );

        // Tasks by type
        const tasksByType: Record<string, { done: number; total: number }> = {};
        for (const t of tasks) {
          const type = (t.task_type as string) || "other";
          if (!tasksByType[type]) tasksByType[type] = { done: 0, total: 0 };
          tasksByType[type].total += 1;
          if (t.is_completed) tasksByType[type].done += 1;
        }

        // Topic accuracy (from quiz_attempts)
        const topicStats = new Map<
          string,
          { attempts: number; correct: number; marks: number; possible: number }
        >();
        for (const q of quizzes) {
          const key = (q.topic_name as string) || "Untitled";
          const cur = topicStats.get(key) || {
            attempts: 0,
            correct: 0,
            marks: 0,
            possible: 0,
          };
          cur.attempts += 1;
          if (q.was_correct) cur.correct += 1;
          cur.marks += Number(q.marks_awarded ?? 0);
          cur.possible += Number(q.marks_possible ?? 0);
          topicStats.set(key, cur);
        }
        const topicAccuracy = [...topicStats.entries()]
          .map(([topic, s]) => ({
            topic,
            accuracy: s.attempts ? Math.round((s.correct * 100) / s.attempts) : 0,
            attempts: s.attempts,
          }))
          .sort((a, b) => b.attempts - a.attempts);

        const strongTopics = topicAccuracy
          .filter((t) => t.attempts >= 3 && t.accuracy >= 70)
          .slice(0, 8);
        const weakTopics = topicAccuracy
          .filter((t) => t.attempts >= 2 && t.accuracy < 50)
          .slice(0, 10);

        // Subject mastery proxy: avg topic accuracy per subject from study_activity
        const subjectStats = new Map<
          string,
          { totalScore: number; scoreCount: number; minutes: number; topics: Set<string> }
        >();
        for (const a of activity as any[]) {
          const subj = a.subject || "Unknown";
          const cur = subjectStats.get(subj) || {
            totalScore: 0,
            scoreCount: 0,
            minutes: 0,
            topics: new Set<string>(),
          };
          if (typeof a.score === "number" && a.score > 0) {
            cur.totalScore += Number(a.score);
            cur.scoreCount += 1;
          }
          cur.minutes += a.duration_minutes ?? 0;
          if (a.topic) cur.topics.add(a.topic);
          subjectStats.set(subj, cur);
        }
        const subjectMastery = [...subjectStats.entries()].map(([subject, s]) => ({
          subject,
          mastery: s.scoreCount ? Math.round(s.totalScore / s.scoreCount) : 0,
          minutes: s.minutes,
          topicsCovered: s.topics.size,
        }));

        // Mock exam trajectory
        const mockTrajectory = (mocks as any[])
          .filter((m) => m.status === "submitted" || m.percent > 0)
          .map((m) => ({
            id: m.id,
            subject: m.subject_name,
            paperCode: m.paper_code,
            percent: Math.round(Number(m.percent) || 0),
            grade: m.grade_band,
            marksAwarded: Number(m.marks_awarded) || 0,
            totalMarks: Number(m.total_marks) || 0,
            timeTakenSeconds: m.time_taken_seconds || 0,
            date: (m.submitted_at || m.created_at) as string,
          }));
        const avgMockScore = mockTrajectory.length
          ? Math.round(
              mockTrajectory.reduce((s, m) => s + m.percent, 0) /
                mockTrajectory.length
            )
          : 0;

        // Daily study minutes — last 30 days
        const dailyMinutes: Record<string, number> = {};
        for (let i = 29; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dailyMinutes[d.toISOString().slice(0, 10)] = 0;
        }
        for (const a of activity as any[]) {
          const day = (a.date as string) || (a.created_at as string)?.slice(0, 10);
          if (day && day in dailyMinutes) {
            dailyMinutes[day] += a.duration_minutes ?? 0;
          }
        }

        const overallMastery = subjectMastery.length
          ? Math.round(
              subjectMastery.reduce((s, x) => s + x.mastery, 0) /
                subjectMastery.length
            )
          : 0;

        // ── AI improvement plan ─────────────────────────────────────────────
        let aiPlan: any = null;
        try {
          const planRes = await supabase.functions.invoke(
            "generate-progress-plan",
            {
              body: {
                learner_id: learnerId,
                audience: opts.audience,
                tutor_name: tutorName,
                profile: {
                  curriculum: academic?.curriculum,
                  grade: academic?.grade,
                  target_grade: academic?.target_grade,
                  exam_year: academic?.exam_year,
                  subjects,
                  goals: academic?.goals,
                  learning_style: academic?.learning_style,
                },
                summary: {
                  total_minutes: totalMinutes,
                  tasks_completed: tasksCompleted,
                  total_xp: totalXp,
                  best_streak: bestStreak,
                  overall_mastery: overallMastery,
                  avg_mock_score: avgMockScore,
                  mock_count: mockTrajectory.length,
                },
                weak_topics: weakTopics,
                strong_topics: strongTopics,
                subject_mastery: subjectMastery,
                recent_mocks: mockTrajectory.slice(-5),
              },
            }
          );
          if (planRes.error) throw planRes.error;
          aiPlan = planRes.data;
        } catch (err) {
          logger.warn("AI plan generation failed, continuing without it", err);
        }

        // ── Build the PDF ────────────────────────────────────────────────────
        const reportData: ProgressReportData = {
          audience: opts.audience,
          generatedAt: new Date().toISOString(),
          windowDays,
          learner: {
            name: profile?.full_name || "Learner",
            email: profile?.email || "",
            curriculum: academic?.curriculum || null,
            grade: academic?.grade || null,
            targetGrade: academic?.target_grade || null,
            examYear: academic?.exam_year || null,
            schoolName: academic?.school_name || null,
            subjects,
            examDates: (academic?.exam_dates as any) || [],
          },
          tutorName,
          summary: {
            totalMinutes,
            tasksCompleted,
            totalXp,
            bestStreak,
            overallMastery,
            avgMockScore,
            mockCount: mockTrajectory.length,
          },
          subjectMastery,
          dailyMinutes,
          mockTrajectory,
          tasksByType,
          strongTopics,
          weakTopics,
          aiPlan,
        };

        const blob = await generateProgressReportPdf(reportData);
        const stamp = new Date().toISOString().slice(0, 10);
        const suffix = opts.audience === "tutor" ? "-for-tutor" : "";
        const fileName = `StudySync-Progress-${stamp}${suffix}.pdf`;
        saveAs(blob, fileName);

        // Persist tutor-flavoured report so the tutor can see it on their booking
        if (opts.audience === "tutor" && opts.tutorId) {
          const { error: insErr } = await supabase
            .from("progress_reports")
            .insert({
              learner_id: learnerId,
              tutor_id: opts.tutorId,
              audience: "tutor",
              summary_json: reportData as any,
              ai_plan_json: aiPlan ?? {},
            });
          if (insErr) {
            logger.warn("Could not persist progress report for tutor", insErr);
            toast({
              title: "Saved locally",
              description: "Downloaded, but couldn't save to your tutor's dashboard.",
              variant: "destructive",
            });
          }
        }

        // Email to tutor / guardian on behalf of the student
        if (opts.email) {
          const recipients: Array<{ email: string; role: "tutor" | "guardian" }> = [];
          const tutorEmail = opts.tutorEmail?.trim();
          const guardianEmail =
            opts.guardianEmail?.trim() || (academic as any)?.guardian_email?.trim();
          if (tutorEmail) recipients.push({ email: tutorEmail, role: "tutor" });
          if (guardianEmail) recipients.push({ email: guardianEmail, role: "guardian" });

          if (recipients.length === 0) {
            toast({
              title: "No recipients",
              description: "Add a tutor or guardian email in your profile first.",
              variant: "destructive",
            });
          } else {
            const pdfBase64 = await blobToBase64(blob);
            const studentEmail =
              (academic as any)?.student_email || profile?.email || "";
            const { data: sendData, error: sendErr } =
              await supabase.functions.invoke("send-progress-report", {
                body: {
                  learnerId,
                  pdfBase64,
                  fileName,
                  recipients,
                  studentName: profile?.full_name || "Student",
                  studentEmail,
                  message: opts.message,
                },
              });
            if (sendErr) {
              logger.error("send-progress-report failed", sendErr);
              toast({
                title: "Couldn't send email",
                description: sendErr.message,
                variant: "destructive",
              });
            } else {
              const sent = (sendData as any)?.sent ?? recipients.length;
              toast({
                title: `Report sent to ${sent} recipient${sent === 1 ? "" : "s"}`,
                description: "They'll receive it as if from you (replies come to your email).",
              });
            }
          }
        } else if (opts.audience === "tutor" && opts.tutorId) {
          toast({
            title: "Shared with your tutor",
            description: "Your tutor will see this report on your next session.",
          });
        }
      } catch (err) {
        logger.error("Progress report generation failed", err);
        toast({
          title: "Could not generate report",
          description:
            err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        setGenerating(false);
      }
    },
    [learnerId, toast]
  );

  return { generate, generating };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // strip "data:application/pdf;base64,"
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
