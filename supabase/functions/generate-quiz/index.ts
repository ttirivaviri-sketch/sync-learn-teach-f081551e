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

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const {
      subject,
      topic,
      topicContext,
      curriculumContext,
      examWeight,
      preferredQuestionType,
      avoidQuestionTypes,
      performanceContext,
      difficulty,
      pastPaperStyleNotes,
    } = await req.json();

    if (!subject || !topic) {
      return new Response(JSON.stringify({ error: "subject and topic are required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are an elite exam question setter for ${subject}.\n
Your job is to create ONE exam-style question that mirrors real past-paper style while reinforcing syllabus outcomes.

Rules:
1) Anchor to syllabus outline and topic scope only.
2) Mimic past-paper patterns: command words, mark allocations, and structure.
3) Prefer applied and reasoning-heavy questions over recall-only.
4) If weak areas are provided, target those concepts.
5) Do not copy any past-paper question verbatim.

Return ONLY valid JSON with this exact shape:
{
  "question": "string",
  "marks": 6,
  "modelAnswer": "string",
  "keyPoints": ["string"],
  "difficulty": "easy|medium|hard",
  "commandWords": ["string"],
  "conceptsTested": ["string"],
  "syllabusLinks": ["specific syllabus objective or subtopic"]
}`;

    let userPrompt = `Generate one past-paper-style question for:\nSubject: ${subject}\nTopic: ${topic}`;
    if (topicContext) userPrompt += `\n\nTopic context:\n${String(topicContext).substring(0, 1500)}`;
    if (curriculumContext) userPrompt += `\n\nSyllabus and past-paper context:\n${String(curriculumContext).substring(0, 3500)}`;
    if (examWeight) userPrompt += `\n\nExam weighting: ${examWeight}% of total marks.`;
    if (difficulty) userPrompt += `\nTarget difficulty: ${difficulty}.`;
    if (preferredQuestionType) userPrompt += `\nPrefer this question style: ${preferredQuestionType}.`;
    if (Array.isArray(avoidQuestionTypes) && avoidQuestionTypes.length > 0) {
      userPrompt += `\nAvoid repeating these recent styles: ${avoidQuestionTypes.join(", ")}.`;
    }
    if (performanceContext) userPrompt += `\n\nStudent performance context:\n${String(performanceContext).substring(0, 1500)}`;
    if (pastPaperStyleNotes) userPrompt += `\n\nPast-paper style summary:\n${String(pastPaperStyleNotes).substring(0, 1200)}`;

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

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error("Could not parse AI response");
    }

    const questionData = {
      question: String(parsed?.question || "").trim(),
      marks: Number(parsed?.marks || 0),
      modelAnswer: String(parsed?.modelAnswer || "").trim(),
      keyPoints: normalizeArray(parsed?.keyPoints),
      difficulty: ["easy", "medium", "hard"].includes(String(parsed?.difficulty)) ? parsed.difficulty : (difficulty || "medium"),
      commandWords: normalizeArray(parsed?.commandWords),
      conceptsTested: normalizeArray(parsed?.conceptsTested),
      syllabusLinks: normalizeArray(parsed?.syllabusLinks),
    };

    if (!questionData.question || questionData.marks <= 0) {
      throw new Error("Generated question payload is incomplete");
    }

    return new Response(JSON.stringify(questionData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
