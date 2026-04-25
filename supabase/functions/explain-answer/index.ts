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
      const strictAddendum = examStrict
        ? `

EXAM-STRICT MODE — examiner-grade marking, written for the student:
You are sitting as the chief examiner for this curriculum (${curriculum || "use the syllabus convention shown above"}). Apply these rules:

GRADING RIGOUR
- Do NOT award method marks for blank or off-topic working.
- Required units in the marking scheme MUST be present for the unit mark.
- Vague gestures at a concept (without naming it correctly) score 0 for that point.
- Command words must be obeyed — Explain ≠ State ≠ Describe ≠ Discuss ≠ Justify.
- Reward fully-equivalent paraphrases and numerically equal answers.

DEPTH OF FEEDBACK (this is what the student NEEDS)
For EVERY marking point in markBreakdown, you MUST populate:
  • "criterion" — the marking point itself
  • "marksAwarded" / "marksAvailable"
  • "comment" — short verdict (e.g. "Awarded — clear definition", "Lost — units missing")
  • "whyExpected" — 1–2 sentences explaining WHY the examiner expects this point: the underlying principle, the syllabus objective it tests, or the standard mark-scheme convention. Treat the student as if they've never been told.
  • "studentQuote" — quote the student's actual words/step that addressed (or failed to address) this point. Empty string if they wrote nothing relevant.

WORKINGS / PRESENTATION CHECK
If the FINAL answer is correct but the student skipped required workings, units, diagrams, or reasoning steps that the curriculum's marking scheme requires:
- Still award the answer mark.
- Populate "workingsFeedback" with a clear warning, e.g. "Final answer is correct, but in a real ${curriculum || "exam"} you would lose method marks here — ZIMSEC O-Level Mathematics requires every algebraic step to be shown. Next time, write line-by-line working before stating the result."
- Reference the specific curriculum convention being violated.

EXAMINER'S VOICE
- "examinerComment": 1–2 sentences as a senior examiner addressing the student directly. Honest, encouraging, specific.
- "improvementByCurriculum": 2–4 concrete, curriculum-grounded next-time tips. Each tip names the curriculum standard or command-word convention it addresses (e.g. "When ZIMSEC asks 'Explain', give a cause-and-effect chain, not a list of facts.").
- "mistakes": specific mistakes the examiner would flag, each tied to a marking point.
- "correctParts": specific things the student did well, each tied to a marking point.

NEVER fall back to a single generic feedback paragraph. The student paid for examiner-grade detail — give it.`
        : "";

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
6. Include the complete model answer for reference.${strictAddendum}

Return ONLY valid JSON in this exact shape:
{
  "score": 4,
  "totalMarks": 6,
  "percentage": 67,
  "feedback": "Overall assessment paragraph.",
  "examinerComment": "As an examiner, I'd say… (1–2 sentences, examiner voice, addressing the student).",
  "mistakes": ["Specific mistake the examiner would flag", "Missing point about…"],
  "correctParts": ["Correctly identified…", "Good use of terminology for…"],
  "modelAnswer": "Complete model answer that would score full marks (with LaTeX where needed)",
  "markBreakdown": [
    {
      "criterion": "Identifies the process",
      "marksAwarded": 1,
      "marksAvailable": 1,
      "comment": "Awarded — correctly stated",
      "whyExpected": "The syllabus requires students to name the process before describing it; without the name the rest of the explanation cannot be credited.",
      "studentQuote": "the process is osmosis"
    },
    {
      "criterion": "Explains mechanism with reference to water potential",
      "marksAwarded": 1,
      "marksAvailable": 2,
      "comment": "Lost 1 mark — partial explanation",
      "whyExpected": "Examiners want the cause-and-effect chain (water potential gradient → net movement) because 'Explain' is testing reasoning, not recall.",
      "studentQuote": "water moves across the membrane"
    }
  ],
  "improvementTips": ["Always name the process before describing it", "Use the command word to guide structure"],
  "improvementByCurriculum": [
    "ZIMSEC 'Explain' questions need cause → effect → consequence — write three linked sentences, not a list.",
    "Always state units in the final line of any calculation; the unit mark is independent of the value mark."
  ],
  "workingsFeedback": "Final answer is correct, but you wrote no intermediate algebraic steps. In the real exam this would lose 2 method marks — write each rearrangement on its own line."
}

If workings/presentation are fine, OMIT "workingsFeedback" entirely. If not in exam-strict mode, "examinerComment", "improvementByCurriculum" and per-row "whyExpected"/"studentQuote" are optional but encouraged.`;

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
        examinerComment: String(result.examinerComment || "").trim(),
        mistakes: normalizeArray(result.mistakes),
        correctParts: normalizeArray(result.correctParts),
        modelAnswer: String(result.modelAnswer || modelAnswer || "").trim(),
        markBreakdown: Array.isArray(result.markBreakdown)
          ? result.markBreakdown.map((row: any) => ({
              criterion: String(row.criterion || "").trim(),
              marksAwarded: Number(row.marksAwarded || 0),
              marksAvailable: Number(row.marksAvailable || 0),
              comment: String(row.comment || "").trim(),
              whyExpected: String(row.whyExpected || "").trim(),
              studentQuote: String(row.studentQuote || "").trim(),
            }))
          : [],
        improvementTips: normalizeArray(result.improvementTips),
        improvementByCurriculum: normalizeArray(result.improvementByCurriculum),
        workingsFeedback: String(result.workingsFeedback || "").trim(),
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
