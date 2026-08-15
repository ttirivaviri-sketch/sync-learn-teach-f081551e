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
  enforceQuota,
  requireCaller,
  quotaExceededResponse,
  buildCacheKey,
  getCached,
  setCached,
} from "../_shared/ai-config.ts";
import { buildProvenance, hashPrompt } from "../_shared/provenance.ts";
import { postProcessQuestions, resolveUserId } from "../_shared/post-process.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireCaller(req, "generate-quiz");
    if (gate.response) return gate.response;

    const ai = getAIConfig("standard");
    const body = await req.json();

    // ── Per-user daily quota (Moderate tier) ────────────────────────────────
    const quota = await enforceQuota(req, "quiz", { userId: gate.caller.userId, amount: Math.min(Math.max(Number(body.count) || 1, 1), 5) });
    if (!quota.allowed) {
      return quotaExceededResponse("quiz", quota.used, quota.limit);
    }

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
      examMode,
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

${KATEX_RULES}

QUESTION TYPES TO MIX:
• multiple_choice — REQUIRED format: exactly 4 options as a string array WITHOUT "A)" / "B)" prefixes (the UI adds the letters). "correctOption" MUST be one of "A","B","C","D" indexed by position (A=options[0], B=options[1], C=options[2], D=options[3]). Always include "explanation" describing why the correct option is right and why distractors are wrong. Marks are usually 1.
• short_answer — 1–3 sentence response expected
• structured — multi-part question with sub-questions (a), (b), (c), mark allocations per part

QUESTION TYPE SELECTION RULE:
If a TARGET PAPER BLUEPRINT is provided with a "question_type_distribution" (e.g. {"multiple_choice": 40, "structured": 60}), pick "questionType" so that across many generations the mix matches that distribution. For a single-question request, weight your random pick by those percentages — if multiple_choice is ≥30%, often produce multiple_choice. Subjects/papers with high MCQ share (Biology Paper 1, IGCSE Maths Paper 1 MCQ, Physics Paper 1) MUST receive multiple_choice questions accordingly. Never default to "structured" when the blueprint says otherwise.

VISUALS — INCLUDE WHEN THE CURRICULUM REQUIRES THEM:
${examMode ? `EXAM MODE IS ACTIVE. This question will appear in a timed exam simulation. If the topic conventionally appears with a diagram / graph / figure / chart in real past papers for this curriculum (Maths function graphs and geometry, Physics circuits / forces / ray / wave diagrams, Biology labelled diagrams of cells / organs / processes, Chemistry apparatus or reaction schemes, Geography climate graphs / contour or sketch maps, Economics demand-supply curves), you MUST populate the "visual" field. A real exam paper for this topic almost always includes a figure — do not omit it. Pick the most appropriate visual type below.` : `If the topic typically includes a diagram, graph, or chart in past papers (Maths function graphs, Physics circuits/forces/ray diagrams, Biology cell/anatomy/process diagrams, Chemistry apparatus, Geography climate/contour/sketch maps), populate a "visual" field on the question. Otherwise OMIT the field entirely.`}

Pick exactly ONE "type":
1. "function-graph" — for plotting mathematical functions y = f(x). Provide:
     "functions": [{"expression":"x^2 - 4*x + 3","color":"#3b82f6"}]   (mathjs syntax: use *, /, ^, sin(x), cos(x), sqrt(x), log(x))
     "xRange": [-2, 6], "yRange": [-5, 10] (optional), "gridlines": true,
     "points": [{"x":1,"y":0,"label":"root"}] (optional)
2. "data-chart" — for data interpretation (climate graphs, V-I curves, population data). Provide:
     "chartKind": "bar" | "line" | "scatter",
     "data": [{"x":"Jan","y":12},{"x":"Feb","y":15}, ...],
     "xLabel": "Month", "yLabel": "Rainfall (mm)"
3. "svg-diagram" — for SIMPLE labeled schematics you can author directly (circuits, force diagrams, ray diagrams, simple apparatus). Provide:
     "svg": "<svg viewBox='0 0 400 300' xmlns='http://www.w3.org/2000/svg'>...</svg>"
     Use only basic SVG: <line>, <rect>, <circle>, <path>, <text>, <polygon>, <g>. No <script>, no event handlers, no external images.
     Use stroke='currentColor' and fill='currentColor' or 'none' so the diagram inherits theme color.
     Keep viewBox around 400x300, label all components with <text>.
4. "ai-image" — for COMPLEX biological / anatomical / geographical illustrations that can't be cleanly authored as data or simple SVG (heart cross-section, plant cell, kidney nephron, river meander, contour map). Provide:
     "imagePrompt": "Detailed description in past-paper style. Example: 'Black-and-white labeled cross-section of the human heart, A-Level Biology past paper style, four chambers labeled A, B, C, D with leader lines, line art on white background, no shading.'"
     The client renders this via an image generation pipeline.

Always include "required": true if the student MUST see the visual to answer; false if the visual just aids understanding.
Optional "caption": e.g. "Figure 1: Series circuit with two resistors".

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
      "options": ["first option text", "second option text", "third option text", "fourth option text"],
      "correctOption": "B",
      "modelAnswer": "complete model answer with LaTeX math",
      "stepByStepSolution": "step 1: …\\nstep 2: …\\nstep 3: …",
      "markingScheme": ["1 mark for identifying…", "2 marks for explaining…"],
      "keyPoints": ["key point 1", "key point 2"],
      "difficulty": "easy|medium|hard",
      "commandWord": "explain",
      "conceptsTested": ["concept1", "concept2"],
      "syllabusLinks": ["specific syllabus objective"],
      "explanation": "why this answer is correct and common mistakes",
      "visual": { "type": "function-graph", "required": true, "caption": "...", "functions": [...] }
    }
  ],
  "weak_area_focus": ["weak area addressed 1", "weak area addressed 2"]
}

For non-multiple-choice questions, omit "options" and "correctOption".
OMIT "visual" entirely for pure-text questions (English essays, history accounts, etc.).`;

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

    if (paperBlueprint && typeof paperBlueprint === "object") {
      userPrompt += `\n\n=== TARGET PAPER BLUEPRINT ===\n`;
      if (paperBlueprint.paper_code) userPrompt += `Paper: ${paperBlueprint.paper_code}\n`;
      if (paperBlueprint.total_marks) userPrompt += `Total marks: ${paperBlueprint.total_marks}\n`;
      if (paperBlueprint.duration_minutes)
        userPrompt += `Duration: ${paperBlueprint.duration_minutes} min\n`;
      if (paperBlueprint.question_type_distribution) {
        userPrompt += `Question type mix: ${JSON.stringify(paperBlueprint.question_type_distribution)}\n`;
      }
      if (paperBlueprint.command_word_frequency) {
        userPrompt += `Common command words: ${Object.keys(paperBlueprint.command_word_frequency).slice(0, 8).join(", ")}\n`;
      }
      userPrompt += `Match this paper's style: question length, mark allocation, command-word distribution.\n`;
    }

    if (Array.isArray(pastPaperExemplars) && pastPaperExemplars.length > 0) {
      userPrompt += `\n\n=== PAST-PAPER EXEMPLARS (real Q + official mark scheme — DO NOT COPY VERBATIM, mirror the style) ===\n`;
      pastPaperExemplars.slice(0, 2).forEach((ex: any, i: number) => {
        userPrompt += `\n--- Exemplar ${i + 1} ---\n`;
        if (ex.question_number) userPrompt += `Q${ex.question_number} `;
        if (ex.marks) userPrompt += `[${ex.marks} marks] `;
        if (ex.command_word || ex.official_command_word)
          userPrompt += `(${ex.command_word || ex.official_command_word}) `;
        userPrompt += `\n`;
        if (ex.question) userPrompt += `Question: ${ex.question}\n`;
        if (ex.model_answer) userPrompt += `Model answer: ${ex.model_answer}\n`;
        if (Array.isArray(ex.marking_points) && ex.marking_points.length > 0) {
          userPrompt += `Marking points:\n${ex.marking_points.map((m: string) => `  • ${m}`).join("\n")}\n`;
        }
      });
      userPrompt += `\nGenerate a NEW question in this same style, of similar mark value, with an examiner-grade marking scheme.\n`;
    }

    // ── Call AI (with capped output tokens) ─────────────────────────────────
    const rawContent = await callAI(ai, systemPrompt, userPrompt, {
      usage: { userId: quota.userId, bucket: "quiz" },
      temperature: 0.5,
      jsonMode: true,
      maxTokens: questionCount === 1 ? 1500 : 3500,
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
      options: Array.isArray(item.options)
        ? item.options
            .slice(0, 4)
            .map((o: any) => String(o).replace(/^\s*[A-Da-d][\)\.\:]\s*/, "").trim())
        : undefined,
      correctOption: typeof item.correctOption === "string"
        ? item.correctOption.trim().toUpperCase().charAt(0)
        : undefined,
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
      visual: normalizeVisual(item.visual),
    }));

    // Validate
    const valid = quiz.filter(
      (q: any) => q.question && q.marks > 0
    );
    if (valid.length === 0) {
      throw new Error("Generated quiz payload is incomplete");
    }

    // ── Post-process: validators + novelty engine ───────────────────────────
    const userId = await resolveUserId(req);
    const pp = await postProcessQuestions({
      questions: valid as any[],
      surface: "quiz",
      userId,
      subjectId: body.subject_id ?? null,
    });

    // ── For backward compat: if count === 1, also flatten top-level fields ─
    const response: Record<string, unknown> = {
      quiz: pp.questions,
      weak_area_focus: normalizeArray(parsed.weak_area_focus),
    };

    // Backward-compat: flatten first question's fields at top level
    if (pp.questions.length === 1) {
      const q = pp.questions[0] as any;
      response.question = q.question;
      response.marks = q.marks;
      response.modelAnswer = q.modelAnswer;
      response.keyPoints = q.keyPoints;
      response.difficulty = q.difficulty;
      response.commandWords = q.commandWord ? [q.commandWord] : [];
      response.conceptsTested = q.conceptsTested;
      response.syllabusLinks = q.syllabusLinks;
    }

    response.generation_meta = buildProvenance({
      fn_name: "generate-quiz",
      fn_version: "3",
      model: ai.model,
      prompt_hash: await hashPrompt(`${systemPrompt}\n${userPrompt}`),
      curriculum,
      subject,
      topic,
      weak_area_triggers: Array.isArray(weakAreas) ? weakAreas : weakAreas ? [String(weakAreas)] : [],
      past_paper_style_source: pastPaperStyleNotes ? "past_paper_exemplars" : undefined,
      paper_blueprint_id: paperBlueprint?.id,
      novelty_reason: pp.meta.novelty.enabled ? "fresh" : "unverified",
      validator_warnings: pp.meta.validator.warnings,
      validator_errors: pp.meta.validator.blocking_errors,
      fingerprints: pp.meta.novelty.fingerprints,
    });
    return jsonResponse(response);
  } catch (e) {
    console.error("generate-quiz error:", e);
    return errorResponse(e);
  }
});

// ─── Visual normaliser ──────────────────────────────────────────────────────
function normalizeVisual(v: any): any | undefined {
  if (!v || typeof v !== "object") return undefined;
  const allowed = ["function-graph", "data-chart", "svg-diagram", "ai-image"];
  if (!allowed.includes(v.type)) return undefined;
  const out: any = { type: v.type, required: !!v.required };
  if (typeof v.caption === "string") out.caption = v.caption.trim();

  if (v.type === "function-graph") {
    if (Array.isArray(v.functions)) {
      out.functions = v.functions
        .filter((f: any) => f && typeof f.expression === "string")
        .map((f: any) => ({
          expression: f.expression,
          color: typeof f.color === "string" ? f.color : undefined,
          domain: Array.isArray(f.domain) && f.domain.length === 2 ? f.domain : undefined,
        }));
    }
    if (Array.isArray(v.xRange) && v.xRange.length === 2) out.xRange = v.xRange;
    if (Array.isArray(v.yRange) && v.yRange.length === 2) out.yRange = v.yRange;
    if (typeof v.gridlines === "boolean") out.gridlines = v.gridlines;
    if (Array.isArray(v.points)) out.points = v.points;
  } else if (v.type === "data-chart") {
    if (["bar", "line", "scatter"].includes(v.chartKind)) out.chartKind = v.chartKind;
    if (Array.isArray(v.data)) out.data = v.data;
    if (typeof v.xLabel === "string") out.xLabel = v.xLabel;
    if (typeof v.yLabel === "string") out.yLabel = v.yLabel;
  } else if (v.type === "svg-diagram") {
    if (typeof v.svg === "string" && v.svg.includes("<svg")) out.svg = v.svg;
    else return undefined;
  } else if (v.type === "ai-image") {
    if (typeof v.imagePrompt === "string" && v.imagePrompt.length > 10) {
      out.imagePrompt = v.imagePrompt;
    } else return undefined;
  }
  return out;
}
