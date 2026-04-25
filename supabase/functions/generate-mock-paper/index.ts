/**
 * generate-mock-paper Edge Function
 *
 * Generates a FULL mock exam paper matching the real blueprint
 * (question-type mix, mark distribution, topic coverage, command words).
 *
 * POST body:
 * {
 *   subject_id: string,
 *   paper_code: string,
 * }
 *
 * Loads paper_blueprint + linked past-paper exemplars from DB,
 * then asks the AI to generate a complete paper with model answers
 * and per-question marking schemes.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getAIConfig,
  STUDYMODE_SYSTEM_IDENTITY,
  corsHeaders,
  callAI,
  safeJsonParse,
  normalizeArray,
  errorResponse,
  jsonResponse,
} from "../_shared/ai-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const ai = getAIConfig();
    const body = await req.json();
    const { subject_id, paper_code } = body;

    if (!subject_id || !paper_code) {
      return jsonResponse(
        { error: "subject_id and paper_code are required" },
        400
      );
    }

    // Auth user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user } } = await supa.auth.getUser();
    if (!user) return jsonResponse({ error: "Not authenticated" }, 401);

    // Load blueprint
    const { data: bp } = await supa
      .from("paper_blueprints")
      .select("*")
      .eq("user_id", user.id)
      .eq("subject_id", subject_id)
      .eq("paper_code", paper_code)
      .maybeSingle();

    if (!bp) {
      return jsonResponse(
        { error: "No blueprint found. Upload past papers + mark schemes for this paper first." },
        404
      );
    }

    // Pull a few past Q+A exemplars from documents
    const { data: docs } = await supa
      .from("documents")
      .select("parsed_content, type")
      .eq("user_id", user.id)
      .eq("type", "past_paper")
      .ilike("subject", bp.subject_name);

    const exemplars: any[] = [];
    (docs || []).forEach((d: any) => {
      const qs = d?.parsed_content?.questions || [];
      qs.forEach((q: any) => {
        if (q.model_answer && q.marking_scheme && exemplars.length < 4) {
          exemplars.push({
            question: q.question || q.text,
            marks: q.marks,
            command_word: q.command_word,
            topic: q.topic,
            model_answer: q.model_answer,
            marking_scheme: q.marking_scheme,
          });
        }
      });
    });

    const totalMarks = bp.total_marks || 80;
    const duration = bp.duration_minutes || 90;
    const qtypes = bp.question_type_distribution || {};
    const topicCov = bp.topic_coverage || {};
    const cmdFreq = bp.command_word_frequency || {};

    const systemPrompt = `${STUDYMODE_SYSTEM_IDENTITY}

YOUR TASK: Generate a COMPLETE mock exam paper that matches the real paper blueprint as closely as possible.

PAPER BLUEPRINT:
- Subject: ${bp.subject_name}
- Paper code: ${paper_code}
- Total marks: ${totalMarks}
- Duration: ${duration} minutes
- Question type distribution (% of marks): ${JSON.stringify(qtypes)}
- Topic coverage (% of marks): ${JSON.stringify(topicCov)}
- Command word frequency: ${JSON.stringify(cmdFreq)}
- Years analysed: ${(bp.years_analysed || []).join(", ") || "n/a"}

RULES:
1. Total marks across all questions MUST equal ${totalMarks} (±2).
2. Match the question-type mix proportionally (if blueprint says 50% MCQ, generate ~50% of marks as MCQ).
3. Spread questions across topics by their coverage weight — heavier topics get more marks.
4. Use the same command words at similar frequency.
5. Each question MUST have: question text (with [marks] in brackets), model_answer, marking_scheme[] (mark-by-mark), topic, command_word, question_type, marks.
6. For MCQs include 4 options A–D and the correct letter.
7. Use LaTeX for any maths ($x^2$, $\\frac{a}{b}$).
8. Difficulty should ramp up across the paper.
9. Include data/stimulus where appropriate (tables, scenarios).

Return ONLY valid JSON:
{
  "paper_code": "${paper_code}",
  "subject": "${bp.subject_name}",
  "total_marks": ${totalMarks},
  "duration_minutes": ${duration},
  "instructions": "...",
  "questions": [
    {
      "id": "q1",
      "number": "1",
      "question_type": "mcq" | "structured" | "free_response" | "calculation",
      "question": "...",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct_option": "B",
      "marks": 1,
      "command_word": "state",
      "topic": "...",
      "model_answer": "...",
      "marking_scheme": ["1 mark for ..."]
    }
  ]
}`;

    const userPrompt = `Generate the full ${paper_code} mock paper now.

${exemplars.length > 0 ? `=== REAL PAST-PAPER EXEMPLARS (mirror this style) ===
${exemplars
  .map(
    (e, i) => `Example ${i + 1} (${e.marks} marks, ${e.command_word || "?"}, topic: ${e.topic || "?"}):
Q: ${e.question}
Model answer: ${e.model_answer}
Mark scheme: ${(e.marking_scheme || []).join(" | ")}
`
  )
  .join("\n")}` : ""}

Generate now. Return JSON only.`;

    const rawContent = await callAI(ai, systemPrompt, userPrompt, {
      temperature: 0.6,
      jsonMode: true,
      maxTokens: 8000,
    });

    const parsed = safeJsonParse<any>(rawContent);
    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

    if (questions.length === 0) {
      throw new Error("AI returned no questions");
    }

    const normalised = questions.map((q: any, i: number) => ({
      id: q.id || `q${i + 1}`,
      number: String(q.number || i + 1),
      question_type: q.question_type || "structured",
      question: String(q.question || "").trim(),
      options: Array.isArray(q.options) ? q.options : undefined,
      correct_option: q.correct_option || undefined,
      marks: Number(q.marks || 1),
      command_word: String(q.command_word || "").trim(),
      topic: String(q.topic || "").trim(),
      model_answer: String(q.model_answer || "").trim(),
      marking_scheme: normalizeArray(q.marking_scheme),
    }));

    const computedTotal = normalised.reduce((s: number, q: any) => s + q.marks, 0);

    return jsonResponse({
      paper_code,
      subject: bp.subject_name,
      subject_id,
      total_marks: parsed.total_marks || computedTotal,
      duration_minutes: parsed.duration_minutes || duration,
      instructions:
        parsed.instructions ||
        `Answer ALL questions. Time allowed: ${duration} minutes. Total: ${computedTotal} marks.`,
      questions: normalised,
    });
  } catch (e) {
    console.error("generate-mock-paper error:", e);
    return errorResponse(e);
  }
});
