/**
 * run-learning-ops-automation
 *
 * Phase 3.1/3.2 automation runtime. Executes LOS scheduled jobs and writes
 * into `learning_ops_automation_runs` via the SECURITY DEFINER RPCs shipped
 * in the phase 3 migrations.
 *
 * Trigger modes:
 *   1. Explicit  → POST { workspace_id, job, dry_run? }
 *   2. Cron/auto → POST {} — iterates every enabled schedule whose
 *      next_run_at is due and runs its job.
 *
 * Jobs handled:
 *   - nightly_intervention_sweep       (self-records via SQL)
 *   - weekly_cohort_rollup             (self-records via SQL)
 *   - study_plan_optimizer             (self-records via SQL)
 *   - route_interventions_to_teachers  (wrapped here — SQL doesn't self-record)
 *   - guardian_digest                  (delegates to send-guardian-report)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const JOB_NAMES = [
  "nightly_intervention_sweep",
  "weekly_cohort_rollup",
  "guardian_digest",
  "study_plan_optimizer",
  "route_interventions_to_teachers",
] as const;
type JobName = (typeof JOB_NAMES)[number];

const WORKSPACE_REQUIRED: ReadonlySet<JobName> = new Set([
  "nightly_intervention_sweep",
  "weekly_cohort_rollup",
  "study_plan_optimizer",
  "route_interventions_to_teachers",
]);

const BodySchema = z
  .object({
    workspace_id: z.string().uuid().optional(),
    job: z.enum(JOB_NAMES).optional(),
    dry_run: z.boolean().optional(),
  })
  .strict();

interface RunResult {
  workspace_id: string | null;
  job: JobName;
  status: "succeeded" | "failed" | "skipped";
  rows_processed: number;
  duration_ms: number;
  error?: string;
  details?: unknown;
}

type Sb = ReturnType<typeof createClient>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ fn: "run-learning-ops-automation", event, ...data }));
}

async function invokeGuardianDigest(): Promise<{ ok: boolean; sent: number; error?: string }> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-guardian-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ triggered_by: "run-learning-ops-automation" }),
    });
    const body = (await res.json().catch(() => ({}))) as { sent?: number; error?: string };
    return {
      ok: res.ok,
      sent: Number(body.sent ?? 0),
      error: res.ok ? undefined : body.error ?? `HTTP ${res.status}`,
    };
  } catch (err) {
    return { ok: false, sent: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runJob(sb: Sb, workspaceId: string | null, job: JobName): Promise<RunResult> {
  const t0 = performance.now();
  const finalize = (r: Omit<RunResult, "duration_ms">): RunResult => ({
    ...r,
    duration_ms: Math.round(performance.now() - t0),
  });

  if (WORKSPACE_REQUIRED.has(job) && !workspaceId) {
    return finalize({
      workspace_id: null,
      job,
      status: "skipped",
      rows_processed: 0,
      error: "workspace_id required for this job",
    });
  }

  log("job_start", { job, workspace_id: workspaceId });

  try {
    if (job === "nightly_intervention_sweep") {
      const { data, error } = await sb.rpc("run_nightly_intervention_sweep", { p_workspace_id: workspaceId });
      if (error) throw error;
      const rows = Number((data as { auto_resolved?: number })?.auto_resolved ?? 0);
      return finalize({ workspace_id: workspaceId, job, status: "succeeded", rows_processed: rows, details: data });
    }

    if (job === "weekly_cohort_rollup") {
      const { data, error } = await sb.rpc("run_weekly_cohort_rollup", { p_workspace_id: workspaceId });
      if (error) throw error;
      const cohorts = ((data as { cohorts?: unknown[] })?.cohorts ?? []) as unknown[];
      return finalize({
        workspace_id: workspaceId,
        job,
        status: "succeeded",
        rows_processed: cohorts.length,
        details: data,
      });
    }

    if (job === "study_plan_optimizer") {
      // SQL function self-records into learning_ops_automation_runs.
      const { data, error } = await sb.rpc("run_study_plan_optimizer", { p_workspace_id: workspaceId });
      if (error) throw error;
      const created = Number((data as { proposals_created?: number })?.proposals_created ?? 0);
      return finalize({
        workspace_id: workspaceId,
        job,
        status: "succeeded",
        rows_processed: created,
        details: data,
      });
    }

    if (job === "route_interventions_to_teachers") {
      // SQL does NOT self-record — bracket with record_automation_run_{start,finish}.
      const startResp = await sb.rpc("record_automation_run_start", {
        p_job_name: "route_interventions_to_teachers",
        p_workspace_id: workspaceId,
        p_details: {},
      });
      if (startResp.error) throw startResp.error;
      const runId = startResp.data as string;

      const { data, error } = await sb.rpc("route_interventions_to_teachers", { p_workspace_id: workspaceId });
      const routed = Number(data ?? 0);

      await sb.rpc("record_automation_run_finish", {
        p_run_id: runId,
        p_status: error ? "failed" : "succeeded",
        p_rows_processed: routed,
        p_error_message: error?.message ?? null,
        p_details: { routed },
      });

      if (error) throw error;
      return finalize({
        workspace_id: workspaceId,
        job,
        status: "succeeded",
        rows_processed: routed,
        details: { routed },
      });
    }

    if (job === "guardian_digest") {
      const startResp = await sb.rpc("record_automation_run_start", {
        p_job_name: "guardian_digest",
        p_workspace_id: workspaceId,
        p_details: { triggered_by: "run-learning-ops-automation" },
      });
      if (startResp.error) throw startResp.error;
      const runId = startResp.data as string;

      const g = await invokeGuardianDigest();

      await sb.rpc("record_automation_run_finish", {
        p_run_id: runId,
        p_status: g.ok ? "succeeded" : "failed",
        p_rows_processed: g.sent,
        p_error_message: g.error ?? null,
        p_details: { emails_sent: g.sent },
      });

      return finalize({
        workspace_id: workspaceId,
        job,
        status: g.ok ? "succeeded" : "failed",
        rows_processed: g.sent,
        error: g.error,
        details: { emails_sent: g.sent },
      });
    }

    return finalize({
      workspace_id: workspaceId,
      job,
      status: "skipped",
      rows_processed: 0,
      error: `unknown job: ${job}`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("job_error", { job, workspace_id: workspaceId, error: msg });
    return finalize({ workspace_id: workspaceId, job, status: "failed", rows_processed: 0, error: msg });
  } finally {
    log("job_end", { job, workspace_id: workspaceId, elapsed_ms: Math.round(performance.now() - t0) });
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const requestId = crypto.randomUUID();
  const t0 = performance.now();

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    let rawBody: unknown = {};
    try {
      const text = await req.text();
      rawBody = text ? JSON.parse(text) : {};
    } catch {
      return jsonResponse({ error: "invalid_json_body", request_id: requestId }, 400);
    }

    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      log("validation_failed", { request_id: requestId, issues: parsed.error.flatten() });
      return jsonResponse(
        { error: "invalid_body", details: parsed.error.flatten().fieldErrors, request_id: requestId },
        400,
      );
    }
    const { workspace_id, job, dry_run } = parsed.data;

    log("request_received", { request_id: requestId, workspace_id: workspace_id ?? null, job: job ?? null, dry_run: !!dry_run });

    // ── Explicit single-job invocation ────────────────────────────────────────
    if (job) {
      if (dry_run) {
        const result: RunResult = {
          workspace_id: workspace_id ?? null,
          job,
          status: "skipped",
          rows_processed: 0,
          duration_ms: 0,
          details: { dry_run: true },
        };
        return jsonResponse({ request_id: requestId, results: [result] });
      }
      const result = await runJob(sb, workspace_id ?? null, job);
      const status = result.status === "failed" ? 500 : 200;
      return jsonResponse({ request_id: requestId, results: [result] }, status);
    }

    // ── Cron/autopilot mode ───────────────────────────────────────────────────
    const nowIso = new Date().toISOString();
    const { data: schedules, error: scheduleErr } = await sb
      .from("learning_ops_automation_schedule")
      .select("workspace_id, job_name, cadence, enabled, next_run_at")
      .eq("enabled", true)
      .or(`next_run_at.is.null,next_run_at.lte.${nowIso}`);

    if (scheduleErr) {
      log("schedule_query_failed", { request_id: requestId, error: scheduleErr.message });
      return jsonResponse({ error: scheduleErr.message, request_id: requestId }, 500);
    }

    const results: RunResult[] = [];
    for (const row of schedules ?? []) {
      const rowJob = row.job_name as string;
      if (!JOB_NAMES.includes(rowJob as JobName)) {
        log("schedule_skip_unknown_job", { request_id: requestId, job: rowJob });
        continue;
      }
      if (rowJob === "concept_ingestion") continue; // handled by ingest-document-concepts
      const j = rowJob as JobName;

      if (dry_run) {
        results.push({
          workspace_id: row.workspace_id ?? null,
          job: j,
          status: "skipped",
          rows_processed: 0,
          duration_ms: 0,
          details: { dry_run: true, cadence: row.cadence },
        });
        continue;
      }
      results.push(await runJob(sb, row.workspace_id ?? null, j));
    }

    const failed = results.filter((r) => r.status === "failed").length;
    log("request_complete", {
      request_id: requestId,
      total: results.length,
      failed,
      elapsed_ms: Math.round(performance.now() - t0),
    });

    return jsonResponse({ request_id: requestId, results, total: results.length, failed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("request_error", { request_id: requestId, error: msg });
    return jsonResponse({ error: msg, request_id: requestId }, 500);
  }
});
