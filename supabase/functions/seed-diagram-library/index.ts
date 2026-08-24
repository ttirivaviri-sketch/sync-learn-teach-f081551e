/**
 * seed-diagram-library — one-shot idempotent seeder for the study-diagram
 * library. It ONLY runs while `library_system_resources` contains zero rows
 * with kind='diagram'; once seeded it is permanently inert and returns 409.
 *
 * POST body: { rows: Array<{ title, kind:'diagram', subject, topic,
 *   curriculum, grade_levels, thumbnail_url, description, diagram_spec }> }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/ai-config.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { count, error: cntErr } = await supabase
      .from("library_system_resources")
      .select("id", { count: "exact", head: true })
      .eq("kind", "diagram");
    if (cntErr) throw cntErr;
    if ((count ?? 0) > 0) return json({ error: "Already seeded", count }, 409);

    const body = await req.json().catch(() => null);
    const rows = Array.isArray(body?.rows) ? body.rows : null;
    if (!rows?.length) return json({ error: "rows[] required" }, 400);

    const clean = rows.map((r: Record<string, unknown>) => ({
      title: String(r.title ?? "").slice(0, 300),
      kind: "diagram",
      subject: r.subject ?? null,
      topic: r.topic ?? null,
      curriculum: r.curriculum ?? null,
      grade_levels: Array.isArray(r.grade_levels) ? r.grade_levels : [],
      thumbnail_url: r.thumbnail_url ?? null,
      description: r.description ?? null,
      diagram_spec: r.diagram_spec ?? null,
    }));
    if (clean.some((r) => !r.title || !r.diagram_spec))
      return json({ error: "every row needs a title and diagram_spec" }, 400);

    const { error: insErr, count: inserted } = await supabase
      .from("library_system_resources")
      .insert(clean, { count: "exact" });
    if (insErr) throw insErr;

    return json({ inserted: inserted ?? clean.length });
  } catch (err) {
    console.error("seed-diagram-library error:", err);
    return json({ error: (err as Error).message || "Unexpected error" }, 500);
  }
});
