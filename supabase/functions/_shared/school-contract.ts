// _shared/school-contract.ts — server-side P8 billing/contract guard.
// Mirrors src/lib/schoolContract.ts so edge functions refuse access for
// suspended, archived, expired, or not-yet-started schools.
//
// On denial we:
//   1. Return a structured JSON error body { error, code, status, reason }
//      so the SPA can show contract-aware messaging.
//   2. Write a row into public.school_audit_logs with action
//      'contract_gate_denied' so operators can debug access issues.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "./ai-config.ts";

export interface SchoolContractRow {
  id: string;
  name: string;
  status: string;
  plan: string | null;
  contract_start: string | null;
  contract_end: string | null;
}

export interface DenialContext {
  /** Calling user (nullable for unauthenticated access). */
  userId?: string | null;
  /** Membership role of the caller, if known. */
  role?: string | null;
  /** Short feature label (e.g. 'analytics', 'rag.search'). */
  feature: string;
}

export type GateResult =
  | { ok: true; school: SchoolContractRow }
  | { ok: false; status: number; code: string; reason: string };

export async function assertSchoolContractLive(
  svc: SupabaseClient,
  schoolId: string,
): Promise<GateResult> {
  const { data, error } = await svc
    .from("schools")
    .select("id,name,status,plan,contract_start,contract_end")
    .eq("id", schoolId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, code: "LOOKUP_FAILED", reason: error.message };
  if (!data) return { ok: false, status: 404, code: "SCHOOL_NOT_FOUND", reason: "School not found" };
  const s = data as SchoolContractRow;
  const now = new Date();

  if (s.status === "suspended")
    return { ok: false, status: 402, code: "SUSPENDED", reason: "School is suspended — contact billing." };
  if (s.status === "archived")
    return { ok: false, status: 410, code: "ARCHIVED", reason: "School has been archived." };
  if (s.contract_start && new Date(s.contract_start) > now)
    return { ok: false, status: 423, code: "NOT_STARTED", reason: `Contract starts on ${s.contract_start}.` };
  if (s.contract_end && new Date(s.contract_end) < now)
    return { ok: false, status: 402, code: "EXPIRED", reason: `Contract ended on ${s.contract_end} — contact billing to renew.` };

  return { ok: true, school: s };
}

export async function logContractDenial(
  svc: SupabaseClient,
  schoolId: string,
  denial: Extract<GateResult, { ok: false }>,
  ctx: DenialContext,
): Promise<void> {
  try {
    await svc.from("school_audit_logs").insert({
      school_id: schoolId,
      actor_id: ctx.userId ?? null,
      action: "contract_gate_denied",
      target_table: "schools",
      target_id: schoolId,
      diff: {
        feature: ctx.feature,
        role: ctx.role ?? null,
        code: denial.code,
        status: denial.status,
        reason: denial.reason,
        at: new Date().toISOString(),
      },
    });
  } catch (_e) {
    // Never fail the request because audit logging failed.
  }
}

/**
 * One-shot helper used by edge functions. Returns a `Response` to send back
 * when the contract is not live, or `null` to continue processing.
 */
export async function enforceSchoolContract(
  svc: SupabaseClient,
  schoolId: string,
  ctx: DenialContext,
): Promise<{ school: SchoolContractRow } | { response: Response }> {
  const gate = await assertSchoolContractLive(svc, schoolId);
  if (gate.ok) return { school: gate.school };

  await logContractDenial(svc, schoolId, gate, ctx);
  const body = {
    error: gate.reason,
    code: gate.code,
    status: gate.status,
    reason: gate.reason,
    feature: ctx.feature,
  };
  return {
    response: new Response(JSON.stringify(body), {
      status: gate.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }),
  };
}

export function makeServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
