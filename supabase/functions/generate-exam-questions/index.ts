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

YOUR TASK: Generate ${questionCount} exam-style questions in REAL PAST-PAPER FORMAT for ${subject} — ${topic}.
Return ONLY structured JSON study content. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

These questions must look and feel like they came from an actual exam paper — correct structure, mark allocation, command words, and formatting.

PAPER FORMAT: ${paperFormat === "section_a" ? "Section A (short structured, 2-6 marks each)" : paperFormat === "section_b" ? "Section B (extended response, 8-25 marks each)" : "Mixed (include both short and extended questions)"}

QUESTION STRUCTURE RULES:
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
      "examinerNotes": "Look for: precise terminology, clear reasoning chain"
    }
  ],
  "weak_area_focus": ["areas addressed"],
  "totalMarks": 30,
  "suggestedTime": "45 minutes"
}`;

    // ── User prompt ─────────────────────────────────────────────────────────
    const userPrompt = `Generate ${questionCount} exam-style questions.\n\n${context}

IMPORTANT:
- Make these questions indistinguishable from real past-paper questions.
- Total marks should be realistic (roughly ${questionCount * 8} marks total).
- Provide DETAILED marking schemes — examiners need to know exactly where each mark goes.
- Include step-by-step solutions that teach the student HOW to answer.`;

    // ── Call AI ──────────────────────────────────────────────────────────────
    const rawContent = await callAI(ai, systemPrompt, userPrompt, {
      temperature: 0.5,
      jsonMode: true,
    });

    const parsed = safeJsonParse<{
      exam_questions?: unknown[];
      questions?: unknown[];
      weak_area_focus?: string[];
      totalMarks?: number;
      suggestedTime?: string;
    }>(rawContent);

    const examQuestions = (parsed.exam_questions || parsed.questions || []) as any[];

    if (examQuestions.length === 0) {
      throw new Error("AI returned empty exam questions");
    }

    // ── Normalise ───────────────────────────────────────────────────────────
    const normalised = examQuestions.map((q: any, i: number) => ({
      id: q.id || `eq${i + 1}`,
      questionNumber: q.questionNumber || String(i + 1),
      question: String(q.question || "").trim(),
      parts: Array.isArray(q.parts) ? q.parts : undefined,
      marks: Number(q.marks || q.totalMarks || 0),
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
    }));

    // Build solutions & explanations lookup
    const solutions: Record<string, string> = {};
    const explanations: Record<string, string> = {};
    normalised.forEach((q: any) => {
      solutions[q.id] = q.stepByStepSolution || q.modelAnswer;
      explanations[q.id] = q.explanation;
    });

    const totalMarks = normalised.reduce(
      (sum: number, q: any) => sum + q.marks,
      0
    );

    return jsonResponse({
      exam_questions: normalised,
      solutions,
      explanations,
      weak_area_focus: normalizeArray(parsed.weak_area_focus),
      totalMarks: parsed.totalMarks || totalMarks,
      suggestedTime:
        parsed.suggestedTime || `${Math.round(totalMarks * 1.5)} minutes`,
    });
  } catch (e) {
    console.error("generate-exam-questions error:", e);
    return errorResponse(e);
  }
});
