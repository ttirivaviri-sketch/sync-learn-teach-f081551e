import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const TASK_PROMPTS: Record<string, string> = {
  "micro-revision": `You are an expert tutor creating a quick micro-revision session.

Generate 2-3 focused review questions with brief answers for the given topic.
Format:
- Start with a 1-sentence topic refresher
- Then list questions with answers
- Keep it concise — this should take 2-3 minutes
- Questions should test recall of key concepts
- Use markdown formatting`,

  "concept-learning": `You are an expert tutor creating a concept deep-dive lesson.

Create a clear, engaging explanation of the topic that:
- Starts with WHY this concept matters (exam relevance)
- Explains the concept step-by-step with simple language
- Uses analogies or real-world examples
- Highlights common exam mistakes to avoid
- Ends with 2 key takeaways
- Use markdown formatting with headers
- Keep it focused and exam-relevant — no unnecessary tangents`,

  "active-recall": `You are an expert tutor creating an active recall exercise.

Generate a self-testing exercise that:
- Contains 4-5 questions of increasing difficulty
- Includes a mix of: definitions, applications, and analysis questions
- Each question should have a clear model answer
- Format: Question → (space for thinking) → Model Answer
- Focus on the most exam-relevant aspects
- Use markdown formatting`,

  "exam-question": `You are an expert exam question writer.

Generate one realistic exam-style question that:
- Matches the format and difficulty of real exams
- Has clear mark allocation (show marks in brackets)
- Tests higher-order thinking (application, analysis, evaluation)
- Includes a detailed marking scheme / model answer
- Mentions command words (Explain, Describe, Evaluate, Calculate, etc.)
- Format: Question [marks] → Model Answer with marking points
- Use markdown formatting`,

  "flashcards": `You are an expert tutor creating study flashcards.

Generate 6-8 flashcards for the given topic:
- Front: A question or term
- Back: Concise answer or definition
- Focus on key exam vocabulary and concepts
- Include a mix of recall and application cards
- Format each as: **Front:** ... | **Back:** ...
- Use markdown formatting`,

  "summary": `You are an expert tutor creating exam-focused topic summaries.

Create a comprehensive yet concise summary that:
- Lists ALL key points an examiner would expect
- Highlights definitions, formulas, or key terms in bold
- Organizes information logically
- Includes a "Common Exam Questions" section
- Ends with a quick self-test (3 questions)
- Use markdown formatting with clear headers`,

  "revision-checklist": `You are an expert tutor creating a revision checklist.

Generate a comprehensive revision checklist that:
- Lists every key concept the student must know
- Uses checkboxes (- [ ]) for each item
- Groups by sub-topic
- Marks high-priority items with ⭐
- Includes "I can explain..." and "I can calculate/apply..." items
- Use markdown formatting`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { taskType, subject, topic, subtopics, examWeight, curriculumContext } = await req.json();

    if (!taskType || !subject || !topic) {
      return new Response(
        JSON.stringify({ error: "taskType, subject, and topic are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = TASK_PROMPTS[taskType] || TASK_PROMPTS["concept-learning"];

    let userPrompt = `Subject: ${subject}\nTopic: ${topic}`;
    if (subtopics?.length) userPrompt += `\nSubtopics: ${subtopics.join(", ")}`;
    if (examWeight) userPrompt += `\nExam weight: ${examWeight}% of total marks`;
    if (curriculumContext) userPrompt += `\n\nCurriculum context:\n${curriculumContext}`;

    const response = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-task-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
