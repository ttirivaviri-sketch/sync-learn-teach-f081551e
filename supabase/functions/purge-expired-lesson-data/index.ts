/**
 * purge-expired-lesson-data
 *
 * Walks `lesson_recordings` and deletes audio + transcripts past each user's
 * `lesson_retention_settings.auto_delete_after_days`. If `keep_notes_only` is
 * true (default) the AI notes + topic mappings are kept so StudyMode
 * reinforcement still has context. Designed to be called from pg_cron daily.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/ai-config.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: settings } = await sb.from("lesson_retention_settings").select("user_id,auto_delete_after_days,keep_notes_only");
    const defaultDays = 90;

    // Treat users without explicit settings as 90-day retention.
    const { data: allUsersWithRecs } = await sb.from("lesson_recordings").select("learner_id,tutor_id");
    const userIds = new Set<string>();
    (allUsersWithRecs ?? []).forEach((r: any) => { userIds.add(r.learner_id); userIds.add(r.tutor_id); });
    const byUser: Record<string, { days: number; keepNotes: boolean }> = {};
    for (const uid of userIds) {
      const s = settings?.find((x) => x.user_id === uid);
      byUser[uid] = { days: s?.auto_delete_after_days ?? defaultDays, keepNotes: s?.keep_notes_only ?? true };
    }

    let purged = 0, audioDeleted = 0;
    for (const [uid, cfg] of Object.entries(byUser)) {
      const cutoff = new Date(Date.now() - cfg.days * 86_400_000).toISOString();
      const { data: oldRecs } = await sb
        .from("lesson_recordings")
        .select("id,storage_path,booking_id")
        .or(`learner_id.eq.${uid},tutor_id.eq.${uid}`)
        .lt("created_at", cutoff);
      for (const r of oldRecs ?? []) {
        if (r.storage_path) {
          const { error } = await sb.storage.from("lesson-audio").remove([r.storage_path]);
          if (!error) audioDeleted++;
        }
        await sb.from("lesson_transcripts").delete().eq("recording_id", r.id);
        if (!cfg.keepNotes) {
          await sb.from("lesson_notes").delete().eq("booking_id", r.booking_id);
          await sb.from("lesson_topic_mapping").delete().eq("booking_id", r.booking_id);
        }
        await sb.from("lesson_recordings").delete().eq("id", r.id);
        purged++;
      }
    }

    return new Response(JSON.stringify({ ok: true, purged, audio_deleted: audioDeleted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
