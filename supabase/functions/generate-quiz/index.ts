import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { subject, topic, topicContext, curriculumContext, examWeight } = await req.json();

    if (!subject || !topic) {
      return new Response(
        JSON.stringify({ error: "subject and topic are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert exam question generator for ${subject}.

Your role is to create realistic, exam-style questions that:
1. Match real exam format, difficulty, and mark allocation
2. Test understanding, not just memorization
3. Use appropriate command words (Explain, Describe, Calculate, Evaluate, Compare, etc.)
4. Include clear mark allocation
5. Provide a detailed model answer with marking points
6. Identify key points that earn marks

Rules:
- Questions MUST be directly related to the syllabus topic
- Difficulty should match the exam weight (higher weight = more challenging questions)
- Include a mix of recall, application, and analysis
- Model answers should show exactly what earns marks
- Stay within the syllabus scope — no external content`;

    let userPrompt = `Generate one exam-style question for:\nSubject: ${subject}\nTopic: ${topic}`;
    if (topicContext) userPrompt += `\n${topicContext}`;
    if (examWeight) userPrompt += `\nExam weight: ${examWeight}%`;
    if (curriculumContext) userPrompt += `\n\nCurriculum data:\n${curriculumContext.substring(0, 3000)}`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "create_exam_question",
              description: "Create a structured exam question with model answer",
              parameters: {
                type: "object",
                properties: {
                  question: { type: "string", description: "The full exam question text including mark allocation [X marks]" },
                  marks: { type: "number", description: "Total marks for this question" },
                  modelAnswer: { type: "string", description: "Detailed model answer showing what earns each mark" },
                  keyPoints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Key marking points that earn marks",
                  },
                  difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                  commandWords: {
                    type: "array",
                    items: { type: "string" },
                    description: "Command words used in the question",
                  },
                  conceptsTested: {
                    type: "array",
                    items: { type: "string" },
                    description: "Specific concepts being tested",
                  },
                },
                required: ["question", "marks", "modelAnswer", "keyPoints"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_exam_question" } },
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
      console.error("AI quiz error:", response.status, t);
      throw new Error("Failed to generate question");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("AI did not return a structured question");
    }

    const questionData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(questionData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
