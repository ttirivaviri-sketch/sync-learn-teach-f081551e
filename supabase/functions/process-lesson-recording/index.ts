/**
 * process-lesson-recording
 *
 * Post-lesson pipeline. Given a lesson_recordings row, this function:
 *   1. Downloads the audio from the `lesson-audio` storage bucket.
 *   2. Transcribes it (diarised) via Gemini 2.5 Flash.
 *   3. Generates structured notes for learner + tutor and a topic mapping.
 *   4. Writes concept_attempts / weak_concepts / a lesson-reinforcement daily_task
 *      so StudyMode reinforces what was covered.
 *
 * Body: { recording_id: string }
 *  — alternatively { booking_id, storage_path, tutor_id, learner_id } to bootstrap
 *
 * Requires service_role to write across tables.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/ai-config.ts";
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

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json();
    const { recording_id } = body;
    if (!recording_id) {
      return new Response(JSON.stringify({ error: "recording_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: rec, error: recErr } = await sb
      .from("lesson_recordings")
      .select("*")
      .eq("id", recording_id)
      .single();
    if (recErr || !rec) throw new Error(`Recording not found: ${recErr?.message}`);

    await sb.from("lesson_recordings").update({ status: "transcribing" }).eq("id", recording_id);

    // ── 1. Download audio ─────────────────────────────────────────────────
    const dl = await sb.storage.from("lesson-audio").download(rec.storage_path);
    if (dl.error || !dl.data) throw new Error(`Audio download failed: ${dl.error?.message}`);
    const audioBytes = new Uint8Array(await dl.data.arrayBuffer());
    const audioB64 = toBase64(audioBytes);
    const mime = dl.data.type || "audio/webm";

    // ── 2. Transcribe (diarised) ──────────────────────────────────────────
    const transcriptResp = await gatewayChat({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are an audio transcription engine. Produce a clean diarised transcript labelling speakers as Tutor: and Learner: on separate lines. Preserve every word; do not summarise.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this tutoring lesson:" },
            { type: "input_audio", input_audio: { data: audioB64, format: mime.includes("wav") ? "wav" : "webm" } },
          ],
        },
      ],
    });
    const fullText: string = transcriptResp.choices?.[0]?.message?.content?.trim() ?? "";
    if (!fullText) throw new Error("Empty transcript");

    // Naive segmentation by speaker label
    const segments = fullText.split(/\n+/).filter(Boolean).map((line: string, i: number) => {
      const m = line.match(/^(Tutor|Learner)\s*:\s*(.*)$/i);
      return {
        idx: i,
        speaker: m ? m[1] : "Unknown",
        text: m ? m[2] : line,
      };
    });

    await sb.from("lesson_transcripts").upsert({
      recording_id,
      booking_id: rec.booking_id,
      full_text: fullText,
      segments,
      language: "en",
    }, { onConflict: "recording_id" });

    // ── 3. Generate notes + topic mapping via tool-calling ────────────────
    const notesResp = await gatewayChat({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            `You produce structured study notes from a tutoring lesson transcript. Always be specific and exam-focused.\n\n${KATEX_RULES}`,
        },
        {
          role: "user",
          content: `Transcript:\n${fullText.slice(0, 30000)}\n\nReturn structured notes for the learner AND the tutor, plus a topic mapping of what was covered.`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "lesson_notes",
          description: "Structured lesson notes",
          parameters: {
            type: "object",
            properties: {
              learner_notes: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  key_points: { type: "array", items: { type: "string" } },
                  action_items: { type: "array", items: { type: "string" } },
                  vocabulary: { type: "array", items: {
                    type: "object",
                    properties: { term: { type: "string" }, definition: { type: "string" } },
                    required: ["term", "definition"],
                  } },
                },
                required: ["summary", "key_points", "action_items", "vocabulary"],
              },
              tutor_notes: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  key_points: { type: "array", items: { type: "string" } },
                  action_items: { type: "array", items: { type: "string" } },
                  vocabulary: { type: "array", items: {
                    type: "object",
                    properties: { term: { type: "string" }, definition: { type: "string" } },
                    required: ["term", "definition"],
                  } },
                },
                required: ["summary", "key_points", "action_items", "vocabulary"],
              },
              topic_mapping: {
                type: "object",
                properties: {
                  subject_name: { type: "string" },
                  topic: { type: "string" },
                  concepts: { type: "array", items: { type: "string" } },
                  weak_concepts: { type: "array", items: { type: "string" } },
                  coverage_score: { type: "number", minimum: 0, maximum: 1 },
                },
                required: ["subject_name", "topic", "concepts", "weak_concepts", "coverage_score"],
              },
            },
            required: ["learner_notes", "tutor_notes", "topic_mapping"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "lesson_notes" } },
    });

    const argsStr = notesResp.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("No notes returned");
    const parsed = JSON.parse(argsStr);

    // ── 4. Persist notes ──────────────────────────────────────────────────
    await sb.from("lesson_notes").upsert([
      {
        booking_id: rec.booking_id,
        owner_id: rec.learner_id,
        audience: "learner",
        summary: parsed.learner_notes.summary,
        key_points: parsed.learner_notes.key_points,
        action_items: parsed.learner_notes.action_items,
        vocabulary: parsed.learner_notes.vocabulary,
      },
      {
        booking_id: rec.booking_id,
        owner_id: rec.tutor_id,
        audience: "tutor",
        summary: parsed.tutor_notes.summary,
        key_points: parsed.tutor_notes.key_points,
        action_items: parsed.tutor_notes.action_items,
        vocabulary: parsed.tutor_notes.vocabulary,
      },
    ], { onConflict: "booking_id,audience" });

    const tm = parsed.topic_mapping;
    await sb.from("lesson_topic_mapping").insert({
      booking_id: rec.booking_id,
      learner_id: rec.learner_id,
      subject_name: tm.subject_name,
      topic: tm.topic,
      concepts: tm.concepts,
      weak_concepts: tm.weak_concepts,
      coverage_score: tm.coverage_score,
    });

    // ── 5. Feed StudyMode ────────────────────────────────────────────────
    // 5a. concept_attempts — one row per covered concept
    if (Array.isArray(tm.concepts) && tm.concepts.length) {
      const correct = tm.coverage_score >= 0.6;
      const attemptRows = tm.concepts.map((c: string) => ({
        user_id: rec.learner_id,
        concept_label: c,
        subject_name: tm.subject_name,
        topic: tm.topic,
        surface: "tutor_lesson",
        was_correct: correct,
        marks_awarded: correct ? 1 : 0,
        marks_possible: 1,
        source_id: rec.booking_id,
        source_table: "lesson_recordings",
      }));
      await sb.from("concept_attempts").insert(attemptRows);
    }

    // 5b. weak_concepts upsert
    if (Array.isArray(tm.weak_concepts) && tm.weak_concepts.length) {
      const nowIso = new Date().toISOString();
      const weakRows = tm.weak_concepts.map((c: string) => ({
        user_id: rec.learner_id,
        subject: tm.subject_name,
        curriculum: "ZIMSEC",
        concept: c,
        topic: tm.topic,
        weakness_score: 1 - (tm.coverage_score ?? 0.5),
        last_seen_at: nowIso,
      }));
      await sb.from("weak_concepts").upsert(weakRows, {
        onConflict: "user_id,subject,curriculum,concept",
      });
    }

    // 5c. Reinforcement daily task
    const today = new Date().toISOString().slice(0, 10);
    await sb.from("daily_tasks").insert({
      user_id: rec.learner_id,
      task_type: "lesson-reinforcement",
      title: `Reinforce: ${tm.topic}`,
      description: `Practice what you covered with your tutor: ${tm.concepts.slice(0, 4).join(", ")}.`,
      is_completed: false,
      is_locked: false,
      task_date: today,
      task_payload: {
        booking_id: rec.booking_id,
        subject_name: tm.subject_name,
        topic: tm.topic,
        concepts: tm.concepts,
        weak_concepts: tm.weak_concepts,
      },
      concepts_covered: tm.concepts,
      selection_reason: "Auto-generated from tutor lesson",
    });

    await sb.from("lesson_recordings").update({ status: "ready" }).eq("id", recording_id);

    return new Response(JSON.stringify({ ok: true, transcript_chars: fullText.length, topic: tm.topic }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-lesson-recording error:", e);
    try {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { recording_id } = await req.clone().json();
      if (recording_id) await sb.from("lesson_recordings").update({ status: "failed", error_message: String(e) }).eq("id", recording_id);
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
