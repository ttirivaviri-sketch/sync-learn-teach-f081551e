/**
 * explain-answer Edge Function (v2)
 *
 * Two modes:
 *   1. EXPLAIN (default): Stream a tutor explanation of mistakes.
 *   2. MARK: Score a student answer, assign marks, note mistakes, give model answer.
 *
 * POST body:
 * {
 *   question, studentAnswer, modelAnswer?, topic?, subject?,
 *   keyPoints?, conceptsTested?, markingScheme?,
 *   totalMarks?, mode?: "explain" | "mark",
 *   curriculum?, examLevel?, stream?: boolean (default true)
 * }
 *
 * Returns (mode=mark, JSON):
 * {
 *   score: number,
 *   totalMarks: number,
 *   percentage: number,
 *   feedback: string,
 *   mistakes: string[],
 *   correctParts: string[],
 *   modelAnswer: string,
 *   markBreakdown: [{ criterion: string, marksAwarded: number, marksAvailable: number, comment: string }],
 *   improvementTips: string[]
 * }
 *
 * Returns (mode=explain): SSE text/event-stream
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAIConfig,
  buildStudyModeContext,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  callAIStream,
  safeJsonParse,
  normalizeArray,
  errorResponse,
  jsonResponse,
  streamResponse,
} from "../_shared/ai-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const body = await req.json();

    const {
      question,
      studentAnswer,
      modelAnswer,
      topic,
      subject,
      keyPoints,
      conceptsTested,
      markingScheme,
      totalMarks,
      mode = "explain",
      examStrict = false,
      curriculum,
      examLevel,
      stream = true,
    } = body;

    if (!question || !studentAnswer) {
      return jsonResponse(
        { error: "question and studentAnswer are required" },
        400
      );
    }

    // ── Build context ─────────────────────────────────────────────────────
    const context = buildStudyModeContext({
      curriculum,
      subject,
      topic,
      examLevel,
    });

    // Treat strict-grading aliases as "mark" mode so legacy clients don't break
    const isMarkMode =
      mode === "mark" || mode === "exam-strict" || mode === "mark-strict";

    // ── MARK MODE: Score the answer ─────────────────────────────────────
    if (isMarkMode) {
      const markSystemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Mark and score the student's answer against the marking criteria.
Return ONLY structured JSON study content. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

MATHEMATICAL NOTATION: ALL mathematical expressions MUST use LaTeX notation wrapped in dollar signs (e.g. $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$). NEVER write plain text math. Use display math $$...$$ for complex equations.

You are an experienced examiner. Be fair but rigorous:
1. Compare the student's answer point-by-point against the marking scheme.
2. Award marks only where the student has clearly demonstrated the required knowledge.
3. Give partial credit where appropriate (method marks, intermediate steps).
4. Identify specific mistakes, misconceptions, and missing points.
5. Provide constructive feedback that helps the student improve.
6. Include the complete model answer for reference.

Return ONLY valid JSON:
{
  "score": 4,
  "totalMarks": 6,
  "percentage": 67,
  "feedback": "Overall assessment of the answer — what was good and what was missing.",
  "mistakes": ["Specific mistake 1", "Missing point about..."],
  "correctParts": ["Correctly identified...", "Good use of terminology for..."],
  "modelAnswer": "The complete model answer that would score full marks",
  "markBreakdown": [
    { "criterion": "Identifies the process", "marksAwarded": 1, "marksAvailable": 1, "comment": "Correctly stated" },
    { "criterion": "Explains mechanism", "marksAwarded": 2, "marksAvailable": 3, "comment": "Partially explained — missed the role of enzymes" }
  ],
  "improvementTips": ["Always mention specific examples", "Use the command word to guide your answer structure"]
}`;

      const markUserPrompt = `MARK THIS ANSWER:

${context}

**Question:** (${totalMarks || "?"} marks)
${question}

**Student's Answer:**
${studentAnswer}

${modelAnswer ? `**Model Answer:**\n${modelAnswer}` : ""}
${markingScheme?.length ? `**Marking Scheme:**\n${markingScheme.map((s: string) => `• ${s}`).join("\n")}` : ""}
${keyPoints?.length ? `**Key Points Expected:**\n${keyPoints.map((p: string) => `• ${p}`).join("\n")}` : ""}
${conceptsTested?.length ? `**Concepts Being Tested:** ${conceptsTested.join(", ")}` : ""}

Score this answer out of ${totalMarks || "the available marks"}.`;

      const rawContent = await callAI(ai, markSystemPrompt, markUserPrompt, {
        temperature: 0.3,
        jsonMode: true,
      });

      const result = safeJsonParse<any>(rawContent);

      return jsonResponse({
        score: Number(result.score || 0),
        totalMarks: Number(result.totalMarks || totalMarks || 0),
        percentage: Number(
          result.percentage ||
            (result.score && result.totalMarks
              ? Math.round((result.score / result.totalMarks) * 100)
              : 0)
        ),
        feedback: String(result.feedback || "").trim(),
        mistakes: normalizeArray(result.mistakes),
        correctParts: normalizeArray(result.correctParts),
        modelAnswer: String(result.modelAnswer || modelAnswer || "").trim(),
        markBreakdown: Array.isArray(result.markBreakdown)
          ? result.markBreakdown
          : [],
        improvementTips: normalizeArray(result.improvementTips),
      });
    }

    // ── EXPLAIN MODE: Stream a tutor explanation ────────────────────────
    const explainSystemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

You are a supportive expert tutor helping a student understand where they went wrong on an exam question.
Return ONLY clean, structured study content using markdown. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

MATHEMATICAL NOTATION: ALL mathematical expressions MUST use LaTeX notation wrapped in dollar signs (e.g. $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$). NEVER write plain text math. Use display math $$...$$ for complex equations.

Your explanation MUST:
1. Acknowledge what the student got right (if anything).
2. Identify the specific gap(s) or misconception(s).
3. Explain the correct concept clearly, step by step.
4. Show how the model answer addresses the marking criteria.
5. Give a memorable tip to prevent this mistake in future.
6. Reference specific syllabus concepts and exam techniques.

Tone: Encouraging, clear, never condescending.
Format: Use markdown with clear headings. Keep it 150–400 words.`;

    const explainUserPrompt = `${context}

**Question:** (${totalMarks || "?"} marks)
${question}

**Student's Answer:**
${studentAnswer}

**Model Answer:**
${modelAnswer || "Not provided — explain based on the question itself."}

${keyPoints?.length ? `**Key Marking Points:**\n${keyPoints.map((p: string) => `• ${p}`).join("\n")}` : ""}
${conceptsTested?.length ? `**Concepts Tested:** ${conceptsTested.join(", ")}` : ""}

Help this student understand exactly what they missed and how to improve.`;

    if (stream) {
      const aiResp = await callAIStream(
        ai,
        explainSystemPrompt,
        explainUserPrompt
      );
      return streamResponse(aiResp.body);
    }

    // Non-streaming fallback
    const content = await callAI(ai, explainSystemPrompt, explainUserPrompt);
    return jsonResponse({ explanation: content });
  } catch (e) {
    console.error("explain-answer error:", e);
    return errorResponse(e);
  }
});
