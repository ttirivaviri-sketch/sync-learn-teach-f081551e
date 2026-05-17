import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

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

const agentSystemPrompts: Record<string, string> = {
  debug: "You are SAIL Debug Agent for StudySync (a tutoring + study app). Diagnose runtime/UI errors. Suggest a focused code patch (file path + diff or pseudo-diff). Be concise. NEVER claim to deploy.",
  frontend: "You are SAIL Frontend Agent. Analyse user-behaviour signals (drop-offs, friction). Propose a small UX/UI fix as a code patch sketch. NEVER claim to deploy.",
  backend: "You are SAIL Backend Agent. Analyse backend signals (slow queries, edge function failures, RLS gaps). Propose a fix sketch. NEVER claim to deploy.",
  learning: "You are SAIL Learning Agent. Improve study-mode pedagogy (mastery, recall, weak topics) given the signal. Propose a content/algorithm tweak. NEVER claim to deploy.",
  monetization: "You are SAIL Monetization Agent. Analyse revenue/subscription signals (churn, trial drop, plan friction). Propose a monetization patch. NEVER claim to deploy.",
  reviewer: "You are SAIL Reviewer Agent. Provide a neutral risk assessment and a suggested patch sketch. NEVER claim to deploy.",
};

async function runAgentLLM(agent: string, eventType: string, source: string, severity: string, payload: unknown): Promise<{ ok: boolean; data?: any; error?: string; status?: number; durationMs: number }> {
  const start = Date.now();
  if (!LOVABLE_API_KEY) {
    return { ok: false, error: "LOVABLE_API_KEY not configured", durationMs: 0 };
  }
  const system = agentSystemPrompts[agent] ?? agentSystemPrompts.reviewer;
  const userMsg = `Event: ${eventType}\nSource: ${source}\nSeverity: ${severity}\nPayload:\n${JSON.stringify(payload ?? {}, null, 2)}\n\nProduce a structured analysis.`;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "sail_analysis",
            description: "Structured SAIL agent analysis",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "1-2 sentence summary of the issue" },
                root_cause: { type: "string", description: "Most likely root cause" },
                proposed_patch: { type: "string", description: "Suggested code patch or change (file paths + diff sketch)" },
                risk_assessment: { type: "string", enum: ["low", "medium", "high"] },
                confidence: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["summary", "root_cause", "proposed_patch", "risk_assessment", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "sail_analysis" } },
      }),
    });

    const durationMs = Date.now() - start;
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `Gateway ${resp.status}: ${text.slice(0, 300)}`, status: resp.status, durationMs };
    }
    const json = await resp.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr = toolCall?.function?.arguments;
    if (!argsStr) {
      return { ok: false, error: "No tool call in response", durationMs };
    }
    let parsed: any;
    try { parsed = JSON.parse(argsStr); } catch (e) {
      return { ok: false, error: `Bad JSON args: ${(e as Error).message}`, durationMs };
    }
    return { ok: true, data: parsed, durationMs };
  } catch (e) {
    return { ok: false, error: (e as Error).message, durationMs: Date.now() - start };
  }
}

function formatPatch(analysis: any): string {
  return [
    `## Summary`,
    analysis.summary,
    ``,
    `## Root Cause`,
    analysis.root_cause,
    ``,
    `## Proposed Patch`,
    analysis.proposed_patch,
    ``,
    `## Risk: ${analysis.risk_assessment}  •  Confidence: ${Math.round((analysis.confidence ?? 0) * 100)}%`,
  ].join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const sailSecret = Deno.env.get("SAIL_SECRET") || Deno.env.get("CRON_SECRET");
    const internalHeader = req.headers.get("x-sail-secret");
    let authorized = !!(sailSecret && internalHeader && internalHeader === sailSecret);

    if (!authorized) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: userData, error: authErr } = await supabase.auth.getUser(
        authHeader.replace("Bearer ", "")
      );
      if (authErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: userData.user.id, _role: "admin",
      });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { event_type, source, severity, data } = body;
    if (!event_type || !source) {
      return new Response(JSON.stringify({ error: "event_type and source required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Log event
    const { data: event, error: eventError } = await supabase
      .from("sail_events")
      .insert({ event_type, source, severity: severity || "low", payload: data || {} })
      .select().single();
    if (eventError) throw eventError;

    // 2. Determine agent + risk
    const agent = eventToAgent[event_type] || "reviewer";
    const taskType = eventToTaskType[event_type] || "bug";
    const sev = severity || "low";

    // 3. Create task (pending)
    const { data: task, error: taskError } = await supabase
      .from("sail_tasks")
      .insert({
        type: taskType,
        priority: sev === "high" ? "high" : sev === "medium" ? "medium" : "low",
        status: "in_progress",
        agent,
        title: `[${agent.toUpperCase()}] ${event_type} from ${source}`,
        description: JSON.stringify(data || {}, null, 2),
        context: { event_id: event.id, source, original_data: data },
        risk_level: "low", // refined after LLM
        approval_required: false,
      })
      .select().single();
    if (taskError) throw taskError;

    await supabase.from("sail_events").update({ task_id: task.id, processed: true }).eq("id", event.id);

    // 4. Run LLM analysis
    const llm = await runAgentLLM(agent, event_type, source, sev, data);

    let finalRisk = sev === "high" ? "high" : sev === "medium" ? "medium" : "low";
    let finalStatus = "review";
    let codePatch: string | null = null;

    if (llm.ok && llm.data) {
      finalRisk = llm.data.risk_assessment || finalRisk;
      codePatch = formatPatch(llm.data);
    } else {
      codePatch = `LLM analysis failed: ${llm.error ?? "unknown"}`;
    }

    const approvalRequired = finalRisk !== "low";
    finalStatus = approvalRequired ? "pending" : "review";

    await supabase.from("sail_tasks").update({
      status: finalStatus,
      risk_level: finalRisk,
      approval_required: approvalRequired,
      code_patch: codePatch,
      updated_at: new Date().toISOString(),
    }).eq("id", task.id);

    // 5. Log agent actions
    await supabase.from("sail_agent_logs").insert([
      {
        task_id: task.id, agent, action: `process_${event_type}`,
        input: { event_id: event.id, severity: sev },
        output: { task_status: finalStatus, risk_level: finalRisk },
        duration_ms: 0, success: true,
      },
      {
        task_id: task.id, agent, action: "llm_analysis",
        input: { model: "google/gemini-3-flash-preview" },
        output: llm.ok ? llm.data : { error: llm.error, status: llm.status },
        duration_ms: llm.durationMs, success: llm.ok,
        error_message: llm.ok ? null : llm.error,
      },
    ]);

    return new Response(JSON.stringify({
      success: true, task_id: task.id, event_id: event.id,
      agent, risk_level: finalRisk, approval_required: approvalRequired,
      llm_ok: llm.ok,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: unknown) {
    console.error("SAIL Agent error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
