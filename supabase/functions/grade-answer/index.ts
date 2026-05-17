/**
 * grade-answer Edge Function
 *
 * Grades a student's free-text answer against the official mark scheme.
 * Returns examiner-style per-marking-point feedback.
 *
 * POST body:
 * {
 *   question: string,
 *   student_answer: string,
 *   marking_scheme: string[],   // mark-by-mark points
 *   model_answer?: string,
 *   marks: number,
 *   command_word?: string,
 *   subject?: string,
 *   topic?: string,
 * }
 *
 * Returns:
 * {
 *   marks_awarded: number,
 *   marks_possible: number,
 *   per_point: [{ point, awarded, max, feedback }],
 *   overall_feedback: string,
 *   command_word_check: { expected, satisfied, note },
 *   missed_keywords: string[],
 *   improvement_tips: string[],
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  safeJsonParse,
  normalizeArray,
  errorResponse,
  jsonResponse,
} from "../_shared/ai-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const body = await req.json();

    const {
      question,
      student_answer,
      marking_scheme,
      model_answer,
      marks,
      command_word,
      subject,
      topic,
    } = body;

    if (!question || typeof student_answer !== "string") {
      return jsonResponse(
        { error: "question and student_answer are required" },
        400
      );
    }

    const totalMarks = Number(marks) || (Array.isArray(marking_scheme) ? marking_scheme.length : 1);
    const scheme = Array.isArray(marking_scheme) ? marking_scheme : [];

    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Act as a fair, generous-but-accurate exam examiner. Grade the student's answer against the official mark scheme, point by point, exactly as a real examiner would.

CORE PRINCIPLE — REWARD CORRECT KNOWLEDGE:
A student answer that conveys the same meaning, value, or concept as the mark scheme MUST receive full marks for that point, even if the wording, formatting, units, punctuation, or LaTeX syntax differ.

EQUIVALENCE RULES (apply BEFORE deducting marks):
- Punctuation/capitalisation/whitespace differences are IRRELEVANT. "Four thousand five hundred and two" === "Four thousand, five hundred and two" → FULL marks.
- Numerically equal answers are equivalent regardless of formatting. "40 cm²" === "40\\text{cm}^2" === "40 cm^2" === "40 square cm" → FULL marks.
- A correct number with the unit omitted (when context makes the unit obvious) → FULL marks. "8" for "How many weeks?" → FULL marks ("8 weeks" is the same answer).
- A correct number WITH the unit when scheme omits it → FULL marks.
- Synonyms and equivalent scientific/mathematical phrasing → FULL marks.
- Strip LaTeX wrappers (\\text{}, \\frac{}, $...$) before comparing.
- Different valid methods that reach the correct answer → FULL marks.

ONLY DEDUCT WHEN:
- The answer is factually wrong, or
- A required step/working is genuinely missing for a "show working" / multi-mark question, or
- A command word demands deeper response (e.g. "Explain" answered with one-word "State"), or
- The answer is blank, off-topic, or contradicts the mark scheme.

Be specific in feedback — name the missed concept, not "you need more detail".
Total awarded marks MUST NOT exceed total marks possible.

WORKED EXAMPLES:
- Q "Write 4502 in words" | Scheme "Four thousand, five hundred and two" | Student "Four thousand five hundred and two" → 1/1 ✅ (comma is irrelevant)
- Q "Area of 8cm × 5cm rectangle" | Scheme "40 cm²" | Student "40 cm²" or "40" → 1/1 ✅
- Q "How many weeks to save \\$120 at \\$15/week?" | Scheme "8 weeks" | Student "8" → 1/1 ✅ (unit obvious from question)
- Q "Multiple of 7?" | Scheme "28" | Student "28" → 1/1 ✅

Return ONLY valid JSON in this exact shape:
{
  "marks_awarded": number,
  "marks_possible": number,
  "per_point": [
    { "point": "the marking point text", "awarded": number, "max": number, "feedback": "specific reason" }
  ],
  "overall_feedback": "1-2 sentences summarising performance",
  "command_word_check": { "expected": "explain", "satisfied": true, "note": "..." },
  "missed_keywords": ["keyword1", "keyword2"],
  "improvement_tips": ["actionable tip 1", "actionable tip 2"]
}`;

    const userPrompt = `${subject ? `Subject: ${subject}\n` : ""}${topic ? `Topic: ${topic}\n` : ""}${command_word ? `Command word: ${command_word}\n` : ""}Total marks: ${totalMarks}

QUESTION:
${question}

OFFICIAL MARK SCHEME (${scheme.length} marking points):
${scheme.map((p, i) => `${i + 1}. ${p}`).join("\n") || "(no detailed scheme — grade against model answer)"}

${model_answer ? `MODEL ANSWER:\n${model_answer}\n` : ""}

STUDENT'S ANSWER:
${student_answer.trim() || "(blank)"}

Grade now. Return JSON only.`;

    const rawContent = await callAI(ai, systemPrompt, userPrompt, {
      temperature: 0.2,
      jsonMode: true,
    });

    const parsed = safeJsonParse<any>(rawContent);

    const perPoint = Array.isArray(parsed.per_point) ? parsed.per_point : [];
    let marksAwarded = Number(parsed.marks_awarded || 0);
    if (perPoint.length > 0 && !marksAwarded) {
      marksAwarded = perPoint.reduce(
        (s: number, p: any) => s + Number(p.awarded || 0),
        0
      );
    }
    marksAwarded = Math.max(0, Math.min(marksAwarded, totalMarks));

    return jsonResponse({
      marks_awarded: marksAwarded,
      marks_possible: totalMarks,
      per_point: perPoint.map((p: any) => ({
        point: String(p.point || "").trim(),
        awarded: Math.max(0, Number(p.awarded || 0)),
        max: Math.max(1, Number(p.max || 1)),
        feedback: String(p.feedback || "").trim(),
      })),
      overall_feedback: String(parsed.overall_feedback || "").trim(),
      command_word_check: parsed.command_word_check || {
        expected: command_word || "",
        satisfied: true,
        note: "",
      },
      missed_keywords: normalizeArray(parsed.missed_keywords),
      improvement_tips: normalizeArray(parsed.improvement_tips),
    });
  } catch (e) {
    console.error("grade-answer error:", e);
    return errorResponse(e);
  }
});
