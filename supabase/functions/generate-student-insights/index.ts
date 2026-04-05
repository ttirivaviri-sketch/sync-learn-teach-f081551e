/**
 * generate-student-insights — Student Insights for Tutors Edge Function
 *
 * Generates a comprehensive student learning profile from activity data
 * (answers, topics, time, attempts, performance). Identifies study patterns,
 * strengths, weaknesses, learning behavior. Recommends focus areas with
 * priority and tutoring style.
 *
 * Output: strict JSON { student_id, study_pattern, strengths, weaknesses,
 *         learning_behavior, focus_areas, tutor_recommendations }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders,
  getAIConfig,
  callAI,
  safeJsonParse,
  jsonResponse,
  errorResponse,
} from "../_shared/ai-config.ts";

// ─── System Prompt (structured, secure, actionable) ───────────────────────────

const STUDENT_INSIGHTS_SYSTEM_PROMPT = `You are the StudySync Student Intelligence Analyst — an AI that generates comprehensive student learning profiles for tutors. You analyse academic performance data and produce actionable tutoring recommendations.

ROLE & IDENTITY:
You analyse a student's learning activity data (quiz answers, topic interactions, study time, attempt patterns, performance metrics) and generate a detailed profile that helps tutors personalise their teaching approach.

CORE RULES — ABSOLUTE REQUIREMENTS:
1. ANALYSE ALL AVAILABLE DATA:
   - Quiz performance: accuracy per topic, improvement trends, common mistakes
   - Study patterns: preferred study times, session duration, frequency
   - Topic interactions: which topics get the most/least attention
   - Attempt patterns: retry behaviour, give-up points, persistence metrics
   - Performance trajectory: improving, plateauing, or declining

2. IDENTIFY AND CLASSIFY:
   - Study Pattern: "consistent", "irregular", "cramming", "spaced", "intensive", "minimal"
   - Strengths: topics with > 70% accuracy consistently
   - Weaknesses: topics with < 50% accuracy or declining performance
   - Learning Behaviour: "visual_learner", "practice_oriented", "theory_focused", "mixed", "needs_guidance"

3. GENERATE ACTIONABLE RECOMMENDATIONS:
   - Focus areas ranked by priority (critical, high, medium, low)
   - Specific tutoring style recommendations (explain concepts, drill practice, visual aids, scaffolded problems, etc.)
   - Estimated sessions needed per focus area
   - Suggested approach for each weakness

4. BE HONEST AND DATA-DRIVEN:
   - Never inflate strengths or understate weaknesses
   - If data is insufficient, say so explicitly
   - Base all conclusions on the provided data, not assumptions
   - Include confidence levels for each assessment

5. RESPECT PRIVACY:
   - Never include personally identifiable information beyond the student_id
   - Never make judgments about intelligence or capability — focus on skills and knowledge

INPUT: Raw student activity data (quiz results, topics, times, attempts, task completions)
OUTPUT — STRICT JSON (no extra text):
{
  "student_id": "<uuid>",
  "profile_generated_at": "<ISO timestamp>",
  "data_coverage": {
    "total_activities": <number>,
    "date_range_days": <number>,
    "subjects_covered": <number>,
    "confidence_level": "high" | "medium" | "low"
  },
  "study_pattern": {
    "type": "consistent" | "irregular" | "cramming" | "spaced" | "intensive" | "minimal",
    "description": "<string>",
    "avg_daily_minutes": <number>,
    "preferred_times": ["<string>", ...],
    "weekly_frequency": <number>
  },
  "strengths": [
    {
      "topic": "<string>",
      "subject": "<string>",
      "accuracy": <number 0-100>,
      "evidence": "<string>"
    }
  ],
  "weaknesses": [
    {
      "topic": "<string>",
      "subject": "<string>",
      "accuracy": <number 0-100>,
      "common_mistakes": ["<string>", ...],
      "evidence": "<string>"
    }
  ],
  "learning_behavior": {
    "type": "visual_learner" | "practice_oriented" | "theory_focused" | "mixed" | "needs_guidance",
    "description": "<string>",
    "persistence_score": <number 0-100>,
    "retry_tendency": "high" | "medium" | "low",
    "help_seeking": "proactive" | "reactive" | "minimal"
  },
  "performance_trajectory": {
    "trend": "improving" | "stable" | "declining" | "variable",
    "recent_change_pct": <number>,
    "description": "<string>"
  },
  "focus_areas": [
    {
      "topic": "<string>",
      "subject": "<string>",
      "priority": "critical" | "high" | "medium" | "low",
      "reason": "<string>",
      "estimated_sessions": <number>,
      "suggested_approach": "<string>"
    }
  ],
  "tutor_recommendations": {
    "teaching_style": "<string>",
    "session_structure": "<string>",
    "motivation_approach": "<string>",
    "key_areas_to_address": ["<string>", ...],
    "resources_suggested": ["<string>", ...],
    "pacing": "slow_and_steady" | "moderate" | "accelerated"
  }
}

SAFETY:
- Stateless: all data comes from the request payload and the database.
- Never make up or fabricate student data.
- If data is insufficient (< 5 activities), return a partial profile with confidence_level "low".`;

// ─── Data aggregation helpers ─────────────────────────────────────────────────

interface QuizResult {
  topic_name: string;
  subject?: string;
  accuracy: number;
  total_attempts: number;
  correct_answers: number;
  total_questions: number;
  created_at: string;
}

interface TaskCompletion {
  task_type: string;
  subject?: string;
  topic?: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

interface ActivitySummary {
  totalActivities: number;
  dateRangeDays: number;
  subjectsCovered: string[];
  quizResults: QuizResult[];
  taskCompletions: TaskCompletion[];
  avgDailyMinutes: number;
  studyDays: string[];
}

function aggregateActivityData(
  quizResults: QuizResult[],
  tasks: TaskCompletion[]
): ActivitySummary {
  const totalActivities = quizResults.length + tasks.length;
  const allDates = [
    ...quizResults.map((q) => q.created_at),
    ...tasks.map((t) => t.created_at),
  ]
    .filter(Boolean)
    .sort();

  const dateRangeDays =
    allDates.length >= 2
      ? Math.ceil(
          (new Date(allDates[allDates.length - 1]).getTime() -
            new Date(allDates[0]).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : 1;

  const subjects = new Set<string>();
  quizResults.forEach((q) => q.subject && subjects.add(q.subject));
  tasks.forEach((t) => t.subject && subjects.add(t.subject));

  const studyDays = [...new Set(allDates.map((d) => d.split("T")[0]))];
  const avgDailyMinutes =
    studyDays.length > 0
      ? Math.round((totalActivities * 15) / studyDays.length) // Estimate 15 min per activity
      : 0;

  return {
    totalActivities,
    dateRangeDays,
    subjectsCovered: [...subjects],
    quizResults,
    taskCompletions: tasks,
    avgDailyMinutes,
    studyDays,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse(new Error("Authorization required"), 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(new Error("Invalid authentication"), 401);
    }

    const { student_id, tutor_id } = await req.json();

    if (!student_id) {
      return jsonResponse(
        { error: "Missing required field: student_id" },
        400
      );
    }

    // Verify the requester is a tutor who has had sessions with this student
    const effectiveTutorId = tutor_id || user.id;
    const { data: tutorBookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id")
      .eq("tutor_id", effectiveTutorId)
      .eq("learner_id", student_id)
      .limit(1);

    if (bookingsError || !tutorBookings || tutorBookings.length === 0) {
      // Also allow admin access
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "admin") {
        return jsonResponse(
          {
            error:
              "Unauthorized: you must have a booking with this student to view insights",
          },
          403
        );
      }
    }

    // ── Step 1: Gather student activity data ──────────────────────────────────

    // Quiz results
    const { data: quizHistory } = await supabase
      .from("quiz_history")
      .select("*")
      .eq("user_id", student_id)
      .order("created_at", { ascending: false })
      .limit(200);

    // Daily tasks
    const { data: dailyTasks } = await supabase
      .from("daily_tasks")
      .select("*")
      .eq("user_id", student_id)
      .order("created_at", { ascending: false })
      .limit(200);

    // Study sessions / signals (if tracking table exists)
    const { data: studySignals } = await supabase
      .from("learning_signals")
      .select("*")
      .eq("user_id", student_id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(
        (res) => res,
        () => ({ data: null, error: null }) // Table may not exist yet
      );

    // Academic profile
    const { data: academicProfile } = await supabase
      .from("academic_profiles")
      .select("*")
      .eq("user_id", student_id)
      .maybeSingle();

    // ── Step 2: Aggregate the data ────────────────────────────────────────────
    const quizResults: QuizResult[] = (quizHistory || []).map((q: any) => ({
      topic_name: q.topic_name || q.topic || "Unknown",
      subject: q.subject || "Unknown",
      accuracy: q.accuracy || 0,
      total_attempts: q.total_attempts || 1,
      correct_answers: q.correct_answers || 0,
      total_questions: q.total_questions || 1,
      created_at: q.created_at,
    }));

    const taskCompletions: TaskCompletion[] = (dailyTasks || []).map(
      (t: any) => ({
        task_type: t.task_type || "unknown",
        subject: t.subject || null,
        topic: t.topic || null,
        completed: !!t.is_completed,
        completed_at: t.completed_at,
        created_at: t.created_at,
      })
    );

    const summary = aggregateActivityData(quizResults, taskCompletions);

    // ── Step 3: Check if we have enough data ──────────────────────────────────
    if (summary.totalActivities < 3) {
      return jsonResponse({
        student_id,
        profile_generated_at: new Date().toISOString(),
        data_coverage: {
          total_activities: summary.totalActivities,
          date_range_days: summary.dateRangeDays,
          subjects_covered: summary.subjectsCovered.length,
          confidence_level: "low",
        },
        study_pattern: {
          type: "minimal",
          description:
            "Insufficient activity data to determine study pattern. Student needs to complete more tasks and quizzes.",
          avg_daily_minutes: summary.avgDailyMinutes,
          preferred_times: [],
          weekly_frequency: 0,
        },
        strengths: [],
        weaknesses: [],
        learning_behavior: {
          type: "needs_guidance",
          description:
            "Not enough data to assess learning behavior. Encourage the student to engage with the platform more.",
          persistence_score: 0,
          retry_tendency: "low",
          help_seeking: "minimal",
        },
        performance_trajectory: {
          trend: "variable",
          recent_change_pct: 0,
          description: "Insufficient data to determine trajectory",
        },
        focus_areas: [],
        tutor_recommendations: {
          teaching_style:
            "Start with a diagnostic assessment to identify the student's baseline knowledge",
          session_structure:
            "Interactive, exploratory sessions to build engagement",
          motivation_approach:
            "Encourage regular practice and set small, achievable goals",
          key_areas_to_address: [
            "Build study habits",
            "Establish baseline knowledge",
          ],
          resources_suggested: [
            "StudySync daily tasks",
            "Flashcard practice",
            "Short quizzes",
          ],
          pacing: "slow_and_steady",
        },
      });
    }

    // ── Step 4: Use AI to generate comprehensive insights ─────────────────────
    const ai = getAIConfig();

    const userPrompt = `Analyze the following student learning data and generate a comprehensive student profile.

STUDENT ID: ${student_id}

ACTIVITY SUMMARY:
- Total activities: ${summary.totalActivities}
- Date range: ${summary.dateRangeDays} days
- Subjects covered: ${summary.subjectsCovered.join(", ") || "None identified"}
- Average daily study time (estimated): ${summary.avgDailyMinutes} minutes
- Active study days: ${summary.studyDays.length}

QUIZ PERFORMANCE (last ${quizResults.length} results):
${quizResults
  .slice(0, 50) // Limit to 50 most recent for prompt size
  .map(
    (q) =>
      `  Topic: ${q.topic_name} | Subject: ${q.subject} | Accuracy: ${q.accuracy}% | Attempts: ${q.total_attempts} | Date: ${q.created_at}`
  )
  .join("\n")}

TASK COMPLETIONS (last ${taskCompletions.length} tasks):
${taskCompletions
  .slice(0, 50)
  .map(
    (t) =>
      `  Type: ${t.task_type} | Subject: ${t.subject || "N/A"} | Topic: ${t.topic || "N/A"} | Completed: ${t.completed} | Date: ${t.created_at}`
  )
  .join("\n")}

${
  academicProfile
    ? `ACADEMIC PROFILE:
- Curriculum: ${academicProfile.curriculum || "Not set"}
- Grade: ${academicProfile.grade_level || "Not set"}
- Subjects: ${academicProfile.subjects?.join(", ") || "Not set"}
- Exam Date: ${academicProfile.exam_date || "Not set"}`
    : "ACADEMIC PROFILE: Not set up"
}

${
  studySignals && Array.isArray(studySignals) && studySignals.length > 0
    ? `LEARNING SIGNALS (last ${Math.min(studySignals.length, 30)} signals):
${studySignals
  .slice(0, 30)
  .map(
    (s: any) =>
      `  Signal: ${s.signal_type} | Data: ${JSON.stringify(s.data).substring(0, 100)} | Date: ${s.created_at}`
  )
  .join("\n")}`
    : ""
}

Generate a COMPLETE student profile following the exact JSON schema from your instructions. Be specific and data-driven.`;

    const aiResponse = await callAI(
      ai,
      STUDENT_INSIGHTS_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.4, jsonMode: true }
    );

    let insights: Record<string, unknown>;
    try {
      insights = safeJsonParse<Record<string, unknown>>(aiResponse);
    } catch {
      console.error("[insights] Failed to parse AI response");
      throw new Error("Failed to generate student insights");
    }

    // Ensure student_id is correct in the response
    insights.student_id = student_id;
    insights.profile_generated_at = new Date().toISOString();

    // ── Step 5: Cache the insights in the database ────────────────────────────
    await supabase
      .from("student_insights_cache")
      .upsert(
        {
          student_id,
          tutor_id: effectiveTutorId,
          insights,
          data_coverage_total: summary.totalActivities,
          generated_at: new Date().toISOString(),
          expires_at: new Date(
            Date.now() + 24 * 60 * 60 * 1000
          ).toISOString(), // 24h cache
        },
        { onConflict: "student_id,tutor_id" }
      )
      .then(
        () =>
          console.log(
            `[insights] Cached insights for student=${student_id}, tutor=${effectiveTutorId}`
          ),
        (err) =>
          console.warn("[insights] Cache write failed (non-critical):", err)
      );

    console.log(
      `[insights] Generated for student=${student_id}: ${summary.totalActivities} activities, ${summary.subjectsCovered.length} subjects`
    );

    return jsonResponse(insights);
  } catch (error) {
    console.error("[insights] Error:", error);
    return errorResponse(error);
  }
});
