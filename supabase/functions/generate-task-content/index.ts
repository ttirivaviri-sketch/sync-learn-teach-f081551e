import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getAIConfig(): { url: string; key: string; model: string } {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const openaiBase = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");

  if (openaiKey) {
    return { url: `${openaiBase}/chat/completions`, key: openaiKey, model: Deno.env.get("AI_MODEL") || "gpt-4o-mini" };
  }
  if (lovableKey) {
    return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovableKey, model: "google/gemini-2.0-flash" };
  }
  throw new Error("No AI API key configured.");
}

const GLOBAL_ALIGNMENT_PROMPT = `
Always align to the provided syllabus context and past-paper patterns.
- Reinforce learning objectives and core examinable concepts.
- Mirror exam language (command words, mark-style phrasing), but do not copy questions verbatim.
- Keep output practical, exam-focused, and age/level appropriate.
`;

const TASK_PROMPTS: Record<string, string> = {
  "micro-revision": `You are an expert tutor creating a quick micro-revision session.
Generate 2-3 focused review questions with brief answers for the given topic.
- Start with a 1-sentence topic refresher
- Then list questions with answers
- Keep it concise — 2-3 minutes
- Use markdown formatting`,

  "concept-learning": `You are an expert tutor creating a concept deep-dive lesson.
Create a clear, engaging explanation that:
- Starts with WHY this concept matters (exam relevance)
- Explains step-by-step with simple language and analogies
- Highlights common exam mistakes
- Ends with 2 key takeaways
- Uses markdown formatting with headers`,

  "active-recall": `You are an expert tutor creating an active recall exercise.
Generate a self-testing exercise with:
- 5-6 questions of increasing difficulty
- At least 3 questions written in past-paper command-word style (e.g., define, explain, compare, calculate, justify)
- Questions mapped to syllabus subtopics where possible
- Clear model answers for each
- Format: Question → Model Answer
- Use markdown formatting`,

  "exam-question": `You are an expert exam question writer.
Generate one realistic exam-style question:
- Clear mark allocation in brackets
- Tests higher-order thinking
- Includes detailed marking scheme
- Uses command words and structure seen in past papers
- Ends with a short "Syllabus link" line
- Use markdown formatting`,

  "flashcards": `You are an expert tutor creating study flashcards.
Generate 8 flashcards that reinforce syllabus outcomes and past-paper readiness.
Requirements:
- At least 4 cards should be past-paper style prompts using command words.
- At least 4 cards should target key definitions/formulas/concepts from syllabus outline.
- Keep each answer concise and exam-scoring focused.
- Format each as exactly: **Front:** ... | **Back:** ...
- Use markdown formatting`,

  "summary": `You are an expert tutor creating exam-focused topic summaries.
Create a comprehensive yet concise summary that:
- Lists ALL key points an examiner would expect
- Highlights definitions, formulas, key terms in bold
- Includes a "Common Exam Questions" section with past-paper-like stems
- Ends with a quick self-test (3 questions)
- Uses markdown formatting`,

  "revision-checklist": `You are an expert tutor creating a revision checklist.
Generate a comprehensive checklist that:
- Uses checkboxes (- [ ]) for each item
- Groups by sub-topic
- Marks high-priority items with ⭐
- Includes "I can explain..." and "I can calculate..." items
- Includes at least 2 "past-paper practice" checklist items
- Uses markdown formatting`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
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
    } = await req.json();

    if (!taskType || !subject || !topic) {
      return new Response(JSON.stringify({ error: "taskType, subject, and topic are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `${TASK_PROMPTS[taskType] || TASK_PROMPTS["concept-learning"]}\n\n${GLOBAL_ALIGNMENT_PROMPT}`;

    let userPrompt = `Subject: ${subject}\nTopic: ${topic}`;
    if (subtopics?.length) userPrompt += `\nSubtopics: ${subtopics.join(", ")}`;
    if (examWeight) userPrompt += `\nExam weight: ${examWeight}% of total marks`;
    if (difficulty) userPrompt += `\nTarget difficulty: ${difficulty}`;
    if (masteryStatus) userPrompt += `\nStudent mastery status: ${masteryStatus}`;
    if (performanceContext) userPrompt += `\nStudent performance context: ${String(performanceContext).substring(0, 1200)}`;
    if (curriculumContext) userPrompt += `\n\nCurriculum and past-paper context:\n${String(curriculumContext).substring(0, 4000)}`;

    const response = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("generate-task-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
