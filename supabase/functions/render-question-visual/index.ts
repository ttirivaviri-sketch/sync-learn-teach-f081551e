/**
 * render-question-visual Edge Function
 *
 * Generates a past-paper-style diagram via Nano Banana (google/gemini-2.5-flash-image)
 * and caches it in the public `question-diagrams` storage bucket. Returns a public URL.
 *
 * POST body: { imagePrompt: string, caption?: string }
 * Returns: { url: string, cached: boolean }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { corsHeaders } from "../_shared/ai-config.ts";

const BUCKET = "question-diagrams";

async function md5(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { imagePrompt } = await req.json();
    if (!imagePrompt || typeof imagePrompt !== "string") {
      return new Response(
        JSON.stringify({ error: "imagePrompt is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Cache key based on prompt
    const hash = await md5(imagePrompt);
    const filePath = `${hash}.png`;

    // Check cache first
    const { data: existing } = await supabase
      .storage
      .from(BUCKET)
      .list("", { search: filePath, limit: 1 });

    if (existing && existing.some((f) => f.name === filePath)) {
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      return new Response(
        JSON.stringify({ url: pub.publicUrl, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build a past-paper-style prompt wrapper
    const styledPrompt = `Generate a clean, exam past-paper-style diagram suitable for a printed examination question.

Style requirements:
- Black ink on plain white background
- Clear line art, no shading, no colour, no photorealism
- Labels in plain sans-serif text, with letters (A, B, C...) or arrows where needed
- Centered composition, clear margins
- Looks like it was scanned from a real GCSE / A-Level / IGCSE / IB / ZIMSEC exam paper

Diagram requested: ${imagePrompt}`;

    // Call Nano Banana
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: styledPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) throw new Error("Rate limit — please try again shortly.");
      if (aiResp.status === 402) throw new Error("AI credits exhausted.");
      const t = await aiResp.text();
      console.error("Nano Banana error:", aiResp.status, t);
      throw new Error("Image generation failed");
    }

    const aiData = await aiResp.json();
    const dataUrl: string | undefined =
      aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!dataUrl?.startsWith("data:image/")) {
      throw new Error("AI returned no image");
    }

    // Strip data URL prefix and decode
    const base64 = dataUrl.split(",")[1];
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Upload
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, binary, {
        contentType: "image/png",
        upsert: true,
      });
    if (upErr) {
      console.error("Upload error:", upErr);
      throw new Error("Failed to cache diagram");
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

    return new Response(
      JSON.stringify({ url: pub.publicUrl, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("render-question-visual error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
