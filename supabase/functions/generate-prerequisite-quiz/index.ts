/**
 * generate-prerequisite-quiz
 *
 * Generates a short multiple-choice quiz at FOUNDATION difficulty to verify
 * the student has closed a prerequisite gap.
 *
 * POST body: { subject, topic, curriculum?, grade?, difficulty?, questionCount? }
 * Returns:   { questions: [{ question, options[], correctAnswer (index), explanation }] }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  requireCaller,
  safeJsonParse,
  errorResponse,
  jsonResponse,
} from "../_shared/ai-config.ts";
import { buildProvenance, hashPrompt } from "../_shared/provenance.ts";
import { postProcessQuestions, resolveUserId } from "../_shared/post-process.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Paid AI call — require a verified session before doing any work.
  const auth = await requireCaller(req);
  if (auth.response) return auth.response;
  const authedUserId = auth.caller.userId;

  try {
    const ai = getAIConfig();
    const body = await req.json();
    const {
      subject,
      topic,
      curriculum = "ZIMSEC",
      grade,
      difficulty = "basic",
      questionCount = 3,
    } = body ?? {};

    if (!subject || !topic) {
      return jsonResponse({ error: "subject and topic are required" }, 400);
    }

    const count = Math.min(Math.max(Number(questionCount) || 3, 1), 5);

    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Generate ${count} ${difficulty}-difficulty multiple-choice questions to check that a student has mastered the PREREQUISITE topic "${topic}" in ${subject}.

RULES:
• Foundational, no trick questions — they only test that the prerequisite is solid.
• 4 options per question. Exactly one correct answer.
• "correctAnswer" is the ZERO-BASED INDEX (0–3) of the correct option.
• ${KATEX_RULES}
• Mirror ${curriculum}${grade ? ` ${grade}` : ""} command words at foundation level.
• Each explanation: 1–2 sentences explaining why the correct option is right.

Return ONLY valid JSON:
{
  "questions": [
    {
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctAnswer": 1,
      "explanation": "..."
    }
  ]
}`;

    const userPrompt = `Prerequisite topic: ${topic}
Subject: ${subject}
Generate ${count} foundation-level MCQs now.`;

    const raw = await callAI(ai, systemPrompt, userPrompt, {
      usage: { userId: authedUserId, bucket: "quiz" },
      temperature: 0.4,
      jsonMode: true,
      maxTokens: 1400,
    });

    const parsed = safeJsonParse<{ questions?: any[] }>(raw);
    const questions = (parsed.questions ?? [])
      .map((q: any) => {
        const options = Array.isArray(q.options)
          ? q.options.map((o: any) => String(o)).slice(0, 4)
          : [];
        let correct = Number(q.correctAnswer);
        if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
          correct = 0;
        }
        return {
          question: String(q.question ?? "").trim(),
          options,
          correctAnswer: correct,
          explanation: String(q.explanation ?? "").trim(),
        };
      })
      .filter((q) => q.question && q.options.length === 4);

    if (questions.length === 0) {
      throw new Error("AI returned no valid questions");
    }

    const userId = await resolveUserId(req);
    const pp = await postProcessQuestions({
      questions: questions as any[],
      surface: "prerequisite_quiz",
      userId,
    });

    return jsonResponse({
      questions: pp.questions,
      generation_meta: buildProvenance({
        fn_name: "generate-prerequisite-quiz",
        fn_version: "3",
        model: ai.model,
        prompt_hash: await hashPrompt(`${systemPrompt}\n${userPrompt}`),
        curriculum,
        subject,
        topic,
        novelty_reason: pp.meta.novelty.enabled ? "fresh" : "unverified",
        validator_warnings: pp.meta.validator.warnings,
        validator_errors: pp.meta.validator.blocking_errors,
        fingerprints: pp.meta.novelty.fingerprints,
      }),
    });
  } catch (e) {
    console.error("generate-prerequisite-quiz error:", e);
    return errorResponse(e);
  }
});
