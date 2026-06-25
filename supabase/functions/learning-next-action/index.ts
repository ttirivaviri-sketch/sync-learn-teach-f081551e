// Universal Next Action service — picks the single best next thing for a learner
// based on the unified learner_state table (derived from learning_events).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NextAction {
  kind: "remediate" | "practice" | "advance" | "homework" | "lesson_recap" | "onboard";
  priority: number; // 0-100
  title: string;
  reason: string;
  topic?: string;
  subject_id?: string | null;
  route?: string;
  cta?: string;
  meta?: Record<string, unknown>;
}

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

    const actions: NextAction[] = [];

    // 1. Pending school homework with closest due date
    const { data: hw } = await supabase
      .from("school_homework")
      .select("id, title, due_at, class_id, status")
      .eq("status", "published")
      .order("due_at", { ascending: true })
      .limit(5);
    if (hw && hw.length) {
      // Filter homework user hasn't submitted
      const ids = hw.map((h) => h.id);
      const { data: submissions } = await supabase
        .from("school_homework_responses")
        .select("homework_id, status")
        .in("homework_id", ids)
        .eq("student_id", userId);
      const submittedIds = new Set((submissions ?? []).filter((s) => s.status === "submitted" || s.status === "graded").map((s) => s.homework_id));
      const pending = hw.filter((h) => !submittedIds.has(h.id));
      const next = pending[0];
      if (next) {
        const dueMs = next.due_at ? new Date(next.due_at).getTime() - Date.now() : Infinity;
        const hours = dueMs / 3_600_000;
        actions.push({
          kind: "homework",
          priority: hours < 24 ? 95 : hours < 72 ? 80 : 60,
          title: next.title ?? "Pending homework",
          reason: hours < 24 ? "Due in under 24 hours" : hours < 72 ? `Due in ${Math.round(hours)}h` : "Awaiting submission",
          route: "/school/student",
          cta: "Open homework",
          meta: { homework_id: next.id, due_at: next.due_at },
        });
      }
    }

    // 2. Critical / warning topics from learner_state
    const { data: state } = await supabase
      .from("learner_state")
      .select("subject_id, topic_name, ewma_score_pct, attempts, risk_level, mastery_pct, last_event_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (state && state.length) {
      const critical = state.filter((s) => s.risk_level === "critical");
      const warning = state.filter((s) => s.risk_level === "warning");
      const mastered = state.filter((s) => s.risk_level === "mastered");

      const top = critical[0];
      if (top) {
        actions.push({
          kind: "remediate",
          priority: 90,
          title: `Re-teach: ${top.topic_name}`,
          reason: `Recent average ${Math.round(Number(top.ewma_score_pct ?? 0))}% across ${top.attempts} attempts`,
          topic: top.topic_name,
          subject_id: top.subject_id,
          route: "/learner/study",
          cta: "Start guided session",
        });
      }
      const warn = warning[0];
      if (warn && warn.topic_name !== top?.topic_name) {
        actions.push({
          kind: "practice",
          priority: 70,
          title: `Practice: ${warn.topic_name}`,
          reason: `Mid-range mastery (${Math.round(Number(warn.ewma_score_pct ?? 0))}%) — drill to lock it in`,
          topic: warn.topic_name,
          subject_id: warn.subject_id,
          route: "/learner/study",
          cta: "Practice now",
        });
      }
      const mast = mastered[0];
      if (mast) {
        actions.push({
          kind: "advance",
          priority: 50,
          title: `Stretch beyond ${mast.topic_name}`,
          reason: `You're at ${Math.round(Number(mast.mastery_pct ?? 0))}% — try harder questions or the next topic`,
          topic: mast.topic_name,
          subject_id: mast.subject_id,
          route: "/learner/study",
          cta: "Step up",
        });
      }
    } else {
      actions.push({
        kind: "onboard",
        priority: 40,
        title: "Pick your first topic",
        reason: "We don't have any learning history yet",
        route: "/learner/study",
        cta: "Browse subjects",
      });
    }

    // 3. Lesson reinforcement waiting (completed lesson with no reinforcement run)
    const { data: reinf } = await supabase
      .from("lesson_reinforcement_sets")
      .select("id, booking_id, created_at, completed_at")
      .eq("learner_id", userId)
      .is("completed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (reinf && reinf.length) {
      actions.push({
        kind: "lesson_recap",
        priority: 75,
        title: "Reinforce your last lesson",
        reason: "Quick quiz + flashcards from your tutor session",
        route: "/learner/activity",
        cta: "Start recap",
        meta: { reinforcement_id: reinf[0].id },
      });
    }

    actions.sort((a, b) => b.priority - a.priority);
    const primary = actions[0] ?? null;
    return new Response(JSON.stringify({ primary, actions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
