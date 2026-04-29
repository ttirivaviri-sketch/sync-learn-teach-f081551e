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
  enforceQuota,
  quotaExceededResponse,
} from "../_shared/ai-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const quota = await enforceQuota(req, "tutor");
    if (!quota.allowed) return quotaExceededResponse("tutor", quota.used, quota.limit);
    const ai = getAIConfig("standard");
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

    // ── Try to fetch syllabus + exam-board metadata from Supabase ───────
    let syllabusContext = clientSyllabusContext || "";
    let examBoardContext = "";
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
            .select("topics, exam_patterns, exam_board_meta, syllabus_code")
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

          // Build exam-board context (command words, AOs, paper structure)
          const meta = (subjectData?.exam_board_meta || {}) as any;
          const parts: string[] = [];
          if (meta.exam_board) parts.push(`Exam board: ${meta.exam_board}`);
          if (subjectData?.syllabus_code) parts.push(`Syllabus code: ${subjectData.syllabus_code}`);

          if (Array.isArray(meta.assessment_objectives) && meta.assessment_objectives.length) {
            parts.push(
              "Assessment Objectives:\n" +
                meta.assessment_objectives
                  .map((ao: any) =>
                    `  • ${ao.code}${ao.weight_percent ? ` (${ao.weight_percent}%)` : ""}: ${ao.description || ao.name || ""}`
                  )
                  .join("\n")
            );
          }

          if (Array.isArray(meta.paper_structure) && meta.paper_structure.length) {
            parts.push(
              "Paper Structure:\n" +
                meta.paper_structure
                  .map((p: any) => {
                    const bits = [p.paper];
                    if (p.name) bits.push(p.name);
                    if (p.duration_minutes) bits.push(`${p.duration_minutes} min`);
                    if (p.total_marks) bits.push(`${p.total_marks} marks`);
                    if (p.weight_percent) bits.push(`${p.weight_percent}%`);
                    if (Array.isArray(p.question_types) && p.question_types.length)
                      bits.push(p.question_types.join("/"));
                    return `  • ${bits.join(" — ")}`;
                  })
                  .join("\n")
            );
          }

          if (Array.isArray(meta.command_words) && meta.command_words.length) {
            // keep this compact — just the words and one-line definitions
            const top = meta.command_words.slice(0, 30);
            parts.push(
              "Command Words (use the examiner-defined meaning when interpreting questions):\n" +
                top
                  .map((cw: any) => `  • ${cw.word}: ${cw.definition}`)
                  .join("\n")
            );
          }

          if (parts.length) examBoardContext = parts.join("\n\n");
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

${examBoardContext ? `EXAM BOARD METADATA (use this to teach exam strategy, not just the topic):\n${examBoardContext}\n` : ""}
MATHEMATICAL NOTATION (CRITICAL):
- ALL mathematical expressions MUST use LaTeX notation wrapped in dollar signs.
- Inline math: $x^2$, $\\frac{a}{b}$, $\\sqrt{x}$, $\\sum_{i=1}^{n}$
- Display math for complex equations: $$E = mc^2$$
- NEVER write plain text like "x squared" or "x^2" — always use $x^2$.
- Fractions: $\\frac{numerator}{denominator}$, not "a/b".
- Greek letters: $\\alpha$, $\\beta$, $\\theta$, $\\pi$.

TEACHING STYLE — TEACH LIKE AN EXAMINER, NOT A TEXTBOOK:
- Be encouraging but direct — students need confidence AND accuracy.
- Use simple language with precise academic terminology.
- Give real-life examples that make concepts stick.
- Use markdown formatting for clarity (headers, bold, lists).

EXAM-STRATEGY RULES (CRITICAL — you are coaching for the actual exam):
1. **Command words matter.** When you give a practice question OR interpret one the student asks about, ALWAYS state the command word and what the examiner expects:
   - "state" → one-line factual recall, no explanation needed.
   - "describe" → say WHAT happens or WHAT it looks like — observation only, no reasoning.
   - "explain" → give the REASON / mechanism, link cause to effect using "because" / "so that" / "this means".
   - "suggest" → apply known principles to an unfamiliar context.
   - "compare" → both similarities AND differences in the same sentence ("whereas", "but").
   - "calculate" → show working AND units; no working = lose method marks.
   - "evaluate" → both sides + a reasoned conclusion.
   If the EXAM BOARD METADATA above defines the command word differently, use that definition verbatim.

2. **Assessment Objectives.** When you give a practice question, label which AO it targets (AO1 recall, AO2 application, AO3 analysis/evaluation). This trains students to recognise what skill the examiner wants.

3. **Mark-scheme keywords.** Use the exact words examiners reward — name organelles fully, name forces precisely, write equations with the conventional symbols. Tell the student which words are "marking points" (MP1, MP2…) where applicable.

4. **End every concept explanation with a "🎯 How this is examined" mini-block:**
   - Typical mark allocation (e.g. "usually 4–6 marks")
   - Typical command words used for this topic
   - Which paper(s) it appears in (use Paper Structure above if available)
   - One common student mistake to avoid

5. **Practice question format.** When you give a practice question, write it the way the actual paper does:
   \`[3] Explain why...\` (marks in square brackets at the start, then the command word).

WHEN A STUDENT ASKS ABOUT A TOPIC:
1. Explain the concept clearly with examples.
2. Show how it appears in their exam using the rules above.
3. Mention related topics worth reviewing.
4. If they're struggling, break it down further.
5. If they're confident, challenge them with an AO2/AO3-style application question.`;

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
