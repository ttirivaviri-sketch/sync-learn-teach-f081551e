/**
 * ai-tutor Edge Function (v2)
 *
 * Interactive AI tutor that uses the unified StudyMode context system.
 * Supports streaming responses for real-time chat.
 *
 * POST body:
 * {
 *   messages: [{ role, content }],
 *   subject?, topic?, syllabusContext?,
 *   curriculum?, examLevel?, weakAreas?,
 *   performanceData?
 * }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  getAIConfig,
  buildStudyModeContext,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  errorResponse,
  streamResponse,
} from "../_shared/ai-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const body = await req.json();

    const {
      messages,
      subject,
      topic,
      syllabusContext: clientSyllabusContext,
      curriculum,
      examLevel,
      weakAreas,
      performanceData,
    } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── Try to fetch syllabus context from Supabase ─────────────────────
    let syllabusContext = clientSyllabusContext || "";
    try {
      const authHeader = req.headers.get("authorization");
      if (authHeader && subject) {
        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          global: { headers: { Authorization: authHeader } },
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: subjectData } = await supabase
            .from("subjects")
            .select("topics, exam_patterns")
            .eq("user_id", user.id)
            .ilike("name", `%${subject}%`)
            .maybeSingle();

          if (subjectData && topic) {
            const topics = subjectData.topics as any[];
            const currentTopic = topics?.find(
              (t: any) => t.name === topic
            );
            if (currentTopic) {
              syllabusContext =
                `Topic: ${currentTopic.name}\n` +
                (currentTopic.subtopics?.length
                  ? `Subtopics: ${currentTopic.subtopics.join(", ")}\n`
                  : "") +
                (currentTopic.learningObjectives?.length
                  ? `Learning Objectives: ${currentTopic.learningObjectives.join("; ")}\n`
                  : "") +
                (currentTopic.examWeight
                  ? `Exam Weight: ${currentTopic.examWeight}%\n`
                  : "");
            }
          }
        }
      }
    } catch (ctxErr) {
      console.warn("Could not fetch syllabus context:", ctxErr);
    }

    // ── Build unified context ─────────────────────────────────────────────
    const context = buildStudyModeContext({
      curriculum,
      subject,
      topic,
      examLevel,
      weakAreas,
      performanceData,
      syllabusContext,
    });

    // ── System prompt ─────────────────────────────────────────────────────
    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

You are an interactive StudySync AI tutor in a chat conversation.
Return ONLY clean, structured study content using markdown. Do NOT return HTML, CSS, JavaScript, JSX, or any code.

CONTEXT:
${context || "No specific context provided — adapt to what the student asks."}

MATHEMATICAL NOTATION (CRITICAL):
- ALL mathematical expressions MUST use LaTeX notation wrapped in dollar signs.
- Inline math: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\sum_{i=1}^{n}$
- Display math for complex equations: $$E = mc^2$$
- NEVER write plain text like "x squared" or "x^2" — always use $x^2$.
- Fractions: $\\frac{numerator}{denominator}$, not "a/b".
- Greek letters: $\\alpha$, $\\beta$, $\\theta$, $\\pi$.

TEACHING STYLE:
- Be encouraging but direct — students need confidence AND accuracy.
- Use simple language with precise academic terminology.
- Give real-life examples that make concepts stick.
- Highlight common exam mistakes and how to avoid them.
- Use markdown formatting for clarity (headers, bold, lists).

WHEN A STUDENT ASKS ABOUT A TOPIC:
1. Explain the concept clearly with examples.
2. Show how it might appear in an exam (with mark allocation).
3. Mention related topics they should also review.
4. If they're struggling, break it down further.
5. If they're confident, challenge them with harder applications.`;

    // ── Stream response ─────────────────────────────────────────────────
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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429)
        return errorResponse("RATE_LIMIT", 429);
      if (response.status === 402)
        return errorResponse("CREDITS_EXHAUSTED", 402);
      const t = await response.text();
      console.error("AI tutor error:", response.status, t);
      throw new Error("AI tutor failed");
    }

    return streamResponse(response.body);
  } catch (e) {
    console.error("ai-tutor error:", e);
    return errorResponse(e);
  }
});
