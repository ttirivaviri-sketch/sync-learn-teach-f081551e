/**
 * generate-quiz Edge Function (v2)
 *
 * Generates personalised quiz questions — multiple-choice, short answer, or
 * structured — grounded in syllabus data and past-paper patterns.
 *
 * POST body:
 * {
 *   subject, topic, topicContext?, curriculumContext?, examWeight?,
 *   preferredQuestionType?, avoidQuestionTypes?, performanceContext?,
 *   difficulty?, pastPaperStyleNotes?, weakAreas?, curriculum?, examLevel?,
 *   notesOrDocuments?, count?: number (default 1, max 5)
 * }
 *
 * Returns:
 * {
 *   quiz: [{
 *     id, question, questionType, marks, modelAnswer, stepByStepSolution,
 *     markingScheme, keyPoints, difficulty, commandWord,
 *     conceptsTested, syllabusLinks, explanation, options?
 *   }],
 *   weak_area_focus: string[]
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const body = await req.json();

    const {
      subject,
      topic,
      topicContext,
      curriculumContext,
      examWeight,
      preferredQuestionType,
      avoidQuestionTypes,
      performanceContext,
      difficulty,
      pastPaperStyleNotes,
      weakAreas,
      curriculum,
      examLevel,
      notesOrDocuments,
      pastPaperExemplars,
      paperBlueprint,
      count = 1,
    } = body;

    if (!subject || !topic) {
      return jsonResponse({ error: "subject and topic are required" }, 400);
    }

    const questionCount = Math.min(Math.max(Number(count) || 1, 1), 5);

    // ── Build unified context ───────────────────────────────────────────────
    const context = buildStudyModeContext({
      curriculum,
      subject,
      topic,
      examLevel,
      weakAreas,
      notesOrDocuments,
      performanceData: performanceContext,
      syllabusContext: curriculumContext || topicContext,
      pastPaperContext: pastPaperStyleNotes,
      examWeight,
      difficulty,
    });

    // ── System prompt ───────────────────────────────────────────────────────
    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Generate ${questionCount} high-quality, exam-style quiz question(s) for ${subject} — ${topic}.
Return ONLY structured JSON study content. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

MATHEMATICAL NOTATION (CRITICAL):
- For ALL mathematical expressions, use LaTeX notation wrapped in dollar signs.
- Inline math: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\sin\\theta$
- Display math: $$y = mx + c$$
- NEVER write x^2, x_1, sqrt(x) in plain text — always use LaTeX.
- Use proper symbols: $\\times$, $\\div$, $\\leq$, $\\geq$, $\\neq$
- Fractions: $\\frac{numerator}{denominator}$
- Greek letters: $\\alpha$, $\\beta$, $\\theta$, $\\pi$

QUESTION TYPES TO MIX:
• multiple_choice — 4 options (A–D), one correct, with explanation for each distractor
• short_answer — 1–3 sentence response expected
• structured — multi-part question with sub-questions (a), (b), (c), mark allocations per part

RULES:
1. Anchor every question to the syllabus outline and topic scope.
2. Mimic past-paper patterns: command words, mark allocations, structure.
3. Prefer applied, reasoning-heavy questions over pure recall.
4. If weak areas are provided, target those concepts.
5. NEVER copy any past-paper question verbatim.
6. Difficulty should increase progressively when generating multiple questions.
7. For each question provide: correct answer, step-by-step solution, marking scheme, and explanation.

Return ONLY valid JSON matching this exact schema:
{
  "quiz": [
    {
      "id": "q1",
      "question": "full question text with LaTeX math notation",
      "questionType": "multiple_choice|short_answer|structured",
      "marks": 6,
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctOption": "B",
      "modelAnswer": "complete model answer with LaTeX math",
      "stepByStepSolution": "step 1: …\\nstep 2: …\\nstep 3: …",
      "markingScheme": ["1 mark for identifying…", "2 marks for explaining…"],
      "keyPoints": ["key point 1", "key point 2"],
      "difficulty": "easy|medium|hard",
      "commandWord": "explain",
      "conceptsTested": ["concept1", "concept2"],
      "syllabusLinks": ["specific syllabus objective"],
      "explanation": "why this answer is correct and common mistakes"
    }
  ],
  "weak_area_focus": ["weak area addressed 1", "weak area addressed 2"]
}

For non-multiple-choice questions, omit "options" and "correctOption".`;

    // ── User prompt ─────────────────────────────────────────────────────────
    let userPrompt = `Generate ${questionCount} exam-style question(s).\n\n${context}`;

    if (preferredQuestionType) {
      userPrompt += `\nPreferred question type: ${preferredQuestionType}`;
    }
    if (
      Array.isArray(avoidQuestionTypes) &&
      avoidQuestionTypes.length > 0
    ) {
      userPrompt += `\nAvoid these recent question types: ${avoidQuestionTypes.join(", ")}`;
    }

    // ── Call AI ──────────────────────────────────────────────────────────────
    const rawContent = await callAI(ai, systemPrompt, userPrompt, {
      temperature: 0.5,
      jsonMode: true,
    });

    const parsed = safeJsonParse<{
      quiz?: unknown[];
      weak_area_focus?: string[];
      question?: string;
    }>(rawContent);

    // Handle both array and single-question responses
    let quizItems: unknown[] = [];
    if (parsed.quiz && Array.isArray(parsed.quiz)) {
      quizItems = parsed.quiz;
    } else if (parsed.question) {
      // AI returned a flat question object
      quizItems = [parsed];
    }

    if (quizItems.length === 0) {
      throw new Error("AI returned empty quiz");
    }

    // ── Normalise each question ─────────────────────────────────────────────
    const quiz = quizItems.map((item: any, i: number) => ({
      id: item.id || `q${i + 1}`,
      question: String(item.question || "").trim(),
      questionType: ["multiple_choice", "short_answer", "structured"].includes(
        item.questionType
      )
        ? item.questionType
        : "structured",
      marks: Number(item.marks || 0),
      options: item.options || undefined,
      correctOption: item.correctOption || undefined,
      modelAnswer: String(item.modelAnswer || "").trim(),
      stepByStepSolution: String(item.stepByStepSolution || "").trim(),
      markingScheme: normalizeArray(item.markingScheme),
      keyPoints: normalizeArray(item.keyPoints),
      difficulty: ["easy", "medium", "hard"].includes(String(item.difficulty))
        ? item.difficulty
        : difficulty || "medium",
      commandWord: String(item.commandWord || item.commandWords?.[0] || "").trim(),
      conceptsTested: normalizeArray(item.conceptsTested),
      syllabusLinks: normalizeArray(item.syllabusLinks),
      explanation: String(item.explanation || "").trim(),
    }));

    // Validate
    const valid = quiz.filter(
      (q: any) => q.question && q.marks > 0
    );
    if (valid.length === 0) {
      throw new Error("Generated quiz payload is incomplete");
    }

    // ── For backward compat: if count === 1, also flatten top-level fields ─
    const response: Record<string, unknown> = {
      quiz: valid,
      weak_area_focus: normalizeArray(parsed.weak_area_focus),
    };

    // Backward-compat: flatten first question's fields at top level
    if (valid.length === 1) {
      const q = valid[0] as any;
      response.question = q.question;
      response.marks = q.marks;
      response.modelAnswer = q.modelAnswer;
      response.keyPoints = q.keyPoints;
      response.difficulty = q.difficulty;
      response.commandWords = q.commandWord ? [q.commandWord] : [];
      response.conceptsTested = q.conceptsTested;
      response.syllabusLinks = q.syllabusLinks;
    }

    return jsonResponse(response);
  } catch (e) {
    console.error("generate-quiz error:", e);
    return errorResponse(e);
  }
});
