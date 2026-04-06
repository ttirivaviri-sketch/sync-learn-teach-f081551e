/**
 * send-guardian-report
 *
 * Scheduled weekly (every Sunday morning) edge function that:
 * 1. Finds all students with a guardian_email set
 * 2. Aggregates last 7 days of study_activity per subject
 * 3. Calculates risk levels based on exam proximity & performance
 * 4. Sends a formatted email to the guardian
 * 5. Caches the report in analytics_reports table
 *
 * Invoke: POST /send-guardian-report (with service_role key)
 * Or via pg_cron / Supabase scheduled functions
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

interface SubjectActivity {
  subject: string;
  tasks_completed: number;
  tasks_missed: number;
  avg_score: number;
  total_activities: number;
  topics: string[];
}

interface ExamDate {
  subject: string;
  date: string;
}

function calculateRiskLevel(daysUntilExam: number | null, avgScore: number, completionRate: number): string {
  if (daysUntilExam === null) return "needs_attention";
  if (daysUntilExam <= 14 && (avgScore < 50 || completionRate < 0.3)) return "at_risk";
  if (daysUntilExam <= 30 && avgScore < 40) return "at_risk";
  if (completionRate < 0.2 && daysUntilExam <= 60) return "at_risk";
  if (daysUntilExam <= 30 && (avgScore < 60 || completionRate < 0.5)) return "needs_attention";
  if (daysUntilExam <= 60 && avgScore < 50) return "needs_attention";
  if (completionRate < 0.4) return "needs_attention";
  return "on_track";
}

function riskEmoji(level: string): string {
  if (level === "on_track") return "[OK]";
  if (level === "needs_attention") return "[!!]";
  return "[XX]";
}

serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Get all students with guardian_email
    const { data: profiles, error: profileError } = await supabase
      .from("academic_profiles")
      .select("user_id, curriculum, grade, subjects, exam_year, exam_dates, guardian_email, student_email")
      .not("guardian_email", "is", null)
      .neq("guardian_email", "");

    if (profileError) {
      console.error("[send-guardian-report] Profile query error:", profileError);
      return new Response(JSON.stringify({ error: profileError.message }), { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      console.log("[send-guardian-report] No students with guardian emails found.");
      return new Response(JSON.stringify({ message: "No students with guardian emails", sent: 0 }));
    }

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const now = new Date();
    let sentCount = 0;

    for (const profile of profiles) {
      try {
        // 2. Fetch last 7 days of activity
        const { data: activities } = await supabase
          .from("study_activity")
          .select("*")
          .eq("user_id", profile.user_id)
          .gte("date", weekStartStr)
          .order("created_at", { ascending: false });

        // Build per-subject summary
        const subjectMap: Record<string, { completed: number; missed: number; scores: number[]; topics: Set<string> }> = {};
        const subjects: string[] = profile.subjects || [];

        for (const subj of subjects) {
          subjectMap[subj] = { completed: 0, missed: 0, scores: [], topics: new Set() };
        }

        for (const entry of activities || []) {
          if (!subjectMap[entry.subject]) {
            subjectMap[entry.subject] = { completed: 0, missed: 0, scores: [], topics: new Set() };
          }
          const s = subjectMap[entry.subject];
          if (entry.task_completed) s.completed++;
          else s.missed++;
          if (entry.score != null) s.scores.push(Number(entry.score));
          if (entry.topic) s.topics.add(entry.topic);
        }

        // 3. Build report
        const examDates: ExamDate[] = profile.exam_dates || [];
        const subjectSummaries = Object.entries(subjectMap).map(([subject, stats]) => {
          const total = stats.completed + stats.missed;
          const completionRate = total > 0 ? stats.completed / total : 0;
          const avgScore = stats.scores.length > 0
            ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
            : 0;

          const examEntry = examDates.find((e) => e.subject === subject);
          const daysUntilExam = examEntry
            ? Math.ceil((new Date(examEntry.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          const riskLevel = calculateRiskLevel(daysUntilExam, avgScore, completionRate);

          return {
            name: subject,
            progress_pct: Math.round(completionRate * 100),
            tasks_completed: stats.completed,
            tasks_missed: stats.missed,
            avg_score: avgScore,
            risk_level: riskLevel,
            exam_date: examEntry?.date || null,
            days_until_exam: daysUntilExam,
            topics_covered: Array.from(stats.topics),
          };
        });

        // Overall trend
        const totalCompleted = subjectSummaries.reduce((a, s) => a + s.tasks_completed, 0);
        const totalMissed = subjectSummaries.reduce((a, s) => a + s.tasks_missed, 0);
        const overallAvg = subjectSummaries.length > 0
          ? Math.round(subjectSummaries.reduce((a, s) => a + s.avg_score, 0) / subjectSummaries.length)
          : 0;

        const overallTrend = overallAvg >= 60 ? "improving" : overallAvg >= 40 ? "stable" : "declining";

        const weakAreas = subjectSummaries
          .filter((s) => s.risk_level !== "on_track")
          .map((s) => s.name);

        const upcomingExams = subjectSummaries
          .filter((s) => s.days_until_exam !== null && s.days_until_exam > 0 && s.days_until_exam <= 30)
          .sort((a, b) => (a.days_until_exam || 0) - (b.days_until_exam || 0))
          .map((s) => `${s.name} (${s.days_until_exam}d)`);

        const reportSummary = {
          subjects: subjectSummaries,
          overall_trend: overallTrend,
          overall_avg_score: overallAvg,
          total_completed: totalCompleted,
          total_missed: totalMissed,
          weak_areas: weakAreas,
          upcoming_exams: upcomingExams,
          recommendations: weakAreas.length > 0
            ? [`Focus on: ${weakAreas.join(", ")}`, "Encourage consistent daily study sessions"]
            : ["Great progress this week! Keep it up."],
        };

        // 4. Cache the report
        await supabase
          .from("analytics_reports")
          .upsert({
            user_id: profile.user_id,
            week_start: weekStartStr,
            report_type: "guardian_weekly",
            summary_json: reportSummary,
            email_sent: false,
          }, { onConflict: "user_id,week_start,report_type" });

        // 5. Send email (using Resend API if configured)
        if (RESEND_API_KEY && profile.guardian_email) {
          const emailHtml = buildEmailHtml(profile, reportSummary, subjectSummaries);

          try {
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: "StudySync Reports <reports@studysync.co.za>",
                to: [profile.guardian_email],
                subject: `StudySync Weekly Report - ${profile.curriculum} ${profile.grade}`,
                html: emailHtml,
              }),
            });

            if (emailRes.ok) {
              console.log(`[send-guardian-report] Email sent to ${profile.guardian_email}`);
              // Mark as sent
              await supabase
                .from("analytics_reports")
                .update({ email_sent: true, email_sent_at: new Date().toISOString() })
                .eq("user_id", profile.user_id)
                .eq("week_start", weekStartStr)
                .eq("report_type", "guardian_weekly");

              sentCount++;
            } else {
              const errText = await emailRes.text();
              console.error(`[send-guardian-report] Email send failed:`, errText);
            }
          } catch (emailErr) {
            console.error(`[send-guardian-report] Email error:`, emailErr);
          }
        } else {
          console.log(`[send-guardian-report] No RESEND_API_KEY or guardian_email, report cached only.`);
        }
      } catch (studentErr) {
        console.error(`[send-guardian-report] Error processing student ${profile.user_id}:`, studentErr);
      }
    }

    return new Response(
      JSON.stringify({ message: "Guardian reports processed", total: profiles.length, sent: sentCount }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-guardian-report] Fatal error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});

function buildEmailHtml(
  profile: any,
  summary: any,
  subjects: any[]
): string {
  const riskColors: Record<string, string> = {
    on_track: "#22c55e",
    needs_attention: "#eab308",
    at_risk: "#ef4444",
  };

  const subjectRows = subjects
    .map(
      (s) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;">
        <strong>${s.name}</strong>
      </td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${riskColors[s.risk_level] || "#9ca3af"};margin-right:4px;"></span>
        ${s.risk_level === "on_track" ? "On Track" : s.risk_level === "needs_attention" ? "Needs Attention" : "At Risk"}
      </td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${s.tasks_completed}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${s.tasks_missed}</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${s.avg_score}%</td>
      <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">
        ${s.exam_date ? `${s.exam_date} (${s.days_until_exam}d)` : "Not set"}
      </td>
    </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#1a3fc4;font-size:24px;margin:0;">StudySync</h1>
    <p style="color:#6b7280;font-size:14px;">Weekly Progress Report</p>
  </div>

  <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px;">
    <p style="margin:0;font-size:14px;color:#374151;">
      <strong>${profile.curriculum || "Curriculum"}</strong> | ${profile.grade || "Grade"} | Exam Year: ${profile.exam_year || "N/A"}
    </p>
  </div>

  <h2 style="font-size:18px;color:#111827;margin-bottom:8px;">Subject Overview</h2>

  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:left;">Subject</th>
        <th style="padding:8px;text-align:center;">Status</th>
        <th style="padding:8px;text-align:center;">Done</th>
        <th style="padding:8px;text-align:center;">Missed</th>
        <th style="padding:8px;text-align:center;">Avg Score</th>
        <th style="padding:8px;text-align:center;">Exam</th>
      </tr>
    </thead>
    <tbody>
      ${subjectRows}
    </tbody>
  </table>

  <div style="margin-top:20px;padding:16px;background:#eff6ff;border-radius:8px;">
    <h3 style="margin:0 0 8px;font-size:14px;color:#1e40af;">Summary</h3>
    <p style="margin:4px 0;font-size:13px;">Overall trend: <strong>${summary.overall_trend}</strong></p>
    <p style="margin:4px 0;font-size:13px;">Tasks completed: <strong>${summary.total_completed}</strong> | Missed: <strong>${summary.total_missed}</strong></p>
    <p style="margin:4px 0;font-size:13px;">Average score: <strong>${summary.overall_avg_score}%</strong></p>
    ${summary.weak_areas.length > 0 ? `<p style="margin:4px 0;font-size:13px;color:#dc2626;">Areas needing attention: <strong>${summary.weak_areas.join(", ")}</strong></p>` : ""}
    ${summary.upcoming_exams.length > 0 ? `<p style="margin:4px 0;font-size:13px;">Upcoming exams: <strong>${summary.upcoming_exams.join(", ")}</strong></p>` : ""}
  </div>

  ${summary.recommendations.length > 0 ? `
  <div style="margin-top:16px;padding:12px;background:#f0fdf4;border-radius:8px;">
    <h3 style="margin:0 0 8px;font-size:14px;color:#166534;">Recommendations</h3>
    <ul style="margin:0;padding-left:16px;font-size:13px;">
      ${summary.recommendations.map((r: string) => `<li style="margin:4px 0;">${r}</li>`).join("")}
    </ul>
  </div>` : ""}

  <div style="margin-top:32px;text-align:center;color:#9ca3af;font-size:12px;">
    <p>This report was automatically generated by StudySync AI.</p>
    <p>For questions, contact support@studysync.co.za</p>
  </div>
</body>
</html>`;
}
