/**
 * transcribe-lesson-chunk
 *
 * Live partial transcript with speaker diarization. The client tells us which
 * participant produced the audio chunk (tutor or learner) so we can label it
 * immediately without waiting for the post-lesson pipeline.
 *
 * Body: {
 *   audio_base64: string,
 *   mime_type?: string,
 *   speaker_hint?: "tutor" | "learner",
 *   display_name?: string,
 * }
 * Response: { text: string, speaker: "tutor" | "learner" | "unknown" }
 */
import { corsHeaders } from "../_shared/ai-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const { audio_base64, mime_type, speaker_hint, display_name } = await req.json();
    if (!audio_base64 || typeof audio_base64 !== "string") {
      return new Response(JSON.stringify({ error: "audio_base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const speaker: "tutor" | "learner" | "unknown" =
      speaker_hint === "tutor" || speaker_hint === "learner" ? speaker_hint : "unknown";
    const mime = mime_type || "audio/webm";

    const systemPrompt =
      `You are an audio transcription engine for a tutoring session. The audio comes from the ${speaker === "unknown" ? "session" : `${speaker} (${display_name || speaker})`}. ` +
      `Transcribe the audio to plain text in the same language spoken. Output ONLY the transcript text — no preamble, quotes, or labels.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio:" },
              { type: "input_audio", input_audio: { data: audio_base64, format: mime.includes("wav") ? "wav" : "webm" } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("[transcribe-lesson-chunk] gateway error", resp.status, txt);
      return new Response(JSON.stringify({ error: "Transcription failed", status: resp.status }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return new Response(JSON.stringify({ text, speaker }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-lesson-chunk error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
