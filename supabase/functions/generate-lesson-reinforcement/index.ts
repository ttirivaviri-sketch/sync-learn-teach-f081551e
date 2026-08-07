/**
 * generate-lesson-reinforcement
 *
 * Given a recording_id, builds a short reinforcement set (quiz + flashcards) from
 * the lesson notes & topic mapping and snapshots the learner's current concept
 * mastery so the UI can show before/after progression. Persists to
 * `lesson_reinforcement_sets`.
 *
 * Body: { recording_id: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, reportTokenUsage, verifyCaller } from "../_shared/ai-config.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const gatewayChat = async (body: Record<string, unknown>) => {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`AI gateway ${r.status}: ${await r.text()}`);
  return r.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Runs on the service role — require a verified caller before any work.
  const caller = await verifyCaller(req);
  if (!caller) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { recording_id } = await req.json();
    if (!recording_id) throw new Error("recording_id required");

    const { data: rec, error: recErr } = await sb
      .from("lesson_recordings").select("*").eq("id", recording_id).single();
    if (recErr || !rec) throw new Error(`Recording not found`);

    // Only the lesson's tutor/learner (or a trusted service call) may generate
    // reinforcement content for that recording.
    if (!caller.isService && caller.userId !== rec.tutor_id && caller.userId !== rec.learner_id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    const { data: notes } = await sb
      .from("lesson_notes").select("summary,key_points,vocabulary")
      .eq("booking_id", rec.booking_id).eq("audience", "learner").maybeSingle();
    const { data: mapping } = await sb
      .from("lesson_topic_mapping").select("*")
      .eq("booking_id", rec.booking_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!notes || !mapping) throw new Error("Notes or mapping missing");

    const reviewed = Array.isArray(mapping.evidence) ? mapping.evidence : [];
    const concepts: string[] = (mapping.concepts ?? []).slice(0, 8);
    const highConfidence = reviewed.filter((r: any) => r.confidence >= 0.6).map((r: any) => r.concept);
    const focusConcepts = highConfidence.length ? highConfidence : concepts;

    // ── AI: quiz + flashcards in one tool call ───────────────────────────
    const aiResp = await gatewayChat({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `Generate exam-style reinforcement content from a tutoring lesson. Be exam-focused.\n\n${KATEX_RULES}` },
        { role: "user", content:
`Subject: ${mapping.subject_name}
Topic: ${mapping.topic}
Concepts covered (with high confidence): ${focusConcepts.join(", ")}
Lesson summary: ${notes.summary ?? ""}
Key points: ${(notes.key_points ?? []).join(" • ")}
Vocabulary: ${(notes.vocabulary ?? []).map((v: any) => `${v.term}=${v.definition}`).join("; ")}

Produce a 5-question multiple-choice quiz and 6 flashcards.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "reinforcement_set",
          parameters: {
            type: "object",
            properties: {
              quiz: { type: "array", items: { type: "object", properties: {
                question: { type: "string" }, options: { type: "array", items: { type: "string" } },
                correct_index: { type: "integer" }, explanation: { type: "string" }, concept: { type: "string" },
              }, required: ["question", "options", "correct_index", "explanation", "concept"] } },
              flashcards: { type: "array", items: { type: "object", properties: {
                front: { type: "string" }, back: { type: "string" }, concept: { type: "string" },
              }, required: ["front", "back", "concept"] } },
            },
            required: ["quiz", "flashcards"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "reinforcement_set" } },
    });

    if (aiResp?.usage) {
      reportTokenUsage({
        userId: rec.learner_id,
        bucket: "misc",
        tokensIn: Number(aiResp.usage.prompt_tokens ?? 0),
        tokensOut: Number(aiResp.usage.completion_tokens ?? 0),
      });
    }

    const argsStr = aiResp.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("No reinforcement returned");
    const set = JSON.parse(argsStr);

    // ── Snapshot baseline mastery for these concepts ─────────────────────
    const baseline: Record<string, number> = {};
    if (focusConcepts.length) {
      const { data: attempts } = await sb
        .from("concept_attempts")
        .select("concept_label,was_correct")
        .eq("user_id", rec.learner_id)
        .in("concept_label", focusConcepts);
      for (const c of focusConcepts) {
        const rows = (attempts ?? []).filter((a: any) => a.concept_label === c);
        const correct = rows.filter((a: any) => a.was_correct).length;
        baseline[c] = rows.length ? Math.round((correct / rows.length) * 100) : 0;
      }
    }

    await sb.from("lesson_reinforcement_sets").insert({
      booking_id: rec.booking_id,
      recording_id,
      learner_id: rec.learner_id,
      quiz: set.quiz,
      flashcards: set.flashcards,
      concepts: focusConcepts,
      mastery_baseline: baseline,
    });

    return new Response(JSON.stringify({ ok: true, quiz_count: set.quiz.length, flashcard_count: set.flashcards.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lesson-reinforcement error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
