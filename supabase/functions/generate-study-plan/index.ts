/**
 * generate-study-plan Edge Function (v2)
 *
 * Creates a personalised, adaptive study plan that prioritises weak areas
 * and adapts to student performance.
 *
 * POST body:
 * {
 *   profile: { grade, curriculum, subjects: string[] },
 *   subjects: [{ id, name, topics: [{name, examWeight, subtopics, concepts}] }],
 *   examDate?: string (ISO date),
 *   performanceContext?: string,
 *   syllabusContext?: string,
 *   pastPaperContext?: string,
 *   mode: "initial" | "adaptive",
 *   userId: string,
 *   weakAreas?: string[],
 *   notesOrDocuments?: string
 * }
 *
 * Returns:
 * {
 *   plan: [{ subject, subject_id, topic, task_type, date, duration_minutes, task_description }],
 *   saved: number,
 *   weak_area_focus: string[]
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  getAIConfig,
  buildStudyModeContext,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  safeJsonParse,
  normalizeArray,
  errorResponse,
  jsonResponse,
} from "../_shared/ai-config.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── AUTH: derive userId from validated JWT, never trust body
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const { data: userData, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const body = await req.json();
    const {
      profile,
      subjects = [],
      examDate,
      performanceContext = "",
      syllabusContext = "",
      pastPaperContext = "",
      mode = "initial",
      weakAreas,
      notesOrDocuments,
    } = body;

    // ── Build rich subject/topic summary ────────────────────────────────────
    const subjectSummary = subjects
      .map((s: any) => {
        const topics = (s.topics || [])
          .map(
            (t: any) =>
              `  - ${t.name} (weight: ${t.examWeight || "?"}%` +
              (t.subtopics?.length
                ? `, subtopics: ${t.subtopics.slice(0, 3).join(", ")}`
                : "") +
              ")"
          )
          .join("\n");
        return `${s.name}:\n${topics || "  (no topics yet)"}`;
      })
      .join("\n\n");

    const daysUntilExam = examDate
      ? Math.max(7, Math.floor((new Date(examDate).getTime() - Date.now()) / 86_400_000))
      : 14;

    const planDays = Math.min(daysUntilExam, mode === "adaptive" ? 7 : 14);
    const today = new Date().toISOString().split("T")[0];

    // ── Build unified context ───────────────────────────────────────────────
    const context = buildStudyModeContext({
      curriculum: profile?.curriculum,
      examLevel: profile?.grade,
      weakAreas,
      notesOrDocuments,
      performanceData: performanceContext,
      syllabusContext,
      pastPaperContext,
    });

    // ── System prompt ───────────────────────────────────────────────────────
    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create a highly personalised, actionable ${planDays}-day study plan.
Return ONLY structured JSON study content. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

RULES:
1. Return ONLY valid JSON — an object with "plan" array and "weak_area_focus" array.
2. Spread tasks across ${planDays} days starting from ${today}.
3. Weight topics by exam importance (higher weight = more sessions).
4. In ADAPTIVE mode, INCREASE focus on weak topics and REDUCE repetition of mastered ones.
5. Each day should have 1–3 tasks, each 30–60 minutes.
6. Task types: "concept_learning", "active_recall", "exam_question", "micro_revision", "past_paper_practice", "flashcard_review"
7. Include a brief task_description (1 sentence) so the student knows what to do.
8. Ensure variety: mix task types per subject, don't repeat the same type two days running.
9. If weak areas are provided, allocate ~40% of tasks to addressing them.

Return JSON:
{
  "plan": [
    {
      "subject": "Mathematics",
      "subject_id": "uuid-or-null",
      "topic": "Algebra",
      "task_type": "concept_learning",
      "date": "${today}",
      "duration_minutes": 45,
      "task_description": "Study the laws of indices and practice simplification problems."
    }
  ],
  "weak_area_focus": ["topic1 — reason it's prioritised"]
}`;

    // ── User prompt ─────────────────────────────────────────────────────────
    const userPrompt = `Create a ${planDays}-day ${mode === "adaptive" ? "ADAPTIVE (focus on weak areas)" : "initial"} study plan.

Student Profile:
- Grade/Level: ${profile?.grade || "Unknown"}
- Curriculum: ${profile?.curriculum || "ZIMSEC"}
- Subjects: ${(profile?.subjects || []).join(", ") || subjects.map((s: any) => s.name).join(", ")}
${examDate ? `- Exam Date: ${examDate} (${daysUntilExam} days away)` : ""}

Subject Topics & Syllabus:
${subjectSummary || "(No subjects uploaded yet — create a general study plan)"}

${context}

Plan start: ${today}, plan length: ${planDays} days.
Generate ${planDays * 2} tasks (roughly 2 per day). Prioritise high-weight topics and weak areas.`;

    // ── Call AI ──────────────────────────────────────────────────────────────
    const rawContent = await callAI(ai, systemPrompt, userPrompt, {
      temperature: 0.4,
      jsonMode: true,
    });

    const parsed = safeJsonParse<{
      plan?: any[];
      study_plan?: any[];
      weak_area_focus?: string[];
    }>(rawContent);

    let plan: any[] = [];
    if (Array.isArray(parsed)) {
      plan = parsed;
    } else {
      plan = parsed.plan || parsed.study_plan || [];
    }

    if (!Array.isArray(plan) || plan.length === 0) {
      return jsonResponse(
        { error: "AI returned empty plan", raw: rawContent.substring(0, 500) },
        500
      );
    }

    // ── Normalise and insert ─────────────────────────────────────────────
    const subjectMap: Record<string, string> = {};
    subjects.forEach((s: any) => {
      subjectMap[s.name.toLowerCase()] = s.id;
    });

    const insertRows = plan.map((item: any) => ({
      user_id: userId,
      subject_id:
        item.subject_id ||
        subjectMap[item.subject?.toLowerCase()] ||
        null,
      topic_name: `${item.subject || ""}: ${item.topic || "General"}`.trim(),
      scheduled_date: item.date || today,
      duration_minutes: Number(item.duration_minutes) || 45,
      task_type: item.task_type || "revision",
      notes: item.task_description || null,
      is_completed: false,
    }));

    const { error: insertError, count } = await supabase
      .from("study_schedule")
      .insert(insertRows, { count: "exact" });

    if (insertError) {
      console.error("[generate-study-plan] Insert error:", insertError.message);
      return jsonResponse(
        {
          error: `Failed to save study plan: ${insertError.message}`,
          plan,
          saved: 0,
          weak_area_focus: normalizeArray(parsed.weak_area_focus),
        },
        500
      );
    }

    return jsonResponse({
      plan,
      saved: count ?? insertRows.length,
      weak_area_focus: normalizeArray(parsed.weak_area_focus),
    });
  } catch (err: unknown) {
    console.error("[generate-study-plan]", err);
    return errorResponse(err);
  }
});
