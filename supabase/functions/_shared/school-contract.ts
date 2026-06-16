// _shared/school-contract.ts — server-side P8 billing/contract guard.
// Mirrors src/lib/schoolContract.ts so edge functions refuse access for
// suspended, archived, expired, or not-yet-started schools.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

export interface SchoolContractRow {
  id: string;
  name: string;
  status: string;
  plan: string | null;
  contract_start: string | null;
  contract_end: string | null;
}

export async function assertSchoolContractLive(
  svc: SupabaseClient,
  schoolId: string,
): Promise<{ ok: true; school: SchoolContractRow } | { ok: false; status: number; reason: string }> {
  const { data, error } = await svc
    .from("schools")
    .select("id,name,status,plan,contract_start,contract_end")
    .eq("id", schoolId)
    .maybeSingle();
  if (error) return { ok: false, status: 500, reason: error.message };
  if (!data) return { ok: false, status: 404, reason: "School not found" };
  const s = data as SchoolContractRow;
  const now = new Date();

  if (s.status === "suspended") return { ok: false, status: 402, reason: "School is suspended — contact billing." };
  if (s.status === "archived") return { ok: false, status: 410, reason: "School is archived." };
  if (s.contract_start && new Date(s.contract_start) > now)
    return { ok: false, status: 423, reason: `Contract starts on ${s.contract_start}.` };
  if (s.contract_end && new Date(s.contract_end) < now)
    return { ok: false, status: 402, reason: `Contract ended on ${s.contract_end} — contact billing to renew.` };

  return { ok: true, school: s };
}

export function makeServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
