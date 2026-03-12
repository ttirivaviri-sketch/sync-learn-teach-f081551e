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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const { subject, topic, topicContext, curriculumContext, examWeight } = await req.json();

    if (!subject || !topic) {
      return new Response(JSON.stringify({ error: "subject and topic are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are an expert exam question generator for ${subject}.

Create realistic exam-style questions that test understanding, not memorization.
Use appropriate command words. Include clear mark allocation.
Provide detailed model answers and key marking points.

IMPORTANT: Respond with ONLY valid JSON matching this schema:
{
  "question": "Full exam question text [X marks]",
  "marks": <number>,
  "modelAnswer": "Detailed model answer",
  "keyPoints": ["point 1", "point 2"],
  "difficulty": "easy|medium|hard",
  "commandWords": ["word1"],
  "conceptsTested": ["concept1"]
}`;

    let userPrompt = `Generate one exam-style question for:\nSubject: ${subject}\nTopic: ${topic}`;
    if (topicContext) userPrompt += `\n${topicContext}`;
    if (examWeight) userPrompt += `\nExam weight: ${examWeight}%`;
    if (curriculumContext) userPrompt += `\n\nCurriculum data:\n${String(curriculumContext).substring(0, 3000)}`;

    const response = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("generate-quiz error:", response.status, t);
      throw new Error("Failed to generate question");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI did not return a question");

    let questionData;
    try {
      questionData = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) questionData = JSON.parse(match[0]);
      else throw new Error("Could not parse AI response");
    }

    return new Response(JSON.stringify(questionData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
