/**
 * generate-exam-questions Edge Function
 *
 * Generates exam-style questions in real past-paper format with marks allocation,
 * marking schemes, and step-by-step solutions.
 *
 * POST body:
 * {
 *   subject, topic, curriculum?, examLevel?, syllabusContext?, pastPaperContext?,
 *   performanceData?, weakAreas?, notesOrDocuments?, difficulty?,
 *   count? (default 3, max 10), paperFormat?: "section_a" | "section_b" | "mixed"
 * }
 *
 * Returns:
 * {
 *   exam_questions: [{
 *     id, questionNumber, question, parts?, marks, totalMarks,
 *     modelAnswer, stepByStepSolution, markingScheme, difficulty,
 *     commandWord, conceptsTested, syllabusLinks, explanation,
 *     timeAllocation, examinerNotes
 *   }],
 *   solutions: { [questionId]: string },
 *   explanations: { [questionId]: string },
 *   weak_area_focus: string[],
 *   totalMarks: number,
 *   suggestedTime: string
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
} from "../_shared/ai-config.ts";
import { buildProvenance, hashPrompt } from "../_shared/provenance.ts";
import { postProcessQuestions, resolveUserId } from "../_shared/post-process.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";
import { drawFromPool, contributeToPool, QUESTION_BANK_ENABLED } from "../_shared/question-bank.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requireCaller(req, "generate-exam-questions");
    if (gate.response) return gate.response;

    const quota = await enforceQuota(req, "quiz", { userId: gate.caller.userId });
    if (!quota.allowed) return quotaExceededResponse("quiz", quota.used, quota.limit);
    const ai = getAIConfig("standard");
    const body = await req.json();

    const {
      subject,
      topic,
      curriculum,
      examLevel,
      syllabusContext,
      pastPaperContext,
      performanceData,
      weakAreas,
      notesOrDocuments,
      difficulty = "mixed",
      count = 3,
      paperFormat = "mixed",
    } = body;

    if (!subject || !topic) {
      return jsonResponse({ error: "subject and topic are required" }, 400);
    }

    const questionCount = Math.min(Math.max(Number(count) || 3, 1), 10);

    // ── Question-bank pool: serve shared validator-clean questions first ────
    // (no-op unless QUESTION_BANK_ENABLED; excludes stems this user has seen)
    //
    // Personalisation rules — the pool must honour the SAME targeting the AI
    // prompt receives:
    //  • notesOrDocuments present → SKIP the pool: questions must be grounded
    //    in this student's own uploads, which shared questions cannot be.
    //  • weakAreas present → concept-overlap filter: only serve pool questions
    //    whose conceptsTested intersect the student's weak concepts.
    const poolKey = {
      curriculum,
      subject,
      topic,
      examLevel,
      difficulty: difficulty === "mixed" ? null : difficulty,
      surface: "exam_questions",
    };
    const weakAreaList: string[] = Array.isArray(weakAreas)
      ? weakAreas
      : weakAreas
      ? [String(weakAreas)]
      : [];
    const documentGrounded =
      typeof notesOrDocuments === "string" && notesOrDocuments.trim().length > 0;
    const poolHits = documentGrounded
      ? []
      : await drawFromPool({
          key: poolKey,
          count: questionCount,
          userId: gate.caller.userId,
          targeting: {
            targetConcepts: weakAreaList.length > 0 ? weakAreaList : undefined,
          },
        });
    const genCount = questionCount - poolHits.length;

    // ── Build unified context ───────────────────────────────────────────────
    const context = buildStudyModeContext({
      curriculum,
      subject,
      topic,
      examLevel,
      weakAreas,
      notesOrDocuments,
      performanceData,
      syllabusContext,
      pastPaperContext,
      difficulty,
    });

    // ── System prompt ───────────────────────────────────────────────────────
    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Generate ${genCount} exam-style questions in REAL PAST-PAPER FORMAT for ${subject} — ${topic}.
Return ONLY structured JSON study content. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

These questions must look and feel like they came from an actual exam paper — correct structure, mark allocation, command words, and formatting.

${KATEX_RULES}

PAPER FORMAT: ${paperFormat === "section_a" ? "Section A (short structured, 2-6 marks each)" : paperFormat === "section_b" ? "Section B (extended response, 8-25 marks each)" : "Mixed (include both short and extended questions)"}

QUESTION TYPE MIX (CRITICAL):
For each question set "questionType" to one of: "multiple_choice", "short_answer", or "structured".
If the user's paper blueprint or syllabus indicates this paper is multiple-choice (e.g. ZIMSEC Bio Paper 1, IGCSE Maths Paper 1 MCQ, Physics Paper 1), produce mostly multiple_choice questions worth 1 mark each.
For multiple_choice: provide "options" as an array of EXACTLY 4 plain strings WITHOUT "A)" / "B)" prefixes (the UI adds the letters). "correctOption" MUST be one of "A","B","C","D" indexed by position (A=options[0], B=options[1], C=options[2], D=options[3]). Always include "explanation" for why the answer is correct and why distractors are wrong. Marks = 1, no parts.
For structured / short_answer questions, follow the existing rules below.

QUESTION STRUCTURE RULES (for structured / short_answer):
1. Every question MUST have clear mark allocation in brackets: (a) Explain why... [3]
2. Multi-part questions should have sub-parts: (a), (b), (c) with marks for each.
3. Use appropriate exam command words: State, Define, Explain, Describe, Compare, Evaluate, Discuss, Calculate, Justify, Analyse.
4. Higher-mark questions (6+) must require higher-order thinking.
5. Include data/stimulus material where appropriate (tables, graphs, scenarios).
6. Difficulty should increase progressively across questions.

FOR EACH QUESTION PROVIDE:
- Complete model answer (what would score full marks)
- Step-by-step solution (how to arrive at the answer)
- Marking scheme (exactly how marks are allocated, point by point)
- Examiner notes (common mistakes students make, what examiners look for)

VISUALS — INCLUDE WHEN THE CURRICULUM REQUIRES THEM:
If a real past-paper question on this topic would include a diagram, graph, or chart, populate a "visual" field on the question. Otherwise OMIT the field.
Pick exactly ONE "type":
1. "function-graph" (Maths) — { "functions":[{"expression":"x^2-4*x+3"}], "xRange":[-2,6], "gridlines":true, "points":[{"x":1,"y":0,"label":"root"}] }  (mathjs syntax)
2. "data-chart" (data interpretation) — { "chartKind":"bar"|"line"|"scatter", "data":[{"x":"Jan","y":12}], "xLabel":"...", "yLabel":"..." }
3. "svg-diagram" (simple physics circuits / forces / ray diagrams / apparatus) — { "svg":"<svg viewBox='0 0 400 300' xmlns='http://www.w3.org/2000/svg'>...</svg>" }. Only basic SVG tags (line, rect, circle, path, text, polygon, g). Use stroke='currentColor'. NO <script>, NO event handlers.
4. "ai-image" (Biology / anatomy / complex Geography illustrations) — { "imagePrompt":"Black-and-white labeled cross-section of the human heart, A-Level Biology past paper style, four chambers labeled A, B, C, D, line art on white background, no shading." }

Always include "required": true if the student MUST see the visual to answer.
Optional "caption": e.g. "Figure 1: Cross-section of a leaf".

Return ONLY valid JSON:
{
  "exam_questions": [
    {
      "id": "eq1",
      "questionNumber": "1",
      "question": "Full question text including parts (a), (b), etc. with mark allocations [3], [4]",
      "parts": [
        { "part": "a", "text": "State two...", "marks": 2 },
        { "part": "b", "text": "Explain why...", "marks": 4 }
      ],
      "questionType": "structured",
      "options": null,
      "correctOption": null,
      "marks": 6,
      "modelAnswer": "Complete model answer for full marks",
      "stepByStepSolution": "Step 1: ...\\nStep 2: ...\\nStep 3: ...",
      "markingScheme": [
        "(a) 1 mark for each correct statement (max 2)",
        "(b) 1 mark for identifying the concept",
        "(b) 2 marks for explanation with examples",
        "(b) 1 mark for linking to the question context"
      ],
      "difficulty": "medium",
      "commandWord": "explain",
      "conceptsTested": ["concept1"],
      "syllabusLinks": ["2.3 Transport in cells"],
      "explanation": "This tests understanding of... Common mistakes include...",
      "timeAllocation": "8 minutes",
      "examinerNotes": "Look for: precise terminology, clear reasoning chain",
      "visual": { "type":"svg-diagram", "required":true, "caption":"Figure 1", "svg":"<svg ...>...</svg>" }
    }
  ],
  "weak_area_focus": ["areas addressed"],
  "totalMarks": 30,
  "suggestedTime": "45 minutes"
}`;

    // ── User prompt ─────────────────────────────────────────────────────────
    const userPrompt = `Generate ${genCount} exam-style questions.\n\n${context}

IMPORTANT:
- Make these questions indistinguishable from real past-paper questions.
- Total marks should be realistic (roughly ${genCount * 8} marks total).
- Provide DETAILED marking schemes — examiners need to know exactly where each mark goes.
- Include step-by-step solutions that teach the student HOW to answer.`;

    // ── Call AI only for the shortfall the pool couldn't cover ──────────────
    let parsed: {
      exam_questions?: unknown[];
      questions?: unknown[];
      weak_area_focus?: string[];
      totalMarks?: number;
      suggestedTime?: string;
    } = {};
    let examQuestions: any[] = [];
    if (genCount > 0) {
      const rawContent = await callAI(ai, systemPrompt, userPrompt, {
        usage: { userId: quota.userId, bucket: "quiz" },
        temperature: 0.5,
        jsonMode: true,
        maxTokens: 3500,
      });

      parsed = safeJsonParse<typeof parsed>(rawContent);
      examQuestions = (parsed.exam_questions || parsed.questions || []) as any[];

      if (examQuestions.length === 0 && poolHits.length === 0) {
        throw new Error("AI returned empty exam questions");
      }
    }

    // ── Normalise ───────────────────────────────────────────────────────────
    const normalised = examQuestions.map((q: any, i: number) => ({
      id: q.id || `eq${i + 1}`,
      questionNumber: q.questionNumber || String(i + 1),
      question: String(q.question || "").trim(),
      questionType: ["multiple_choice", "short_answer", "structured"].includes(q.questionType)
        ? q.questionType
        : "structured",
      parts: Array.isArray(q.parts) ? q.parts : undefined,
      marks: Number(q.marks || q.totalMarks || 0),
      options: Array.isArray(q.options)
        ? q.options.slice(0, 4).map((o: any) => String(o).replace(/^\s*[A-Da-d][\)\.\:]\s*/, "").trim())
        : undefined,
      correctOption: typeof q.correctOption === "string"
        ? q.correctOption.trim().toUpperCase().charAt(0)
        : undefined,
      modelAnswer: String(q.modelAnswer || "").trim(),
      stepByStepSolution: String(q.stepByStepSolution || "").trim(),
      markingScheme: normalizeArray(q.markingScheme),
      difficulty: ["easy", "medium", "hard"].includes(String(q.difficulty))
        ? q.difficulty
        : "medium",
      commandWord: String(q.commandWord || "").trim(),
      conceptsTested: normalizeArray(q.conceptsTested),
      syllabusLinks: normalizeArray(q.syllabusLinks),
      explanation: String(q.explanation || "").trim(),
      timeAllocation: q.timeAllocation || null,
      examinerNotes: q.examinerNotes || null,
      visual: normalizeVisual(q.visual),
    }));

    const userId = await resolveUserId(req);
    const pp = await postProcessQuestions({
      questions: normalised as any[],
      surface: "exam_questions",
      userId,
      subjectId: body.subject_id ?? null,
    });

    // ── Contribute fresh validator-clean questions to the shared pool ───────
    // (fire-and-forget; no-op unless QUESTION_BANK_ENABLED)
    // Never contribute document-grounded questions: they are written around
    // this student's own uploads and must not be served to anyone else.
    if (!documentGrounded && pp.questions.length > 0) {
      await contributeToPool({
        key: poolKey,
        questions: pp.questions as any[],
        validatorErrors: pp.meta.validator.blocking_errors,
      });
    }


    // ── Merge: pool hits first (cheapest), then fresh AI questions ──────────
    const merged = [
      ...poolHits.map((p, i) => ({ ...(p.payload as any), id: `pool${i + 1}`, fromPool: true })),
      ...(pp.questions as any[]),
    ].map((q: any, i: number) => ({
      ...q,
      id: q.id || `eq${i + 1}`,
      questionNumber: String(i + 1),
    }));

    // Build solutions & explanations lookup over the merged set
    const solutions: Record<string, string> = {};
    const explanations: Record<string, string> = {};
    merged.forEach((q: any) => {
      solutions[q.id] = q.stepByStepSolution || q.modelAnswer;
      explanations[q.id] = q.explanation;
    });

    const totalMarks = merged.reduce(
      (sum: number, q: any) => sum + (Number(q.marks) || 0),
      0
    );

    return jsonResponse({
      exam_questions: merged,
      solutions,
      explanations,
      weak_area_focus: normalizeArray(parsed.weak_area_focus),
      totalMarks: poolHits.length > 0 ? totalMarks : (parsed.totalMarks || totalMarks),
      suggestedTime:
        parsed.suggestedTime || `${Math.round(totalMarks * 1.5)} minutes`,
      generation_meta: buildProvenance({
        fn_name: "generate-exam-questions",
        fn_version: "3",
        model: ai.model,
        prompt_hash: await hashPrompt(`${systemPrompt}\n${userPrompt}`),
        curriculum,
        subject,
        topic,
        weak_area_triggers: Array.isArray(weakAreas) ? weakAreas : weakAreas ? [String(weakAreas)] : [],
        novelty_reason: pp.meta.novelty.enabled ? "fresh" : "unverified",
        validator_warnings: pp.meta.validator.warnings,
        validator_errors: pp.meta.validator.blocking_errors,
        fingerprints: pp.meta.novelty.fingerprints,
        question_bank: QUESTION_BANK_ENABLED
          ? { pool_hits: poolHits.length, generated: pp.questions.length }
          : undefined,
      }),
    });
  } catch (e) {
    console.error("generate-exam-questions error:", e);
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
