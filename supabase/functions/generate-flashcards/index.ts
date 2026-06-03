/**
 * generate-flashcards Edge Function (v2)
 *
 * Generates curriculum-aligned flashcards covering:
 *   - Key definitions and terminology
 *   - Formulas and core concepts
 *   - Exam-style prompts with command words
 *
 * POST body:
 * {
 *   subject, topic, syllabusContext?, pastPaperContext?,
 *   count? (default 8, max 20), difficulty?, curriculum?,
 *   examLevel?, weakAreas?, notesOrDocuments?, performanceData?
 * }
 *
 * Returns:
 * {
 *   flashcards: [{
 *     id, front, back, hint, topic, subject, difficulty, tags,
 *     conceptType, syllabusLink
 *   }],
 *   count: number,
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
  quotaExceededResponse,
} from "../_shared/ai-config.ts";
import { buildProvenance, hashPrompt } from "../_shared/provenance.ts";
import { postProcessQuestions, resolveUserId } from "../_shared/post-process.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const quota = await enforceQuota(req, "flashcards");
    if (!quota.allowed) return quotaExceededResponse("flashcards", quota.used, quota.limit);
    const ai = getAIConfig("cheap");
    const body = await req.json();

    const {
      subject,
      topic,
      syllabusContext = "",
      pastPaperContext = "",
      count = 8,
      difficulty = "mixed",
      curriculum,
      examLevel,
      weakAreas,
      notesOrDocuments,
      performanceData,
    } = body;

    if (!subject || !topic) {
      return jsonResponse({ error: "subject and topic are required" }, 400);
    }

    const cardCount = Math.min(Math.max(Number(count) || 8, 4), 20);

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

YOUR TASK: Create ${cardCount} high-quality flashcards for ${subject} — ${topic}.
Return ONLY structured JSON study content. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

FLASHCARD CATEGORIES (mix all of these):
• definition — Key definitions and terminology from the syllabus
• formula — Important formulas, equations, or processes
• concept — Core concepts, relationships, and principles
• exam_prompt — Past-paper style prompts using exam command words (define, explain, compare, etc.)
• application — Real-world applications or worked examples

RULES:
1. "front" = the question, prompt, or concept name (exam-style phrasing where possible).
2. "back" = concise, accurate, exam-scoring answer or definition.
3. "hint" = a memory aid, mnemonic, or key phrase (keep short, nullable).
4. "conceptType" = one of: definition, formula, concept, exam_prompt, application.
5. "syllabusLink" = the specific syllabus objective this card addresses.
6. Ground every card in the syllabus and past-paper patterns provided.
7. If weak areas are specified, create extra cards targeting those concepts.
8. No vague or generic cards — every card must test specific examinable knowledge.

${KATEX_RULES}

Return ONLY valid JSON:
{
  "flashcards": [
    {
      "front": "Define osmosis.",
      "back": "The net movement of water molecules from a region of higher water potential to a region of lower water potential through a partially permeable membrane.",
      "hint": "Water moves TO where there's less water",
      "difficulty": "easy",
      "tags": ["osmosis", "transport", "cell membrane"],
      "conceptType": "definition",
      "syllabusLink": "2.1 Cell membrane transport"
    }
  ],
  "weak_area_focus": ["concept addressed from weak areas"]
}`;

    // ── User prompt ─────────────────────────────────────────────────────────
    const userPrompt = `Create ${cardCount} flashcards with difficulty mix: ${difficulty}.\n\n${context}

ENSURE COVERAGE:
- At least ${Math.ceil(cardCount * 0.25)} definition cards (key terms)
- At least ${Math.ceil(cardCount * 0.2)} formula/process cards (where applicable)
- At least ${Math.ceil(cardCount * 0.25)} exam-prompt cards (command word style)
- At least ${Math.ceil(cardCount * 0.15)} concept/application cards
${weakAreas ? `- Extra focus on weak areas: ${Array.isArray(weakAreas) ? weakAreas.join(", ") : weakAreas}` : ""}`;

    // ── Call AI ──────────────────────────────────────────────────────────────
    const rawContent = await callAI(ai, systemPrompt, userPrompt, {
      temperature: 0.5,
      jsonMode: true,
      maxTokens: 1800,
    });

    const parsed = safeJsonParse<{
      flashcards?: unknown[];
      cards?: unknown[];
      weak_area_focus?: string[];
    }>(rawContent);

    let flashcards: any[] =
      parsed.flashcards || parsed.cards || (Array.isArray(parsed) ? parsed : []);

    // ── Normalise each card ─────────────────────────────────────────────────
    flashcards = flashcards.map((card: any, i: number) => ({
      id: card.id || `${topic.toLowerCase().replace(/\s+/g, "-")}-${i + 1}`,
      front: String(card.front || card.question || card.term || "").trim(),
      back: String(card.back || card.answer || card.definition || "").trim(),
      hint: card.hint || card.memory_aid || null,
      topic,
      subject,
      difficulty: ["easy", "medium", "hard"].includes(card.difficulty)
        ? card.difficulty
        : "medium",
      tags: Array.isArray(card.tags) ? card.tags : [],
      conceptType: card.conceptType || "concept",
      syllabusLink: card.syllabusLink || null,
    }));

    // Filter out empty cards
    flashcards = flashcards.filter((c: any) => c.front && c.back);

    // Run post-processor on flashcard fronts as the "stem".
    const userId = await resolveUserId(req);
    const ppInput = flashcards.map((c) => ({ ...c, question: c.front }));
    const pp = await postProcessQuestions({
      questions: ppInput as any[],
      surface: "flashcards",
      userId,
      subjectId: body.subject_id ?? null,
    });
    const finalCards = pp.questions.map(({ question: _q, ...rest }: any) => rest);

    return jsonResponse({
      flashcards: finalCards,
      count: finalCards.length,
      weak_area_focus: normalizeArray(parsed.weak_area_focus),
      generation_meta: buildProvenance({
        fn_name: "generate-flashcards",
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
      }),
    });
  } catch (err: unknown) {
    console.error("[generate-flashcards]", err);
    return errorResponse(err);
  }
});
