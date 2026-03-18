/**
 * generate-flashcards Edge Function
 *
 * Converts syllabus topics / past-paper patterns into structured flashcards
 * and optionally saves them to the flashcards table.
 *
 * POST body:
 * {
 *   subject: string,
 *   topic: string,
 *   syllabusContext?: string,
 *   pastPaperContext?: string,
 *   count?: number (default 8, max 20),
 *   difficulty?: "easy"|"medium"|"hard"|"mixed"
 * }
 *
 * Returns:
 * {
 *   flashcards: [{ front, back, hint, topic, difficulty, tags }]
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getAIConfig(): { url: string; key: string; model: string } {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const openaiBase = Deno.env.get("OPENAI_BASE_URL") || "https://api.openai.com/v1";
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (openaiKey) {
    return {
      url: `${openaiBase}/chat/completions`,
      key: openaiKey,
      model: Deno.env.get("AI_MODEL") || "gpt-4o-mini",
    };
  }
  if (lovableKey) {
    return {
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: lovableKey,
      model: "google/gemini-2.0-flash",
    };
  }
  throw new Error("No AI API key configured.");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();

    const {
      subject,
      topic,
      syllabusContext = "",
      pastPaperContext = "",
      count = 8,
      difficulty = "mixed",
    } = await req.json();

    if (!subject || !topic) {
      return new Response(JSON.stringify({ error: "subject and topic are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cardCount = Math.min(Number(count) || 8, 20);

    const systemPrompt = `You are an expert flashcard creator for exam preparation.
Create ${cardCount} high-quality flashcards for the given topic.

Rules:
1. Return ONLY valid JSON — an array of flashcard objects.
2. "front" = the question or concept prompt (exam-style where possible).
3. "back" = the concise, accurate answer or definition.
4. "hint" = a memory aid or key phrase (optional, keep short).
5. "difficulty" = "easy", "medium", or "hard".
6. "tags" = array of relevant concept keywords.
7. Mix definition, application, and recall question types.
8. Ground content in the syllabus and past-paper patterns provided.
9. Use exam command-word phrasing where suitable.

Return ONLY this JSON structure:
{
  "flashcards": [
    {
      "front": "Define osmosis.",
      "back": "The movement of water molecules from a region of higher water potential to a region of lower water potential through a partially permeable membrane.",
      "hint": "Think: water moves TO where there's less water",
      "difficulty": "easy",
      "tags": ["osmosis", "transport", "cell membrane"]
    }
  ]
}`;

    const userPrompt = `Create ${cardCount} flashcards for:
Subject: ${subject}
Topic: ${topic}
Difficulty mix: ${difficulty}

${syllabusContext ? `Syllabus context:\n${syllabusContext.substring(0, 2000)}` : ""}
${pastPaperContext ? `\nPast paper patterns:\n${pastPaperContext.substring(0, 1000)}` : ""}

Ensure the flashcards cover:
- Key definitions and terminology
- Important formulas or processes (where applicable)
- Common exam question patterns for this topic
- Concepts that frequently appear in past papers`;

    const response = await fetch(ai.url, {
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
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI API error: ${response.status} ${err}`);
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "{}";

    let flashcards: any[] = [];
    try {
      const parsed = JSON.parse(rawContent);
      flashcards = parsed.flashcards || parsed.cards || (Array.isArray(parsed) ? parsed : []);
    } catch {
      const match = rawContent.match(/\[[\s\S]*\]/);
      if (match) flashcards = JSON.parse(match[0]);
    }

    // Normalise each card
    flashcards = flashcards.map((card: any, i: number) => ({
      id: `${topic.toLowerCase().replace(/\s+/g, "-")}-${i + 1}`,
      front: card.front || card.question || card.term || "",
      back: card.back || card.answer || card.definition || "",
      hint: card.hint || card.memory_aid || null,
      topic,
      subject,
      difficulty: card.difficulty || "medium",
      tags: Array.isArray(card.tags) ? card.tags : [],
    }));

    return new Response(
      JSON.stringify({ flashcards, count: flashcards.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-flashcards]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
