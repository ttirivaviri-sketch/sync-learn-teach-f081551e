/**
 * analyze-prerequisites
 *
 * Identifies foundational topics a student must know before tackling `topic`,
 * grounded in the user's curriculum and (when `subjectId` is given) the
 * syllabus + past-paper question types via the get_subject_context RPC.
 *
 * POST body:
 * {
 *   subject: string,
 *   topic: string,
 *   curriculum?: string,
 *   grade?: string,
 *   gradeLevel?: string,
 *   subjectId?: string  // enables server-side syllabus enrichment
 * }
 *
 * Returns: { gaps: [{ topic, description, missingConcepts[], exampleQuestions[], tiedToQuestionType? }] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  getUserIdFromRequest,
  safeJsonParse,
  normalizeArray,
  errorResponse,
  jsonResponse,
} from "../_shared/ai-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ai = getAIConfig();
    const body = await req.json();
    const {
      subject,
      topic,
      curriculum = "ZIMSEC",
      grade,
      gradeLevel,
      subjectId,
    } = body ?? {};

    if (!subject || !topic) {
      return jsonResponse({ error: "subject and topic are required" }, 400);
    }

    // ── Optional: pull syllabus + past-paper context from RPC ──
    let curriculumContext = "";
    let pastPaperQuestionTypes: string[] = [];
    if (subjectId) {
      try {
        const authHeader = req.headers.get("Authorization") ?? "";
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } }
        );
        const { data, error } = await supabase.rpc("get_subject_context", {
          p_subject_id: subjectId,
          p_topic_name: topic,
        });
        if (!error && data) {
          curriculumContext = String((data as any).curriculumContext ?? "");
          const patterns = (data as any).examPatterns ?? [];
          const types = new Set<string>();
          for (const p of patterns) {
            const qt = p?.question_types;
            if (Array.isArray(qt)) qt.forEach((t: any) => t && types.add(String(t)));
          }
          const pastQs = (data as any).pastPaperQuestions ?? [];
          for (const q of pastQs) {
            if (q?.question_type) types.add(String(q.question_type));
          }
          pastPaperQuestionTypes = Array.from(types).slice(0, 12);
        }
      } catch (err) {
        console.warn("[analyze-prerequisites] context fetch failed:", err);
      }
    }

    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Identify the foundational prerequisite topics a student MUST already understand before they can attempt "${topic}" in ${subject}.

GROUNDING RULES:
1. Tailor gaps to the ${curriculum} curriculum${grade ? ` at ${grade} level` : ""}.
2. If past-paper question types are provided, ground each gap in WHAT THE EXAM ACTUALLY ASKS (e.g. for "differentiation" with structured calculation questions: algebraic simplification, indices/exponent rules, basic trig identities, function notation).
3. Each gap must be a CONCRETE prior topic — not vague ("good algebra") but specific ("simplifying algebraic fractions", "solving linear equations", "expanding brackets").
4. List 1–4 gaps (most critical first). Skip gaps the student would obviously already know at this grade.
5. For each gap, list 2–4 missing concepts and 1–2 short example questions that test that prerequisite.

Return ONLY valid JSON:
{
  "gaps": [
    {
      "topic": "Algebraic simplification",
      "description": "Without confident algebraic manipulation, derivatives become impossible to simplify.",
      "missingConcepts": ["combining like terms", "factorising quadratics", "simplifying fractions"],
      "exampleQuestions": ["Simplify $\\\\frac{x^2 - 4}{x - 2}$"],
      "tiedToQuestionType": "structured calculation"
    }
  ]
}

Use LaTeX (wrapped in $...$) for all maths. If the student likely has NO real gaps, return { "gaps": [] }.`;

    let userPrompt = `Subject: ${subject}
Topic the student wants to attempt: ${topic}
Curriculum: ${curriculum}${grade ? `\nGrade: ${grade}` : ""}${gradeLevel ? `\nLevel: ${gradeLevel}` : ""}`;

    if (pastPaperQuestionTypes.length) {
      userPrompt += `\n\nQUESTION TYPES THIS TOPIC IS ASKED IN (from past papers):\n${pastPaperQuestionTypes.map((t) => `  • ${t}`).join("\n")}`;
    }
    if (curriculumContext) {
      userPrompt += `\n\nSYLLABUS CONTEXT:\n${curriculumContext.substring(0, 2500)}`;
    }
    userPrompt += `\n\nList the prerequisite gaps now.`;

    const raw = await callAI(ai, systemPrompt, userPrompt, {
      usage: { userId: getUserIdFromRequest(req), bucket: "topic_session" },
      temperature: 0.3,
      jsonMode: true,
      maxTokens: 1200,
    });

    const parsed = safeJsonParse<{ gaps?: any[] }>(raw);
    const gaps = (parsed.gaps ?? []).slice(0, 4).map((g: any) => ({
      topic: String(g.topic ?? "").trim(),
      description: String(g.description ?? "").trim(),
      missingConcepts: normalizeArray(g.missingConcepts),
      exampleQuestions: normalizeArray(g.exampleQuestions),
      tiedToQuestionType: g.tiedToQuestionType ? String(g.tiedToQuestionType) : undefined,
    })).filter((g) => g.topic);

    return jsonResponse({ gaps });
  } catch (e) {
    console.error("analyze-prerequisites error:", e);
    return errorResponse(e);
  }
});
