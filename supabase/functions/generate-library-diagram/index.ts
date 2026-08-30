/**
 * generate-library-diagram Edge Function
 *
 * Renders a library diagram PNG from its stored diagram_spec (spec-first
 * pipeline) and caches it permanently:
 *   1. Load the library_system_resources row (kind='diagram').
 *   2. If image_url is already set → return it (cache hit, zero AI cost).
 *   3. Otherwise compile the spec into a locked StudySync-style image prompt,
 *      render via the AI gateway image model, upload to the public
 *      'library-diagrams' bucket, save image_url on the row, return the URL.
 *
 * Generation happens once per diagram EVER — every subsequent student gets
 * the cached asset. A row-level "generating" marker prevents stampedes.
 *
 * POST body: { resourceId: string }
 * Returns:   { url: string, cached: boolean }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, reportTokenUsage, requireCaller } from "../_shared/ai-config.ts";

const BUCKET = "library-diagrams";
/** Bucket is private (workspace blocks public buckets) → serve signed URLs. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days


interface SpecElement { label: string; role: string }
interface DiagramSpec {
  title: string;
  caption?: string;
  subject?: string;
  elements?: SpecElement[];
  relationships?: string[];
}

/** Compile the structured spec into a rigid, style-locked image prompt. */
function buildPrompt(spec: DiagramSpec): string {
  const labels = (spec.elements ?? [])
    .map((e) => `- "${e.label}" — ${e.role}`)
    .join("\n");
  const rels = (spec.relationships ?? []).map((r) => `- ${r}`).join("\n");

  return `Create a beautiful educational study diagram titled "${spec.title}".

${spec.caption ?? ""}

STYLE (must follow exactly — StudySync house style):
- Clean flat vector-illustration style on a soft cream/off-white background
- Bold black title text at the top
- Clear sans-serif labels with thin leader lines or arrows pointing at the right parts
- A restrained modern palette (2-4 accent colours), no photorealism, no clutter
- Suitable for a secondary-school student revising for exams
- All text in English, spelled EXACTLY as given below

LABELS THAT MUST APPEAR (exact spelling, all of them, correctly placed):
${labels}

RELATIONSHIPS / ARROWS TO SHOW:
${rels}

Do not add any labels that are not listed. Do not misspell any label. No watermark.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  // Paid AI image generation — require a verified session.
  const auth = await requireCaller(req);
  if (auth.response) return auth.response;
  const authedUserId = auth.caller.userId;

  try {
    const { resourceId } = await req.json();
    if (!resourceId || typeof resourceId !== "string") {
      return new Response(JSON.stringify({ error: "resourceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Load the diagram row
    const { data: row, error: rowErr } = await supabase
      .from("library_system_resources")
      .select("id, kind, title, image_url, diagram_spec")
      .eq("id", resourceId)
      .eq("kind", "diagram")
      .single();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Diagram not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Cache hit — image already rendered (bucket is private → re-sign)
    if (row.image_url) {
      const cachedPath = `${row.id}.png`;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(cachedPath, SIGNED_URL_TTL);
      return new Response(
        JSON.stringify({ url: signed?.signedUrl ?? row.image_url, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    if (!row.diagram_spec) {
      return new Response(
        JSON.stringify({ error: "Diagram has no spec to render from" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Render via the AI gateway image model.
    //    The image model intermittently replies with text only (no image part),
    //    so retry a couple of times with an increasingly explicit instruction
    //    before surfacing an error to the student.
    const basePrompt = buildPrompt(row.diagram_spec as DiagramSpec);

    /** Pull the image out of whichever shape the gateway returned. */
    const extractImage = (data: unknown): string | undefined => {
      const msg = (data as any)?.choices?.[0]?.message;
      const candidates = [
        msg?.images?.[0]?.image_url?.url,
        msg?.images?.[0]?.url,
        (data as any)?.data?.[0]?.url,
      ].filter((v) => typeof v === "string" && v.startsWith("data:image/"));
      if (candidates[0]) return candidates[0];
      const b64 = msg?.images?.[0]?.b64_json ?? (data as any)?.data?.[0]?.b64_json;
      return typeof b64 === "string" && b64.length > 0 ? `data:image/png;base64,${b64}` : undefined;
    };

    let dataUrl: string | undefined;
    let lastStatus = 0;

    for (let attempt = 0; attempt < 3 && !dataUrl; attempt++) {
      const prompt =
        attempt === 0
          ? basePrompt
          : `${basePrompt}\n\nIMPORTANT: Respond with the rendered IMAGE itself. Do not reply with text, questions or a description.`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      lastStatus = aiResp.status;

      if (!aiResp.ok) {
        // Non-retryable, user-actionable failures bail out immediately.
        if (aiResp.status === 429 || aiResp.status === 402) {
          const message =
            aiResp.status === 402
              ? "AI credits exhausted. Please top up to generate diagrams."
              : "Rate limit reached — please try again shortly.";
          return new Response(JSON.stringify({ error: message, retryable: aiResp.status === 429 }), {
            status: aiResp.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await aiResp.text();
        console.error("Image model error:", aiResp.status, t.slice(0, 500));
        // 5xx from the gateway is worth another attempt.
        if (aiResp.status < 500) throw new Error("Diagram rendering failed");
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }


      const aiData = await aiResp.json();
      if (aiData?.usage) {
        reportTokenUsage({
          userId: authedUserId,
          bucket: "misc",
          tokensIn: Number(aiData.usage.prompt_tokens ?? 0),
          tokensOut: Number(aiData.usage.completion_tokens ?? 0),
        });
      }

      dataUrl = extractImage(aiData);
      if (!dataUrl) {
        console.warn(
          `No image on attempt ${attempt + 1}; text was:`,
          String(aiData?.choices?.[0]?.message?.content ?? "").slice(0, 300),
        );
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }

    if (!dataUrl) {
      console.error("Diagram render gave no image after retries; last status", lastStatus);
      return new Response(
        JSON.stringify({
          error:
            "The illustrator couldn't draw this diagram just now. Please tap to try again in a moment.",
          retryable: true,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    // 4. Upload to the private bucket
    const base64 = dataUrl.split(",")[1];
    const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const filePath = `${row.id}.png`;

    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, binary, { contentType: "image/png", upsert: true });
    if (upErr) {
      console.error("Upload error:", upErr);
      throw new Error("Failed to cache diagram");
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) throw new Error("Failed to sign diagram URL");

    // 5. Persist the storage path marker on the row so later opens are cache hits
    const { error: updErr } = await supabase
      .from("library_system_resources")
      .update({ image_url: filePath })
      .eq("id", row.id);
    if (updErr) console.error("Row update error:", updErr);

    return new Response(
      JSON.stringify({ url: signed.signedUrl, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    console.error("generate-library-diagram error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
