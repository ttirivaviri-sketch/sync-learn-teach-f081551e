/**
 * photo-solve-variants Edge Function
 *
 * Given a graded photo-solve result (the original question, model solution
 * and which steps went wrong), generate N isomorphic practice questions so
 * the student can practise the corrections.
 *
 * "Isomorphic" (the pedagogically-useful reading of "95% similar"):
 *   - IDENTICAL solution method, step structure, difficulty, command words
 *     and mark allocation as the original question
 *   - only surface values change (numbers, names, minor context)
 *   - each variant specifically exercises the steps the student got wrong
 *
 * POST body:
 * {
 *   question: string,          // question_detected from photo-solve-grade
 *   model_solution: string,    // full worked solution (LaTeX/markdown)
 *   failed_steps?: string[],   // corrections/step texts the student missed
 *   subject?: string,
 *   topic?: string,
 *   curriculum?: string,
 *   marks?: number,
 *   count?: number,            // default 5, max 5
 * }
 *
 * Returns:
 * {
 *   questions: [{
 *     id: string,
 *     question: string,            // LaTeX where mathematical
 *     marks: number,
 *     model_answer: string,
 *     step_by_step_solution: string,
 *     marking_scheme: string[],
 *     target_correction: string,   // which original mistake this drills
 *   }]
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  safeJsonParse,
  errorResponse,
  jsonResponse,
  enforceQuota,
  requireCaller,
  quotaExceededResponse,
} from "../_shared/ai-config.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

const SYSTEM_PROMPT = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: A student attempted a question (photographed working, already graded). Generate ISOMORPHIC practice variants of that exact question so they can practise the corrections.

ISOMORPHIC MEANS — the variant must keep, unchanged:
- the solution METHOD and the exact sequence of solution steps
- the difficulty level and mark allocation
- the command words and question structure
- the concepts tested
Only surface values may change: numbers, coefficients, names, minor context. A student who has understood the correction to the original must be able to solve every variant with the same steps; a student who merely memorised the original's answer must NOT be able to answer from memory.

TARGETING RULES:
- If failed steps are provided, EVERY variant must force the student through those exact steps — the changed values must make the failed step non-trivial again (e.g. if they dropped a negative sign, include negatives; if they skipped simplification, ensure simplification is required).
- State in "target_correction" which original mistake the variant drills.
- Vary the surface values BETWEEN variants (no two variants share the same numbers).
- NEVER copy the original question verbatim.

${KATEX_RULES}

Return ONLY valid JSON (no markdown fences):
{
  "questions": [
    {
      "id": "v1",
      "question": "full question text with LaTeX where mathematical",
      "marks": 3,
      "model_answer": "complete model answer with LaTeX",
      "step_by_step_solution": "step 1: …\\nstep 2: …",
      "marking_scheme": ["1 mark for …", "1 mark for …"],
      "target_correction": "which original mistake this practises"
    }
  ]
}`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireCaller(req, "photo-solve-variants");
    if (gate.response) return gate.response;

    const quota = await enforceQuota(req, "quiz", { userId: gate.caller.userId });
    if (!quota.allowed)
      return quotaExceededResponse("quiz", quota.used, quota.limit);

    const body = await req.json();
    const {
      question,
      model_solution,
      failed_steps,
      subject,
      topic,
      curriculum,
      marks,
      count,
    } = body ?? {};

    if (!question || typeof question !== "string" || question.trim().length < 5) {
      return jsonResponse({ error: "`question` is required" }, 400);
    }

    const n = Math.min(Math.max(Number(count) || 5, 1), 5);
    const failed = Array.isArray(failed_steps)
      ? failed_steps.map((s: unknown) => String(s)).filter((s) => s.trim().length > 0)
      : [];

    const lines: string[] = [];
    if (curriculum) lines.push(`Curriculum: ${curriculum}`);
    if (subject) lines.push(`Subject: ${subject}`);
    if (topic) lines.push(`Topic: ${topic}`);
    if (typeof marks === "number" && marks > 0) lines.push(`Marks for the original question: ${marks}`);
    lines.push(`\nORIGINAL QUESTION:\n${question}`);
    if (model_solution) lines.push(`\nMODEL SOLUTION (the method every variant must require):\n${model_solution}`);
    if (failed.length > 0) {
      lines.push(`\nSTEPS THE STUDENT GOT WRONG (every variant must force practice of these):\n${failed.map((f, i) => `${i + 1}. ${f}`).join("\n")}`);
    } else {
      lines.push(`\nThe student made mistakes in their working — variants should require full, careful working of every step.`);
    }
    lines.push(`\nGenerate ${n} isomorphic practice variants. Return ONLY the JSON described in the system prompt.`);

    const ai = getAIConfig("standard");
    const raw = await callAI(ai, SYSTEM_PROMPT, lines.join("\n"), {
      temperature: 0.6,
      jsonMode: true,
      maxTokens: 3200,
      usage: { userId: quota.userId, bucket: "quiz" },
    });

    const parsed = safeJsonParse<{ questions?: unknown[] }>(raw);
    const questionsRaw = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const questions = questionsRaw.slice(0, n).map((q: any, i: number) => ({
      id: String(q?.id ?? `v${i + 1}`),
      question: String(q?.question ?? "").trim(),
      marks: Math.max(1, Number(q?.marks) || (typeof marks === "number" && marks > 0 ? marks : 1)),
      model_answer: String(q?.model_answer ?? "").trim(),
      step_by_step_solution: String(q?.step_by_step_solution ?? "").trim(),
      marking_scheme: Array.isArray(q?.marking_scheme)
        ? q.marking_scheme.map((m: unknown) => String(m))
        : [],
      target_correction: String(q?.target_correction ?? "").trim(),
    })).filter((q) => q.question.length > 0 && q.model_answer.length > 0);

    if (questions.length === 0) {
      return jsonResponse({ error: "AI returned no usable variants — try again" }, 502);
    }

    return jsonResponse({ questions });
  } catch (e) {
    console.error("photo-solve-variants error:", e);
    return errorResponse(e);
  }
});
