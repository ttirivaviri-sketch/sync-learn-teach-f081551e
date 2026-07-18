/**
 * process-lesson-recording
 *
 * Post-lesson pipeline. Given a lesson_recordings row, this function:
 *   1. Downloads audio from the `lesson-audio` storage bucket.
 *   2. Produces a strictly diarised transcript (Tutor / Learner / unknown).
 *   3. Generates structured notes for learner + tutor and an initial topic mapping.
 *   4. Runs a second AI pass to score each concept (confidence + evidence quotes
 *      + recommendation) against the transcript.
 *   5. Writes concept_attempts / weak_concepts using confidence thresholds and
 *      schedules a lesson-reinforcement daily task. Reinforcement set generation
 *      (`generate-lesson-reinforcement`) is triggered as fire-and-forget.
 *
 * Body: { recording_id: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders, reportTokenUsage } from "../_shared/ai-config.ts";
import { KATEX_RULES } from "../_shared/katex-rules.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const gatewayChat = async (body: Record<string, unknown>, attributeTo?: string | null) => {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`AI gateway ${r.status}: ${await r.text()}`);
  const json = await r.json();
  if (attributeTo && json?.usage) {
    reportTokenUsage({
      userId: attributeTo,
      bucket: "misc",
      tokensIn: Number(json.usage.prompt_tokens ?? 0),
      tokensOut: Number(json.usage.completion_tokens ?? 0),
    });
  }
  return json;
};

const toBase64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

type Speaker = "Tutor" | "Learner" | "Unknown";

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
      .from("lesson_recordings").select("*").eq("id", recording_id).single();
    if (recErr || !rec) throw new Error(`Recording not found: ${recErr?.message}`);

    // ── Consent gate ──────────────────────────────────────────────────────
    const { data: consents } = await sb
      .from("lesson_consents")
      .select("user_id, transcription_consent, notes_consent")
      .eq("booking_id", rec.booking_id);
    const hasConsent = (uid: string, key: "transcription_consent" | "notes_consent") =>
      !!consents?.find((c) => c.user_id === uid && c[key]);
    if (!hasConsent(rec.tutor_id, "transcription_consent") || !hasConsent(rec.learner_id, "transcription_consent")) {
      await sb.from("lesson_recordings").update({ status: "failed", error_message: "Both parties must consent to transcription" }).eq("id", recording_id);
      return new Response(JSON.stringify({ error: "missing_consent" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await sb.from("lesson_recordings").update({ status: "transcribing" }).eq("id", recording_id);

    // ── 1. Download audio ─────────────────────────────────────────────────
    const dl = await sb.storage.from("lesson-audio").download(rec.storage_path);
    if (dl.error || !dl.data) throw new Error(`Audio download failed: ${dl.error?.message}`);
    const audioBytes = new Uint8Array(await dl.data.arrayBuffer());
    const audioB64 = toBase64(audioBytes);
    const mime = dl.data.type || "audio/webm";

    // ── 2. Diarised transcript ────────────────────────────────────────────
    const transcriptResp = await gatewayChat({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You are an audio transcription engine for a one-on-one tutoring lesson with exactly two voices: the Tutor and the Learner. " +
            "Produce a diarised transcript using ONLY the labels 'Tutor:' and 'Learner:' (or 'Unknown:' if a segment is truly unintelligible). " +
            "Put one utterance per line. Preserve every word; do not summarise.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this tutoring lesson:" },
            { type: "input_audio", input_audio: { data: audioB64, format: mime.includes("wav") ? "wav" : "webm" } },
          ],
        },
      ],
    }, rec.learner_id);
    const fullText: string = transcriptResp.choices?.[0]?.message?.content?.trim() ?? "";
    if (!fullText) throw new Error("Empty transcript");

    const segments = fullText.split(/\n+/).filter(Boolean).map((line: string, i: number) => {
      const m = line.match(/^(Tutor|Learner|Unknown)\s*:\s*(.*)$/i);
      const speaker: Speaker = m ? ((m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()) as Speaker) : "Unknown";
      return { idx: i, speaker, text: m ? m[2] : line };
    });

    await sb.from("lesson_transcripts").upsert({
      recording_id, booking_id: rec.booking_id, full_text: fullText, segments, language: "en",
    }, { onConflict: "recording_id" });

    // ── 3. Notes + initial topic mapping ──────────────────────────────────
    const notesResp = await gatewayChat({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: `You produce structured study notes from a tutoring lesson transcript. Always be specific and exam-focused.\n\n${KATEX_RULES}` },
        { role: "user", content: `Transcript:\n${fullText.slice(0, 30000)}\n\nReturn structured notes for the learner AND the tutor, plus a topic mapping of what was covered.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "lesson_notes",
          description: "Structured lesson notes",
          parameters: {
            type: "object",
            properties: {
              learner_notes: { type: "object", properties: {
                summary: { type: "string" },
                key_points: { type: "array", items: { type: "string" } },
                action_items: { type: "array", items: { type: "string" } },
                vocabulary: { type: "array", items: { type: "object", properties: { term: { type: "string" }, definition: { type: "string" } }, required: ["term", "definition"] } },
              }, required: ["summary", "key_points", "action_items", "vocabulary"] },
              tutor_notes: { type: "object", properties: {
                summary: { type: "string" },
                key_points: { type: "array", items: { type: "string" } },
                action_items: { type: "array", items: { type: "string" } },
                vocabulary: { type: "array", items: { type: "object", properties: { term: { type: "string" }, definition: { type: "string" } }, required: ["term", "definition"] } },
              }, required: ["summary", "key_points", "action_items", "vocabulary"] },
              topic_mapping: { type: "object", properties: {
                subject_name: { type: "string" },
                topic: { type: "string" },
                concepts: { type: "array", items: { type: "string" } },
                weak_concepts: { type: "array", items: { type: "string" } },
                coverage_score: { type: "number", minimum: 0, maximum: 1 },
              }, required: ["subject_name", "topic", "concepts", "weak_concepts", "coverage_score"] },
            },
            required: ["learner_notes", "tutor_notes", "topic_mapping"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "lesson_notes" } },
    }, rec.learner_id);

    const argsStr = notesResp.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!argsStr) throw new Error("No notes returned");
    const parsed = JSON.parse(argsStr);

    // Persist notes (only for users who consented to AI notes)
    const noteRows: any[] = [];
    if (hasConsent(rec.learner_id, "notes_consent")) {
      noteRows.push({
        booking_id: rec.booking_id, owner_id: rec.learner_id, audience: "learner",
        summary: parsed.learner_notes.summary,
        key_points: parsed.learner_notes.key_points,
        action_items: parsed.learner_notes.action_items,
        vocabulary: parsed.learner_notes.vocabulary,
      });
    }
    if (hasConsent(rec.tutor_id, "notes_consent")) {
      noteRows.push({
        booking_id: rec.booking_id, owner_id: rec.tutor_id, audience: "tutor",
        summary: parsed.tutor_notes.summary,
        key_points: parsed.tutor_notes.key_points,
        action_items: parsed.tutor_notes.action_items,
        vocabulary: parsed.tutor_notes.vocabulary,
      });
    }
    if (noteRows.length) await sb.from("lesson_notes").upsert(noteRows, { onConflict: "booking_id,audience" });

    const tm = parsed.topic_mapping;

    // ── 4. Confidence review pass ─────────────────────────────────────────
    let reviewed: Array<{ concept: string; confidence: number; recommendation: "reinforce" | "review" | "skip"; evidence_quotes: string[] }> = [];
    try {
      const reviewResp = await gatewayChat({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You audit AI-generated topic mappings for tutoring lessons. For each concept claimed, judge how convincingly the transcript demonstrates it. Confidence 0-1: 1 = explicit & worked through, 0.5 = mentioned briefly, <0.3 = no real evidence." },
          { role: "user", content: `Transcript:\n${fullText.slice(0, 24000)}\n\nClaimed concepts: ${JSON.stringify(tm.concepts)}\nClaimed weak concepts: ${JSON.stringify(tm.weak_concepts)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "review_concepts",
            parameters: {
              type: "object",
              properties: {
                items: { type: "array", items: { type: "object", properties: {
                  concept: { type: "string" },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  recommendation: { type: "string", enum: ["reinforce", "review", "skip"] },
                  evidence_quotes: { type: "array", items: { type: "string" } },
                }, required: ["concept", "confidence", "recommendation", "evidence_quotes"] } },
              },
              required: ["items"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "review_concepts" } },
      }, rec.learner_id);
      const reviewArgs = reviewResp.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      if (reviewArgs) reviewed = JSON.parse(reviewArgs).items ?? [];
    } catch (e) {
      console.warn("[process-lesson-recording] review pass failed, continuing without confidence", e);
    }

    const avgConfidence = reviewed.length ? reviewed.reduce((s, r) => s + r.confidence, 0) / reviewed.length : null;

    await sb.from("lesson_topic_mapping").insert({
      booking_id: rec.booking_id,
      learner_id: rec.learner_id,
      subject_name: tm.subject_name,
      topic: tm.topic,
      concepts: tm.concepts,
      weak_concepts: tm.weak_concepts,
      coverage_score: tm.coverage_score,
      confidence: avgConfidence,
      evidence: reviewed,
      recommendation: avgConfidence == null ? null : avgConfidence >= 0.6 ? "reinforce" : "review",
    });

    // ── 5. Feed StudyMode (only learner consented to notes feeds reinforcement) ──
    if (hasConsent(rec.learner_id, "notes_consent")) {
      const confidenceFor = (c: string) => reviewed.find((r) => r.concept.toLowerCase() === c.toLowerCase())?.confidence ?? avgConfidence ?? tm.coverage_score ?? 0.5;

      // 5a. concept_attempts — only for concepts we are confident were actually covered
      const goodConcepts: string[] = (tm.concepts ?? []).filter((c: string) => confidenceFor(c) >= 0.6);
      if (goodConcepts.length) {
        await sb.from("concept_attempts").insert(goodConcepts.map((c) => ({
          user_id: rec.learner_id,
          concept_label: c,
          subject_name: tm.subject_name,
          topic: tm.topic,
          surface: "tutor_lesson",
          was_correct: tm.coverage_score >= 0.6,
          marks_awarded: tm.coverage_score >= 0.6 ? 1 : 0,
          marks_possible: 1,
          source_id: rec.booking_id,
          source_table: "lesson_recordings",
        })));
      }

      // 5b. weak_concepts upsert with severity thresholds
      const weakRows = (tm.weak_concepts ?? []).map((c: string) => {
        const conf = confidenceFor(c);
        if (conf < 0.5) return null;
        return {
          user_id: rec.learner_id,
          subject: tm.subject_name,
          curriculum: "ZIMSEC",
          concept: c,
          topic: tm.topic,
          weakness_score: Math.min(1, (1 - (tm.coverage_score ?? 0.5)) * (conf >= 0.75 ? 1 : 0.7)),
          last_seen_at: new Date().toISOString(),
        };
      }).filter(Boolean);
      if (weakRows.length) {
        await sb.from("weak_concepts").upsert(weakRows as any[], {
          onConflict: "user_id,subject,curriculum,concept",
        });
      }

      // 5c. Reinforcement daily task
      const today = new Date().toISOString().slice(0, 10);
      await sb.from("daily_tasks").insert({
        user_id: rec.learner_id,
        task_type: "lesson-reinforcement",
        title: `Reinforce: ${tm.topic}`,
        description: `Practice what you covered with your tutor: ${(tm.concepts ?? []).slice(0, 4).join(", ")}.`,
        is_completed: false,
        is_locked: false,
        task_date: today,
        task_payload: {
          booking_id: rec.booking_id,
          recording_id,
          subject_name: tm.subject_name,
          topic: tm.topic,
          concepts: goodConcepts,
          weak_concepts: tm.weak_concepts,
        },
        concepts_covered: goodConcepts,
        selection_reason: "Auto-generated from tutor lesson",
      });

      // 5d. Trigger reinforcement set generation (fire-and-forget)
      fetch(`${SUPABASE_URL}/functions/v1/generate-lesson-reinforcement`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
        body: JSON.stringify({ recording_id }),
      }).catch((e) => console.error("[process-lesson-recording] reinforcement trigger failed", e));
    }

    await sb.from("lesson_recordings").update({ status: "ready" }).eq("id", recording_id);

    return new Response(JSON.stringify({ ok: true, transcript_chars: fullText.length, topic: tm.topic, avg_confidence: avgConfidence }), {
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
