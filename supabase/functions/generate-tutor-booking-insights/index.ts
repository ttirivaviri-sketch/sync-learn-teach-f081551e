/**
 * generate-tutor-booking-insights
 *
 * Called when a booking is confirmed. Generates a subject-specific AI summary
 * for the tutor containing:
 * - Student's strengths in that subject
 * - Weaknesses and topics needing help
 * - Study patterns and habits
 * - Exam date for the subject
 * - Risk level indicator
 *
 * PRIVACY: Does NOT share full student profile, emails, or other sensitive data.
 * Only subject-specific learning insights are provided.
 *
 * POST body: { booking_id, student_id, tutor_id, subject }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { reportTokenUsage } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

interface InsightRequest {
  booking_id: string;
  student_id: string;
  tutor_id: string;
  subject: string;
}

function calculateRiskLevel(daysUntilExam: number | null, avgScore: number, completionRate: number): string {
  if (daysUntilExam === null) return "needs_attention";
  if (daysUntilExam <= 14 && (avgScore < 50 || completionRate < 0.3)) return "at_risk";
  if (daysUntilExam <= 30 && avgScore < 40) return "at_risk";
  if (completionRate < 0.2 && daysUntilExam <= 60) return "at_risk";
  if (daysUntilExam <= 30 && (avgScore < 60 || completionRate < 0.5)) return "needs_attention";
  if (completionRate < 0.4) return "needs_attention";
  return "on_track";
}

serve(async (req) => {
  try {
    // ── AUTH: require valid JWT and verify caller is the tutor in the booking
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const body: InsightRequest = await req.json();
    const { booking_id, student_id, tutor_id, subject } = body;

    if (!booking_id || !student_id || !tutor_id || !subject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: booking_id, student_id, tutor_id, subject" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Verify caller is the tutor on this booking
    const { data: booking } = await supabase
      .from("bookings")
      .select("tutor_id, learner_id, status")
      .eq("id", booking_id)
      .maybeSingle();
    if (!booking || booking.tutor_id !== callerId || booking.tutor_id !== tutor_id || booking.learner_id !== student_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { "Content-Type": "application/json" },
      });
    }

    // 1. Get student's academic profile (only curriculum/grade/subjects/exam_dates — NOT emails)
    const { data: profile } = await supabase
      .from("academic_profiles")
      .select("curriculum, grade, subjects, exam_year, exam_dates")
      .eq("user_id", student_id)
      .maybeSingle();

    // 2. Get last 30 days of study activity for this subject
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: activities } = await supabase
      .from("study_activity")
      .select("*")
      .eq("user_id", student_id)
      .ilike("subject", subject)
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("created_at", { ascending: false })
      .limit(100);

    // 3. Get quiz/mastery data for this subject
    const { data: subjectData } = await supabase
      .from("subjects")
      .select("id, topics")
      .eq("user_id", student_id)
      .ilike("name", subject)
      .maybeSingle();

    let masteryData: any[] = [];
    let quizData: any[] = [];

    if (subjectData?.id) {
      const { data: mastery } = await supabase
        .from("topic_mastery")
        .select("*")
        .eq("user_id", student_id)
        .eq("subject_id", subjectData.id);
      masteryData = mastery || [];

      const { data: quizzes } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("user_id", student_id)
        .eq("subject_id", subjectData.id)
        .limit(50);
      quizData = quizzes || [];
    }

    // 4. Build insights
    const activityList = activities || [];
    const completed = activityList.filter((a: any) => a.task_completed).length;
    const missed = activityList.filter((a: any) => !a.task_completed).length;
    const scores = activityList
      .filter((a: any) => a.score != null)
      .map((a: any) => Number(a.score));
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const completionRate = completed + missed > 0 ? completed / (completed + missed) : 0;
    const topics = [...new Set(activityList.filter((a: any) => a.topic).map((a: any) => a.topic))];

    // Exam date for this subject. `exam_dates` may legacy-store an object map
    // ({ "Maths": "2026-11-02" }) instead of an array — normalise before .find().
    const rawExamDates = profile?.exam_dates;
    const examDates: Array<{ subject: string; date: string }> = Array.isArray(rawExamDates)
      ? rawExamDates.filter((e: any) => e && typeof e.subject === "string" && e.date)
      : rawExamDates && typeof rawExamDates === "object"
        ? Object.entries(rawExamDates as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([s, v]) => ({ subject: s, date: String(v) }))
        : [];
    const examEntry = examDates.find((e) => e.subject?.toLowerCase() === subject.toLowerCase());
    const now = new Date();
    const daysUntilExam = examEntry
      ? Math.ceil((new Date(examEntry.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const riskLevel = calculateRiskLevel(daysUntilExam, avgScore, completionRate);

    // Build strengths/weaknesses from mastery
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const topicsNeedingHelp: string[] = [];

    for (const m of masteryData) {
      if (m.mastery_percentage >= 70) {
        strengths.push(m.topic_name);
      } else if (m.mastery_percentage < 40) {
        weaknesses.push(m.topic_name);
        topicsNeedingHelp.push(m.topic_name);
      } else if (m.mastery_percentage < 60) {
        topicsNeedingHelp.push(m.topic_name);
      }
    }

    // Study pattern analysis
    const studyPatterns = {
      total_activities_30d: activityList.length,
      tasks_completed: completed,
      tasks_missed: missed,
      completion_rate: Math.round(completionRate * 100),
      avg_score: avgScore,
      topics_covered: topics.slice(0, 10),
      quiz_attempts: quizData.length,
      quiz_accuracy: quizData.length > 0
        ? Math.round((quizData.filter((q: any) => q.was_correct).length / quizData.length) * 100)
        : 0,
    };

    const insights = {
      subject,
      curriculum: profile?.curriculum || "Unknown",
      grade: profile?.grade || "Unknown",
      strengths: strengths.slice(0, 5),
      weaknesses: weaknesses.slice(0, 5),
      topics_needing_help: topicsNeedingHelp.slice(0, 8),
      study_patterns: studyPatterns,
      exam_date: examEntry?.date || null,
      days_until_exam: daysUntilExam,
      risk_level: riskLevel,
      recommendations: [] as string[],
    };

    // Generate AI recommendations if OpenAI is available
    if (OPENAI_API_KEY) {
      try {
        const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are an educational AI assistant. Generate 3-5 concise recommendations for a tutor about how to help this student in their upcoming session. Be specific to the subject and data provided. Keep each recommendation under 100 characters.",
              },
              {
                role: "user",
                content: `Student studying ${subject} (${profile?.curriculum} ${profile?.grade}). Average score: ${avgScore}%. Completion rate: ${Math.round(completionRate * 100)}%. Weak areas: ${weaknesses.join(", ") || "none identified"}. Strong areas: ${strengths.join(", ") || "none yet"}. ${daysUntilExam ? `Exam in ${daysUntilExam} days.` : ""} Risk level: ${riskLevel}. Generate tutor recommendations.`,
              },
            ],
            max_tokens: 300,
            temperature: 0.7,
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          if (aiData?.usage) {
            reportTokenUsage({
              userId: callerId,
              bucket: "insights",
              tokensIn: Number(aiData.usage.prompt_tokens ?? 0),
              tokensOut: Number(aiData.usage.completion_tokens ?? 0),
            });
          }
          const content = aiData.choices?.[0]?.message?.content || "";
          insights.recommendations = content
            .split("\n")
            .filter((line: string) => line.trim().length > 5)
            .map((line: string) => line.replace(/^\d+\.\s*/, "").trim())
            .slice(0, 5);
        }
      } catch (aiErr) {
        console.warn("[generate-tutor-booking-insights] AI recommendation failed:", aiErr);
        insights.recommendations = [
          `Focus on ${weaknesses[0] || "fundamentals"} during the session`,
          `Review quiz performance (${avgScore}% average)`,
          "Encourage regular practice between sessions",
        ];
      }
    } else {
      insights.recommendations = [
        `Focus on ${weaknesses[0] || "fundamentals"} during the session`,
        `Student avg score: ${avgScore}% - ${avgScore < 50 ? "needs significant help" : "performing adequately"}`,
        "Encourage regular practice between sessions",
      ];
    }

    // 5. Save insights to database
    const { error: insertError } = await supabase
      .from("tutor_booking_insights")
      .insert({
        booking_id,
        student_id,
        tutor_id,
        subject,
        insights_json: insights,
      });

    if (insertError) {
      console.error("[generate-tutor-booking-insights] Insert error:", insertError);
    }

    console.log(`[generate-tutor-booking-insights] Generated insights for booking ${booking_id}, subject: ${subject}`);

    return new Response(JSON.stringify(insights), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[generate-tutor-booking-insights] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 });
  }
});
