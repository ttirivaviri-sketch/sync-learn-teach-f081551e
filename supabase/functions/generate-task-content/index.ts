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

MATHEMATICAL NOTATION:
- For ALL mathematical expressions, use LaTeX notation wrapped in dollar signs.
- Inline math: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\sin\\theta$
- Display math (for important equations): $$y = mx + c$$
- NEVER write x^2, x_1, sqrt(x) in plain text — always use LaTeX: $x^2$, $x_1$, $\\sqrt{x}$
- Use proper symbols: $\\times$ not x, $\\div$ not /, $\\leq$ not <=, $\\geq$ not >=, $\\neq$ not !=
- Fractions: $\\frac{numerator}{denominator}$ not numerator/denominator
- Greek letters: $\\alpha$, $\\beta$, $\\theta$, $\\pi$, $\\Delta$
- Subscripts/superscripts: $x_1$, $x^2$, $a_{n+1}$

OUTPUT FORMAT:
- Return ONLY clean, structured study content using markdown.
- Do NOT return HTML, CSS, JavaScript, JSX, or any website code.
- Do NOT return <div>, <html>, <script> or any markup tags.
- If your response includes HTML or code, it is incorrect — return only study content.
`;

const TASK_PROMPTS: Record<string, string> = {
  "micro-revision": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create a quick micro-revision session (2-3 minutes).

FORMAT:
## Topic Refresher
[One-sentence refresher]

## Quick Review Questions
1. [Question]
   **Answer:** [Brief model answer]
2. [Question]
   **Answer:** [Brief model answer]
3. [Question]
   **Answer:** [Brief model answer]

## Exam Tip
[One practical exam tip related to this topic]

Use markdown formatting. Be concise but exam-relevant.

${GLOBAL_ALIGNMENT}`,

  "concept-learning": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create a concept deep-dive lesson.

IMPORTANT — SUBTOPIC DIVERSIFICATION:
- You MUST focus on a DIFFERENT subtopic each time this task is generated.
- If "previouslyStudiedSubtopics" are provided, you MUST NOT repeat those subtopics. Choose a subtopic that has NOT been covered yet.
- If all subtopics have been covered, revisit the weakest or least-recently-studied one with a fresh angle (different examples, deeper application, exam edge cases).
- Pick ONE specific subtopic and go deep rather than giving a shallow overview of the whole topic.
- State which subtopic you are covering at the top of your response.

FORMAT:
## Subtopic Focus: [Specific subtopic name]

## Why This Matters
[Exam relevance, weighting, how often it appears]

## Explanation
[Step-by-step explanation with simple language, analogies, and diagrams described in text]

## Worked Example
[Exam-style worked example with solution]

## Common Exam Mistakes
- [Mistake 1 and how to avoid it]
- [Mistake 2 and how to avoid it]

## Key Takeaways
1. [Takeaway 1]
2. [Takeaway 2]

Use markdown with clear headers. Ground in syllabus objectives.

${GLOBAL_ALIGNMENT}`,

  "active-recall": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create an active recall exercise.

FORMAT:
## Active Recall: [Topic]

**Q1.** [Question — easy] [command word]
**Answer:** [Model answer]
**Syllabus link:** [Specific subtopic]

**Q2.** [Question — easy/medium]
**Answer:** [Model answer]
**Syllabus link:** [Specific subtopic]

[Continue for 5-6 questions of increasing difficulty]

RULES:
- At least 3 questions must use past-paper command words (define, explain, compare, calculate, justify)
- Each question mapped to a specific syllabus subtopic
- Clear, concise model answers for each

Use markdown formatting.

${GLOBAL_ALIGNMENT}`,

  "exam-question": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Generate ONE realistic exam-style question.

FORMAT:
## Exam Question
[Full question text with mark allocation in brackets, e.g. [3]]

## Marking Scheme
- [Point 1: 1 mark for...]
- [Point 2: 1 mark for...]

## Model Answer
[Complete answer that would score full marks]

## Step-by-Step Solution
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Syllabus Link:** [Specific syllabus objective]
**Command Word:** [e.g. Explain, Calculate, Evaluate]

Use markdown formatting.

${GLOBAL_ALIGNMENT}`,

  "flashcards": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create 8 study flashcards.

FORMAT:
## Flashcards: [Topic]

1. **Front:** [Question/Term/Prompt]
   **Back:** [Answer/Definition]

2. **Front:** [Question/Term/Prompt]
   **Back:** [Answer/Definition]

[Continue for 8 flashcards]

RULES:
- At least 4 cards should be past-paper style prompts using command words
- At least 4 cards should target key definitions/formulas/concepts from syllabus
- Keep answers concise and exam-scoring focused

Use markdown formatting.

${GLOBAL_ALIGNMENT}`,

  "summary": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create an exam-focused topic summary.

FORMAT:
## Topic Summary: [Topic Name]

### Overview
[Clear explanation of the topic]

### Key Concepts
- **[Term 1]:** [Definition]
- **[Term 2]:** [Definition]
- **[Formula]:** [Formula with explanation]

### Important Points
1. [Key point an examiner would expect]
2. [Key point]
3. [Key point]

### Common Exam Questions
- [Past-paper-like question stem 1]
- [Past-paper-like question stem 2]

### Quick Self-Test
1. [Question]
2. [Question]
3. [Question]

Use markdown with clear organisation.

${GLOBAL_ALIGNMENT}`,

  "revision-checklist": `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Create a revision checklist.

FORMAT:
## Revision Checklist: [Topic Name]

### [Sub-topic 1]
- [ ] I can define [key term]
- [ ] I can explain [concept]
- [ ] I can calculate [formula/process]
- [ ] \u2B50 [High-priority item]

### [Sub-topic 2]
- [ ] I can...
- [ ] I can...

### Past Paper Practice
- [ ] Completed practice question on [specific area]
- [ ] Reviewed marking scheme for [specific area]

RULES:
- Group items by sub-topic
- Mark high-priority items with \u2B50
- Include "I can explain..." and "I can calculate..." items
- Include at least 2 past-paper practice items

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
      previouslyStudiedSubtopics,
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

    let userPrompt = `Generate ${taskType} content for the topic "${topic}" in ${subject}.\n\n${context}`;

    if (previouslyStudiedSubtopics && previouslyStudiedSubtopics.length > 0) {
      userPrompt += `\n\nPREVIOUSLY STUDIED SUBTOPICS (do NOT repeat these — pick a different one):\n- ${previouslyStudiedSubtopics.join('\n- ')}`;
    }

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
