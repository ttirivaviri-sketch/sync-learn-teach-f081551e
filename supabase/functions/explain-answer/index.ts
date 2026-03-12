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
  if (openaiKey) return { url: `${openaiBase}/chat/completions`, key: openaiKey, model: Deno.env.get("AI_MODEL") || "gpt-4o-mini" };
  if (lovableKey) return { url: "https://ai.gateway.lovable.dev/v1/chat/completions", key: lovableKey, model: "google/gemini-2.0-flash" };
  throw new Error("No AI API key configured.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const { question, studentAnswer, modelAnswer, topic, subject } = await req.json();

    if (!question || !studentAnswer) {
      return new Response(JSON.stringify({ error: "question and studentAnswer are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a supportive expert tutor helping a student understand where they went wrong on an exam question.

Your explanation should:
1. Acknowledge what the student got right (if anything)
2. Identify the specific gap(s) or misconception(s)
3. Explain the correct concept clearly, step by step
4. Show how the model answer addresses the marking criteria
5. Give a memorable tip to prevent this mistake in future

Tone: Encouraging, clear, never condescending.
Format: Use markdown with clear headings. Keep it concise (150-300 words).`;

    const userPrompt = `Subject: ${subject || "Unknown"}\nTopic: ${topic || "Unknown"}\n\n**Question:**\n${question}\n\n**Student's Answer:**\n${studentAnswer}\n\n**Model Answer:**\n${modelAnswer || "Not provided — explain based on the question itself"}`;

    const response = await fetch(ai.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${ai.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ai.model,
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        stream: true,
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      throw new Error(`AI error: ${response.status} ${t}`);
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("explain-answer error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
