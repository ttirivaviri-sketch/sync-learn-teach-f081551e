/**
 * generate-study-plan Edge Function
 *
 * Takes a student's full profile (subjects, topics, past-paper data, performance)
 * and returns a structured 7-14 day AI study plan saved to study_schedule.
 *
 * POST body:
 * {
 *   profile: { grade, curriculum, subjects: string[] },
 *   subjects: [{ id, name, topics: [{name, examWeight, subtopics, concepts}] }],
 *   examDate?: string (ISO date),
 *   performanceContext?: string,    // JSON summary of weak topics
 *   syllabusContext?: string,       // aggregated curriculum context
 *   pastPaperContext?: string,      // past-paper pattern summary
 *   mode: "initial" | "adaptive",   // initial = signup, adaptive = 70% completion
 *   userId: string
 * }
 *
 * Returns:
 * {
 *   plan: [{ subject, topic, task_type, date, duration_minutes, task_description }],
 *   saved: number  // rows inserted
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getAIConfig(): { url: string; key: string; model: string } {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const openaiBase = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (openaiKey) {
    return {
      url: `${openaiBase}/chat/completions`,
      key: openaiKey,
      model: Deno.env.get("AI_MODEL") || "gpt-4o-mini",
    };
  }
  if (lovableKey) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: "google/gemini-2.0-flash",
    };
  }
  throw new Error("No AI API key configured.");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const {
      profile,
      subjects = [],
      examDate,
      performanceContext = "",
      syllabusContext = "",
      pastPaperContext = "",
      mode = "initial",
      userId,
    } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build rich subject/topic summary for the AI
    const subjectSummary = subjects
      .map((s: any) => {
        const topics = (s.topics || [])
          .map((t: any) =>
            `  - ${t.name} (weight: ${t.examWeight || "?"}%` +
            (t.subtopics?.length ? `, subtopics: ${t.subtopics.slice(0, 3).join(", ")}` : "") +
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

    const systemPrompt = `You are an expert adaptive learning engine for a student exam preparation platform.
Your task is to create a highly personalised, actionable study plan based on the student's profile, uploaded syllabus, past-paper patterns, and current performance data.

Rules:
1. Return ONLY valid JSON — an array of study plan items.
2. Spread tasks across ${planDays} days starting from ${today}.
3. Weight topics by exam importance (higher weight = more sessions).
4. In adaptive mode, INCREASE focus on weak topics and REDUCE repetition of mastered ones.
5. Each day should have 1–3 tasks, each 30–60 minutes.
6. Task types: "concept_learning", "active_recall", "exam_question", "micro_revision", "past_paper_practice", "flashcard_review"
7. Include a brief task_description (1 sentence) so the student knows what to do.
8. Ensure variety: mix task types per subject, don't repeat same type two days running.

Return JSON array ONLY (no markdown, no explanation):
[
  {
    "subject": "Mathematics",
    "subject_id": "uuid-or-null",
    "topic": "Algebra",
    "task_type": "concept_learning",
    "date": "2026-03-18",
    "duration_minutes": 45,
    "task_description": "Study the laws of indices and practice simplification problems."
  }
]`;

    const userPrompt = `Create a ${planDays}-day ${mode === "adaptive" ? "ADAPTIVE (focus on weak areas)" : "initial"} study plan.

Student Profile:
- Grade/Level: ${profile?.grade || "Unknown"}
- Curriculum: ${profile?.curriculum || "ZIMSEC"}
- Subjects: ${(profile?.subjects || []).join(", ") || subjects.map((s: any) => s.name).join(", ")}
${examDate ? `- Exam Date: ${examDate} (${daysUntilExam} days away)` : ""}

Subject Topics & Syllabus:
${subjectSummary || "(No subjects uploaded yet — create a general study plan)"}

${syllabusContext ? `Syllabus & Learning Objectives:\n${syllabusContext.substring(0, 2000)}` : ""}

${pastPaperContext ? `Past Paper Patterns:\n${pastPaperContext.substring(0, 1500)}` : ""}

${
  performanceContext
    ? `Current Performance & Weak Areas (PRIORITISE THESE):\n${performanceContext.substring(0, 1000)}`
    : mode === "initial"
    ? "This is the student's first plan — distribute topics evenly by exam weight."
    : "No performance data yet — use syllabus weights."
}

Plan start: ${today}, plan length: ${planDays} days.
Generate ${planDays * 2} tasks (roughly 2 per day). Prioritise high-weight topics and weak areas.`;

    const response = await fetch(ai.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error: ${response.status} ${err}`);
    }

    const aiData = await response.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "[]";

    // Parse JSON — handle both array and { plan: [...] } responses
    let plan: any[] = [];
    try {
      const parsed = JSON.parse(rawContent);
      plan = Array.isArray(parsed) ? parsed : parsed.plan || parsed.study_plan || [];
    } catch {
      // Try to extract JSON array from markdown fences
      const match = rawContent.match(/\[[\s\S]*\]/);
      if (match) plan = JSON.parse(match[0]);
    }

    if (!Array.isArray(plan) || plan.length === 0) {
      return new Response(
        JSON.stringify({ error: "AI returned empty plan", raw: rawContent.substring(0, 500) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalise and insert into study_schedule
    const subjectMap: Record<string, string> = {};
    subjects.forEach((s: any) => { subjectMap[s.name.toLowerCase()] = s.id; });

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
      // Return the plan even if insert fails (table may not exist yet)
      console.error("[generate-study-plan] Insert error:", insertError.message);
      return new Response(
        JSON.stringify({ plan, saved: 0, insertError: insertError.message }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ plan, saved: count ?? insertRows.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-study-plan]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
