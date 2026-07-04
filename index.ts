/**
 * run-learning-ops-automation
 *
 * Phase 3.1 automation runtime. Executes LOS scheduled jobs and writes into
 * `learning_ops_automation_runs` via the SECURITY DEFINER RPCs shipped in
 * `20260702101500_learning_ops_phase3_1_automation_runtime_and_ingestion.sql`.
 *
 * Trigger modes:
 *   1. `POST /run-learning-ops-automation`
 *      Body: { workspace_id?: string, job?: JobName, dry_run?: boolean }
 *   2. `POST /run-learning-ops-automation` (no body / cron trigger)
 *      Iterates every workspace with an enabled schedule whose next_run_at
 *      is due, and executes the job.
 *
 * Job names:
 *   - nightly_intervention_sweep
 *   - weekly_cohort_rollup
 *   - guardian_digest  (delegated to send-guardian-report edge function)
 *
 * Invoke from pg_cron with the service-role key:
 *   select net.http_post(
 *     url := concat(current_setting('app.settings.supabase_url'), '/functions/v1/run-learning-ops-automation'),
 *     headers := jsonb_build_object('Authorization', concat('Bearer ', current_setting('app.settings.service_role_key')))
 *   );
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type JobName =
  | "nightly_intervention_sweep"
  | "weekly_cohort_rollup"
  | "guardian_digest"
  | "study_plan_optimizer"
  | "route_interventions_to_teachers";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RunResult {
  workspace_id: string | null;
  job: JobName;
  status: "succeeded" | "failed" | "skipped";
  rows_processed: number;
  error?: string;
  details?: unknown;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

async function invokeGuardianDigest(): Promise<Response> {
  const url = `${SUPABASE_URL}/functions/v1/send-guardian-report`;
  return await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ triggered_by: "run-learning-ops-automation" }),
  });
}

async function runJobForWorkspace(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string | null,
  job: JobName,
): Promise<RunResult> {
  try {
    if (job === "nightly_intervention_sweep") {
      if (!workspaceId) {
        return {
          workspace_id: null,
          job,
          status: "skipped",
          rows_processed: 0,
          error: "workspace_id required",
        };
      }
      const { data, error } = await supabase.rpc("run_nightly_intervention_sweep", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      return {
        workspace_id: workspaceId,
        job,
        status: "succeeded",
        rows_processed: Number((data as { auto_resolved?: number })?.auto_resolved ?? 0),
        details: data,
      };
    }

    if (job === "weekly_cohort_rollup") {
      if (!workspaceId) {
        return {
          workspace_id: null,
          job,
          status: "skipped",
          rows_processed: 0,
          error: "workspace_id required",
        };
      }
      const { data, error } = await supabase.rpc("run_weekly_cohort_rollup", {
        p_workspace_id: workspaceId,
      });
      if (error) throw error;
      const cohorts = ((data as { cohorts?: unknown[] })?.cohorts ?? []) as unknown[];
      return {
        workspace_id: workspaceId,
        job,
        status: "succeeded",
        rows_processed: cohorts.length,
        details: data,
      };
    }

    if (job === "study_plan_optimizer") {
      if (!workspaceId) {
        return { workspace_id: null, job, status: "skipped", rows_processed: 0, error: "workspace_id required" };
      }
      const { data, error } = await supabase.rpc("run_study_plan_optimizer", { p_workspace_id: workspaceId });
      if (error) throw error;
      const created = Number((data as { proposals_created?: number })?.proposals_created ?? 0);
      return { workspace_id: workspaceId, job, status: "succeeded", rows_processed: created, details: data };
    }

    if (job === "route_interventions_to_teachers") {
      if (!workspaceId) {
        return { workspace_id: null, job, status: "skipped", rows_processed: 0, error: "workspace_id required" };
      }
      const startResp = await supabase.rpc("record_automation_run_start", {
        p_job_name: "route_interventions_to_teachers",
        p_workspace_id: workspaceId,
        p_details: {},
      });
      if (startResp.error) throw startResp.error;
      const runId = startResp.data as string;
      const { data, error } = await supabase.rpc("route_interventions_to_teachers", { p_workspace_id: workspaceId });
      const routed = Number(data ?? 0);
      await supabase.rpc("record_automation_run_finish", {
        p_run_id: runId,
        p_status: error ? "failed" : "succeeded",
        p_rows_processed: routed,
        p_error_message: error?.message ?? null,
        p_details: { routed },
      });
      if (error) throw error;
      return { workspace_id: workspaceId, job, status: "succeeded", rows_processed: routed, details: { routed } };
    }

    if (job === "guardian_digest") {
      // Kick off guardian report edge function; log the run explicitly so it
      // surfaces in the Teacher Command Center automation cadence panel.
      const startResp = await supabase.rpc("record_automation_run_start", {
        p_job_name: "guardian_digest",
        p_workspace_id: workspaceId,
        p_details: { triggered_by: "run-learning-ops-automation" },
      });
      if (startResp.error) throw startResp.error;
      const runId = startResp.data as string;

      let sent = 0;
      let errText: string | undefined;
      try {
        const guardianResp = await invokeGuardianDigest();
        const guardianBody = await guardianResp.json().catch(() => ({}));
        sent = Number((guardianBody as { sent?: number })?.sent ?? 0);
        if (!guardianResp.ok) {
          errText = (guardianBody as { error?: string })?.error ?? `HTTP ${guardianResp.status}`;
        }
      } catch (err) {
        errText = err instanceof Error ? err.message : String(err);
      }

      await supabase.rpc("record_automation_run_finish", {
        p_run_id: runId,
        p_status: errText ? "failed" : "succeeded",
        p_rows_processed: sent,
        p_error_message: errText ?? null,
        p_details: { emails_sent: sent },
      });

      return {
        workspace_id: workspaceId,
        job,
        status: errText ? "failed" : "succeeded",
        rows_processed: sent,
        error: errText,
        details: { emails_sent: sent },
      };
    }

    return {
      workspace_id: workspaceId,
      job,
      status: "skipped",
      rows_processed: 0,
      error: `unknown job: ${job}`,
    };
  } catch (err) {
    return {
      workspace_id: workspaceId,
      job,
      status: "failed",
      rows_processed: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    let body: {
      workspace_id?: string;
      job?: JobName;
      dry_run?: boolean;
    } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const targetedWorkspaceId = body.workspace_id ?? null;
    const targetedJob = body.job;

    // Explicit single-job invocation
    if (targetedJob) {
      const result = await runJobForWorkspace(supabase, targetedWorkspaceId, targetedJob);
      return new Response(JSON.stringify({ results: [result] }), {
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    // Cron / autopilot mode: pick every due job across every workspace
    const nowIso = new Date().toISOString();
    const { data: schedules, error: scheduleErr } = await supabase
      .from("learning_ops_automation_schedule")
      .select("workspace_id, job_name, cadence, enabled, next_run_at")
      .eq("enabled", true)
      .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);

    if (scheduleErr) {
      return new Response(JSON.stringify({ error: scheduleErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const results: RunResult[] = [];
    for (const row of schedules ?? []) {
      const job = row.job_name as JobName;
      if (job === "concept_ingestion") continue; // handled by ingest-document-concepts
      if (body.dry_run) {
        results.push({
          workspace_id: row.workspace_id ?? null,
          job,
          status: "skipped",
          rows_processed: 0,
          details: { dry_run: true, cadence: row.cadence },
        });
        continue;
      }
      const result = await runJobForWorkspace(supabase, row.workspace_id ?? null, job);
      results.push(result);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    );
  }
});
