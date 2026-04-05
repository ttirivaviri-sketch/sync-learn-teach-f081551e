import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Agent type mapping from event type
const eventToAgent: Record<string, string> = {
  error: "debug",
  user_behavior: "frontend",
  backend: "backend",
  learning: "learning",
  revenue: "monetization",
};

const eventToTaskType: Record<string, string> = {
  error: "bug",
  user_behavior: "ux",
  backend: "backend",
  learning: "learning",
  revenue: "monetization",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    const { event_type, source, severity, data } = body;
    if (!event_type || !source) {
      return new Response(JSON.stringify({ error: "event_type and source required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Log the event
    const { data: event, error: eventError } = await supabase
      .from("sail_events")
      .insert({
        event_type,
        source,
        severity: severity || "low",
        payload: data || {},
      })
      .select()
      .single();

    if (eventError) throw eventError;

    // 2. Determine agent and risk
    const agent = eventToAgent[event_type] || "reviewer";
    const taskType = eventToTaskType[event_type] || "bug";
    const riskLevel = severity === "high" ? "high" : severity === "medium" ? "medium" : "low";
    const approvalRequired = riskLevel !== "low";

    // 3. Create a task for the agent
    const { data: task, error: taskError } = await supabase
      .from("sail_tasks")
      .insert({
        type: taskType,
        priority: severity === "high" ? "high" : severity === "medium" ? "medium" : "low",
        status: "pending",
        agent,
        title: `[${agent.toUpperCase()}] ${event_type} detected from ${source}`,
        description: JSON.stringify(data || {}, null, 2),
        context: { event_id: event.id, source, original_data: data },
        risk_level: riskLevel,
        approval_required: approvalRequired,
      })
      .select()
      .single();

    if (taskError) throw taskError;

    // 4. Update event with task reference
    await supabase
      .from("sail_events")
      .update({ task_id: task.id, processed: true })
      .eq("id", event.id);

    // 5. Log agent action
    const startTime = Date.now();

    // For low-risk tasks, auto-advance to review
    if (!approvalRequired) {
      await supabase
        .from("sail_tasks")
        .update({ status: "review" })
        .eq("id", task.id);
    }

    await supabase.from("sail_agent_logs").insert({
      task_id: task.id,
      agent,
      action: `process_${event_type}`,
      input: { event_id: event.id, severity },
      output: { task_status: approvalRequired ? "pending" : "review", risk_level: riskLevel },
      duration_ms: Date.now() - startTime,
      success: true,
    });

    return new Response(JSON.stringify({
      success: true,
      task_id: task.id,
      event_id: event.id,
      agent,
      risk_level: riskLevel,
      approval_required: approvalRequired,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("SAIL Agent error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
