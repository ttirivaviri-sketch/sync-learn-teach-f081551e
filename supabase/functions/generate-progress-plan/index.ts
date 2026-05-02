/**
 * generate-progress-plan — Builds a structured AI improvement plan from a
 * learner's aggregated progress summary. Output is read by
 * `generateProgressReport` in the frontend.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  getAIConfig,
  callAI,
  safeJsonParse,
  jsonResponse,
  errorResponse,
} from "../_shared/ai-config.ts";

const SYSTEM_PROMPT = `You are the StudySync Progress Planner.
You take a learner's aggregated study summary (subject mastery, weak topics,
mock exam results, completed tasks, study minutes, target grade) and produce
a concrete, actionable improvement plan.

CORE RULES:
1. Be specific — name the actual topics from the input. Never use placeholders.
2. Be honest — if mastery is low, say so plainly and frame it as fixable.
3. Be tied to the curriculum and target grade in the input.
4. The 7-day plan must contain 7 entries (Day 1..7), each with concrete actions
   the learner can do without a tutor.
5. If audience is "tutor", also include tutor_session_plan with the first 3
   sessions a tutor should run with this learner. If audience is "self",
   omit tutor_session_plan or set it to [].
6. Keep tone supportive, never patronising. Use "you" for the learner audience.

OUTPUT — STRICT JSON, no extra text:
{
  "headline_assessment": "<one paragraph diagnosing where the learner is>",
  "top_concerns": [
    { "topic": "<string>", "why": "<string>", "first_step": "<string>",
      "priority": "critical"|"high"|"medium"|"low" }
  ],
  "seven_day_plan": [
    { "day": 1..7, "focus": "<string>", "actions": ["<string>", ...] }
  ],
  "recommended_focus_areas": ["<string>", ...],
  "suggested_past_paper_questions": ["<string>", ...],
  "tutor_session_plan": [
    { "session": 1..3, "objective": "<string>", "activities": ["<string>", ...] }
  ],
  "motivational_note": "<one short paragraph>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse(new Error("Method not allowed"), 405);
  }

  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return errorResponse(new Error("Invalid body"), 400);
    }

    const audience = body.audience === "tutor" ? "tutor" : "self";

    const userPrompt = `AUDIENCE: ${audience}
${body.tutor_name ? `TUTOR NAME: ${body.tutor_name}` : ""}

LEARNER PROFILE:
${JSON.stringify(body.profile ?? {}, null, 2)}

OVERALL SUMMARY:
${JSON.stringify(body.summary ?? {}, null, 2)}

WEAK TOPICS (priority for the plan):
${JSON.stringify(body.weak_topics ?? [], null, 2)}

STRONG TOPICS (preserve momentum):
${JSON.stringify(body.strong_topics ?? [], null, 2)}

SUBJECT MASTERY:
${JSON.stringify(body.subject_mastery ?? [], null, 2)}

RECENT MOCK EXAMS:
${JSON.stringify(body.recent_mocks ?? [], null, 2)}

Produce the JSON plan now.`;

    const ai = getAIConfig("standard");
    const raw = await callAI(ai, SYSTEM_PROMPT, userPrompt, {
      jsonMode: true,
      temperature: 0.4,
      maxTokens: 2200,
    });

    const parsed = safeJsonParse(raw);
    return jsonResponse(parsed);
  } catch (err) {
    console.error("generate-progress-plan error:", err);
    return errorResponse(err, 500);
  }
});
