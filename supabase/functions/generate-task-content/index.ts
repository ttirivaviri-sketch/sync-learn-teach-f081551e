/**
 * generate-task-content Edge Function (v3)
 *
 * Generates rich study task content (micro-revision, concept-learning, active-recall,
 * exam-question, flashcards, summary, revision-checklist) using the unified context.
 *
 * Returns a streaming SSE response for real-time rendering.
 *
 * POST body:
 * {
 *   taskType, subject, topic, subtopics?, examWeight?,
 *   curriculumContext?, performanceContext?, masteryStatus?,
 *   difficulty?, curriculum?, examLevel?, weakAreas?,
 *   notesOrDocuments?, pastPaperContext?
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAIConfig,
  buildStudyModeContext,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  errorResponse,
} from "../_shared/ai-config.ts";

// ─── Task-specific prompt extensions ─────────────────────────────────────────

const GLOBAL_ALIGNMENT = `
Always align to the provided syllabus context and past-paper patterns.
- Reinforce learning objectives and core examinable concepts.
- Mirror exam language (command words, mark-style phrasing), but do not copy questions verbatim.
- Keep output practical, exam-focused, and age/level appropriate.
- If weak areas are mentioned, prioritise those in your output.
`;

const TASK_PROMPTS: Record<string, string> = {
  "micro-revision": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create a quick micro-revision session (2-3 minutes).

FORMAT:
1. One-sentence topic refresher
2. 2-3 focused review questions with brief model answers
3. One "exam tip" related to this topic

Use markdown formatting. Be concise but exam-relevant.

${GLOBAL_ALIGNMENT}`,

  "concept-learning": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create a concept deep-dive lesson.

FORMAT:
1. WHY this concept matters (exam relevance, weighting)
2. Step-by-step explanation with simple language, analogies, and diagrams described in text
3. Worked example (exam-style where possible)
4. Common exam mistakes to avoid
5. 2 key takeaways for the exam

Use markdown with clear headers. Ground in syllabus objectives.

${GLOBAL_ALIGNMENT}`,

  "active-recall": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create an active recall exercise.

FORMAT:
- 5-6 questions of increasing difficulty
- At least 3 questions in past-paper command-word style (define, explain, compare, calculate, justify)
- Questions mapped to specific syllabus subtopics
- Clear model answers for each
- Format: **Question → Model Answer**

Use markdown formatting.

${GLOBAL_ALIGNMENT}`,

  "exam-question": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Generate ONE realistic exam-style question.

FORMAT:
- Clear mark allocation in brackets [3]
- Tests higher-order thinking where possible
- Detailed marking scheme (point by point)
- Uses command words and structure seen in past papers
- Ends with a "Syllabus link" line

Use markdown formatting.

${GLOBAL_ALIGNMENT}`,

  "flashcards": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create 8 study flashcards.

RULES:
- At least 4 cards should be past-paper style prompts using command words
- At least 4 cards should target key definitions/formulas/concepts from syllabus
- Keep answers concise and exam-scoring focused
- Format: **Front:** ... | **Back:** ...

Use markdown formatting.

${GLOBAL_ALIGNMENT}`,

  "summary": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create an exam-focused topic summary.

FORMAT:
1. ALL key points an examiner would expect
2. Definitions, formulas, key terms in **bold**
3. "Common Exam Questions" section with past-paper-like question stems
4. Quick self-test (3 questions)

Use markdown with clear organisation.

${GLOBAL_ALIGNMENT}`,

  "revision-checklist": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create a revision checklist.

FORMAT:
- Checkboxes (- [ ]) for each item
- Grouped by sub-topic
- High-priority items marked with star
- Include "I can explain..." and "I can calculate..." items
- Include at least 2 "past-paper practice" checklist items

Use markdown formatting.

${GLOBAL_ALIGNMENT}`,
};

// ─── Handler ─────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const body = await req.json();

    const {
      taskType,
      subject,
      topic,
      subtopics,
      examWeight,
      curriculumContext,
      performanceContext,
      masteryStatus,
      difficulty,
      curriculum,
      examLevel,
      weakAreas,
      notesOrDocuments,
      pastPaperContext,
    } = body;

    if (!taskType || !subject || !topic) {
      return new Response(
        JSON.stringify({
          error: "taskType, subject, and topic are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Select system prompt ──────────────────────────────────────────────
    const systemPrompt =
      TASK_PROMPTS[taskType] || TASK_PROMPTS["concept-learning"];

    // ── Build unified context ─────────────────────────────────────────────
    const context = buildStudyModeContext({
      curriculum,
      subject,
      topic,
      examLevel,
      weakAreas,
      notesOrDocuments,
      performanceData: performanceContext,
      syllabusContext: curriculumContext,
      pastPaperContext,
      examWeight,
      subtopics,
      difficulty,
      masteryStatus,
    });

    const userPrompt = `Generate ${taskType} content for the topic "${topic}" in ${subject}.\n\n${context}`;

    // ── Make streaming request to AI API ──────────────────────────────────
    const aiResponse = await fetch(ai.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ai.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return errorResponse("RATE_LIMIT", 429);
      }
      if (aiResponse.status === 402) {
        return errorResponse("CREDITS_EXHAUSTED", 402);
      }
      const errText = await aiResponse.text();
      console.error("AI stream error:", aiResponse.status, errText);
      return errorResponse(`AI API error: ${aiResponse.status}`);
    }

    // Pass through the AI streaming response directly
    // The AI API returns SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
    return new Response(aiResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (e) {
    console.error("generate-task-content error:", e);
    return errorResponse(e);
  }
});
