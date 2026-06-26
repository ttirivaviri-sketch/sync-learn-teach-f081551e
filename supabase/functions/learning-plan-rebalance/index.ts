// learning-plan-rebalance — autonomous scheduler that ensures high-risk
// topics from learner_state are surfaced in study_schedule for today/tomorrow.
// Idempotent: skips topics already scheduled within the next 2 days.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, anon, { global: { headers: { Authorization: auth } } });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    // Pull top risk topics from learner_state
    const { data: state } = await supabase
      .from("learner_state")
      .select("subject_id, topic_name, risk_level, ewma_score_pct, attempts")
      .eq("user_id", userId)
      .in("risk_level", ["critical", "warning"])
      .order("ewma_score_pct", { ascending: true })
      .limit(8);

    const candidates = (state ?? []).filter((s) => s.topic_name);
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ scheduled: 0, skipped: 0, reason: "no_risk_topics" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull existing schedule rows in the next 2 days to avoid duplicates
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const t2 = new Date(today.getTime() + 2 * 86400_000).toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("study_schedule")
      .select("topic_name, scheduled_date")
      .eq("user_id", userId)
      .gte("scheduled_date", todayStr)
      .lte("scheduled_date", t2);
    const seen = new Set((existing ?? []).map((r) => (r.topic_name ?? "").toLowerCase()));

    const rows: Array<Record<string, unknown>> = [];
    let dayOffset = 0;
    for (const c of candidates) {
      const key = (c.topic_name ?? "").toLowerCase();
      if (seen.has(key)) continue;
      const date = new Date(today.getTime() + dayOffset * 86400_000).toISOString().slice(0, 10);
      rows.push({
        user_id: userId,
        subject_id: c.subject_id,
        topic_name: c.topic_name,
        scheduled_date: date,
        due_date: date,
        task_type: c.risk_level === "critical" ? "remediation" : "practice",
        duration_minutes: c.risk_level === "critical" ? 30 : 20,
        task: c.risk_level === "critical"
          ? `Re-teach: ${c.topic_name} (avg ${Math.round(Number(c.ewma_score_pct ?? 0))}%)`
          : `Practice: ${c.topic_name}`,
        is_completed: false,
        completed: false,
      });
      seen.add(key);
      // Alternate today/tomorrow to spread load
      dayOffset = dayOffset === 0 ? 1 : 0;
      if (rows.length >= 4) break;
    }

    let inserted = 0;
    if (rows.length) {
      const { error: insErr, data: insData } = await supabase.from("study_schedule").insert(rows).select("id");
      if (insErr) throw insErr;
      inserted = insData?.length ?? 0;
    }

    return new Response(JSON.stringify({ scheduled: inserted, skipped: candidates.length - inserted, total_candidates: candidates.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
