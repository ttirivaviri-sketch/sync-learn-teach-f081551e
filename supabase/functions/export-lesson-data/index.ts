/**
 * export-lesson-data
 *
 * Returns a JSON bundle of the caller's lesson recordings, transcripts, notes,
 * topic mappings, consents, retention settings, and reinforcement sets. Used by
 * the user-facing Data & Compliance screen ("Export my data").
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const sb = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await sb.auth.getUser();
    const uid = userData?.user?.id;
    if (!uid) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [rec, tx, notes, map, cons, ret, reinf] = await Promise.all([
      sb.from("lesson_recordings").select("*").or(`learner_id.eq.${uid},tutor_id.eq.${uid}`),
      sb.from("lesson_transcripts").select("*"),
      sb.from("lesson_notes").select("*").eq("owner_id", uid),
      sb.from("lesson_topic_mapping").select("*").eq("learner_id", uid),
      sb.from("lesson_consents").select("*").eq("user_id", uid),
      sb.from("lesson_retention_settings").select("*").eq("user_id", uid),
      sb.from("lesson_reinforcement_sets").select("*").eq("learner_id", uid),
    ]);

    return new Response(JSON.stringify({
      exported_at: new Date().toISOString(),
      user_id: uid,
      recordings: rec.data ?? [],
      transcripts: tx.data ?? [],
      notes: notes.data ?? [],
      topic_mappings: map.data ?? [],
      consents: cons.data ?? [],
      retention_settings: ret.data ?? [],
      reinforcement_sets: reinf.data ?? [],
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "Content-Disposition": `attachment; filename="studysync-lesson-data-${uid}.json"` },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
