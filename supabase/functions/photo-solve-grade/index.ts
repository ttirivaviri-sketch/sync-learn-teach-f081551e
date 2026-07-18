/**
 * photo-solve-grade Edge Function
 *
 * Multimodal: accepts a photo of a student's handwritten working (and an
 * optional question + context) and returns step-by-step grading.
 *
 * POST body:
 * {
 *   image: string,            // data URL or raw base64 (jpeg/png/webp/heic)
 *   mimeType?: string,        // optional, defaults inferred from data URL or 'image/jpeg'
 *   question?: string,        // original question, if known
 *   subject?: string,
 *   topic?: string,
 *   curriculum?: string,
 *   examLevel?: string,
 *   totalMarks?: number,
 * }
 *
 * Returns:
 * {
 *   question_detected: string,
 *   final_answer: string,
 *   final_answer_correct: boolean | null,
 *   steps: [{
 *     index: number,
 *     student_step: string,     // LaTeX/text
 *     verdict: "correct" | "partial" | "incorrect" | "missing",
 *     reason: string,
 *     correction: string,       // LaTeX of the right move (if not fully correct)
 *   }],
 *   missed_steps: string[],     // steps the student skipped
 *   next_hint: string,          // the single most useful next nudge
 *   model_solution: string,     // full worked solution in LaTeX/markdown
 *   confidence: number,         // 0..1 — how confident the OCR/reading was
 *   marks_awarded: number,
 *   marks_possible: number,
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  safeJsonParse,
  normalizeArray,
  errorResponse,
  jsonResponse,
  enforceQuota,
  quotaExceededResponse,
  reportTokenUsage,
} from "../_shared/ai-config.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

const SYSTEM_PROMPT = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: A student has submitted a photo of their handwritten (or typed) working for a problem. Your job is to:
1. Read the photo carefully (OCR + math understanding).
2. Identify the question they are attempting (if visible) and the steps of their working.
3. Grade EACH STEP individually as an examiner would — not just the final answer.
4. Reward correct methods, ideas, and partial credit. Be fair but accurate.
5. Identify any missing steps a model solution would include.
6. Give ONE pinpointed next hint — the single most useful nudge to move them forward.
7. Provide a full model solution in LaTeX.

CORE RULES:
- Be GENEROUS about handwriting and notation differences. Different valid methods that reach the right answer get full marks.
- If a step is numerically equivalent to the model step, it's CORRECT, even if formatting differs.
- Only mark "incorrect" when the maths is genuinely wrong, not when the handwriting is messy.
- If you cannot read part of the image, lower "confidence" and note the unreadable parts inside the relevant step's "reason" — DO NOT fabricate working.
- If the image clearly doesn't contain a problem/solution, set confidence to 0 and explain in question_detected.

${KATEX_RULES}

Return ONLY valid JSON in this exact shape (no markdown fences):
{
  "question_detected": "string",
  "final_answer": "string (LaTeX where applicable)",
  "final_answer_correct": true | false | null,
  "steps": [
    {
      "index": 1,
      "student_step": "LaTeX/text of the step as the student wrote it",
      "verdict": "correct" | "partial" | "incorrect" | "missing",
      "reason": "one short examiner-style sentence",
      "correction": "LaTeX of the correct move (empty string if verdict is correct)"
    }
  ],
  "missed_steps": ["LaTeX of any step a correct solution requires that the student skipped"],
  "next_hint": "one short, specific nudge",
  "model_solution": "full worked solution in LaTeX/markdown",
  "confidence": 0.0,
  "marks_awarded": 0,
  "marks_possible": 0
}`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const quota = await enforceQuota(req, "misc");
    if (!quota.allowed)
      return quotaExceededResponse("misc", quota.used, quota.limit);

    // Force Lovable AI Gateway with a multimodal-capable Gemini model,
    // even if OPENAI_API_KEY happens to be set (the OpenAI fallback in
    // getAIConfig returns gpt-4o-mini which gave us empty `steps`).
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const ai = lovableKey
      ? {
          url: "https://ai.gateway.lovable.dev/v1/chat/completions",
          key: lovableKey,
          model: "google/gemini-2.5-flash",
        }
      : getAIConfig("standard");

    const body = await req.json();

    const {
      image,
      mimeType,
      question,
      subject,
      topic,
      curriculum,
      examLevel,
      totalMarks,
    } = body ?? {};

    if (!image || typeof image !== "string") {
      return jsonResponse(
        { error: "`image` (base64 data URL or raw base64) is required" },
        400
      );
    }

    // Normalise to a data URL
    let dataUrl = image.trim();
    if (!dataUrl.startsWith("data:")) {
      const mt = mimeType || "image/jpeg";
      dataUrl = `data:${mt};base64,${dataUrl}`;
    }

    console.log("[photo-solve-grade] payload",
      "image_chars=", dataUrl.length,
      "subject=", subject ?? "-",
      "topic=", topic ?? "-",
      "has_question=", !!question,
      "model=", ai.model,
    );

    const contextLines: string[] = [];
    if (curriculum) contextLines.push(`Curriculum: ${curriculum}`);
    if (examLevel) contextLines.push(`Exam level: ${examLevel}`);
    if (subject) contextLines.push(`Subject: ${subject}`);
    if (topic) contextLines.push(`Topic: ${topic}`);
    if (typeof totalMarks === "number" && totalMarks > 0)
      contextLines.push(`Total marks: ${totalMarks}`);
    if (question) contextLines.push(`\nQuestion (provided):\n${question}`);

    const userText =
      (contextLines.length ? contextLines.join("\n") + "\n\n" : "") +
      `Grade the student's working in the attached image. Return ONLY the JSON described in the system prompt.`;

    async function callModel(temperature: number, extraSystem = "") {
      const sys = extraSystem ? `${SYSTEM_PROMPT}\n\n${extraSystem}` : SYSTEM_PROMPT;
      const r = await fetch(ai.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ai.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ai.model,
          temperature,
          max_tokens: 2200,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: sys },
            {
              role: "user",
              content: [
                { type: "text", text: userText },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
        }),
      });
      return r;
    }

    let response = await callModel(0.2);

    if (!response.ok) {
      const errText = await response.text();
      console.error("photo-solve-grade AI error", response.status, errText);
      if (response.status === 429)
        return jsonResponse({ error: "rate_limited" }, 429);
      if (response.status === 402)
        return jsonResponse({ error: "credits_exhausted" }, 402);
      return jsonResponse(
        { error: `AI gateway error ${response.status}`, detail: errText.slice(0, 400) },
        502
      );
    }

    const recordUsage = (d: any) => {
      if (d?.usage) {
        reportTokenUsage({
          userId: quota.userId,
          bucket: "misc",
          tokensIn: Number(d.usage.prompt_tokens ?? 0),
          tokensOut: Number(d.usage.completion_tokens ?? 0),
        });
      }
    };

    let data = await response.json();
    recordUsage(data);
    let raw = data?.choices?.[0]?.message?.content ?? "";
    let parsed = safeJsonParse<any>(raw);

    // Retry once with stricter prompt if the model returned no steps at all
    const noSteps = !Array.isArray(parsed?.steps) || parsed.steps.length === 0;
    const noAnswer = !parsed?.final_answer && !parsed?.question_detected;
    if (noSteps && noAnswer) {
      console.warn("[photo-solve-grade] empty parse — retrying with temperature=0");
      response = await callModel(
        0,
        "CRITICAL: You MUST return at least one item in `steps` (even if verdict is 'missing') and a non-empty `model_solution`. Never return an empty object."
      );
      if (response.ok) {
        data = await response.json();
        recordUsage(data);
        raw = data?.choices?.[0]?.message?.content ?? "";
        parsed = safeJsonParse<any>(raw);
      }
    }

    const stepsRaw = Array.isArray(parsed.steps) ? parsed.steps : [];
    const steps = stepsRaw.map((s: any, i: number) => ({
      index: Number(s.index ?? i + 1),
      student_step: String(s.student_step ?? "").trim(),
      verdict: ["correct", "partial", "incorrect", "missing"].includes(s.verdict)
        ? s.verdict
        : "partial",
      reason: String(s.reason ?? "").trim(),
      correction: String(s.correction ?? "").trim(),
    }));

    const possible =
      Number(parsed.marks_possible) ||
      (typeof totalMarks === "number" ? totalMarks : steps.length || 1);
    let awarded = Number(parsed.marks_awarded ?? 0);
    if (!awarded && steps.length) {
      awarded = steps.reduce((acc: number, s: any) => {
        if (s.verdict === "correct") return acc + 1;
        if (s.verdict === "partial") return acc + 0.5;
        return acc;
      }, 0);
      awarded = Math.round((awarded / steps.length) * possible);
    }
    awarded = Math.max(0, Math.min(awarded, possible));

    return jsonResponse({
      question_detected: String(parsed.question_detected ?? "").trim(),
      final_answer: String(parsed.final_answer ?? "").trim(),
      final_answer_correct:
        typeof parsed.final_answer_correct === "boolean"
          ? parsed.final_answer_correct
          : null,
      steps,
      missed_steps: normalizeArray(parsed.missed_steps),
      next_hint: String(parsed.next_hint ?? "").trim(),
      model_solution: String(parsed.model_solution ?? "").trim(),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
      marks_awarded: awarded,
      marks_possible: possible,
    });
  } catch (e) {
    console.error("photo-solve-grade error:", e);
    return errorResponse(e);
  }
});
