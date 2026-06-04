/**
 * transcribe-lesson-chunk
 *
 * Accepts a short audio chunk (base64, webm/opus or wav) and returns a partial
 * transcript via Gemini 2.5 Flash on the Lovable AI Gateway.
 *
 * Body: { audio_base64: string, mime_type?: string }
 * Response: { text: string }
 */
import { corsHeaders } from "../_shared/ai-config.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const { audio_base64, mime_type } = await req.json();
    if (!audio_base64 || typeof audio_base64 !== "string") {
      return new Response(JSON.stringify({ error: "audio_base64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mime = mime_type || "audio/webm";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an audio transcription engine. Transcribe the user's audio to plain text in the same language spoken. Output ONLY the transcript text, no preamble, no quotes, no labels.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio:" },
              {
                type: "input_audio",
                input_audio: { data: audio_base64, format: mime.includes("wav") ? "wav" : "webm" },
              },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("[transcribe-lesson-chunk] gateway error", resp.status, txt);
      return new Response(JSON.stringify({ error: "Transcription failed", status: resp.status }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() ?? "";
    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-lesson-chunk error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
