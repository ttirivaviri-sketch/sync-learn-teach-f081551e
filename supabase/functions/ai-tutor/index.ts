import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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

    const { messages, subject, topic } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context-aware system prompt
    let contextInfo = "";
    if (subject) contextInfo += `The student is currently studying ${subject}.`;
    if (topic) contextInfo += ` They are on the topic: ${topic}.`;

    // Try to fetch syllabus context for richer responses
    let syllabusContext = "";
    try {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (user && subject) {
          const { data: subjectData } = await supabase
            .from("subjects")
            .select("topics, exam_patterns")
            .eq("user_id", user.id)
            .ilike("name", `%${subject}%`)
            .maybeSingle();

          if (subjectData) {
            const topics = subjectData.topics as any[];
            const currentTopic = topics?.find((t: any) => t.name === topic);
            if (currentTopic) {
              syllabusContext = `\n\nSyllabus context for this topic:
- Subtopics: ${currentTopic.subtopics?.join(", ") || "N/A"}
- Learning objectives: ${currentTopic.learningObjectives?.join("; ") || "N/A"}
- Exam weight: ${currentTopic.examWeight || "unknown"}%`;
            }

            if (subjectData.exam_patterns && typeof subjectData.exam_patterns === "object") {
              const patterns = subjectData.exam_patterns as Record<string, number>;
              const topPatterns = Object.entries(patterns)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([t, score]) => `${t}: ${score}%`)
                .join(", ");
              if (topPatterns) {
                syllabusContext += `\nExam probability scores: ${topPatterns}`;
              }
            }
          }
        }
      }
    } catch (ctxErr) {
      console.warn("Could not fetch syllabus context:", ctxErr);
    }

    const systemPrompt = `You are StudySync AI, a personal exam strategist and tutor. ${contextInfo}${syllabusContext}

Core principles:
1. **Syllabus Authority**: All teaching must map to syllabus topics. Never introduce content outside the syllabus scope.
2. **Exam Focus**: Prioritize what examiners test most frequently. Reference exam patterns when available.
3. **Efficient Learning**: Help students study smarter — focus on high-yield topics first.

Teaching style:
- Be encouraging but direct
- Use simple language with precise academic terminology
- Give examples that connect to real life
- Highlight common exam mistakes
- When explaining, structure answers clearly with headers and bullet points
- If asked about exam strategy, use exam pattern data to prioritize topics
- Use markdown formatting for clarity

If the student asks about a topic, always:
1. Explain the concept clearly
2. Show how it might appear in an exam
3. Mention any related topics they should also review`;

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
          ...messages,
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
      console.error("AI tutor error:", response.status, t);
      throw new Error("AI tutor failed");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-tutor error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
